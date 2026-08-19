import { randomUUID } from "node:crypto";
import {
  createFirebaseInfrastructure,
  createModule2Repositories,
  hashSecureToken,
} from "@workspace/infrastructure";
import { createDJService, type DJService } from "@workspace/application";

let djService: DJService | undefined;

export function getDJService(): DJService {
  if (djService) return djService;

  const firebase = createFirebaseInfrastructure();
  djService = createDJService({
    repositories: createModule2Repositories(firebase.firestore),
    ids: { next: randomUUID },
    tokens: {
      hash: hashSecureToken,
    },
  });
  return djService;
}
