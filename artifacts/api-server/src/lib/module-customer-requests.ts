import { randomUUID } from "node:crypto";
import {
  createFirebaseInfrastructure,
  createModule2Repositories,
  hashSecureToken,
} from "@workspace/infrastructure";
import {
  createCustomerRequestService,
  type CustomerRequestService,
} from "@workspace/application";

let customerRequestService: CustomerRequestService | undefined;

export function getCustomerRequestService(): CustomerRequestService {
  if (customerRequestService) return customerRequestService;

  const firebase = createFirebaseInfrastructure();
  customerRequestService = createCustomerRequestService({
    repositories: createModule2Repositories(firebase.firestore),
    ids: { next: randomUUID },
    tokens: {
      hash: hashSecureToken,
    },
  });
  return customerRequestService;
}
