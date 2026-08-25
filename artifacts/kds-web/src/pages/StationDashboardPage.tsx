import { useParams, useLocation } from "wouter";
import { findStation } from "../stations/stations";
import { useAuth } from "../auth/AuthContext";
import { useKitchenTickets } from "../tickets/useKitchenTickets";
import { useStaffRealtimeInvalidation } from "../tickets/useStaffRealtime";
import { BOARD_COLUMNS, COLUMN_LABELS, groupTicketsByColumn } from "../tickets/board-columns";
import { TicketCard } from "../components/TicketCard";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";

// Default club for this single-tenant deployment, matching the same
// convention already established in customer-web
// (DEFAULT_CLUB_SETTINGS.clubId = 'mamus-lounge').
const CLUB_ID = "mamus-lounge";

export default function StationDashboardPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const [, setLocation] = useLocation();
  const { signOut } = useAuth();
  const station = stationId ? findStation(stationId) : undefined;

  const tickets = useKitchenTickets(CLUB_ID, stationId ?? "");
  const connectionStatus = useStaffRealtimeInvalidation(CLUB_ID, stationId ?? "");

  if (!stationId || !station) {
    return (
      <main className="flex h-full items-center justify-center bg-neutral-950 p-6">
        <p className="text-sm text-neutral-500">Unknown station.</p>
      </main>
    );
  }

  const columns = groupTicketsByColumn(tickets.data?.kitchenTickets ?? []);

  return (
    <main className="flex h-full flex-col bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/station")}
            className="text-xs text-neutral-500 underline"
          >
            Change station
          </button>
          <h1 className="text-base font-semibold text-white">{station.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionStatusBadge status={connectionStatus} />
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-xs text-neutral-500 underline"
          >
            Sign out
          </button>
        </div>
      </header>

      {tickets.isPending ? (
        <p className="p-4 text-sm text-neutral-500" aria-live="polite">
          Loading tickets…
        </p>
      ) : tickets.isError ? (
        <p className="p-4 text-sm text-amber-500" aria-live="polite">
          Having trouble reaching the server. Retrying…
        </p>
      ) : (
        <div className="grid flex-1 grid-cols-3 gap-3 overflow-hidden p-3">
          {BOARD_COLUMNS.map((column) => (
            <section key={column} className="flex flex-col gap-2 overflow-y-auto">
              <h2 className="sticky top-0 bg-neutral-950 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {COLUMN_LABELS[column]} ({columns[column].length})
              </h2>
              {columns[column].map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} clubId={CLUB_ID} stationId={stationId} />
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
