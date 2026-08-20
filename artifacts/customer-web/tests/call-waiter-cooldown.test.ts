import assert from "node:assert/strict";
import { test } from "node:test";
import {
  callWaiterSecondsRemaining,
  CALL_WAITER_COSMETIC_COOLDOWN_SECONDS,
} from "../src/lib/call-waiter-cooldown";

test("callWaiterSecondsRemaining returns the full window right after sending", () => {
  const sentAt = 1_000_000;
  assert.equal(
    callWaiterSecondsRemaining(sentAt, sentAt),
    CALL_WAITER_COSMETIC_COOLDOWN_SECONDS,
  );
});

test("callWaiterSecondsRemaining counts down as time passes", () => {
  const sentAt = 1_000_000;
  const thirtySecondsLater = sentAt + 30_000;
  assert.equal(
    callWaiterSecondsRemaining(sentAt, thirtySecondsLater),
    CALL_WAITER_COSMETIC_COOLDOWN_SECONDS - 30,
  );
});

test("callWaiterSecondsRemaining clamps to zero once the window has fully elapsed", () => {
  const sentAt = 1_000_000;
  const wayLater = sentAt + (CALL_WAITER_COSMETIC_COOLDOWN_SECONDS + 60) * 1000;
  assert.equal(callWaiterSecondsRemaining(sentAt, wayLater), 0);
});

test("callWaiterSecondsRemaining clamps to zero exactly at the window boundary", () => {
  const sentAt = 1_000_000;
  const atBoundary = sentAt + CALL_WAITER_COSMETIC_COOLDOWN_SECONDS * 1000;
  assert.equal(callWaiterSecondsRemaining(sentAt, atBoundary), 0);
});

test("callWaiterSecondsRemaining never goes negative even with a clock that appears to move backward", () => {
  const sentAt = 1_000_000;
  const earlier = sentAt - 5_000;
  assert.equal(callWaiterSecondsRemaining(sentAt, earlier), CALL_WAITER_COSMETIC_COOLDOWN_SECONDS);
});
