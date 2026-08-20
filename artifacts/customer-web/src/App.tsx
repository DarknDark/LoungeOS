import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import QrEntryPage from "./pages/QrEntryPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import DashboardPage from "./pages/DashboardPage";
import SessionExpiredPage from "./pages/SessionExpiredPage";
import InvalidQrPage from "./pages/InvalidQrPage";
import { readStoredSession } from "./session/storage";

// Route structure for the isolated customer QR web app. This does not
// import from, or share navigation with, artifacts/club-ordering-mobile
// (Expo) or any staff dashboard — see artifacts/customer-web/README.md.
//
// /t/:tableId is the entry point a table's QR code links to (optionally
// with ?qrToken=...&clubId=... query params). It creates or resumes the
// customer's table session and redirects into /session/:sessionId/pending
// or /session/:sessionId based on the resulting approval status.
export default function App() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/t/:tableId" component={QrEntryPage} />
      <Route path="/invalid-qr" component={InvalidQrPage} />
      <Route path="/session/:sessionId/pending" component={PendingApprovalPage} />
      <Route path="/session/:sessionId/expired" component={SessionExpiredPage} />
      <Route path="/session/:sessionId" component={DashboardPage} />
      <Route>
        <InvalidQrPage />
      </Route>
    </Switch>
  );
}

// Resumes a previously stored session when the app is opened at "/"
// (e.g. reopened from a home-screen bookmark) rather than a fresh QR scan.
// The destination page (/session/:sessionId or /session/:sessionId/pending)
// re-validates the session itself, so this only needs a coarse redirect.
function RootRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const stored = readStoredSession();
    setLocation(stored ? `/session/${stored.tableSessionId}` : "/invalid-qr", { replace: true });
  }, [setLocation]);
  return null;
}
