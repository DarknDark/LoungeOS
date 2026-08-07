---
name: Firebase Firestore access
description: Firebase Admin credentials can authenticate while Firestore RPCs still fail independently on IAM or database access.
---

Firebase Authentication success does not prove that the configured service account can access Firestore. Validate a real Firestore read in a fresh process before attempting seed data or smoke-test writes.

**Why:** A live project accepted Admin Auth calls but rejected Firestore document and collection reads with `PERMISSION_DENIED`, even after an API restart and an asserted IAM grant.

**How to apply:** Treat Firestore access as a separate prerequisite; verify the effective service-account role, the Firestore API/database project alignment, and the default database before running production smoke tests.

Manual composite-index creation may remain in `CREATING` for several minutes; validate readiness by executing the exact production query, not by assuming the Firebase Console submission completed.