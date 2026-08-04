import { randomUUID } from "node:crypto";
import {
  createFirebaseInfrastructure,
  createModule2Repositories,
  createSecureToken,
  hashSecureToken,
} from "@workspace/infrastructure";
import {
  createOrderService,
  InProcessEventBus,
  type OrderService,
} from "@workspace/application";

let orderService: OrderService | undefined;
let repositories: ReturnType<typeof createModule2Repositories> | undefined;

export function getModule3Repositories() {
  if (repositories) return repositories;
  const firebase = createFirebaseInfrastructure();
  repositories = createModule2Repositories(firebase.firestore);
  return repositories;
}

export function getModule3OrderService(): OrderService {
  if (orderService) return orderService;
  const eventBus = new InProcessEventBus();
  orderService = createOrderService({
    repositories: getModule3Repositories(),
    ids: { next: randomUUID },
    tokens: {
      hash: hashSecureToken,
    },
    events: eventBus,
  });
  return orderService;
}