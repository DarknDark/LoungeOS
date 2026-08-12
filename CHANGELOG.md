# Changelog

## 2026-08-12 — Manual Waiter Tables (Phase 3 Part 1)

Completed the Manual Waiter Tables milestone. Waiters can manually open tables without customer QR scans, customer scans on staff-controlled manual tables route into a waiter join-request workflow with a green waiting state ("Please wait. Your waiter has been notified."), and authorized staff can view and approve pending join requests.

### Added

- Customer scan handling for staff-controlled tables (`createFromQr` and `open`) automatically routes to the join-request workflow (`approvalStatus: 'pending-approval'`, `accessLevel: 'temporary'`).
- Staff notification when a customer scans a permanent QR code on a staff-opened table.
- "Open Manual Table" action button on available table cards in the Staff Expo Mobile App (`StaffOperationsDashboard.tsx`).
- Targeted application unit test for customer scans on staff-opened manual tables.

### Verification

- 14/14 application unit tests passing.
- Workspace typecheck (`tsc --noEmit`) passing cleanly across all libraries, API server, and Expo mobile app.

### Deferred

- The Temporary Customer Dashboard (`artifacts/customer-web`), ReceiptService, SMS, printing, provider integrations, and Module 4 remain intentionally unfinished and out of scope.

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