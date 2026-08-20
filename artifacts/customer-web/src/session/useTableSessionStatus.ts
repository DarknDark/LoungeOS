import { useQuery } from "@tanstack/react-query";
import {
  getCustomerTableSessionStatus,
  getGetCustomerTableSessionStatusQueryKey,
} from "@workspace/api-client-react";
import { customerHeaders, type StoredCustomerSession } from "./storage";

// Matches the "Five-second HTTP polling fallback" documented in
// HANDOFF.md / PROJECT_STATE.md. Per Checkpoint 5's requirements, this is
// the only synchronization mechanism customer-web uses — no SSE/realtime
// infrastructure and no direct Firestore access.
const POLL_INTERVAL_MS = 5_000;

/**
 * Fetches (and optionally polls) the current table/customer session status
 * for a stored session. Uses useQuery directly (with the generated
 * fetcher/query-key functions) rather than the generated
 * useGetCustomerTableSessionStatus wrapper hook, whose generic inference
 * requires an explicit queryKey when called with a partial options object.
 */
export function useTableSessionStatus(
  session: StoredCustomerSession | null,
  options?: { poll?: boolean },
) {
  return useQuery({
    queryKey: getGetCustomerTableSessionStatusQueryKey(session?.tableSessionId ?? ""),
    queryFn: () =>
      getCustomerTableSessionStatus(session!.tableSessionId, {
        headers: customerHeaders(session!),
      }),
    enabled: session !== null,
    refetchInterval: options?.poll ? POLL_INTERVAL_MS : false,
    retry: false,
  });
}
