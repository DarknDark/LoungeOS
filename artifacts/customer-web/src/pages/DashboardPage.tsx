import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { readStoredSession } from "../session/storage";
import { useTableSessionStatus } from "../session/useTableSessionStatus";
import { useOrders } from "../session/useOrders";
import { apiErrorCode } from "../api/errors";
import { RunningBillCard } from "../components/RunningBillCard";
import { OrderedItemsList } from "../components/OrderedItemsList";

const TERMINAL_ERROR_CODES = new Set([
  "SESSION_NOT_FOUND",
  "SESSION_EXPIRED",
  "SESSION_CLOSED",
  "CUSTOMER_SESSION_NOT_FOUND",
  "ACCESS_DENIED",
]);

// This page must never render ordering, payment, bill-splitting, or table
// closure controls — those remain staff/mobile-app-only, per
// ARCHITECTURE.md's customer/staff product boundary. It is read-only:
// running bill + ordered items (Checkpoint 6), request song and call
// waiter land in later checkpoints (11-12).
export default function DashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const stored = readStoredSession();
  const sessionMatches = stored !== null && stored.tableSessionId === sessionId;
  const activeSession = sessionMatches ? stored : null;

  // Five-second polling for both the session status (bill total, approval
  // status, closure) and the order list, per HANDOFF.md / PROJECT_STATE.md's
  // documented polling convention. No SSE/realtime infrastructure and no
  // direct Firestore access are used.
  const status = useTableSessionStatus(activeSession, { poll: true });
  const orders = useOrders(activeSession, { poll: true });

  useEffect(() => {
    if (!sessionMatches) {
      setLocation("/invalid-qr", { replace: true });
      return;
    }
    if (status.data?.customerSession.approvalStatus === "pending-approval") {
      setLocation(`/session/${sessionId}/pending`, { replace: true });
      return;
    }
    const terminalCode = apiErrorCode(status.error) ?? apiErrorCode(orders.error);
    if (terminalCode && TERMINAL_ERROR_CODES.has(terminalCode)) {
      setLocation(`/session/${sessionId}/expired`, { replace: true });
    }
  }, [sessionMatches, status.data, status.error, orders.error, sessionId, setLocation]);

  if (!sessionMatches) return null;

  // Still loading the very first fetch of either query.
  if (status.isPending || orders.isPending) {
    return (
      <main className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-neutral-500">Loading your table…</p>
      </main>
    );
  }

  // A pending-approval or terminal-error redirect is in flight (handled by
  // the effect above); render nothing for this frame rather than a flash
  // of dashboard content.
  if (status.data?.customerSession.approvalStatus === "pending-approval") return null;
  const terminalCode = apiErrorCode(status.error) ?? apiErrorCode(orders.error);
  if (terminalCode && TERMINAL_ERROR_CODES.has(terminalCode)) return null;

  const tableSession = status.data?.tableSession;
  const orderList = orders.data?.orders ?? [];
  const hasTransientError = Boolean(status.error || orders.error) && !terminalCode;

  return (
    <main className="mx-auto flex h-full max-w-md flex-col gap-4 p-4">
      {hasTransientError ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Having trouble reaching the table. Retrying…
        </p>
      ) : null}
      {tableSession ? (
        <RunningBillCard orders={orderList} runningTotalMinor={tableSession.runningTotalMinor} />
      ) : null}
      <OrderedItemsList orders={orderList} />
    </main>
  );
}
