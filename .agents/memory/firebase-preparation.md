---
name: Firebase preparation
description: Firebase is the only approved production persistence provider; this workspace has no managed Firebase connector.
---

Firebase Admin credentials must be supplied through Replit Secrets before live
Firestore/Auth initialization or repository verification can begin. Once they
are present, verify the existing project and data directly; do not substitute
PostgreSQL, an in-memory store, or credentials committed to source.

**Why:** The approved LoungeOS architecture makes Firestore authoritative and
requires explicit failure when Firebase configuration is absent.

**How to apply:** Use `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
`FIREBASE_PRIVATE_KEY` as required server secrets, then perform a read-only
Firestore check before any production smoke-test writes. Treat
`FIREBASE_STORAGE_BUCKET` and `FIREBASE_DATABASE_URL` as optional and never
expose any of them to the mobile bundle or logs.