// Scaffold placeholder. Checkpoint 5 drives this screen from
// GET /v1/customer/table-sessions/{sessionId} (approvalStatus ===
// 'pending-approval'), with the required copy: "Please wait. Your waiter
// has been notified." It also gains a Call Waiter button once Checkpoint 12
// wires up POST /v1/customer/table-sessions/{sessionId}/call-waiter, which
// is intentionally allowed pre-approval (see Checkpoint 3).
export default function PendingApprovalPage() {
  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">Pending approval — coming in Checkpoint 5.</p>
    </main>
  );
}
