import type { AuditLog, AuditRepository } from '@workspace/domain';

export type AuditEngine = {
  record(log: AuditLog): Promise<void>;
};

export function createAuditService(repository: AuditRepository): AuditEngine {
  return {
    async record(log) {
      await repository.append({
        ...log,
        metadata: sanitizeMetadata(log.metadata),
      });
    },
  };
}

function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/secret|token|password|private.?key|authorization/i.test(key)) continue;
    if (typeof value === 'string' && value.length > 500) {
      result[key] = `${value.slice(0, 500)}…`;
    } else {
      result[key] = value;
    }
  }
  return result;
}