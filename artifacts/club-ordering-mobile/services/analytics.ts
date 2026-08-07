export type LoungeAnalyticsEvent =
  | 'menu_viewed'
  | 'menu_item_viewed'
  | 'item_added'
  | 'order_submitted'
  | 'order_delivered'
  | 'waiter_called'
  | 'song_requested';

export type LoungeAnalyticsPayload = {
  event: LoungeAnalyticsEvent;
  clubId?: string;
  tableSessionId?: string;
  orderId?: string;
  menuItemId?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
};

type AnalyticsListener = (payload: LoungeAnalyticsPayload) => void;
const listeners = new Set<AnalyticsListener>();

export const loungeAnalytics = {
  emit(payload: LoungeAnalyticsPayload) {
    listeners.forEach((listener) => listener(payload));
  },
  subscribe(listener: AnalyticsListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};