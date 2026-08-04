import type {
  ActivityFeedEntry,
  AnalyticsFact,
  AuditLog,
  Notification,
  ServiceTimelineEvent,
} from '@workspace/domain';
import type { RepositoryRegistry } from '@workspace/domain';
import type { DomainEvent } from '@workspace/domain';

export type OperationalProjectionPorts = Pick<
  RepositoryRegistry,
  'notifications' | 'audit' | 'analytics' | 'activityFeed' | 'serviceTimeline'
>;

export type ProjectionContext = {
  notification?: Notification;
  audit?: AuditLog;
  analytics?: AnalyticsFact;
  activityFeed?: ActivityFeedEntry;
  serviceTimeline?: ServiceTimelineEvent;
};

/**
 * Shared projection boundary used by application services.
 *
 * Individual business services decide which projections an event deserves.
 * This dispatcher keeps persistence ordering and provider access outside UI
 * code while remaining small enough to replace with an outbox later.
 */
export async function persistOperationalProjections(
  ports: OperationalProjectionPorts,
  projections: ProjectionContext,
): Promise<void> {
  if (projections.audit) await ports.audit.append(projections.audit);
  if (projections.analytics) await ports.analytics.appendFact(projections.analytics);
  if (projections.activityFeed) await ports.activityFeed.append(projections.activityFeed);
  if (projections.serviceTimeline) await ports.serviceTimeline.append(projections.serviceTimeline);
  if (projections.notification) await ports.notifications.save(projections.notification);
}

export type ProjectionFactory = (
  event: DomainEvent,
) => ProjectionContext | Promise<ProjectionContext>;