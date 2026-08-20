import { useEffect } from "react";
import { clearStoredSession } from "../session/storage";

// Clears the stored session on mount so a subsequent scan of the table's
// QR code (via QrEntryPage) creates a fresh session instead of resuming
// this now-dead one, which would otherwise redirect straight back here.
export default function SessionExpiredPage() {
  useEffect(() => {
    clearStoredSession();
  }, []);

  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">
        This table session has ended. Please scan the table's QR code again.
      </p>
    </main>
  );
}
