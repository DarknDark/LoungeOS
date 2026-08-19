import { Router, type IRouter, type Request, type Response } from "express";
import { CallWaiterHeader, CallWaiterParams } from "@workspace/api-zod";
import { FirebaseConfigurationError } from "@workspace/infrastructure";
import { CustomerRequestError } from "@workspace/application";
import { getCustomerRequestService } from "../lib/module-customer-requests";

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

function customerRequestErrorStatus(error: unknown): number {
  if (error instanceof FirebaseConfigurationError) return 503;
  if (error instanceof CustomerRequestError) return error.status;
  if (error instanceof Error && error.name === "ZodError") return 400;
  return 500;
}

function sendError(res: Response, error: unknown): void {
  const status = customerRequestErrorStatus(error);
  if (error instanceof FirebaseConfigurationError) {
    res.status(status).json({
      error: {
        code: "FIREBASE_NOT_CONFIGURED",
        message: "Firebase is not configured for this environment.",
      },
    });
    return;
  }
  if (error instanceof CustomerRequestError) {
    res.status(status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "The waiter call could not be sent." },
  });
}

router.post("/v1/customer/table-sessions/:sessionId/call-waiter", async (req, res) => {
  try {
    const params = CallWaiterParams.parse(req.params);
    const headers = CallWaiterHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    const notification = await getCustomerRequestService().callWaiter({
      actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
      tableSessionId: params.sessionId,
      now: now(),
    });
    res.status(201).json(notification);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
