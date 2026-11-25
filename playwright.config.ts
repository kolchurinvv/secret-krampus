import { defineConfig } from "@playwright/test";

// Run with `just e2e` (or `bun run test:e2e`) inside `nix develop`: browsers
// come from the flake, as in kolchurin.dev. The suite starts its own server
// on a throwaway database (scripts/e2e-server.sh) and never loads your .env.
const PORT = 4173;

export default defineConfig({
  testDir: "./tests/e2e",
  // One server and one database: specs share state, so run them in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : [["list"]],
  outputDir: ".e2e/results",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bash scripts/e2e-server.sh",
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } }],
});
