import type {
  AuditLog,
  CustomerSession,
  Notification,
  RepositoryRegistry,
  ServiceTimelineEvent,
  TableSession,
} from '@workspace/domain';
import type { RequestActor } from './services';
import { createAuditService } from './audit-engine';
import { createNotificationEngine } from './notification-engine';
import { createTimelineService } from './timeline-engine';
import { checkCustomerAccessLevel } from './customer-access';

export type CustomerRequestEngineDependencies = {
  repositories: Pick<
    RepositoryRegistry,
    'tableSessions' | 'customerSessions' | 'notifications' | 'audit' | 'serviceTimeline'
  >;
  ids: { next(): string };
  tokens: { hash(value: string): string };
};

export type CustomerRequestService = {
  callWaiter(input: {
    actor: RequestActor;
    tableSessionId: string;
    now: string;
  }): Promise<Notification>;
};

export class CustomerRequestError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_AUTHORIZED' | 'SESSION_NOT_ACTIVE' | 'RATE_LIMITED',
    readonly status = 409,
  ) {
    super(message);
    this.name = 'CustomerRequestError';
  }
}

// Minimum time a customer must wait before calling the waiter again for the
// same table session, so a waiter call cannot be spammed. This is enforced
// here (server-side); any client-side cooldown display is cosmetic only.
const WAITER_CALL_COOLDOWN_MS = 2 * 60 * 1000;

function isExpired(now: string, value?: string): boolean {
  if (!value) return false;
  return new Date(now).getTime() >= new Date(value).getTime();
}

/**
 * Creates the CustomerRequestService, currently covering "call waiter".
 *
 * Unlike ordering and song requests (which require full approval), a
 * waiter call is intentionally allowed for temporary and pending-approval
 * customers too — a customer who is stuck waiting for approval, or whose
 * access is permanently read-only, still needs a way to flag down staff.
 * The customer session itself must still be valid (correct recovery token,
 * session active, not expired).
 */
export function createCustomerRequestService(
  dependencies: CustomerRequestEngineDependencies,
): CustomerRequestService {
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
      throw new CustomerRequestError('A customer session is required.', 'NOT_AUTHORIZED', 401);
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
      throw new CustomerRequestError(
        'The customer session is not authorized.',
        'NOT_AUTHORIZED',
        401,
      );
    }
    // Intentional exception: temporary/pending-approval access is allowed
    // to call the waiter (checkCustomerAccessLevel with
    // allowTemporaryReadOnly=true), unlike ordering/song-requests.
    checkCustomerAccessLevel(customer, true);
    if (
      session.status === 'closed' ||
      session.status === 'completed' ||
      session.status === 'expired' ||
      session.status !== 'active' ||
      customer.expiredAt ||
      isExpired(now, session.expiresAt) ||
      isExpired(now, customer.expiresAt)
    ) {
      throw new CustomerRequestError(
        'The customer session is no longer active.',
        'SESSION_NOT_ACTIVE',
        409,
      );
    }
    return { session, customer };
  }

  return {
    async callWaiter(input) {
      const { session } = await activeCustomer(input.actor, input.tableSessionId, input.now);

      const recent = await repos.notifications.listForSession(input.actor.clubId, session.id);
      const cooldownCutoff = new Date(input.now).getTime() - WAITER_CALL_COOLDOWN_MS;
      const stillCoolingDown = recent.items.some(
        (item) =>
          item.category === 'waiter' &&
          !item.archivedAt &&
          new Date(item.createdAt).getTime() > cooldownCutoff,
      );
      if (stillCoolingDown) {
        throw new CustomerRequestError(
          'A waiter has already been called recently. Please wait a moment.',
          'RATE_LIMITED',
          429,
        );
      }

      const notification: Notification = {
        id: ids.next(),
        clubId: input.actor.clubId,
        recipientRole: 'waiter',
        priority: 'high',
        category: 'waiter',
        message: 'A customer has called for a waiter.',
        relatedRecord: { type: 'table-session', id: session.id },
        createdAt: input.now,
      };
      await notifications.createNotification(notification);

      const timelineEvent: ServiceTimelineEvent = {
        id: ids.next(),
        clubId: input.actor.clubId,
        tableSessionId: session.id,
        type: 'waiter-called',
        message: 'A customer called for a waiter.',
        sourceRecord: { type: 'notification', id: notification.id },
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
        action: 'waiter-called',
        resourceType: 'table-session',
        resourceId: session.id,
        timestamp: input.now,
        metadata: { tableSessionId: session.id },
        createdAt: input.now,
      };
      await audit.record(log);

      return notification;
    },
  };
}
