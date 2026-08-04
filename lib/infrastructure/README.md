# LoungeOS Infrastructure

Provider adapters live here and depend inward on `@workspace/domain`. The
Firebase integration is the only place that creates Firebase Admin SDK clients.
Routes and application services receive its clients through dependency
injection; they never read Firebase credentials or construct SDK clients.

## Current boundary

This package contains the environment-driven Firebase Admin and Authentication
foundation. Firestore repository adapters will be enabled against the real
Firebase project after the required Replit Secrets are present.

There is intentionally no PostgreSQL or in-memory fallback. Missing Firebase
configuration is reported as a descriptive configuration error and cannot
silently switch the persistence provider.