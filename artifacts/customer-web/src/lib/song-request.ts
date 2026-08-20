// Mirrors the constraints on SubmitSongRequestBody in
// lib/api-spec/openapi.yaml (song/artist: minLength 1, maxLength 200).
// Kept in sync manually since the generated zod schema
// (@workspace/api-zod's SubmitSongRequestBody) isn't a dependency of
// customer-web — only @workspace/api-client-react and @workspace/api-zod
// (per the approved plan) are, and the client-react types don't carry
// runtime validation, just shapes. This lets the form fail fast with a
// friendly message before making a request that the server would reject
// anyway.
export const SONG_REQUEST_FIELD_MAX_LENGTH = 200;

export type SongRequestValidationError =
  | "SONG_REQUIRED"
  | "ARTIST_REQUIRED"
  | "SONG_TOO_LONG"
  | "ARTIST_TOO_LONG";

export function validateSongRequestInput(
  song: string,
  artist: string,
): SongRequestValidationError | null {
  const trimmedSong = song.trim();
  const trimmedArtist = artist.trim();
  if (!trimmedSong) return "SONG_REQUIRED";
  if (!trimmedArtist) return "ARTIST_REQUIRED";
  if (trimmedSong.length > SONG_REQUEST_FIELD_MAX_LENGTH) return "SONG_TOO_LONG";
  if (trimmedArtist.length > SONG_REQUEST_FIELD_MAX_LENGTH) return "ARTIST_TOO_LONG";
  return null;
}

export function songRequestValidationMessage(error: SongRequestValidationError): string {
  switch (error) {
    case "SONG_REQUIRED":
      return "Enter a song title.";
    case "ARTIST_REQUIRED":
      return "Enter the artist's name.";
    case "SONG_TOO_LONG":
      return `Song title must be ${SONG_REQUEST_FIELD_MAX_LENGTH} characters or fewer.`;
    case "ARTIST_TOO_LONG":
      return `Artist name must be ${SONG_REQUEST_FIELD_MAX_LENGTH} characters or fewer.`;
  }
}

/** Trims the raw form input into the exact payload shape the API expects. */
export function normalizeSongRequestInput(
  song: string,
  artist: string,
): { song: string; artist: string } {
  return { song: song.trim(), artist: artist.trim() };
}
