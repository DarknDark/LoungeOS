---
name: Static Expo server security
description: Security boundary for serving generated Expo static bundles.
---

The static Expo server must decode and reject malformed paths, null bytes, dot segments, and traversal before resolving files. Expo manifests use an explicit platform allowlist; no user-provided platform value becomes a filesystem path.

**Why:** Static-analysis tools flag any filesystem read involving a request-derived path, even when containment checks are present. The real protection is the explicit decode/segment/relative-path boundary plus the fixed manifest map.

**How to apply:** Preserve the allowlist and containment checks whenever the static build server changes. Treat remaining SAST path warnings as review items, not permission to remove the validation.