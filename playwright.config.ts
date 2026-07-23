import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end (browser) tests for the booking flow.
 *
 * These run against a *real* running instance with a seeded database, so they
 * live separately from the fast vitest unit suite (`npm test`). In CI:
 *
 *   docker compose up -d postgres
 *   npm run db:migrate && npm run db:seed
 *   npm run test:e2e            # builds, starts, and drives the app
 *
 * The seeded company (`demo-company` / `intro`) is what the specs target by default.
 * Point at an already-running instance with
 * E2E_BASE_URL to skip the built-in webServer.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const useExternal = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Build + start the app unless pointed at an external instance.
  webServer: useExternal
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          APP_URL: process.env.E2E_APP_URL ?? "http://127.0.0.1:3100",
          DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/tidetime",
          AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-auth-secret-that-is-at-least-32-characters",
          CRON_SECRET: process.env.CRON_SECRET ?? "e2e-cron-secret",
          PORT: "3100",
          HOSTNAME: "127.0.0.1",
        },
      },
});
