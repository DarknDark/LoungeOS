# Changelog

## 2026-08-11 — Realtime Synchronization

Completed the Realtime Synchronization milestone without changing the
permanent QR, customer session, ordering, payment, table lifecycle, or staff
administration modules.

### Added

- Firestore-backed listeners for table-session, order, and staff notification
  changes.
- Authenticated staff realtime projection stream.
- Projection updates containing only resource and change-type identifiers;
  operational records remain behind the protected staff query.
- Five-second HTTP polling fallback retained for the staff operations dashboard.
- Application and API authentication tests for realtime synchronization.

### Verification

- 29/29 application tests passing.
- 2/2 API tests passing.
- API typecheck passing.
- Expo/mobile typecheck passing.
- API build verification completed.

### Deferred

Manual waiter tables, the temporary customer dashboard, ReceiptService, SMS,
printing, provider integrations, and Module 4 remain intentionally out of
scope.

## 2026-08-06 — Staff Administration

Completed the Staff Administration milestone without changing the frozen
permanent QR, customer session, ordering, payment, or table lifecycle
architecture.

### Added

- Staff repository create, update, and list operations.
- Role repository create and update operations.
- Application-layer `AdminStaffService` with club scoping, role validation,
  and `staff.manage` permission enforcement.
- Protected admin API endpoints for creating, updating, and listing staff and
  roles.
- OpenAPI definitions and regenerated Zod/React Query clients.
- Application and API tests for staff/role administration and authorization.

### Verification

- 28/28 application tests passing.
- API authentication test passing.
- Full workspace typecheck passing, including Expo/mobile.
- API build passing.
- API workflow restarted successfully.
- `GET /api/healthz` returned `{"status":"ok"}`.

### Deferred

Realtime synchronization, ReceiptService, manual waiter mode, SMS, printing,
provider integrations, and Module 4 remain intentionally out of scope.