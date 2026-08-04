---
name: Mobile live ordering integration
description: Customer Expo app integration boundaries for sessions, ordering, offline behavior, and realtime transport.
---

The customer mobile app uses the generated API client with secure session credentials, QR/deep-link session bootstrap, live menu/order reads, draft-then-submit ordering, idempotency keys, cancellation, persisted cart state, and a local retry queue. Payments, waiter calls, song requests, and staff mutations remain explicitly unimplemented until corresponding authenticated API routes exist.

**Why:** The API currently exposes customer table sessions and ordering, but its realtime repository is server-side Firestore only; inventing client transports or local persistence for unsupported features would create false production behavior.

**How to apply:** Keep customer session tokens in SecureStore on native platforms, use the existing context as the shared mobile store, add transport endpoints before claiming mobile realtime, and never restore demo data when Firebase is unavailable.