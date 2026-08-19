import type {
  ActivityFeedEntry,
  AuditLog,
  BusinessDay,
  ClubSettings,
  InventoryTransaction,
  KitchenTicket,
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  MenuCategoryRecord,
  MenuItem,
  MenuModifier,
  Payment,
  PaymentToken,
  ServiceTimelineEvent,
  SongRequest,
  TableSession,
} from '@workspace/domain';
import type { RepositoryRegistry } from '@workspace/domain';
import type { Table, CustomerSession } from '@workspace/domain';
import type {
  RealtimeChange,
  RealtimeSubscription,
  SyncOperation,
} from '@workspace/domain';

export type RequestActor = {
  id?: string;
  clubId: string;
  kind: 'customer' | 'staff' | 'payment-contributor' | 'system';
  role?: string;
  customerSessionId?: string;
  customerSessionToken?: string;
  staffId?: string;
  firebaseUid?: string;
};

export type TableSessionService = {
  validateTable(input: {
    clubId: string;
    tableId: string;
    now: string;
  }): Promise<Table>;
  validateQr(input: {
    clubId: string;
    tableId: string;
    qrToken: string;
    now: string;
  }): Promise<Table>;
  open(input: {
    actor: RequestActor;
    tableId: string;
    deviceId?: string;
    now: string;
  }): Promise<TableSessionAccess>;
  openManual(input: {
    actor: RequestActor;
    tableId: string;
    now: string;
  }): Promise<TableSession>;
  approveJoin(input: {
    actor: RequestActor;
    tableSessionId: string;
    customerSessionId: string;
    now: string;
  }): Promise<CustomerSession>;
  listJoinRequests(input: {
    actor: RequestActor;
    tableSessionId: string;
  }): Promise<CustomerSession[]>;
  requestClose(input: {
    actor: RequestActor;
    tableSessionId: string;
    now: string;
  }): Promise<TableSessionAccess>;
  cancelClose(input: {
    actor: RequestActor;
    tableSessionId: string;
    now: string;
  }): Promise<TableSessionAccess>;
  reopenClose(input: {
    actor: RequestActor;
    tableSessionId: string;
    now: string;
  }): Promise<TableSession>;
  createFromQr(input: {
    actor: RequestActor;
    tableId: string;
    qrToken: string;
    deviceId?: string;
    now: string;
  }): Promise<TableSessionAccess>;
  join(input: {
    actor: RequestActor;
    tableSessionId: string;
    qrToken?: string;
    deviceId?: string;
    now: string;
    consumeSplitSlot?: boolean;
  }): Promise<TableSessionAccess>;
  recover(input: {
    actor: RequestActor;
    recoveryToken: string;
    deviceId?: string;
    now: string;
  }): Promise<TableSessionAccess>;
  heartbeat(input: {
    actor: RequestActor;
    tableSessionId: string;
    customerSessionId: string;
    now: string;
  }): Promise<TableSessionAccess>;
  getCustomerSession(input: {
    actor: RequestActor;
    sessionId: string;
  }): Promise<TableSession>;
  getStatus(input: {
    actor: RequestActor;
    tableSessionId: string;
    now: string;
  }): Promise<TableSessionAccess>;
  closeAfterVerifiedPayment(input: {
    actor: RequestActor;
    tableSessionId: string;
    now: string;
  }): Promise<void>;
  enablePaymentSplit(input: {
    actor: RequestActor;
    tableSessionId: string;
    splitCount: number;
    now: string;
  }): Promise<void>;
  submitPayment(input: {
    actor: RequestActor;
    tableSessionId: string;
    method: Payment['method'];
    now: string;
  }): Promise<Payment>;
  verifyPayment(input: {
    actor: RequestActor;
    paymentId: string;
    now: string;
  }): Promise<Payment>;
};

export type TableSessionAccess = {
  tableSession: TableSession;
  customerSession: CustomerSession;
  recoveryToken: string;
};

export type OrderService = {
  getMenu(input: {
    clubId: string;
  }): Promise<{
    categories: MenuCategoryRecord[];
    items: MenuItem[];
    modifiers: Array<MenuModifier & { options: Array<{
      id: string;
      modifierId: string;
      name: string;
      priceDeltaMinor: number;
      available: boolean;
    }> }>;
  }>;
  createDraft(input: {
    actor: RequestActor;
    tableSessionId: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifiers?: Array<{ modifierId: string; optionIds: string[] }>;
      notes?: string;
    }>;
    notes?: string;
    idempotencyKey: string;
    now: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  submit(input: {
    actor: RequestActor;
    orderId: string;
    expectedVersion: number;
    now: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  create(input: {
    actor: RequestActor;
    tableSessionId: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifiers?: Array<{ modifierId: string; optionIds: string[] }>;
      notes?: string;
    }>;
    notes?: string;
    idempotencyKey: string;
    now: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  createForStaff(input: {
    actor: RequestActor;
    tableSessionId: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifiers?: Array<{ modifierId: string; optionIds: string[] }>;
      notes?: string;
    }>;
    notes?: string;
    idempotencyKey: string;
    now: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  updateDraft(input: {
    actor: RequestActor;
    orderId: string;
    expectedVersion: number;
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifiers?: Array<{ modifierId: string; optionIds: string[] }>;
      notes?: string;
    }>;
    notes?: string;
    now: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  cancel(input: {
    actor: RequestActor;
    orderId: string;
    reason?: string;
    now: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  updateStatus(input: {
    actor: RequestActor;
    orderId: string;
    status: Exclude<OrderStatus, 'draft' | 'submitted'>;
    expectedVersion: number;
    reason?: string;
    now: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  get(input: {
    actor: RequestActor;
    orderId: string;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  getForSession(input: {
    actor: RequestActor;
    tableSessionId: string;
  }): Promise<Array<{ order: Order; items: OrderItem[] }>>;
  subscribeToOrders(input: {
    clubId: string;
    listener: (change: RealtimeChange<Record<string, unknown>>) => void;
  }): RealtimeSubscription;
  queueMutation(input: {
    clubId: string;
    operation: SyncOperation;
    resourceId: string;
    payload: Record<string, unknown>;
    expectedVersion?: number;
    now: string;
  }): Promise<void>;
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
  listForSession(input: {
    actor: RequestActor;
    tableSessionId: string;
  }): Promise<SongRequest[]>;
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