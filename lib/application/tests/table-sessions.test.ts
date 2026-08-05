import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CLUB_SETTINGS,
  type BusinessDay,
  type CustomerSession,
  type Notification,
  type Payment,
  type ServiceTimelineEvent,
  type Table,
  type TableSession,
} from '@workspace/domain';
import {
  createTableSessionService,
  TableSessionError,
} from '../src/table-sessions';

const clubId = 'club-test';
const tableId = 'table-1';
const businessDay: BusinessDay = {
  id: 'business-day-1',
  clubId,
  businessDate: '2026-08-04',
  status: 'open',
  openedAt: '2026-08-04T10:00:00.000Z',
};

function makeHarness() {
  let id = 0;
  let token = 0;
  const tokenHash = (value: string) => `hash:${value}`;
  const table: Table = {
    id: tableId,
    clubId,
    number: 1,
    label: 'Table 1',
    qrVersion: 1,
    qrTokenHash: tokenHash('qr-token'),
    qrTokenExpiresAt: '2026-08-04T23:00:00.000Z',
    status: 'available',
  };
  const tables = new Map([[table.id, table]]);
  const sessions = new Map<string, TableSession>();
  const customers = new Map<string, CustomerSession>();
  const payments = new Map<string, Payment>();
  const notifications: Notification[] = [];
  const timeline: ServiceTimelineEvent[] = [];
  const settings = {
    ...DEFAULT_CLUB_SETTINGS,
    clubId,
    businessHours: {
      ...DEFAULT_CLUB_SETTINGS.businessHours,
      sessionTimeoutMinutes: 30,
      maximumTableTimeMinutes: 240,
      maximumContributors: 3,
    },
  };

  const service = createTableSessionService({
    repositories: {
      clubs: { getById: async () => null },
      tables: {
        getById: async (_clubId, requestedTableId) =>
          tables.get(requestedTableId) ?? null,
        list: async () => ({ items: [...tables.values()] }),
        save: async (updatedTable) => {
          tables.set(updatedTable.id, updatedTable);
        },
      },
      tableSessions: {
        getById: async (_clubId, sessionId) => sessions.get(sessionId) ?? null,
        getActiveForTable: async (_clubId, requestedTableId) =>
          [...sessions.values()].find(
            (candidate) =>
              candidate.tableId === requestedTableId &&
              ['created', 'active', 'splitting-bill', 'awaiting-payment'].includes(
                candidate.status,
              ),
          ) ?? null,
        save: async (session) => {
          sessions.set(session.id, session);
        },
        createOwnerSession: async ({ table: currentTable, session, customerSession }) => {
          if (currentTable.activeSessionId) throw new Error('TABLE_SESSION_OWNER_EXISTS');
          tables.set(currentTable.id, {
            ...currentTable,
            status: 'active',
            activeSessionId: session.id,
          });
          sessions.set(session.id, session);
          customers.set(customerSession.id, customerSession);
        },
        createStaffSession: async ({ table: currentTable, session }) => {
          if (currentTable.activeSessionId) throw new Error('TABLE_SESSION_OWNER_EXISTS');
          tables.set(currentTable.id, {
            ...currentTable,
            status: 'active',
            activeSessionId: session.id,
          });
          sessions.set(session.id, session);
        },
        approveCustomerSession: async ({ customerSession }) => {
          customers.set(customerSession.id, customerSession);
        },
        createParticipantSession: async ({
          session,
          customerSession,
          maximumContributors,
        }) => {
          const activeCustomers = [...customers.values()].filter(
            (candidate) =>
              candidate.tableSessionId === session.id && !candidate.expiredAt,
          );
          if (activeCustomers.length >= maximumContributors) {
            throw new Error('TABLE_SESSION_CONTRIBUTOR_LIMIT');
          }
          customers.set(customerSession.id, customerSession);
        },
      },
      customerSessions: {
        getById: async (_clubId, sessionId) => customers.get(sessionId) ?? null,
        listForTableSession: async (_clubId, tableSessionId) =>
          [...customers.values()].filter(
            (candidate) => candidate.tableSessionId === tableSessionId,
          ),
        getByDeviceId: async (_clubId, tableSessionId, deviceId) =>
          [...customers.values()].find(
            (candidate) =>
              candidate.tableSessionId === tableSessionId &&
              candidate.deviceId === deviceId &&
              !candidate.expiredAt,
          ) ?? null,
        save: async (customer) => {
          customers.set(customer.id, customer);
        },
        expire: async (_clubId, sessionId, expiredAt) => {
          const customer = customers.get(sessionId);
          if (customer) {
            customers.set(sessionId, {
              ...customer,
              expiredAt,
              expiresAt: expiredAt,
            });
          }
        },
      },
      settings: {
        get: async () => settings,
        save: async () => undefined,
      },
      businessDays: {
        getActive: async () => businessDay,
        save: async () => undefined,
      },
      notifications: {
        save: async (notification) => notifications.push(notification),
        listForRecipient: async () => ({ items: notifications }),
        markRead: async () => undefined,
      },
      serviceTimeline: {
        append: async (event) => timeline.push(event),
        listForSession: async () => ({ items: timeline }),
      },
      audit: {
        append: async () => undefined,
        list: async () => ({ items: [] }),
      },
      payments: {
        getById: async (_clubId, paymentId) => payments.get(paymentId) ?? null,
        save: async (payment) => {
          payments.set(payment.id, payment);
        },
        listForSession: async (_clubId, tableSessionId) => ({
          items: [...payments.values()].filter(
            (payment) => payment.tableSessionId === tableSessionId,
          ),
        }),
      },
    },
    ids: { next: () => `id-${++id}` },
    tokens: {
      next: () => `token-${++token}`,
      hash: tokenHash,
    },
  });

  return { service, tables, sessions, customers, payments, notifications, timeline };
}

function customerActor(
  customerSessionId?: string,
  customerSessionToken?: string,
) {
  return {
    kind: 'customer' as const,
    clubId,
    customerSessionId,
    customerSessionToken,
  };
}

test('validates QR tokens and rejects invalid or expired tokens', async () => {
  const { service } = makeHarness();
  const table = await service.validateQr({
    clubId,
    tableId,
    qrToken: 'qr-token',
    now: '2026-08-04T12:00:00.000Z',
  });
  assert.equal(table.id, tableId);
  await assert.rejects(
    () =>
      service.validateQr({
        clubId,
        tableId,
        qrToken: 'wrong-token',
        now: '2026-08-04T12:00:00.000Z',
      }),
    (error: unknown) =>
      error instanceof TableSessionError && error.code === 'INVALID_QR',
  );
});

test('creates one owner and rejects a second owner', async () => {
  const { service, tables } = makeHarness();
  const first = await service.createFromQr({
    actor: customerActor(),
    tableId,
    qrToken: 'qr-token',
    deviceId: 'owner-device',
    now: '2026-08-04T12:00:00.000Z',
  });
  assert.equal(first.customerSession.isTableOwner, true);
  assert.equal(tables.get(tableId)?.activeSessionId, first.tableSession.id);
  await assert.rejects(
    () =>
      service.createFromQr({
        actor: customerActor(),
        tableId,
        qrToken: 'qr-token',
        deviceId: 'other-device',
        now: '2026-08-04T12:01:00.000Z',
      }),
    (error: unknown) =>
      error instanceof TableSessionError && error.code === 'OWNER_EXISTS',
  );
});

test('opens an owner session from a permanent table identity', async () => {
  const { service, tables } = makeHarness();
  const access = await service.open({
    actor: customerActor(),
    tableId,
    deviceId: 'permanent-qr-device',
    now: '2026-08-04T12:00:00.000Z',
  });

  assert.equal(access.customerSession.isTableOwner, true);
  assert.equal(tables.get(tableId)?.status, 'active');
  assert.equal(tables.get(tableId)?.activeSessionId, access.tableSession.id);
  assert.notEqual(access.recoveryToken, 'qr-token');
});

test('requires close request before opening split payment branches', async () => {
  const { service, tables, sessions } = makeHarness();
  const owner = await service.open({
    actor: customerActor(),
    tableId,
    deviceId: 'owner-device',
    now: '2026-08-04T12:00:00.000Z',
  });

  await assert.rejects(
    () =>
      service.enablePaymentSplit({
        actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
        tableSessionId: owner.tableSession.id,
        splitCount: 2,
        now: '2026-08-04T12:05:00.000Z',
      }),
    (error: unknown) =>
      error instanceof TableSessionError && error.code === 'SESSION_NOT_ACTIVE',
  );

  const finishing = await service.requestClose({
    actor: customerActor(owner.customerSession.id, owner.recoveryToken),
    tableSessionId: owner.tableSession.id,
    now: '2026-08-04T12:06:00.000Z',
  });
  assert.equal(finishing.tableSession.status, 'awaiting-payment');
  assert.equal(tables.get(tableId)?.status, 'finishing');

  await service.enablePaymentSplit({
    actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
    tableSessionId: owner.tableSession.id,
    splitCount: 2,
    now: '2026-08-04T12:07:00.000Z',
  });
  assert.equal(tables.get(tableId)?.status, 'finishing');
  assert.equal(sessions.get(owner.tableSession.id)?.status, 'splitting-bill');
});

test('waiter can reopen a finishing tab and restore the active table state', async () => {
  const { service, tables, sessions, notifications, timeline } = makeHarness();
  const owner = await service.open({
    actor: customerActor(),
    tableId,
    deviceId: 'owner-device',
    now: '2026-08-04T12:00:00.000Z',
  });

  await service.requestClose({
    actor: customerActor(owner.customerSession.id, owner.recoveryToken),
    tableSessionId: owner.tableSession.id,
    now: '2026-08-04T12:02:00.000Z',
  });
  const reopened = await service.reopenClose({
    actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
    tableSessionId: owner.tableSession.id,
    now: '2026-08-04T12:03:00.000Z',
  });

  assert.equal(reopened.status, 'active');
  assert.equal(sessions.get(owner.tableSession.id)?.status, 'active');
  assert.equal(tables.get(tableId)?.status, 'active');
  assert.equal(tables.get(tableId)?.activeSessionId, owner.tableSession.id);
  assert.ok(notifications.some((entry) => entry.message.includes('reopened')));
  assert.ok(timeline.some((entry) => entry.type === 'finishing-up-cancelled'));
});

test('requires verified payment before closing and expires every customer session', async () => {
  const { service, sessions, customers, payments, tables } = makeHarness();
  const owner = await service.open({
    actor: customerActor(),
    tableId,
    deviceId: 'owner-device',
    now: '2026-08-04T12:00:00.000Z',
  });
  sessions.set(owner.tableSession.id, {
    ...owner.tableSession,
    runningTotalMinor: 1000,
  });
  await service.requestClose({
    actor: customerActor(owner.customerSession.id, owner.recoveryToken),
    tableSessionId: owner.tableSession.id,
    now: '2026-08-04T12:02:00.000Z',
  });
  const payment = await service.submitPayment({
    actor: customerActor(owner.customerSession.id, owner.recoveryToken),
    tableSessionId: owner.tableSession.id,
    method: 'cash',
    now: '2026-08-04T12:03:00.000Z',
  });
  await assert.rejects(
    () =>
      service.closeAfterVerifiedPayment({
        actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
        tableSessionId: owner.tableSession.id,
        now: '2026-08-04T12:04:00.000Z',
      }),
    (error: unknown) =>
      error instanceof TableSessionError && error.code === 'PAYMENT_NOT_SETTLED',
  );
  assert.equal(payments.get(payment.id)?.status, 'submitted');
  await service.verifyPayment({
    actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
    paymentId: payment.id,
    now: '2026-08-04T12:05:00.000Z',
  });
  await service.closeAfterVerifiedPayment({
    actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
    tableSessionId: owner.tableSession.id,
    now: '2026-08-04T12:06:00.000Z',
  });
  assert.equal(payments.get(payment.id)?.status, 'verified');
  assert.equal(sessions.get(owner.tableSession.id)?.status, 'closed');
  assert.ok(customers.get(owner.customerSession.id)?.expiredAt);
  assert.equal(tables.get(tableId)?.status, 'available');
});

test('manual tables require waiter approval and temporary access is read-only', async () => {
  const { service } = makeHarness();
  const manual = await service.openManual({
    actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
    tableId,
    now: '2026-08-04T12:00:00.000Z',
  });
  const pending = await service.join({
    actor: customerActor(),
    tableSessionId: manual.id,
    deviceId: 'guest-device',
    now: '2026-08-04T12:02:00.000Z',
  });
  assert.equal(pending.customerSession.approvalStatus, 'pending-approval');
  const pendingStatus = await service.getStatus({
    actor: customerActor(pending.customerSession.id, pending.recoveryToken),
    tableSessionId: manual.id,
    now: '2026-08-04T12:03:00.000Z',
  });
  assert.equal(pendingStatus.customerSession.approvalStatus, 'pending-approval');
  const approved = await service.approveJoin({
    actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
    tableSessionId: manual.id,
    customerSessionId: pending.customerSession.id,
    now: '2026-08-04T12:04:00.000Z',
  });
  assert.equal(approved.approvalStatus, 'approved');
  await assert.rejects(
    () =>
      service.submitPayment({
        actor: customerActor(pending.customerSession.id, pending.recoveryToken),
        tableSessionId: manual.id,
        method: 'cash',
        now: '2026-08-04T12:05:00.000Z',
      }),
    (error: unknown) =>
      error instanceof TableSessionError && error.code === 'ACCESS_DENIED',
  );
});

test('customer-owned tables reject ordinary new joins', async () => {
  const { service } = makeHarness();
  const owner = await service.createFromQr({
    actor: customerActor(),
    tableId,
    qrToken: 'qr-token',
    deviceId: 'owner-device',
    now: '2026-08-04T12:00:00.000Z',
  });
  await assert.rejects(
    () =>
      service.join({
        actor: customerActor(),
        tableSessionId: owner.tableSession.id,
        deviceId: 'guest-device',
        now: '2026-08-04T12:02:00.000Z',
      }),
    (error: unknown) =>
      error instanceof TableSessionError && error.code === 'TABLE_NOT_AVAILABLE',
  );
});

test('recovers after refresh and authorizes status with the recovered token', async () => {
  const { service } = makeHarness();
  const owner = await service.createFromQr({
    actor: customerActor(),
    tableId,
    qrToken: 'qr-token',
    deviceId: 'owner-device',
    now: '2026-08-04T12:00:00.000Z',
  });
  const recovered = await service.recover({
    actor: customerActor(owner.customerSession.id),
    customerSessionId: owner.customerSession.id,
    recoveryToken: owner.recoveryToken,
  });
  assert.equal(recovered.tableSession.id, owner.tableSession.id);
  const status = await service.getStatus({
    actor: customerActor(
      recovered.customerSession.id,
      recovered.recoveryToken,
    ),
    tableSessionId: owner.tableSession.id,
    now: '2026-08-04T12:05:00.000Z',
  });
  assert.equal(status.customerSession.id, owner.customerSession.id);
});

test('permanent QR is reusable immediately after the waiter closes the table', async () => {
  const { service, tables, sessions, customers } = makeHarness();

  // First customer scans the permanent QR and opens a session.
  const first = await service.createFromQr({
    actor: customerActor(),
    tableId,
    qrToken: 'qr-token',
    deviceId: 'device-first',
    now: '2026-08-04T12:00:00.000Z',
  });
  assert.equal(tables.get(tableId)?.status, 'active');
  assert.equal(tables.get(tableId)?.activeSessionId, first.tableSession.id);

  // Customer signals they are ready to pay (running total is 0, so no payment needed).
  await service.requestClose({
    actor: customerActor(first.customerSession.id, first.recoveryToken),
    tableSessionId: first.tableSession.id,
    now: '2026-08-04T12:05:00.000Z',
  });
  assert.equal(sessions.get(first.tableSession.id)?.status, 'awaiting-payment');

  // Waiter closes the table. Running total is 0 so payment verification passes immediately.
  await service.closeAfterVerifiedPayment({
    actor: { kind: 'staff', id: 'staff-1', staffId: 'staff-1', clubId },
    tableSessionId: first.tableSession.id,
    now: '2026-08-04T12:06:00.000Z',
  });

  assert.equal(sessions.get(first.tableSession.id)?.status, 'closed');
  assert.ok(customers.get(first.customerSession.id)?.expiredAt);
  assert.equal(tables.get(tableId)?.status, 'available');
  assert.equal(tables.get(tableId)?.activeSessionId, undefined);

  // The same permanent QR must be scannable by the next customer immediately —
  // no QR rotation, no regeneration.
  const second = await service.createFromQr({
    actor: customerActor(),
    tableId,
    qrToken: 'qr-token',
    deviceId: 'device-second',
    now: '2026-08-04T12:07:00.000Z',
  });

  assert.equal(second.customerSession.isTableOwner, true);
  assert.notEqual(second.tableSession.id, first.tableSession.id);
  assert.equal(second.tableSession.tableId, tableId);
  assert.equal(tables.get(tableId)?.status, 'active');
  assert.equal(tables.get(tableId)?.activeSessionId, second.tableSession.id);
});

test('heartbeat refreshes inactivity expiry and expiration releases the table', async () => {
  const { service, tables, notifications, timeline } = makeHarness();
  const owner = await service.createFromQr({
    actor: customerActor(),
    tableId,
    qrToken: 'qr-token',
    deviceId: 'owner-device',
    now: '2026-08-04T12:00:00.000Z',
  });
  const actor = customerActor(
    owner.customerSession.id,
    owner.recoveryToken,
  );
  const heartbeat = await service.heartbeat({
    actor,
    tableSessionId: owner.tableSession.id,
    customerSessionId: owner.customerSession.id,
    now: '2026-08-04T12:20:00.000Z',
  });
  assert.equal(heartbeat.tableSession.expiresAt, '2026-08-04T12:50:00.000Z');
  await assert.rejects(
    () =>
      service.getStatus({
        actor: customerActor(
          owner.customerSession.id,
          owner.recoveryToken,
        ),
        tableSessionId: owner.tableSession.id,
        now: '2026-08-04T12:51:00.000Z',
      }),
    (error: unknown) =>
      error instanceof TableSessionError && error.code === 'SESSION_EXPIRED',
  );
  assert.equal(tables.get(tableId)?.status, 'available');
  assert.ok(notifications.some((entry) => entry.message === 'Session expired.'));
  assert.ok(timeline.some((entry) => entry.type === 'session-expired'));
});