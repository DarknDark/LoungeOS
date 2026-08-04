import type { EntityId } from './entities';
import type { ClubId, ISODateString } from './settings';

export type DomainEvent = {
  id: EntityId;
  clubId: ClubId;
  occurredAt: ISODateString;
  actorId?: EntityId;
  sourceRecord?: { type: string; id: EntityId };
  type: string;
  data: Record<string, unknown>;
};

export type EventPublisher = {
  publish(event: DomainEvent): Promise<void>;
};