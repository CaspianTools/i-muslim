import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright end-to-end config — drives the real app in a real browser.
 *
 * `webServer` boots `npm run dev` on the project's fixed port (7777, see
 * package.json) and Playwright waits for it before running; locally it reuses a
 * server you already have running (so `npm run dev` in another terminal + `npm
 * run test:e2e` is instant). Override the target with PLAYWRIGHT_BASE_URL to run
 * against a deployed/preview URL instead (then no local server is started).
 */
const PORT = 7777;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const usingExternalTarget = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // Pin locale so `/` redirects deterministically to `/en` (localePrefix is
    // "always"), rather than following the runner's Accept-Language.
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Don't manage a server when pointed at an external URL.
  webServer: usingExternalTarget
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
