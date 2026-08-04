import type {
  ActivityFeedEntry,
  AuditLog,
  BusinessDay,
  ClubSettings,
  InventoryTransaction,
  KitchenTicket,
  Notification,
  Order,
  Payment,
  PaymentToken,
  ServiceTimelineEvent,
  SongRequest,
  TableSession,
} from '@workspace/domain';
import type { RepositoryRegistry } from '@workspace/domain';

export type RequestActor = {
  id?: string;
  clubId: string;
  kind: 'customer' | 'staff' | 'payment-contributor' | 'system';
  role?: string;
  customerSessionId?: string;
  staffId?: string;
};

export type TableSessionService = {
  createFromQr(input: {
    actor: RequestActor;
    tableId: string;
    now: string;
  }): Promise<TableSession>;
  getCustomerSession(input: {
    actor: RequestActor;
    sessionId: string;
  }): Promise<TableSession>;
  closeAfterVerifiedPayment(input: {
    actor: RequestActor;
    tableSessionId: string;
    now: string;
  }): Promise<void>;
};

export type OrderService = {
  submit(input: {
    actor: RequestActor;
    tableSessionId: string;
    items: Array<{ menuItemId: string; quantity: number }>;
    now: string;
  }): Promise<Order>;
  getForSession(input: {
    actor: RequestActor;
    tableSessionId: string;
  }): Promise<Order[]>;
};

export type PaymentService = {
  create(input: {
    actor: RequestActor;
    tableSessionId: string;
    amountMinor: number;
    method: Payment['method'];
    now: string;
  }): Promise<Payment>;
  createContributorToken(input: {
    actor: RequestActor;
    tableSessionId: string;
    expiresAt: string;
  }): Promise<PaymentToken>;
  verify(input: {
    actor: RequestActor;
    paymentId: string;
    now: string;
  }): Promise<Payment>;
};

export type InventoryService = {
  recordTransaction(input: InventoryTransaction): Promise<void>;
};

export type KitchenService = {
  updateTicket(input: {
    actor: RequestActor;
    ticketId: string;
    status: KitchenTicket['status'];
    now: string;
  }): Promise<KitchenTicket>;
};

export type DJService = {
  submitRequest(input: {
    actor: RequestActor;
    tableSessionId: string;
    song: string;
    artist: string;
    now: string;
  }): Promise<SongRequest>;
  updateStatus(input: {
    actor: RequestActor;
    requestId: string;
    status: SongRequest['status'];
    reason?: string;
    now: string;
  }): Promise<SongRequest>;
};

export type NotificationService = {
  notify(notification: Notification): Promise<void>;
  markRead(input: { actor: RequestActor; notificationId: string; now: string }): Promise<void>;
};

export type SettingsService = {
  get(clubId: string): Promise<ClubSettings>;
  update(input: {
    actor: RequestActor;
    settings: ClubSettings;
    now: string;
  }): Promise<ClubSettings>;
};

export type AuditService = {
  record(log: AuditLog): Promise<void>;
};

export type AnalyticsService = {
  record(fact: Parameters<RepositoryRegistry['analytics']['appendFact']>[0]): Promise<void>;
};

export type ActivityFeedService = {
  record(entry: ActivityFeedEntry): Promise<void>;
};

export type BusinessDayService = {
  open(input: { actor: RequestActor; day: BusinessDay }): Promise<BusinessDay>;
  close(input: { actor: RequestActor; day: BusinessDay }): Promise<BusinessDay>;
};

export type ServiceTimelineService = {
  record(event: ServiceTimelineEvent): Promise<void>;
};

export type ApplicationServices = {
  tableSessions: TableSessionService;
  orders: OrderService;
  payments: PaymentService;
  inventory: InventoryService;
  kitchen: KitchenService;
  dj: DJService;
  notifications: NotificationService;
  settings: SettingsService;
  audit: AuditService;
  analytics: AnalyticsService;
  activityFeed: ActivityFeedService;
  businessDays: BusinessDayService;
  serviceTimeline: ServiceTimelineService;
};