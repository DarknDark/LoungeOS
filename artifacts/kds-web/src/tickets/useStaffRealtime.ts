import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getStaffIdToken } from "../auth/firebase-client";
import { parseProjectionFrames, type Projection } from "./projection-frames";
import { invalidateKitchenTickets } from "./useKitchenTickets";

export type { Projection };

type StaffRealtimeOptions = {
  clubId: string;
  onProjection: (projection: Projection) => void;
  /** Called when the connection state changes, for a status indicator. */
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting") => void;
};

const RETRY_DELAY_MS = 5_000;

/**
 * Connects to the staff realtime SSE stream (/v1/staff/realtime) and
 * invokes `onProjection` for each change-signal event. This is a bare
 * change-signal mechanism, not a data channel — the caller is expected to
 * invalidate/refetch its own REST queries in response (see
 * useKitchenTickets's invalidateKitchenTickets), not read ticket data from
 * the stream itself.
 *
 * Native EventSource cannot set the Authorization/X-Club-Id headers this
 * endpoint requires, so — matching the existing, working pattern in
 * artifacts/club-ordering-mobile/services/staff-realtime.ts — this uses
 * XMLHttpRequest with manual streamed-chunk parsing instead.
 *
 * Returns a cleanup function that stops the connection and any pending
 * reconnect timer.
 */
export function startStaffRealtime({
  clubId,
  onProjection,
  onStatusChange,
}: StaffRealtimeOptions): () => void {
  let stopped = false;
  let request: XMLHttpRequest | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = async () => {
    onStatusChange?.("connecting");
    const token = await getStaffIdToken();
    if (stopped || !token) {
      retry();
      return;
    }

    const nextRequest = new XMLHttpRequest();
    request = nextRequest;
    let cursor = 0;
    let buffer = "";

    const handleChunk = () => {
      onStatusChange?.("connected");
      const text = nextRequest.responseText.slice(cursor);
      cursor = nextRequest.responseText.length;
      buffer += text;
      const { projections, remainder } = parseProjectionFrames(buffer);
      buffer = remainder;
      for (const projection of projections) {
        onProjection(projection);
      }
    };

    nextRequest.open("GET", "/api/v1/staff/realtime");
    nextRequest.setRequestHeader("Accept", "text/event-stream");
    nextRequest.setRequestHeader("Authorization", `Bearer ${token}`);
    nextRequest.setRequestHeader("X-Club-Id", clubId);
    nextRequest.onprogress = handleChunk;
    nextRequest.onerror = retry;
    nextRequest.onload = retry;
    nextRequest.send();
  };

  function retry() {
    if (!stopped && !retryTimer) {
      onStatusChange?.("reconnecting");
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void connect();
      }, RETRY_DELAY_MS);
    }
  }

  void connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    request?.abort();
    request = undefined;
  };
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

/**
 * React hook wiring startStaffRealtime to React Query cache invalidation.
 * Any projection signal (the stream is a bare change-signal, not a data
 * push — see startStaffRealtime's doc comment) invalidates the current
 * station's kitchen-tickets query, triggering a normal REST refetch via
 * useKitchenTickets. This mirrors exactly how
 * StaffOperationsDashboard.tsx already handles the same stream for its own
 * queries (read as reference only, not imported).
 */
export function useStaffRealtimeInvalidation(clubId: string, stationId: string): ConnectionStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const stop = startStaffRealtime({
      clubId,
      onStatusChange: setStatus,
      onProjection: () => {
        void invalidateKitchenTickets(queryClient, stationId);
      },
    });
    return stop;
  }, [clubId, stationId, queryClient]);

  return status;
}
