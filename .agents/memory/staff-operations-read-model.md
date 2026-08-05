---
name: Staff operations read model
description: The protected waiter operations API exposes live table state and related records while mobile staff auth remains a separate boundary.
---

The waiter operations surface should read permanent table state from the same Firebase-scoped repositories used by customer sessions and orders. It can expose active sessions, shared orders, payment records, and pending customer approvals without creating duplicate operational data.

**Why:** Staff mutations require a real Firebase-authenticated staff identity and club membership. Making the Expo customer preview appear operational would create fake authorization and could allow unsafe payment or table actions.

**How to apply:** Keep staff API routes behind Firebase bearer-token verification plus role/permission checks. Keep the Expo staff preview explicitly non-operational until a real client staff sign-in/token flow is implemented.