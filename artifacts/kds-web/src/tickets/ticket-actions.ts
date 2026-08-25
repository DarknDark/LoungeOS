import type { KitchenTicket, KitchenTicketListResponse } from "@workspace/api-client-react";

export type TicketAction = {
  label: string;
  targetStatus: KitchenTicket["status"];
};

// Directly mirrors TICKET_TRANSITIONS (lib/domain/src/lifecycles.ts),
// which is not touched by this checkpoint. If that state machine changes,
// this mapping must be updated to match — there is deliberately no shared
// import here since kds-web does not depend on @workspace/domain.
const ACTIONS_BY_STATUS: Record<KitchenTicket["status"], TicketAction[]> = {
  new: [
    { label: "Start preparing", targetStatus: "preparing" },
    { label: "Mark ready", targetStatus: "ready" },
  ],
  preparing: [{ label: "Mark ready", targetStatus: "ready" }],
  ready: [{ label: "Mark collected", targetStatus: "collected" }],
  collected: [],
};

/** Which action buttons should be shown for a ticket in the given status. */
export function nextActionsFor(status: KitchenTicket["status"]): TicketAction[] {
  return ACTIONS_BY_STATUS[status];
}

/**
 * Returns a new KitchenTicketListResponse with the given ticket's status
 * replaced, for optimistic cache updates. Returns the input unchanged
 * (including `undefined`) if the ticket isn't found or no data exists yet.
 */
export function replaceTicketStatus(
  data: KitchenTicketListResponse | undefined,
  ticketId: string,
  status: KitchenTicket["status"],
): KitchenTicketListResponse | undefined {
  if (!data) return data;
  const index = data.kitchenTickets.findIndex((ticket) => ticket.id === ticketId);
  if (index === -1) return data;
  const updated = [...data.kitchenTickets];
  updated[index] = { ...updated[index], status };
  return { kitchenTickets: updated };
}
