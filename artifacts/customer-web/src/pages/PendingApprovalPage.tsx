import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { readStoredSession } from "../session/storage";
import { useTableSessionStatus } from "../session/useTableSessionStatus";
import { apiErrorCode } from "../api/errors";

// Session-state error codes that mean this session can no longer be used
// and the customer should be sent back to scan the table's QR code again.
const TERMINAL_ERROR_CODES = new Set([
  "SESSION_NOT_FOUND",
  "SESSION_EXPIRED",
  "SESSION_CLOSED",
  "CUSTOMER_SESSION_NOT_FOUND",
  "ACCESS_DENIED",
]);

export default function PendingApprovalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const stored = readStoredSession();
  const sessionMatches = stored !== null && stored.tableSessionId === sessionId;

  const status = useTableSessionStatus(sessionMatches ? stored : null, { poll: true });
  const terminalCode = apiErrorCode(status.error);
  const isTerminal = Boolean(terminalCode && TERMINAL_ERROR_CODES.has(terminalCode));
  // A transient error (network drop, timeout, 500) during polling should
  // not be treated the same as a terminal session error — the poll simply
  // retries every five seconds, and the customer sees a quiet inline
  // notice rather than being bounced off this page.
  const hasTransientError = Boolean(status.error) && !isTerminal;

  useEffect(() => {
    if (!sessionMatches) {
      setLocation("/invalid-qr", { replace: true });
      return;
    }
    if (status.data?.customerSession.approvalStatus === "approved") {
      setLocation(`/session/${sessionId}`, { replace: true });
      return;
    }
    if (isTerminal) {
      setLocation(`/session/${sessionId}/expired`, { replace: true });
    }
  }, [sessionMatches, status.data, isTerminal, sessionId, setLocation]);

  if (!sessionMatches) return null;

  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-base font-medium" aria-live="polite">
        Please wait. Your waiter has been notified.
      </p>
      <p className="text-sm text-neutral-500">We'll bring you to your table as soon as they confirm.</p>
      {hasTransientError ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700" aria-live="polite">
          Having trouble reaching the table. Retrying…
        </p>
      ) : null}
    </main>
  );
}
