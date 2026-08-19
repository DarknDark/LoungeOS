import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  CustomerSession,
  Notification,
  ServiceTimelineEvent,
  SongRequest,
  TableSession,
} from '@workspace/domain';
import { createDJService, DJError } from '../src/dj-engine';

const clubId = 'club-dj-test';
const tableSessionId = 'table-session-1';
const customerSessionId = 'customer-session-1';
const token = 'customer-token';
const now = '2026-08-04T12:00:00.000Z';

function makeHarness(options?: {
  customerAccessLevel?: CustomerSession['accessLevel'];
  customerApprovalStatus?: CustomerSession['approvalStatus'];
}) {
  let sequence = 0;
  const songs = new Map<string, SongRequest>();
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
    songs: {
      getById: async (_clubId: string, requestId: string) => songs.get(requestId) ?? null,
      save: async (request: SongRequest) => {
        songs.set(request.id, request);
      },
      listQueue: async (_clubId: string, businessDayId: string) => ({
        items: [...songs.values()].filter(
          (item) =>
            item.businessDayId === businessDayId &&
            (item.status === 'queued' || item.status === 'playing'),
        ),
      }),
      listForSession: async (_clubId: string, requestedTableSessionId: string) => ({
        items: [...songs.values()].filter(
          (item) => item.tableSessionId === requestedTableSessionId,
        ),
      }),
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

  const service = createDJService({
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
  const staffActor = {
    kind: 'staff' as const,
    clubId,
    staffId: 'staff-1',
    id: 'staff-1',
  };

  return { service, actor, staffActor, session, customer, songs, notifications, timeline, audit };
}

test('submitRequest queues a new song request and notifies the DJ', async () => {
  const harness = makeHarness();
  const request = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Sweet Caroline',
    artist: 'Neil Diamond',
    now,
  });

  assert.equal(request.status, 'queued');
  assert.equal(request.queuePosition, 1);
  assert.equal(request.duplicateKey, 'sweet caroline::neil diamond');
  assert.equal(request.tableSessionId, tableSessionId);
  assert.equal(request.customerSessionId, customerSessionId);
  assert.equal(request.businessDayId, harness.session.businessDayId);

  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].category, 'dj');
  assert.equal(harness.notifications[0].recipientRole, 'dj');

  assert.equal(harness.timeline.length, 1);
  assert.equal(harness.timeline[0].type, 'song-requested');

  assert.equal(harness.audit.length, 1);
});

test('submitRequest assigns increasing queue positions for distinct songs', async () => {
  const harness = makeHarness();
  const first = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Sweet Caroline',
    artist: 'Neil Diamond',
    now,
  });
  const second = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Mr. Brightside',
    artist: 'The Killers',
    now,
  });
  assert.equal(first.queuePosition, 1);
  assert.equal(second.queuePosition, 2);
});

test('submitRequest returns the existing entry instead of duplicating a queued/playing song', async () => {
  const harness = makeHarness();
  const first = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Sweet Caroline',
    artist: 'Neil Diamond',
    now,
  });
  const duplicate = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: '  sweet caroline  ',
    artist: '  NEIL DIAMOND ',
    now,
  });
  assert.equal(duplicate.id, first.id);
  assert.equal(harness.songs.size, 1);
  // No extra notification/timeline entry for the duplicate.
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.timeline.length, 1);
});

test('submitRequest rejects blank song or artist', async () => {
  const harness = makeHarness();
  await assert.rejects(
    () =>
      harness.service.submitRequest({
        actor: harness.actor,
        tableSessionId,
        song: '   ',
        artist: 'Neil Diamond',
        now,
      }),
    (error: unknown) => error instanceof DJError && error.code === 'VALIDATION_ERROR',
  );
});

test('submitRequest blocks a customer session pending waiter approval', async () => {
  const harness = makeHarness({
    customerAccessLevel: 'temporary',
    customerApprovalStatus: 'pending-approval',
  });
  await assert.rejects(
    () =>
      harness.service.submitRequest({
        actor: harness.actor,
        tableSessionId,
        song: 'Sweet Caroline',
        artist: 'Neil Diamond',
        now,
      }),
    (error: unknown) =>
      error instanceof DJError && error.code === 'NOT_AUTHORIZED' && error.status === 403,
  );
  assert.equal(harness.songs.size, 0);
});

test('submitRequest blocks an approved but still-temporary customer session', async () => {
  // Mirrors order-engine's rule: approval alone never upgrades a
  // waiter-managed customer past accessLevel 'temporary', so song requests
  // (part of the approved-only dashboard) stay blocked.
  const harness = makeHarness({
    customerAccessLevel: 'temporary',
    customerApprovalStatus: 'approved',
  });
  await assert.rejects(
    () =>
      harness.service.submitRequest({
        actor: harness.actor,
        tableSessionId,
        song: 'Sweet Caroline',
        artist: 'Neil Diamond',
        now,
      }),
    (error: unknown) =>
      error instanceof DJError && error.code === 'NOT_AUTHORIZED' && error.status === 403,
  );
});

test('submitRequest rejects a request without a valid customer session', async () => {
  const harness = makeHarness();
  await assert.rejects(
    () =>
      harness.service.submitRequest({
        actor: { kind: 'customer', clubId, customerSessionId, customerSessionToken: 'wrong-token' },
        tableSessionId,
        song: 'Sweet Caroline',
        artist: 'Neil Diamond',
        now,
      }),
    (error: unknown) =>
      error instanceof DJError && error.code === 'NOT_AUTHORIZED' && error.status === 401,
  );
});

test('submitRequest rejects a staff actor (customer-only endpoint)', async () => {
  const harness = makeHarness();
  await assert.rejects(
    () =>
      harness.service.submitRequest({
        actor: harness.staffActor,
        tableSessionId,
        song: 'Sweet Caroline',
        artist: 'Neil Diamond',
        now,
      }),
    (error: unknown) =>
      error instanceof DJError && error.code === 'NOT_AUTHORIZED' && error.status === 401,
  );
});

test('listForSession returns song requests for an approved customer', async () => {
  const harness = makeHarness();
  await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Sweet Caroline',
    artist: 'Neil Diamond',
    now,
  });
  // listForSession checks expiry against the real wall-clock instead of an
  // injected `now`, so the mock session/customer must be set to expire well
  // beyond the current real date, not just the fixed test `now` used
  // elsewhere in this suite.
  harness.session.expiresAt = '2099-01-01T00:00:00.000Z';
  harness.customer.expiresAt = '2099-01-01T00:00:00.000Z';
  const list = await harness.service.listForSession({
    actor: harness.actor,
    tableSessionId,
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].song, 'Sweet Caroline');
});

test('listForSession blocks a temporary/pending customer session, matching submitRequest', async () => {
  const harness = makeHarness({
    customerAccessLevel: 'temporary',
    customerApprovalStatus: 'pending-approval',
  });
  await assert.rejects(
    () => harness.service.listForSession({ actor: harness.actor, tableSessionId }),
    (error: unknown) =>
      error instanceof DJError && error.code === 'NOT_AUTHORIZED' && error.status === 403,
  );
});

test('updateStatus transitions a song request and notifies the requesting customer', async () => {
  const harness = makeHarness();
  const request = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Sweet Caroline',
    artist: 'Neil Diamond',
    now,
  });
  const updated = await harness.service.updateStatus({
    actor: harness.staffActor,
    requestId: request.id,
    status: 'playing',
    now,
  });
  assert.equal(updated.status, 'playing');
  // One notification from submitRequest (to the DJ) + one from updateStatus
  // (to the customer).
  assert.equal(harness.notifications.length, 2);
  assert.equal(harness.notifications[1].recipientId, customerSessionId);
  assert.equal(harness.timeline.length, 2);
  assert.equal(harness.timeline[1].type, 'song-playing');
});

test('updateStatus records a skip reason', async () => {
  const harness = makeHarness();
  const request = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Sweet Caroline',
    artist: 'Neil Diamond',
    now,
  });
  const updated = await harness.service.updateStatus({
    actor: harness.staffActor,
    requestId: request.id,
    status: 'skipped',
    reason: 'Explicit version unavailable',
    now,
  });
  assert.equal(updated.status, 'skipped');
  assert.equal(updated.skipReason, 'Explicit version unavailable');
});

test('updateStatus rejects a customer actor (staff/system-only)', async () => {
  const harness = makeHarness();
  const request = await harness.service.submitRequest({
    actor: harness.actor,
    tableSessionId,
    song: 'Sweet Caroline',
    artist: 'Neil Diamond',
    now,
  });
  await assert.rejects(
    () =>
      harness.service.updateStatus({
        actor: harness.actor,
        requestId: request.id,
        status: 'playing',
        now,
      }),
    (error: unknown) =>
      error instanceof DJError && error.code === 'NOT_AUTHORIZED' && error.status === 403,
  );
});

test('updateStatus rejects an unknown song request', async () => {
  const harness = makeHarness();
  await assert.rejects(
    () =>
      harness.service.updateStatus({
        actor: harness.staffActor,
        requestId: 'missing-request',
        status: 'playing',
        now,
      }),
    (error: unknown) =>
      error instanceof DJError && error.code === 'SONG_REQUEST_NOT_FOUND' && error.status === 404,
  );
});
