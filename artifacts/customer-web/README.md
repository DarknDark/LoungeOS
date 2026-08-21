# LoungeOS Customer Application Boundary

This directory is reserved for the responsive QR customer web application.
It must remain a separate product surface from the authenticated Expo staff
application.

Customer routes may consume shared domain, API contract, and presentation
libraries, but must not import staff navigation, staff dashboards, inventory
management, settings administration, or developer tools.

The customer application is intentionally not implemented in Module 1.

## Status: Phase 3 Part 2 complete (Checkpoints 4–8)

This app is a QR-entry, read-only-by-design customer table companion:
table join/approval → running bill & ordered items → call waiter / request
song. It intentionally does **not** implement ordering, payment, bill
splitting, or table closure — those remain staff/mobile-app-only, per the
product boundary above.

### Routes

| Route | Purpose |
| --- | --- |
| `/t/:tableId?qrToken=...&clubId=...` | Entry point a table's QR code links to. Creates or resumes the customer's table session. |
| `/session/:sessionId/pending` | "Please wait. Your waiter has been notified." — shown while `approvalStatus` is `pending-approval`. Auto-redirects to the dashboard once approved. |
| `/session/:sessionId` | The dashboard: running bill, ordered items, call waiter, request song. |
| `/session/:sessionId/expired` | Shown on a terminal session error (closed/expired/not found); clears the stored session so a fresh QR scan starts clean. |
| `/invalid-qr` | Shown for a permanently invalid QR code, or when the app is opened with no stored session and no table in the URL. |
| `/` | Resumes a previously stored session if one exists, else redirects to `/invalid-qr`. |

### How data flows

- All API access goes through the generated `@workspace/api-client-react` hooks (backed by `@workspace/api-zod` types) — no hand-written fetch/business logic.
- The customer session (`clubId`, `tableId`, `tableSessionId`, `customerSessionId`, `recoveryToken`) is persisted in `localStorage` (`src/session/storage.ts`) so a refresh or app reopen resumes the same table visit.
- Synchronization is five-second HTTP polling (`src/session/useTableSessionStatus.ts`, `src/session/useOrders.ts`), matching the workspace's documented "Five-second HTTP polling fallback" convention. No SSE/realtime infrastructure and no direct Firestore access are used from this app.
- **Access rules are enforced server-side** (see `lib/application/src/order-engine.ts`, `dj-engine.ts`, `customer-requests.ts`): ordering and song requests require full, non-temporary approval; call waiter is intentionally allowed for pending/temporary customers too. The UI mirrors these rules (e.g. `RequestSongForm`'s `readOnly` prop) for a proactive message, but the server is always the actual authority — this UI never assumes otherwise.

### Local development

```
pnpm --filter @workspace/customer-web run dev      # Vite dev server, proxies /api to the api-server
pnpm --filter @workspace/customer-web run build     # production build
pnpm --filter @workspace/customer-web run typecheck # tsc -p tsconfig.json --noEmit
pnpm --filter @workspace/customer-web run test      # tsx --test tests/*.test.ts
```

The dev server proxies `/api/*` to `http://localhost:8080` by default (matching the `api-server`'s `.replit` workflow port); override with the `API_PROXY_TARGET` env var. `PORT` controls the dev/preview server's own port (default `5174`).

This app must not import from `artifacts/club-ordering-mobile` (the Expo
staff/customer prototype) or any staff UI package, and vice versa.
