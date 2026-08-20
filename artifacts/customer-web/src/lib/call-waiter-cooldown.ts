// Cosmetic-only cooldown display for the Call Waiter button. The server
// (lib/application/src/customer-requests.ts, WAITER_CALL_COOLDOWN_MS) is
// the authoritative rate limit and always has the final say via a 429
// RATE_LIMITED response — this value only sets UI expectations and mirrors
// the server's window for a consistent experience. If the client's clock
// drifts or the cooldown is calculated slightly early, the button simply
// re-enables and, if pressed too soon, the server's error message is
// surfaced instead. See Checkpoint 3's approved decision: "Do not treat
// the frontend cooldown as authoritative; the server remains the source of
// truth."
export const CALL_WAITER_COSMETIC_COOLDOWN_SECONDS = 120;

/** Seconds remaining in the cosmetic cooldown window, clamped to >= 0. */
export function callWaiterSecondsRemaining(sentAtMs: number, nowMs: number): number {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - sentAtMs) / 1000));
  return Math.max(0, CALL_WAITER_COSMETIC_COOLDOWN_SECONDS - elapsedSeconds);
}
