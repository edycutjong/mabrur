import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a PRODUCTION build (`next build` + `next start`), reading Arbitrum One through its public RPC —
 * the same read path the live site uses. Nothing is ever sent on chain: every check is a read or a simulateContract.
 *
 *   yarn e2e                     build, serve on :3100, run everything
 *   E2E_SKIP_BUILD=1 yarn e2e    reuse an existing .next build
 *   E2E_BASE_URL=https://mabrur.edycu.dev yarn e2e   run against a deployed site (no local server)
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const externalBase = process.env.E2E_BASE_URL;
const baseURL = externalBase ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalBase
    ? undefined
    : {
        command: process.env.E2E_SKIP_BUILD
          ? `yarn next start -p ${PORT}`
          : `yarn next build && yarn next start -p ${PORT}`,
        url: `${baseURL}/judge`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe",
      },
});
