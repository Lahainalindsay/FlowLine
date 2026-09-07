import { defineConfig } from '@playwright/test';

const baseURL =
  process.env.STAGETIME_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);

if (!baseURL) {
  throw new Error('Set STAGETIME_BASE_URL to the release-candidate URL.');
}

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global.setup.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/repl/tools/bin/chromium' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
});