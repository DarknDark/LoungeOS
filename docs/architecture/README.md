# LoungeOS Architecture Reference

LoungeOS is organized as a tenant-scoped Clean Architecture system:

```mermaid
flowchart TD
  UI[Expo staff app / customer web] --> API[API transport]
  API --> APP[Application services]
  APP --> DOMAIN[Domain entities and ports]
  APP --> BUS[Internal event bus]
  DOMAIN --> REPO[Repository interfaces]
  REPO --> INFRA[Infrastructure adapters]
  INFRA --> FS[(Firestore)]
  INFRA --> AUTH[Firebase Authentication]
  BUS --> PROJ[Audit / notification / timeline projections]
```

The application and domain layers do not import Firebase. Firebase Admin is
created only by the infrastructure composition root. There is no alternate
database or in-memory runtime fallback.

## Layer dependency diagram

```mermaid
flowchart LR
  domain[domain] --> application[application]
  application --> api[api-server]
  infrastructure[infrastructure] --> application
  infrastructure --> domain
  api --> infrastructure
  api --> application
```

Dependencies point inward toward contracts. UI code calls API/application
boundaries and never writes Firestore directly.

## Workspace dependency diagram

```mermaid
flowchart TD
  mobile[club-ordering-mobile]
  server[api-server]
  server --> application
  server --> infrastructure
  application --> domain
  infrastructure --> domain
  apiSpec[api-spec] --> apiReact[api-client-react]
  apiSpec --> apiZod[api-zod]
```

## Service interaction

```mermaid
sequenceDiagram
  participant Route as API route
  participant Session as TableSessionService
  participant Repo as Firestore repositories
  participant Audit as AuditRepository
  participant Bus as EventBus
  participant Proj as Notification/Timeline

  Route->>Session: validate command and actor
  Session->>Repo: transactionally mutate source records
  Session->>Audit: append sanitized audit record
  Session->>Bus: publish domain event
  Session->>Proj: persist customer/operational projections
  Session-->>Route: response
```

## Infrastructure hardening principles

- Firestore is the authoritative persistence provider.
- All tenant-owned paths are scoped below `clubs/{clubId}`.
- Audit data is append-only and sanitized.
- Notifications and timelines are projections, not operational truth.
- Version checks are transactional where repository support is available.
- Soft-deleted records are ignored by default.
- Realtime subscriptions are read projections and cannot mutate source state.
- Offline synchronization carries an expected version for conflict detection.
- Secret values and customer tokens are excluded from audit metadata.
