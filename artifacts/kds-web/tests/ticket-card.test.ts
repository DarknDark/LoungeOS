import assert from "node:assert/strict";
import { test } from "node:test";
import { formatElapsed } from "../src/components/TicketCard";

test("formatElapsed formats seconds under a minute", () => {
  assert.equal(formatElapsed(45), "0:45");
});

test("formatElapsed formats whole minutes", () => {
  assert.equal(formatElapsed(120), "2:00");
});

test("formatElapsed pads single-digit seconds", () => {
  assert.equal(formatElapsed(65), "1:05");
});

test("formatElapsed formats zero", () => {
  assert.equal(formatElapsed(0), "0:00");
});

test("formatElapsed formats durations over an hour as minutes", () => {
  assert.equal(formatElapsed(3725), "62:05");
});
