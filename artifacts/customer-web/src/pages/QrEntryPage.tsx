import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useCreateCustomerTableSession } from "@workspace/api-client-react";
import { readStoredSession, writeStoredSession } from "../session/storage";
import { apiErrorCode } from "../api/errors";

// Default club for this single-tenant deployment, mirroring
// @workspace/domain's DEFAULT_CLUB_SETTINGS.clubId ('mamus-lounge').
// customer-web intentionally does not depend on @workspace/domain for a
// single string constant; a `clubId` query param can override it, matching
// the same override convention already used by the Expo app's deep-link
// parsing (artifacts/club-ordering-mobile/context/ClubContext.tsx, read
// only as a reference for the parameter convention — never imported).
const DEFAULT_CLUB_ID = "mamus-lounge";

// These codes mean the QR code itself is genuinely unusable — no retry can
// fix them, so they route permanently to /invalid-qr. Anything else
// (network drop, timeout, 500, an unrecognized code) is treated as a
// transient error: shown inline on this page with a retry action, not
// routed away, per Checkpoint 8's requirement to distinguish "invalid QR"
// from "network drops/transient errors".
const PERMANENTLY_INVALID_QR_CODES = new Set([
  "INVALID_QR",
  "TABLE_NOT_FOUND",
  "TABLE_NOT_AVAILABLE",
  "CONFIGURATION_INVALID",
]);

export default function QrEntryPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const createSession = useCreateCustomerTableSession();
  const [transientError, setTransientError] = useState(false);
  const [permanentlyInvalid, setPermanentlyInvalid] = useState(false);
  const started = useRef(false);

  const attempt = useCallback(() => {
    if (!tableId) return;
    setTransientError(false);

    const params = new URLSearchParams(search);
    const clubId = params.get("clubId") ?? DEFAULT_CLUB_ID;
    const qrToken = params.get("qrToken") ?? undefined;

    // If we already hold a valid session for this exact table, don't create
    // a second one on refresh — resume it instead.
    const existing = readStoredSession();
    if (existing && existing.tableId === tableId && existing.clubId === clubId) {
      setLocation(`/session/${existing.tableSessionId}`, { replace: true });
      return;
    }

    createSession
      .mutateAsync({ data: { clubId, tableId, ...(qrToken ? { qrToken } : {}) } })
      .then((access) => {
        writeStoredSession({
          clubId,
          tableId,
          tableSessionId: access.tableSession.id,
          customerSessionId: access.customerSession.id,
          recoveryToken: access.recoveryToken,
        });
        const path =
          access.customerSession.approvalStatus === "pending-approval"
            ? `/session/${access.tableSession.id}/pending`
            : `/session/${access.tableSession.id}`;
        setLocation(path, { replace: true });
      })
      .catch((error: unknown) => {
        const code = apiErrorCode(error);
        if (code && PERMANENTLY_INVALID_QR_CODES.has(code)) {
          setPermanentlyInvalid(true);
        } else {
          setTransientError(true);
        }
      });
  }, [tableId, search, createSession, setLocation]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, search]);

  useEffect(() => {
    if (!tableId || permanentlyInvalid) {
      setLocation("/invalid-qr", { replace: true });
    }
  }, [tableId, permanentlyInvalid, setLocation]);

  if (!tableId || permanentlyInvalid) return null;

  if (transientError) {
    return (
      <main
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
        aria-live="polite"
      >
        <p className="text-sm text-neutral-600">
          Couldn't reach the table right now. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={attempt}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="flex h-full items-center justify-center p-6 text-center" aria-live="polite">
      <p className="text-sm text-neutral-500">Joining your table…</p>
    </main>
  );
}
