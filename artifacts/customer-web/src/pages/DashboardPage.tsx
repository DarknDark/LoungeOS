import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { readStoredSession } from "../session/storage";
import { useTableSessionStatus } from "../session/useTableSessionStatus";
import { apiErrorCode } from "../api/errors";

const TERMINAL_ERROR_CODES = new Set([
  "SESSION_NOT_FOUND",
  "SESSION_EXPIRED",
  "SESSION_CLOSED",
  "CUSTOMER_SESSION_NOT_FOUND",
  "ACCESS_DENIED",
]);

// This page must never render ordering, payment, bill-splitting, or table
// closure controls — those remain staff/mobile-app-only, per
// ARCHITECTURE.md's customer/staff product boundary.
//
// Checkpoint 5 only wires the route guard (matching stored session,
// redirecting a pending customer back, detecting an expired/closed
// session). The actual dashboard content — RunningBillCard,
// OrderedItemsList, RequestSongForm, CallWaiterButton, and 5s polling of
// the dashboard's own data — is built in later checkpoints (6-13).
export default function DashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const stored = readStoredSession();
  const sessionMatches = stored !== null && stored.tableSessionId === sessionId;

  const status = useTableSessionStatus(sessionMatches ? stored : null);

  useEffect(() => {
    if (!sessionMatches) {
      setLocation("/invalid-qr", { replace: true });
      return;
    }
    if (status.data?.customerSession.approvalStatus === "pending-approval") {
      setLocation(`/session/${sessionId}/pending`, { replace: true });
      return;
    }
    if (status.error && TERMINAL_ERROR_CODES.has(apiErrorCode(status.error) ?? "")) {
      setLocation(`/session/${sessionId}/expired`, { replace: true });
    }
  }, [sessionMatches, status.data, status.error, sessionId, setLocation]);

  if (!sessionMatches) return null;

  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">Table dashboard — coming in later checkpoints.</p>
    </main>
  );
}
