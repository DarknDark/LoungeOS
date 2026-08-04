# API Reference

The canonical transport contract is `lib/api-spec/openapi.yaml`. Generated
clients and validators must be regenerated after changing that specification.

## Module 2 endpoint catalogue

| Method | Endpoint | Authentication |
| --- | --- | --- |
| POST | `/api/v1/customer/tables/{tableId}/validate` | QR token |
| POST | `/api/v1/customer/table-sessions` | QR token |
| POST | `/api/v1/customer/table-sessions/{sessionId}/join` | QR token |
| POST | `/api/v1/customer/table-sessions/recover` | recovery token |
| POST | `/api/v1/customer/table-sessions/{sessionId}/heartbeat` | customer session token |
| GET | `/api/v1/customer/table-sessions/{sessionId}` | customer session token |
| DELETE | `/api/v1/customer/table-sessions/{sessionId}` | Firebase staff token + permission |

Customer session headers:

- `X-Club-Id` for QR validation.
- `X-Customer-Session-Id` for scoped customer access.
- `X-Customer-Session-Token` for scoped customer access.

## Session creation example

```json
{
  "clubId": "club-1",
  "tableId": "table-1",
  "qrToken": "opaque-qr-token",
  "deviceId": "device-installation-id"
}
```

Response tokens are opaque. Only token hashes are persisted.

## Standard errors

| Code | Meaning |
| --- | --- |
| `TABLE_ALREADY_OCCUPIED` | A table already has an active owner |
| `SESSION_EXPIRED` | The table or customer session has expired |
| `INVALID_QR` | The QR token is invalid or expired |
| `PAYMENT_REQUIRED` | A closure requires verified payment |
| `ORDER_NOT_FOUND` | The requested order does not exist |
| `ITEM_OUT_OF_STOCK` | The requested item cannot be ordered |
| `NOT_AUTHORIZED` | The actor lacks the required scope or permission |
| `BUSINESS_DAY_CLOSED` | The club has no open operational day |
| `CONFLICT` | A concurrent update or duplicate mutation was detected |
| `STALE_VERSION` | The submitted version is older than Firestore |
| `CONFIGURATION_INVALID` | Required club settings are missing or invalid |
| `FIREBASE_NOT_CONFIGURED` | Required Firebase Secrets are unavailable |

Error responses never include credentials, token values, or private keys.
