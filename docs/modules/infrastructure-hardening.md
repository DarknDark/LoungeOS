# Pre-Module 3 Infrastructure Hardening

This phase prepares reusable infrastructure only. The Ordering Engine
(Module 3) has not been started.

## Implemented

- Reusable audit engine and Firestore audit repository
- Reusable notification engine with create/read/delivered/archive lifecycle
- Reusable service timeline repository and service
- Provider-neutral in-process event bus
- Job scheduler contract with no production jobs registered
- Metrics collector and operation timing helper
- Soft-delete metadata and default read filtering
- Firestore transactional optimistic version checks
- Firestore realtime subscription adapter
- Offline queue contract, coordinator, and Firestore persistence adapter
- Standard LoungeOS error codes
- Strict Club Configuration validation
- Sanitized audit metadata that excludes tokens and secrets
- Module 2 session events and audit records for start, join, recovery, expiry,
  and close

## Explicitly not implemented

- Ordering Engine
- Order, kitchen, payment, inventory, or DJ business workflows
- Dashboards
- Offline UI
- New customer or staff screens
- Background jobs
- Firebase live integration verification without the required Secrets
