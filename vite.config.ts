import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// The browser talks to Vite in dev; /api (including the SSE stream) and the
// locally stored avatars are proxied to the Bun server on :3000.
export default defineConfig({
  plugins: [solid()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000" },
      "/avatars": { target: "http://localhost:3000" },
      "/healthz": { target: "http://localhost:3000" },
    },
  },
  build: { outDir: "dist", target: "es2022" },
});
