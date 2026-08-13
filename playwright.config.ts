import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const apiPort = Number(process.env.E2E_API_PORT || 31889);
const webPort = Number(process.env.E2E_WEB_PORT || 15173);
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;
const e2eJwtSecret = randomBytes(32).toString('hex');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // All browser projects intentionally share one isolated SQLite fixture.
  // Serial execution prevents desktop/mobile flows from racing on the same
  // seeded account and turning a valid regression suite into a flaky one.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chrome' } },
  ],
  webServer: [
    {
      command: `DB_PATH=.scratch/e2e/bootstrap.db bun scripts/setup-e2e-db.ts && DB_PATH=.scratch/e2e/curio-e2e.db PORT=${apiPort} bun apps/api/src/server.ts`,
      env: { ...process.env, JWT_SECRET: e2eJwtSecret },
      url: `${apiBaseUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `VITE_API_PROXY_TARGET=${apiBaseUrl} npm --prefix apps/web run dev -- --host 127.0.0.1 --port ${webPort}`,
      url: webBaseUrl,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
