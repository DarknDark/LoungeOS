# Changelog

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