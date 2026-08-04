# LoungeOS Roadmap

## Project Vision

LoungeOS is a configurable hospitality operating system for clubs, lounges,
restaurants, and bars. It is being prepared first for Mamu's Lounge, but the
platform must support multiple businesses without hardcoded club names, menus,
tables, till numbers, branding, or operational rules.

LoungeOS has two separate products:

1. **Customer application** — a responsive web experience opened from a table
   QR code. It requires no download and no customer login. It exposes only
   ordering, service, music, bill, payment, and table-session actions.
2. **Staff application** — an authenticated Expo mobile application for
   administrators, waiters, bartenders, kitchen staff, and DJs. It provides
   role-based operational workflows and must never expose staff tools to
   customer users.

The long-term goal is a reliable, real-time operating platform used every
night by multiple hospitality businesses. Customer actions, preparation
updates, payments, inventory movements, notifications, business days, and
reports must share a consistent domain model and auditable history.

## Current Status

- **Version:** 0.2 Architecture Phase
- **Progress:** 5%
- **Current phase:** Architecture review and refactor planning
- **Goal:** Production-ready multi-club hospitality platform
- **First deployment:** Mamu's Lounge

The current repository contains:

- A functional Expo SDK 57 mobile prototype with a premium dark/gold theme.
- A local-first `ClubContext` containing guest ordering and preview staff flows.
- Hardcoded sample menu, table, order, song, bill, and operational data.
- AsyncStorage persistence for the local prototype.
- An Express API artifact with logging, CORS, and a health endpoint only.
- Workspace packages reserved for API contracts, generated API clients, Zod
  validation, and database access, but not yet connected to LoungeOS domain
  workflows.

The existing UI is useful as a visual and interaction reference. It is not yet
the production architecture described in this roadmap.

## Module Checklist

Legend:

- ⬜ Not Started
- 🟨 In Progress
- ✅ Complete

| Module | Status |
| --- | --- |
| Architecture Refactor | 🟨 In Progress |
| Customer Web App | ⬜ Not Started |
| QR Session Management | ⬜ Not Started |
| Table Locking | ⬜ Not Started |
| Running Tabs | ⬜ Not Started |
| Split Bill | ⬜ Not Started |
| Payment Tokens | ⬜ Not Started |
| Service Timeline | ⬜ Not Started |
| Waiter Dashboard | ⬜ Not Started |
| Bartender Dashboard | ⬜ Not Started |
| Kitchen Dashboard | ⬜ Not Started |
| DJ Dashboard | ⬜ Not Started |
| Inventory | ⬜ Not Started |
| Admin Dashboard | ⬜ Not Started |
| Notifications | ⬜ Not Started |
| Firebase Integration | ⬜ Not Started |
| M-Pesa Integration | ⬜ Not Started |
| Reports | ⬜ Not Started |
| Business Day | ⬜ Not Started |
| Testing | ⬜ Not Started |
| Production Readiness | ⬜ Not Started |

Each module is planned, implemented, tested, documented, and verified before
the next module begins.

## Architecture Review

### Reusable foundations

- The Expo SDK 57 setup, Metro configuration, routing, font loading, safe-area
  handling, keyboard handling, error boundary, and mobile build pipeline are
  reusable.
- The dark premium visual language, color tokens, touch targets, cards, menu
  imagery, loading behavior, and interaction patterns are useful design
  foundations.
- The current menu-card, order-row, action-tile, status-pill, payment-card,
  and feedback patterns can be extracted into reusable presentation
  components.
- The existing TypeScript workspace, API artifact, API-client package,
  Zod package, database package, and generated-code conventions provide a
  starting point for a contract-first backend.
- The current local interactions are useful as acceptance-test scenarios for
  ordering, cart changes, song requests, waiter calls, bill display, and
  operational status changes.

### Prototype shortcuts to remove or refactor

- Guest and staff experiences are combined in one mobile route. They must
  become separate customer web and authenticated staff applications.
- `ClubContext` currently owns domain types, seed data, persistence, mutations,
  staff role switching, and UI-facing state in one file. These responsibilities
  must be separated into domain models, repositories, application services,
  query/mutation hooks, and presentation state.
- Menu items, prices, images, table number, club identity, DJ identity, sales
  totals, and operational counts are hardcoded or seeded in UI-facing code.
- AsyncStorage is being used as the source of truth. It may remain useful for
  temporary client cache or offline behavior, but authoritative state must move
  behind a server/Firebase repository.
- Payment behavior currently marks orders paid locally and does not implement
  verification, payment tokens, contributor limits, expiry, or M-Pesa
  integration.
- Staff role selection is a preview control, not authentication or
  authorization. It must be replaced by Firebase Authentication and
  server-enforced role checks.
- Order states are too coarse for separate bar and kitchen tickets, waiter
  collection, customer service timeline events, and station-specific routing.
- Song requests accept free text and have no music search integration, duplicate
  prevention, queue position, skip reason, or DJ profile.
- The API currently exposes only health checking. It needs versioned contracts,
  authenticated procedures, validation, persistence, realtime events, and
  integration boundaries.
- There is no audit-safe inventory transaction ledger, business-day lifecycle,
  notification model, reports model, or historical archive strategy.

## Architecture Refactor Plan — Module 1

Module 1 will establish boundaries without implementing customer ordering,
payments, dashboards, or integrations.

### Planned implementation

1. Define shared multi-club domain types and status enums in a neutral domain
   package.
2. Separate domain entities and business rules from UI state and persistence.
3. Establish repository interfaces for clubs, tables, sessions, menus, orders,
   payments, staff, notifications, and inventory.
4. Establish application-service boundaries for session creation, order
   submission, ticket routing, payment verification, and timeline events.
5. Convert the API package into a versioned contract boundary with validation
   and an explicit error format.
6. Split customer and staff navigation boundaries so the future customer web
   app cannot reach staff surfaces.
7. Move branding and business configuration behind a club configuration
   object, using Mamu's Lounge only as editable default seed/configuration.
8. Preserve the current visual components as a design reference while removing
   prototype data ownership from the screen.
9. Add architecture documentation and test seams before feature modules begin.

### Files and areas expected to change

| Area | Why it changes |
| --- | --- |
| `artifacts/club-ordering-mobile/context/ClubContext.tsx` | Decompose the prototype state container into domain/application/client layers. |
| `artifacts/club-ordering-mobile/app/` | Keep staff navigation isolated and prepare the mobile app for authenticated role routes. |
| `artifacts/club-ordering-mobile/components/` | Extract reusable presentation components from the monolithic screen. |
| `artifacts/club-ordering-mobile/constants/` | Retain design tokens but remove business configuration from visual constants. |
| `artifacts/api-server/src/` | Add versioned boundaries, validation, error handling, and service composition without prematurely implementing all modules. |
| `lib/api-spec/` | Define the contract-first API surface and regenerate clients after spec changes. |
| `lib/api-client-react/` | Consume generated contract types/hooks rather than UI-specific mock state. |
| `lib/api-zod/` | Share request/response validation at the API boundary. |
| `lib/db/` | Establish persistence boundaries and schema foundations for multi-club data. |
| Root documentation | Record architecture decisions, folder ownership, and module verification rules. |

No payment provider, Firebase project, music API, or other external integration
will be connected during Module 1 unless it is required to establish an
interface boundary.

## Firestore Collections

Firestore is the planned realtime persistence model. Collection names and
relationships are documented here before implementation so data ownership is
consistent. Historical records are archived by business day and never deleted.

| Collection | Purpose and key relationships |
| --- | --- |
| `clubs` | Tenant/business configuration: name, logo, theme, till number, timezone, active business day. Parent for most records through `clubId`. |
| `tables` | Physical tables, QR configuration, capacity, and operational status. References `clubId`; active session references are controlled by table locking. |
| `tableSessions` | One active or historical visit at a table. References `clubId`, `tableId`, owner/customer session, opened/closed times, status, totals, and business day. |
| `customerSessions` | Anonymous customer/browser session metadata and table-session participation. References `clubId` and `tableSessionId`; never contains staff permissions. |
| `orders` | Customer order rounds and lifecycle metadata. References `clubId`, `tableSessionId`, `customerSessionId`, and business day. |
| `orderItems` | Normalized items within an order, including price snapshot, quantity, station routing, and inventory links. References `orderId` and `menuItemId`. |
| `menuItems` | Configurable item catalog: name, description, price, category, image, availability, station, and inventory link. References `clubId`. |
| `preparationStations` | Configurable bar, kitchen, grill, or other production station. References `clubId`; tickets route here. |
| `kitchenTickets` | Station-specific preparation tickets for drinks and food. References `clubId`, `orderId`, `orderItemIds`, `preparationStationId`, and assigned staff. |
| `songRequests` | Search-selected requests and their queue lifecycle. References `clubId`, `tableSessionId`, `customerSessionId`, and business day. |
| `staff` | Staff profile, club membership, active status, and assigned role references. Authentication identity is stored separately by Firebase Auth. |
| `roles` | Configurable role definitions and permissions. References `clubId` or platform defaults; supports future roles without changing entity code. |
| `inventoryItems` | Stock definitions, units, thresholds, suppliers, and menu links. References `clubId`. |
| `inventoryTransactions` | Append-only sale, restock, waste, and adjustment ledger. References `clubId`, inventory item, source order/ticket, staff actor, and business day. |
| `payments` | Payment attempts and verification records for M-Pesa or cash. References `clubId`, `tableSessionId`, payer, amount, method, and verification actor. |
| `paymentTokens` | Single-use split-bill contributor tokens, requested amount/count, expiry, redemption, and payment references. References `clubId`, `tableSessionId`, and payment. |
| `serviceTimeline` | Append-only customer-visible operational events. References `clubId`, `tableSessionId`, related order/ticket/payment/song record, actor, and timestamp. |
| `businessDays` | Open/close lifecycle and immutable reporting boundary for a club. References `clubId` and closing staff. |
| `notifications` | Centralized realtime notifications with recipient, role, priority, message, read state, timestamp, and related record. References `clubId` and business day. |

### Collection relationship rules

- Every tenant-owned document carries a `clubId` and is authorized against the
  authenticated staff member or anonymous customer session.
- `tableSessions` is the center of the customer journey. Orders, payments,
  timeline events, song requests, and customer-session participation point to
  it.
- `orders` own `orderItems`; item price and preparation routing are snapshotted
  at order time so later menu edits do not rewrite history.
- `preparationStations` determine `kitchenTickets`; a single order can create
  tickets at multiple stations.
- `payments` and `paymentTokens` never directly close a table. A verified
  payment state and authorized waiter/admin action are required.
- `inventoryTransactions` are append-only. Current stock is derived from the
  transaction ledger, never edited as a silent side effect.
- `businessDays` partition reporting and operational history without deleting
  records.
- `serviceTimeline` is the customer-facing event projection of operational
  changes, not a replacement for source records.

## Folder Structure

The target structure keeps product surfaces, domain logic, infrastructure, and
generated contracts separate.

```text
/
├── ROADMAP.md
├── docs/
│   ├── architecture/
│   ├── modules/
│   └── decisions/
├── artifacts/
│   ├── customer-web/
│   │   └── Customer QR ordering application
│   ├── club-ordering-mobile/
│   │   └── Authenticated staff Expo application
│   ├── api-server/
│   │   └── Versioned API and realtime gateway
│   └── mockup-sandbox/
│       └── Design and component exploration surface
├── lib/
│   ├── domain/
│   │   └── Shared entities, value objects, statuses, and business rules
│   ├── application/
│   │   └── Use cases and service interfaces
│   ├── api-spec/
│   │   └── OpenAPI source and code generation
│   ├── api-client-react/
│   │   └── Generated client hooks for frontend applications
│   ├── api-zod/
│   │   └── Shared request and response validation
│   ├── db/
│   │   └── Persistence schema, repositories, and migrations
│   └── integrations/
│       └── Firebase, M-Pesa, music search, and future provider adapters
├── scripts/
│   └── Workspace automation and validation
└── attached_assets/
    └── Product briefs and source references
```

### Folder ownership

- `artifacts/customer-web` owns customer-only routes and responsive web
  presentation. It must not import staff dashboard modules.
- `artifacts/club-ordering-mobile` owns authenticated staff navigation and
  role-specific staff presentation. It must not become a customer web shell.
- `lib/domain` contains framework-independent business concepts.
- `lib/application` coordinates use cases through interfaces and does not know
  React or Firestore implementation details.
- `lib/db` implements persistence and transaction boundaries.
- `lib/api-spec`, `lib/api-client-react`, and `lib/api-zod` keep API contracts
  explicit and generated.
- `lib/integrations` isolates external providers behind replaceable adapters.
- `docs` records decisions, module contracts, operational rules, and
  verification evidence.

## API Architecture

### Authentication

- Staff authentication will use Firebase Authentication.
- Customer access is anonymous and begins from a signed/validated QR table
  session.
- Customer sessions receive only the minimum claims needed for their active
  table session.
- Authentication identity and staff profile data remain separate so staff
  permissions can change without rewriting provider identity.

### Authorization

- Authorization is enforced on the server and in Firestore rules, not only in
  navigation.
- Every staff request is checked for club membership, active account status,
  role, and permission.
- Administrator, waiter, bartender, kitchen, and DJ capabilities are explicit
  permission sets.
- Customers may access only the active table-session projection and their
  allowed actions.
- Payment verification, table release, menu changes, inventory adjustments,
  staff management, and business-day operations require explicit permissions.

### Realtime updates

- Firestore listeners provide updates for table status, orders, tickets,
  payments, song queues, timeline events, and notifications.
- The API/application layer remains responsible for validating commands and
  writing authoritative state.
- Realtime projections must be scoped by `clubId`, role, and table/session
  access.
- Timeline and notification writes should be generated from domain events so
  operational changes are not silently omitted.

### Notifications

- A centralized notification service creates role-aware notifications for new
  orders, ready tickets, waiter calls, song requests, payment waiting, low
  stock, and business-day reminders.
- Notifications include recipient, role, priority, message, timestamp, read
  status, and related record.
- Staff clients subscribe to their authorized notification stream and acknowledge
  read state through a validated command.

### Future integrations

- Firebase Authentication and Firestore realtime data.
- M-Pesa payment initiation, callbacks, reconciliation, and verification.
- Music search provider adapter for song selection and artist metadata.
- Image/logo storage provider.
- Optional messaging, receipt, accounting, and analytics providers.

## Future Ideas

These ideas are intentionally reserved and are not part of the current
implementation sequence:

- Reservations and scheduled table bookings.
- Loyalty, memberships, promotions, and customer profiles.
- Multi-location reporting and platform-level administration.
- Supplier purchase orders and advanced procurement.
- Staff scheduling, payroll exports, and shift management.
- Delivery, takeaway, and room-service workflows.
- POS, accounting, and tax-system integrations.
- Advanced demand forecasting and inventory prediction.
- Customer feedback, reviews, and CRM automation.
- Offline-first staff workflows with conflict resolution.

## Implementation Order

1. Architecture Refactor
2. Customer Web App
3. QR Session Management
4. Table Locking
5. Running Tabs
6. Split Bill
7. Payment Tokens
8. Service Timeline
9. Waiter Dashboard
10. Bartender Dashboard
11. Kitchen Dashboard
12. DJ Dashboard
13. Inventory
14. Admin Dashboard
15. Notifications
16. Firebase Integration
17. M-Pesa Integration
18. Reports
19. Business Day
20. Final Testing & Production Readiness

Each step stops after verification and awaits approval before the next step
begins.
