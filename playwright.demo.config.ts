import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/demo-e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CPD_DEMO_CHROMIUM_PATH
      ? { executablePath: process.env.CPD_DEMO_CHROMIUM_PATH, args: ['--no-sandbox'] }
      : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/demo-server.mjs',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
