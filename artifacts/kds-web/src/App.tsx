import { Route, Switch } from "wouter";
import { useAuth } from "./auth/AuthContext";
import SignInPage from "./pages/SignInPage";
import StationSelectPage from "./pages/StationSelectPage";
import StationDashboardPage from "./pages/StationDashboardPage";

// This is an isolated staff-facing surface, separate from
// artifacts/club-ordering-mobile (the Expo staff/customer prototype) and
// artifacts/customer-web (the customer QR app). It does not import from,
// and is not imported by, either.
export default function App() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <main className="flex h-full items-center justify-center bg-neutral-950">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (status === "signed-out") {
    return <SignInPage />;
  }

  return (
    <Switch>
      <Route path="/station/:stationId" component={StationDashboardPage} />
      <Route path="/station" component={StationSelectPage} />
      <Route>
        <StationSelectPage />
      </Route>
    </Switch>
  );
}
