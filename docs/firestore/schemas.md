# Firestore Entity Relationships

```mermaid
erDiagram
  CLUB ||--o{ TABLE : owns
  TABLE ||--o{ TABLE_SESSION : hosts
  TABLE_SESSION ||--o{ CUSTOMER_SESSION : contains
  TABLE_SESSION ||--o{ ORDER : receives
  TABLE_SESSION ||--o{ PAYMENT : settles
  TABLE_SESSION ||--o{ SERVICE_TIMELINE : projects
  CLUB ||--o{ STAFF : employs
  STAFF }o--o{ ROLE : assigned
  ORDER ||--o{ KITCHEN_TICKET : routes
  MENU_ITEM ||--o{ ORDER : snapshots
  INVENTORY_ITEM ||--o{ INVENTORY_TRANSACTION : records
  CLUB ||--o{ AUDIT_LOG : records
  CLUB ||--o{ NOTIFICATION : emits
  CLUB ||--o{ BUSINESS_DAY : operates
```

All entities are tenant-scoped through `clubId`. Operational source records
remain separate from projections such as notifications, service timeline,
activity feed, and analytics facts.

## Relationships

- A table has at most one active table session.
- A table session has one owner customer session and zero or more participants.
- Orders, payments, songs, and service events reference the table session.
- Audit logs reference the actor and mutated resource without replacing it.
- Notifications target a staff role, staff member, or customer session.
- Offline queue items reference a resource type/id and expected version.
