import { Router, type IRouter, type Request, type Response } from "express";
import {
  ListStaffKitchenTicketsHeader,
  ListStaffKitchenTicketsQueryParams,
  UpdateStaffKitchenTicketStatusBody,
  UpdateStaffKitchenTicketStatusHeader,
  UpdateStaffKitchenTicketStatusParams,
} from "@workspace/api-zod";
import {
  FirebaseConfigurationError,
  type FirebaseStaffIdentity,
} from "@workspace/infrastructure";
import { KitchenError, type RequestActor } from "@workspace/application";
import { requireFirebaseStaff } from "../middlewares/firebase-staff";
import { getModule3Repositories } from "../lib/module3";
import { getKitchenService } from "../lib/module-kitchen";

const router: IRouter = Router();

function now(): string {
  return new Date().toISOString();
}

/**
 * Resolves the Firebase-authenticated caller to a LoungeOS staff actor and
 * confirms they hold tickets.manage (or administrator). Returns null (and
 * has already written the error response) when access is denied.
 */
async function requireTicketsAccess(
  req: Request,
  res: Response,
  clubId: string,
  identity: FirebaseStaffIdentity | undefined,
): Promise<RequestActor | null> {
  if (!identity) {
    res.status(401).json({
      error: { code: "STAFF_AUTH_REQUIRED", message: "A Firebase staff bearer token is required." },
    });
    return null;
  }
  const repositories = getModule3Repositories();
  const staff = await repositories.staff.getByFirebaseUid(clubId, identity.firebaseUid);
  if (!staff) {
    res.status(403).json({
      error: { code: "STAFF_NOT_FOUND", message: "Staff membership was not found." },
    });
    return null;
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
    return null;
  }
  return {
    kind: "staff",
    id: staff.id,
    staffId: staff.id,
    clubId,
    role: roles.map((role) => role.name).join(","),
  };
}

function sendUnhandledError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof FirebaseConfigurationError) {
    res.status(503).json({
      error: {
        code: "FIREBASE_NOT_CONFIGURED",
        message: "Firebase is not configured for this environment.",
      },
    });
    return;
  }
  if (error instanceof KitchenError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "The request was invalid." },
    });
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: fallbackMessage } });
}

router.get("/v1/staff/kitchen-tickets", requireFirebaseStaff, async (req, res) => {
  try {
    const headers = ListStaffKitchenTicketsHeader.parse({ "X-Club-Id": req.header("X-Club-Id") });
    const query = ListStaffKitchenTicketsQueryParams.parse(req.query);
    const clubId = headers["X-Club-Id"];
    const actor = await requireTicketsAccess(req, res, clubId, res.locals.firebaseStaff);
    if (!actor) return;
    const page = await getModule3Repositories().tickets.listForStation(clubId, query.stationId);
    res.json({ kitchenTickets: page.items });
  } catch (error) {
    sendUnhandledError(res, error, "The kitchen tickets could not be listed.");
  }
});

router.post(
  "/v1/staff/kitchen-tickets/:ticketId/status",
  requireFirebaseStaff,
  async (req, res) => {
    try {
      const params = UpdateStaffKitchenTicketStatusParams.parse(req.params);
      const headers = UpdateStaffKitchenTicketStatusHeader.parse({
        "X-Club-Id": req.header("X-Club-Id"),
      });
      const body = UpdateStaffKitchenTicketStatusBody.parse(req.body);
      const clubId = headers["X-Club-Id"];
      const actor = await requireTicketsAccess(req, res, clubId, res.locals.firebaseStaff);
      if (!actor) return;
      const ticket = await getKitchenService().updateTicket({
        actor,
        ticketId: params.ticketId,
        status: body.status,
        now: now(),
      });
      res.json(ticket);
    } catch (error) {
      sendUnhandledError(res, error, "The kitchen ticket status could not be updated.");
    }
  },
);

export default router;
