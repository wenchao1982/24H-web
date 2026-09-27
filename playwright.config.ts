import { defineConfig } from "@playwright/test";

// Fixed credentials for the isolated e2e run. The BFF boots with a fresh temp
// DB and seeds `admin` from OS_ADMIN_PASSWORD (must_change_password = true),
// so the spec walks the forced password-change step.
const ADMIN_PASSWORD = "e2e-pass-123";

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/.artifacts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4598",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      // Build the BFF bundle, then run it against a fresh temp DB (start-bff.mjs).
      command: "npm -w @24h/server run build && node e2e/start-bff.mjs",
      url: "http://127.0.0.1:4599/health",
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        PORT: "4599",
        HOST: "127.0.0.1",
        OS_ADMIN_PASSWORD: ADMIN_PASSWORD,
      },
    },
    {
      // Build the SPA and serve the static bundle with the /api preview proxy.
      // `vite preview <root>` is required: the config alone does not change the
      // project root, and the explicit host keeps it on IPv4 for 127.0.0.1.
      command:
        "npm -w @24h/web run build && npx vite preview apps/web --config apps/web/vite.config.ts --host 127.0.0.1 --port 4598 --strictPort",
      url: "http://127.0.0.1:4598",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
