# Firestore Reference

## Collection hierarchy

```text
clubs/{clubId}
└── tables/{tableId}
└── tableSessions/{tableSessionId}
└── customerSessions/{customerSessionId}
└── orders/{orderId}
└── orderItems/{orderItemId}
└── menuItems/{menuItemId}
└── preparationStations/{stationId}
└── kitchenTickets/{ticketId}
└── songRequests/{requestId}
└── staff/{staffId}
└── roles/{roleId}
└── inventoryItems/{inventoryItemId}
└── inventoryTransactions/{transactionId}
└── payments/{paymentId}
└── paymentTokens/{paymentTokenId}
└── serviceTimeline/{eventId}
└── notifications/{notificationId}
└── auditLogs/{auditId}
└── businessDays/{businessDayId}
└── settings/current
└── analyticsFacts/{factId}
└── analyticsAggregates/{aggregateId}
└── activityFeed/{entryId}
└── offlineQueue/{syncId}
```

## Core schemas

### Table

`id`, `clubId`, `number`, `label`, `status`, `activeSessionId`,
`splitSlotsRemaining`, `qrVersion`, `version`, `updatedAt`, and optional
soft-delete fields.

The canonical table lifecycle has exactly three states: `available`,
`occupied`, and `finishing-up`. Customers can request or cancel closing while
the table is occupied; only the waiter can confirm closure and return the
table to `available`. Split-payment metadata is transitional session data and
must not introduce another table lifecycle state.

Customer entry uses the permanent table ID embedded in the table QR. Secret
QR token fields are legacy-only compatibility data and are not required by the
canonical customer-entry workflow.

### Table session

`id`, `clubId`, `tableId`, `businessDayId`, `ownerCustomerSessionId`,
`status`, `runningTotalMinor`, `openedAt`, `expiresAt`, `lastActivityAt`,
`closedAt`, `version`, `updatedAt`, and optional soft-delete fields.

### Customer session

`id`, `clubId`, `tableSessionId`, `createdAt`, `expiresAt`, `expiredAt`,
`isTableOwner`, `deviceId`, `lastHeartbeatAt`, and `recoveryTokenHash`.

### Audit log

`actorId`, `actorType`, `action`, `resourceType`, `resourceId`, `timestamp`,
`metadata`, `createdAt`, and optional before/after summaries.

### Notification

`recipientId`, `recipientRole`, `category`, `priority`, `message`,
`relatedRecord`, `createdAt`, `readAt`, `deliveredAt`, and `archivedAt`.

### Service timeline event

`tableSessionId`, `type`, `message`, `sourceRecord`, and `occurredAt`.

## Indexes

The deployable index source is `firestore.indexes.json`. Current composite
indexes cover table ownership lookup, customer device lookup, notification
delivery ordering, and timeline ordering.

## Security rules

`firestore.rules` denies all direct client reads and writes. The API server
uses Firebase Admin SDK and enforces actor, club, role, customer-session, and
permission boundaries before repository operations.
