import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@workspace/api-client-react";
import { customerHeaders, type StoredCustomerSession } from "./storage";

// Matches the "Five-second HTTP polling fallback" documented in
// HANDOFF.md / PROJECT_STATE.md — the same interval used by
// useTableSessionStatus.
const POLL_INTERVAL_MS = 5_000;

export function useOrders(session: StoredCustomerSession | null, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: ["orders", session?.tableSessionId ?? null],
    queryFn: () => listOrders({ headers: customerHeaders(session!) }),
    enabled: session !== null,
    refetchInterval: options?.poll ? POLL_INTERVAL_MS : false,
    retry: false,
  });
}
