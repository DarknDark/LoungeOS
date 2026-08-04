---
name: Expo SDK migration
description: Environment-specific lessons from upgrading the mobile artifact to Expo SDK 57.
---

Expo SDK 57 must be upgraded as a coordinated graph: Expo modules, Expo Router, React, React Native, gesture/reanimated/worklets, TypeScript, and React type packages all need their SDK 57-compatible versions together. `expo install --check` is the source of truth for the expected ranges.

**Why:** Updating only `expo` leaves the lockfile and native modules on the previous SDK and can cause Metro startup or peer-resolution failures.

**How to apply:** Run a clean workspace install after updating the artifact manifest, run the full workspace typecheck, and build both Android and iOS bundles. The Expo static build helper should use a separate Metro port when another workspace service owns 8081.