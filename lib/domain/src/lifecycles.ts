import type {
  OrderStatus,
  SongRequestStatus,
  TableSessionStatus,
  TicketStatus,
} from './entities';

export const TABLE_SESSION_TRANSITIONS: Record<
  TableSessionStatus,
  readonly TableSessionStatus[]
> = {
  created: ['active', 'expired', 'closed'],
  active: ['awaiting-payment', 'expired', 'closed'],
  'splitting-bill': ['awaiting-payment', 'active', 'expired', 'closed'],
  'awaiting-payment': ['splitting-bill', 'active', 'completed', 'expired', 'closed'],
  'payment-pending': ['awaiting-payment', 'completed', 'expired', 'closed'],
  completed: ['closed'],
  closed: [],
  expired: [],
};

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const SONG_REQUEST_TRANSITIONS: Record<
  SongRequestStatus,
  readonly SongRequestStatus[]
> = {
  queued: ['playing', 'skipped'],
  playing: ['played', 'skipped'],
  played: [],
  skipped: ['queued'],
};

export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ['preparing', 'ready'],
  preparing: ['ready'],
  ready: ['collected'],
  collected: [],
};

export function assertTableSessionTransition(
  from: TableSessionStatus,
  to: TableSessionStatus,
): void {
  if (!TABLE_SESSION_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid table session transition: ${from} -> ${to}`);
  }
}