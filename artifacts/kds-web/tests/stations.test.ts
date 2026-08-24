import assert from "node:assert/strict";
import { test } from "node:test";
import { STATIONS, findStation } from "../src/stations/stations";

test("STATIONS includes Kitchen and Bar", () => {
  assert.deepEqual(
    STATIONS.map((s) => s.id),
    ["kitchen", "bar"],
  );
});

test("findStation resolves a known station id", () => {
  assert.deepEqual(findStation("kitchen"), { id: "kitchen", name: "Kitchen" });
});

test("findStation returns undefined for an unknown station id", () => {
  assert.equal(findStation("unknown-station"), undefined);
});
