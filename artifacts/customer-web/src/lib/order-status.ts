import type { OrderStatus } from "@workspace/api-client-react";

// Customer-facing labels for each order status. Kept separate from the raw
// OrderStatus values so the wording shown to customers can evolve without
// touching the API contract.
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  submitted: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Served",
  cancelled: "Cancelled",
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}
