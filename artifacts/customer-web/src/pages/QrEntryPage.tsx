import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useCreateCustomerTableSession } from "@workspace/api-client-react";
import { readStoredSession, writeStoredSession } from "../session/storage";

// Default club for this single-tenant deployment, mirroring
// @workspace/domain's DEFAULT_CLUB_SETTINGS.clubId ('mamus-lounge').
// customer-web intentionally does not depend on @workspace/domain for a
// single string constant; a `clubId` query param can override it, matching
// the same override convention already used by the Expo app's deep-link
// parsing (artifacts/club-ordering-mobile/context/ClubContext.tsx, read
// only as a reference for the parameter convention — never imported).
const DEFAULT_CLUB_ID = "mamus-lounge";

export default function QrEntryPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const createSession = useCreateCustomerTableSession();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!tableId || started.current) return;
    started.current = true;

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
      .catch(() => {
        // Any creation failure (INVALID_QR, TABLE_NOT_AVAILABLE,
        // TABLE_NOT_FOUND, CONFIGURATION_INVALID, or an unexpected error)
        // routes to the invalid-QR page, per Checkpoint 5's requirements.
        setFailed(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, search]);

  useEffect(() => {
    if (!tableId || failed) {
      setLocation("/invalid-qr", { replace: true });
    }
  }, [tableId, failed, setLocation]);

  return (
    <main className="flex h-full items-center justify-center p-6 text-center">
      <p className="text-sm text-neutral-500">Joining your table…</p>
    </main>
  );
}
