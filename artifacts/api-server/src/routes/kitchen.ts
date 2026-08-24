import { Router, type IRouter, type Request, type Response } from "express";
import { ListStaffKitchenTicketsHeader, ListStaffKitchenTicketsQueryParams } from "@workspace/api-zod";
import {
  FirebaseConfigurationError,
  type FirebaseStaffIdentity,
} from "@workspace/infrastructure";
import { requireFirebaseStaff } from "../middlewares/firebase-staff";
import { getModule3Repositories } from "../lib/module3";

const router: IRouter = Router();

async function requireTicketsPermission(
  req: Request,
  res: Response,
  clubId: string,
  identity: FirebaseStaffIdentity | undefined,
): Promise<boolean> {
  if (!identity) {
    res.status(401).json({
      error: { code: "STAFF_AUTH_REQUIRED", message: "A Firebase staff bearer token is required." },
    });
    return false;
  }
  const repositories = getModule3Repositories();
  const staff = await repositories.staff.getByFirebaseUid(clubId, identity.firebaseUid);
  if (!staff) {
    res.status(403).json({
      error: { code: "STAFF_NOT_FOUND", message: "Staff membership was not found." },
    });
    return false;
  }
  const roles = (
    await Promise.all(staff.roleIds.map((roleId) => repositories.roles.getById(clubId, roleId)))
  ).filter((role): role is NonNullable<typeof role> => Boolean(role && role.active));
  const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
  if (
    !permissions.includes("tickets.manage") &&
    !roles.some((role) => role.name === "administrator")
  ) {
    res.status(403).json({
      error: { code: "PERMISSION_DENIED", message: "Kitchen ticket access is not permitted." },
    });
    return false;
  }
  return true;
}

router.get("/v1/staff/kitchen-tickets", requireFirebaseStaff, async (req, res) => {
  try {
    const headers = ListStaffKitchenTicketsHeader.parse({ "X-Club-Id": req.header("X-Club-Id") });
    const query = ListStaffKitchenTicketsQueryParams.parse(req.query);
    const clubId = headers["X-Club-Id"];
    const authorized = await requireTicketsPermission(req, res, clubId, res.locals.firebaseStaff);
    if (!authorized) return;
    const page = await getModule3Repositories().tickets.listForStation(clubId, query.stationId);
    res.json({ kitchenTickets: page.items });
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      res.status(503).json({
        error: {
          code: "FIREBASE_NOT_CONFIGURED",
          message: "Firebase is not configured for this environment.",
        },
      });
      return;
    }
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "The request was invalid." },
      });
      return;
    }
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "The kitchen tickets could not be listed." },
    });
  }
});

export default router;
