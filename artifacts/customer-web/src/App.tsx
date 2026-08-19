import { Route, Switch } from "wouter";
import QrEntryPage from "./pages/QrEntryPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import DashboardPage from "./pages/DashboardPage";
import SessionExpiredPage from "./pages/SessionExpiredPage";
import InvalidQrPage from "./pages/InvalidQrPage";

// Route structure for the isolated customer QR web app. This does not
// import from, or share navigation with, artifacts/club-ordering-mobile
// (Expo) or any staff dashboard — see artifacts/customer-web/README.md.
//
// /t/:tableId is the entry point a table's QR code links to. Checkpoint 5
// wires it to createFromQr and redirects into /pending or /dashboard based
// on the resulting customer session's approvalStatus; /session/:sessionId
// supports resuming a previously stored session (recover/getStatus).
export default function App() {
  return (
    <Switch>
      <Route path="/t/:tableId" component={QrEntryPage} />
      <Route path="/session/:sessionId/pending" component={PendingApprovalPage} />
      <Route path="/session/:sessionId" component={DashboardPage} />
      <Route path="/session/:sessionId/expired" component={SessionExpiredPage} />
      <Route>
        <InvalidQrPage />
      </Route>
    </Switch>
  );
}
