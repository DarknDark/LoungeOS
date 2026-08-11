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

## Phase 3 — Next milestone

Manual waiter tables

Temporary customer dashboard

---

## Phase 4

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

Implement manual waiter tables and the temporary customer dashboard.

Not Module 4.