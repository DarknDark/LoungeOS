import { useEffect, useState } from "react";
import type { KitchenTicket } from "@workspace/api-client-react";

type TicketCardProps = {
  ticket: KitchenTicket;
};

// KitchenTicket only carries orderItemIds (string references), not
// resolved item names/quantities — there is no staff-facing endpoint that
// returns OrderItem detail by ID today (GET /v1/orders/:orderId is
// customer-session-scoped only). Rather than fabricate item names, this
// card shows what the ticket actually contains: order reference, item
// count, and elapsed time. Resolving full item detail is left for a later
// checkpoint.
export function TicketCard({ ticket }: TicketCardProps) {
  const elapsed = useElapsedSeconds(ticket.createdAt);

  return (
    <article className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs text-neutral-500">
          #{ticket.orderId.slice(0, 8)}
        </span>
        <span className="text-xs text-neutral-500">{formatElapsed(elapsed)}</span>
      </div>
      <p className="mt-2 text-sm text-white">
        {ticket.orderItemIds.length} item{ticket.orderItemIds.length === 1 ? "" : "s"}
      </p>
    </article>
  );
}

function useElapsedSeconds(createdAt: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
}

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
