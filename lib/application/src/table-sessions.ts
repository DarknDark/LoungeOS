import type {
  CustomerSession,
  DomainEvent,
  Notification,
  Payment,
  ServiceTimelineEvent,
  Table,
  TableSession,
} from '@workspace/domain';
import {
  assertTableSessionTransition,
  type ClubSettings,
  type AuditLog,
  type EventPublisher,
  type RepositoryRegistry,
  validateClubSettings,
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
     | 'payments'
  >;
  ids: { next(): string };
  tokens: { next(): string; hash(value: string): string };
  events?: EventPublisher;
};

export class TableSessionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'INVALID_QR'
      | 'TABLE_NOT_AVAILABLE'
      | 'TABLE_NOT_FOUND'
      | 'SESSION_NOT_FOUND'
      | 'SESSION_EXPIRED'
      | 'SESSION_CLOSED'
      | 'CUSTOMER_SESSION_NOT_FOUND'
      | 'ACCESS_DENIED'
      | 'OWNER_EXISTS'
      | 'CONTRIBUTOR_LIMIT'
      | 'SESSION_NOT_ACTIVE'
      | 'CONFIGURATION_INVALID'
      | 'PAYMENT_TRANSPORT_UNAVAILABLE'
      | 'PAYMENT_NOT_FOUND'
      | 'PAYMENT_PENDING'
      | 'PAYMENT_NOT_SETTLED',
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
  try {
    validateClubSettings(settings);
  } catch {
    throw new TableSessionError(
      'Club configuration is invalid.',
      'CONFIGURATION_INVALID',
    );
  }
  if (
    settings.business.sessionTimeoutMinutes <= 0 ||
    settings.business.maximumTableTimeMinutes <= 0 ||
    settings.business.maximumContributors < 1
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
  recipientId: string | undefined,
  message: string,
  now: string,
): Notification {
  return {
    id,
    clubId: session.clubId,
    ...(recipientId ? { recipientId } : {}),
    priority: 'normal',
    category: 'session',
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

  async function recordAudit(
    actor: RequestActor,
    action: string,
    resourceType: string,
    resourceId: string,
    timestamp: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const actorId = actor.id ?? actor.staffId ?? actor.customerSessionId;
    const record: AuditLog = {
      id: ids.next(),
      clubId: actor.clubId,
      ...(actorId ? { actorId } : {}),
      actorType: actor.kind,
      action,
      resourceType,
      resourceId,
      timestamp,
      metadata,
      createdAt: timestamp,
    };
    await repos.audit.append(record);
  }

  async function publishEvent(
    event: Omit<DomainEvent, 'id'>,
  ): Promise<void> {
    if (!dependencies.events) return;
    await dependencies.events.publish({ ...event, id: ids.next() });
  }

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
    return table;
  }

  async function tableById(
    clubId: string,
    tableId: string,
  ): Promise<Table> {
    const table = await repos.tables.getById(clubId, tableId);
    if (!table) {
      throw new TableSessionError('The requested table was not found.', 'TABLE_NOT_FOUND');
    }
    return table;
  }

  function assertTableCanOpen(table: Table): void {
    if (table.status !== 'available') {
      throw new TableSessionError(
        table.status === 'active'
          ? 'This table already has an active session. Please ask your waiter.'
          : 'This table is not accepting new customer sessions.',
        'TABLE_NOT_AVAILABLE',
      );
    }
  }

  async function activeSession(
    actor: RequestActor,
    tableSessionId: string,
    now: string,
    allowFinishing = false,
    allowTemporaryReadOnly = false,
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
    if (!allowTemporaryReadOnly && customer.accessLevel === 'temporary') {
      throw new TableSessionError(
        'Temporary table access is read-only until your waiter changes it.',
        'ACCESS_DENIED',
      );
    }
    if (!allowTemporaryReadOnly && customer.approvalStatus !== 'approved') {
      throw new TableSessionError(
        'Your table access request is waiting for waiter approval.',
        'ACCESS_DENIED',
      );
    }
    if (session.status === 'closed' || session.status === 'completed') {
      throw new TableSessionError('The table session is closed.', 'SESSION_CLOSED');
    }
    if (
      !allowFinishing &&
      session.status !== 'active'
    ) {
      throw new TableSessionError(
        'The table session is not accepting this operation.',
        'SESSION_NOT_ACTIVE',
      );
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
        await recordAudit(
          actor,
          'session-expired',
          'tableSession',
          session.id,
          now,
          { tableId: session.tableId, customerSessionId: customer.id },
        );
        await publishEvent({
          clubId: session.clubId,
          occurredAt: now,
          actorId: actor.customerSessionId,
          sourceRecord: { type: 'tableSession', id: session.id },
          type: 'SessionExpired',
          data: { tableId: session.tableId, customerSessionId: customer.id },
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

  async function createOwnerSession(input: {
    actor: RequestActor;
    table: Table;
    deviceId?: string;
    now: string;
  }): Promise<TableSessionAccess> {
    const settings = await settingsFor(input.actor.clubId);
    const existing = await repos.tableSessions.getActiveForTable(
      input.actor.clubId,
      input.table.id,
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
      tableId: input.table.id,
      businessDayId: businessDay.id,
      ownerCustomerSessionId: customerSessionId,
      controllerType: 'customer',
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
      accessLevel: 'owner',
      approvalStatus: 'approved',
      deviceId: input.deviceId,
      lastHeartbeatAt: input.now,
      recoveryTokenHash: tokens.hash(recoveryToken),
    };
    try {
      await repos.tableSessions.createOwnerSession({
        table: input.table,
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
    await recordAudit(
      input.actor,
      'session-started',
      'tableSession',
      session.id,
      input.now,
      { tableId: session.tableId, customerSessionId: customer.id },
    );
    await publishEvent({
      clubId: session.clubId,
      occurredAt: input.now,
      actorId: input.actor.customerSessionId,
      sourceRecord: { type: 'tableSession', id: session.id },
      type: 'SessionStarted',
      data: { tableId: session.tableId, customerSessionId: customer.id },
    });
    return access(session, customer, recoveryToken);
  }

  async function access(
    session: TableSession,
    customer: CustomerSession,
    recoveryToken: string,
  ): Promise<TableSessionAccess> {
    return { tableSession: session, customerSession: customer, recoveryToken };
  }

  const service: TableSessionService = {
    async validateTable(input) {
      const table = await tableById(input.clubId, input.tableId);
      if (table.status !== 'available') {
        throw new TableSessionError(
          'This table is not accepting new customer sessions.',
          'TABLE_NOT_AVAILABLE',
        );
      }
      return table;
    },

    async validateQr(input) {
      return tableFor(input.clubId, input.tableId, input.qrToken, input.now);
    },

    async open(input) {
      if (input.actor.kind !== 'customer') {
        throw new TableSessionError('Only a customer can create a table session.', 'ACCESS_DENIED');
      }
      const table = await tableById(input.actor.clubId, input.tableId);
      if (table.activeSessionId) {
        const activeSession = await repos.tableSessions.getById(
          input.actor.clubId,
          table.activeSessionId,
        );
        if (
          activeSession &&
          activeSession.controllerType === 'staff' &&
          activeSession.status === 'active' &&
          !isExpired(input.now, activeSession.expiresAt)
        ) {
          return service.join({
            actor: input.actor,
            tableSessionId: activeSession.id,
            deviceId: input.deviceId,
            now: input.now,
          });
        }
      }
      assertTableCanOpen(table);
      return createOwnerSession({
        actor: input.actor,
        table,
        deviceId: input.deviceId,
        now: input.now,
      });
    },

    async openManual(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new TableSessionError('Only staff can open a manual table.', 'ACCESS_DENIED');
      }
      const table = await tableById(input.actor.clubId, input.tableId);
      assertTableCanOpen(table);
      const settings = await settingsFor(input.actor.clubId);
      const businessDay = await repos.businessDays.getActive(input.actor.clubId);
      if (!businessDay || businessDay.status !== 'open') {
        throw new TableSessionError(
          'The club does not have an open business day.',
          'CONFIGURATION_INVALID',
        );
      }
      const session: TableSession = {
        id: ids.next(),
        clubId: input.actor.clubId,
        tableId: table.id,
        businessDayId: businessDay.id,
        controllerType: 'staff',
        controllerStaffId: input.actor.staffId ?? input.actor.id,
        openedAt: input.now,
        status: 'active',
        runningTotalMinor: 0,
        expiresAt: minDate(
          addMinutes(input.now, settings.business.sessionTimeoutMinutes),
          addMinutes(input.now, settings.business.maximumTableTimeMinutes),
        ),
        lastActivityAt: input.now,
      };
      try {
        await repos.tableSessions.createStaffSession({
          table,
          session,
          now: input.now,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'TABLE_SESSION_OWNER_EXISTS') {
          throw new TableSessionError(
            'This table already has an active session.',
            'OWNER_EXISTS',
          );
        }
        throw error;
      }
      await repos.notifications.save(
        notification(
          `${session.id}:manual-started`,
          session,
          undefined,
          'A waiter opened this table manually.',
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${session.id}:timeline-manual-started`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'manual-session-started',
        message: 'Waiter opened a manual table session.',
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      });
      await recordAudit(
        input.actor,
        'manual-session-started',
        'tableSession',
        session.id,
        input.now,
        { tableId: session.tableId, staffId: session.controllerStaffId },
      );
      return session;
    },

    async approveJoin(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new TableSessionError('Only staff can approve table access.', 'ACCESS_DENIED');
      }
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        input.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      if (
        session.controllerType !== 'staff' ||
        session.status !== 'active' ||
        isExpired(input.now, session.expiresAt)
      ) {
        throw new TableSessionError(
          'This table is not accepting customer approvals.',
          'SESSION_NOT_ACTIVE',
        );
      }
      const customer = await repos.customerSessions.getById(
        input.actor.clubId,
        input.customerSessionId,
      );
      if (!customer || customer.tableSessionId !== session.id) {
        throw new TableSessionError(
          'The customer session was not found.',
          'CUSTOMER_SESSION_NOT_FOUND',
        );
      }
      if (customer.approvalStatus !== 'pending-approval') {
        throw new TableSessionError(
          'This customer access request is no longer pending.',
          'SESSION_NOT_ACTIVE',
        );
      }
      const approved = {
        ...customer,
        accessLevel: 'temporary' as const,
        approvalStatus: 'approved' as const,
        approvedAt: input.now,
        approvedByStaffId: input.actor.staffId ?? input.actor.id,
        updatedAt: input.now,
      };
      await repos.tableSessions.approveCustomerSession({
        session,
        customerSession: approved,
        now: input.now,
      });
      await repos.notifications.save(
        notification(
          `${customer.id}:join-approved`,
          session,
          customer.id,
          'Your waiter approved table access. You can view the shared bill and request service.',
          input.now,
        ),
      );
      await recordAudit(
        input.actor,
        'customer-join-approved',
        'customerSession',
        customer.id,
        input.now,
        { tableSessionId: session.id },
      );
      return approved;
    },

    async listJoinRequests(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new TableSessionError('Only staff can view table access requests.', 'ACCESS_DENIED');
      }
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        input.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      if (session.controllerType !== 'staff') {
        throw new TableSessionError(
          'Join approval is only available for waiter-controlled tables.',
          'CONFIGURATION_INVALID',
        );
      }
      return (
        await repos.customerSessions.listForTableSession(
          input.actor.clubId,
          input.tableSessionId,
        )
      ).filter((customer) => customer.approvalStatus === 'pending-approval' && !customer.expiredAt);
    },

    async createFromQr(input) {
      if (input.actor.kind !== 'customer') {
        throw new TableSessionError('Only a customer can create a table session.', 'ACCESS_DENIED');
      }
      const table = await tableFor(
        input.actor.clubId,
        input.tableId,
        input.qrToken,
        input.now,
      );
      if (table.activeSessionId) {
        const activeSession = await repos.tableSessions.getById(
          input.actor.clubId,
          table.activeSessionId,
        );
        if (
          activeSession &&
          activeSession.controllerType === 'staff' &&
          activeSession.status === 'active' &&
          !isExpired(input.now, activeSession.expiresAt)
        ) {
          return service.join({
            actor: input.actor,
            tableSessionId: activeSession.id,
            qrToken: input.qrToken,
            deviceId: input.deviceId,
            now: input.now,
          });
        }
      }
      return createOwnerSession({ ...input, table });
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
      const table = await tableById(input.actor.clubId, session.tableId);
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
      const consumeSplitSlot = input.consumeSplitSlot === true;
      if (!consumeSplitSlot && session.status !== 'active') {
        throw new TableSessionError(
          'This table is finishing up and is not accepting new guests.',
          'SESSION_NOT_ACTIVE',
        );
      }
      if (!consumeSplitSlot && session.controllerType === 'customer') {
        throw new TableSessionError(
          'This table already has an active tab. If you are seated here, please call your waiter.',
          'TABLE_NOT_AVAILABLE',
        );
      }
      if (consumeSplitSlot && (table.status !== 'finishing' || session.status !== 'splitting-bill')) {
        throw new TableSessionError(
          'This table is not accepting split-session joins.',
          'TABLE_NOT_AVAILABLE',
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
        accessLevel: session.controllerType === 'staff' ? 'temporary' : 'participant',
        approvalStatus: session.controllerType === 'staff' ? 'pending-approval' : 'approved',
        ...(session.controllerType === 'staff'
          ? { approvalRequestedAt: input.now }
          : {}),
        deviceId: input.deviceId,
        lastHeartbeatAt: input.now,
        recoveryTokenHash: tokens.hash(recoveryToken),
      };
      try {
        await repos.tableSessions.createParticipantSession({
          session,
          customerSession: customer,
          maximumContributors: settings.business.maximumContributors,
            consumeSplitSlot,
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
          session.controllerType === 'staff'
            ? 'A customer scanned the table QR code and requested join approval.'
            : 'You joined the table session.',
          input.now,
        ),
      );
      await recordAudit(
        input.actor,
        'guest-joined',
        'tableSession',
        session.id,
        input.now,
        { customerSessionId: customer.id, deviceId: input.deviceId },
      );
      await publishEvent({
        clubId: session.clubId,
        occurredAt: input.now,
        actorId: input.actor.customerSessionId,
        sourceRecord: { type: 'tableSession', id: session.id },
        type: 'GuestJoined',
        data: { customerSessionId: customer.id, deviceId: input.deviceId },
      });
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
        true,
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
      await recordAudit(
        input.actor,
        'session-recovered',
        'tableSession',
        active.id,
        input.now,
        { customerSessionId: restored.id, deviceId: restored.deviceId },
      );
      await publishEvent({
        clubId: active.clubId,
        occurredAt: input.now,
        actorId: input.actor.customerSessionId,
        sourceRecord: { type: 'tableSession', id: active.id },
        type: 'SessionRecovered',
        data: { customerSessionId: restored.id, deviceId: restored.deviceId },
      });
      return access(active, restored, input.recoveryToken);
    },

    async heartbeat(input) {
      const { session, customer } = await activeSession(
        input.actor,
        input.tableSessionId,
        input.now,
        true,
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

    async requestClose(input) {
      const { session, customer } = await activeSession(
        input.actor,
        input.tableSessionId,
        input.now,
        true,
      );
      if (session.status !== 'active') {
        throw new TableSessionError(
          'This table is already finishing up.',
          'SESSION_NOT_ACTIVE',
        );
      }
      const table = await repos.tables.getById(input.actor.clubId, session.tableId);
      if (!table || table.activeSessionId !== session.id) {
        throw new TableSessionError('The table session is not active.', 'SESSION_NOT_ACTIVE');
      }
      const updatedSession = {
        ...session,
        status: 'awaiting-payment' as const,
        lastActivityAt: input.now,
        updatedAt: input.now,
      };
      await repos.tableSessions.save(updatedSession);
      await repos.tables.save({
        ...table,
        status: 'finishing',
        splitSlotsRemaining: undefined,
        updatedAt: input.now,
      });
      await repos.notifications.save(
        notification(
          `${session.id}:finishing-up`,
          session,
          session.ownerCustomerSessionId,
          'Your table is finishing up. A waiter will confirm payment.',
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${session.id}:timeline-finishing-up`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'finishing-up',
        message: 'Customer requested to close the tab.',
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      });
      await recordAudit(
        input.actor,
        'close-requested',
        'tableSession',
        session.id,
        input.now,
        { tableId: session.tableId },
      );
      return access(updatedSession, customer, '');
    },

    async cancelClose(input) {
      const { session, customer } = await activeSession(
        input.actor,
        input.tableSessionId,
        input.now,
      );
      if (session.status !== 'awaiting-payment' && session.status !== 'splitting-bill') {
        throw new TableSessionError(
          'This table is not waiting to be closed.',
          'SESSION_NOT_ACTIVE',
        );
      }
      const table = await repos.tables.getById(input.actor.clubId, session.tableId);
      if (!table || table.activeSessionId !== session.id || table.status !== 'finishing') {
        throw new TableSessionError('The table session is not finishing up.', 'SESSION_NOT_ACTIVE');
      }
      const updatedSession = {
        ...session,
        status: 'active' as const,
        lastActivityAt: input.now,
        updatedAt: input.now,
      };
      await repos.tableSessions.save(updatedSession);
      await repos.tables.save({
        ...table,
        status: 'active',
        splitSlotsRemaining: undefined,
        updatedAt: input.now,
      });
      await repos.notifications.save(
        notification(
          `${session.id}:finishing-up-cancelled`,
          session,
          session.ownerCustomerSessionId,
          'Close request cancelled. Ordering is open again.',
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${session.id}:timeline-finishing-up-cancelled`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'finishing-up-cancelled',
        message: 'Customer cancelled the close request.',
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      });
      await recordAudit(
        input.actor,
        'close-request-cancelled',
        'tableSession',
        session.id,
        input.now,
        { tableId: session.tableId },
      );
      return access(updatedSession, customer, '');
    },

    async reopenClose(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new TableSessionError(
          'Only authorized staff can reopen a table.',
          'ACCESS_DENIED',
        );
      }
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        input.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      if (session.status !== 'awaiting-payment' && session.status !== 'splitting-bill') {
        throw new TableSessionError(
          'This table is not waiting to be reopened.',
          'SESSION_NOT_ACTIVE',
        );
      }
      const table = await repos.tables.getById(input.actor.clubId, session.tableId);
      if (!table || table.activeSessionId !== session.id || table.status !== 'finishing') {
        throw new TableSessionError(
          'The table session is not finishing up.',
          'SESSION_NOT_ACTIVE',
        );
      }
      const updatedSession: TableSession = {
        ...session,
        status: 'active',
        lastActivityAt: input.now,
        updatedAt: input.now,
        version: (session.version ?? 0) + 1,
      };
      await repos.tableSessions.save(updatedSession);
      await repos.tables.save({
        ...table,
        status: 'active',
        splitSlotsRemaining: undefined,
        updatedAt: input.now,
        version: (table.version ?? 0) + 1,
      });
      await repos.notifications.save(
        notification(
          `${session.id}:reopened:${input.now}`,
          session,
          session.ownerCustomerSessionId,
          'Your waiter reopened the tab. Ordering is available again.',
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${session.id}:timeline-reopened:${input.now}`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'finishing-up-cancelled',
        message: 'Waiter reopened the table tab.',
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      });
      await recordAudit(
        input.actor,
        'close-request-reopened',
        'tableSession',
        session.id,
        input.now,
        { tableId: session.tableId },
      );
      return updatedSession;
    },

    async getCustomerSession(input) {
      const { session } = await activeSession(
        input.actor,
        input.sessionId,
        new Date().toISOString(),
        true,
        true,
      );
      return session;
    },

    async getStatus(input) {
      const { session, customer } = await activeSession(
        input.actor,
        input.tableSessionId,
        input.now,
        true,
        true,
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
      if (
        session.controllerType !== 'staff' &&
        session.status !== 'awaiting-payment' &&
        session.status !== 'splitting-bill'
      ) {
        throw new TableSessionError(
          'The customer must request payment before the waiter can close the table.',
          'SESSION_NOT_ACTIVE',
        );
      }
      assertTableSessionTransition(session.status, 'closed');

      // Business validation: payment state must be fully settled.
      const payments = (
        await repos.payments.listForSession(input.actor.clubId, session.id)
      ).items;
      const currentPayments = payments.filter(
        (payment) => !payment.appliedToRunningBalanceAt,
      );
      const verifiedTotal = currentPayments
        .filter((payment) => payment.status === 'verified')
        .reduce((total, payment) => total + payment.amountMinor, 0);
      const submittedTotal = currentPayments
        .filter((payment) => payment.status === 'submitted')
        .reduce((total, payment) => total + payment.amountMinor, 0);
      if (submittedTotal > 0 || verifiedTotal < session.runningTotalMinor) {
        throw new TableSessionError(
          'All payment branches must be verified before the table can close.',
          'PAYMENT_NOT_SETTLED',
        );
      }
      if (verifiedTotal > session.runningTotalMinor) {
        throw new TableSessionError(
          'Verified payments exceed the current table balance.',
          'PAYMENT_NOT_SETTLED',
        );
      }

      const table = await repos.tables.getById(input.actor.clubId, session.tableId);
      if (!table) {
        throw new TableSessionError('The requested table was not found.', 'TABLE_NOT_FOUND');
      }

      // Build all side-effect records as pure values before any writes.
      const closedSession: TableSession = {
        ...session,
        status: 'closed',
        closedAt: input.now,
        lastActivityAt: input.now,
      };
      const notifRecord = notification(
        `${session.id}:session-closed`,
        session,
        session.ownerCustomerSessionId,
        'Session closed.',
        input.now,
      );
      const timelineRecord: ServiceTimelineEvent = {
        id: `${session.id}:timeline-closed`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'session-closed',
        message: 'Your table session has closed.',
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      };
      const actorId = input.actor.id ?? input.actor.staffId;
      const auditRecord: AuditLog = {
        id: ids.next(),
        clubId: session.clubId,
        ...(actorId ? { actorId } : {}),
        actorType: input.actor.kind,
        action: 'table-closed',
        resourceType: 'tableSession',
        resourceId: session.id,
        timestamp: input.now,
        metadata: { tableId: session.tableId },
        createdAt: input.now,
      };

      if (repos.tableSessions.closeAfterVerifiedPayment) {
        // Atomic path: all cleanup writes in a single Firestore transaction.
        // The repository verifies integrity and atomically closes the session,
        // expires all customer sessions, revokes payment tokens, resets the
        // table to available, and appends the notification, timeline event,
        // and audit record.
        await repos.tableSessions.closeAfterVerifiedPayment({
          session: closedSession,
          table,
          notification: notifRecord,
          timeline: timelineRecord,
          audit: auditRecord,
          now: input.now,
        });
      } else {
        // Fallback path: individual writes used in test environments that do
        // not implement the atomic repository method.
        await repos.tableSessions.save(closedSession);
        const customerSessions = await repos.customerSessions.listForTableSession(
          input.actor.clubId,
          session.id,
        );
        await Promise.all(
          customerSessions
            .filter((customer) => !customer.expiredAt)
            .map((customer) =>
              repos.customerSessions.expire(input.actor.clubId, customer.id, input.now),
            ),
        );
        await repos.tables.save({
          ...table,
          status: 'available',
          activeSessionId: undefined,
          splitSlotsRemaining: undefined,
        });
        await repos.notifications.save(notifRecord);
        await repos.serviceTimeline.append(timelineRecord);
        await repos.audit.append(auditRecord);
      }

      await publishEvent({
        clubId: session.clubId,
        occurredAt: input.now,
        actorId: input.actor.id ?? input.actor.staffId,
        sourceRecord: { type: 'tableSession', id: session.id },
        type: 'SessionClosed',
        data: { tableId: session.tableId },
      });
    },

    async submitPayment(input) {
      if (input.actor.kind !== 'customer') {
        throw new TableSessionError(
          'Only a customer can submit a Pay Now request.',
          'ACCESS_DENIED',
        );
      }
      if (input.method === 'mpesa') {
        throw new TableSessionError(
          'M-Pesa payment transport is not connected.',
          'PAYMENT_TRANSPORT_UNAVAILABLE',
        );
      }
      if (input.method !== 'cash' && input.method !== 'till') {
        throw new TableSessionError('The selected payment method is not supported.', 'CONFIGURATION_INVALID');
      }
      const { session } = await activeSession(
        input.actor,
        input.tableSessionId,
        input.now,
        true,
      );
      const payments = (
        await repos.payments.listForSession(input.actor.clubId, session.id)
      ).items;
      const settledOrPending = payments
        .filter(
          (payment) =>
            !payment.appliedToRunningBalanceAt &&
            (payment.status === 'verified' || payment.status === 'submitted'),
        )
        .reduce((total, payment) => total + payment.amountMinor, 0);
      const amountMinor = session.runningTotalMinor - settledOrPending;
      if (amountMinor <= 0) {
        throw new TableSessionError(
          'There is no outstanding balance to pay.',
          'PAYMENT_PENDING',
        );
      }
      if (payments.some((payment) => payment.status === 'submitted')) {
        throw new TableSessionError(
          'A payment is already waiting for waiter verification.',
          'PAYMENT_PENDING',
        );
      }
      const payment: Payment = {
        id: ids.next(),
        clubId: session.clubId,
        tableSessionId: session.id,
        businessDayId: session.businessDayId,
        method: input.method,
        amountMinor,
        currency: (await settingsFor(input.actor.clubId)).general.currency.code,
        status: 'submitted',
        createdAt: input.now,
      };
      await repos.payments.save(payment);
      await repos.notifications.save(
        notification(
          `${payment.id}:payment-submitted`,
          session,
          session.ownerCustomerSessionId,
          `Payment submitted for ${amountMinor} minor units. A waiter will verify it.`,
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${payment.id}:timeline-submitted`,
        clubId: session.clubId,
        tableSessionId: session.id,
        type: 'payment-submitted',
        message: `A ${input.method} payment was submitted.`,
        sourceRecord: { type: 'payment', id: payment.id },
        occurredAt: input.now,
      });
      await recordAudit(
        input.actor,
        'payment-submitted',
        'payment',
        payment.id,
        input.now,
        { tableSessionId: session.id, method: input.method, amountMinor },
      );
      return payment;
    },

    async verifyPayment(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new TableSessionError(
          'Only authorized staff can verify a payment.',
          'ACCESS_DENIED',
        );
      }
      const payment = await repos.payments.getById(input.actor.clubId, input.paymentId);
      if (!payment) {
        throw new TableSessionError('The payment was not found.', 'PAYMENT_NOT_FOUND');
      }
      if (payment.status !== 'submitted') {
        throw new TableSessionError(
          'Only submitted payments can be verified.',
          'PAYMENT_PENDING',
        );
      }
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        payment.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      const keepsTableActive =
        session.controllerType === 'staff' && session.status === 'active';
      const verified: Payment = {
        ...payment,
        status: 'verified',
        verifiedByStaffId: input.actor.staffId ?? input.actor.id,
        verifiedAt: input.now,
        ...(keepsTableActive ? { appliedToRunningBalanceAt: input.now } : {}),
      };
      await repos.payments.save(verified);
      if (keepsTableActive) {
        await repos.tableSessions.save({
          ...session,
          runningTotalMinor: 0,
          lastActivityAt: input.now,
          updatedAt: input.now,
          version: (session.version ?? 0) + 1,
        });
      }
      await repos.notifications.save(
        notification(
          `${payment.id}:payment-verified`,
          session,
          session.ownerCustomerSessionId,
          keepsTableActive
            ? 'Payment verified. The running bill was settled and the table remains active.'
            : 'Payment verified by your waiter.',
          input.now,
        ),
      );
      await recordAudit(
        input.actor,
        'payment-verified',
        'payment',
        payment.id,
        input.now,
        { tableSessionId: payment.tableSessionId, amountMinor: payment.amountMinor },
      );
      return verified;
    },

    async enablePaymentSplit(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new TableSessionError(
          'Only authorized staff can enable bill splitting.',
          'ACCESS_DENIED',
        );
      }
      if (!Number.isInteger(input.splitCount) || input.splitCount < 1) {
        throw new TableSessionError(
          'Split count must be a positive integer.',
          'CONFIGURATION_INVALID',
        );
      }
      const session = await repos.tableSessions.getById(
        input.actor.clubId,
        input.tableSessionId,
      );
      if (!session) {
        throw new TableSessionError('The table session was not found.', 'SESSION_NOT_FOUND');
      }
      const table = await repos.tables.getById(input.actor.clubId, session.tableId);
      if (!table) {
        throw new TableSessionError('The requested table was not found.', 'TABLE_NOT_FOUND');
      }
      if (
        table.activeSessionId !== session.id ||
        table.status !== 'finishing' ||
        session.status !== 'awaiting-payment'
      ) {
        throw new TableSessionError(
          'Split bills are available after the customer requests to close the tab.',
          'SESSION_NOT_ACTIVE',
        );
      }
      await repos.tables.save({
        ...table,
        splitSlotsRemaining: input.splitCount,
        updatedAt: input.now,
      });
      await repos.tableSessions.save({
        ...session,
        status: 'splitting-bill',
        lastActivityAt: input.now,
        updatedAt: input.now,
      });
      await repos.notifications.save(
        notification(
          `${session.id}:split-open:${input.now}`,
          session,
          session.ownerCustomerSessionId,
          `Bill splitting is open for ${input.splitCount} guest${input.splitCount === 1 ? '' : 's'}.`,
          input.now,
        ),
      );
      await repos.serviceTimeline.append({
        id: `${session.id}:timeline-split-open:${input.now}`,
        clubId: session.clubId,
        tableSessionId: session.id,
          type: 'payment-split-open',
          message: `Bill splitting opened for ${input.splitCount} payment branch${input.splitCount === 1 ? '' : 'es'}.`,
        sourceRecord: { type: 'tableSession', id: session.id },
        occurredAt: input.now,
      });
      await recordAudit(
        input.actor,
        'payment-split-opened',
        'tableSession',
        session.id,
        input.now,
        { tableId: table.id, splitCount: input.splitCount },
      );
    },
  };

  return service;
}