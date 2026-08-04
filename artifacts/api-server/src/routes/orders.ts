import { Router, type IRouter, type Request, type Response } from "express";
import {
  CancelOrderBody,
  CancelOrderHeader,
  CancelOrderParams,
  CreateOrderBody,
  CreateOrderDraftBody,
  CreateOrderDraftHeader,
  CreateOrderHeader,
  GetOrderHeader,
  GetOrderParams,
  ListOrderMenuHeader,
  ListOrdersHeader,
  UpdateDraftOrderBody,
  UpdateDraftOrderHeader,
  UpdateDraftOrderParams,
  UpdateOrderStatusBody,
  UpdateOrderStatusHeader,
  UpdateOrderStatusParams,
} from "@workspace/api-zod";
import {
  FirebaseConfigurationError,
  type FirebaseStaffIdentity,
} from "@workspace/infrastructure";
import { OrderError } from "@workspace/application";
import { requireFirebaseStaff } from "../middlewares/firebase-staff";
import { getModule3OrderService, getModule3Repositories } from "../lib/module3";

const router: IRouter = Router();
const CUSTOMER_TOKEN_HEADER = "x-customer-session-token";

function header(req: Request, name: string): string | undefined {
  const value = req.header(name)?.trim();
  return value || undefined;
}

function now(): string {
  return new Date().toISOString();
}

function customerActor(req: Request, clubId: string, customerSessionId: string) {
  return {
    kind: "customer" as const,
    clubId,
    customerSessionId,
    customerSessionToken: header(req, CUSTOMER_TOKEN_HEADER),
  };
}

function orderErrorStatus(error: unknown): number {
  if (error instanceof FirebaseConfigurationError) return 503;
  if (error instanceof OrderError) return error.status;
  if (error instanceof Error && error.message === "STALE_VERSION") return 409;
  if (error instanceof Error && error.message === "ITEM_OUT_OF_STOCK") return 409;
  return 500;
}

function sendError(res: Response, error: unknown): void {
  const status = orderErrorStatus(error);
  if (error instanceof FirebaseConfigurationError) {
    res.status(status).json({
      error: {
        code: "FIREBASE_NOT_CONFIGURED",
        message: "Firebase is not configured for this environment.",
      },
    });
    return;
  }
  if (error instanceof OrderError) {
    res.status(status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof Error && error.message === "STALE_VERSION") {
    res.status(409).json({
      error: { code: "STALE_VERSION", message: "The order was changed by another staff member." },
    });
    return;
  }
  if (error instanceof Error && error.message === "ITEM_OUT_OF_STOCK") {
    res.status(409).json({
      error: { code: "ITEM_OUT_OF_STOCK", message: "The order cannot be accepted because stock is unavailable." },
    });
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "The order operation failed." },
  });
}

async function staffActor(
  req: Request,
  res: Response,
  clubId: string,
  identity: FirebaseStaffIdentity | undefined,
) {
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
    !permissions.includes("orders.manage") &&
    !roles.some((role) => role.name === "administrator")
  ) {
    res.status(403).json({
      error: { code: "PERMISSION_DENIED", message: "Order management is not permitted." },
    });
    return null;
  }
  return {
    kind: "staff" as const,
    id: staff.id,
    staffId: staff.id,
    clubId,
    role: roles.map((role) => role.name).join(","),
  };
}

router.get("/v1/orders/menu", async (req, res) => {
  try {
    const headers = ListOrderMenuHeader.parse({ "X-Club-Id": req.header("X-Club-Id") });
    res.json(await getModule3OrderService().getMenu({ clubId: headers["X-Club-Id"] }));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/v1/orders", async (req, res) => {
  try {
    const headers = ListOrdersHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Table-Session-Id": req.header("X-Table-Session-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    const orders = await getModule3OrderService().getForSession({
      actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
      tableSessionId: headers["X-Table-Session-Id"],
    });
    res.json({ orders });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/v1/orders", async (req, res) => {
  try {
    const headers = CreateOrderHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
      "Idempotency-Key": req.header("Idempotency-Key"),
    });
    const body = CreateOrderBody.parse(req.body);
    const result = await getModule3OrderService().create({
      actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
      tableSessionId: body.tableSessionId,
      items: body.items,
      notes: body.notes,
      idempotencyKey: headers["Idempotency-Key"],
      now: now(),
    });
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/v1/orders/drafts", async (req, res) => {
  try {
    const headers = CreateOrderDraftHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
      "Idempotency-Key": req.header("Idempotency-Key"),
    });
    const body = CreateOrderDraftBody.parse(req.body);
    const result = await getModule3OrderService().createDraft({
      actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
      tableSessionId: body.tableSessionId,
      items: body.items,
      notes: body.notes,
      idempotencyKey: headers["Idempotency-Key"],
      now: now(),
    });
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/v1/orders/:orderId", async (req, res) => {
  try {
    const params = GetOrderParams.parse(req.params);
    const headers = GetOrderHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    res.json(
      await getModule3OrderService().get({
        actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
        orderId: params.orderId,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/v1/orders/:orderId", async (req, res) => {
  try {
    const params = UpdateDraftOrderParams.parse(req.params);
    const headers = UpdateDraftOrderHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    const body = UpdateDraftOrderBody.parse(req.body);
    res.json(
      await getModule3OrderService().updateDraft({
        actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
        orderId: params.orderId,
        expectedVersion: body.version,
        items: body.items,
        notes: body.notes,
        now: now(),
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/v1/orders/:orderId/submit", async (req, res) => {
  try {
    const params = UpdateDraftOrderParams.parse(req.params);
    const headers = UpdateDraftOrderHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    const body = req.body as { version?: unknown };
    if (!Number.isInteger(body.version) || Number(body.version) < 0) {
      res.status(400).json({
        error: { code: "CONFIGURATION_INVALID", message: "A valid draft version is required." },
      });
      return;
    }
    res.json(
      await getModule3OrderService().submit({
        actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
        orderId: params.orderId,
        expectedVersion: Number(body.version),
        now: now(),
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.delete("/v1/orders/:orderId", async (req, res) => {
  try {
    const params = CancelOrderParams.parse(req.params);
    const headers = CancelOrderHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    const body = CancelOrderBody.parse(req.body ?? {});
    res.json(
      await getModule3OrderService().cancel({
        actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
        orderId: params.orderId,
        reason: body.reason,
        now: now(),
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  "/v1/orders/:orderId/status",
  requireFirebaseStaff,
  async (req, res) => {
    try {
      const params = UpdateOrderStatusParams.parse(req.params);
      const headers = UpdateOrderStatusHeader.parse({ "X-Club-Id": req.header("X-Club-Id") });
      const body = UpdateOrderStatusBody.parse(req.body);
      const actor = await staffActor(req, res, headers["X-Club-Id"], res.locals.firebaseStaff);
      if (!actor) return;
      res.json(
        await getModule3OrderService().updateStatus({
          actor,
          orderId: params.orderId,
          status: body.status,
          expectedVersion: body.version,
          reason: body.reason,
          now: now(),
        }),
      );
    } catch (error) {
      sendError(res, error);
    }
  },
);

export default router;