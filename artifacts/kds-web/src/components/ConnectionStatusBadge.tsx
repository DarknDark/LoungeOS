import type { ConnectionStatus } from "../tickets/useStaffRealtime";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Live",
  reconnecting: "Reconnecting…",
};

const DOT_COLORS: Record<ConnectionStatus, string> = {
  connecting: "bg-amber-400",
  connected: "bg-green-400",
  reconnecting: "bg-amber-400",
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-400" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[status]}`} />
      {LABELS[status]}
    </span>
  );
}
