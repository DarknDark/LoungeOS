---
name: Expo artifact routing
description: An environment-specific routing constraint for Expo mobile artifacts served through the Replit preview proxy.
---

When an Expo artifact uses a non-root preview path and the main screen lives only inside a route group such as `(tabs)`, the proxied web preview can resolve the artifact root as an unmatched route. Add an explicit `app/index.tsx` that re-exports the grouped home screen.

**Why:** The mobile bundle and Metro server can be healthy while the browser preview still shows the Expo Router not-found screen.

**How to apply:** For Expo artifacts with grouped routes, keep a root entry as well as the grouped screen, then verify the preview URL at the artifact root after restarting the workflow.