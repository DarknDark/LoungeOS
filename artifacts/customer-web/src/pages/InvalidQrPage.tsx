// Reached both when a QR scan fails permanently (INVALID_QR,
// TABLE_NOT_FOUND, TABLE_NOT_AVAILABLE, CONFIGURATION_INVALID — see
// QrEntryPage) and when the app is opened with no stored session and no
// table in the URL at all (see App.tsx's RootRedirect). The copy is
// deliberately neutral enough to cover both cases correctly.
export default function InvalidQrPage() {
  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">
        We couldn't find your table. Please scan the QR code on your table, or ask a waiter for
        help.
      </p>
    </main>
  );
}
