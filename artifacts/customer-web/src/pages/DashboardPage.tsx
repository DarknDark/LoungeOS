// Scaffold placeholder. Later checkpoints assemble this page from:
//   - RunningBillCard / OrderedItemsList (Checkpoints 6, 9, 10) — reads
//     GET /v1/customer/table-sessions/{sessionId} and GET /v1/orders
//   - RequestSongForm (Checkpoint 11) — POST/GET
//     /v1/customer/table-sessions/{sessionId}/song-requests
//   - CallWaiterButton (Checkpoint 12) — POST
//     /v1/customer/table-sessions/{sessionId}/call-waiter
//   - 5s polling (Checkpoint 13)
//
// This page must never render ordering, payment, bill-splitting, or table
// closure controls — those remain staff/mobile-app-only, per
// ARCHITECTURE.md's customer/staff product boundary.
export default function DashboardPage() {
  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">Table dashboard — coming in later checkpoints.</p>
    </main>
  );
}
