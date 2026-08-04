import type { ClubSettings } from '@workspace/domain';

export type LoungeFeatureFlags = {
  songRequests: boolean;
  splitBills: boolean;
  callWaiter: boolean;
  pushNotifications: boolean;
  serviceTimeline: boolean;
  estimatedWaitingTime: boolean;
};

export function featureFlagsFromSettings(settings: ClubSettings): LoungeFeatureFlags {
  return {
    songRequests: settings.customer.songRequests && settings.business.songRequestsEnabled,
    splitBills: settings.customer.splitBills && settings.business.splitBillEnabled,
    callWaiter: settings.customer.callWaiter,
    pushNotifications: settings.notifications.push,
    serviceTimeline: settings.customer.serviceTimeline,
    estimatedWaitingTime: settings.customer.estimatedWaitingTime,
  };
}