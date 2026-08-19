// Scaffold placeholder. Checkpoint 5 wires this to
// POST /v1/customer/table-sessions (createFromQr) via the generated
// @workspace/api-client-react hook, reads the tableId/qr token from the
// route params, and redirects to /pending or /dashboard based on the
// resulting approvalStatus.
export default function QrEntryPage() {
  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">Table entry — coming in Checkpoint 5.</p>
    </main>
  );
}
