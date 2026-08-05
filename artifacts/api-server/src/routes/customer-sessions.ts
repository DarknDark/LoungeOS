import { Router, type IRouter, type RequestHandler } from "express";
import {
  CloseCustomerTableSessionParams,
  CreateCustomerTableSessionBody,
  GetCustomerTableSessionStatusParams,
  HeartbeatCustomerTableSessionBody,
  HeartbeatCustomerTableSessionParams,
  JoinCustomerTableSessionBody,
  JoinCustomerTableSessionParams,
  OpenCustomerTableSessionBody,
  EnableCustomerTableSessionSplitBody,
  RecoverCustomerTableSessionBody,
  ValidateCustomerTableBody,
  ValidateCustomerTableHeader,
  ValidateCustomerTableParams,
} from "@workspace/api-zod";
import {
  FirebaseConfigurationError,
  type FirebaseStaffIdentity,
} from "@workspace/infrastructure";
import { TableSessionError } from "@workspace/application";
import { requireFirebaseStaff } from "../middlewares/firebase-staff";
import { getModule2TableSessionService } from "../lib/module2";

const router: IRouter = Router();
const CUSTOMER_TOKEN_HEADER = "x-customer-session-token";
const CUSTOMER_ID_HEADER = "x-customer-session-id";

function now(): string {
  return new Date().toISOString();
}

function errorStatus(error: unknown): number {
  if (error instanceof FirebaseConfigurationError) return 503;
  if (!(error instanceof TableSessionError)) return 500;
  switch (error.code) {
    case "INVALID_QR":
    case "TABLE_NOT_FOUND":
    case "TABLE_NOT_AVAILABLE":
    case "CONFIGURATION_INVALID":
      return 400;
    case "SESSION_NOT_FOUND":
      return 404;
    case "OWNER_EXISTS":
    case "CONTRIBUTOR_LIMIT":
    case "SESSION_NOT_ACTIVE":
      return 409;
    case "SESSION_EXPIRED":
    case "SESSION_CLOSED":
    case "ACCESS_DENIED":
    case "CUSTOMER_SESSION_NOT_FOUND":
      return error.code === "ACCESS_DENIED" ? 401 : 409;
  }
  return 500;
}

function sendError(res: Parameters<RequestHandler>[1], error: unknown): void {
  const status = errorStatus(error);
  if (error instanceof FirebaseConfigurationError) {
    res.status(status).json({
      error: {
        code: "FIREBASE_NOT_CONFIGURED",
        message:
          "Firebase is not configured for this environment. Add the required Secrets before using live sessions.",
      },
    });
    return;
  }
  if (error instanceof TableSessionError) {
    res.status(status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "The session operation failed." },
  });
}

function headerValue(
  req: Parameters<RequestHandler>[0],
  name: string,
): string | undefined {
  const value = req.header(name)?.trim();
  return value || undefined;
}

function customerActor(
  req: Parameters<RequestHandler>[0],
  clubId: string,
  customerSessionId?: string,
) {
  return {
    kind: "customer" as const,
    clubId,
    customerSessionId: customerSessionId ?? headerValue(req, CUSTOMER_ID_HEADER),
    customerSessionToken: headerValue(req, CUSTOMER_TOKEN_HEADER),
  };
}

function responseBody(access: {
  tableSession: unknown;
  customerSession: unknown;
  recoveryToken: string;
}) {
  return {
    tableSession: access.tableSession,
    customerSession: access.customerSession,
    recoveryToken: access.recoveryToken,
  };
}

router.post(
  "/v1/customer/tables/:tableId/validate",
  async (req, res) => {
    const params = ValidateCustomerTableParams.parse(req.params);
    const headers = ValidateCustomerTableHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
    });
    const body = ValidateCustomerTableBody.parse(req.body);
    try {
      const table = await getModule2TableSessionService().validateQr({
        clubId: headers["X-Club-Id"],
        tableId: params.tableId,
        qrToken: body.qrToken,
        now: now(),
      });
      res.json({ table });
    } catch (error) {
      sendError(res, error);
    }
  },
);

router.post(
  "/v1/customer/tables/:tableId/open",
  async (req, res) => {
    const params = ValidateCustomerTableParams.parse(req.params);
    const body = OpenCustomerTableSessionBody.parse({
      clubId: req.body?.clubId,
      deviceId: req.body?.deviceId,
    });
    try {
      const access = await getModule2TableSessionService().open({
        actor: customerActor(req, body.clubId),
        tableId: params.tableId,
        deviceId: body.deviceId,
        now: now(),
      });
      res.status(201).json(responseBody(access));
    } catch (error) {
      sendError(res, error);
    }
  },
);

router.post("/v1/customer/table-sessions", async (req, res) => {
  const body = CreateCustomerTableSessionBody.parse(req.body);
  try {
    const access = await getModule2TableSessionService().createFromQr({
      actor: customerActor(req, body.clubId),
      tableId: body.tableId,
      qrToken: body.qrToken,
      deviceId: body.deviceId,
      now: now(),
    });
    res.status(201).json(responseBody(access));
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  "/v1/customer/table-sessions/:sessionId/join",
  async (req, res) => {
    const params = JoinCustomerTableSessionParams.parse(req.params);
    const body = JoinCustomerTableSessionBody.parse(req.body);
    try {
      const access = await getModule2TableSessionService().join({
        actor: customerActor(req, body.clubId),
        tableSessionId: params.sessionId,
        qrToken: body.qrToken,
        deviceId: body.deviceId,
        now: now(),
      });
      res.status(201).json(responseBody(access));
    } catch (error) {
      sendError(res, error);
    }
  },
);

router.post("/v1/customer/table-sessions/recover", async (req, res) => {
  const body = RecoverCustomerTableSessionBody.parse(req.body);
  try {
    const access = await getModule2TableSessionService().recover({
      actor: customerActor(req, body.clubId, body.customerSessionId),
      recoveryToken: body.recoveryToken,
      deviceId: body.deviceId,
      now: now(),
    });
    res.json(responseBody(access));
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  "/v1/customer/table-sessions/:sessionId/heartbeat",
  async (req, res) => {
    const params = HeartbeatCustomerTableSessionParams.parse(req.params);
    const body = HeartbeatCustomerTableSessionBody.parse(req.body);
    try {
      const access = await getModule2TableSessionService().heartbeat({
        actor: customerActor(req, body.clubId),
        tableSessionId: params.sessionId,
        customerSessionId: body.customerSessionId,
        now: now(),
      });
      res.json(responseBody(access));
    } catch (error) {
      sendError(res, error);
    }
  },
);

router.get(
  "/v1/customer/table-sessions/:sessionId",
  async (req, res) => {
    const params = GetCustomerTableSessionStatusParams.parse(req.params);
    const clubId = headerValue(req, "X-Club-Id");
    if (!clubId) {
      res.status(400).json({
        error: { code: "CLUB_ID_REQUIRED", message: "X-Club-Id is required." },
      });
      return;
    }
    try {
      const access = await getModule2TableSessionService().getStatus({
        actor: customerActor(req, clubId),
        tableSessionId: params.sessionId,
        now: now(),
      });
      res.json(responseBody(access));
    } catch (error) {
      sendError(res, error);
    }
  },
);

function hasClosePermission(
  identity: FirebaseStaffIdentity,
  staff: { id: string; roleIds: string[] },
  roles: Array<{ id: string; name: string; permissions: string[]; active: boolean }>,
): boolean {
  return staff.roleIds.some((roleId) => {
    const role = roles.find((candidate) => candidate.id === roleId);
    return Boolean(
      role &&
        role.active &&
        (role.name === "administrator" ||
          role.permissions.includes("tables.release") ||
          role.permissions.includes("payments.verify")),
    );
  }) && Boolean(identity.firebaseUid);
}

function hasTableManagementPermission(
  identity: FirebaseStaffIdentity,
  staff: { id: string; roleIds: string[] },
  roles: Array<{ id: string; name: string; permissions: string[]; active: boolean }>,
): boolean {
  return staff.roleIds.some((roleId) => {
    const role = roles.find((candidate) => candidate.id === roleId);
    return Boolean(
      role &&
        role.active &&
        (role.name === "administrator" ||
          role.permissions.includes("tables.release") ||
          role.permissions.includes("settings.manage")),
    );
  }) && Boolean(identity.firebaseUid);
}

router.delete(
  "/v1/customer/table-sessions/:sessionId",
  requireFirebaseStaff,
  async (req, res) => {
    const params = CloseCustomerTableSessionParams.parse(req.params);
    const clubId = headerValue(req, "X-Club-Id");
    const identity = res.locals.firebaseStaff;
    if (!clubId || !identity) {
      res.status(400).json({
        error: { code: "CLUB_ID_REQUIRED", message: "X-Club-Id is required." },
      });
      return;
    }
    try {
      const firebase = getModule2TableSessionService();
      const infrastructure = await import("@workspace/infrastructure");
      const clients = infrastructure.createFirebaseInfrastructure();
      const repositories = infrastructure.createModule2Repositories(clients.firestore);
      const staff = await repositories.staff.getByFirebaseUid(
        clubId,
        identity.firebaseUid,
      );
      if (!staff) {
        res.status(403).json({
          error: { code: "STAFF_NOT_FOUND", message: "Staff membership was not found." },
        });
        return;
      }
      const roles = (
        await Promise.all(
          staff.roleIds.map((roleId) => repositories.roles.getById(clubId, roleId)),
        )
      ).filter(
        (role): role is NonNullable<typeof role> => Boolean(role),
      );
      if (!hasClosePermission(identity, staff, roles)) {
        res.status(403).json({
          error: { code: "PERMISSION_DENIED", message: "Session closure is not permitted." },
        });
        return;
      }
      await getModule2TableSessionService().closeAfterVerifiedPayment({
        actor: {
          kind: "staff",
          id: staff.id,
          staffId: staff.id,
          clubId,
        },
        tableSessionId: params.sessionId,
        now: now(),
      });
      res.status(204).send();
    } catch (error) {
      sendError(res, error);
    }
  },
);

router.post(
  "/v1/customer/table-sessions/:sessionId/split",
  requireFirebaseStaff,
  async (req, res) => {
    const params = CloseCustomerTableSessionParams.parse(req.params);
    const clubId = headerValue(req, "X-Club-Id");
    const body = EnableCustomerTableSessionSplitBody.parse(req.body);
    const identity = res.locals.firebaseStaff;
    if (!clubId || !identity) {
      res.status(400).json({
        error: { code: "CLUB_ID_REQUIRED", message: "X-Club-Id is required." },
      });
      return;
    }
    try {
      const infrastructure = await import("@workspace/infrastructure");
      const clients = infrastructure.createFirebaseInfrastructure();
      const repositories = infrastructure.createModule2Repositories(clients.firestore);
      const staff = await repositories.staff.getByFirebaseUid(clubId, identity.firebaseUid);
      if (!staff) {
        res.status(403).json({
          error: { code: "STAFF_NOT_FOUND", message: "Staff membership was not found." },
        });
        return;
      }
      const roles = (
        await Promise.all(
          staff.roleIds.map((roleId) => repositories.roles.getById(clubId, roleId)),
        )
      ).filter(
        (role): role is NonNullable<typeof role> => Boolean(role),
      );
      if (!hasTableManagementPermission(identity, staff, roles)) {
        res.status(403).json({
          error: { code: "PERMISSION_DENIED", message: "Table management is not permitted." },
        });
        return;
      }
      await getModule2TableSessionService().enablePaymentSplit({
        actor: {
          kind: "staff",
          id: staff.id,
          staffId: staff.id,
          clubId,
        },
        tableSessionId: params.sessionId,
        splitCount: body.splitCount,
        now: now(),
      });
      res.status(204).send();
    } catch (error) {
      sendError(res, error);
    }
  },
);

export default router;