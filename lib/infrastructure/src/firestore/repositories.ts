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
  return data ? ({ id, ...data } as T) : null;
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
  };
}