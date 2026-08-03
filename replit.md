# Nightfall Club Ordering

A premium mobile-first table ordering experience for nightclub guests and the staff team running service.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/club-ordering-mobile/app/index.tsx` — Expo Router root entry.
- `artifacts/club-ordering-mobile/app/(tabs)/index.tsx` — guest ordering and staff operations experience.
- `artifacts/club-ordering-mobile/context/ClubContext.tsx` — local session state, menu, orders, song requests, waiter calls, and persistence.
- `artifacts/club-ordering-mobile/constants/colors.ts` — Nightfall dark amber theme tokens.
- `artifacts/club-ordering-mobile/assets/images/` — generated app icon and menu imagery.

## Architecture decisions

- The first mobile build is local-first with AsyncStorage so the complete guest journey can be explored without requiring a club account or third-party setup.
- Guests use a table session and never authenticate; the staff switch is a preview surface for role-specific operational workflows.
- Shared session state keeps menu, running bill, staff order actions, DJ queue actions, and payment state consistent across screens.
- M-Pesa is represented as a secure payment prompt entry point; provider wiring belongs in the server/integration pass.

## Product

Nightfall lets a guest at a numbered club table browse drinks and food, build rounds, follow a running tab, request a song, call a waiter, and choose a payment method. Staff can preview waiter, bartender, DJ, and admin operations from the same session.

## User preferences

The user wants a premium nightclub experience with a dark background, gold and amber accents, rounded cards, modern typography, large touch targets, and smooth interactions.

## Gotchas

- The Expo Router root entry explicitly re-exports the grouped home screen so the artifact preview root resolves correctly on web.
- Use `pnpm --filter @workspace/club-ordering-mobile run typecheck` for mobile verification.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
