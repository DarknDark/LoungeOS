---
name: Expo web font loading
description: A workspace-specific Expo web preview behavior around native font loading and rendering.
---

The proxied Expo web preview can leave `useFonts` pending even though Metro has bundled successfully and browser logs show no application exception. The web surface should render with system fallback fonts while native platforms retain the splash/font gate.

**Why:** A pending web font loader produced a blank preview, hiding an otherwise healthy mobile app and API.

**How to apply:** Keep the existing native `fontsLoaded`/`fontError` gate, but do not block web rendering solely on `fontsLoaded`; verify the proxied preview after any Expo SDK or font-loader changes.