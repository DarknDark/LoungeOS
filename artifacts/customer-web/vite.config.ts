import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// The customer-web dev server proxies /api/* to the api-server so the
// generated @workspace/api-client-react hooks (which call relative
// "/api/v1/..." URLs, per lib/api-spec/orval.config.ts's baseUrl) work
// without CORS configuration during local development. In production this
// app is expected to be served behind the same origin/router as the API
// server; the proxy below only affects `vite dev`.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";
const port = Number(process.env.PORT ?? 5174);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
