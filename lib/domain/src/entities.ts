import type { ClubId, ClubSettings, ISODateString } from './settings';
import type { VersionedRecord } from './records';

export type EntityId = string;
export type CurrencyCode = string;

export type Club = {
  id: ClubId;
  name: string;
  slug: string;
  settingsId: EntityId;
  active: boolean;
  createdAt: ISODateString;
};

export type TableStatus =
  | 'available'
  | 'occupied'
  | 'finishing-up';

export type Table = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  number: number;
  label: string;
  capacity?: number;
  qrVersion: number;
  /** @deprecated Legacy compatibility only; canonical entry uses tableId. */
  qrTokenHash?: string;
  /** @deprecated Legacy compatibility only; canonical entry uses tableId. */
  qrTokenExpiresAt?: ISODateString;
  status: TableStatus;
  activeSessionId?: EntityId;
  splitSlotsRemaining?: number;
};

export type TableSessionStatus =
  | 'created'
  | 'active'
  | 'splitting-bill'
  | 'awaiting-payment'
  | 'payment-pending'
  | 'completed'
  | 'closed'
  | 'expired';

export type TableSession = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  tableId: EntityId;
  businessDayId: EntityId;
  ownerCustomerSessionId: EntityId;
  openedAt: ISODateString;
  closedAt?: ISODateString;
  status: TableSessionStatus;
  runningTotalMinor: number;
  expiresAt: ISODateString;
  lastActivityAt: ISODateString;
};

export type CustomerSession = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  tableSessionId: EntityId;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  isTableOwner: boolean;
  deviceId?: string;
  lastHeartbeatAt?: ISODateString;
  recoveryTokenHash?: string;
  expiredAt?: ISODateString;
};

export type StaffRoleName =
  | 'administrator'
  | 'waiter'
  | 'bartender'
  | 'kitchen'
  | 'dj';

export type Permission =
  | 'tables.read'
  | 'tables.release'
  | 'orders.read'
  | 'orders.manage'
  | 'tickets.manage'
  | 'payments.verify'
  | 'songs.manage'
  | 'inventory.read'
  | 'inventory.manage'
  | 'settings.manage'
  | 'staff.manage'
  | 'reports.read'
  | 'business-days.manage';

export type Role = {
  id: EntityId;
  clubId?: ClubId;
  name: StaffRoleName | string;
  permissions: Permission[];
  active: boolean;
};

export type Staff = {
  id: EntityId;
  clubId: ClubId;
  firebaseUid: string;
  displayName: string;
  email?: string;
  roleIds: EntityId[];
  active: boolean;
  photoUrl?: string;
};

export type MenuCategory = 'drinks' | 'food' | string;

export type MenuCategoryRecord = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
};

export type ModifierOption = {
  id: EntityId;
  clubId: ClubId;
  modifierId: EntityId;
  name: string;
  priceDeltaMinor: number;
  available: boolean;
};

export type MenuModifier = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  name: string;
  menuItemIds?: EntityId[];
  required: boolean;
  minSelections: number;
  maxSelections: number;
  optionIds: EntityId[];
  options?: ModifierOption[];
  active: boolean;
};

export type MenuItem = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  name: string;
  description?: string;
  priceMinor: number;
  currency: CurrencyCode;
  category: MenuCategory;
  categoryId?: EntityId;
  imageUrl?: string;
  preparationStationId: EntityId;
  inventoryItemId?: EntityId;
  available: boolean;
  sortOrder: number;
  modifierIds?: EntityId[];
};

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type OrderModifierSelection = {
  modifierId: EntityId;
  optionIds: EntityId[];
  priceDeltaMinor: number;
};

export type OrderItem = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  orderId: EntityId;
  menuItemId: EntityId;
  nameSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  preparationStationId: EntityId;
  inventoryItemId?: EntityId;
  modifiers: OrderModifierSelection[];
  notes?: string;
  lineSubtotalMinor: number;
};

export type Order = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  tableSessionId: EntityId;
  customerSessionId: EntityId;
  businessDayId: EntityId;
  status: OrderStatus;
  itemIds: EntityId[];
  idempotencyKey: string;
  subtotalMinor: number;
  taxMinor: number;
  serviceChargeMinor: number;
  discountMinor: number;
  totalMinor: number;
  notes?: string;
  createdAt: ISODateString;
  submittedAt?: ISODateString;
  acceptedAt?: ISODateString;
  preparingAt?: ISODateString;
  readyAt?: ISODateString;
  deliveredAt?: ISODateString;
  cancelledAt?: ISODateString;
  cancelledBy?: EntityId;
  cancellationReason?: string;
};

export type InventoryReservationStatus = 'reserved' | 'released' | 'consumed';

export type InventoryReservation = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  orderId: EntityId;
  inventoryItemId: EntityId;
  quantity: number;
  status: InventoryReservationStatus;
  createdAt: ISODateString;
  releasedAt?: ISODateString;
};

export type PreparationStationType = 'bar' | 'kitchen' | 'shisha' | 'dj' | 'custom';

export type PreparationStation = {
  id: EntityId;
  clubId: ClubId;
  name: string;
  type: PreparationStationType;
  active: boolean;
};

export type TicketStatus = 'new' | 'preparing' | 'ready' | 'collected';

export type KitchenTicket = {
  id: EntityId;
  clubId: ClubId;
  orderId: EntityId;
  stationId: EntityId;
  orderItemIds: EntityId[];
  status: TicketStatus;
  assignedStaffId?: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type SongRequestStatus = 'queued' | 'playing' | 'played' | 'skipped';

export type SongRequest = {
  id: EntityId;
  clubId: ClubId;
  tableSessionId: EntityId;
  customerSessionId: EntityId;
  businessDayId: EntityId;
  songId?: string;
  song: string;
  artist: string;
  duplicateKey: string;
  queuePosition?: number;
  status: SongRequestStatus;
  skipReason?: string;
};

export type PaymentMethod = 'mpesa' | 'cash' | 'till';
export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'rejected' | 'expired';

export type Payment = {
  id: EntityId;
  clubId: ClubId;
  tableSessionId: EntityId;
  businessDayId: EntityId;
  method: PaymentMethod;
  amountMinor: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  providerReference?: string;
  verifiedByStaffId?: EntityId;
  createdAt: ISODateString;
  verifiedAt?: ISODateString;
};

export type PaymentTokenStatus = 'active' | 'redeemed' | 'expired' | 'revoked';

export type PaymentToken = {
  id: EntityId;
  clubId: ClubId;
  tableSessionId: EntityId;
  tokenHash: string;
  requestedAmountMinor?: number;
  status: PaymentTokenStatus;
  expiresAt: ISODateString;
  redeemedAt?: ISODateString;
  paymentId?: EntityId;
};

export type InventoryTransactionType = 'sale' | 'restock' | 'waste' | 'adjustment';

export type InventoryItem = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  name: string;
  unit: string;
  lowStockThreshold: number;
  quantityOnHand?: number;
  reservedQuantity?: number;
  active: boolean;
};

export type InventoryTransaction = {
  id: EntityId;
  clubId: ClubId;
  inventoryItemId: EntityId;
  businessDayId: EntityId;
  type: InventoryTransactionType;
  quantity: number;
  reason?: string;
  sourceOrderId?: EntityId;
  actorStaffId?: EntityId;
  createdAt: ISODateString;
};

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationCategory =
  | 'waiter'
  | 'kitchen'
  | 'bar'
  | 'dj'
  | 'payment'
  | 'inventory'
  | 'session'
  | 'business-day'
  | 'administration';

export type Notification = VersionedRecord & {
  id: EntityId;
  clubId: ClubId;
  recipientId?: EntityId;
  recipientRole?: StaffRoleName;
  priority: NotificationPriority;
  category: NotificationCategory;
  message: string;
  relatedRecord?: { type: string; id: EntityId };
  createdAt: ISODateString;
  readAt?: ISODateString;
  deliveredAt?: ISODateString;
  archivedAt?: ISODateString;
};

export type AuditAction =
  | 'login'
  | 'logout'
  | 'price-changed'
  | 'inventory-adjusted'
  | 'payment-verified'
  | 'table-opened'
  | 'table-closed'
  | 'business-day-opened'
  | 'business-day-closed'
  | 'settings-changed'
  | 'staff-role-changed'
  | string;

export type AuditActorType = 'customer' | 'staff' | 'system' | 'payment-contributor';

export type AuditLog = {
  id: EntityId;
  clubId: ClubId;
  actorId?: EntityId;
  actorType: AuditActorType;
  action: AuditAction;
  resourceType: string;
  resourceId?: EntityId;
  timestamp: ISODateString;
  metadata: Record<string, unknown>;
  target?: { type: string; id: EntityId };
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: ISODateString;
};

export type BusinessDayStatus = 'open' | 'closed';

export type BusinessDay = {
  id: EntityId;
  clubId: ClubId;
  businessDate: string;
  status: BusinessDayStatus;
  openedAt: ISODateString;
  closedAt?: ISODateString;
  openedByStaffId?: EntityId;
  closedByStaffId?: EntityId;
};

export type AnalyticsFact = {
  id: EntityId;
  clubId: ClubId;
  businessDayId: EntityId;
  metric: string;
  value: number;
  dimensions: Record<string, string | number>;
  occurredAt: ISODateString;
};

export type ActivityFeedEntry = {
  id: EntityId;
  clubId: ClubId;
  businessDayId?: EntityId;
  actorId?: EntityId;
  type: string;
  summary: string;
  sourceRecord?: { type: string; id: EntityId };
  auditLogId?: EntityId;
  occurredAt: ISODateString;
};

export type ServiceTimelineEvent = {
  id: EntityId;
  clubId: ClubId;
  tableSessionId: EntityId;
  type: string;
  message: string;
  sourceRecord?: { type: string; id: EntityId };
  occurredAt: ISODateString;
};

export type LoungeOSSettings = ClubSettings;