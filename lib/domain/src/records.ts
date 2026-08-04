import type { EntityId } from './entities';
import type { ISODateString } from './settings';

export type SoftDeleteFields = {
  deletedAt?: ISODateString;
  deletedBy?: EntityId;
  deletedReason?: string;
};

export type OptimisticLockFields = {
  version?: number;
  updatedAt?: ISODateString;
};

export type VersionedRecord = SoftDeleteFields & OptimisticLockFields;

export function isDeleted(record: SoftDeleteFields): boolean {
  return Boolean(record.deletedAt);
}

export function assertExpectedVersion(
  currentVersion: number | undefined,
  expectedVersion: number,
): void {
  const actualVersion = currentVersion ?? 0;
  if (actualVersion !== expectedVersion) {
    throw new Error('STALE_VERSION');
  }
}

export function nextVersion(record: OptimisticLockFields): number {
  return (record.version ?? 0) + 1;
}

export function softDelete(
  record: VersionedRecord,
  input: { deletedAt: ISODateString; deletedBy: EntityId; deletedReason?: string },
): VersionedRecord {
  return {
    ...record,
    ...input,
    updatedAt: input.deletedAt,
    version: nextVersion(record),
  };
}