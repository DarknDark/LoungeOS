import type {
  ServiceTimelineEvent,
  ServiceTimelineRepository,
} from '@workspace/domain';

export type TimelineService = {
  append(event: ServiceTimelineEvent): Promise<void>;
};

export function createTimelineService(
  repository: ServiceTimelineRepository,
): TimelineService {
  return { append: (event) => repository.append(event) };
}