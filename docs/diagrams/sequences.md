# LoungeOS Sequence Diagrams

## Customer scans QR and opens a session

```mermaid
sequenceDiagram
  participant C as Customer
  participant API as API
  participant S as TableSessionService
  participant F as Firestore
  C->>API: open /customer/tables/{tableId}
  API->>S: open(club, tableId, deviceId)
  S->>F: read table identity and lifecycle state
  F-->>S: available table
  S->>F: owner transaction
  F-->>S: table active and customer session created
  S-->>API: scoped session + server-generated recovery token
  API-->>C: customer session token and recovery token
```

## Waiter opens a manual table and approves a customer

```mermaid
sequenceDiagram
  participant W as Waiter
  participant C as Customer
  participant API as API
  participant S as Session service
  participant F as Firestore
  W->>API: POST /staff/table-sessions/manual
  API->>S: openManual(tableId, staff actor)
  S->>F: staff session transaction
  F-->>S: active staff-controlled session
  C->>API: open/join with permanent table identity
  API->>S: open/join(tableId, deviceId)
  S->>F: create pending customer session
  F-->>S: pending-approval session
  S-->>C: read-only session + shared bill access
  W->>API: POST /staff/table-sessions/{id}/join-requests
  API->>S: approveJoin(customerSessionId, staff actor)
  S->>F: approve customer session
  F-->>S: approved temporary read-only session
  S-->>C: approved status on next poll
```

## Permanent QR reuse after a turnover

```mermaid
sequenceDiagram
  participant C as Customer
  participant API as API
  participant S as Session service
  participant F as Firestore
  C->>API: scan permanent QR containing clubId + tableId
  API->>S: open(tableId, deviceId)
  S->>F: read current table lifecycle
  alt table available
    S->>F: create customer-owned active session
  else table active
    S->>F: reject ordinary new owner join or create pending manual join
  else table finishing
    S-->>API: reject while waiter completes closure
  end
  S-->>C: scoped status and access level
  Note over C,F: QR identity is stable; no QR secret is required for canonical authorization.
```

## Pay Now on an active waiter-controlled table

```mermaid
sequenceDiagram
  participant W as Waiter
  participant C as Customer
  participant API as API
  participant S as Session service
  participant F as Firestore
  C->>API: submit cash or till payment
  API->>S: submitPayment(customer actor)
  S->>F: create pending payment for current running balance
  W->>API: verify payment
  API->>S: verifyPayment(staff actor)
  S->>F: mark payment verified and applied to running cycle
  S->>F: reset runningTotalMinor; keep session active
  F-->>C: next poll shows zero current balance and active table
  Note over C,F: Historical applied payments remain excluded from later Pay Now cycles.
```

## Session recovery

```mermaid
sequenceDiagram
  participant C as Customer
  participant API as API
  participant S as Session service
  participant F as Firestore
  C->>API: recovery token + customer session id
  API->>S: recover
  S->>F: verify token hash and active session
  F-->>S: authorized scope
  S->>F: persist restored heartbeat
  S-->>API: restored session
```

## Notification flow

```mermaid
sequenceDiagram
  participant Service as Application service
  participant Repo as NotificationRepository
  participant FS as Firestore
  participant Listener as Authorized listener
  Service->>Repo: createNotification
  Repo->>FS: create notification
  FS-->>Listener: realtime change
  Listener->>Repo: markDelivered / markRead
  Repo->>FS: update lifecycle fields
```

## Staff authentication flow

```mermaid
sequenceDiagram
  participant Staff as Staff app
  participant Auth as Firebase Auth
  participant API as API
  participant Repo as Staff/Role repositories
  Staff->>Auth: sign in
  Auth-->>Staff: Firebase ID token
  Staff->>API: protected request
  API->>Auth: verify token
  API->>Repo: resolve club membership and role
  Repo-->>API: permissions
  API-->>Staff: authorized response
```

## Waiter operations and finishing queue

```mermaid
sequenceDiagram
  participant Staff as Authenticated waiter app
  participant API as Staff API
  participant Auth as Firebase Auth
  participant Repo as Firestore repositories
  participant Customer as Customer app

  Staff->>API: GET /v1/staff/tables
  API->>Auth: verify Firebase bearer token
  API->>Repo: resolve club staff, roles, tables, sessions and related records
  Repo-->>API: live table operations read model
  API-->>Staff: tables, orders, payments, joins, requests and timeline

  Customer->>API: request Close Tab
  API->>Repo: set session awaiting-payment and table finishing
  Repo-->>Customer: finishing status
  Staff->>API: verify submitted payment
  API->>Repo: persist verified payment and apply settlement
  Staff->>API: Reopen Tab or Close Table
  alt Reopen Tab
    API->>Repo: set session active and table active
    Repo-->>Customer: ordering available again
  else Close Table
    API->>Repo: expire customer sessions and release table
    Repo-->>Customer: session closed
    Repo-->>Staff: permanent QR remains reusable
  end
```

## Payment lifecycle

```mermaid
sequenceDiagram
  participant Customer
  participant PaymentService
  participant Provider as Payment provider
  participant Firestore
  Customer->>PaymentService: create payment attempt
  PaymentService->>Provider: initiate payment
  Provider-->>PaymentService: callback/reference
  PaymentService->>Firestore: verify and persist payment
  PaymentService->>Firestore: publish payment projections
```

## Order lifecycle

```mermaid
sequenceDiagram
  participant Customer
  participant OrderService
  participant Firestore
  participant Station as Preparation station
  Customer->>OrderService: submit order
  OrderService->>Firestore: validate menu and stock
  OrderService->>Firestore: create order and tickets
  Firestore-->>Station: realtime ticket
  Station->>Firestore: update preparation state
