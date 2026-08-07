import type { RequestHandler } from "express";
import {
  extractBearerToken,
  FirebaseConfigurationError,
  verifyFirebaseStaffToken,
  type FirebaseStaffIdentity,
} from "@workspace/infrastructure/firebase";

export type FirebaseStaffLocals = {
  firebaseStaff?: FirebaseStaffIdentity;
};

/**
 * Server-side staff authentication boundary.
 *
 * This middleware verifies Firebase ID tokens only. It deliberately does not
 * infer LoungeOS membership, club scope, role, or permissions; those belong to
 * the application authorization service after staff lookup.
 */
export const requireFirebaseStaff: RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, string>,
  FirebaseStaffLocals
> = async (req, res, next) => {
  const bearerToken = extractBearerToken(req.header("authorization"));
  if (!bearerToken) {
    res.status(401).json({
      error: {
        code: "STAFF_AUTH_REQUIRED",
        message: "A Firebase staff bearer token is required.",
      },
    });
    return;
  }

  try {
    res.locals.firebaseStaff = await verifyFirebaseStaffToken(bearerToken);
    next();
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      res.status(503).json({
        error: {
          code: "FIREBASE_NOT_CONFIGURED",
          message:
            "Firebase Authentication is not configured for this environment.",
        },
      });
      return;
    }

    res.status(401).json({
      error: {
        code: "STAFF_AUTH_INVALID",
        message: "The Firebase staff token is invalid or expired.",
      },
    });
  }
};

/**
 * Optional variant for routes that support anonymous customer sessions and
 * authenticated staff actors. Invalid supplied tokens are still rejected.
 */
export const optionalFirebaseStaff: RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, string>,
  FirebaseStaffLocals
> = async (req, res, next) => {
  const bearerToken = extractBearerToken(req.header("authorization"));
  if (!bearerToken) {
    next();
    return;
  }

  try {
    res.locals.firebaseStaff = await verifyFirebaseStaffToken(bearerToken);
    next();
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      res.status(503).json({
        error: {
          code: "FIREBASE_NOT_CONFIGURED",
          message:
            "Firebase Authentication is not configured for this environment.",
        },
      });
      return;
    }

    res.status(401).json({
      error: {
        code: "STAFF_AUTH_INVALID",
        message: "The Firebase staff token is invalid or expired.",
      },
    });
  }
};