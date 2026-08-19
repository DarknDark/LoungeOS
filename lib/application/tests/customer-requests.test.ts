import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CustomerSession, Notification, ServiceTimelineEvent, TableSession } from '@workspace/domain';
import { createCustomerRequestService, CustomerRequestError } from '../src/customer-requests';

const clubId = 'club-customer-requests-test';
const tableSessionId = 'table-session-1';
const customerSessionId = 'customer-session-1';
const token = 'customer-token';
const now = '2026-08-04T12:00:00.000Z';

function makeHarness(options?: {
  customerAccessLevel?: CustomerSession['accessLevel'];
  customerApprovalStatus?: CustomerSession['approvalStatus'];
}) {
  let sequence = 0;
  const notifications: Notification[] = [];
  const timeline: ServiceTimelineEvent[] = [];
  const audit: unknown[] = [];

  const session: TableSession = {
    id: tableSessionId,
    clubId,
    tableId: 'table-1',
    businessDayId: 'business-day-1',
    ownerCustomerSessionId: customerSessionId,
    controllerType: 'customer',
    openedAt: '2026-08-04T10:00:00.000Z',
    status: 'active',
    runningTotalMinor: 0,
    expiresAt: '2026-08-04T23:00:00.000Z',
    lastActivityAt: '2026-08-04T11:00:00.000Z',
    version: 0,
  };
  const customer: CustomerSession = {
    id: customerSessionId,
    clubId,
    tableSessionId,
    createdAt: '2026-08-04T10:00:00.000Z',
    expiresAt: '2026-08-04T23:00:00.000Z',
    isTableOwner: true,
    accessLevel: options?.customerAccessLevel ?? 'owner',
    approvalStatus: options?.customerApprovalStatus ?? 'approved',
    recoveryTokenHash: `hash:${token}`,
  };

  const repositories = {
    tableSessions: {
      getById: async () => session,
    },
    customerSessions: {
      getById: async () => customer,
    },
    notifications: {
      save: async (notification: Notification) => {
        notifications.push(notification);
      },
      listForRecipient: async () => ({ items: notifications }),
      listForSession: async () => ({ items: notifications }),
      markRead: async () => undefined,
    },
    audit: {
      append: async (entry: unknown) => {
        audit.push(entry);
      },
      list: async () => ({ items: [] }),
    },
    serviceTimeline: {
      append: async (entry: ServiceTimelineEvent) => {
        timeline.push(entry);
      },
      listForSession: async () => ({ items: timeline }),
    },
  } as never;

  const service = createCustomerRequestService({
    repositories,
    ids: { next: () => `id-${++sequence}` },
    tokens: { hash: (value: string) => `hash:${value}` },
  });

  const actor = {
    kind: 'customer' as const,
    clubId,
    customerSessionId,
    customerSessionToken: token,
  };

  return { service, actor, session, customer, notifications, timeline, audit };
}

test('callWaiter creates a high-priority waiter notification with timeline and audit side effects', async () => {
  const harness = makeHarness();
  const notification = await harness.service.callWaiter({
    actor: harness.actor,
    tableSessionId,
    now,
  });

  assert.equal(notification.category, 'waiter');
  assert.equal(notification.recipientRole, 'waiter');
  assert.equal(notification.priority, 'high');
  assert.equal(notification.relatedRecord?.type, 'table-session');
  assert.equal(notification.relatedRecord?.id, tableSessionId);

  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.timeline.length, 1);
  assert.equal(harness.timeline[0].type, 'waiter-called');
  assert.equal(harness.audit.length, 1);
});

test('callWaiter is allowed for a customer session pending waiter approval', async () => {
  // Intentional exception: unlike ordering and song requests, a
  // pending-approval customer must still be able to flag down staff.
  const harness = makeHarness({
    customerAccessLevel: 'temporary',
    customerApprovalStatus: 'pending-approval',
  });
  const notification = await harness.service.callWaiter({
    actor: harness.actor,
    tableSessionId,
    now,
  });
  assert.equal(notification.category, 'waiter');
  assert.equal(harness.notifications.length, 1);
});

test('callWaiter is allowed for an approved but permanently temporary (read-only) customer session', async () => {
  const harness = makeHarness({
    customerAccessLevel: 'temporary',
    customerApprovalStatus: 'approved',
  });
  const notification = await harness.service.callWaiter({
    actor: harness.actor,
    tableSessionId,
    now,
  });
  assert.equal(notification.category, 'waiter');
});

test('callWaiter still requires a valid, matching session token', async () => {
  const harness = makeHarness();
  await assert.rejects(
    () =>
      harness.service.callWaiter({
        actor: { kind: 'customer', clubId, customerSessionId, customerSessionToken: 'wrong-token' },
        tableSessionId,
        now,
      }),
    (error: unknown) =>
      error instanceof CustomerRequestError &&
      error.code === 'NOT_AUTHORIZED' &&
      error.status === 401,
  );
  assert.equal(harness.notifications.length, 0);
});

test('callWaiter rejects a staff actor (customer-only endpoint)', async () => {
  const harness = makeHarness();
  await assert.rejects(
    () =>
      harness.service.callWaiter({
        actor: { kind: 'staff', clubId, staffId: 'staff-1', id: 'staff-1' },
        tableSessionId,
        now,
      }),
    (error: unknown) =>
      error instanceof CustomerRequestError &&
      error.code === 'NOT_AUTHORIZED' &&
      error.status === 401,
  );
});

test('callWaiter rejects a session that is no longer active', async () => {
  const harness = makeHarness();
  harness.session.status = 'closed';
  await assert.rejects(
    () => harness.service.callWaiter({ actor: harness.actor, tableSessionId, now }),
    (error: unknown) =>
      error instanceof CustomerRequestError &&
      error.code === 'SESSION_NOT_ACTIVE' &&
      error.status === 409,
  );
});

test('callWaiter enforces a server-side cooldown between calls', async () => {
  const harness = makeHarness();
  await harness.service.callWaiter({ actor: harness.actor, tableSessionId, now });

  const secondCallTime = '2026-08-04T12:00:30.000Z'; // 30s later, within cooldown
  await assert.rejects(
    () =>
      harness.service.callWaiter({
        actor: harness.actor,
        tableSessionId,
        now: secondCallTime,
      }),
    (error: unknown) =>
      error instanceof CustomerRequestError &&
      error.code === 'RATE_LIMITED' &&
      error.status === 429,
  );
  assert.equal(harness.notifications.length, 1);
});

test('callWaiter allows a new call once the cooldown window has passed', async () => {
  const harness = makeHarness();
  await harness.service.callWaiter({ actor: harness.actor, tableSessionId, now });

  const laterCallTime = '2026-08-04T12:03:00.000Z'; // 3 minutes later, past cooldown
  await harness.service.callWaiter({
    actor: harness.actor,
    tableSessionId,
    now: laterCallTime,
  });
  assert.equal(harness.notifications.length, 2);
});

test('callWaiter ignores archived waiter notifications when checking the cooldown', async () => {
  const harness = makeHarness();
  const first = await harness.service.callWaiter({ actor: harness.actor, tableSessionId, now });
  first.archivedAt = now;

  const secondCallTime = '2026-08-04T12:00:30.000Z';
  await harness.service.callWaiter({
    actor: harness.actor,
    tableSessionId,
    now: secondCallTime,
  });
  assert.equal(harness.notifications.length, 2);
});
