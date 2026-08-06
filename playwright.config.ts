import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Browser tests for /database filtering.
 * Starts `pnpm dev --port 5174` (Vite + mkcert serve HTTPS; loads `.env` / `.env.local`).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'https://localhost:5174',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    navigationTimeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev --port 5174',
    cwd: root,
    url: 'https://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    ignoreHTTPSErrors: true,
  },
});
