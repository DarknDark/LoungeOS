---
name: Ordering Engine
description: Durable architectural decisions for LoungeOS Module 3 ordering.
---

The Ordering Engine is a server-side application service over the provider-neutral infrastructure layer. Menu, order, item, and reservation records are tenant-scoped beneath each club in Firestore; production runtime has no mock persistence fallback.

**Why:** LoungeOS needs one authoritative place for pricing, authorization, lifecycle transitions, and concurrency behavior across customer and staff clients.

**How to apply:** Route all future order mutations through the Order Service. Preserve centralized pricing, idempotency keys, optimistic versions, active table-session scope, inventory reservation/release, and audit/timeline/notification/event side effects.

Customer order history is scoped to the active table session, while editing and cancellation remain restricted to the customer who created the order. Staff status changes require Firebase token verification plus LoungeOS order-management permission.

**Why:** Guests at the same table need shared visibility, but one guest must not alter another guest's draft or cancel their order.

**How to apply:** Keep these two authorization rules separate when adding staff views, kitchen routing, or mobile mutations.