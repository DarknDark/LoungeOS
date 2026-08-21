# Changelog

## 2026-08-20 — Temporary Customer Dashboard (Phase 3 Part 2)

Completed the Temporary Customer Dashboard milestone: a new, isolated QR
customer web app (`artifacts/customer-web`) covering table join through
session recovery, the pending-approval waiting screen, and a read-only
dashboard with two customer-initiated actions, without changing the frozen
permanent QR, customer session, ordering, payment, or table lifecycle
architecture, and without modifying the Expo staff/mobile app.

### Added

- `artifacts/customer-web`: Vite + React + wouter + Tailwind CSS app, using
  `@workspace/api-client-react`/`@workspace/api-zod` exclusively for API
  access (no hand-written fetch/business logic).
- QR entry (`/t/:tableId`) creating or resuming a customer table session,
  persisted in `localStorage`; session recovery on refresh/reopen.
- Pending-approval screen with the exact required copy ("Please wait. Your
  waiter has been notified."), five-second polling, and auto-redirect to
  the dashboard on approval.
- Read-only dashboard: running bill (subtotal, taxes/fees, total due) and
  ordered items with per-order status, kept in sync via five-second HTTP
  polling — no SSE/realtime infrastructure, no direct Firestore access.
- Call Waiter action, allowed for pending/temporary customer access as an
  intentional exception, with server-enforced (not merely cosmetic)
  rate-limiting.
- Request Song action, requiring full customer approval, with client-side
  validation mirroring the API contract and DJ-queue-position feedback.
- Backend: `DJService` + song-request API, `CustomerRequestService` +
  call-waiter API, and a minimal, server-enforced authorization fix closing
  a gap that would otherwise have let temporary/pending customers place
  orders.
- Accessibility: `aria-live` status/error announcements, associated form
  labels, a resizable (non-zoom-locked) viewport.
- Unit tests across both the new backend services and the new frontend
  logic (validation, formatting, persistence, error handling).

### Verification

- 57/57 `lib/application` tests passing.
- 2/2 `artifacts/api-server` tests passing.
- 39/39 `artifacts/customer-web` tests passing.
- Full workspace typecheck (`tsc --build` + per-package `tsc --noEmit`)
  passing across all libraries, the API server, customer-web, and the Expo
  mobile app.
- `artifacts/customer-web` production build (`vite build`) passing with no
  warnings.
- Zero imports from `artifacts/club-ordering-mobile` or any staff UI
  package in `artifacts/customer-web`; the Expo app was not modified.

### Deferred

ReceiptService, SMS, printing, provider integrations, and Module 4 remain
intentionally out of scope.

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