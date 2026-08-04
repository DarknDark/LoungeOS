# LoungeOS Architecture

## 1. System Overview

LoungeOS is a multi-tenant hospitality operating platform for clubs, lounges,
restaurants, and bars. It manages customer ordering, table sessions, service
operations, preparation stations, DJ requests, payments, inventory,
notifications, reports, and daily business operations.

The first configured business is Mamu's Lounge. Mamu's Lounge is editable
configuration, not a platform assumption. No business name, logo, table,
menu, price, currency, till number, or theme is part of the domain logic.

LoungeOS has two separate applications:

### Customer Application

- Responsive web application.
- Opened from a table QR code.
- No download.
- No customer account or login.
- Receives a temporary, scoped customer session.
- Can only see customer features for the active table session.

Customer routes must never import staff dashboard modules or expose
administration, inventory, settings, staff operations, developer tools, or
hidden navigation.

### Staff Application

- Expo mobile application.
- Firebase Authentication for staff login.
- Server-enforced role-based access control.
- Roles include administrator, waiter, bartender, kitchen, and DJ.
- Designed so new roles and permissions can be added without rewriting route
  logic.

The two applications use the same API and domain services but have separate
navigation trees, session types, permissions, and UI packages. Sharing a
domain contract is allowed; sharing customer and staff screens is not.

## 2. System Architecture Diagram

```text
Customer scans table QR
        |
        v
Customer Web App
  - validates QR/table context
  - creates or joins scoped customer session
        |
        v
API Layer
  - authentication/session validation
  - request validation
  - authorization
  - command/query transport
        |
        v
Application Services
  - table sessions
  - orders and station routing
  - payments and verification
  - notifications
  - inventory
  - business day
  - audit and analytics events
        |
        v
Repositories
  - persistence ports
  - transactions
  - realtime subscriptions
        |
        v
Firestore
  - tenant-scoped documents
  - append-only operational history
        |
        v
Realtime listeners
  - customer session projection
  - staff role projection
  - notifications
  - service timeline
        |
        v
Staff Expo Mobile App
  - Firebase-authenticated
  - role-aware dashboards
```

### Layer responsibilities

- **UI:** Renders state, captures input, and calls application hooks. UI does
  not calculate business rules or access Firestore directly.
- **Domain:** Defines entities, value objects, statuses, invariants, and
  repository/service contracts. It has no React, Firebase, Express, or
  provider dependency.
- **Application:** Coordinates use cases through repository and integration
  ports. It creates domain events, timeline records, notifications, audit
  records, and analytics facts as part of commands.
- **API:** Translates HTTP/realtime requests into application commands and
  queries, validates payloads, authenticates actors, and enforces permissions.
- **Repositories:** Implement persistence and query behavior behind stable
  interfaces.
- **Infrastructure:** Contains Firestore, Firebase Auth, M-Pesa, music search,
  storage, printer, and messaging adapters. Providers are replaceable.
- **Realtime listeners:** Subscribe only to authorized projections and update
  client caches. Listeners do not become a second source of truth.

## 3. Domain Model

All tenant-owned entities include `clubId`. IDs are opaque strings. Timestamps
are stored as ISO strings at the domain boundary and converted by
infrastructure adapters as needed.

### Club

Identifies a tenant and its business configuration. A club owns tables, menu
items, stations, staff membership, settings, business days, and all operational
records.

### Table

Represents a physical table, QR code, capacity, reservation state, and current
operational status. A table may have at most one active table session.

### Table Session

Represents one visit at a table. It owns the active running bill, lifecycle,
owner session, participants, timeline, and closure state.

### Customer Session

An anonymous, temporary browser/device session scoped to a table session. It
does not have staff permissions and expires independently from the business
record.

### Staff

Links a Firebase Auth identity to a club membership, active status, profile,
and role assignments. Authentication identity is never treated as business
profile data.

### Roles

Named permission sets scoped to a club or platform default. Roles are data so
future roles can be added without changing entity code.

### Menu Item

An editable catalog item with name, description, price, category, image,
availability, preparation station, and optional inventory link.

### Order

A customer-submitted round with status, totals, table session, customer
session, business day, and item snapshots.

### Order Item

A normalized line item with quantity, price snapshot, menu reference, station
route, and inventory link snapshot.

### Preparation Station

A configurable production destination such as bar, kitchen, grill, or nyama
choma station.

### Kitchen Ticket

A station-specific work ticket created from order items. A single order can
produce multiple tickets.

### Song Request

A selected music request with artist metadata, queue state, requester
session, duplicate key, skip reason, and DJ outcome.

### Payment

A payment attempt or verified payment for a table session. It includes method,
amount, provider reference, status, payer, verification actor, and business
day.

### Payment Token

A single-use, expiring token for a split-bill contributor. It limits access to
payment contribution only and never grants ordering or dashboard access.

### Inventory Item

Stock definition with unit, current derived balance, low-stock threshold,
supplier metadata, and menu links.

### Inventory Transaction

An append-only sale, restock, waste, or adjustment entry. Stock is derived from
transactions; sales never directly edit a stock quantity.

### Notification

A role- or user-targeted operational message with priority, read state,
related record, and timestamp.

### Audit Log

Permanent compliance and accountability record containing actor, action,
target, before/after summary, request metadata, and timestamp.

### Business Day

The reporting and operational boundary for a club. Closing a business day
archives references to sales, payments, inventory, staff activity, and
timeline facts without deleting historical data.

### Settings

Centralized editable business configuration: branding, currency, business
hours, tills, taxes, service charges, notification preferences, DJ defaults,
kitchen defaults, and future printer settings.

### Analytics

Derived facts and aggregates sourced from orders, payments, inventory
transactions, tickets, songs, staff activity, and business days. Analytics
never becomes the source of operational truth.

### Activity Feed

An administrator-facing projection of meaningful business changes. It is
optimized for human review and links to the source record and audit event.

### Service Timeline

A customer-visible chronological projection of actions affecting their table
session, such as order accepted, kitchen ready, payment waiting, or table
closed.

### Relationships

- Club is the tenant root.
- Club has tables, settings, roles, staff memberships, stations, menu items,
  inventory items, and business days.
- Table has one active table session; a table session has customer sessions,
  orders, payments, song requests, timeline events, and payment tokens.
- Orders have order items; order items create station-specific kitchen tickets
  and inventory sale transactions.
- Staff act on tickets, payments, inventory, settings, business days, and
  requests according to roles.
- Domain commands may create notification, audit, analytics, activity-feed,
  and service-timeline projections without duplicating source entities.

## 4. Firestore Design

Firestore is the planned realtime persistence adapter. The domain package
defines collection names and document contracts without importing the Firebase
SDK. This keeps the architecture testable and allows local adapters during
development.

| Collection | Purpose | Key relationships | Initial index considerations |
| --- | --- | --- | --- |
| `clubs` | Tenant identity and high-level configuration | Root of all tenant data | `slug`, `active` |
| `tables` | Physical tables and QR state | `clubId` | `clubId + status`, `clubId + number` |
| `tableSessions` | Active and historical table visits | `clubId`, `tableId`, `businessDayId` | `clubId + tableId + status`, `clubId + openedAt` |
| `customerSessions` | Anonymous customer participation | `clubId`, `tableSessionId` | `tableSessionId + expiresAt` |
| `orders` | Customer order rounds | `clubId`, `tableSessionId`, `businessDayId` | `clubId + status + createdAt`, `tableSessionId + createdAt` |
| `orderItems` | Order line items and price snapshots | `orderId`, `menuItemId`, `stationId` | `orderId`, `stationId + status` |
| `menuItems` | Editable catalog | `clubId`, `stationId`, `inventoryItemId` | `clubId + category + available`, `clubId + sortOrder` |
| `preparationStations` | Production destinations | `clubId` | `clubId + active` |
| `kitchenTickets` | Station work queues | `clubId`, `orderId`, `stationId` | `stationId + status + createdAt`, `clubId + businessDayId` |
| `songRequests` | DJ queue and outcomes | `clubId`, `tableSessionId`, `businessDayId` | `clubId + status + queuePosition`, `clubId + duplicateKey` |
| `staff` | Club staff profiles and membership | `clubId`, Firebase `uid` | `clubId + uid`, `clubId + active` |
| `roles` | Role definitions and permissions | `clubId` | `clubId + name` |
| `inventoryItems` | Stock definitions | `clubId` | `clubId + active`, `clubId + lowStock` |
| `inventoryTransactions` | Append-only stock ledger | `clubId`, `inventoryItemId`, `businessDayId` | `inventoryItemId + createdAt`, `clubId + type + createdAt` |
| `payments` | Payment attempts and verification | `clubId`, `tableSessionId`, `businessDayId` | `tableSessionId + status`, `clubId + method + createdAt` |
| `paymentTokens` | Split-bill contributor access | `clubId`, `tableSessionId`, `paymentId` | `tokenHash`, `tableSessionId + status` |
| `serviceTimeline` | Customer-visible event projection | `clubId`, `tableSessionId` | `tableSessionId + occurredAt` |
| `notifications` | Staff/customer operational messages | `clubId`, recipient, related record | `recipientId + readAt + createdAt`, `role + priority` |
| `auditLogs` | Permanent accountability trail | `clubId`, actor, target, business day | `clubId + createdAt`, `targetType + targetId` |
| `businessDays` | Daily operational boundary | `clubId` | `clubId + status`, `clubId + openedAt` |
| `settings` | Central editable configuration | `clubId` | `clubId + key` |
| `analyticsFacts` | Immutable source facts for aggregation | `clubId`, business day | `clubId + metric + occurredAt` |
| `analyticsAggregates` | Derived reporting summaries | `clubId`, business day | `clubId + period + metric` |
| `activityFeed` | Admin operational projection | `clubId`, business day | `clubId + occurredAt`, `actorId + occurredAt` |

### Scalability considerations

- Use tenant-scoped paths or mandatory `clubId` filters consistently.
- Keep large order item arrays normalized when independent querying is needed.
- Use immutable event/fact collections for audit, inventory, analytics, and
  timeline history.
- Keep customer realtime queries limited to the active table session.
- Use server-side aggregation for reports rather than loading all history into
  clients.
- Design idempotency keys for QR session creation, order submission, payment
  callbacks, and inventory transactions.
- Treat Firestore security rules as a second authorization boundary, not as a
  replacement for application services.

## 5. Repository Layer

Repositories are interfaces in the domain/application boundary and concrete
implementations in infrastructure. Services depend on interfaces, never on
Firestore SDK calls.

- **ClubRepository:** Reads tenant identity and active-club configuration.
  Used by session, settings, authorization, and analytics services.
- **TableRepository:** Reads and transactionally updates table state. Used by
  table-session and waiter services.
- **TableSessionRepository:** Creates, locks, reads, and closes table sessions.
  Used by table-session, order, payment, timeline, and notification services.
- **CustomerSessionRepository:** Creates, expires, and validates anonymous
  session scopes. Used by QR and customer access services.
- **StaffRepository:** Resolves Firebase users to club memberships and roles.
  Used by authentication and authorization services.
- **RoleRepository:** Reads permission definitions. Used by authorization and
  settings services.
- **MenuRepository:** Reads and manages menu items. Used by catalog and order
  services.
- **StationRepository:** Reads preparation stations. Used by order routing and
  kitchen services.
- **OrderRepository:** Stores order and item snapshots. Used by order,
  payment, timeline, inventory, and analytics services.
- **KitchenTicketRepository:** Stores ticket status transitions. Used by
  kitchen, bartender, waiter, notification, and timeline services.
- **SongRepository:** Stores requests and queue transitions. Used by DJ and
  customer services.
- **PaymentRepository:** Stores attempts, verification, and reconciliation.
  Used by payment, table-session, notification, and audit services.
- **PaymentTokenRepository:** Creates and redeems hashed split-bill tokens.
  Used only by payment services.
- **InventoryRepository:** Reads item balances and appends transactions. Used
  by inventory, order, and reporting services.
- **NotificationRepository:** Persists and acknowledges notifications. Used by
  notification and role services.
- **ServiceTimelineRepository:** Appends customer-visible events. Used by
  table-session, order, kitchen, DJ, and payment services.
- **AuditRepository:** Appends and queries permanent audit records. Used by
  every mutating administrative or operational service.
- **SettingsRepository:** Reads and updates centralized settings. Used by all
  configuration-aware services.
- **AnalyticsRepository:** Stores facts and reads aggregates. Used by
  analytics, business-day, and reporting services.
- **ActivityFeedRepository:** Stores admin-facing projections. Used by audit,
  settings, business-day, and operations services.
- **BusinessDayRepository:** Opens, closes, and reads the active business day.
  Used by all daily operational services.

## 6. Service Layer

- **TableSessionService:** Validates QR context, creates the table owner,
  prevents duplicate active owners, and closes sessions after verified payment
  and authorized release.
- **OrderService:** Validates customer session access, snapshots menu prices,
  creates orders, routes items to stations, and emits timeline/notification
  events.
- **PaymentService:** Creates payment attempts, manages split contributors,
  handles provider callbacks, verifies cash/M-Pesa evidence, and refuses
  unauthorized table closure.
- **InventoryService:** Appends sale/restock/waste/adjustment transactions,
  calculates balances, and generates low-stock signals.
- **KitchenService:** Manages station tickets and status transitions for bar
  and kitchen workflows.
- **DJService:** Manages search-selected requests, duplicate prevention, queue
  positions, playback, skip reasons, and DJ profile data.
- **NotificationService:** Creates, scopes, prioritizes, and acknowledges
  realtime notifications.
- **AnalyticsService:** Converts source events into facts and calculates
  derived metrics without changing operational records.
- **BusinessDayService:** Opens and closes daily operations and creates the
  archival/reporting boundary.
- **SettingsService:** Validates editable business settings and publishes
  configuration changes.
- **AuditService:** Appends permanent audit records for sensitive actions.
- **ActivityFeedService:** Projects important audit and operational events into
  an administrator-readable feed.
- **AuthorizationService:** Resolves actor identity, club membership, role,
  and permission before application commands execute.
- **ServiceTimelineService:** Converts customer-relevant domain events into
  table-session timeline entries.

## 7. Authentication and Authorization

Staff authentication will use Firebase Authentication. The Firebase UID is
resolved to a staff membership in the active club. A signed-in identity is not
automatically authorized to access any club or operation.

Staff login flow:

1. Firebase authenticates the staff member.
2. API verifies the Firebase token.
3. Staff repository resolves active club memberships and roles.
4. Authorization service produces a request-scoped actor.
5. Application services check explicit permissions before mutation.
6. Login and sensitive actions create audit records.

Permission boundaries are server-enforced and mirrored in Firestore rules.
Navigation is only a convenience boundary. Administrators can manage
settings, staff, menu, tables, inventory, business days, and reports. Waiters
manage table service, orders, payment verification, and table release.
Bartenders and kitchen staff manage only their station tickets. DJs manage
music queue and profile data.

Customer temporary sessions are created from validated QR context and scoped
to one table session. They can read the customer projection and submit allowed
commands only. Payment contributor sessions are even narrower: they can
submit a single token-bound contribution and cannot order, browse the menu, or
access the dashboard.

## 8. Notification Architecture

Notifications are persisted operational messages, not the source of truth.

Lifecycle:

1. An application service commits a state change.
2. Notification service creates one or more role/recipient-scoped records.
3. Authorized realtime listeners receive the new record.
4. The client displays priority and unread state.
5. The recipient acknowledges read state through a validated command.
6. Historical notifications remain queryable for operations and audit context.

Recipients include customers in an active table session, waiters,
bartenders, kitchen staff, DJs, administrators, or a specific staff member.
Priority levels are `low`, `normal`, `high`, and `urgent`. Examples include
new order, ticket ready, waiter call, song request, payment waiting, low
stock, and business-day reminder.

## 9. Audit Log Architecture

Audit logs are permanent accountability records. They record actor, club,
action, target, timestamp, request context, reason, and safe before/after
summary. Sensitive values and credentials are never written to audit logs.

Examples:

- Login and logout
- Price or setting changed
- Inventory adjusted
- Payment verified
- Table opened or closed
- Business day opened or closed
- Staff role changed

Audit logs differ from:

- **Notifications:** transient operational messages addressed to recipients.
- **Service Timeline:** customer-readable events for one table session.
- **Activity Feed:** administrator-friendly projection of important events.

An audit record can produce a notification, activity-feed entry, or timeline
entry, but those projections do not replace the audit record.

## 10. Settings Module

Every business-specific value comes from a validated settings object scoped to
`clubId`. Settings include:

- Club branding, display name, logo, and theme
- Currency and number formatting
- Business hours and timezone
- M-Pesa and cash till numbers
- Taxes and service charges
- Notification preferences
- DJ defaults and queue policy
- Kitchen defaults and station behavior
- Future printer configuration

Settings are versioned when needed, validated before write, cached for reads,
and audited on change. The mobile and customer applications consume a
settings projection rather than embedding business values in components.

## 11. Analytics Layer

Analytics is a read-optimized layer sourced from immutable operational facts:
orders, order items, payments, inventory transactions, preparation tickets,
song requests, staff actions, business days, and service events.

Planned metrics include:

- Top-selling drinks and food
- Average table spend
- Peak hours
- Most requested and skipped songs
- Kitchen and bartender performance
- Inventory trends
- Staff performance
- Revenue trends

Operational writes create analytics facts through application services. Batch
or scheduled aggregation creates reports and summaries. Analytics is never used
to decide whether an order, payment, stock movement, or table closure is valid.

## 12. Activity Feed

The Admin Activity Feed is a human-readable operational projection. It shows
events such as price changed, menu item disabled, staff role changed, table
closed, payment verified, stock adjusted, business day opened, and report
generated.

It differs from:

- **Notifications:** targeted messages requiring attention.
- **Service Timeline:** customer-facing events for one table.
- **Audit Logs:** complete permanent accountability records.

The feed links to the source record and audit entry, supports filtering by
actor/type/time/business day, and may be denormalized for fast admin review.

## 13. Folder Structure

```text
/
├── ARCHITECTURE.md
├── ROADMAP.md
├── docs/
│   ├── architecture/       Decisions and diagrams
│   ├── modules/            Module contracts and verification notes
│   └── decisions/          Durable architecture decisions
├── artifacts/
│   ├── customer-web/       Customer-only QR web application
│   ├── club-ordering-mobile/ Authenticated staff Expo application
│   ├── api-server/         HTTP and realtime API transport
│   └── mockup-sandbox/     Design exploration surface
├── lib/
│   ├── domain/             Entities, values, ports, statuses, invariants
│   ├── application/        Use cases and service orchestration
│   ├── infrastructure/     Provider adapters and external implementations
│   ├── api-spec/           OpenAPI source and code generation
│   ├── api-client-react/   Generated React Query client
│   ├── api-zod/            Generated request/response validation
│   ├── db/                 Persistence schema and database adapters
│   └── integrations/       Firebase, M-Pesa, music, messaging, printers
└── scripts/                 Build and validation automation
```

Within applications:

- `ui/` contains screens and visual components only.
- `domain/` contains app-local domain adapters only when shared domain is not
  appropriate.
- `application/` contains hooks and commands that call service ports.
- `infrastructure/` contains storage and provider implementations.
- `components/` contains reusable presentation components.
- `services/` contains application service composition.
- `repositories/` contains repository implementations or adapters.
- `types/` contains transport/UI-only types.
- `hooks/` contains React hooks over application queries and mutations.
- `utils/` contains pure formatting and small utility functions.
- `config/` contains environment and editable default configuration.

## 14. Coding Standards

- Follow Clean Architecture: dependencies point inward toward domain
  contracts.
- Apply SOLID principles, especially dependency inversion for repositories and
  integrations.
- Use TypeScript strict mode and explicit public types.
- Use PascalCase for types/classes/components, camelCase for functions and
  values, and kebab-case for route/file names where the framework convention
  permits.
- Keep one responsibility per module and avoid large context files.
- Prefer reusable components with explicit props over duplicated screens.
- Keep business rules in pure domain/application functions where possible.
- Validate all API input at boundaries with shared schemas.
- Test domain rules and service behavior without a network or UI runtime.
- Test repository adapters against emulator/fixture boundaries separately.
- Use integration tests for authorization, session locking, payment
  verification, and inventory ledger invariants.
- Use UI tests for customer-critical flows and role-specific navigation.
- Use React Query or equivalent query state for server data; local state is
  for ephemeral presentation state only.
- Document business rules, security boundaries, collection indexes, and
  decisions in `docs/`.
- Run typecheck, bundle/build validation, and relevant module tests before a
  module is marked complete.

## 15. Future Integrations

Integration ports are defined in the application boundary and implemented in
infrastructure:

- **M-Pesa:** payment initiation, callbacks, reconciliation, and verification.
- **Printers:** station and receipt printer adapters.
- **Receipt printing:** receipt rendering and delivery adapter.
- **SMS and email:** notification delivery providers.
- **Loyalty programs:** customer identity and rewards adapter.
- **Reservations and online bookings:** booking/session adapter.
- **Multiple branches and clubs:** tenant and location hierarchy adapters.

These integrations are intentionally not implemented in the architecture
phase. The port boundary prevents provider-specific code from leaking into
domain rules or UI screens.
