This project is LoungeOS.

Read PROJECT_STATE.md first.

Do not redesign architecture.

Do not begin Module 4.

Work only on the current milestone.

Rules:

- permanent QR
- customer sessions
- waiter owns table lifecycle
- no fake data
- no placeholder auth
- preserve API compatibility

Always:

- small atomic changes
- update OpenAPI
- regenerate clients
- run tests
- stop after milestone

Current milestone completed:

- Realtime Synchronization
- Authenticated staff projection stream
- Firestore session/order/notification listeners
- Five-second HTTP polling fallback
- Manual waiter tables (Phase 3 Part 1)
- Temporary customer dashboard (Phase 3 Part 2 — `artifacts/customer-web`: QR
  entry/session recovery, pending-approval polling, read-only running
  bill/ordered items, call waiter, request song)

Next milestone:

- Not yet assigned.

Do not begin the next milestone without approval.