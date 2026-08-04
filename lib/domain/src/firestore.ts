import type { ClubId } from './settings';

export const FIRESTORE_COLLECTIONS = {
  clubs: 'clubs',
  tables: 'tables',
  tableSessions: 'tableSessions',
  customerSessions: 'customerSessions',
  orders: 'orders',
  orderItems: 'orderItems',
  menuItems: 'menuItems',
  preparationStations: 'preparationStations',
  kitchenTickets: 'kitchenTickets',
  songRequests: 'songRequests',
  staff: 'staff',
  roles: 'roles',
  inventoryItems: 'inventoryItems',
  inventoryTransactions: 'inventoryTransactions',
  payments: 'payments',
  paymentTokens: 'paymentTokens',
  serviceTimeline: 'serviceTimeline',
  businessDays: 'businessDays',
  notifications: 'notifications',
  auditLogs: 'auditLogs',
  settings: 'settings',
  analyticsFacts: 'analyticsFacts',
  analyticsAggregates: 'analyticsAggregates',
  activityFeed: 'activityFeed',
} as const;

export type FirestoreCollection = (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS];

export function clubCollectionPath(clubId: ClubId, collection: FirestoreCollection): string {
  return `${FIRESTORE_COLLECTIONS.clubs}/${clubId}/${collection}`;
}