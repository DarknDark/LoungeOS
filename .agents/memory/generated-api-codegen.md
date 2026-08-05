---
name: Generated API codegen
description: Orval's split Zod output appends a broad type barrel that can collide with runtime schemas.
---

The API contract generator must normalize its generated barrels after Orval runs. The Zod runtime schema and generated TypeScript type can share names, so exporting the entire generated type barrel from the public Zod entrypoint is unsafe.

**Why:** The workspace API includes both runtime request validators and generated TypeScript schemas; a duplicate `SubmitOrderBody` export broke reproducible typechecks and could briefly remove client files while generation was in progress.

**How to apply:** Run code generation as one sequential command, normalize the public Zod barrel and generated file endings afterward, then typecheck only after generation has completed.