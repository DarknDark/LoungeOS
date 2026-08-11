import type {
  RealtimeChange,
  RealtimeRepository,
  RealtimeSubscription,
} from '@workspace/domain';

export type RealtimeProjectionResource =
  | 'table-sessions'
  | 'orders'
  | 'notifications';

export type RealtimeProjection = {
  resource: RealtimeProjectionResource;
  type: RealtimeChange<Record<string, unknown>>['type'];
};

export type RealtimeProjectionService = {
  subscribe(input: {
    clubId: string;
    recipientId?: string;
    listener: (projection: RealtimeProjection) => void;
  }): RealtimeSubscription;
};

/**
 * Converts provider changes into safe projection signals. The source record is
 * deliberately discarded here; transports must re-query their authorized
 * projection instead of sending operational data through the stream.
 */
export function createRealtimeProjectionService(
  realtime: RealtimeRepository,
): RealtimeProjectionService {
  return {
    subscribe({ clubId, recipientId, listener }) {
      const subscriptions: RealtimeSubscription[] = [];
      const forward =
        (resource: RealtimeProjectionResource) =>
        (change: RealtimeChange<Record<string, unknown>>) => {
          listener({ resource, type: change.type });
        };

      try {
        subscriptions.push(
          realtime.subscribeToSessions(clubId, forward('table-sessions')),
          realtime.subscribeToOrders(clubId, forward('orders')),
        );
        if (recipientId) {
          subscriptions.push(
            realtime.subscribeToNotifications(
              clubId,
              recipientId,
              forward('notifications'),
            ),
          );
        }
      } catch (error) {
        subscriptions.forEach((subscription) => subscription.unsubscribe());
        throw error;
      }

      return {
        unsubscribe() {
          subscriptions.splice(0).forEach((subscription) => subscription.unsubscribe());
        },
      };
    },
  };
}