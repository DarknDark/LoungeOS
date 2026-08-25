import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { KitchenTicket, KitchenTicketListResponse } from "@workspace/api-client-react";
import { updateStaffKitchenTicketStatus } from "@workspace/api-client-react";
import { useAuth } from "../auth/AuthContext";
import { kitchenTicketsQueryKey } from "./useKitchenTickets";
import { replaceTicketStatus } from "./ticket-actions";

type UpdateTicketStatusInput = {
  ticketId: string;
  status: KitchenTicket["status"];
};

/**
 * Mutation hook for transitioning a ticket's status, with an optimistic
 * cache update (the card moves to its new column immediately) and a
 * rollback to the previous cache state if the request fails. `onSettled`
 * always invalidates afterward, so the eventual authoritative state (from
 * this request, a concurrent one, or the SSE-triggered refetch) wins.
 */
export function useUpdateTicketStatus(clubId: string, stationId: string) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = kitchenTicketsQueryKey(stationId);

  return useMutation({
    mutationFn: async ({ ticketId, status }: UpdateTicketStatusInput) => {
      const token = await getIdToken();
      return updateStaffKitchenTicketStatus(
        ticketId,
        { status },
        {
          headers: {
            "X-Club-Id": clubId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
    },
    onMutate: async ({ ticketId, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<KitchenTicketListResponse>(queryKey);
      queryClient.setQueryData<KitchenTicketListResponse | undefined>(queryKey, (current) =>
        replaceTicketStatus(current, ticketId, status),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
