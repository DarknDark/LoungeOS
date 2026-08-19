# LoungeOS Customer Application Boundary

This directory is reserved for the responsive QR customer web application.
It must remain a separate product surface from the authenticated Expo staff
application.

Customer routes may consume shared domain, API contract, and presentation
libraries, but must not import staff navigation, staff dashboards, inventory
management, settings administration, or developer tools.

The customer application is intentionally not implemented in Module 1.

## Status

As of Phase 3 Part 2 (Checkpoint 4), this directory contains the initial
Vite + React + wouter + Tailwind CSS scaffold: routing shell, placeholder
pages, and API wiring via `@workspace/api-client-react` /
`@workspace/api-zod`. QR entry/join, the pending-approval waiting screen,
and the approved dashboard (running bill, ordered items, request song, call
waiter) are implemented in subsequent checkpoints.

This app must not import from `artifacts/club-ordering-mobile` (the Expo
staff/customer prototype) or any staff UI package, and vice versa.
