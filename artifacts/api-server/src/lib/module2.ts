import { randomUUID } from "node:crypto";
import {
  createFirebaseInfrastructure,
  createModule2Repositories,
  createSecureToken,
  hashSecureToken,
} from "@workspace/infrastructure";
import {
  createTableSessionService,
  type TableSessionService,
} from "@workspace/application";

let tableSessions: TableSessionService | undefined;

export function getModule2TableSessionService(): TableSessionService {
  if (tableSessions) return tableSessions;

  const firebase = createFirebaseInfrastructure();
  tableSessions = createTableSessionService({
    repositories: createModule2Repositories(firebase.firestore),
    ids: { next: randomUUID },
    tokens: {
      next: createSecureToken,
      hash: hashSecureToken,
    },
  });
  return tableSessions;
}