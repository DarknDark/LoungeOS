import { useState, type FormEvent } from "react";
import { useSubmitSongRequest } from "@workspace/api-client-react";
import { customerHeaders, type StoredCustomerSession } from "../session/storage";
import { apiErrorCode } from "../api/errors";
import {
  normalizeSongRequestInput,
  songRequestValidationMessage,
  validateSongRequestInput,
} from "../lib/song-request";

type RequestSongFormProps = {
  session: StoredCustomerSession;
  /** Song requests require full approval — see Checkpoint 2's access rule.
   * A permanently-temporary (read-only) customer session should not see an
   * interactive form even though the dashboard itself is reachable. */
  readOnly: boolean;
};

export function RequestSongForm({ session, readOnly }: RequestSongFormProps) {
  const submitSongRequest = useSubmitSongRequest({
    request: { headers: customerHeaders(session) },
  });
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (readOnly) {
    return (
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Request a song</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Song requests aren't available for view-only table access.
        </p>
      </section>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateSongRequestInput(song, artist);
    if (error) {
      setValidationError(songRequestValidationMessage(error));
      return;
    }
    setValidationError(null);
    const payload = normalizeSongRequestInput(song, artist);
    submitSongRequest.mutate(
      { sessionId: session.tableSessionId, data: payload },
      {
        onSuccess: () => {
          setSong("");
          setArtist("");
        },
      },
    );
  };

  const serverErrorCode = apiErrorCode(submitSongRequest.error);
  const serverErrorMessage =
    serverErrorCode === "ACCESS_TEMPORARY_READ_ONLY" || serverErrorCode === "NOT_AUTHORIZED"
      ? "Song requests aren't available for view-only table access."
      : submitSongRequest.isError
        ? "Couldn't send that request. Please try again."
        : null;

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-semibold text-neutral-700">Request a song</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        <input
          type="text"
          placeholder="Song title"
          value={song}
          onChange={(event) => setSong(event.target.value)}
          disabled={submitSongRequest.isPending}
          maxLength={200}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
        />
        <input
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
          disabled={submitSongRequest.isPending}
          maxLength={200}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
        />
        <button
          type="submit"
          disabled={submitSongRequest.isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {submitSongRequest.isPending ? "Sending…" : "Request song"}
        </button>
      </form>
      {validationError ? <p className="mt-2 text-xs text-red-600">{validationError}</p> : null}
      {serverErrorMessage ? (
        <p className="mt-2 text-xs text-red-600">{serverErrorMessage}</p>
      ) : null}
      {submitSongRequest.isSuccess ? (
        <p className="mt-2 text-xs text-neutral-500">
          {submitSongRequest.data.queuePosition
            ? `Added to the DJ's queue — you're #${submitSongRequest.data.queuePosition}.`
            : "Sent to the DJ."}
        </p>
      ) : null}
    </section>
  );
}
