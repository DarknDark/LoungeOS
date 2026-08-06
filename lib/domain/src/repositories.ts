import type {
  ActivityFeedEntry,
  AnalyticsFact,
  AuditLog,
  BusinessDay,
  Club,
  CustomerSession,
  InventoryItem,
  InventoryReservation,
  InventoryTransaction,
  KitchenTicket,
  MenuItem,
  MenuCategoryRecord,
  MenuModifier,
  ModifierOption,
  Notification,
  Order,
  OrderItem,
  Payment,
  PaymentToken,
  PreparationStation,
  Role,
  ServiceTimelineEvent,
  SongRequest,
  Staff,
  Table,
  TableSession,
} from './entities';
import type { OfflineQueue, RealtimeRepository } from './infrastructure';
import type { ClubId, ClubSettings, ISODateString } from './settings';

export type PageQuery = {
  limit?: number;
  cursor?: string;
};

export type Page<T> = {
  items: T[];
  nextCursor?: string;
};

export type ClubRepository = {
  getById(clubId: ClubId): Promise<Club | null>;
};

export type TableRepository = {
  getById(clubId: ClubId, tableId: string): Promise<Table | null>;
  list(clubId: ClubId, query?: PageQuery): Promise<Page<Table>>;
  save(table: Table): Promise<void>;
  saveIfVersion?: (
    table: Table,
    expectedVersion: number,
  ) => Promise<void>;
};

export type TableSessionRepository = {
  getById(clubId: ClubId, sessionId: string): Promise<TableSession | null>;
  getActiveForTable(clubId: ClubId, tableId: string): Promise<TableSession | null>;
  save(session: TableSession): Promise<void>;
  closeAfterVerifiedPayment?(input: {
    session: TableSession;
    table: Table;
    notification: Notification;
    timeline: ServiceTimelineEvent;
    audit: AuditLog;
    now: ISODateString;
  }): Promise<void>;
  createOwnerSession(input: {
    table: Table;
    session: TableSession;
    customerSession: CustomerSession;
    now: ISODateString;
  }): Promise<void>;
  createStaffSession(input: {
    table: Table;
    session: TableSession;
    now: ISODateString;
  }): Promise<void>;
  approveCustomerSession(input: {
    session: TableSession;
    customerSession: CustomerSession;
    now: ISODateString;
  }): Promise<void>;
  saveIfVersion?: (
    session: TableSession,
    expectedVersion: number,
  ) => Promise<void>;
  createParticipantSession(input: {
    session: TableSession;
    customerSession: CustomerSession;
    maximumContributors: number;
    consumeSplitSlot?: boolean;
    now: ISODateString;
  }): Promise<void>;
};

export type CustomerSessionRepository = {
  getById(clubId: ClubId, sessionId: string): Promise<CustomerSession | null>;
  listForTableSession(clubId: ClubId, tableSessionId: string): Promise<CustomerSession[]>;
  getByDeviceId(
    clubId: ClubId,
    tableSessionId: string,
    deviceId: string,
  ): Promise<CustomerSession | null>;
  save(session: CustomerSession): Promise<void>;
  expire(clubId: ClubId, sessionId: string, expiredAt: ISODateString): Promise<void>;
};

export type StaffRepository = {
  getById(clubId: ClubId, staffId: string): Promise<Staff | null>;
  getByFirebaseUid(clubId: ClubId, firebaseUid: string): Promise<Staff | null>;
  create(staff: Staff): Promise<Staff>;
  update(staff: Staff): Promise<Staff>;
  list(clubId: ClubId): Promise<Staff[]>;
};

export type RoleRepository = {
  getById(clubId: ClubId, roleId: string): Promise<Role | null>;
  list(clubId: ClubId): Promise<Role[]>;
  create(role: Role): Promise<Role>;
  update(role: Role): Promise<Role>;
};

export type MenuRepository = {
  getById(clubId: ClubId, menuItemId: string): Promise<MenuItem | null>;
  listAvailable(clubId: ClubId): Promise<MenuItem[]>;
  save(item: MenuItem): Promise<void>;
};

export type MenuCategoryRepository = {
  listActive(clubId: ClubId): Promise<MenuCategoryRecord[]>;
  getById(clubId: ClubId, categoryId: string): Promise<MenuCategoryRecord | null>;
  save(category: MenuCategoryRecord): Promise<void>;
};

export type MenuItemRepository = MenuRepository;

export type ModifierRepository = {
  getById(clubId: ClubId, modifierId: string): Promise<MenuModifier | null>;
  listForMenuItem(clubId: ClubId, menuItemId: string): Promise<MenuModifier[]>;
  getOption(clubId: ClubId, optionId: string): Promise<ModifierOption | null>;
  saveModifier(modifier: MenuModifier): Promise<void>;
  saveOption(option: ModifierOption): Promise<void>;
};

export type StationRepository = {
  getById(clubId: ClubId, stationId: string): Promise<PreparationStation | null>;
  listActive(clubId: ClubId): Promise<PreparationStation[]>;
};

export type OrderRepository = {
  getById(clubId: ClubId, orderId: string): Promise<Order | null>;
  save(order: Order, items: OrderItem[]): Promise<void>;
  saveIfVersion?: (
    order: Order,
    items: OrderItem[],
    expectedVersion: number,
  ) => Promise<void>;
  findByIdempotencyKey(
    clubId: ClubId,
    tableSessionId: string,
    customerSessionId: string,
    idempotencyKey: string,
  ): Promise<Order | null>;
  listForSession(clubId: ClubId, tableSessionId: string): Promise<Page<Order>>;
  listForCustomerSession(
    clubId: ClubId,
    tableSessionId: string,
    customerSessionId: string,
  ): Promise<Page<Order>>;
  listItems(clubId: ClubId, orderId: string): Promise<OrderItem[]>;
};

export type OrderItemRepository = {
  listForOrder(clubId: ClubId, orderId: string): Promise<OrderItem[]>;
  save(item: OrderItem): Promise<void>;
};

export type KitchenTicketRepository = {
  getById(clubId: ClubId, ticketId: string): Promise<KitchenTicket | null>;
  save(ticket: KitchenTicket): Promise<void>;
  listForStation(clubId: ClubId, stationId: string, query?: PageQuery): Promise<Page<KitchenTicket>>;
};

export type SongRepository = {
  getById(clubId: ClubId, requestId: string): Promise<SongRequest | null>;
  save(request: SongRequest): Promise<void>;
  listQueue(clubId: ClubId, businessDayId: string): Promise<Page<SongRequest>>;
  listForSession(clubId: ClubId, tableSessionId: string): Promise<Page<SongRequest>>;
};

export type PaymentRepository = {
  getById(clubId: ClubId, paymentId: string): Promise<Payment | null>;
  save(payment: Payment): Promise<void>;
  listForSession(clubId: ClubId, tableSessionId: string): Promise<Page<Payment>>;
};

export type PaymentTokenRepository = {
  getByHash(clubId: ClubId, tokenHash: string): Promise<PaymentToken | null>;
  save(token: PaymentToken): Promise<void>;
};

export type InventoryRepository = {
  getItem(clubId: ClubId, inventoryItemId: string): Promise<InventoryItem | null>;
  listItems(clubId: ClubId): Promise<Page<InventoryItem>>;
  appendTransaction(transaction: InventoryTransaction): Promise<void>;
  listTransactions(clubId: ClubId, inventoryItemId: string, query?: PageQuery): Promise<Page<InventoryTransaction>>;
};

export type InventoryReservationRepository = {
  reserve(input: {
    clubId: ClubId;
    orderId: string;
    inventoryItemId: string;
    quantity: number;
    now: ISODateString;
  }): Promise<InventoryReservation>;
  releaseForOrder(
    clubId: ClubId,
    orderId: string,
    now: ISODateString,
  ): Promise<void>;
  listForOrder(clubId: ClubId, orderId: string): Promise<InventoryReservation[]>;
};

export type NotificationRepository = {
  save(notification: Notification): Promise<void>;
  listForRecipient(clubId: ClubId, recipientId: string, query?: PageQuery): Promise<Page<Notification>>;
  listForSession(clubId: ClubId, tableSessionId: string): Promise<Page<Notification>>;
  markRead(clubId: ClubId, notificationId: string, readAt: ISODateString): Promise<void>;
  markDelivered?: (
    clubId: ClubId,
    notificationId: string,
    deliveredAt: ISODateString,
  ) => Promise<void>;
  archive?: (
    clubId: ClubId,
    notificationId: string,
    archivedAt: ISODateString,
  ) => Promise<void>;
};

export type AuditRepository = {
  append(log: AuditLog): Promise<void>;
  list(clubId: ClubId, query?: PageQuery): Promise<Page<AuditLog>>;
};

export type SettingsRepository = {
  get(clubId: ClubId): Promise<ClubSettings>;
  save(settings: ClubSettings): Promise<void>;
  saveIfVersion?: (
    settings: ClubSettings,
    expectedVersion: number,
  ) => Promise<void>;
};

export type AnalyticsRepository = {
  appendFact(fact: AnalyticsFact): Promise<void>;
  listFacts(clubId: ClubId, query?: PageQuery): Promise<Page<AnalyticsFact>>;
};

export type ActivityFeedRepository = {
  append(entry: ActivityFeedEntry): Promise<void>;
  list(clubId: ClubId, query?: PageQuery): Promise<Page<ActivityFeedEntry>>;
};

export type ServiceTimelineRepository = {
  append(event: ServiceTimelineEvent): Promise<void>;
  listForSession(clubId: ClubId, tableSessionId: string, query?: PageQuery): Promise<Page<ServiceTimelineEvent>>;
};

export type BusinessDayRepository = {
  getActive(clubId: ClubId): Promise<BusinessDay | null>;
  save(day: BusinessDay): Promise<void>;
};

export type RepositoryRegistry = {
  clubs: ClubRepository;
  tables: TableRepository;
  tableSessions: TableSessionRepository;
  customerSessions: CustomerSessionRepository;
  staff: StaffRepository;
  roles: RoleRepository;
  menu: MenuRepository;
  menuCategories: MenuCategoryRepository;
  menuItems: MenuItemRepository;
  modifiers: ModifierRepository;
  stations: StationRepository;
  orders: OrderRepository;
  orderItems: OrderItemRepository;
  tickets: KitchenTicketRepository;
  songs: SongRepository;
  payments: PaymentRepository;
  paymentTokens: PaymentTokenRepository;
  inventory: InventoryRepository;
  inventoryReservations: InventoryReservationRepository;
  notifications: NotificationRepository;
  audit: AuditRepository;
  settings: SettingsRepository;
  analytics: AnalyticsRepository;
  activityFeed: ActivityFeedRepository;
  serviceTimeline: ServiceTimelineRepository;
  businessDays: BusinessDayRepository;
  realtime?: RealtimeRepository;
  offlineQueue?: OfflineQueue;
};