import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProjectionFrames } from "../src/tickets/projection-frames";

test("parseProjectionFrames parses a single complete frame", () => {
  const buffer = 'event: projection\ndata: {"resource":"orders","type":"modified"}\n\n';
  const { projections, remainder } = parseProjectionFrames(buffer);
  assert.deepEqual(projections, [{ resource: "orders", type: "modified" }]);
  assert.equal(remainder, "");
});

test("parseProjectionFrames parses multiple complete frames in one buffer", () => {
  const buffer =
    'event: projection\ndata: {"resource":"orders","type":"added"}\n\n' +
    'event: projection\ndata: {"resource":"notifications","type":"modified"}\n\n';
  const { projections, remainder } = parseProjectionFrames(buffer);
  assert.deepEqual(projections, [
    { resource: "orders", type: "added" },
    { resource: "notifications", type: "modified" },
  ]);
  assert.equal(remainder, "");
});

test("parseProjectionFrames holds back an incomplete trailing frame as the remainder", () => {
  const buffer =
    'event: projection\ndata: {"resource":"orders","type":"added"}\n\n' +
    'event: projection\ndata: {"resource":"orders"';
  const { projections, remainder } = parseProjectionFrames(buffer);
  assert.deepEqual(projections, [{ resource: "orders", type: "added" }]);
  assert.equal(remainder, 'event: projection\ndata: {"resource":"orders"');
});

test("parseProjectionFrames ignores frames with an event name other than projection", () => {
  const buffer = 'event: heartbeat\ndata: {}\n\n';
  const { projections, remainder } = parseProjectionFrames(buffer);
  assert.deepEqual(projections, []);
  assert.equal(remainder, "");
});

test("parseProjectionFrames ignores malformed JSON without throwing", () => {
  const buffer = "event: projection\ndata: {not valid json\n\n";
  const { projections } = parseProjectionFrames(buffer);
  assert.deepEqual(projections, []);
});

test("parseProjectionFrames ignores a frame with no data line", () => {
  const buffer = "event: projection\n\n";
  const { projections } = parseProjectionFrames(buffer);
  assert.deepEqual(projections, []);
});

test("parseProjectionFrames handles an empty buffer", () => {
  const { projections, remainder } = parseProjectionFrames("");
  assert.deepEqual(projections, []);
  assert.equal(remainder, "");
});

test("parseProjectionFrames handles \\r\\n\\r\\n frame separators", () => {
  const buffer = 'event: projection\r\ndata: {"resource":"table-sessions","type":"removed"}\r\n\r\n';
  const { projections } = parseProjectionFrames(buffer);
  assert.deepEqual(projections, [{ resource: "table-sessions", type: "removed" }]);
});
