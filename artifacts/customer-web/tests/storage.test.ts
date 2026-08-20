import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

// customer-web's storage module reads window.localStorage, which doesn't
// exist under plain node:test (no DOM). A minimal in-memory polyfill is
// installed here before importing the module under test, matching the
// synchronous Storage interface (getItem/setItem/removeItem) the module
// actually uses — no jsdom/browser test runner is introduced, keeping this
// consistent with the rest of the workspace's node:test convention.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

(globalThis as { window?: unknown }).window = {
  localStorage: new MemoryStorage(),
};

const {
  readStoredSession,
  writeStoredSession,
  clearStoredSession,
  customerHeaders,
} = await import("../src/session/storage");

function memoryStorage(): MemoryStorage {
  return (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window
    .localStorage;
}

beforeEach(() => {
  memoryStorage().clear();
});

const sample = {
  clubId: "mamus-lounge",
  tableId: "table-1",
  tableSessionId: "table-session-1",
  customerSessionId: "customer-session-1",
  recoveryToken: "recovery-token-abc",
};

test("readStoredSession returns null when nothing is stored", () => {
  assert.equal(readStoredSession(), null);
});

test("writeStoredSession then readStoredSession round-trips the session", () => {
  writeStoredSession(sample);
  assert.deepEqual(readStoredSession(), sample);
});

test("clearStoredSession removes the stored session", () => {
  writeStoredSession(sample);
  clearStoredSession();
  assert.equal(readStoredSession(), null);
});

test("readStoredSession returns null for malformed JSON", () => {
  memoryStorage().setItem("loungeos.customer-session.v1", "{not json");
  assert.equal(readStoredSession(), null);
});

test("readStoredSession returns null when required fields are missing", () => {
  memoryStorage().setItem(
    "loungeos.customer-session.v1",
    JSON.stringify({ clubId: "mamus-lounge", tableId: "table-1" }),
  );
  assert.equal(readStoredSession(), null);
});

test("readStoredSession rejects a non-object value", () => {
  memoryStorage().setItem("loungeos.customer-session.v1", JSON.stringify("just a string"));
  assert.equal(readStoredSession(), null);
});

test("writeStoredSession overwrites a previously stored session", () => {
  writeStoredSession(sample);
  const next = { ...sample, tableSessionId: "table-session-2" };
  writeStoredSession(next);
  assert.deepEqual(readStoredSession(), next);
});

test("customerHeaders maps a stored session to the standard customer request headers", () => {
  const headers = customerHeaders(sample);
  assert.deepEqual(headers, {
    "X-Club-Id": "mamus-lounge",
    "X-Table-Session-Id": "table-session-1",
    "X-Customer-Session-Id": "customer-session-1",
    "X-Customer-Session-Token": "recovery-token-abc",
  });
});
