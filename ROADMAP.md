# LoungeOS Master Implementation Roadmap

## 1. Roadmap Status

This document is the master implementation sequence for LoungeOS after the
architecture foundation.

| Area | Status |
| --- | --- |
| Module 1 — Architecture Refactor | ✅ Complete |
| Module 1.5 — Firebase Environment Preparation | ✅ Complete |
| Module 2 — Customer Table Session Engine | ⬜ Awaiting approval |
| Modules 3–11 | ⬜ Planned |

No Module 2 production feature work is authorized by this document. Each module
must be approved, implemented, tested, documented, and verified before the next
module begins.

## 2. Product Boundaries

LoungeOS has two separate products sharing domain contracts and server
application services:

1. **Customer Web App**
   - Opens from a table QR code.
   - Requires no download and no customer account.
   - Uses a temporary, scoped customer session.
   - Exposes only customer ordering, service, music, bill, payment, and
     table-session actions.
2. **Staff Expo Mobile App**
   - Uses Firebase Authentication.
   - Enforces club membership, role, and permission checks on the server.
   - Provides separate role-specific surfaces for administrators, waiters,
     bartenders, kitchen staff, and DJs.

The existing mobile prototype remains a visual and interaction reference until
the relevant production modules replace its local data ownership. No module may
merge customer navigation and staff navigation.

## 3. Architecture Constraints

- Firestore is the authoritative operational database.
- Firebase Authentication is the staff identity provider.
- Firebase Admin initialization reads only from Replit Secrets.
- There is no PostgreSQL, in-memory, or silent fallback persistence path.
- Domain code remains provider-neutral.
- Application services depend on repository and integration interfaces.
- API routes validate input, authenticate actors, authorize actions, and call
  application services; they do not contain business rules.
- Firestore rules are a second authorization boundary, not a replacement for
  server authorization.
- Operational source records are distinct from notifications, audit logs,
  analytics facts, activity-feed entries, and customer timeline projections.
- Inventory history, payments, audit logs, and business-day history are
  append-only or historically preserved.
- Customer sessions are anonymous and temporary.
- Payment contributor tokens grant payment contribution only; they never grant
  ordering, menu, dashboard, or general table-session access.
- No provider credentials, payment secrets, or customer-facing UI may be
  hardcoded.
- No module may redesign the existing visual language unless a later product
  decision explicitly authorizes it.

## 4. Shared Firestore Model

All tenant-owned documents carry `clubId`. The standard tenant path is:

```text
clubs/{clubId}/{collection}/{documentId}
```

The following collections are shared across modules:

| Collection | Ownership and purpose |
| --- | --- |
| `clubs` | Tenant identity, active configuration, and business-day reference |
| `tables` | Physical tables, QR state, capacity, and operational status |
| `tableSessions` | One table visit, owner, participants, running bill, and lifecycle |
| `customerSessions` | Anonymous browser/device sessions scoped to a table session |
| `menuItems` | Food and drink catalog, availability, pricing, modifiers, and station links |
| `preparationStations` | Kitchen, bar, pork, nyama choma, and future production stations |
| `orders` | Customer order rounds and immutable totals/status history |
| `orderItems` | Normalized order lines with price and routing snapshots |
| `kitchenTickets` | Station-specific production work derived from order items |
| `songRequests` | Search-selected requests and DJ queue lifecycle |
| `staff` | Firebase UID to club membership, active status, and role assignments |
| `roles` | Configurable roles and permissions |
| `payments` | Payment attempts, contributions, provider references, and verification |
| `paymentTokens` | Hashed, scoped, expiring, single-use contributor access |
| `inventoryItems` | Products, ingredients, units, thresholds, and supplier links |
| `inventoryTransactions` | Append-only stock ledger |
| `notifications` | Recipient- and role-scoped realtime operational messages |
| `serviceTimeline` | Customer-visible chronological session events |
| `auditLogs` | Permanent accountability records |
| `activityFeed` | Administrator-facing operational projection |
| `businessDays` | Daily operational and reporting boundary |
| `analyticsFacts` | Immutable operational facts for derived reporting |
| `analyticsAggregates` | Derived dashboard summaries |
| `settings` | Versioned club configuration |

Collection-specific indexes, idempotency records, and retention rules must be
documented with the module that introduces them.

## 5. Shared API Conventions

All production endpoints are versioned under `/api/v1`.

### Actor types

- **Anonymous customer actor:** temporary customer session scoped to one active
  table session.
- **Payment contributor actor:** token-bound actor limited to one contribution.
- **Staff actor:** Firebase ID token resolved to an active club membership,
  role, and permission set.
- **System actor:** trusted server-side event or scheduled operation.

### Response and command conventions

- Commands return the authoritative updated resource or an explicit operation
  result.
- Queries return only fields allowed for the actor and active scope.
- Mutations require idempotency keys where retries could duplicate state.
- Errors use stable codes, safe messages, and no credential/provider secrets.
- All status changes are validated against the domain lifecycle.
- Realtime updates are projections of committed authoritative state.

## 6. Module 2 — Customer Table Session Engine

### Purpose

Create the complete customer entry and table-session lifecycle from a validated
table QR code. Establish one active session owner per table while allowing
scoped participation, reconnection, recovery, and multi-device support.

### Features

- Signed or otherwise validated QR table access.
- Table existence, club scope, active status, and QR validity checks.
- One active table session owner per table.
- Anonymous customer-session creation.
- First successful customer becomes the table-session owner.
- Additional guests join as contributors to the active table session.
- Session timeout and explicit expiry.
- Guest reconnection after browser refresh or temporary disconnect.
- Multi-device participation within one table session.
- Session recovery using a scoped recovery credential.
- Running-tab initialization at session creation.
- Duplicate QR replay prevention and idempotent session creation.
- Table locking and safe release prerequisites.
- Customer-visible session and table state projection.

### Firestore collections

- `clubs`
- `tables`
- `tableSessions`
- `customerSessions`
- `serviceTimeline`
- `auditLogs`
- `analyticsFacts`

Required data controls:

- Transactional table lock or equivalent atomic active-session claim.
- QR nonce/version or signed context validation.
- Idempotency record for repeated QR submissions.
- Expiration timestamps for customer sessions.

### API endpoints

Customer:

- `POST /api/v1/customer/qr/validate`
- `POST /api/v1/customer/table-sessions`
- `POST /api/v1/customer/table-sessions/:sessionId/join`
- `GET /api/v1/customer/table-sessions/:sessionId`
- `POST /api/v1/customer/customer-sessions/reconnect`
- `POST /api/v1/customer/customer-sessions/:id/heartbeat`
- `POST /api/v1/customer/customer-sessions/:id/leave`

Staff/system:

- `GET /api/v1/staff/tables`
- `GET /api/v1/staff/table-sessions/:sessionId`
- `POST /api/v1/staff/table-sessions/:sessionId/release`

### Mobile screens

Customer Web App:

- QR entry
- Table validation/loading
- Session creation confirmation
- Join active table session
- Session recovery after refresh
- Invalid/expired QR
- Session expired
- Active table-session shell with running-tab summary

Staff Expo App:

- Staff table list
- Table-session detail
- Session expiry/release confirmation

### Staff dashboards

- Initial waiter table/session visibility only.
- No full Smart Waiter Mode yet; that belongs to Module 11.

### Notification events

- `table-session-created`
- `customer-session-joined`
- `customer-session-reconnected`
- `table-session-expiring`
- `table-session-expired`
- `table-session-owner-released`

### Security requirements

- QR context must be validated server-side.
- QR replay must not create a second active owner.
- Customer sessions must be scoped to one club and one table session.
- Anonymous customers cannot access staff routes or other tables.
- Recovery credentials must be scoped, expiring, and non-guessable.
- Only the owner may control table-session ownership actions.
- Firestore reads and listeners must be limited to the authorized session.
- Every mutation must use idempotency protection where retries are possible.

### Dependencies

- Module 1 domain entities, repository ports, and application-service boundary.
- Module 1.5 Firebase infrastructure and Admin initialization.
- Firebase project and Secrets for live repository verification.
- Firestore transaction support.
- Customer Web App shell and API contract generation.
- No payment provider required.

### Acceptance criteria

- A valid table QR creates one active table session.
- One table can have only one active session owner, even under concurrent scans.
- A repeated QR submission is idempotent or safely rejected.
- A second guest joins the existing session without becoming a second owner.
- Refresh and reconnect recover the authorized customer session.
- Expired sessions cannot read or mutate the table session.
- A customer cannot access another table, club, staff route, or staff data.
- A new table session starts with an empty, correctly scoped running tab.

### Estimated implementation order

1 of 10 remaining feature modules; implementation prerequisite for Modules 3–7
and 11.

## 7. Module 3 — Ordering Engine

### Purpose

Build the customer ordering system on top of an active table session, including
catalog browsing, modifiers, multiple rounds, pricing calculations, and
department routing.

### Features

- Food categories and drink categories.
- Menu search and availability filtering.
- Product modifiers and modifier pricing.
- Quantity changes.
- Special notes with safe length limits.
- Cart and pending-round review.
- Multiple order rounds per table session.
- Edit pending items before acceptance.
- Cancel pending items within the allowed lifecycle window.
- Automatic subtotal, tax, service-charge, discount, and total calculations.
- Currency and pricing rules from club settings.
- Immutable price/modifier snapshots at submission.
- Route each order item to its configured preparation station.
- Order idempotency and duplicate-submit prevention.

### Firestore collections

- `clubs`
- `settings`
- `menuItems`
- `preparationStations`
- `tableSessions`
- `customerSessions`
- `orders`
- `orderItems`
- `kitchenTickets`
- `inventoryItems`
- `auditLogs`
- `analyticsFacts`
- `serviceTimeline`
- `notifications`

### API endpoints

Customer:

- `GET /api/v1/customer/menu`
- `GET /api/v1/customer/menu/categories`
- `GET /api/v1/customer/menu/:menuItemId`
- `POST /api/v1/customer/table-sessions/:sessionId/orders`
- `GET /api/v1/customer/table-sessions/:sessionId/orders`
- `PATCH /api/v1/customer/orders/:orderId`
- `POST /api/v1/customer/orders/:orderId/cancel`
- `GET /api/v1/customer/table-sessions/:sessionId/tab`

Staff:

- `GET /api/v1/staff/orders`
- `GET /api/v1/staff/orders/:orderId`
- `POST /api/v1/staff/orders/:orderId/accept`
- `POST /api/v1/staff/orders/:orderId/cancel`

### Mobile screens

Customer Web App:

- Menu home
- Food category
- Drink category
- Menu search
- Product detail and modifiers
- Cart/round review
- Order submitted
- Pending order edit
- Running tab
- Order history/timeline

Staff Expo App:

- New orders list
- Order detail
- Order status action sheet
- Table running-tab view

### Staff dashboards

- Waiter order overview.
- Station work is displayed through the Kitchen & Production dashboards in
  Module 4, not duplicated here.

### Notification events

- `order-submitted`
- `order-accepted`
- `order-updated`
- `order-cancelled`
- `order-total-changed`
- `order-routed-to-station`

### Security requirements

- Only active customer-session participants may submit orders.
- Payment contributors cannot browse the menu or submit orders.
- Menu price, availability, modifier, and station data are resolved server-side.
- Client totals are never authoritative.
- Pending-order edit/cancel windows are enforced server-side.
- Staff order access is club- and permission-scoped.
- Notes and quantities are validated to prevent abuse.
- Duplicate order submissions must not create duplicate charges or tickets.

### Dependencies

- Module 2 active table sessions.
- Menu, station, settings, and repository adapters.
- Shared pricing/tax/service-charge policy.
- Module 4 ticket routing contract.
- Inventory recipe links from Module 8.

### Acceptance criteria

- A customer can browse searchable food and drink categories.
- Modifiers, quantities, notes, taxes, service charges, discounts, and totals
  calculate correctly from server-side settings.
- Submitted rounds preserve price and routing snapshots.
- Pending orders can be edited or cancelled only within the permitted lifecycle.
- Multiple rounds remain separately traceable to one table session.
- Each order item is routed to the correct production department.
- Duplicate submissions are rejected or returned idempotently.

### Estimated implementation order

2 of 10; begins only after Module 2 session ownership and recovery are
verified.

## 8. Module 4 — Kitchen & Production Routing Engine

### Purpose

Automatically turn submitted order items into secure station work queues and
keep customers, waiters, and production staff synchronized through lifecycle
updates.

### Features

- Automatic routing to Kitchen, Bar, Pork Station, or Nyama Choma Station.
- One order producing multiple station tickets.
- Station-specific queue ordering.
- Ticket statuses: `pending`, `accepted`, `preparing`, `ready`,
  `collected`.
- Staff assignment where configured.
- Waiter collection/hand-off tracking.
- Customer timeline updates for meaningful transitions.
- Overdue-ticket detection based on configured thresholds.
- Realtime station queue updates.
- Idempotent ticket creation from an order.

### Firestore collections

- `orders`
- `orderItems`
- `preparationStations`
- `kitchenTickets`
- `staff`
- `roles`
- `tableSessions`
- `serviceTimeline`
- `notifications`
- `auditLogs`
- `analyticsFacts`

### API endpoints

Customer:

- `GET /api/v1/customer/table-sessions/:sessionId/production-status`

Station staff:

- `GET /api/v1/staff/stations`
- `GET /api/v1/staff/stations/:stationId/tickets`
- `GET /api/v1/staff/kitchen-tickets/:ticketId`
- `POST /api/v1/staff/kitchen-tickets/:ticketId/accept`
- `POST /api/v1/staff/kitchen-tickets/:ticketId/start`
- `POST /api/v1/staff/kitchen-tickets/:ticketId/ready`
- `POST /api/v1/staff/kitchen-tickets/:ticketId/collect`

Waiter/manager:

- `POST /api/v1/staff/kitchen-tickets/:ticketId/reassign`
- `POST /api/v1/staff/kitchen-tickets/:ticketId/escalate`

### Mobile screens

Customer Web App:

- Order production status
- Item ready/collected timeline
- Delayed-order status

Staff Expo App:

- Station queue
- Ticket detail
- Ticket status controls
- Assigned/overdue tickets

### Staff dashboards

- Kitchen dashboard.
- Bar dashboard.
- Pork Station dashboard.
- Nyama Choma Station dashboard.
- Waiter production-status view.

Each station sees only tickets routed to that station, unless an explicit
manager permission grants broader visibility.

### Notification events

- `ticket-created`
- `ticket-accepted`
- `ticket-preparing`
- `ticket-ready`
- `ticket-collected`
- `ticket-overdue`
- `ticket-reassigned`
- `production-escalated`

### Security requirements

- Station staff may read and mutate only their assigned station tickets.
- Ticket transitions must follow the allowed lifecycle.
- Ticket status cannot be changed from the client without authorization.
- Staff cannot change an order’s financial totals through ticket actions.
- Ticket creation must be idempotent per order item and station.
- Customer projections reveal only their own active table session.
- Every reassignment and escalation is audited.

### Dependencies

- Module 3 order and item routing snapshots.
- Staff roles and permissions.
- Firestore realtime listeners.
- Notification and service-timeline projection contracts.
- Threshold configuration from settings.

### Acceptance criteria

- Every submitted item appears only on the responsible department dashboard.
- A single order can produce multiple independent station tickets.
- Station staff can progress only authorized tickets through valid statuses.
- Customer timeline and operational notifications update after each meaningful
  transition.
- Ticket creation is not duplicated when order processing is retried.
- Overdue work is visible to the correct waiter or manager.

### Estimated implementation order

3 of 10; depends on Module 3 and establishes production state for Modules 7, 8,
and 11.

## 9. Module 5 — Split Bill Engine

### Purpose

Implement the controlled split-payment workflow in which one customer owns the
table session, contributors receive narrowly scoped payment access, and the
table closes only after verified settlement.

### Features

- Owner requests a number of additional contributors.
- Secure, hashed, expiring payment tokens.
- QR temporarily admits only the requested contributor count.
- Contributor-only payment view.
- Contribution amount entry and validation.
- Phone number capture.
- Table-number confirmation.
- Till-number confirmation from club settings.
- M-Pesa payment initiation boundary.
- Provider callback/reconciliation boundary.
- Cash contribution recording where authorized.
- Owner dashboard showing paid, pending, and outstanding balance.
- Waiter final settlement verification.
- Token single-use, expiry, redemption, and session scoping.
- Session close only after zero outstanding balance and authorized settlement.

### Firestore collections

- `tableSessions`
- `customerSessions`
- `payments`
- `paymentTokens`
- `settings`
- `tables`
- `staff`
- `notifications`
- `serviceTimeline`
- `auditLogs`
- `analyticsFacts`

### API endpoints

Owner:

- `POST /api/v1/customer/table-sessions/:sessionId/payment-plan`
- `GET /api/v1/customer/table-sessions/:sessionId/payment-summary`
- `POST /api/v1/customer/table-sessions/:sessionId/payment-tokens`
- `GET /api/v1/customer/table-sessions/:sessionId/payments`

Contributor:

- `POST /api/v1/customer/payment-tokens/validate`
- `GET /api/v1/customer/payment-tokens/:tokenId`
- `POST /api/v1/customer/payment-tokens/:tokenId/contributions`

Provider:

- `POST /api/v1/payments/mpesa/callback`
- `POST /api/v1/payments/mpesa/reconciliation`

Waiter/manager:

- `GET /api/v1/staff/table-sessions/:sessionId/payment-summary`
- `POST /api/v1/staff/payments/:paymentId/verify`
- `POST /api/v1/staff/table-sessions/:sessionId/settle`
- `POST /api/v1/staff/table-sessions/:sessionId/close`

### Mobile screens

Customer Web App:

- Owner payment-plan setup
- Contributor-count confirmation
- Payment summary
- Contributor token entry/QR flow
- Contributor-only contribution view
- Amount and phone-number form
- Table/till confirmation
- Payment pending/success/failure
- Owner settlement status
- Session-closed confirmation

Staff Expo App:

- Payment verification queue
- Payment detail
- Settlement confirmation
- Outstanding-balance view

### Staff dashboards

- Waiter payment-verification dashboard.
- Administrator payment/reconciliation view.

### Notification events

- `payment-plan-created`
- `payment-token-created`
- `contributor-joined-payment`
- `payment-prompt-sent`
- `payment-received`
- `contribution-received`
- `payment-failed`
- `payment-token-expired`
- `balance-updated`
- `settlement-ready`
- `settlement-verified`
- `table-session-closed`

### Security requirements

- Contributors cannot access the lounge session, menu, order history, or
  dashboard.
- Tokens are stored only as hashes and are scoped to one table session.
- Tokens are single-use and expire after payment or timeout.
- The requested contributor count is enforced atomically.
- Payment amount and till number are resolved/validated server-side.
- Provider callbacks are authenticated, idempotent, and reconciled.
- Only authorized waiters/managers can verify or settle payments.
- A payment never directly closes a session.
- Sensitive phone numbers and provider payloads are minimized and protected.

### Dependencies

- Module 2 table sessions and ownership.
- Module 3 running-tab totals.
- Firebase infrastructure and secure Secrets.
- M-Pesa integration authorization and provider contract.
- Notification and realtime projection engine.
- Waiter authorization.

### Acceptance criteria

- The owner can request a fixed number of contributors.
- Exactly that number of valid contributor tokens can be redeemed.
- A contributor sees only contribution amount, phone, table, till, and payment
  controls.
- A contributor cannot order or access any customer/staff dashboard.
- Owner balances update immediately after each verified contribution.
- Expired, reused, wrong-session, and excess tokens are rejected.
- A waiter can verify final settlement.
- The table session closes only when the outstanding balance is zero and the
  settlement action is authorized.

### Estimated implementation order

4 of 10; depends on Modules 2 and 3, and gates secure payment closure.

## 10. Module 6 — DJ Request Engine

### Purpose

Provide a searchable, duplicate-safe song-request queue with DJ-controlled
playback outcomes and customer-visible realtime status.

### Features

- Song search.
- Artist search.
- Search-selected metadata snapshots.
- Duplicate request detection.
- Queue position and estimated wait.
- Playing, skipped, and completed statuses.
- Skip reasons: Low BPM, High BPM, Genre mismatch, Already played, Not found,
  and Other.
- Custom skip response when reason is Other.
- Re-request support after completed or skipped request according to policy.
- Request history.
- DJ profile with social, mix, and streaming links.

### Firestore collections

- `songRequests`
- `tableSessions`
- `customerSessions`
- `staff`
- `roles`
- `settings`
- `notifications`
- `serviceTimeline`
- `auditLogs`
- `analyticsFacts`

External music search results are accessed through an integration port; provider
credentials and raw provider payloads do not become domain source records.

### API endpoints

Customer:

- `GET /api/v1/customer/music/search`
- `GET /api/v1/customer/music/artists`
- `POST /api/v1/customer/table-sessions/:sessionId/song-requests`
- `GET /api/v1/customer/table-sessions/:sessionId/song-requests`
- `POST /api/v1/customer/song-requests/:requestId/re-request`
- `GET /api/v1/customer/dj-profile`

DJ:

- `GET /api/v1/staff/dj/queue`
- `POST /api/v1/staff/song-requests/:requestId/playing`
- `POST /api/v1/staff/song-requests/:requestId/skip`
- `POST /api/v1/staff/song-requests/:requestId/complete`
- `GET /api/v1/staff/dj/profile`
- `PATCH /api/v1/staff/dj/profile`

### Mobile screens

Customer Web App:

- Music search
- Artist/results view
- Song detail/request confirmation
- Request queue position
- Request history
- Playing/skipped/completed status
- DJ profile

Staff Expo App:

- DJ queue
- Song request detail
- Playing action
- Skip-reason action sheet
- Custom skip response
- DJ profile editor

### Staff dashboards

- DJ queue dashboard.
- DJ profile management.

### Notification events

- `song-requested`
- `song-queued`
- `song-playing`
- `song-skipped`
- `song-completed`
- `song-re-requested`
- `song-queue-position-changed`

### Security requirements

- Customers may submit requests only for their active table session.
- Duplicate keys are generated and checked server-side.
- Only authorized DJ staff can change queue status or profile data.
- Skip responses are validated and length-limited.
- Customer projections reveal only allowed request metadata.
- Provider search responses are sanitized before returning to clients.

### Dependencies

- Module 2 customer sessions.
- Firebase persistence and authorization.
- Music search integration port.
- Realtime notification and timeline projections.
- Business-day reference for request history and reporting.

### Acceptance criteria

- Customers can search by song and artist and submit a selected request.
- Duplicate songs cannot enter the active queue.
- DJ can mark a request Playing, Skip, or Complete.
- Skip requires one defined reason; Other supports a custom response.
- Customers receive realtime queue and outcome updates.
- Re-request behavior follows the configured duplicate policy.
- DJ profile links are editable only by authorized DJ/admin staff.

### Estimated implementation order

5 of 10; depends on Module 2 and the realtime notification foundation.

## 11. Module 7 — Realtime Notification Engine

### Purpose

Create one event-driven notification pipeline for customer, station, waiter, DJ,
administrator, audit, analytics, activity-feed, and service-timeline
projections without duplicating authoritative operational state.

### Features

- Domain-event publication after committed state changes.
- Notification routing by recipient, role, station, club, and table session.
- Customer notifications.
- Kitchen, bar, pork, and nyama station notifications.
- Waiter notifications.
- DJ notifications.
- Administrator notifications.
- Priority levels and read state.
- Realtime authorized listeners.
- Idempotent projection creation.
- Notification acknowledgement.
- Event correlation and source-record links.

### Firestore collections

- `notifications`
- `serviceTimeline`
- `activityFeed`
- `auditLogs`
- `analyticsFacts`
- Source collections from Modules 2–6.

### API endpoints

- `GET /api/v1/customer/table-sessions/:sessionId/notifications`
- `GET /api/v1/staff/notifications`
- `POST /api/v1/notifications/:notificationId/read`
- `POST /api/v1/notifications/read-all`
- `GET /api/v1/staff/activity-feed`
- `GET /api/v1/customer/table-sessions/:sessionId/timeline`

Internal/system:

- `POST /api/v1/internal/events/dispatch`

The internal endpoint must not be public; normal production flow uses an
application event bus or trusted worker boundary.

### Mobile screens

Customer Web App:

- Session timeline
- Notification center
- Inline order, payment, waiter, and music updates

Staff Expo App:

- Notification center
- Unread badge/state
- Activity feed entry detail
- Station and role-specific alert surfaces

### Staff dashboards

- Shared role-scoped notification center.
- Administrator activity feed.
- Station-specific alert panels.

### Notification events

- `order-received`
- `order-accepted`
- `order-preparing`
- `order-ready`
- `order-collected`
- `payment-received`
- `contribution-received`
- `song-queued`
- `song-playing`
- `song-skipped`
- `waiter-called`
- `inventory-low`
- `business-day-closed`
- `ticket-overdue`
- `table-session-expiring`

### Security requirements

- Notifications must be generated only from committed trusted events.
- Every projection is scoped to club and recipient/session authorization.
- Customers cannot subscribe to staff or other-table notifications.
- Station recipients receive only relevant station work.
- Projection processing is idempotent by event ID and projection type.
- Notification payloads exclude credentials and unnecessary personal data.
- Read acknowledgements cannot change source operational state.

### Dependencies

- Modules 2–6 event contracts.
- Firebase Firestore realtime support.
- Authorization service and actor scopes.
- Audit/activity/timeline repository ports.
- A durable event-dispatch strategy.

### Acceptance criteria

- Every supported workflow produces the correct recipient-scoped notification.
- Replaying an event does not create duplicate notifications or timeline entries.
- Customer, station, waiter, DJ, and admin streams are isolated.
- Realtime listeners receive committed changes without becoming a source of truth.
- Notification read state is persisted and does not alter operational records.

### Estimated implementation order

6 of 10; should be implemented after core event-producing workflows exist and
before the final operational dashboards are considered complete.

## 12. Module 8 — Inventory Engine

### Purpose

Track products, ingredients, recipes, purchasing, transfers, waste, damage, and
stock alerts through an append-only inventory ledger connected to completed
orders.

### Features

- Product definitions.
- Ingredient definitions.
- Recipes and menu-item ingredient quantities.
- Automatic stock deduction from completed orders.
- Purchases and supplier records.
- Transfers between locations/stations where enabled.
- Waste recording.
- Damaged-stock recording.
- Manual adjustments with authorization and reasons.
- Low-stock alerts.
- Out-of-stock alerts.
- Derived stock balance from transactions.
- Inventory valuation and business-day summary inputs.

### Firestore collections

- `inventoryItems`
- `inventoryTransactions`
- `menuItems`
- `orders`
- `orderItems`
- `preparationStations`
- `staff`
- `roles`
- `notifications`
- `auditLogs`
- `analyticsFacts`
- `businessDays`

Additional collections if procurement is enabled:

- `suppliers`
- `purchaseOrders`
- `inventoryTransfers`
- `inventoryRecipes`

### API endpoints

Staff:

- `GET /api/v1/staff/inventory/items`
- `GET /api/v1/staff/inventory/items/:itemId`
- `POST /api/v1/staff/inventory/items`
- `PATCH /api/v1/staff/inventory/items/:itemId`
- `GET /api/v1/staff/inventory/items/:itemId/ledger`
- `POST /api/v1/staff/inventory/restocks`
- `POST /api/v1/staff/inventory/transfers`
- `POST /api/v1/staff/inventory/waste`
- `POST /api/v1/staff/inventory/damaged`
- `POST /api/v1/staff/inventory/adjustments`
- `GET /api/v1/staff/inventory/alerts`
- `GET /api/v1/staff/inventory/suppliers`

Admin:

- `POST /api/v1/staff/inventory/recipes`
- `PATCH /api/v1/staff/inventory/recipes/:recipeId`

Internal/system:

- `POST /api/v1/internal/orders/:orderId/inventory-deduction`

### Mobile screens

Staff Expo App:

- Inventory overview
- Item detail and ledger
- Restock form
- Transfer form
- Waste/damage form
- Low-stock and out-of-stock alerts
- Recipe editor for authorized staff
- Supplier list

Customer Web App:

- Only availability/out-of-stock presentation from the customer menu; no
  inventory controls or inventory quantities.

### Staff dashboards

- Administrator inventory dashboard.
- Station stock/availability view.
- Supplier and procurement view where enabled.

### Notification events

- `inventory-deducted`
- `inventory-restocked`
- `inventory-transferred`
- `inventory-wasted`
- `inventory-damaged`
- `inventory-adjusted`
- `inventory-low`
- `inventory-out-of-stock`
- `menu-item-unavailable`

### Security requirements

- Only authorized staff can change inventory definitions or ledger entries.
- Every manual movement requires actor, reason, quantity, unit, and source.
- Ledger entries are append-only; corrections are compensating entries.
- Completed-order deduction is idempotent by order and recipe version.
- Inventory quantities are never accepted from the customer client.
- Supplier and cost information is staff/admin scoped.
- Cross-station or cross-club transfers require explicit permission.

### Dependencies

- Module 3 menu and order snapshots.
- Module 4 completed production/order lifecycle.
- Module 7 notifications.
- Settings and business-day context.
- Role/permission enforcement.

### Acceptance criteria

- Every completed order deducts the correct ingredients exactly once.
- Restocks, transfers, waste, damage, and adjustments append auditable entries.
- Current balances derive from the ledger.
- Low-stock and out-of-stock conditions generate appropriate notifications.
- Customers see unavailable products accurately without seeing inventory details.
- Authorized administrators can reconcile item history to source transactions.

### Estimated implementation order

7 of 10; depends on ordering, production completion, notifications, and
business-day references.

## 13. Module 9 — Business Day Engine

### Purpose

Define the daily operating boundary for sales, payments, inventory, expenses,
staff shifts, reconciliation, closing, and export without deleting historical
records.

### Features

- Open business day.
- Prevent multiple active business days per club.
- Associate new operations with the active business day.
- Cash reconciliation.
- M-Pesa reconciliation.
- Sales summary.
- Expense capture.
- Inventory summary.
- Shift reports.
- Exception and discrepancy notes.
- Daily export.
- Close business day with one authorized action.
- Preserve all source records after close.

### Firestore collections

- `businessDays`
- `clubs`
- `settings`
- `orders`
- `payments`
- `inventoryTransactions`
- `inventoryItems`
- `staff`
- `auditLogs`
- `analyticsFacts`
- `activityFeed`
- `serviceTimeline`
- `notifications`

Additional collection:

- `expenses`
- `shiftReports`
- `dailyExports`

### API endpoints

- `GET /api/v1/staff/business-days/active`
- `POST /api/v1/staff/business-days/open`
- `GET /api/v1/staff/business-days/:businessDayId/summary`
- `POST /api/v1/staff/business-days/:businessDayId/cash-reconciliation`
- `POST /api/v1/staff/business-days/:businessDayId/mpesa-reconciliation`
- `POST /api/v1/staff/business-days/:businessDayId/expenses`
- `GET /api/v1/staff/business-days/:businessDayId/inventory-summary`
- `GET /api/v1/staff/business-days/:businessDayId/shift-reports`
- `POST /api/v1/staff/business-days/:businessDayId/export`
- `POST /api/v1/staff/business-days/:businessDayId/close`

### Mobile screens

Staff Expo App:

- Active business-day status
- Open-day form
- Day summary
- Cash reconciliation
- M-Pesa reconciliation
- Expenses
- Inventory summary
- Shift reports
- Export and close confirmation

Customer Web App:

- No business-day controls.
- Customer-visible availability may show a safe closed/not-serving state.

### Staff dashboards

- Administrator business-day control center.
- Reconciliation dashboard.
- Shift and exception review.

### Notification events

- `business-day-opened`
- `business-day-closing-warning`
- `cash-reconciliation-required`
- `mpesa-reconciliation-required`
- `business-day-discrepancy`
- `business-day-closed`
- `daily-export-ready`

### Security requirements

- Only authorized administrators can open or close a business day.
- Only one active business day may exist per club.
- Closing is idempotent and protected against concurrent requests.
- Closed records cannot be silently edited; corrections are audited.
- Reconciliation evidence is access-controlled.
- Exports exclude secrets and follow data-minimization rules.
- Closing must not delete or rewrite operational history.

### Dependencies

- Modules 3–8 operational records.
- Payment provider reconciliation from Module 5.
- Inventory ledger from Module 8.
- Staff and permission enforcement.
- Analytics facts and activity-feed projections.

### Acceptance criteria

- An authorized administrator opens a business day with one action.
- New operational records associate with the correct active day.
- Cash, M-Pesa, sales, expense, inventory, and shift summaries reconcile to
  source records.
- Closing is one authorized action and cannot create duplicate close records.
- Closed history remains queryable and immutable except through audited
  correction entries.
- Daily export is generated without exposing credentials or unrelated tenants.

### Estimated implementation order

8 of 10; depends on all operational write paths and precedes final analytics
validation.

## 14. Module 10 — Analytics Engine

### Purpose

Generate operational statistics and dashboards from immutable facts without
making analytics the source of truth for orders, payments, inventory, or staff
authorization.

### Features

- Revenue dashboards.
- Order volume and status dashboards.
- Popular drinks.
- Popular food.
- Popular songs.
- DJ statistics.
- Kitchen performance.
- Bar performance.
- Staff performance.
- Customer trends using permitted anonymous aggregates.
- Average preparation time.
- Average payment time.
- Business-day and date-range filters.
- Club and role-scoped dashboard access.
- Derived aggregate refresh and backfill strategy.

### Firestore collections

- `analyticsFacts`
- `analyticsAggregates`
- `orders`
- `orderItems`
- `payments`
- `songRequests`
- `kitchenTickets`
- `inventoryTransactions`
- `staff`
- `businessDays`
- `serviceTimeline`
- `auditLogs`

### API endpoints

Administrator/manager:

- `GET /api/v1/staff/analytics/revenue`
- `GET /api/v1/staff/analytics/orders`
- `GET /api/v1/staff/analytics/products`
- `GET /api/v1/staff/analytics/songs`
- `GET /api/v1/staff/analytics/dj`
- `GET /api/v1/staff/analytics/kitchen`
- `GET /api/v1/staff/analytics/bar`
- `GET /api/v1/staff/analytics/staff`
- `GET /api/v1/staff/analytics/customers`
- `GET /api/v1/staff/analytics/preparation-times`
- `GET /api/v1/staff/analytics/payment-times`
- `GET /api/v1/staff/analytics/export`

System:

- `POST /api/v1/internal/analytics/facts`
- `POST /api/v1/internal/analytics/aggregates/rebuild`

### Mobile screens

Staff Expo App:

- Analytics overview
- Revenue and sales
- Product performance
- Music/DJ performance
- Kitchen/bar performance
- Staff performance
- Customer trend summary
- Export controls for authorized administrators

Customer Web App:

- No internal analytics screens.

### Staff dashboards

- Administrator analytics dashboard.
- Manager operational-performance dashboard.
- Role-limited station and staff metrics.

### Notification events

- `analytics-refresh-completed`
- `analytics-refresh-failed`
- `report-ready`
- `performance-threshold-reached`

Analytics notifications are operationally useful but are not required for
source data correctness.

### Security requirements

- Analytics reads are scoped by club, role, and permitted metric.
- Customer trends are aggregated and do not expose individual customer
  identities.
- Raw payment, phone, credential, and sensitive staff data is excluded from
  dashboard payloads unless explicitly authorized.
- Analytics cannot mutate operational source records.
- Fact creation is idempotent by source event.
- Aggregate rebuilds are auditable and safe to retry.

### Dependencies

- Modules 3–9 source records and business-day boundaries.
- Module 7 event projection pipeline.
- Stable analytics fact schema.
- Administrator and manager permissions.

### Acceptance criteria

- Dashboard metrics are generated from operational facts and trace back to
  source records.
- Revenue, orders, products, songs, DJ, kitchen, bar, staff, customer trends,
  preparation time, and payment time are available at the authorized scope.
- Reprocessing facts does not double-count.
- Analytics failures do not block valid orders, payments, inventory movements,
  or table sessions.
- Exports respect tenant and role boundaries.

### Estimated implementation order

9 of 10; depends on all preceding operational modules and the business-day
boundary.

## 15. Module 11 — Smart Waiter Mode

### Purpose

Give waiters a live floor-management dashboard that identifies which tables
need attention without waiting for customers to call.

### Features

- Live card for every active table.
- Green status: everything normal.
- Yellow status: customer has exceeded the configured service threshold.
- Red status: immediate attention required.
- Reasons:
  - Customer called waiter.
  - Food delayed.
  - Drinks delayed.
  - Payment requested.
  - Split payment incomplete.
  - Kitchen overdue.
  - Bar overdue.
  - Customer idle too long.
- Table number.
- Guest count.
- Running tab.
- Food status.
- Drink status.
- Kitchen status.
- Bar status.
- Song-request status.
- Payment status.
- Time since last service.
- Current priority level.
- Open table details.
- Mark table visited.
- Send updates to customer.
- Notify kitchen.
- Notify bar.
- Escalate to manager.
- Configurable thresholds from club settings.
- Realtime priority recalculation from committed operational events.

### Firestore collections

- `tables`
- `tableSessions`
- `customerSessions`
- `orders`
- `orderItems`
- `kitchenTickets`
- `payments`
- `paymentTokens`
- `songRequests`
- `notifications`
- `serviceTimeline`
- `staff`
- `roles`
- `settings`
- `activityFeed`
- `auditLogs`
- `analyticsFacts`

Optional denormalized read model:

- `waiterFloorSnapshots`

If introduced, it remains a projection and never replaces table sessions,
orders, tickets, or payments as the source of truth.

### API endpoints

Waiter:

- `GET /api/v1/staff/waiter/floor`
- `GET /api/v1/staff/waiter/tables/:tableId`
- `POST /api/v1/staff/waiter/tables/:tableId/visited`
- `POST /api/v1/staff/waiter/tables/:tableId/customer-update`
- `POST /api/v1/staff/waiter/tables/:tableId/notify-kitchen`
- `POST /api/v1/staff/waiter/tables/:tableId/notify-bar`
- `POST /api/v1/staff/waiter/tables/:tableId/escalate`

Manager:

- `GET /api/v1/staff/waiter/escalations`
- `POST /api/v1/staff/waiter/escalations/:escalationId/resolve`

### Mobile screens

Staff Expo App:

- Smart Waiter Mode floor board
- Live table card
- Table detail
- Visit confirmation
- Customer update composer
- Kitchen/bar notification action
- Manager escalation flow
- Escalation history

Customer Web App:

- Safe waiter-update message/timeline state.
- No internal priority colors or operational reasons unless product policy
  explicitly allows a customer-safe equivalent.

### Staff dashboards

- Smart Waiter live floor dashboard.
- Table detail and service timeline.
- Escalation queue.
- Manager escalation review.

### Notification events

- `waiter-attention-yellow`
- `waiter-attention-red`
- `customer-waiter-called`
- `food-delay-detected`
- `drink-delay-detected`
- `payment-requested`
- `split-payment-incomplete`
- `kitchen-overdue`
- `bar-overdue`
- `customer-idle`
- `table-visited`
- `customer-update-sent`
- `manager-escalated`
- `escalation-resolved`

### Security requirements

- Only authorized waiters can view the active floor for their club.
- Managers/admins can view and resolve escalations according to permissions.
- Customer data is minimized to what is needed for service.
- Priority calculations use server timestamps and settings, not client clocks.
- Waiter actions are audited and idempotent.
- Customer updates cannot expose internal staff notes or other tables.
- A floor snapshot, if used, must respect source-record authorization and
  eventual-consistency indicators.

### Dependencies

- Modules 2–9 operational state and events.
- Module 7 realtime notification pipeline.
- Module 9 business-day and settings boundaries.
- Waiter and manager authorization.
- Service threshold configuration.

### Acceptance criteria

- A waiter can immediately see every active table as a live card.
- Cards show table number, guests, tab, food/drink/kitchen/bar/song/payment
  states, last-service time, and priority.
- Status changes to green/yellow/red follow configured thresholds and active
  operational reasons.
- Waiter actions update the correct source/projection records and notify the
  correct team.
- Manager escalation is visible and resolvable.
- A waiter cannot see another club’s floor or modify unauthorized records.
- Realtime updates do not require customers to call before a table becomes
  visible as needing attention.

### Estimated implementation order

10 of 10; final operational module after the event, notification, business-day,
and analytics foundations are stable.

## 16. Cross-Module Verification Gates

Every module must pass these gates before approval:

1. Domain lifecycle and invariant tests.
2. Application-service tests with injected repository fakes or contract
   fixtures; no mock database is treated as production persistence.
3. Firestore adapter tests against the Firebase emulator or authorized Firebase
   project where required.
4. API contract validation and generated-client synchronization.
5. Authentication, tenant isolation, role, and permission tests.
6. Idempotency and retry tests for every externally retriable command.
7. Realtime projection and duplicate-event tests.
8. Mobile/customer route boundary tests.
9. Full TypeScript check and production build.
10. Updated module documentation, collection indexes, event list, and
    acceptance evidence.

## 17. Dependency Sequence

```text
Module 1 + 1.5
        |
        v
Module 2: Customer sessions
        |
        v
Module 3: Ordering
        |
        v
Module 4: Production routing
        |\
        | \
        |  v
        | Module 8: Inventory
        v
Module 5: Split bill
        |
        v
Module 6: DJ requests
        |
        v
Module 7: Realtime notifications
        |
        v
Module 9: Business day
        |
        v
Module 10: Analytics
        |
        v
Module 11: Smart Waiter Mode
```

The practical implementation may build shared event and authorization
infrastructure in parallel with an approved module, but no customer-facing or
staff-facing feature may bypass the module gates above.

## 18. Approval Boundary

This roadmap is documentation only. It does not authorize:

- Module 2 implementation.
- Customer Web App feature implementation.
- Staff dashboard implementation.
- Live Firebase project connection.
- M-Pesa or music-provider connection.
- UI redesign.
- Placeholder services, mock databases, or local substitutes for Firestore.

Implementation stops here and waits for explicit approval of Module 2.