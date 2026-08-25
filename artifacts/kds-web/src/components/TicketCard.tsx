import { useEffect, useState } from "react";
import type { KitchenTicket } from "@workspace/api-client-react";
import { useUpdateTicketStatus } from "../tickets/useUpdateTicketStatus";
import { nextActionsFor } from "../tickets/ticket-actions";

type TicketCardProps = {
  ticket: KitchenTicket;
  clubId: string;
  stationId: string;
};

// KitchenTicket only carries orderItemIds (string references), not
// resolved item names/quantities — there is no staff-facing endpoint that
// returns OrderItem detail by ID today (GET /v1/orders/:orderId is
// customer-session-scoped only). Rather than fabricate item names, this
// card shows what the ticket actually contains: order reference, item
// count, and elapsed time. Resolving full item detail is deferred (see
// Checkpoint 2/3 notes).
//
// Each card owns its own useUpdateTicketStatus mutation instance, so
// per-card pending/error state stays isolated — staff can act on multiple
// tickets at once without one card's in-flight request affecting another.
export function TicketCard({ ticket, clubId, stationId }: TicketCardProps) {
  const elapsed = useElapsedSeconds(ticket.createdAt);
  const updateStatus = useUpdateTicketStatus(clubId, stationId);
  const actions = nextActionsFor(ticket.status);

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
      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.targetStatus}
              type="button"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({ ticketId: ticket.id, status: action.targetStatus })
              }
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateStatus.isPending ? "Updating…" : action.label}
            </button>
          ))}
        </div>
      ) : null}
      {updateStatus.isError ? (
        <p className="mt-2 text-xs text-red-400" aria-live="polite">
          Couldn't update this ticket. Please try again.
        </p>
      ) : null}
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
