import { useEffect } from "react";
import { useParams } from "wouter";
import { clearStoredSession, readStoredSession } from "../session/storage";

// Clears the stored session on mount so a subsequent scan of the table's
// QR code (via QrEntryPage) creates a fresh session instead of resuming
// this now-dead one, which would otherwise redirect straight back here.
//
// Only clears storage if it still points at *this* expired session. If a
// customer has multiple tabs open and already started a newer session
// elsewhere (same localStorage, shared across tabs in the same browser),
// this avoids wiping out that valid, unrelated session.
export default function SessionExpiredPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  useEffect(() => {
    const stored = readStoredSession();
    if (stored && stored.tableSessionId === sessionId) {
      clearStoredSession();
    }
  }, [sessionId]);

  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">
        This table session has ended. Please scan the table's QR code again.
      </p>
    </main>
  );
}
