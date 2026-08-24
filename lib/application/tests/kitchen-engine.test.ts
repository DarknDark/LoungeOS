import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { KitchenTicket, Order, OrderItem } from '@workspace/domain';
import { createKitchenService, KitchenError } from '../src/kitchen-engine';

const clubId = 'club-kitchen-test';

function makeHarness() {
  const tickets = new Map<string, KitchenTicket>();

  const repositories = {
    tickets: {
      getById: async (_clubId: string, ticketId: string) => tickets.get(ticketId) ?? null,
      save: async (ticket: KitchenTicket) => {
        tickets.set(ticket.id, ticket);
      },
      listForStation: async (_clubId: string, stationId: string) => ({
        items: [...tickets.values()].filter((ticket) => ticket.stationId === stationId),
      }),
    },
    stations: {
      getById: async () => null,
      listActive: async () => [],
    },
  } as never;

  const service = createKitchenService({ repositories });

  const staffActor = { kind: 'staff' as const, clubId, staffId: 'staff-1', id: 'staff-1' };
  const customerActor = {
    kind: 'customer' as const,
    clubId,
    customerSessionId: 'customer-session-1',
    customerSessionToken: 'token',
  };

  return { service, tickets, staffActor, customerActor };
}

function makeOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'order-1',
    clubId,
    tableSessionId: 'table-session-1',
    customerSessionId: 'customer-session-1',
    businessDayId: 'business-day-1',
    status: 'preparing',
    itemIds: [],
    idempotencyKey: 'idempotency-1',
    subtotalMinor: 0,
    taxMinor: 0,
    serviceChargeMinor: 0,
    discountMinor: 0,
    totalMinor: 0,
    createdAt: '2026-08-04T12:00:00.000Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<OrderItem> & { id: string; preparationStationId: string }): OrderItem {
  return {
    orderId: 'order-1',
    clubId,
    menuItemId: 'menu-item-1',
    nameSnapshot: 'Club Burger',
    unitPriceMinor: 1_000,
    quantity: 1,
    lineSubtotalMinor: 1_000,
    modifiers: [],
    ...overrides,
  };
}

const now = '2026-08-04T12:05:00.000Z';

test('createTicketsForOrder creates one ticket per distinct station touched', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  const items = [
    makeItem({ id: 'item-1', preparationStationId: 'kitchen' }),
    makeItem({ id: 'item-2', preparationStationId: 'bar' }),
  ];

  const result = await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items,
    now,
  });

  assert.equal(result.length, 2);
  assert.equal(harness.tickets.size, 2);
  const kitchenTicket = harness.tickets.get('order-1:kitchen');
  const barTicket = harness.tickets.get('order-1:bar');
  assert.ok(kitchenTicket);
  assert.ok(barTicket);
  assert.deepEqual(kitchenTicket!.orderItemIds, ['item-1']);
  assert.deepEqual(barTicket!.orderItemIds, ['item-2']);
  assert.equal(kitchenTicket!.status, 'new');
  assert.equal(barTicket!.status, 'new');
});

test('createTicketsForOrder groups multiple items at the same station into a single ticket', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  const items = [
    makeItem({ id: 'item-1', preparationStationId: 'kitchen' }),
    makeItem({ id: 'item-2', preparationStationId: 'kitchen' }),
    makeItem({ id: 'item-3', preparationStationId: 'kitchen' }),
  ];

  const result = await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items,
    now,
  });

  assert.equal(result.length, 1);
  assert.equal(harness.tickets.size, 1);
  assert.deepEqual(harness.tickets.get('order-1:kitchen')!.orderItemIds, [
    'item-1',
    'item-2',
    'item-3',
  ]);
});

test('createTicketsForOrder uses deterministic ticket IDs (orderId:stationId)', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items: [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })],
    now,
  });
  assert.ok(harness.tickets.has('order-1:kitchen'));
});

test('createTicketsForOrder is idempotent: a second call for the same order+station does not duplicate', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  const items = [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })];

  await harness.service.createTicketsForOrder({ actor: harness.staffActor, order, items, now });
  await harness.service.createTicketsForOrder({ actor: harness.staffActor, order, items, now });

  assert.equal(harness.tickets.size, 1);
});

test('createTicketsForOrder strictly no-ops when the existing ticket has progressed beyond "new"', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  const items = [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })];

  await harness.service.createTicketsForOrder({ actor: harness.staffActor, order, items, now });
  // Kitchen staff progresses the ticket.
  await harness.service.updateTicket({
    actor: harness.staffActor,
    ticketId: 'order-1:kitchen',
    status: 'preparing',
    now,
  });

  // A duplicate/racing creation call must not reset it back to 'new'.
  const secondCallResult = await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items,
    now: '2026-08-04T12:10:00.000Z',
  });

  assert.equal(harness.tickets.size, 1);
  assert.equal(harness.tickets.get('order-1:kitchen')!.status, 'preparing');
  assert.equal(secondCallResult[0].status, 'preparing');
});

test('createTicketsForOrder handles an order with zero items gracefully', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  const result = await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items: [],
    now,
  });
  assert.equal(result.length, 0);
  assert.equal(harness.tickets.size, 0);
});

test('updateTicket transitions a ticket forward per TICKET_TRANSITIONS', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items: [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })],
    now,
  });

  const updated = await harness.service.updateTicket({
    actor: harness.staffActor,
    ticketId: 'order-1:kitchen',
    status: 'preparing',
    now,
  });
  assert.equal(updated.status, 'preparing');
  assert.equal(updated.assignedStaffId, 'staff-1');
});

test('updateTicket allows "new" to skip directly to "ready"', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items: [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })],
    now,
  });

  const updated = await harness.service.updateTicket({
    actor: harness.staffActor,
    ticketId: 'order-1:kitchen',
    status: 'ready',
    now,
  });
  assert.equal(updated.status, 'ready');
});

test('updateTicket rejects an invalid transition', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items: [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })],
    now,
  });

  await assert.rejects(
    () =>
      harness.service.updateTicket({
        actor: harness.staffActor,
        ticketId: 'order-1:kitchen',
        status: 'collected',
        now,
      }),
    (error: unknown) =>
      error instanceof KitchenError &&
      error.code === 'INVALID_TRANSITION' &&
      error.status === 409,
  );
});

test('updateTicket rejects a customer actor', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items: [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })],
    now,
  });

  await assert.rejects(
    () =>
      harness.service.updateTicket({
        actor: harness.customerActor,
        ticketId: 'order-1:kitchen',
        status: 'preparing',
        now,
      }),
    (error: unknown) =>
      error instanceof KitchenError && error.code === 'NOT_AUTHORIZED' && error.status === 403,
  );
});

test('updateTicket rejects an unknown ticket', async () => {
  const harness = makeHarness();
  await assert.rejects(
    () =>
      harness.service.updateTicket({
        actor: harness.staffActor,
        ticketId: 'missing-ticket',
        status: 'preparing',
        now,
      }),
    (error: unknown) =>
      error instanceof KitchenError && error.code === 'TICKET_NOT_FOUND' && error.status === 404,
  );
});

test('updateTicket is a no-op-safe re-save when called with the ticket\'s current status', async () => {
  const harness = makeHarness();
  const order = makeOrder();
  await harness.service.createTicketsForOrder({
    actor: harness.staffActor,
    order,
    items: [makeItem({ id: 'item-1', preparationStationId: 'kitchen' })],
    now,
  });

  const updated = await harness.service.updateTicket({
    actor: harness.staffActor,
    ticketId: 'order-1:kitchen',
    status: 'new',
    now,
  });
  assert.equal(updated.status, 'new');
});
