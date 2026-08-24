import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getListStaffKitchenTicketsQueryKey,
  listStaffKitchenTickets,
} from "@workspace/api-client-react";
import { useAuth } from "../auth/AuthContext";

// Five-second polling as a baseline safety net, matching the workspace's
// documented "Five-second HTTP polling fallback" convention — the SSE
// signal (useStaffRealtime) provides faster invalidation on top of this,
// it does not replace it.
const POLL_INTERVAL_MS = 5_000;

export function kitchenTicketsQueryKey(stationId: string) {
  return getListStaffKitchenTicketsQueryKey({ stationId });
}

export function useKitchenTickets(clubId: string, stationId: string) {
  const { getIdToken } = useAuth();

  return useQuery({
    queryKey: kitchenTicketsQueryKey(stationId),
    queryFn: async () => {
      const token = await getIdToken();
      return listStaffKitchenTickets(
        { stationId },
        {
          headers: {
            "X-Club-Id": clubId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
    },
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  });
}

/** Invalidates the kitchen-tickets query for a station, triggering a refetch. */
export function invalidateKitchenTickets(queryClient: QueryClient, stationId: string) {
  return queryClient.invalidateQueries({ queryKey: kitchenTicketsQueryKey(stationId) });
}
