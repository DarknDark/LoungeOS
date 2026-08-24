import { Router, type IRouter, type Request, type Response } from "express";
import {
  createRealtimeProjectionService,
  type RealtimeProjection,
} from "@workspace/application";
import type { FirebaseStaffIdentity } from "@workspace/infrastructure";
import { requireFirebaseStaff } from "../middlewares/firebase-staff";
import { getModule3Repositories } from "../lib/module3";

const router: IRouter = Router();

function staffOperationsAllowed(
  staff: { roleIds: string[] },
  roles: Array<{ id: string; name: string; permissions: string[]; active: boolean }>,
): boolean {
  return staff.roleIds.some((roleId) => {
    const role = roles.find((candidate) => candidate.id === roleId);
    return Boolean(
      role &&
        role.active &&
        (role.name === "administrator" ||
          role.permissions.includes("tables.release") ||
          role.permissions.includes("settings.manage") ||
          role.permissions.includes("tickets.manage")),
    );
  });
}

async function authorizedStaff(
  req: Request,
  res: Response,
  clubId: string,
  identity: FirebaseStaffIdentity | undefined,
) {
  if (!identity) {
    res.status(401).json({
      error: {
        code: "STAFF_AUTH_REQUIRED",
        message: "A Firebase staff bearer token is required.",
      },
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
  ).filter(
    (role): role is NonNullable<typeof role> => Boolean(role && role.active),
  );
  if (!staffOperationsAllowed(staff, roles)) {
    res.status(403).json({
      error: { code: "PERMISSION_DENIED", message: "Table management is not permitted." },
    });
    return null;
  }

  return { staff, repositories };
}

function writeEvent(
  res: Response,
  event: "ready" | "projection",
  projection: RealtimeProjection,
): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(projection)}\n\n`);
}

router.get("/v1/staff/realtime", requireFirebaseStaff, async (req, res) => {
  const clubId = req.header("X-Club-Id")?.trim();
  if (!clubId) {
    res.status(400).json({
      error: { code: "CLUB_ID_REQUIRED", message: "X-Club-Id is required." },
    });
    return;
  }

  try {
    const context = await authorizedStaff(
      req,
      res,
      clubId,
      res.locals.firebaseStaff,
    );
    if (!context) return;

    const realtime = context.repositories.realtime;
    if (!realtime) {
      res.status(503).json({
        error: {
          code: "REALTIME_NOT_CONFIGURED",
          message: "Realtime synchronization is not configured.",
        },
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const projectionService = createRealtimeProjectionService(realtime);
    const subscription = projectionService.subscribe({
      clubId,
      recipientId: context.staff.id,
      listener: (projection) => writeEvent(res, "projection", projection),
    });
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(": keep-alive\n\n");
    }, 15_000);

    writeEvent(res, "ready", {
      resource: "table-sessions",
      type: "added",
    });

    req.on("close", () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
    });
  } catch {
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: "REALTIME_STREAM_FAILED",
          message: "The realtime stream could not be started.",
        },
      });
    } else {
      res.end();
    }
  }
});

export default router;