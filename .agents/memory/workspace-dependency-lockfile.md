---
name: Workspace dependency lockfile
description: Package manifest changes require refreshing the pnpm lockfile before frozen installs can succeed.
---

When a workspace package manifest changes, a frozen pnpm install will reject the
workspace until the lockfile reflects the new specifier.

**Why:** The imported workspace uses frozen-lockfile checks and its workflows
depend on installed workspace links.

**How to apply:** After changing a package manifest, refresh dependencies with
the repository's approved non-frozen install once, then use frozen installs for
verification.