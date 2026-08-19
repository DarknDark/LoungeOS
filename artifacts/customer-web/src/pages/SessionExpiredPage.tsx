// Scaffold placeholder. Checkpoint 5 routes here when a stored session
// resume (getStatus) reports SESSION_EXPIRED/SESSION_CLOSED, prompting the
// customer to scan the table's QR code again.
export default function SessionExpiredPage() {
  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">
        This table session has ended. Please scan the table's QR code again.
      </p>
    </main>
  );
}
