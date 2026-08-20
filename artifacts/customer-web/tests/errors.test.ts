import assert from "node:assert/strict";
import { test } from "node:test";
import { apiErrorCode, apiErrorStatus } from "../src/api/errors";

function makeApiError(status: number, code: string, message: string) {
  return {
    name: "ApiError" as const,
    status,
    data: { error: { code, message } },
  };
}

test("apiErrorCode extracts the code from a well-formed ApiError-shaped object", () => {
  const error = makeApiError(404, "SESSION_NOT_FOUND", "The table session was not found.");
  assert.equal(apiErrorCode(error), "SESSION_NOT_FOUND");
});

test("apiErrorStatus extracts the HTTP status from a well-formed ApiError-shaped object", () => {
  const error = makeApiError(409, "SESSION_EXPIRED", "The table session has expired.");
  assert.equal(apiErrorStatus(error), 409);
});

test("apiErrorCode returns undefined for a plain Error", () => {
  assert.equal(apiErrorCode(new Error("network down")), undefined);
});

test("apiErrorCode returns undefined for a non-object value", () => {
  assert.equal(apiErrorCode("just a string"), undefined);
  assert.equal(apiErrorCode(null), undefined);
  assert.equal(apiErrorCode(undefined), undefined);
});

test("apiErrorCode returns undefined when the error has no data payload", () => {
  const error = { name: "ApiError" as const, status: 500, data: null };
  assert.equal(apiErrorCode(error), undefined);
});

test("apiErrorCode returns undefined for an object missing the ApiError name marker", () => {
  const error = { status: 401, data: { error: { code: "NOT_AUTHORIZED", message: "no" } } };
  assert.equal(apiErrorCode(error), undefined);
});
