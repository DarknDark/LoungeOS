import type {
  CustomerSession,
  Notification,
  Table,
  TableSession,
} from '@workspace/domain';
import {
  assertTableSessionTransition,
  type ClubSettings,
  type RepositoryRegistry,
} from '@workspace/domain';
import type {
  RequestActor,
  TableSessionAccess,
  TableSessionService,
} from './services';

export type TableSessionServiceDependencies = {
  repositories: Pick<
    RepositoryRegistry,
    | 'clubs'
    | 'tables'
    | 'tableSessions'
    | 'customerSessions'
    | 'settings'
    | 'businessDays'
    | 'notifications'
    | 'serviceTimeline'
    | 'audit'
  >;
  ids: { next(): string };
  tokens: { next(): string; hash(value: string): string };
};

export class TableSessionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'INVALID_QR'
      | 'TABLE_NOT_FOUND'
      | 'SESSION_NOT_FOUND'
      | 'SESSION_EXPIRED'
      | 'SESSION_CLOSED'
      | 'CUSTOMER_SESSION_NOT_FOUND'
      | 'ACCESS_DENIED'
      | 'OWNER_EXISTS'
      | 'CONTRIBUTOR_LIMIT'
      | 'SESSION_NOT_ACTIVE'
      | 'CONFIGURATION_INVALID',
  ) {
    super(message);
    this.name = 'TableSessionError';
  }
}

function addMinutes(now: string, minutes: number): string {
  return new Date(new Date(now).getTime() + minutes * 60_000).toISOString();
}

function minDate(...values: string[]): string {
  return values.reduce((earliest, value) =>
    new Date(value).getTime() < new Date(earliest).getTime() ? value : earliest,
  );
}

function isExpired(now: string, expiresAt: string): boolean {
  return new Date(now).getTime() >= new Date(expiresAt).getTime();
}

function isExpiringSoon(now: string, expiresAt: string): boolean {
  const remaining = new Date(expiresAt).getTime() - new Date(now).getTime();
  return remaining > 0 && remaining <= 5 * 60_000;
}

function validateSettings(settings: ClubSettings): void {
  if (
    settings.business.sessionTimeoutMinutes <= 0 ||
    settings.business.maximumTableTimeMinutes <= 0 ||
    settings.business.maximumContributors < 0
  ) {
    throw new TableSessionError(
      'Club session settings contain invalid timeout or contributor limits.',
      'CONFIGURATION_INVALID',
    );
  }
}

function notification(
  id: string,
  session: TableSession,
  recipientId: string,
  message: string,
  now: string,
): Notification {
  return {
    id,
    clubId: session.clubId,
    recipientId,
    priority: 'normal',
    message,
    relatedRecord: { type: 'tableSession', id: session.id },
    createdAt: now,
  };
}

export function createTableSessionService(
  dependencies: TableSessionServiceDependencies,
): TableSessionService {
  const {
    repositories: repos,
    ids,
    tokens,
  } = dependencies;

  async function settingsFor(clubId: string): Promise<ClubSettings> {
    const settings = await repos.settings.get(clubId);
    validateSettings(settings);
    return settings;
  }

  async function tableFor(
    clubId: string,
    tableId: string,
    qrToken: string,
    now: string,
  ): Promise<Table> {
    const table = await repos.tables.getById(clubId, tableId);
    if (!table) {
      throw new TableSessionError('The requested table was not found.', 'TABLE_NOT_FOUND');
    }
    if (!table.qrTokenHash || tokens.hash(qrToken) !== table.qrTokenHash) {
      throw new TableSessionError('The table QR token is invalid.', 'INVALID_QR');
    }
    if (table.qrTokenExpiresAt && isExpired(now, table.qrTokenExpiresAt)) {
      throw new TableSessionError('The table QR token has expired.', 'INVALID_QR');
    }
    if (table.status === 'closed' || table.status === 'cleaning') {
      throw new TableSessionError('The table is not currently available.', 'INVALID_QR');
    }
    return table;
  }

  async function activeSession(
    actor: RequestActor,
    tableSessionId: string,
    now: string,
  ): Promise<{ session: TableSession; customer: CustomerSession }> {
    const session = await repos.tableSessions.getById(actor.clubId, tableSessionId);
    if (!session) {
      throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
    }
    const customerSessionId = actor.customerSessionId;
    if (!customerSessionId) {
      throw new TableSessionError('A customer session is required.', 'ACCESS_DENIED');
    }
    const customer = await repos.customerSessions.getById(
      actor.clubId,
      customerSessionId,
    );
    if (!customer || customer.tableSessionId !== tableSessionId) {
      throw new TableSessionError('The customer session is not authorized.', 'ACCESS_DENIED');
    }
    if (
      !inputTokenMatches(customer.recoveryTokenHash, actor.customerSessionToken)
    ) {
      throw new TableSessionError('The customer session token is invalid.', 'ACCESS_DENIED');
    }
    if (session.status === 'closed' || session.status === 'completed') {
      throw new TableSessionError('The table session is closed.', 'SESSION_CLOSED');
    }
    if (
      session.status === 'expired' ||
      customer.expiredAt ||
      isExpired(now, session.expiresAt) ||
      isExpired(now, customer.expiresAt)
    ) {
      if (session.status !== 'expired') {
        const expiredSession = {
          ...session,
          status: 'expired' as const,
          lastActivityAt: now,
        };
        await repos.tableSessions.save(expiredSession);
        await repos.customerSessions.expire(actor.clubId, customer.id, now);
        const table = await repos.tables.getById(actor.clubId, session.tableId);
        if (table) {
          await repos.tables.save({
            ...table,
            status: 'available',
            activeSessionId: undefined,
          });
        }
        await repos.notifications.save(
          notification(
            `${session.id}:session-expired`,
            session,
            session.ownerCustomerSessionId,
            'Session expired.',
            now,
          ),
        );
        await repos.serviceTimeline.append({
          id: `${session.id}:timeline-expired`,
          clubId: session.clubId,
          tableSessionId: session.id,
          type: 'session-expired',
          message: 'Your table session expired.',
          sourceRecord: { type: 'tableSession', id: session.id },
          occurredAt: now,
        });
      }
      throw new TableSessionError('The table session has expired.', 'SESSION_EXPIRED');
    }
    if (isExpiringSoon(now, session.expiresAt)) {
      await repos.notifications.save(
        notification(
          `${session.id}:session-expiring`,
          session,
          customer.id,
          'Your table session is expiring soon.',
          now,
        ),
      );
    }
    return { session, customer };
  }

  function inputTokenMatches(
    expectedHash: string | undefined,
    token: string | undefined,
  ): boolean {
    return Boolean(expectedHash && token && tokens.hash(token) === expectedHash);
  }

  async function access(
    session: TableSession,
    customer: CustomerSession,
    recoveryToken: string,
  ): Promise<TableSessionAccess> {
    return { tableSession: session, customerSession: customer, recoveryToken };
  }

  const service: TableSessionService = {
    async validateQr(input) {
      return tableFor(input.clubId, input.tableId, input.qrToken, input.now);
    },

    async createFromQr(input) {
      if (input.actor.kind !== 'customer') {
        throw new TableSessionError('Only a customer can create a table session.', 'ACCESS_DENIED');
      }
      const settings = await settingsFor(input.actor.clubId);
      const table = await tableFor(
        input.actor.clubId,
        input.tableId,
        input.qrToken,
        input.now,
      );
      const existing = await repos.tableSessions.getActiveForTable(
        input.actor.clubId,
        input.tableId,
      );
      if (existing) {
        throw new TableSessionError(
          'This table already has an active session. Join it instead.',
          'OWNER_EXISTS',
        );
      }
      const sessionId = ids.next();
      const customerSessionId = ids.next();
      const recoveryToken = tokens.next();
      const businessDay = await repos.businessDays.getActive(input.actor.clubId);
      if (!businessDay || businessDay.status !== 'open') {
        throw new TableSessionError(
          'The club does not have an open business day.',
          'CONFIGURATION_INVALID',
        );
      }
      const expiresAt = minDate(
        addMinutes(input.now, settings.business.sessionTimeoutMinutes),
        addMinutes(input.now, settings.business.maximumTableTimeMinutes),
      );
      const session: TableSession = {
        id: sessionId,
        clubId: input.actor.clubId,
        tableId: input.tableId,
        businessDayId: businessDay.id,
        ownerCustomerSessionId: customerSessionId,
        openedAt: input.now,
        status: 'active',
        runningTotalMinor: 0,
        expiresAt,
        lastActivityAt: input.now,
      };
      const customer: CustomerSession = {
        id: customerSessionId,
        clubId: input.actor.clubId,
        tableSessionId: sessionId,
        createdAt: input.now,
        expiresAt,
        isTableOwner: true,
        deviceId: input.deviceId,
        lastHeartbeatAt: input.now,
        recoveryTokenHash: tokens.hash(recoveryToken),
      };
      try {
        await repos.tableSessions.createOwnerSession({
          table,
          session,
          customerSession: customer,
          now: input.now,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'TABLE_SESSION_OWNER_EXISTS') {
          throw new TableSessionError(
            'This table already has an active session. Join it instead.',
            'OWNER_EXISTS',
          );
        }
        throw error;
      }
      await repos.notifications.save(
        notification(
          `${session.id}:session-started`,
          session,
          customer.id,
          'Session started.',
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${session.id}:timeline-started`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'session-started',
        message: 'Your table session has started.',
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      });
      return access(session, customer, recoveryToken);
    },

    async join(input) {
      if (input.actor.kind !== 'customer') {
        throw new TableSessionError('Only a customer can join a table session.', 'ACCESS_DENIED');
      }
      const settings = await settingsFor(input.actor.clubId);
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        input.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      await tableFor(input.actor.clubId, session.tableId, input.qrToken, input.now);
      if (
        session.status === 'closed' ||
        session.status === 'completed' ||
        session.status === 'expired' ||
        isExpired(input.now, session.expiresAt)
      ) {
        throw new TableSessionError(
          'The table session is no longer available.',
          session.status === 'expired' || isExpired(input.now, session.expiresAt)
            ? 'SESSION_EXPIRED'
            : 'SESSION_CLOSED',
        );
      }
      const existingDevice = input.deviceId
        ? await repos.customerSessions.getByDeviceId(
            input.actor.clubId,
            session.id,
            input.deviceId,
          )
        : null;
      if (existingDevice) {
        const recoveryToken = tokens.next();
        const refreshedCustomer = {
          ...existingDevice,
          recoveryTokenHash: tokens.hash(recoveryToken),
          lastHeartbeatAt: input.now,
          expiresAt: session.expiresAt,
        };
        await repos.customerSessions.save(refreshedCustomer);
        return access(session, refreshedCustomer, recoveryToken);
      }
      const customerSessionId = ids.next();
      const recoveryToken = tokens.next();
      const expiresAt = minDate(
        session.expiresAt,
        addMinutes(input.now, settings.business.sessionTimeoutMinutes),
      );
      const customer: CustomerSession = {
        id: customerSessionId,
        clubId: input.actor.clubId,
        tableSessionId: session.id,
        createdAt: input.now,
        expiresAt,
        isTableOwner: false,
        deviceId: input.deviceId,
        lastHeartbeatAt: input.now,
        recoveryTokenHash: tokens.hash(recoveryToken),
      };
      try {
        await repos.tableSessions.createParticipantSession({
          session,
          customerSession: customer,
          maximumContributors: settings.business.maximumContributors,
          now: input.now,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'TABLE_SESSION_CONTRIBUTOR_LIMIT') {
          throw new TableSessionError(
            'The table session has reached its contributor limit.',
            'CONTRIBUTOR_LIMIT',
          );
        }
        if (error instanceof Error && error.message === 'TABLE_SESSION_NOT_ACTIVE') {
          throw new TableSessionError(
            'The table session is no longer active.',
            'SESSION_NOT_ACTIVE',
          );
        }
        throw error;
      }
      await repos.notifications.save(
        notification(
          `${session.id}:joined:${customer.id}`,
          session,
          customer.id,
          'You joined the table session.',
          input.now,
        ),
      );
      return access(session, customer, recoveryToken);
    },

    async recover(input) {
      if (input.actor.kind !== 'customer') {
        throw new TableSessionError('Only a customer can recover a session.', 'ACCESS_DENIED');
      }
      const candidate = input.actor.customerSessionId
        ? await repos.customerSessions.getById(
            input.actor.clubId,
            input.actor.customerSessionId,
          )
        : null;
      if (
        !candidate ||
        candidate.recoveryTokenHash !== tokens.hash(input.recoveryToken)
      ) {
        throw new TableSessionError('The recovery token is invalid.', 'ACCESS_DENIED');
      }
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        candidate.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      const { session: active, customer } = await activeSession(
        {
          ...input.actor,
          customerSessionId: candidate.id,
          customerSessionToken: input.recoveryToken,
        },
        session.id,
        input.now,
      );
      const restored = {
        ...customer,
        deviceId: input.deviceId ?? customer.deviceId,
        lastHeartbeatAt: input.now,
      };
      await repos.customerSessions.save(restored);
      await repos.notifications.save(
        notification(
          `${active.id}:restored:${restored.id}:${input.now}`,
          active,
          restored.id,
          'Session restored.',
          input.now,
        ),
      );
      return access(active, restored, input.recoveryToken);
    },

    async heartbeat(input) {
      const { session, customer } = await activeSession(
        input.actor,
        input.tableSessionId,
        input.now,
      );
      const settings = await settingsFor(input.actor.clubId);
      const expiresAt = minDate(
        addMinutes(input.now, settings.business.sessionTimeoutMinutes),
        addMinutes(session.openedAt, settings.business.maximumTableTimeMinutes),
      );
      const updatedSession = {
        ...session,
        expiresAt,
        lastActivityAt: input.now,
      };
      const updatedCustomer = {
        ...customer,
        expiresAt,
        lastHeartbeatAt: input.now,
      };
      await repos.tableSessions.save(updatedSession);
      await repos.customerSessions.save(updatedCustomer);
      return access(updatedSession, updatedCustomer, '');
    },

    async getCustomerSession(input) {
      const { session } = await activeSession(input.actor, input.sessionId, new Date().toISOString());
      return session;
    },

    async getStatus(input) {
      const { session, customer } = await activeSession(
        input.actor,
        input.tableSessionId,
        input.now,
      );
      return access(session, customer, '');
    },

    async closeAfterVerifiedPayment(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new TableSessionError('Only authorized staff can close a session.', 'ACCESS_DENIED');
      }
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        input.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      if (session.status === 'closed' || session.status === 'expired') {
        return;
      }
      assertTableSessionTransition(session.status, 'closed');
      await repos.tableSessions.save({
        ...session,
        status: 'closed',
        closedAt: input.now,
        lastActivityAt: input.now,
      });
      const table = await repos.tables.getById(input.actor.clubId, session.tableId);
      if (table) {
        await repos.tables.save({
          ...table,
          status: 'available',
          activeSessionId: undefined,
        });
      }
      await repos.notifications.save(
        notification(
          `${session.id}:session-closed`,
          session,
          session.ownerCustomerSessionId,
          'Session closed.',
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${session.id}:timeline-closed`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'session-closed',
        message: 'Your table session has closed.',
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      });
    },
  };

  return service;
}