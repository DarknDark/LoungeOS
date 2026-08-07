# Security Reference

## Trust boundaries

1. Mobile/customer clients are untrusted.
2. API routes validate transport payloads.
3. Firebase Authentication verifies staff identity.
4. Membership and role repositories determine club permissions.
5. Application services enforce business authorization.
6. Firestore rules deny direct client persistence.
7. Firebase Admin is the only server persistence adapter.

## Customer sessions

- QR tokens are compared by hash.
- QR tokens may expire.
- One active owner is created transactionally.
- Customer session tokens are opaque and never persisted in plaintext.
- Recovery tokens are stored only as hashes.
- Each customer session is scoped to one table session.
- Expiration releases table ownership.
- Closed or expired sessions cannot be reopened.

## Staff sessions

Firebase ID token possession does not grant LoungeOS access. The API resolves
the Firebase UID to an active club staff record and checks explicit role
permissions before sensitive operations.

## Audit safety

Audit metadata is sanitized before persistence. Keys containing secrets,
tokens, passwords, private keys, or authorization values are removed. Long
values are bounded. Secret values are never logged or returned by APIs.
