# Module 1 — Architecture Refactor

## Status

Complete through the Module 3 ordering engine and customer mobile integration.
The production verification pass has confirmed the provider boundary, API
contract, customer session lifecycle, ordering workflow, and mobile bundle
behavior. Further operational modules remain intentionally deferred to the
implementation order in `ROADMAP.md`.

## Delivered

- Technical blueprint in `ARCHITECTURE.md`.
- Shared domain package with tenant-aware entities, settings, events,
  repository ports, and Firestore collection names.
- Application package with service contracts and operational projection
  coordination for notifications, audit, analytics, activity feed, and
  service timeline.
- Centralized editable default club settings for the first deployment.
- Isolated presentation types and Club Configuration adapters in the mobile
  artifact.
- Documented customer-web and staff-app boundaries.
- Existing mobile visual behavior preserved while screen literals for club
  identity, currency, table number, theme, and metrics route through
  configuration adapters and live API state.

## Deliberately not implemented

- Customer web application routes.
- Staff operational workflows and staff dashboards.
- A client-facing realtime transport for the existing server-side subscription
  boundary.
- M-Pesa, printer, music search, or other external integrations.

## Verification

The final verification passed:

- Full workspace TypeScript check.
- Expo SDK compatibility check.
- Android and iOS Expo bundle generation.
- Android Expo Go manifest/runtime check on SDK 57.
- Web preview render after the settings-backed currency formatter was hardened
  against invalid runtime locale configuration.
- Customer session and order lifecycle tests, including idempotency, offline
  retry, optimistic locking, authorization, and inventory side effects.
- Dependency, SAST, and data-flow security scans.

The architecture package is provider-neutral and can be tested without a
Firebase project or payment credentials.