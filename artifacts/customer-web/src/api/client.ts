// Central import point for API access in customer-web.
//
// The generated hooks (@workspace/api-client-react) call relative URLs like
// "/api/v1/customer/table-sessions" (baseUrl fixed to "/api" in
// lib/api-spec/orval.config.ts). In development, vite.config.ts proxies
// /api/* to the api-server (see API_PROXY_TARGET). In production this app
// is expected to be served behind the same origin/router as the API
// server, so no setBaseUrl(...) call is needed here — unlike the Expo
// mobile app, which does need it (see custom-fetch.ts's doc comment).
//
// Do not import anything from artifacts/club-ordering-mobile or any staff
// UI package here — this file, and everything under src/, must remain
// within the isolated customer-web product boundary (see
// artifacts/customer-web/README.md and ARCHITECTURE.md).
export * from "@workspace/api-client-react";
