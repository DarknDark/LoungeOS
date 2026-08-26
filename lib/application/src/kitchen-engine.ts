import type { KitchenTicket, Order, OrderItem, RepositoryRegistry } from '@workspace/domain';
import { TICKET_TRANSITIONS } from '@workspace/domain';
import type { KitchenService, RequestActor } from './services';

export type KitchenEngineDependencies = {
  repositories: Pick<RepositoryRegistry, 'tickets'>;
};

export class KitchenError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_AUTHORIZED' | 'TICKET_NOT_FOUND' | 'INVALID_TRANSITION',
    readonly status = 409,
  ) {
    super(message);
    this.name = 'KitchenError';
  }
}

/**
 * Groups an order's items by preparation station and returns one
 * deterministic ticket ID per distinct station touched.
 *
 * `${order.id}:${stationId}` is deliberately deterministic (not a random
 * UUID) so that createTicketsForOrder is idempotent: a duplicate or racing
 * call for the same order+station always resolves to the same document
 * rather than creating a second ticket.
 */
function groupItemsByStation(items: OrderItem[]): Map<string, OrderItem[]> {
  const byStation = new Map<string, OrderItem[]>();
  for (const item of items) {
    const stationId = item.preparationStationId;
    const existing = byStation.get(stationId);
    if (existing) {
      existing.push(item);
    } else {
      byStation.set(stationId, [item]);
    }
  }
  return byStation;
}

/**
 * Creates the KitchenService application service.
 *
 * `createTicketsForOrder` is called from order-engine.ts as a side effect
 * of the accepted -> preparing transition (see order-engine.ts's
 * updateStatus). It does not perform its own authorization check — it
 * trusts the caller, exactly like order-engine.ts's own inventory
 * reservation step for the accepted transition.
 *
 * `updateTicket` mirrors DJService.updateStatus's staff/system-only gate.
 * It is fully implemented in Phase 4 Checkpoint 1 even though no API route
 * calls it yet — that route is Checkpoint 3's "Station Actions" scope.
 */
export function createKitchenService(dependencies: KitchenEngineDependencies): KitchenService {
  const { repositories: repos } = dependencies;

  return {
    async createTicketsForOrder(input) {
      const byStation = groupItemsByStation(input.items);
      const tickets: KitchenTicket[] = [];

      for (const [stationId, stationItems] of byStation) {
        const ticketId = `${input.order.id}:${stationId}`;
        const existing = await repos.tickets.getById(input.order.clubId, ticketId);

        // Idempotency guard: never reset a ticket that's already been
        // acted on (status beyond 'new') back to 'new'. A duplicate or
        // racing call for the same order+station is a strict no-op once
        // the ticket has progressed.
        if (existing && existing.status !== 'new') {
          tickets.push(existing);
          continue;
        }

        const ticket: KitchenTicket = {
          id: ticketId,
          clubId: input.order.clubId,
          orderId: input.order.id,
          stationId,
          orderItemIds: stationItems.map((item) => item.id),
          status: 'new',
          createdAt: existing?.createdAt ?? input.now,
          updatedAt: input.now,
        };
        await repos.tickets.save(ticket);
        tickets.push(ticket);
      }

      return tickets;
    },

    async updateTicket(input) {
      if (input.actor.kind !== 'staff' && input.actor.kind !== 'system') {
        throw new KitchenError('Only staff can update a kitchen ticket.', 'NOT_AUTHORIZED', 403);
      }
      const existing = await repos.tickets.getById(input.actor.clubId, input.ticketId);
      if (!existing) {
        throw new KitchenError('The kitchen ticket was not found.', 'TICKET_NOT_FOUND', 404);
      }
      if (existing.status !== input.status) {
        const allowed = TICKET_TRANSITIONS[existing.status];
        if (!allowed.includes(input.status)) {
          throw new KitchenError(
            `A ticket cannot move from "${existing.status}" to "${input.status}".`,
            'INVALID_TRANSITION',
            409,
          );
        }
      }
      const updated: KitchenTicket = {
        ...existing,
        status: input.status,
        ...(input.actor.staffId ? { assignedStaffId: input.actor.staffId } : {}),
        updatedAt: input.now,
      };
      await repos.tickets.save(updated);
      return updated;
    },
  };
}
