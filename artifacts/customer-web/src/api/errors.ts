import type { ApiErrorResponse } from "@workspace/api-client-react";

// @workspace/api-client-react's ApiError class (custom-fetch.ts) is not
// re-exported from the package's public entry point, so errors thrown by
// the generated hooks are duck-typed here instead of using
// `instanceof ApiError`. This mirrors the shape set in custom-fetch.ts:
// `readonly name = "ApiError"`, `status: number`, `data: T | null`.
type LikeApiError = {
  name: "ApiError";
  status: number;
  data: ApiErrorResponse | null;
};

function isApiError(error: unknown): error is LikeApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "ApiError"
  );
}

/** The API's error code (e.g. "INVALID_QR", "SESSION_EXPIRED"), if present. */
export function apiErrorCode(error: unknown): string | undefined {
  if (!isApiError(error)) return undefined;
  return error.data?.error?.code;
}

export function apiErrorStatus(error: unknown): number | undefined {
  if (!isApiError(error)) return undefined;
  return error.status;
}
