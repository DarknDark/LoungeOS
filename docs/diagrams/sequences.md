# LoungeOS Sequence Diagrams

## Customer scans QR and opens a session

```mermaid
sequenceDiagram
  participant C as Customer
  participant API as API
  participant S as TableSessionService
  participant F as Firestore
  C->>API: validate QR
  API->>S: validateQr(club, table, token)
  S->>F: read table and QR hash
  F-->>S: valid table
  S-->>API: table context
  C->>API: create session
  API->>S: createFromQr
  S->>F: owner transaction
  F-->>S: table locked and session created
  S-->>API: scoped session + recovery token
```

## Guest joins an existing session

```mermaid
sequenceDiagram
  participant G as Guest
  participant API as API
  participant S as Session service
  participant F as Firestore
  G->>API: join with QR and device id
  API->>S: join
  S->>F: validate table/session
  S->>F: participant transaction
  F-->>S: contributor accepted
  S-->>API: participant session token
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
