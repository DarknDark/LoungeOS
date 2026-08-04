import type { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import {
  clubCollectionPath,
  FIRESTORE_COLLECTIONS,
  type Club,
  type ClubSettings,
  type CustomerSession,
  type Page,
  type PageQuery,
  type RepositoryRegistry,
  type Staff,
  type Role,
  type Table,
  type TableSession,
  type Notification,
  type ServiceTimelineEvent,
  type AuditLog,
  type BusinessDay,
  type MenuCategoryRecord,
  type MenuItem,
  type MenuModifier,
  type ModifierOption,
  type Order,
  type OrderItem,
  type InventoryItem,
  type InventoryReservation,
} from '@workspace/domain';
import type {
  BusinessDayRepository,
  ClubRepository,
  CustomerSessionRepository,
  NotificationRepository,
  PageQuery as DomainPageQuery,
  ServiceTimelineRepository,
  SettingsRepository,
  StaffRepository,
  TableRepository,
  TableSessionRepository,
  RoleRepository,
  MenuCategoryRepository,
  MenuItemRepository,
  ModifierRepository,
  OrderRepository,
  OrderItemRepository,
  InventoryRepository,
  InventoryReservationRepository,
  AuditRepository,
  RealtimeChange,
  RealtimeRepository,
  RealtimeSubscription,
  OfflineQueue,
  SyncQueueItem,
} from '@workspace/domain';

type DocumentData = Record<string, unknown>;

function isDeleted(data: DocumentData | undefined): boolean {
  return Boolean(data?.deletedAt);
}

function documentWithId<T extends object>(
  id: string,
  data: DocumentData | undefined,
): T | null {
  return data && !isDeleted(data) ? ({ id, ...data } as T) : null;
}

function limitFor(query?: PageQuery): number {
  return Math.min(Math.max(query?.limit ?? 50, 1), 100);
}

function pageFromSnapshot<T extends object>(
  snapshot: FirebaseFirestore.QuerySnapshot,
  limit: number,
): Page<T> {
  const documents = snapshot.docs.slice(0, limit);
  return {
    items: documents
      .map((document) => documentWithId<T>(document.id, document.data()))
      .filter((item): item is T => item !== null && !isDeleted(item as DocumentData)),
    ...(snapshot.docs.length > limit
      ? { nextCursor: documents.at(-1)?.id }
      : {}),
  };
}

function scopedCollection(
  firestore: Firestore,
  clubId: string,
  collection: (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS],
) {
  return firestore.collection(clubCollectionPath(clubId, collection));
}

function applyCursor(query: Query, cursor?: string): Query {
  return cursor ? query.startAfter(cursor) : query;
}

export class FirestoreClubRepository implements ClubRepository {
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string): Promise<Club | null> {
    const document = await this.firestore
      .collection(FIRESTORE_COLLECTIONS.clubs)
      .doc(clubId)
      .get();
    return documentWithId<Club>(document.id, document.data());
  }
}

export class FirestoreTableRepository implements TableRepository {
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string, tableId: string): Promise<Table | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.tables,
    )
      .doc(tableId)
      .get();
    const data = document.data();
    return isDeleted(data) ? null : documentWithId<Table>(document.id, data);
  }

  async list(clubId: string, query?: DomainPageQuery): Promise<Page<Table>> {
    const limit = limitFor(query);
    const snapshot = await applyCursor(
      scopedCollection(
        this.firestore,
        clubId,
        FIRESTORE_COLLECTIONS.tables,
      ).orderBy('number'),
      query?.cursor,
    )
      .limit(limit + 1)
      .get();
    return pageFromSnapshot<Table>(snapshot, limit);
  }

  async save(table: Table): Promise<void> {
    await scopedCollection(
      this.firestore,
      table.clubId,
      FIRESTORE_COLLECTIONS.tables,
    )
      .doc(table.id)
      .set(table, { merge: true });
  }

  async saveIfVersion(table: Table, expectedVersion: number): Promise<void> {
    const reference = scopedCollection(
      this.firestore,
      table.clubId,
      FIRESTORE_COLLECTIONS.tables,
    ).doc(table.id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.data() as Table | undefined;
      if ((current?.version ?? 0) !== expectedVersion) {
        throw new Error('STALE_VERSION');
      }
      transaction.set(
        reference,
        { ...table, version: expectedVersion + 1 },
        { merge: true },
      );
    });
  }
}

export class FirestoreTableSessionRepository implements TableSessionRepository {
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string, sessionId: string): Promise<TableSession | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.tableSessions,
    )
      .doc(sessionId)
      .get();
    const data = document.data();
    return isDeleted(data)
      ? null
      : documentWithId<TableSession>(document.id, data);
  }

  async getActiveForTable(
    clubId: string,
    tableId: string,
  ): Promise<TableSession | null> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.tableSessions,
    )
      .where('tableId', '==', tableId)
      .where('status', 'in', [
        'created',
        'active',
        'splitting-bill',
        'awaiting-payment',
        'payment-pending',
      ])
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    const data = document?.data();
    return document && !isDeleted(data)
      ? documentWithId<TableSession>(document.id, data)
      : null;
  }

  async save(session: TableSession): Promise<void> {
    await scopedCollection(
      this.firestore,
      session.clubId,
      FIRESTORE_COLLECTIONS.tableSessions,
    )
      .doc(session.id)
      .set(session, { merge: true });
  }

  async saveIfVersion(session: TableSession, expectedVersion: number): Promise<void> {
    const reference = scopedCollection(
      this.firestore,
      session.clubId,
      FIRESTORE_COLLECTIONS.tableSessions,
    ).doc(session.id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.data() as TableSession | undefined;
      if ((current?.version ?? 0) !== expectedVersion) {
        throw new Error('STALE_VERSION');
      }
      transaction.set(
        reference,
        { ...session, version: expectedVersion + 1 },
        { merge: true },
      );
    });
  }

  async createOwnerSession(input: {
    table: Table;
    session: TableSession;
    customerSession: CustomerSession;
    now: string;
  }): Promise<void> {
    const tableCollection = scopedCollection(
      this.firestore,
      input.table.clubId,
      FIRESTORE_COLLECTIONS.tables,
    );
    const sessionCollection = scopedCollection(
      this.firestore,
      input.table.clubId,
      FIRESTORE_COLLECTIONS.tableSessions,
    );
    const customerSessionCollection = scopedCollection(
      this.firestore,
      input.table.clubId,
      FIRESTORE_COLLECTIONS.customerSessions,
    );
    await this.firestore.runTransaction(async (transaction: Transaction) => {
      const tableReference = tableCollection.doc(input.table.id);
      const tableSnapshot = await transaction.get(tableReference);
      const currentTable = tableSnapshot.data() as Table | undefined;
      if (!currentTable || currentTable.activeSessionId) {
        throw new Error('TABLE_SESSION_OWNER_EXISTS');
      }
      const activeSnapshot = await transaction.get(
        sessionCollection
          .where('tableId', '==', input.table.id)
          .where('status', 'in', [
            'created',
            'active',
            'splitting-bill',
            'awaiting-payment',
            'payment-pending',
          ])
          .limit(1),
      );
      if (!activeSnapshot.empty) {
        throw new Error('TABLE_SESSION_OWNER_EXISTS');
      }
      transaction.set(tableReference, {
        ...currentTable,
        status: 'occupied',
        activeSessionId: input.session.id,
        updatedAt: input.now,
      });
      transaction.set(sessionCollection.doc(input.session.id), input.session);
      transaction.set(
        customerSessionCollection.doc(input.customerSession.id),
        input.customerSession,
      );
    });
  }

  async createParticipantSession(input: {
    session: TableSession;
    customerSession: CustomerSession;
    maximumContributors: number;
    now: string;
  }): Promise<void> {
    const sessionReference = scopedCollection(
      this.firestore,
      input.session.clubId,
      FIRESTORE_COLLECTIONS.tableSessions,
    ).doc(input.session.id);
    const customerSessionCollection = scopedCollection(
      this.firestore,
      input.session.clubId,
      FIRESTORE_COLLECTIONS.customerSessions,
    );
    await this.firestore.runTransaction(async (transaction: Transaction) => {
      const sessionSnapshot = await transaction.get(sessionReference);
      const currentSession = sessionSnapshot.data() as TableSession | undefined;
      if (
        !currentSession ||
        currentSession.status !== 'active' ||
        new Date(currentSession.expiresAt).getTime() <= new Date(input.now).getTime()
      ) {
        throw new Error('TABLE_SESSION_NOT_ACTIVE');
      }
      const participantSnapshot = await transaction.get(
        customerSessionCollection
          .where('tableSessionId', '==', input.session.id),
      );
      const activeParticipantCount = participantSnapshot.docs.filter((document) => {
        const data = document.data() as CustomerSession;
        return !data.expiredAt;
      }).length;
      if (activeParticipantCount >= input.maximumContributors) {
        throw new Error('TABLE_SESSION_CONTRIBUTOR_LIMIT');
      }
      transaction.set(
        customerSessionCollection.doc(input.customerSession.id),
        input.customerSession,
      );
      transaction.set(
        sessionReference,
        { lastActivityAt: input.now },
        { merge: true },
      );
    });
  }
}

export class FirestoreCustomerSessionRepository
  implements CustomerSessionRepository
{
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string, sessionId: string): Promise<CustomerSession | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.customerSessions,
    )
      .doc(sessionId)
      .get();
    const data = document.data();
    return isDeleted(data)
      ? null
      : documentWithId<CustomerSession>(document.id, data);
  }

  async getByDeviceId(
    clubId: string,
    tableSessionId: string,
    deviceId: string,
  ): Promise<CustomerSession | null> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.customerSessions,
    )
      .where('tableSessionId', '==', tableSessionId)
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    const data = document?.data();
    return document && !isDeleted(data)
      ? documentWithId<CustomerSession>(document.id, data)
      : null;
  }

  async save(session: CustomerSession): Promise<void> {
    await scopedCollection(
      this.firestore,
      session.clubId,
      FIRESTORE_COLLECTIONS.customerSessions,
    )
      .doc(session.id)
      .set(session, { merge: true });
  }

  async expire(
    clubId: string,
    sessionId: string,
    expiredAt: string,
  ): Promise<void> {
    await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.customerSessions,
    )
      .doc(sessionId)
      .set({ expiredAt, expiresAt: expiredAt }, { merge: true });
  }
}

export class FirestoreSettingsRepository implements SettingsRepository {
  constructor(private readonly firestore: Firestore) {}

  async get(clubId: string): Promise<ClubSettings> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.settings,
    )
      .doc('current')
      .get();
    const settings = document.data();
    if (!settings) {
      throw new Error(`Club settings are not configured for club "${clubId}".`);
    }
    return { ...settings, clubId } as ClubSettings;
  }

  async save(settings: ClubSettings): Promise<void> {
    await scopedCollection(
      this.firestore,
      settings.clubId,
      FIRESTORE_COLLECTIONS.settings,
    )
      .doc('current')
      .set(settings, { merge: true });
  }

  async saveIfVersion(settings: ClubSettings, expectedVersion: number): Promise<void> {
    const reference = scopedCollection(
      this.firestore,
      settings.clubId,
      FIRESTORE_COLLECTIONS.settings,
    ).doc('current');
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.data() as ClubSettings | undefined;
      if ((current?.version ?? 0) !== expectedVersion) {
        throw new Error('STALE_VERSION');
      }
      transaction.set(
        reference,
        {
          ...settings,
          version: expectedVersion + 1,
        },
        { merge: true },
      );
    });
  }
}

export class FirestoreBusinessDayRepository implements BusinessDayRepository {
  constructor(private readonly firestore: Firestore) {}

  async getActive(clubId: string): Promise<BusinessDay | null> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.businessDays,
    )
      .where('status', '==', 'open')
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document ? documentWithId<BusinessDay>(document.id, document.data()) : null;
  }

  async save(day: BusinessDay): Promise<void> {
    await scopedCollection(
      this.firestore,
      day.clubId,
      FIRESTORE_COLLECTIONS.businessDays,
    )
      .doc(day.id)
      .set(day, { merge: true });
  }
}

export class FirestoreMenuCategoryRepository implements MenuCategoryRepository {
  constructor(private readonly firestore: Firestore) {}

  async listActive(clubId: string): Promise<MenuCategoryRecord[]> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.menuCategories,
    )
      .where('active', '==', true)
      .orderBy('sortOrder')
      .get();
    return snapshot.docs
      .map((document) => documentWithId<MenuCategoryRecord>(document.id, document.data()))
      .filter((category): category is MenuCategoryRecord => Boolean(category));
  }

  async getById(clubId: string, categoryId: string): Promise<MenuCategoryRecord | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.menuCategories,
    )
      .doc(categoryId)
      .get();
    return documentWithId<MenuCategoryRecord>(document.id, document.data());
  }

  async save(category: MenuCategoryRecord): Promise<void> {
    await scopedCollection(
      this.firestore,
      category.clubId,
      FIRESTORE_COLLECTIONS.menuCategories,
    )
      .doc(category.id)
      .set(category, { merge: true });
  }
}

export class FirestoreMenuItemRepository implements MenuItemRepository {
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string, menuItemId: string): Promise<MenuItem | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.menuItems,
    )
      .doc(menuItemId)
      .get();
    return documentWithId<MenuItem>(document.id, document.data());
  }

  async listAvailable(clubId: string): Promise<MenuItem[]> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.menuItems,
    )
      .where('available', '==', true)
      .orderBy('sortOrder')
      .get();
    return snapshot.docs
      .map((document) => documentWithId<MenuItem>(document.id, document.data()))
      .filter((item): item is MenuItem => Boolean(item));
  }

  async save(item: MenuItem): Promise<void> {
    await scopedCollection(
      this.firestore,
      item.clubId,
      FIRESTORE_COLLECTIONS.menuItems,
    )
      .doc(item.id)
      .set(item, { merge: true });
  }
}

export class FirestoreModifierRepository implements ModifierRepository {
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string, modifierId: string): Promise<MenuModifier | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.modifiers,
    )
      .doc(modifierId)
      .get();
    return documentWithId<MenuModifier>(document.id, document.data());
  }

  async listForMenuItem(clubId: string, menuItemId: string): Promise<MenuModifier[]> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.modifiers,
    )
      .where('menuItemIds', 'array-contains', menuItemId)
      .where('active', '==', true)
      .get();
    return snapshot.docs
      .map((document) => documentWithId<MenuModifier>(document.id, document.data()))
      .filter((modifier): modifier is MenuModifier => Boolean(modifier));
  }

  async getOption(clubId: string, optionId: string): Promise<ModifierOption | null> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.modifiers,
    )
      .where('optionIds', 'array-contains', optionId)
      .limit(1)
      .get();
    const modifier = snapshot.docs[0]?.data() as MenuModifier | undefined;
    const option = modifier?.options?.find(
      (candidate) => candidate.id === optionId,
    );
    return option ?? null;
  }

  async saveModifier(modifier: MenuModifier): Promise<void> {
    await scopedCollection(
      this.firestore,
      modifier.clubId,
      FIRESTORE_COLLECTIONS.modifiers,
    )
      .doc(modifier.id)
      .set(modifier, { merge: true });
  }

  async saveOption(option: ModifierOption): Promise<void> {
    const reference = scopedCollection(
      this.firestore,
      option.clubId,
      FIRESTORE_COLLECTIONS.modifiers,
    ).doc(option.modifierId);
    const current = await reference.get();
    const modifier = current.data() as MenuModifier | undefined;
    const options = (modifier?.options ?? []).filter((candidate) => candidate.id !== option.id);
    await reference.set(
      {
        options: [...options, option],
      },
      { merge: true },
    );
  }
}

export class FirestoreOrderRepository implements OrderRepository {
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string, orderId: string): Promise<Order | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.orders,
    )
      .doc(orderId)
      .get();
    return documentWithId<Order>(document.id, document.data());
  }

  async save(order: Order, items: OrderItem[]): Promise<void> {
    const batch = this.firestore.batch();
    const orderReference = scopedCollection(
      this.firestore,
      order.clubId,
      FIRESTORE_COLLECTIONS.orders,
    ).doc(order.id);
    batch.set(orderReference, order, { merge: true });
    for (const item of items) {
      batch.set(
        scopedCollection(
          this.firestore,
          order.clubId,
          FIRESTORE_COLLECTIONS.orderItems,
        ).doc(item.id),
        item,
        { merge: true },
      );
    }
    await batch.commit();
  }

  async saveIfVersion(
    order: Order,
    items: OrderItem[],
    expectedVersion: number,
  ): Promise<void> {
    const orderReference = scopedCollection(
      this.firestore,
      order.clubId,
      FIRESTORE_COLLECTIONS.orders,
    ).doc(order.id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderReference);
      const current = snapshot.data() as Order | undefined;
      if ((current?.version ?? 0) !== expectedVersion) {
        throw new Error('STALE_VERSION');
      }
      transaction.set(
        orderReference,
        { ...order, version: expectedVersion + 1 },
        { merge: true },
      );
      for (const item of items) {
        transaction.set(
          scopedCollection(
            this.firestore,
            order.clubId,
            FIRESTORE_COLLECTIONS.orderItems,
          ).doc(item.id),
          item,
          { merge: true },
        );
      }
    });
  }

  async findByIdempotencyKey(
    clubId: string,
    tableSessionId: string,
    customerSessionId: string,
    idempotencyKey: string,
  ): Promise<Order | null> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.orders,
    )
      .where('tableSessionId', '==', tableSessionId)
      .where('customerSessionId', '==', customerSessionId)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document
      ? documentWithId<Order>(document.id, document.data())
      : null;
  }

  async listForSession(clubId: string, tableSessionId: string): Promise<Page<Order>> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.orders,
    )
      .where('tableSessionId', '==', tableSessionId)
      .orderBy('createdAt', 'desc')
      .get();
    return pageFromSnapshot<Order>(snapshot, 100);
  }

  async listForCustomerSession(
    clubId: string,
    tableSessionId: string,
    customerSessionId: string,
  ): Promise<Page<Order>> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.orders,
    )
      .where('tableSessionId', '==', tableSessionId)
      .where('customerSessionId', '==', customerSessionId)
      .orderBy('createdAt', 'desc')
      .get();
    return pageFromSnapshot<Order>(snapshot, 100);
  }

  async listItems(clubId: string, orderId: string): Promise<OrderItem[]> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.orderItems,
    )
      .where('orderId', '==', orderId)
      .get();
    return snapshot.docs
      .map((document) => documentWithId<OrderItem>(document.id, document.data()))
      .filter((item): item is OrderItem => Boolean(item));
  }
}

export class FirestoreOrderItemRepository implements OrderItemRepository {
  constructor(private readonly firestore: Firestore) {}

  async listForOrder(clubId: string, orderId: string): Promise<OrderItem[]> {
    return new FirestoreOrderRepository(this.firestore).listItems(clubId, orderId);
  }

  async save(item: OrderItem): Promise<void> {
    await scopedCollection(
      this.firestore,
      item.clubId ?? '',
      FIRESTORE_COLLECTIONS.orderItems,
    )
      .doc(item.id)
      .set(item, { merge: true });
  }
}

export class FirestoreInventoryRepository implements InventoryRepository {
  constructor(private readonly firestore: Firestore) {}

  async getItem(clubId: string, inventoryItemId: string): Promise<InventoryItem | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.inventoryItems,
    )
      .doc(inventoryItemId)
      .get();
    return documentWithId<InventoryItem>(document.id, document.data());
  }

  async listItems(clubId: string): Promise<Page<InventoryItem>> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.inventoryItems,
    ).get();
    return pageFromSnapshot<InventoryItem>(snapshot, 100);
  }

  async appendTransaction(transaction: import('@workspace/domain').InventoryTransaction): Promise<void> {
    await scopedCollection(
      this.firestore,
      transaction.clubId,
      FIRESTORE_COLLECTIONS.inventoryTransactions,
    )
      .doc(transaction.id)
      .create(transaction);
  }

  async listTransactions(
    clubId: string,
    inventoryItemId: string,
    query?: DomainPageQuery,
  ): Promise<Page<import('@workspace/domain').InventoryTransaction>> {
    const snapshot = await applyCursor(
      scopedCollection(
        this.firestore,
        clubId,
        FIRESTORE_COLLECTIONS.inventoryTransactions,
      )
        .where('inventoryItemId', '==', inventoryItemId)
        .orderBy('createdAt', 'desc'),
      query?.cursor,
    )
      .limit(limitFor(query) + 1)
      .get();
    return pageFromSnapshot(snapshot, limitFor(query));
  }
}

export class FirestoreInventoryReservationRepository
  implements InventoryReservationRepository
{
  constructor(private readonly firestore: Firestore) {}

  async reserve(input: {
    clubId: string;
    orderId: string;
    inventoryItemId: string;
    quantity: number;
    now: string;
  }): Promise<InventoryReservation> {
    const inventoryReference = scopedCollection(
      this.firestore,
      input.clubId,
      FIRESTORE_COLLECTIONS.inventoryItems,
    ).doc(input.inventoryItemId);
    const reservation = {
      id: `${input.orderId}:${input.inventoryItemId}`,
      clubId: input.clubId,
      orderId: input.orderId,
      inventoryItemId: input.inventoryItemId,
      quantity: input.quantity,
      status: 'reserved' as const,
      createdAt: input.now,
      version: 0,
      updatedAt: input.now,
    };
    const reservationReference = scopedCollection(
      this.firestore,
      input.clubId,
      FIRESTORE_COLLECTIONS.inventoryReservations,
    ).doc(reservation.id);
    await this.firestore.runTransaction(async (transaction) => {
      const [inventorySnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(inventoryReference),
        transaction.get(reservationReference),
      ]);
      if (reservationSnapshot.exists && reservationSnapshot.data()?.status === 'reserved') {
        return;
      }
      const inventory = inventorySnapshot.data() as InventoryItem | undefined;
      if (
        !inventory ||
        (inventory.quantityOnHand !== undefined &&
          inventory.quantityOnHand - (inventory.reservedQuantity ?? 0) < input.quantity)
      ) {
        throw new Error('ITEM_OUT_OF_STOCK');
      }
      transaction.set(
        inventoryReference,
        {
              reservedQuantity: (inventory.reservedQuantity ?? 0) + input.quantity,
          updatedAt: input.now,
          version: (inventory.version ?? 0) + 1,
        },
        { merge: true },
      );
      transaction.create(reservationReference, reservation);
    });
    return reservation;
  }

  async releaseForOrder(clubId: string, orderId: string, now: string): Promise<void> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.inventoryReservations,
    )
      .where('orderId', '==', orderId)
      .where('status', '==', 'reserved')
      .get();
    for (const document of snapshot.docs) {
      const reservation = document.data() as InventoryReservation;
      const inventoryReference = scopedCollection(
        this.firestore,
        clubId,
        FIRESTORE_COLLECTIONS.inventoryItems,
      ).doc(reservation.inventoryItemId);
      await this.firestore.runTransaction(async (transaction) => {
        const inventorySnapshot = await transaction.get(inventoryReference);
        const inventory = inventorySnapshot.data() as InventoryItem | undefined;
        if (inventory) {
          transaction.set(
            inventoryReference,
            {
              reservedQuantity: Math.max(
                0,
                (inventory.reservedQuantity ?? 0) - reservation.quantity,
              ),
              updatedAt: now,
              version: (inventory.version ?? 0) + 1,
            },
            { merge: true },
          );
        }
        transaction.set(
          document.ref,
          { status: 'released', releasedAt: now, updatedAt: now },
          { merge: true },
        );
      });
    }
  }

  async listForOrder(clubId: string, orderId: string): Promise<InventoryReservation[]> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.inventoryReservations,
    )
      .where('orderId', '==', orderId)
      .get();
    return snapshot.docs
      .map((document) => documentWithId<InventoryReservation>(document.id, document.data()))
      .filter((reservation): reservation is InventoryReservation => Boolean(reservation));
  }
}

export class FirestoreNotificationRepository implements NotificationRepository {
  constructor(private readonly firestore: Firestore) {}

  async save(notification: Notification): Promise<void> {
    await scopedCollection(
      this.firestore,
      notification.clubId,
      FIRESTORE_COLLECTIONS.notifications,
    )
      .doc(notification.id)
      .create(notification)
      .catch(async (error: unknown) => {
        if ((error as { code?: number }).code === 6) return;
        throw error;
      });
  }

  async listForRecipient(
    clubId: string,
    recipientId: string,
    query?: DomainPageQuery,
  ): Promise<Page<Notification>> {
    const limit = limitFor(query);
    const snapshot = await applyCursor(
      scopedCollection(
        this.firestore,
        clubId,
        FIRESTORE_COLLECTIONS.notifications,
      )
        .where('recipientId', '==', recipientId)
        .orderBy('createdAt', 'desc'),
      query?.cursor,
    )
      .limit(limit + 1)
      .get();
    return pageFromSnapshot<Notification>(snapshot, limit);
  }

  async markRead(clubId: string, notificationId: string, readAt: string): Promise<void> {
    await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.notifications,
    )
      .doc(notificationId)
      .set({ readAt }, { merge: true });
  }

  async markDelivered(
    clubId: string,
    notificationId: string,
    deliveredAt: string,
  ): Promise<void> {
    await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.notifications,
    )
      .doc(notificationId)
      .set({ deliveredAt }, { merge: true });
  }

  async archive(
    clubId: string,
    notificationId: string,
    archivedAt: string,
  ): Promise<void> {
    await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.notifications,
    )
      .doc(notificationId)
      .set({ archivedAt }, { merge: true });
  }
}

export class FirestoreServiceTimelineRepository
  implements ServiceTimelineRepository
{
  constructor(private readonly firestore: Firestore) {}

  async append(event: ServiceTimelineEvent): Promise<void> {
    await scopedCollection(
      this.firestore,
      event.clubId,
      FIRESTORE_COLLECTIONS.serviceTimeline,
    )
      .doc(event.id)
      .create(event)
      .catch(async (error: unknown) => {
        if ((error as { code?: number }).code === 6) return;
        throw error;
      });
  }

  async listForSession(
    clubId: string,
    tableSessionId: string,
    query?: DomainPageQuery,
  ): Promise<Page<ServiceTimelineEvent>> {
    const limit = limitFor(query);
    const snapshot = await applyCursor(
      scopedCollection(
        this.firestore,
        clubId,
        FIRESTORE_COLLECTIONS.serviceTimeline,
      )
        .where('tableSessionId', '==', tableSessionId)
        .orderBy('occurredAt', 'asc'),
      query?.cursor,
    )
      .limit(limit + 1)
      .get();
    return pageFromSnapshot<ServiceTimelineEvent>(snapshot, limit);
  }
}

export class FirestoreAuditRepository implements AuditRepository {
  constructor(private readonly firestore: Firestore) {}

  async append(log: AuditLog): Promise<void> {
    await scopedCollection(
      this.firestore,
      log.clubId,
      FIRESTORE_COLLECTIONS.auditLogs,
    )
      .doc(log.id)
      .create(log)
      .catch(async (error: unknown) => {
        if ((error as { code?: number }).code === 6) return;
        throw error;
      });
  }

  async list(clubId: string, query?: DomainPageQuery): Promise<Page<AuditLog>> {
    const limit = limitFor(query);
    const snapshot = await applyCursor(
      scopedCollection(
        this.firestore,
        clubId,
        FIRESTORE_COLLECTIONS.auditLogs,
      ).orderBy('createdAt', 'desc'),
      query?.cursor,
    )
      .limit(limit + 1)
      .get();
    return pageFromSnapshot<AuditLog>(snapshot, limit);
  }
}

export class FirestoreRealtimeRepository implements RealtimeRepository {
  constructor(private readonly firestore: Firestore) {}

  private subscribe(
    query: FirebaseFirestore.Query,
    listener: (change: RealtimeChange<Record<string, unknown>>) => void,
  ): RealtimeSubscription {
    const unsubscribe = query.onSnapshot((snapshot) => {
      for (const change of snapshot.docChanges()) {
        const data = change.doc.data();
        if (isDeleted(data)) continue;
        listener({
          type: change.type,
          value: { id: change.doc.id, ...data },
        });
      }
    });
    return { unsubscribe };
  }

  subscribeToSessions(
    clubId: string,
    listener: Parameters<RealtimeRepository['subscribeToSessions']>[1],
  ): RealtimeSubscription {
    return this.subscribe(
      scopedCollection(this.firestore, clubId, FIRESTORE_COLLECTIONS.tableSessions),
      listener,
    );
  }

  subscribeToOrders(
    clubId: string,
    listener: Parameters<RealtimeRepository['subscribeToOrders']>[1],
  ): RealtimeSubscription {
    return this.subscribe(
      scopedCollection(this.firestore, clubId, FIRESTORE_COLLECTIONS.orders),
      listener,
    );
  }

  subscribeToNotifications(
    clubId: string,
    recipientId: string,
    listener: Parameters<RealtimeRepository['subscribeToNotifications']>[2],
  ): RealtimeSubscription {
    return this.subscribe(
      scopedCollection(
        this.firestore,
        clubId,
        FIRESTORE_COLLECTIONS.notifications,
      ).where('recipientId', '==', recipientId),
      listener,
    );
  }

  subscribeToInventory(
    clubId: string,
    listener: Parameters<RealtimeRepository['subscribeToInventory']>[1],
  ): RealtimeSubscription {
    return this.subscribe(
      scopedCollection(this.firestore, clubId, FIRESTORE_COLLECTIONS.inventoryItems),
      listener,
    );
  }

  subscribeToDJQueue(
    clubId: string,
    listener: Parameters<RealtimeRepository['subscribeToDJQueue']>[1],
  ): RealtimeSubscription {
    return this.subscribe(
      scopedCollection(this.firestore, clubId, FIRESTORE_COLLECTIONS.songRequests)
        .where('status', 'in', ['queued', 'playing']),
      listener,
    );
  }
}

export class FirestoreOfflineQueue implements OfflineQueue {
  constructor(private readonly firestore: Firestore) {}

  private collection(clubId: string) {
    return scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.offlineQueue,
    );
  }

  async enqueue(item: SyncQueueItem): Promise<void> {
    await this.collection(item.clubId)
      .doc(item.id)
      .create(item)
      .catch((error: unknown) => {
        if ((error as { code?: number }).code === 6) return;
        throw error;
      });
  }

  async listReady(clubId: string, now: string): Promise<SyncQueueItem[]> {
    const snapshot = await this.collection(clubId).get();
    return snapshot.docs
      .map((document) => documentWithId<SyncQueueItem>(document.id, document.data()))
      .filter(
        (item): item is SyncQueueItem =>
          Boolean(item && !item.completedAt && item.nextAttemptAt <= now),
      )
      .sort((left, right) =>
        left.nextAttemptAt.localeCompare(right.nextAttemptAt),
      );
  }

  async markRetry(
    clubId: string,
    id: string,
    nextAttemptAt: string,
    error: string,
  ): Promise<void> {
    const document = await this.collection(clubId).doc(id).get();
    if (!document.exists) return;
    const current = document.data() as SyncQueueItem;
    await document.ref.set(
      {
        attempts: current.attempts + 1,
        nextAttemptAt,
        lastError: error,
      },
      { merge: true },
    );
  }

  async markCompleted(
    clubId: string,
    id: string,
    completedAt: string,
  ): Promise<void> {
    const document = await this.collection(clubId).doc(id).get();
    if (!document.exists) return;
    await document.ref.set({ completedAt }, { merge: true });
  }
}

export class FirestoreStaffRepository implements StaffRepository {
  constructor(private readonly firestore: Firestore) {}

  async getByFirebaseUid(clubId: string, firebaseUid: string): Promise<Staff | null> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.staff,
    )
      .where('firebaseUid', '==', firebaseUid)
      .where('active', '==', true)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document ? documentWithId<Staff>(document.id, document.data()) : null;
  }
}

export class FirestoreRoleRepository implements RoleRepository {
  constructor(private readonly firestore: Firestore) {}

  async getById(clubId: string, roleId: string): Promise<Role | null> {
    const document = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.roles,
    )
      .doc(roleId)
      .get();
    return documentWithId<Role>(document.id, document.data());
  }

  async list(clubId: string): Promise<Role[]> {
    const snapshot = await scopedCollection(
      this.firestore,
      clubId,
      FIRESTORE_COLLECTIONS.roles,
    )
      .where('active', '==', true)
      .get();
    return snapshot.docs
      .map((document) => documentWithId<Role>(document.id, document.data()))
      .filter((role): role is Role => role !== null);
  }
}

export type Module2Repositories = Pick<
  RepositoryRegistry,
  | 'clubs'
  | 'tables'
  | 'tableSessions'
  | 'customerSessions'
  | 'staff'
  | 'roles'
  | 'notifications'
  | 'audit'
  | 'settings'
  | 'serviceTimeline'
  | 'businessDays'
   | 'realtime'
   | 'offlineQueue'
   | 'menu'
   | 'menuCategories'
   | 'menuItems'
   | 'modifiers'
   | 'orders'
   | 'orderItems'
   | 'inventory'
   | 'inventoryReservations'
>;

export function createModule2Repositories(firestore: Firestore): Module2Repositories {
  return {
    clubs: new FirestoreClubRepository(firestore),
    tables: new FirestoreTableRepository(firestore),
    tableSessions: new FirestoreTableSessionRepository(firestore),
    customerSessions: new FirestoreCustomerSessionRepository(firestore),
    staff: new FirestoreStaffRepository(firestore),
    roles: new FirestoreRoleRepository(firestore),
    notifications: new FirestoreNotificationRepository(firestore),
    audit: new FirestoreAuditRepository(firestore),
    settings: new FirestoreSettingsRepository(firestore),
    serviceTimeline: new FirestoreServiceTimelineRepository(firestore),
    businessDays: new FirestoreBusinessDayRepository(firestore),
    realtime: new FirestoreRealtimeRepository(firestore),
    offlineQueue: new FirestoreOfflineQueue(firestore),
    menuCategories: new FirestoreMenuCategoryRepository(firestore),
    menuItems: new FirestoreMenuItemRepository(firestore),
    menu: new FirestoreMenuItemRepository(firestore),
    modifiers: new FirestoreModifierRepository(firestore),
    orders: new FirestoreOrderRepository(firestore),
    orderItems: new FirestoreOrderItemRepository(firestore),
    inventory: new FirestoreInventoryRepository(firestore),
    inventoryReservations: new FirestoreInventoryReservationRepository(firestore),
  };
}