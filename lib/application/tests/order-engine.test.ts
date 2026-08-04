import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CLUB_SETTINGS,
  type CustomerSession,
  type InventoryItem,
  type MenuCategoryRecord,
  type MenuItem,
  type MenuModifier,
  type Notification,
  type Order,
  type OrderItem,
  type ServiceTimelineEvent,
  type TableSession,
} from '@workspace/domain';
import { InProcessEventBus } from '../src/infrastructure';
import { createOrderService, OrderError } from '../src/order-engine';

const clubId = 'club-order-test';
const tableSessionId = 'table-session-1';
const customerSessionId = 'customer-session-1';
const token = 'customer-token';
const now = '2026-08-04T12:00:00.000Z';

function makeHarness(options?: {
  available?: boolean;
  inventoryQuantity?: number;
  modifier?: MenuModifier;
  modifierOptions?: MenuModifier['options'];
  taxPercentage?: number;
  serviceChargePercentage?: number;
}) {
  let sequence = 0;
  const orders = new Map<string, Order>();
  const orderItems = new Map<string, OrderItem>();
  const notifications: Notification[] = [];
  const timeline: ServiceTimelineEvent[] = [];
  const audit: unknown[] = [];
  const queued: unknown[] = [];
  const inventory = new Map<string, InventoryItem>();
  const session: TableSession = {
    id: tableSessionId,
    clubId,
    tableId: 'table-1',
    businessDayId: 'business-day-1',
    ownerCustomerSessionId: customerSessionId,
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
    recoveryTokenHash: `hash:${token}`,
  };
  const menuItem: MenuItem = {
    id: 'menu-item-1',
    clubId,
    name: 'Club Burger',
    description: 'Test item',
    priceMinor: 1_000,
    currency: 'KES',
    category: 'food',
    preparationStationId: 'kitchen',
    available: options?.available ?? true,
    sortOrder: 1,
    version: 0,
  };
  const categories: MenuCategoryRecord[] = [
    {
      id: 'category-food',
      clubId,
      name: 'Food',
      slug: 'food',
      sortOrder: 1,
      active: true,
      version: 0,
    },
  ];
  if (options?.inventoryQuantity !== undefined) {
    inventory.set('inventory-1', {
      id: 'inventory-1',
      clubId,
      name: 'Burger patty',
      unit: 'portion',
      lowStockThreshold: 1,
      quantityOnHand: options.inventoryQuantity,
      reservedQuantity: 0,
      active: true,
      version: 0,
    });
    menuItem.inventoryItemId = 'inventory-1';
  }
  if (options?.modifier) {
    menuItem.modifierIds = [options.modifier.id];
  }
  const modifier = options?.modifier;
  const eventBus = new InProcessEventBus();
  const events: string[] = [];
  eventBus.subscribe('*', (event) => {
    events.push(event.type);
  });

  const repositories = {
    settings: {
      get: async () => ({
        ...DEFAULT_CLUB_SETTINGS,
        clubId,
        business: {
          ...DEFAULT_CLUB_SETTINGS.business,
          taxPercentage: options?.taxPercentage ?? 16,
          serviceChargePercentage: options?.serviceChargePercentage ?? 5,
        },
      }),
      save: async () => undefined,
    },
    tableSessions: {
      getById: async () => session,
      save: async (updated: TableSession) => Object.assign(session, updated),
      saveIfVersion: async (updated: TableSession, expectedVersion: number) => {
        if (session.version !== expectedVersion) throw new Error('STALE_VERSION');
        Object.assign(session, updated);
      },
    },
    customerSessions: {
      getById: async () => customer,
      save: async () => undefined,
    },
    menuCategories: {
      listActive: async () => categories,
      getById: async () => categories[0] ?? null,
      save: async () => undefined,
    },
    menuItems: {
      getById: async () => menuItem,
      listAvailable: async () => (menuItem.available ? [menuItem] : []),
      save: async () => undefined,
    },
    modifiers: {
      getById: async () => modifier ?? null,
      listForMenuItem: async () => (modifier ? [modifier] : []),
      getOption: async (_clubId: string, optionId: string) =>
        options?.modifierOptions?.find((option) => option.id === optionId) ?? null,
      saveModifier: async () => undefined,
      saveOption: async () => undefined,
    },
    orders: {
      getById: async (_clubId: string, orderId: string) => orders.get(orderId) ?? null,
      save: async (order: Order, items: OrderItem[]) => {
        orders.set(order.id, order);
        for (const item of items) orderItems.set(item.id, item);
      },
      saveIfVersion: async (order: Order, items: OrderItem[], expectedVersion: number) => {
        const current = orders.get(order.id);
        if ((current?.version ?? 0) !== expectedVersion) throw new Error('STALE_VERSION');
        orders.set(order.id, { ...order, version: expectedVersion + 1 });
        for (const item of items) orderItems.set(item.id, item);
      },
      findByIdempotencyKey: async (
        _clubId: string,
        requestedTableSessionId: string,
        requestedCustomerSessionId: string,
        idempotencyKey: string,
      ) =>
        [...orders.values()].find(
          (order) =>
            order.tableSessionId === requestedTableSessionId &&
            order.customerSessionId === requestedCustomerSessionId &&
            order.idempotencyKey === idempotencyKey,
        ) ?? null,
      listForSession: async () => ({ items: [...orders.values()] }),
      listForCustomerSession: async () => ({ items: [...orders.values()] }),
      listItems: async (_clubId: string, orderId: string) =>
        [...orderItems.values()].filter((item) => item.orderId === orderId),
    },
    orderItems: {
      listForOrder: async (_clubId: string, orderId: string) =>
        [...orderItems.values()].filter((item) => item.orderId === orderId),
      save: async (item: OrderItem) => orderItems.set(item.id, item),
    },
    inventory: {
      getItem: async (_clubId: string, inventoryItemId: string) =>
        inventory.get(inventoryItemId) ?? null,
      listItems: async () => ({ items: [...inventory.values()] }),
      appendTransaction: async () => undefined,
      listTransactions: async () => ({ items: [] }),
    },
    inventoryReservations: {
      reserve: async (input: {
        clubId: string;
        orderId: string;
        inventoryItemId: string;
        quantity: number;
        now: string;
      }) => {
        const item = inventory.get(input.inventoryItemId);
        if (
          item?.quantityOnHand !== undefined &&
          item.quantityOnHand - (item.reservedQuantity ?? 0) < input.quantity
        ) {
          throw new Error('ITEM_OUT_OF_STOCK');
        }
        if (item) item.reservedQuantity = (item.reservedQuantity ?? 0) + input.quantity;
        return {
          id: `reservation-${input.orderId}`,
          ...input,
          status: 'reserved' as const,
          createdAt: input.now,
          version: 0,
        };
      },
      releaseForOrder: async () => undefined,
      listForOrder: async () => [],
    },
    notifications: {
      save: async (notification: Notification) => notifications.push(notification),
      listForRecipient: async () => ({ items: notifications }),
      markRead: async () => undefined,
    },
    audit: {
      append: async (entry: unknown) => audit.push(entry),
      list: async () => ({ items: [] }),
    },
    serviceTimeline: {
      append: async (entry: ServiceTimelineEvent) => timeline.push(entry),
      listForSession: async () => ({ items: timeline }),
    },
    realtime: {
      subscribeToOrders: () => ({ unsubscribe: () => undefined }),
    },
    offlineQueue: {
      enqueue: async (entry: unknown) => queued.push(entry),
      listReady: async () => [],
      markRetry: async () => undefined,
      markCompleted: async () => undefined,
    },
  } as never;

  const service = createOrderService({
    repositories,
    ids: { next: () => `id-${++sequence}` },
    tokens: { hash: (value: string) => `hash:${value}` },
    events: eventBus,
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
  return { service, actor, staffActor, session, orders, notifications, timeline, audit, queued, events, inventory };
}

test('creates a priced order, updates the running bill, and emits shared side effects', async () => {
  const harness = makeHarness({ taxPercentage: 16, serviceChargePercentage: 5 });
  const result = await harness.service.create({
    actor: harness.actor,
    tableSessionId,
    idempotencyKey: 'order-key-1',
    items: [{ menuItemId: 'menu-item-1', quantity: 2 }],
    now,
  });

  assert.equal(result.order.status, 'submitted');
  assert.equal(result.order.subtotalMinor, 2_000);
  assert.equal(result.order.taxMinor, 320);
  assert.equal(result.order.serviceChargeMinor, 100);
  assert.equal(result.order.totalMinor, 2_420);
  assert.equal(harness.session.runningTotalMinor, 2_420);
  assert.deepEqual(harness.events, ['OrderDraft', 'OrderSubmitted']);
  assert.equal(harness.notifications.length, 2);
  assert.equal(harness.timeline.length, 2);
  assert.equal(harness.audit.length, 2);
});

test('returns the original order for a duplicate idempotency key', async () => {
  const harness = makeHarness();
  const input = {
    actor: harness.actor,
    tableSessionId,
    idempotencyKey: 'same-key',
    items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
    now,
  };
  const first = await harness.service.create(input);
  const second = await harness.service.create(input);
  assert.equal(second.order.id, first.order.id);
  assert.equal(harness.orders.size, 1);
});

test('rejects unavailable items and invalid required modifiers', async () => {
  await assert.rejects(
    () =>
      makeHarness({ available: false }).service.create({
        actor: makeHarness({ available: false }).actor,
        tableSessionId,
        idempotencyKey: 'unavailable',
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
        now,
      }),
    (error: unknown) => error instanceof OrderError && error.code === 'ITEM_OUT_OF_STOCK',
  );

  const modifier: MenuModifier = {
    id: 'modifier-size',
    clubId,
    name: 'Size',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    optionIds: ['option-large'],
    options: [],
    active: true,
    version: 0,
  };
  const harness = makeHarness({ modifier, modifierOptions: [] });
  await assert.rejects(
    () =>
      harness.service.create({
        actor: harness.actor,
        tableSessionId,
        idempotencyKey: 'missing-modifier',
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
        now,
      }),
    (error: unknown) => error instanceof OrderError && error.code === 'CONFIGURATION_INVALID',
  );
});

test('reserves stock on acceptance and rejects stale transitions', async () => {
  const harness = makeHarness({ inventoryQuantity: 1 });
  const created = await harness.service.create({
    actor: harness.actor,
    tableSessionId,
    idempotencyKey: 'stock-key',
    items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
    now,
  });
  const accepted = await harness.service.updateStatus({
    actor: harness.staffActor,
    orderId: created.order.id,
    status: 'accepted',
    expectedVersion: created.order.version ?? 0,
    now,
  });
  assert.equal(accepted.order.status, 'accepted');
  assert.equal(harness.inventory.get('inventory-1')?.reservedQuantity, 1);
  await assert.rejects(
    () =>
      harness.service.updateStatus({
        actor: harness.staffActor,
        orderId: created.order.id,
        status: 'preparing',
        expectedVersion: 0,
        now,
      }),
    /STALE_VERSION|CONFLICT/,
  );
});

test('restricts customer access to active table sessions and queues mutations', async () => {
  const harness = makeHarness();
  await harness.service.queueMutation({
    clubId,
    operation: 'update',
    resourceId: 'order-1',
    payload: { status: 'cancelled' },
    expectedVersion: 2,
    now,
  });
  assert.equal(harness.queued.length, 1);
  harness.session.status = 'closed';
  await assert.rejects(
    () =>
      harness.service.getForSession({
        actor: harness.actor,
        tableSessionId,
      }),
    (error: unknown) => error instanceof OrderError && error.code === 'SESSION_NOT_ACTIVE',
  );
});