import assert from "node:assert/strict";
import { test } from "node:test";
import { orderStatusLabel } from "../src/lib/order-status";

test("orderStatusLabel maps each known OrderStatus to a customer-facing label", () => {
  assert.equal(orderStatusLabel("draft"), "Draft");
  assert.equal(orderStatusLabel("submitted"), "Pending");
  assert.equal(orderStatusLabel("accepted"), "Accepted");
  assert.equal(orderStatusLabel("preparing"), "Preparing");
  assert.equal(orderStatusLabel("ready"), "Ready");
  assert.equal(orderStatusLabel("delivered"), "Served");
  assert.equal(orderStatusLabel("cancelled"), "Cancelled");
});

test("orderStatusLabel falls back to the raw status for an unrecognized value", () => {
  // @ts-expect-error deliberately passing an out-of-union value to exercise the fallback
  assert.equal(orderStatusLabel("some-future-status"), "some-future-status");
});
