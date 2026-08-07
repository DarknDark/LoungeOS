import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateAdminRoleBody,
  CreateAdminStaffBody,
  UpdateAdminRoleBody,
  UpdateAdminStaffBody,
} from "@workspace/api-zod";
import {
  StaffAdministrationError,
} from "@workspace/application";
import { requireFirebaseStaff } from "../middlewares/firebase-staff";
import { getAdminStaffService } from "../lib/staff-administration";

const router: IRouter = Router();

function clubId(req: Request): string | undefined {
  const value = req.header("X-Club-Id")?.trim();
  return value || undefined;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof StaffAdministrationError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "The request is invalid." },
    });
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "The staff administration operation failed." },
  });
}

async function actorForRequest(
  req: Request,
  res: Response,
  requestedClubId: string,
) {
  const identity = res.locals.firebaseStaff;
  if (!identity) {
    res.status(401).json({
      error: { code: "STAFF_AUTH_REQUIRED", message: "A Firebase staff bearer token is required." },
    });
    return null;
  }
  const repositories = (await import("@workspace/infrastructure")).createModule2Repositories(
    (await import("@workspace/infrastructure")).createFirebaseInfrastructure().firestore,
  );
  const staff = await repositories.staff.getByFirebaseUid(
    requestedClubId,
    identity.firebaseUid,
  );
  if (!staff) {
    res.status(403).json({
      error: { code: "STAFF_NOT_FOUND", message: "Staff membership was not found." },
    });
    return null;
  }
  return {
    kind: "staff" as const,
    id: staff.id,
    staffId: staff.id,
    clubId: requestedClubId,
  };
}

function requireClub(req: Request, res: Response): string | null {
  const value = clubId(req);
  if (!value) {
    res.status(400).json({
      error: { code: "CLUB_ID_REQUIRED", message: "X-Club-Id is required." },
    });
    return null;
  }
  return value;
}

router.use(requireFirebaseStaff);

router.post("/v1/admin/staff", async (req, res) => {
  const requestedClubId = requireClub(req, res);
  if (!requestedClubId) return;
  try {
    const body = CreateAdminStaffBody.parse(req.body);
    const actor = await actorForRequest(req, res, requestedClubId);
    if (!actor) return;
    const staff = await getAdminStaffService().createStaff({
      actor,
      clubId: requestedClubId,
      staff: body,
    });
    res.status(201).json(staff);
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/v1/admin/staff/:staffId", async (req, res) => {
  const requestedClubId = requireClub(req, res);
  if (!requestedClubId) return;
  try {
    const body = UpdateAdminStaffBody.parse(req.body);
    const actor = await actorForRequest(req, res, requestedClubId);
    if (!actor) return;
    const staff = await getAdminStaffService().updateStaff({
      actor,
      clubId: requestedClubId,
      staffId: req.params.staffId,
      changes: body,
    });
    res.json(staff);
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/v1/admin/staff", async (req, res) => {
  const requestedClubId = requireClub(req, res);
  if (!requestedClubId) return;
  try {
    const actor = await actorForRequest(req, res, requestedClubId);
    if (!actor) return;
    res.json({ staff: await getAdminStaffService().listStaff({
      actor,
      clubId: requestedClubId,
    }) });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/v1/admin/roles", async (req, res) => {
  const requestedClubId = requireClub(req, res);
  if (!requestedClubId) return;
  try {
    const body = CreateAdminRoleBody.parse(req.body);
    const actor = await actorForRequest(req, res, requestedClubId);
    if (!actor) return;
    const role = await getAdminStaffService().createRole({
      actor,
      clubId: requestedClubId,
      role: body,
    });
    res.status(201).json(role);
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/v1/admin/roles/:roleId", async (req, res) => {
  const requestedClubId = requireClub(req, res);
  if (!requestedClubId) return;
  try {
    const body = UpdateAdminRoleBody.parse(req.body);
    const actor = await actorForRequest(req, res, requestedClubId);
    if (!actor) return;
    const role = await getAdminStaffService().updateRole({
      actor,
      clubId: requestedClubId,
      roleId: req.params.roleId,
      changes: body,
    });
    res.json(role);
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/v1/admin/roles", async (req, res) => {
  const requestedClubId = requireClub(req, res);
  if (!requestedClubId) return;
  try {
    const actor = await actorForRequest(req, res, requestedClubId);
    if (!actor) return;
    res.json({ roles: await getAdminStaffService().listRoles({
      actor,
      clubId: requestedClubId,
    }) });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;