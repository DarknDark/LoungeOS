import {
  createFirebaseInfrastructure,
  createModule2Repositories,
} from "@workspace/infrastructure";
import { createKitchenService, type KitchenService } from "@workspace/application";

let kitchenService: KitchenService | undefined;

export function getKitchenService(): KitchenService {
  if (kitchenService) return kitchenService;

  const firebase = createFirebaseInfrastructure();
  kitchenService = createKitchenService({
    repositories: createModule2Repositories(firebase.firestore),
  });
  return kitchenService;
}
