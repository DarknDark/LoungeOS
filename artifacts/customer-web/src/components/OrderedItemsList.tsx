import type { OrderResponse } from "@workspace/api-client-react";
import { formatMinorAmount } from "../lib/money";
import { orderStatusLabel } from "../lib/order-status";

type OrderedItemsListProps = {
  orders: OrderResponse[];
};

export function OrderedItemsList({ orders }: OrderedItemsListProps) {
  if (orders.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Ordered items</h2>
        <p className="mt-2 text-sm text-neutral-500">Nothing ordered yet.</p>
      </section>
    );
  }

  // Most recent order first.
  const sorted = [...orders].sort(
    (a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime(),
  );

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-semibold text-neutral-700">Ordered items</h2>
      <ul className="mt-3 space-y-4">
        {sorted.map(({ order, items }) => (
          <li key={order.id}>
            <div className="flex items-center justify-between">
              <StatusBadge status={order.status} />
              <span className="text-xs text-neutral-400">
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between text-sm">
                  <span className="text-neutral-700">
                    {item.quantity}× {item.nameSnapshot}
                    <span className="ml-1 text-neutral-400">
                      ({formatMinorAmount(item.unitPriceMinor)} each)
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-neutral-600">
                    {formatMinorAmount(item.lineSubtotalMinor)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  submitted: "bg-amber-100 text-amber-700",
  accepted: "bg-amber-100 text-amber-700",
  preparing: "bg-blue-100 text-blue-700",
  ready: "bg-green-100 text-green-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-400 line-through",
};

function StatusBadge({ status }: { status: OrderResponse["order"]["status"] }) {
  const style = STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {orderStatusLabel(status)}
    </span>
  );
}
