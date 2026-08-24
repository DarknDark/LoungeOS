import type { KitchenTicket } from "@workspace/api-client-react";

export const BOARD_COLUMNS = ["new", "preparing", "ready"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

/**
 * Groups tickets into the three display columns. 'collected' tickets are
 * intentionally dropped from the board — Checkpoint 2's scope is strictly
 * a 3-column (new/preparing/ready) display, per the approved plan.
 */
export function groupTicketsByColumn(
  tickets: KitchenTicket[],
): Record<BoardColumn, KitchenTicket[]> {
  const grouped: Record<BoardColumn, KitchenTicket[]> = {
    new: [],
    preparing: [],
    ready: [],
  };
  for (const ticket of tickets) {
    if (ticket.status === "new" || ticket.status === "preparing" || ticket.status === "ready") {
      grouped[ticket.status].push(ticket);
    }
  }
  for (const column of BOARD_COLUMNS) {
    grouped[column].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }
  return grouped;
}

export const COLUMN_LABELS: Record<BoardColumn, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
};
