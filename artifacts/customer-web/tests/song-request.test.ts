import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeSongRequestInput,
  songRequestValidationMessage,
  validateSongRequestInput,
  SONG_REQUEST_FIELD_MAX_LENGTH,
} from "../src/lib/song-request";

test("validateSongRequestInput accepts valid input", () => {
  assert.equal(validateSongRequestInput("Sweet Caroline", "Neil Diamond"), null);
});

test("validateSongRequestInput rejects a blank song", () => {
  assert.equal(validateSongRequestInput("   ", "Neil Diamond"), "SONG_REQUIRED");
});

test("validateSongRequestInput rejects a blank artist", () => {
  assert.equal(validateSongRequestInput("Sweet Caroline", "   "), "ARTIST_REQUIRED");
});

test("validateSongRequestInput checks song emptiness before artist emptiness", () => {
  assert.equal(validateSongRequestInput("", ""), "SONG_REQUIRED");
});

test("validateSongRequestInput rejects a song title over the max length", () => {
  const tooLong = "a".repeat(SONG_REQUEST_FIELD_MAX_LENGTH + 1);
  assert.equal(validateSongRequestInput(tooLong, "Neil Diamond"), "SONG_TOO_LONG");
});

test("validateSongRequestInput rejects an artist name over the max length", () => {
  const tooLong = "a".repeat(SONG_REQUEST_FIELD_MAX_LENGTH + 1);
  assert.equal(validateSongRequestInput("Sweet Caroline", tooLong), "ARTIST_TOO_LONG");
});

test("validateSongRequestInput accepts a field at exactly the max length", () => {
  const exact = "a".repeat(SONG_REQUEST_FIELD_MAX_LENGTH);
  assert.equal(validateSongRequestInput(exact, exact), null);
});

test("validateSongRequestInput trims surrounding whitespace before checking length", () => {
  const padded = `  ${"a".repeat(SONG_REQUEST_FIELD_MAX_LENGTH)}  `;
  assert.equal(validateSongRequestInput(padded, "Neil Diamond"), null);
});

test("songRequestValidationMessage returns a distinct, human-readable message per error", () => {
  const messages = new Set([
    songRequestValidationMessage("SONG_REQUIRED"),
    songRequestValidationMessage("ARTIST_REQUIRED"),
    songRequestValidationMessage("SONG_TOO_LONG"),
    songRequestValidationMessage("ARTIST_TOO_LONG"),
  ]);
  assert.equal(messages.size, 4);
});

test("normalizeSongRequestInput trims both fields", () => {
  assert.deepEqual(normalizeSongRequestInput("  Sweet Caroline  ", "  Neil Diamond  "), {
    song: "Sweet Caroline",
    artist: "Neil Diamond",
  });
});
