import { Router, type IRouter, type Request, type Response } from "express";
import {
  ListSongRequestsForSessionHeader,
  ListSongRequestsForSessionParams,
  SubmitSongRequestBody,
  SubmitSongRequestHeader,
  SubmitSongRequestParams,
} from "@workspace/api-zod";
import { FirebaseConfigurationError } from "@workspace/infrastructure";
import { DJError } from "@workspace/application";
import { getDJService } from "../lib/module-dj";

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

function djErrorStatus(error: unknown): number {
  if (error instanceof FirebaseConfigurationError) return 503;
  if (error instanceof DJError) return error.status;
  if (error instanceof Error && error.name === "ZodError") return 400;
  return 500;
}

function sendError(res: Response, error: unknown): void {
  const status = djErrorStatus(error);
  if (error instanceof FirebaseConfigurationError) {
    res.status(status).json({
      error: {
        code: "FIREBASE_NOT_CONFIGURED",
        message: "Firebase is not configured for this environment.",
      },
    });
    return;
  }
  if (error instanceof DJError) {
    res.status(status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "The song request operation failed." },
  });
}

router.post("/v1/customer/table-sessions/:sessionId/song-requests", async (req, res) => {
  try {
    const params = SubmitSongRequestParams.parse(req.params);
    const headers = SubmitSongRequestHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    const body = SubmitSongRequestBody.parse(req.body);
    const request = await getDJService().submitRequest({
      actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
      tableSessionId: params.sessionId,
      song: body.song,
      artist: body.artist,
      now: now(),
    });
    res.status(201).json(request);
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/v1/customer/table-sessions/:sessionId/song-requests", async (req, res) => {
  try {
    const params = ListSongRequestsForSessionParams.parse(req.params);
    const headers = ListSongRequestsForSessionHeader.parse({
      "X-Club-Id": req.header("X-Club-Id"),
      "X-Customer-Session-Id": req.header("X-Customer-Session-Id"),
      "X-Customer-Session-Token": req.header("X-Customer-Session-Token"),
    });
    const songRequests = await getDJService().listForSession({
      actor: customerActor(req, headers["X-Club-Id"], headers["X-Customer-Session-Id"]),
      tableSessionId: params.sessionId,
    });
    res.json({ songRequests });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
