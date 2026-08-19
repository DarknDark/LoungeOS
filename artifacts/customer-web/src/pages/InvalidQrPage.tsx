// Scaffold placeholder. Checkpoint 5 routes here on INVALID_QR /
// TABLE_NOT_AVAILABLE / TABLE_NOT_FOUND errors from createFromQr.
export default function InvalidQrPage() {
  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">This QR code isn't valid. Please ask a waiter for help.</p>
    </main>
  );
}
