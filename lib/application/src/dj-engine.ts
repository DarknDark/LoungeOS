import type {
  AuditLog,
  CustomerSession,
  Notification,
  RepositoryRegistry,
  ServiceTimelineEvent,
  SongRequest,
  TableSession,
} from '@workspace/domain';
import type { DJService, RequestActor } from './services';
import { createAuditService } from './audit-engine';
import { createNotificationEngine } from './notification-engine';
import { createTimelineService } from './timeline-engine';
import { checkCustomerAccessLevel } from './customer-access';

export type DJEngineDependencies = {
  repositories: Pick<
    RepositoryRegistry,
    'tableSessions' | 'customerSessions' | 'songs' | 'notifications' | 'audit' | 'serviceTimeline'
  >;
  ids: { next(): string };
  tokens: { hash(value: string): string };
};

export class DJError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'NOT_AUTHORIZED'
      | 'SESSION_NOT_ACTIVE'
      | 'SONG_REQUEST_NOT_FOUND'
      | 'VALIDATION_ERROR',
    readonly status = 409,
  ) {
    super(message);
    this.name = 'DJError';
  }
}

function isExpired(now: string, value?: string): boolean {
  if (!value) return false;
  return new Date(now).getTime() >= new Date(value).getTime();
}

function normalizeDuplicateKey(song: string, artist: string): string {
  return `${song.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
}

function songStatusMessage(request: SongRequest): string {
  switch (request.status) {
    case 'playing':
      return `Now playing: "${request.song}" by ${request.artist}`;
    case 'played':
      return `Played: "${request.song}" by ${request.artist}`;
    case 'skipped':
      return `Skipped: "${request.song}" by ${request.artist}`;
    default:
      return `Queued: "${request.song}" by ${request.artist}`;
  }
}

/**
 * Creates the DJService application service for customer song requests.
 *
 * Song requests are part of the customer dashboard's approved-access
 * feature set (running bill, ordered items, request song, call waiter):
 * per CONTINUE.md a pending/temporary customer only ever sees the
 * "waiting for waiter approval" screen, not the dashboard itself, so
 * submitting and listing song requests requires full approval — unlike
 * call-waiter, which is intentionally allowed pre-approval.
 */
export function createDJService(dependencies: DJEngineDependencies): DJService {
  const { repositories: repos, ids, tokens } = dependencies;
  const audit = createAuditService(repos.audit);
  const notifications = createNotificationEngine(repos.notifications);
  const timeline = createTimelineService(repos.serviceTimeline);

  async function activeCustomer(
    actor: RequestActor,
    tableSessionId: string,
    now: string,
  ): Promise<{ session: TableSession; customer: CustomerSession }> {
    if (actor.kind !== 'customer' || !actor.customerSessionId || !actor.customerSessionToken) {
      throw new DJError('A customer session is required.', 'NOT_AUTHORIZED', 401);
    }
    const [session, customer] = await Promise.all([
      repos.tableSessions.getById(actor.clubId, tableSessionId),
      repos.customerSessions.getById(actor.clubId, actor.customerSessionId),
    ]);
    if (
      !session ||
      !customer ||
      customer.tableSessionId !== tableSessionId ||
      customer.id !== actor.customerSessionId ||
      !customer.recoveryTokenHash ||
      tokens.hash(actor.customerSessionToken) !== customer.recoveryTokenHash
    ) {
      throw new DJError('The customer session is not authorized.', 'NOT_AUTHORIZED', 401);
    }
    const accessViolation = checkCustomerAccessLevel(customer);
    if (accessViolation === 'ACCESS_TEMPORARY_READ_ONLY') {
      throw new DJError(
        'Temporary table access is read-only until your waiter changes it.',
        'NOT_AUTHORIZED',
        403,
      );
    }
    if (accessViolation === 'ACCESS_PENDING_APPROVAL') {
      throw new DJError(
        'Your table access request is waiting for waiter approval.',
        'NOT_AUTHORIZED',
        403,
      );
    }
    if (
      session.status === 'closed' ||
      session.status === 'completed' ||
      session.status === 'expired' ||
      session.status !== 'active' ||
      customer.expiredAt ||
      isExpired(now, session.expiresAt) ||
      isExpired(now, customer.expiresAt)
    ) {
      throw new DJError('The customer session is no longer active.', 'SESSION_NOT_ACTIVE', 409);
    }
    return { session, customer };
  }

  return {
    async submitRequest(input) {
      const { session, customer } = await activeCustomer(
        input.actor,
        input.tableSessionId,
        input.now,
      );
      const song = input.song.trim();
      const artist = input.artist.trim();
      if (!song || !artist) {
        throw new DJError('Song and artist are required.', 'VALIDATION_ERROR', 400);
      }

      const duplicateKey = normalizeDuplicateKey(song, artist);
      const queue = await repos.songs.listQueue(input.actor.clubId, session.businessDayId);
      const existing = queue.items.find((item) => item.duplicateKey === duplicateKey);
      if (existing) {
        // Already queued or currently playing this business day — surface
        // the existing request instead of creating a duplicate queue entry.
        return existing;
      }

      const request: SongRequest = {
        id: ids.next(),
        clubId: input.actor.clubId,
        tableSessionId: session.id,
        customerSessionId: customer.id,
        businessDayId: session.businessDayId,
        song,
        artist,
        duplicateKey,
        queuePosition: queue.items.length + 1,
        status: 'queued',
      };
      await repos.songs.save(request);

      const notification: Notification = {
        id: ids.next(),
        clubId: input.actor.clubId,
        recipientRole: 'dj',
        priority: 'normal',
        category: 'dj',
        message: `Song request: "${song}" by ${artist}`,
        relatedRecord: { type: 'song-request', id: request.id },
        createdAt: input.now,
      };
      await notifications.createNotification(notification);

      const timelineEvent: ServiceTimelineEvent = {
        id: ids.next(),
        clubId: input.actor.clubId,
        tableSessionId: session.id,
        type: 'song-requested',
        message: songStatusMessage(request),
        sourceRecord: { type: 'song-request', id: request.id },
        occurredAt: input.now,
      };
      await timeline.append(timelineEvent);

      const log: AuditLog = {
        id: ids.next(),
        clubId: input.actor.clubId,
        ...(input.actor.id || input.actor.customerSessionId
          ? { actorId: input.actor.id ?? input.actor.customerSessionId }
          : {}),
        actorType: input.actor.kind,
        action: 'song-requested',
        resourceType: 'song-request',
        resourceId: request.id,
        timestamp: input.now,
        metadata: { tableSessionId: session.id, song, artist },
        createdAt: input.now,
      };
      await audit.record(log);

      return request;
    },

    async listForSession(input) {
      await activeCustomer(input.actor, input.tableSessionId, new Date().toISOString());
      const page = await repos.songs.listForSession(input.actor.clubId, input.tableSessionId);
      return page.items;
    },

    // Staff/system-only. Not exposed via any API route in Phase 3 Part 2 —
    // DJ queue management (advancing/skipping the queue) is staff-dashboard
    // scope, tracked separately from the customer dashboard.
    async updateStatus(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new DJError('Only staff can update a song request.', 'NOT_AUTHORIZED', 403);
      }
      const existing = await repos.songs.getById(input.actor.clubId, input.requestId);
      if (!existing) {
        throw new DJError('The song request was not found.', 'SONG_REQUEST_NOT_FOUND', 404);
      }
      const updated: SongRequest = {
        ...existing,
        status: input.status,
        ...(input.status === 'skipped' && input.reason ? { skipReason: input.reason } : {}),
      };
      await repos.songs.save(updated);

      const notification: Notification = {
        id: ids.next(),
        clubId: input.actor.clubId,
        recipientId: updated.customerSessionId,
        priority: 'normal',
        category: 'dj',
        message: songStatusMessage(updated),
        relatedRecord: { type: 'song-request', id: updated.id },
        createdAt: input.now,
      };
      await notifications.createNotification(notification);

      const timelineEvent: ServiceTimelineEvent = {
        id: ids.next(),
        clubId: input.actor.clubId,
        tableSessionId: updated.tableSessionId,
        type: `song-${updated.status}`,
        message: songStatusMessage(updated),
        sourceRecord: { type: 'song-request', id: updated.id },
        occurredAt: input.now,
      };
      await timeline.append(timelineEvent);

      const log: AuditLog = {
        id: ids.next(),
        clubId: input.actor.clubId,
        ...(input.actor.id || input.actor.staffId
          ? { actorId: input.actor.id ?? input.actor.staffId }
          : {}),
        actorType: input.actor.kind,
        action: `song-${updated.status}`,
        resourceType: 'song-request',
        resourceId: updated.id,
        timestamp: input.now,
        metadata: { tableSessionId: updated.tableSessionId, status: updated.status },
        createdAt: input.now,
      };
      await audit.record(log);

      return updated;
    },
  };
}
