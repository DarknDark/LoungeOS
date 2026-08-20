// Persisted customer session state. Stored in localStorage (not
// sessionStorage) so a customer can reopen the browser or refresh mid-visit
// without losing their table session, mirroring the intent of the Expo
// app's SecureStore-persisted session (see
// artifacts/club-ordering-mobile/context/ClubContext.tsx) — read there only
// as a reference for the deep-link parameter convention, never imported.
export type StoredCustomerSession = {
  clubId: string;
  tableId: string;
  tableSessionId: string;
  customerSessionId: string;
  recoveryToken: string;
};

const STORAGE_KEY = "loungeos.customer-session.v1";

export function readStoredSession(): StoredCustomerSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.clubId !== "string" ||
      typeof parsed.tableId !== "string" ||
      typeof parsed.tableSessionId !== "string" ||
      typeof parsed.customerSessionId !== "string" ||
      typeof parsed.recoveryToken !== "string"
    ) {
      return null;
    }
    return parsed as StoredCustomerSession;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredCustomerSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Standard headers for an authenticated customer API request. */
export function customerHeaders(session: StoredCustomerSession): Record<string, string> {
  return {
    "X-Club-Id": session.clubId,
    "X-Customer-Session-Id": session.customerSessionId,
    "X-Customer-Session-Token": session.recoveryToken,
  };
}
