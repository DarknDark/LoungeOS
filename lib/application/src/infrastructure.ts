import type {
  EventBus,
  EventHandler,
  JobScheduler,
  MetricsCollector,
  MetricPoint,
  ScheduledJob,
  OfflineQueue,
  SyncQueueItem,
} from '@workspace/domain';

type TimerHandle = {
  unref?: () => void;
};

type RuntimeTimers = {
  setInterval(callback: () => void, delay: number): TimerHandle;
  clearInterval(handle: TimerHandle): void;
};

export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  async publish(event: Parameters<EventHandler>[0]): Promise<void> {
    const handlers = [
      ...(this.handlers.get(event.type) ?? []),
      ...(this.handlers.get('*') ?? []),
    ];
    await Promise.all(handlers.map((handler) => handler(event)));
  }

  subscribe(eventType: string, handler: EventHandler): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);
    return () => handlers.delete(handler);
  }
}

export class InProcessJobScheduler implements JobScheduler {
  private readonly jobs = new Map<string, ScheduledJob>();
  private timer?: TimerHandle;

  register(job: ScheduledJob): void {
    if (job.intervalMs <= 0) throw new Error('JOB_INTERVAL_INVALID');
    this.jobs.set(job.id, job);
  }

  unregister(jobId: string): void {
    this.jobs.delete(jobId);
  }

  start(): void {
    if (this.timer) return;
    const timers = globalThis as unknown as RuntimeTimers;
    this.timer = timers.setInterval(() => {
      void Promise.all(
        [...this.jobs.values()].map((job) => job.run()),
      );
    }, 60_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      const timers = globalThis as unknown as RuntimeTimers;
      timers.clearInterval(this.timer);
    }
    this.timer = undefined;
  }

  async runOnce(jobId: string, signal?: { aborted: boolean }): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('JOB_NOT_FOUND');
    await job.run(signal);
  }
}

export class InProcessMetricsCollector implements MetricsCollector {
  private readonly points: MetricPoint[] = [];

  async increment(
    name: string,
    value = 1,
    dimensions?: MetricPoint['dimensions'],
  ): Promise<void> {
    await this.observe(name, value, dimensions);
  }

  async observe(
    name: string,
    value: number,
    dimensions?: MetricPoint['dimensions'],
  ): Promise<void> {
    this.points.push({
      name,
      value,
      recordedAt: new Date().toISOString(),
      ...(dimensions ? { dimensions } : {}),
    });
  }

  async snapshot(): Promise<MetricPoint[]> {
    return [...this.points];
  }
}

export class OfflineSyncCoordinator {
  constructor(
    private readonly queue: OfflineQueue,
    private readonly execute: (
      item: SyncQueueItem,
    ) => Promise<'completed' | 'conflict' | 'retry'>,
  ) {}

  async flush(clubId: string, now: string): Promise<void> {
    const items = await this.queue.listReady(clubId, now);
    for (const item of items) {
      try {
        const result = await this.execute(item);
        if (result === 'completed') {
          await this.queue.markCompleted(clubId, item.id, now);
        } else if (result === 'conflict') {
          await this.queue.markRetry(clubId, item.id, now, 'CONFLICT');
        } else {
          await this.queue.markRetry(clubId, item.id, now, 'RETRYABLE_FAILURE');
        }
      } catch (error) {
        await this.queue.markRetry(
          clubId,
          item.id,
          now,
          error instanceof Error ? error.message : 'SYNC_FAILED',
        );
      }
    }
  }
}

export type TimedOperation = {
  durationMs: number;
  result: 'success' | 'error';
};

export async function measure<T>(
  operation: () => Promise<T>,
  onComplete: (timing: TimedOperation) => Promise<void> | void,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    await onComplete({
      durationMs: Date.now() - startedAt,
      result: 'success',
    });
    return result;
  } catch (error) {
    await onComplete({
      durationMs: Date.now() - startedAt,
      result: 'error',
    });
    throw error;
  }
}