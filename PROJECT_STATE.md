# LoungeOS - Project State

Last Updated: 2026-08-11

---

# Project Goal

LoungeOS is a hospitality operating system for lounges, clubs and restaurants.

Core objectives:

- Permanent QR code per table
- Customer ordering without login
- Waiter-controlled table lifecycle
- Secure staff authentication
- Real-time operations
- Zero fake/demo data
- Production-ready backend

---

# Architecture Rules (Never Break)

## Permanent QR

Each table owns ONE permanent QR.

Never rotate.

Never recreate.

Closing a table releases it for the next customer.

---

## Customer Sessions

Customers never own the table.

They only own a session.

A new scan creates a new customer session.

---

## Waiter Authority

Only authenticated staff may:

- release tables
- verify payments
- reopen tabs
- approve joins
- close tables

---

## Close Table Rules

Must be atomic.

Must:

- verify payments complete
- expire customer sessions
- clear approvals
- clear payment state
- write audit
- write timeline
- notify
- release table

QR remains unchanged.

---

# Completed Modules

✅ Architecture

✅ Firebase setup

✅ Permanent QR

✅ Customer sessions

✅ Orders

✅ Shared bills

✅ Split payments

✅ Payment verification

✅ Waiter dashboard

✅ Close Table lifecycle

✅ Firebase staff authentication

✅ OpenAPI generation

✅ Generated API clients

---

# Current Status

Current milestone:

Realtime Synchronization completed.

Verified:

- 28/28 application tests passing
- API staff administration authentication test passing
- API health OK
- Typechecks pass
- OpenAPI generated successfully
- Generated API clients verified
- Expo/mobile typecheck passes
- Firestore realtime projection stream added
- Five-second HTTP polling fallback retained

---

# Remaining Work

## Phase 1

Admin Staff Management

✅ create staff

✅ update/deactivate staff

✅ assign roles

✅ assign permissions through the existing `staff.manage` authorization model

---

## Phase 2

Realtime synchronization

Firestore listeners

Polling fallback (3-5 sec)

✅ Completed

---

## Phase 3

Manual waiter tables: ✅ Completed

Temporary customer dashboard: ✅ Completed (Phase 3 Part 2 — `artifacts/customer-web`)

---

## Phase 4

Kitchen Tickets & KDS: ✅ Completed

- Checkpoint 1: Kitchen ticket domain/repository foundation (`FirestoreStationRepository`, `FirestoreKitchenTicketRepository`), `KitchenService.createTicketsForOrder`/`updateTicket`, order-lifecycle integration on the `accepted → preparing` transition (deterministic, idempotent ticket IDs — `${orderId}:${stationId}`), default Kitchen/Bartender role seeding (`tickets.manage`), read-only `GET /v1/staff/kitchen-tickets`.
- Checkpoint 2: isolated KDS web app (`artifacts/kds-web`) — Firebase staff sign-in, client-side station selection (Kitchen/Bar), 3-column read-only ticket board, staff realtime SSE stream reused as a change-signal (extended `tickets.manage` into the existing permission gate), 5-second polling fallback.
- Checkpoint 3: `POST /v1/staff/kitchen-tickets/{ticketId}/status`, interactive station-action buttons in the KDS with optimistic updates and rollback on error.
- Checkpoint 4: cross-device/SSE-lifecycle verification, monorepo-wide typecheck/test/build pass, dead-code sweep, documentation reconciliation.

`Order.status` and `KitchenTicket.status` remain separate state machines by design — a ticket reaching `ready`/`collected` does not change the order's own status.

**Known gap, not yet addressed**: no staff-facing UI currently advances an order past `submitted` (the mobile staff dashboard has no order-status-mutation control), so kitchen ticket creation — while fully implemented and tested at the API/service level — has no live user-facing trigger yet. Adding that control is out of scope for Phase 4 and deferred to a future phase.

---

## Phase 5

ReceiptService abstraction

(no providers)

---

## Module 4

NOT STARTED

Must not begin before all Phase 1 work is complete.

---

# Development Rules

Never add:

- fake data
- placeholder APIs
- demo dashboards
- fake authentication

Always:

- update OpenAPI
- regenerate clients
- run tests
- run typechecks
- verify API health

---

# Verification Checklist

After every milestone:

✅ Application tests

✅ API tests

✅ Typecheck

✅ OpenAPI generation

✅ Generated clients

✅ API health

✅ Expo preview

---

# Git Workflow

Development:

Replit

↓

GitHub

↓

Local backup

At the end of every session:

Download project

Commit

Push to GitHub

---

# Next Task

Phase 4 (Kitchen Tickets & KDS) is complete. Next: Phase 5 (ReceiptService
abstraction) or Module 4, per prioritization — not started yet. Note the
known gap in Phase 4's section above (no order-status-advance staff UI)
before planning further KDS-dependent work.