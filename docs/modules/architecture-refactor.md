# Module 1 — Architecture Refactor

## Status

Complete at the architecture-foundation level. Feature behavior remains
intentionally deferred to the implementation order in `ROADMAP.md`.

## Delivered

- Technical blueprint in `ARCHITECTURE.md`.
- Shared domain package with tenant-aware entities, settings, events,
  repository ports, and Firestore collection names.
- Application package with service contracts and operational projection
  coordination for notifications, audit, analytics, activity feed, and
  service timeline.
- Centralized editable default club settings for the first deployment.
- Isolated local demo fixtures and presentation types in the mobile artifact.
- Documented customer-web and staff-app boundaries.
- Existing mobile visual behavior preserved while screen literals for club
  identity, currency, table number, theme, and demo metrics route through
  configuration/fixture adapters.

## Deliberately not implemented

- Customer web application routes.
- Firebase Authentication or Firestore provider code.
- Server-side authorization enforcement.
- Real-time listeners.
- Customer/staff operational workflows.
- M-Pesa, printer, music search, or other external integrations.

## Verification

The final verification passed:

- Full workspace TypeScript check.
- Expo SDK compatibility check.
- Android and iOS Expo bundle generation.
- Android Expo Go manifest/runtime check on SDK 57.
- Web preview render after the settings-backed currency formatter was hardened
  against invalid runtime locale configuration.

The architecture package is provider-neutral and can be tested without a
Firebase project or payment credentials.