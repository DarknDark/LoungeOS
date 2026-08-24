import { useLocation } from "wouter";
import { STATIONS } from "../stations/stations";
import { useAuth } from "../auth/AuthContext";

export default function StationSelectPage() {
  const [, setLocation] = useLocation();
  const { email, signOut } = useAuth();

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-neutral-950 p-6">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-white">Select a station</h1>
        {email ? <p className="mt-1 text-sm text-neutral-500">Signed in as {email}</p> : null}
      </div>
      <div className="flex gap-4">
        {STATIONS.map((station) => (
          <button
            key={station.id}
            type="button"
            onClick={() => setLocation(`/station/${station.id}`)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-8 py-6 text-base font-medium text-white transition hover:bg-neutral-800"
          >
            {station.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-xs text-neutral-500 underline"
      >
        Sign out
      </button>
    </main>
  );
}
