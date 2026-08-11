import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CLUB_SETTINGS,
  LoungeError,
  validateClubSettings,
  type AuditLog,
  type Notification,
  type OfflineQueue,
  type SyncQueueItem,
} from '@workspace/domain';
import {
  InProcessEventBus,
  InProcessJobScheduler,
  InProcessMetricsCollector,
  OfflineSyncCoordinator,
  createAuditService,
  createNotificationEngine,
  createRealtimeProjectionService,
} from '../src';

test('event bus publishes typed and wildcard subscribers', async () => {
  const bus = new InProcessEventBus();
  const received: string[] = [];
  bus.subscribe('SessionStarted', (event) => received.push(event.type));
  bus.subscribe('*', (event) => received.push(`all:${event.type}`));

  await bus.publish({
    id: 'event-1',
    clubId: 'club-1',
    occurredAt: '2026-08-04T10:00:00.000Z',
    type: 'SessionStarted',
    data: {},
  });

  assert.deepEqual(received, ['SessionStarted', 'all:SessionStarted']);
});

test('scheduler registers and runs a job once', async () => {
  const scheduler = new InProcessJobScheduler();
  let runs = 0;
  scheduler.register({
    id: 'job-1',
    name: 'test job',
    intervalMs: 60_000,
    run: async () => {
      runs += 1;
    },
  });

  await scheduler.runOnce('job-1');
  assert.equal(runs, 1);
  scheduler.stop();
});

test('metrics collector records increments and observations', async () => {
  const metrics = new InProcessMetricsCollector();
  await metrics.increment('sessions.started');
  await metrics.observe('repository.duration_ms', 12, { repository: 'tables' });
  const points = await metrics.snapshot();

  assert.equal(points.length, 2);
  assert.equal(points[0]?.name, 'sessions.started');
  assert.equal(points[1]?.value, 12);
});

test('notification engine supports lifecycle operations', async () => {
  const notifications: Notification[] = [];
  const repository = {
    save: async (notification: Notification) => notifications.push(notification),
    listForRecipient: async () => ({ items: notifications }),
    markRead: async (_clubId: string, id: string, readAt: string) => {
      const item = notifications.find((candidate) => candidate.id === id);
      if (item) item.readAt = readAt;
    },
    markDelivered: async (_clubId: string, id: string, deliveredAt: string) => {
      const item = notifications.find((candidate) => candidate.id === id);
      if (item) item.deliveredAt = deliveredAt;
    },
    archive: async (_clubId: string, id: string, archivedAt: string) => {
      const item = notifications.find((candidate) => candidate.id === id);
      if (item) item.archivedAt = archivedAt;
    },
  };
  const service = createNotificationEngine(repository);
  const notification: Notification = {
    id: 'notification-1',
    clubId: 'club-1',
    recipientId: 'staff-1',
    priority: 'normal',
    category: 'session',
    message: 'Session started',
    createdAt: '2026-08-04T10:00:00.000Z',
  };

  await service.createNotification(notification);
  await service.markDelivered({
    clubId: 'club-1',
    notificationId: notification.id,
    deliveredAt: '2026-08-04T10:00:01.000Z',
  });
  await service.markRead({
    clubId: 'club-1',
    notificationId: notification.id,
    readAt: '2026-08-04T10:00:02.000Z',
  });
  await service.archiveNotification({
    clubId: 'club-1',
    notificationId: notification.id,
    archivedAt: '2026-08-04T10:00:03.000Z',
  });

  assert.equal(notifications[0]?.deliveredAt, '2026-08-04T10:00:01.000Z');
  assert.equal(notifications[0]?.readAt, '2026-08-04T10:00:02.000Z');
  assert.equal(notifications[0]?.archivedAt, '2026-08-04T10:00:03.000Z');
});

test('audit service removes sensitive metadata', async () => {
  let saved: AuditLog | undefined;
  const service = createAuditService({
    append: async (log) => {
      saved = log;
    },
    list: async () => ({ items: [] }),
  });

  await service.record({
    id: 'audit-1',
    clubId: 'club-1',
    actorType: 'staff',
    action: 'settings-changed',
    resourceType: 'settings',
    resourceId: 'current',
    timestamp: '2026-08-04T10:00:00.000Z',
    createdAt: '2026-08-04T10:00:00.000Z',
    metadata: {
      safe: 'value',
      customerSessionToken: 'must-not-persist',
    },
  });

  assert.deepEqual(saved?.metadata, { safe: 'value' });
});

test('offline coordinator marks completed and retries conflicts', async () => {
  const items: SyncQueueItem[] = [
    {
      id: 'sync-1',
      clubId: 'club-1',
      operation: 'update',
      resourceType: 'table',
      resourceId: 'table-1',
      payload: {},
      attempts: 0,
      nextAttemptAt: '2026-08-04T10:00:00.000Z',
    },
  ];
  const actions: string[] = [];
  const queue: OfflineQueue = {
    enqueue: async (item) => items.push(item),
    listReady: async () => items,
    markRetry: async (_clubId, id, _next, error) => actions.push(`${id}:${error}`),
    markCompleted: async (_clubId, id) => actions.push(`${id}:completed`),
  };
  const coordinator = new OfflineSyncCoordinator(queue, async () => 'conflict');

  await coordinator.flush('club-1', '2026-08-04T10:00:00.000Z');
  assert.deepEqual(actions, ['sync-1:CONFLICT']);
});

test('realtime projection service forwards identifiers without source data', () => {
  const subscriptions: Array<{ unsubscribe(): void }> = [];
  const changes: Array<{ resource: string; type: string }> = [];
  const service = createRealtimeProjectionService({
    subscribeToSessions: (_clubId, listener) => {
      listener({ type: 'modified', value: { secret: 'must-not-forward' } });
      const subscription = { unsubscribe: () => undefined };
      subscriptions.push(subscription);
      return subscription;
    },
    subscribeToOrders: (_clubId, listener) => {
      listener({ type: 'added', value: { totalMinor: 999 } });
      const subscription = { unsubscribe: () => undefined };
      subscriptions.push(subscription);
      return subscription;
    },
    subscribeToNotifications: (_clubId, _recipientId, listener) => {
      listener({ type: 'removed', value: { message: 'private' } });
      const subscription = { unsubscribe: () => undefined };
      subscriptions.push(subscription);
      return subscription;
    },
  });

  const subscription = service.subscribe({
    clubId: 'club-1',
    recipientId: 'staff-1',
    listener: (projection) => changes.push(projection),
  });
  subscription.unsubscribe();

  assert.deepEqual(changes, [
    { resource: 'table-sessions', type: 'modified' },
    { resource: 'orders', type: 'added' },
    { resource: 'notifications', type: 'removed' },
  ]);
  assert.equal(JSON.stringify(changes).includes('secret'), false);
  assert.equal(subscriptions.length, 3);
});

test('club configuration validation rejects missing required values', () => {
  validateClubSettings(DEFAULT_CLUB_SETTINGS);
  assert.throws(
    () =>
      validateClubSettings({
        ...DEFAULT_CLUB_SETTINGS,
        general: { ...DEFAULT_CLUB_SETTINGS.general, name: '' },
      }),
    /CONFIGURATION_INVALID/,
  );
  assert.ok(new LoungeError('NOT_AUTHORIZED', 'not authorized'));
});