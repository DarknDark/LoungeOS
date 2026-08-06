---
name: Firebase staff auth — mobile sign-in flow
description: How Firebase client auth is wired into the mobile app for staff token injection
---

## Pattern

Firebase JS SDK initialised lazily in `artifacts/club-ordering-mobile/services/firebase-client.ts`.
All four `EXPO_PUBLIC_*` vars are stored as Replit Secrets (they are public client config values,
not real secrets, but Secrets storage was used).

`onStaffAuthStateChanged` returns `Promise<() => void>` — the component wires it up in a
`useEffect` and stores the unsubscribe ref to avoid double-registration.

`configureStaffAuthTokenProvider(() => user.getIdToken())` is called inside the auth-state
listener (not at sign-in time) so token refresh is automatic.

## Metro fix

Firebase `@firebase/auth` creates `_tmp_*` directories that Metro tries to watch but deletes
immediately → ENOENT crash. Fixed in `artifacts/club-ordering-mobile/metro.config.js` with a
`resolver.blockList` regex that anchors to the resolved `@firebase/auth` package path.

**Why:** The `blockList` approach is stable across Firebase SDK upgrades because it resolves the
package path at config-load time rather than hard-coding a version path.

**How to apply:** Any future Firebase package that creates temp directories near its install
location should be added to the same blockList pattern.

## Operational prerequisites for full smoke test

The end-to-end waiter flow requires Firestore documents to exist before any test:
- `clubs/{clubId}` — club config with `requiresPaymentBeforeClose: true` etc.
- `clubs/{clubId}/tables/{tableId}` — with `permanent: true` and a valid QR secret
- `clubs/{clubId}/staff/{staffId}` — with `firebaseUid` matching the Firebase Auth UID
- `clubs/{clubId}/roles/{roleId}` — with `tables.release: true` permission
- `clubs/{clubId}/settings/business` — for business-day/VAT config

Without these, API calls succeed auth but return 404/empty — not a code bug.
