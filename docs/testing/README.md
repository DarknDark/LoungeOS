# Testing and Verification

## Unit tests

The application test command runs all `lib/application/tests/*.test.ts` files.
Coverage includes:

- QR validation and expiration
- Single-owner enforcement
- Duplicate-device protection
- Multiple-device participants
- Session recovery
- Heartbeat and expiration behavior
- Event bus dispatch
- Job registration and execution
- Metrics collection
- Notification lifecycle operations
- Audit metadata sanitization
- Offline conflict handling
- Club Configuration validation

## Integration boundary

Firestore integration tests require the Firebase Admin Secrets listed in
`docs/security/README.md`. They are intentionally not replaced with an
in-memory runtime fallback.

## Required verification

```text
pnpm --filter @workspace/application test
pnpm run typecheck
pnpm --filter @workspace/api-server run build
curl /api/healthz
```

The mobile app must remain unchanged during infrastructure hardening. Expo
runtime verification is performed through the existing mobile workflow.
