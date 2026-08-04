import type {
  ActivityFeedEntry,
  AnalyticsFact,
  AuditLog,
  BusinessDay,
  Club,
  CustomerSession,
  InventoryItem,
  InventoryTransaction,
  KitchenTicket,
  MenuItem,
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
};

export type TableSessionRepository = {
  getById(clubId: ClubId, sessionId: string): Promise<TableSession | null>;
  getActiveForTable(clubId: ClubId, tableId: string): Promise<TableSession | null>;
  save(session: TableSession): Promise<void>;
  createOwnerSession(input: {
    table: Table;
    session: TableSession;
    customerSession: CustomerSession;
    now: ISODateString;
  }): Promise<void>;
  createParticipantSession(input: {
    session: TableSession;
    customerSession: CustomerSession;
    maximumContributors: number;
    now: ISODateString;
  }): Promise<void>;
};

export type CustomerSessionRepository = {
  getById(clubId: ClubId, sessionId: string): Promise<CustomerSession | null>;
  getByDeviceId(
    clubId: ClubId,
    tableSessionId: string,
    deviceId: string,
  ): Promise<CustomerSession | null>;
  save(session: CustomerSession): Promise<void>;
  expire(clubId: ClubId, sessionId: string, expiredAt: ISODateString): Promise<void>;
};

export type StaffRepository = {
  getByFirebaseUid(clubId: ClubId, firebaseUid: string): Promise<Staff | null>;
};

export type RoleRepository = {
  getById(clubId: ClubId, roleId: string): Promise<Role | null>;
  list(clubId: ClubId): Promise<Role[]>;
};

export type MenuRepository = {
  getById(clubId: ClubId, menuItemId: string): Promise<MenuItem | null>;
  listAvailable(clubId: ClubId): Promise<MenuItem[]>;
  save(item: MenuItem): Promise<void>;
};

export type StationRepository = {
  getById(clubId: ClubId, stationId: string): Promise<PreparationStation | null>;
  listActive(clubId: ClubId): Promise<PreparationStation[]>;
};

export type OrderRepository = {
  getById(clubId: ClubId, orderId: string): Promise<Order | null>;
  save(order: Order, items: OrderItem[]): Promise<void>;
  listForSession(clubId: ClubId, tableSessionId: string): Promise<Page<Order>>;
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

export type NotificationRepository = {
  save(notification: Notification): Promise<void>;
  listForRecipient(clubId: ClubId, recipientId: string, query?: PageQuery): Promise<Page<Notification>>;
  markRead(clubId: ClubId, notificationId: string, readAt: ISODateString): Promise<void>;
};

export type AuditRepository = {
  append(log: AuditLog): Promise<void>;
  list(clubId: ClubId, query?: PageQuery): Promise<Page<AuditLog>>;
};

export type SettingsRepository = {
  get(clubId: ClubId): Promise<ClubSettings>;
  save(settings: ClubSettings): Promise<void>;
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
  stations: StationRepository;
  orders: OrderRepository;
  tickets: KitchenTicketRepository;
  songs: SongRepository;
  payments: PaymentRepository;
  paymentTokens: PaymentTokenRepository;
  inventory: InventoryRepository;
  notifications: NotificationRepository;
  audit: AuditRepository;
  settings: SettingsRepository;
  analytics: AnalyticsRepository;
  activityFeed: ActivityFeedRepository;
  serviceTimeline: ServiceTimelineRepository;
  businessDays: BusinessDayRepository;
};