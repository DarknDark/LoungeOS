import { randomUUID } from "node:crypto";
import {
  createAdminStaffService,
  type AdminStaffService,
} from "@workspace/application";
import {
  createFirebaseInfrastructure,
  createModule2Repositories,
} from "@workspace/infrastructure";

let service: AdminStaffService | undefined;

export function getAdminStaffService(): AdminStaffService {
  if (service) return service;
  const firebase = createFirebaseInfrastructure();
  service = createAdminStaffService(
    createModule2Repositories(firebase.firestore),
    { next: randomUUID },
  );
  return service;
}