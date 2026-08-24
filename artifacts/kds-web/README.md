# LoungeOS Kitchen Display System (KDS)

An isolated, staff-facing surface for kitchen/bar station displays. This is
a separate product surface from `artifacts/customer-web` (the customer QR
app) and `artifacts/club-ordering-mobile` (the Expo staff/customer
prototype) — it does not import from, and is not imported by, either.

## Status: Phase 4 Checkpoint 2

Firebase staff sign-in, station selection (Kitchen/Bar), and a 3-column
(New / Preparing / Ready) display-only ticket board, kept live via the
existing staff SSE realtime stream (`/v1/staff/realtime`) as a
change-signal that triggers a React Query refetch, with 5-second polling
as a fallback. **No ticket status mutation actions exist yet** — that is
Checkpoint 3's "Station Actions" scope.

### How it works

- Auth: Firebase JS SDK (email/password), same underlying pattern as
  `club-ordering-mobile`'s staff sign-in (read there only as a reference —
  never imported), adapted to Vite's `import.meta.env.VITE_*` convention.
  Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_APP_ID` (and optionally `VITE_FIREBASE_MESSAGING_SENDER_ID`)
  in a `.env.local` file.
- Station selection: a small client-side config list
  (`src/stations/stations.ts`) — Kitchen/Bar — not a backend-driven list.
  There is no `PreparationStation` listing endpoint; the system already
  works purely off plain station-ID strings
  (`MenuItem.preparationStationId`, `KitchenTicket.stationId`).
- Data: `GET /v1/staff/kitchen-tickets?stationId=...` via the generated
  `@workspace/api-client-react` client, polled every 5 seconds.
- Realtime: a ported XHR-based SSE client
  (`src/tickets/useStaffRealtime.ts`) connects to `/v1/staff/realtime`.
  Native `EventSource` can't set the `Authorization`/`X-Club-Id` headers
  this endpoint requires, so — matching
  `club-ordering-mobile/services/staff-realtime.ts`'s existing, working
  approach — this uses `XMLHttpRequest` with manual streamed-chunk
  parsing. Any projection signal invalidates the current station's
  kitchen-tickets query, triggering a normal REST refetch; the stream
  carries no ticket data itself.
- Ticket cards show order reference, item count, and elapsed time.
  `KitchenTicket` only carries `orderItemIds` (references), and there is
  currently no staff-facing endpoint that resolves those to item
  names/quantities — this is a known limitation, not an oversight.

### Local development

```
pnpm --filter @workspace/kds-web run dev       # Vite dev server, proxies /api to the api-server
pnpm --filter @workspace/kds-web run build      # production build
pnpm --filter @workspace/kds-web run typecheck  # tsc -p tsconfig.json --noEmit
pnpm --filter @workspace/kds-web run test       # tsx --test tests/*.test.ts
```

`PORT` defaults to `5175` (customer-web uses `5174`, api-server uses
`8080`, so all three can run simultaneously). `API_PROXY_TARGET` overrides
the dev proxy target.
