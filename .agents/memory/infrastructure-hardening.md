---
name: Infrastructure hardening
description: Durable rules for the reusable LoungeOS infrastructure foundation.
---

The hardening layer keeps cross-module concerns provider-neutral at the domain
and application boundaries. Firestore, realtime listeners, and queue
persistence belong only in infrastructure adapters.

**Why:** Future modules must publish events and use shared audit,
notification, timeline, metrics, locking, and synchronization primitives
instead of introducing module-specific implementations.

**How to apply:** New mutating workflows should emit a domain event, append a
sanitized audit record, and create only the projections relevant to that
workflow. Use version checks for concurrent writes and treat Firestore as the
only runtime persistence provider.