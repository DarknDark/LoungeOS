import type { DomainEvent } from './events';
import type { EntityId } from './entities';
import type { ClubId, ISODateString } from './settings';

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

export type EventBus = {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): () => void;
};

export type ScheduledJob = {
  id: string;
  name: string;
  intervalMs: number;
  run(signal?: { aborted: boolean }): Promise<void>;
};

export type JobScheduler = {
  register(job: ScheduledJob): void;
  unregister(jobId: string): void;
  start(): void;
  stop(): void;
  runOnce(jobId: string, signal?: { aborted: boolean }): Promise<void>;
};

export type MetricPoint = {
  name: string;
  value: number;
  recordedAt: ISODateString;
  clubId?: ClubId;
  dimensions?: Record<string, string | number | boolean>;
};

export type MetricsCollector = {
  increment(
    name: string,
    value?: number,
    dimensions?: MetricPoint['dimensions'],
  ): Promise<void>;
  observe(
    name: string,
    value: number,
    dimensions?: MetricPoint['dimensions'],
  ): Promise<void>;
  snapshot(): Promise<MetricPoint[]>;
};

export type RealtimeChange<T> =
  | { type: 'added' | 'modified' | 'removed'; value: T };

export type RealtimeSubscription = { unsubscribe(): void };

export type RealtimeRepository = {
  subscribeToSessions(
    clubId: ClubId,
    listener: (change: RealtimeChange<Record<string, unknown>>) => void,
  ): RealtimeSubscription;
  subscribeToOrders(
    clubId: ClubId,
    listener: (change: RealtimeChange<Record<string, unknown>>) => void,
  ): RealtimeSubscription;
  subscribeToNotifications(
    clubId: ClubId,
    recipientId: EntityId,
    listener: (change: RealtimeChange<Record<string, unknown>>) => void,
  ): RealtimeSubscription;
  subscribeToInventory(
    clubId: ClubId,
    listener: (change: RealtimeChange<Record<string, unknown>>) => void,
  ): RealtimeSubscription;
  subscribeToDJQueue(
    clubId: ClubId,
    listener: (change: RealtimeChange<Record<string, unknown>>) => void,
  ): RealtimeSubscription;
};

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncQueueItem = {
  id: EntityId;
  clubId: ClubId;
  operation: SyncOperation;
  resourceType: string;
  resourceId: EntityId;
  payload: Record<string, unknown>;
  expectedVersion?: number;
  attempts: number;
  nextAttemptAt: ISODateString;
  lastError?: string;
  completedAt?: ISODateString;
};

export type OfflineQueue = {
  enqueue(item: SyncQueueItem): Promise<void>;
  listReady(clubId: ClubId, now: ISODateString): Promise<SyncQueueItem[]>;
  markRetry(
    clubId: ClubId,
    id: EntityId,
    nextAttemptAt: ISODateString,
    error: string,
  ): Promise<void>;
  markCompleted(clubId: ClubId, id: EntityId, completedAt: ISODateString): Promise<void>;
};