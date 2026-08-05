import type {
  AuditLog,
  CustomerSession,
  DomainEvent,
  MenuCategoryRecord,
  MenuItem,
  MenuModifier,
  ModifierOption,
  Notification,
  Order,
  OrderItem,
  OrderModifierSelection,
  OrderStatus,
  RepositoryRegistry,
  ServiceTimelineEvent,
  TableSession,
} from '@workspace/domain';
import {
  LOUNGE_ERROR_CODES,
  ORDER_TRANSITIONS,
} from '@workspace/domain';
import type { EventPublisher } from '@workspace/domain';
import type { RequestActor, OrderService } from './services';
import { calculateOrderPricing } from './pricing';
import { createAuditService } from './audit-engine';
import { createNotificationEngine } from './notification-engine';
import { createTimelineService } from './timeline-engine';

type OrderItemInput = {
  menuItemId: string;
  quantity: number;
  modifiers?: Array<{ modifierId: string; optionIds: string[] }>;
  notes?: string;
};

export type OrderEngineDependencies = {
  repositories: Pick<
    RepositoryRegistry,
    | 'settings'
    | 'tableSessions'
    | 'customerSessions'
    | 'menuCategories'
    | 'menuItems'
    | 'modifiers'
    | 'orders'
    | 'orderItems'
    | 'inventory'
    | 'inventoryReservations'
    | 'notifications'
    | 'audit'
    | 'serviceTimeline'
    | 'realtime'
    | 'offlineQueue'
  >;
  ids: { next(): string };
  tokens: { hash(value: string): string };
  events?: EventPublisher;
};

export class OrderError extends Error {
  constructor(
    message: string,
    readonly code: keyof typeof LOUNGE_ERROR_CODES,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

function isExpired(now: string, value: string): boolean {
  return new Date(now).getTime() >= new Date(value).getTime();
}

function assertWholeNumber(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new OrderError(`${field} must be a whole number.`, 'CONFIGURATION_INVALID', 400);
  }
}

function statusTimestamp(status: Exclude<OrderStatus, 'draft' | 'submitted'>, now: string) {
  return {
    ...(status === 'accepted' ? { acceptedAt: now } : {}),
    ...(status === 'preparing' ? { preparingAt: now } : {}),
    ...(status === 'ready' ? { readyAt: now } : {}),
    ...(status === 'delivered' ? { deliveredAt: now } : {}),
    ...(status === 'cancelled' ? { cancelledAt: now } : {}),
  };
}

function notificationFor(
  order: Order,
  status: OrderStatus,
  now: string,
  ids: { next(): string },
): Notification {
  const customerMessage: Record<OrderStatus, string> = {
    draft: 'Your order draft was updated.',
    submitted: 'Your order was submitted.',
    accepted: 'Your order was accepted.',
    preparing: 'Your order is being prepared.',
    ready: 'Your order is ready.',
    delivered: 'Your order was delivered.',
    cancelled: 'Your order was cancelled.',
  };
  const category =
    status === 'cancelled' || status === 'delivered' ? 'session' : 'kitchen';
  return {
    id: ids.next(),
    clubId: order.clubId,
    recipientId: order.customerSessionId,
    priority: status === 'ready' ? 'high' : 'normal',
    category,
    message: customerMessage[status],
    relatedRecord: { type: 'order', id: order.id },
    createdAt: now,
  };
}

export function createOrderService(
  dependencies: OrderEngineDependencies,
): OrderService {
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
      throw new OrderError('A customer session is required.', 'NOT_AUTHORIZED', 401);
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
      throw new OrderError('The customer session is not authorized.', 'NOT_AUTHORIZED', 401);
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
      throw new OrderError('The customer session is no longer active.', 'SESSION_NOT_ACTIVE', 409);
    }
    return { session, customer };
  }

  async function activeStaffTable(
    actor: RequestActor,
    tableSessionId: string,
    now: string,
  ): Promise<TableSession> {
    if (actor.kind !== 'staff' && actor.kind !== 'system') {
      throw new OrderError('Only waiter staff may order for a table.', 'NOT_AUTHORIZED', 403);
    }
    const session = await repos.tableSessions.getById(actor.clubId, tableSessionId);
    if (
      !session ||
      session.controllerType !== 'staff' ||
      session.status !== 'active' ||
      isExpired(now, session.expiresAt)
    ) {
      throw new OrderError(
        'The waiter-controlled table session is not active.',
        'SESSION_NOT_ACTIVE',
        409,
      );
    }
    return session;
  }

  async function orderForActor(
    actor: RequestActor,
    orderId: string,
  ): Promise<{ order: Order; items: OrderItem[] }> {
    const order = await repos.orders.getById(actor.clubId, orderId);
    if (!order) throw new OrderError('The order was not found.', 'ORDER_NOT_FOUND', 404);
    const items = await repos.orderItems.listForOrder(actor.clubId, order.id);
    return { order, items };
  }

  function assertOrderOwner(actor: RequestActor, order: Order): void {
    if (actor.kind === 'customer' && order.customerSessionId !== actor.customerSessionId) {
      throw new OrderError(
        'Only the customer who created the order may edit or cancel it.',
        'NOT_AUTHORIZED',
        403,
      );
    }
  }

  async function adjustRunningTotal(
    clubId: string,
    tableSessionId: string,
    deltaMinor: number,
    now: string,
  ): Promise<void> {
    if (deltaMinor === 0) return;
    const session = await repos.tableSessions.getById(clubId, tableSessionId);
    if (!session) {
      throw new OrderError('The table session was not found.', 'SESSION_NOT_ACTIVE', 409);
    }
    const updatedSession = {
      ...session,
      runningTotalMinor: Math.max(0, session.runningTotalMinor + deltaMinor),
      version: (session.version ?? 0) + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    if (repos.tableSessions.saveIfVersion) {
      await repos.tableSessions.saveIfVersion(updatedSession, session.version ?? 0);
    } else {
      await repos.tableSessions.save(updatedSession);
    }
  }

  async function validateItems(
    clubId: string,
    inputItems: OrderItemInput[],
    now: string,
  ): Promise<{
    pricedItems: OrderItem[];
    subtotalMinor: number;
    taxMinor: number;
    serviceChargeMinor: number;
    discountMinor: number;
    totalMinor: number;
  }> {
    if (!inputItems.length) throw new OrderError('At least one item is required.', 'ORDER_NOT_FOUND', 400);
    const settings = await repos.settings.get(clubId);
    const resolved: Array<{
      menuItem: MenuItem;
      quantity: number;
      modifiers: OrderModifierSelection[];
      notes?: string;
    }> = [];
    for (const itemInput of inputItems) {
      assertWholeNumber(itemInput.quantity, 'quantity');
      if (itemInput.quantity < 1 || itemInput.quantity > 99) {
        throw new OrderError('Quantity must be between 1 and 99.', 'CONFIGURATION_INVALID', 400);
      }
      const menuItem = await repos.menuItems.getById(clubId, itemInput.menuItemId);
      if (!menuItem || !menuItem.available) {
        throw new OrderError('The menu item is unavailable.', 'ITEM_OUT_OF_STOCK', 409);
      }
      if (menuItem.inventoryItemId) {
        const inventory = await repos.inventory.getItem(clubId, menuItem.inventoryItemId);
        const availableQuantity =
          inventory?.quantityOnHand === undefined
            ? Number.POSITIVE_INFINITY
            : inventory.quantityOnHand - (inventory.reservedQuantity ?? 0);
        if (inventory && availableQuantity < itemInput.quantity) {
          throw new OrderError('The menu item is out of stock.', 'ITEM_OUT_OF_STOCK', 409);
        }
      }
      const selections: OrderModifierSelection[] = [];
      const modifiers = await repos.modifiers.listForMenuItem(clubId, menuItem.id);
      const modifierInputs = itemInput.modifiers ?? [];
      for (const modifier of modifiers) {
        const selected = modifierInputs.find((candidate) => candidate.modifierId === modifier.id);
        const optionIds = selected?.optionIds ?? [];
        if (
          (modifier.required && optionIds.length < modifier.minSelections) ||
          optionIds.length < modifier.minSelections ||
          optionIds.length > modifier.maxSelections
        ) {
          throw new OrderError(`Modifier "${modifier.name}" has invalid selections.`, 'CONFIGURATION_INVALID', 400);
        }
        const options: ModifierOption[] = [];
        for (const optionId of optionIds) {
          const option = await repos.modifiers.getOption(clubId, optionId);
          if (!option || option.modifierId !== modifier.id || !option.available) {
            throw new OrderError('A selected modifier option is unavailable.', 'CONFIGURATION_INVALID', 400);
          }
          options.push(option);
        }
        selections.push({
          modifierId: modifier.id,
          optionIds,
          priceDeltaMinor: options.reduce((sum, option) => sum + option.priceDeltaMinor, 0),
        });
      }
      if (modifierInputs.some((candidate) => !modifiers.some((modifier) => modifier.id === candidate.modifierId))) {
        throw new OrderError('A modifier is not valid for this menu item.', 'CONFIGURATION_INVALID', 400);
      }
      resolved.push({
        menuItem,
        quantity: itemInput.quantity,
        modifiers: selections,
        ...(itemInput.notes ? { notes: itemInput.notes } : {}),
      });
    }
    const pricing = calculateOrderPricing({
      clubId,
      items: resolved,
      taxPercentage: settings.business.taxPercentage,
      serviceChargePercentage: settings.business.serviceChargePercentage,
    });
    return {
      ...pricing,
      pricedItems: pricing.items.map((item) => ({
        ...item,
        id: ids.next(),
        orderId: '',
      })),
    };
  }

  async function persist(
    order: Order,
    items: OrderItem[],
    expectedVersion?: number,
  ): Promise<void> {
    const preparedItems = items.map((item) => ({ ...item, orderId: order.id }));
    if (expectedVersion !== undefined && repos.orders.saveIfVersion) {
      await repos.orders.saveIfVersion(order, preparedItems, expectedVersion);
    } else {
      await repos.orders.save(order, preparedItems);
    }
  }

  async function recordTransition(
    actor: RequestActor,
    order: Order,
    status: OrderStatus,
    now: string,
  ): Promise<void> {
    const action = `order-${status}`;
    const log: AuditLog = {
      id: ids.next(),
      clubId: order.clubId,
      ...(actor.id || actor.customerSessionId || actor.staffId
        ? { actorId: actor.id ?? actor.customerSessionId ?? actor.staffId }
        : {}),
      actorType: actor.kind,
      action,
      resourceType: 'order',
      resourceId: order.id,
      timestamp: now,
      metadata: { status, tableSessionId: order.tableSessionId },
      createdAt: now,
    };
    await audit.record(log);
    const timelineEvent: ServiceTimelineEvent = {
      id: ids.next(),
      clubId: order.clubId,
      tableSessionId: order.tableSessionId,
      type: action,
      message: notificationFor(order, status, now, ids).message,
      sourceRecord: { type: 'order', id: order.id },
      occurredAt: now,
    };
    await timeline.append(timelineEvent);
    await notifications.createNotification(notificationFor(order, status, now, ids));
    if (dependencies.events) {
      const event: DomainEvent = {
        id: ids.next(),
        clubId: order.clubId,
        occurredAt: now,
        actorId: actor.id ?? actor.customerSessionId ?? actor.staffId,
        sourceRecord: { type: 'order', id: order.id },
        type: `Order${status[0].toUpperCase()}${status.slice(1)}`,
        data: { orderId: order.id, status, tableSessionId: order.tableSessionId },
      };
      await dependencies.events.publish(event);
    }
  }

  const service: OrderService = {
    async getMenu(input) {
      const [categories, items] = await Promise.all([
        repos.menuCategories.listActive(input.clubId),
        repos.menuItems.listAvailable(input.clubId),
      ]);
      const modifierIds = [...new Set(items.flatMap((item) => item.modifierIds ?? []))];
      const modifierRows = await Promise.all(
        modifierIds.map(async (id) => {
          const modifier = await repos.modifiers.getById(input.clubId, id);
          if (!modifier) return null;
          const options = await Promise.all(
            modifier.optionIds.map((optionId) => repos.modifiers.getOption(input.clubId, optionId)),
          );
          return {
            ...modifier,
            options: options.filter((option): option is ModifierOption => Boolean(option)),
          };
        }),
      );
      return {
        categories,
        items,
        modifiers: modifierRows.filter(
          (modifier): modifier is MenuModifier & { options: ModifierOption[] } => Boolean(modifier),
        ),
      };
    },

    async createDraft(input) {
      const { session, customer } = await activeCustomer(
        input.actor,
        input.tableSessionId,
        input.now,
      );
      const existing = await repos.orders.findByIdempotencyKey(
        input.actor.clubId,
        session.id,
        customer.id,
        input.idempotencyKey,
      );
      if (existing) return orderForActor(input.actor, existing.id);
      const pricing = await validateItems(input.actor.clubId, input.items, input.now);
      const order: Order = {
        id: ids.next(),
        clubId: input.actor.clubId,
        tableSessionId: session.id,
        customerSessionId: customer.id,
        businessDayId: session.businessDayId,
        status: 'draft',
        itemIds: pricing.pricedItems.map((item) => item.id),
        idempotencyKey: input.idempotencyKey,
        subtotalMinor: pricing.subtotalMinor,
        taxMinor: pricing.taxMinor,
        serviceChargeMinor: pricing.serviceChargeMinor,
        discountMinor: pricing.discountMinor,
        totalMinor: pricing.totalMinor,
        ...(input.notes ? { notes: input.notes } : {}),
        createdAt: input.now,
        version: 0,
        updatedAt: input.now,
      };
      await persist(order, pricing.pricedItems);
      const updatedSession = {
        ...session,
        runningTotalMinor: session.runningTotalMinor + order.totalMinor,
        version: (session.version ?? 0) + 1,
        updatedAt: input.now,
        lastActivityAt: input.now,
      };
      if (repos.tableSessions.saveIfVersion) {
        await repos.tableSessions.saveIfVersion(
          updatedSession,
          session.version ?? 0,
        );
      } else {
        await repos.tableSessions.save(updatedSession);
      }
      await recordTransition(input.actor, order, 'draft', input.now);
      return { order, items: pricing.pricedItems.map((item) => ({ ...item, orderId: order.id })) };
    },

    async submit(input) {
      const current = await orderForActor(input.actor, input.orderId);
      assertOrderOwner(input.actor, current.order);
      if (input.actor.kind === 'customer') {
        await activeCustomer(input.actor, current.order.tableSessionId, input.now);
      }
      if (current.order.status !== 'draft') {
        throw new OrderError('Only draft orders can be submitted.', 'CONFLICT', 409);
      }
      const updated: Order = {
        ...current.order,
        status: 'submitted',
        submittedAt: input.now,
        version: (current.order.version ?? 0) + 1,
        updatedAt: input.now,
      };
      await persist(updated, current.items, input.expectedVersion);
      await recordTransition(input.actor, updated, 'submitted', input.now);
      return { order: updated, items: current.items };
    },

    async create(input) {
      const { session, customer } = await activeCustomer(
        input.actor,
        input.tableSessionId,
        input.now,
      );
      const existing = await repos.orders.findByIdempotencyKey(
        input.actor.clubId,
        session.id,
        customer.id,
        input.idempotencyKey,
      );
      if (existing) return orderForActor(input.actor, existing.id);
      const draft = await service.createDraft(input);
      return service.submit({
        actor: input.actor,
        orderId: draft.order.id,
        expectedVersion: draft.order.version ?? 0,
        now: input.now,
      });
    },

    async createForStaff(input) {
      const session = await activeStaffTable(
        input.actor,
        input.tableSessionId,
        input.now,
      );
      const staffId = input.actor.staffId ?? input.actor.id;
      if (!staffId) {
        throw new OrderError('A staff identity is required.', 'NOT_AUTHORIZED', 401);
      }
      const existing = await repos.orders.findByIdempotencyKey(
        input.actor.clubId,
        session.id,
        staffId,
        input.idempotencyKey,
      );
      if (existing) return orderForActor(input.actor, existing.id);
      const pricing = await validateItems(input.actor.clubId, input.items, input.now);
      const order: Order = {
        id: ids.next(),
        clubId: input.actor.clubId,
        tableSessionId: session.id,
        customerSessionId: staffId,
        createdByStaffId: staffId,
        businessDayId: session.businessDayId,
        status: 'submitted',
        itemIds: pricing.pricedItems.map((item) => item.id),
        idempotencyKey: input.idempotencyKey,
        subtotalMinor: pricing.subtotalMinor,
        taxMinor: pricing.taxMinor,
        serviceChargeMinor: pricing.serviceChargeMinor,
        discountMinor: pricing.discountMinor,
        totalMinor: pricing.totalMinor,
        ...(input.notes ? { notes: input.notes } : {}),
        submittedAt: input.now,
        createdAt: input.now,
        version: 0,
        updatedAt: input.now,
      };
      await persist(order, pricing.pricedItems);
      await repos.tableSessions.save({
        ...session,
        runningTotalMinor: session.runningTotalMinor + order.totalMinor,
        version: (session.version ?? 0) + 1,
        updatedAt: input.now,
        lastActivityAt: input.now,
      });
      await recordTransition(input.actor, order, 'submitted', input.now);
      return {
        order,
        items: pricing.pricedItems.map((item) => ({ ...item, orderId: order.id })),
      };
    },

    async updateDraft(input) {
      const current = await orderForActor(input.actor, input.orderId);
      assertOrderOwner(input.actor, current.order);
      if (input.actor.kind === 'customer') {
        await activeCustomer(input.actor, current.order.tableSessionId, input.now);
      }
      if (current.order.status !== 'draft') {
        throw new OrderError('Only draft orders can be edited.', 'CONFLICT', 409);
      }
      const pricing = await validateItems(input.actor.clubId, input.items, input.now);
      const updated: Order = {
        ...current.order,
        itemIds: pricing.pricedItems.map((item) => item.id),
        subtotalMinor: pricing.subtotalMinor,
        taxMinor: pricing.taxMinor,
        serviceChargeMinor: pricing.serviceChargeMinor,
        discountMinor: pricing.discountMinor,
        totalMinor: pricing.totalMinor,
        ...(input.notes ? { notes: input.notes } : { notes: undefined }),
        version: input.expectedVersion + 1,
        updatedAt: input.now,
      };
      await persist(updated, pricing.pricedItems, input.expectedVersion);
      await adjustRunningTotal(
        input.actor.clubId,
        updated.tableSessionId,
        updated.totalMinor - current.order.totalMinor,
        input.now,
      );
      await recordTransition(input.actor, updated, 'draft', input.now);
      return {
        order: updated,
        items: pricing.pricedItems.map((item) => ({ ...item, orderId: updated.id })),
      };
    },

    async cancel(input) {
      const current = await orderForActor(input.actor, input.orderId);
      assertOrderOwner(input.actor, current.order);
      if (input.actor.kind === 'customer') {
        await activeCustomer(input.actor, current.order.tableSessionId, input.now);
      }
      const canCancel =
        input.actor.kind === 'staff' || input.actor.kind === 'system'
          ? ['draft', 'submitted', 'accepted'].includes(current.order.status)
          : ['draft', 'submitted'].includes(current.order.status);
      if (!canCancel) {
        throw new OrderError('The order can no longer be cancelled.', 'CONFLICT', 409);
      }
      const updated: Order = {
        ...current.order,
        status: 'cancelled',
        cancelledAt: input.now,
        cancelledBy: input.actor.id ?? input.actor.customerSessionId,
        ...(input.reason ? { cancellationReason: input.reason } : {}),
        version: (current.order.version ?? 0) + 1,
        updatedAt: input.now,
      };
      await persist(updated, current.items, current.order.version ?? 0);
      await repos.inventoryReservations.releaseForOrder(
        input.actor.clubId,
        updated.id,
        input.now,
      );
      await adjustRunningTotal(
        input.actor.clubId,
        updated.tableSessionId,
        -current.order.totalMinor,
        input.now,
      );
      await recordTransition(input.actor, updated, 'cancelled', input.now);
      return { order: updated, items: current.items };
    },

    async updateStatus(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new OrderError('Only staff may update order status.', 'NOT_AUTHORIZED', 403);
      }
      const current = await orderForActor(input.actor, input.orderId);
      if (current.order.status === 'cancelled') {
        throw new OrderError('Cancelled orders cannot change status.', 'CONFLICT', 409);
      }
      if (!ORDER_TRANSITIONS[current.order.status].includes(input.status)) {
        throw new OrderError(
          `Order cannot move from ${current.order.status} to ${input.status}.`,
          'CONFLICT',
          409,
        );
      }
      if (input.status === 'accepted') {
        for (const item of current.items) {
          if (item.inventoryItemId) {
            await repos.inventoryReservations.reserve({
              clubId: input.actor.clubId,
              orderId: current.order.id,
              inventoryItemId: item.inventoryItemId,
              quantity: item.quantity,
              now: input.now,
            });
          }
        }
      }
      const updated: Order = {
        ...current.order,
        status: input.status,
        ...statusTimestamp(input.status, input.now),
        ...(input.status === 'cancelled' && input.reason
          ? { cancellationReason: input.reason }
          : {}),
        version: input.expectedVersion + 1,
        updatedAt: input.now,
      };
      await persist(updated, current.items, input.expectedVersion);
      if (input.status === 'cancelled') {
        await repos.inventoryReservations.releaseForOrder(
          input.actor.clubId,
          updated.id,
          input.now,
        );
        await adjustRunningTotal(
          input.actor.clubId,
          updated.tableSessionId,
          -current.order.totalMinor,
          input.now,
        );
      }
      await recordTransition(input.actor, updated, input.status, input.now);
      return { order: updated, items: current.items };
    },

    async get(input) {
      if (input.actor.kind === 'customer') {
        const found = await repos.orders.getById(input.actor.clubId, input.orderId);
        if (!found) throw new OrderError('The order was not found.', 'ORDER_NOT_FOUND', 404);
        await activeCustomer(input.actor, found.tableSessionId, new Date().toISOString());
      }
      return orderForActor(input.actor, input.orderId);
    },

    async getForSession(input) {
      await activeCustomer(
        input.actor,
        input.tableSessionId,
        new Date().toISOString(),
      );
      const page = await repos.orders.listForSession(
        input.actor.clubId,
        input.tableSessionId,
      );
      return Promise.all(
        page.items.map(async (order) => ({
          order,
          items: await repos.orderItems.listForOrder(input.actor.clubId, order.id),
        })),
      );
    },

    subscribeToOrders(input) {
      if (!repos.realtime) {
        throw new OrderError(
          'Realtime order subscriptions are not configured.',
          'CONFIGURATION_INVALID',
          503,
        );
      }
      return repos.realtime.subscribeToOrders(input.clubId, input.listener);
    },

    async queueMutation(input) {
      if (!repos.offlineQueue) {
        throw new OrderError(
          'Offline order synchronization is not configured.',
          'CONFIGURATION_INVALID',
          503,
        );
      }
      await repos.offlineQueue.enqueue({
        id: ids.next(),
        clubId: input.clubId,
        operation: input.operation,
        resourceType: 'order',
        resourceId: input.resourceId,
        payload: input.payload,
        ...(input.expectedVersion !== undefined
          ? { expectedVersion: input.expectedVersion }
          : {}),
        attempts: 0,
        nextAttemptAt: input.now,
      });
    },
  };
  return service;
}