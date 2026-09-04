import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,
  workers: 1,
  webServer: {
    command: 'corepack pnpm --filter @skill-maps/web dev --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
    {
      name: 'chromium-tablet',
      use: { browserName: 'chromium', viewport: { width: 834, height: 1112 } },
    },
    {
      name: 'chromium-mobile',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'firefox-desktop',
      testMatch: /accessibility-responsive\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], browserName: 'firefox' },
    },
    {
      name: 'firefox-tablet',
      testMatch: /accessibility-responsive\.spec\.ts/,
      use: { browserName: 'firefox', viewport: { width: 834, height: 1112 } },
    },
    {
      name: 'firefox-mobile',
      testMatch: /accessibility-responsive\.spec\.ts/,
      use: { browserName: 'firefox', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'webkit-desktop',
      testMatch: /accessibility-responsive\.spec\.ts/,
      use: { ...devices['Desktop Safari'], browserName: 'webkit' },
    },
    {
      name: 'webkit-tablet',
      testMatch: /accessibility-responsive\.spec\.ts/,
      use: { browserName: 'webkit', viewport: { width: 834, height: 1112 } },
    },
    {
      name: 'webkit-mobile',
      testMatch: /accessibility-responsive\.spec\.ts/,
      use: { browserName: 'webkit', viewport: { width: 390, height: 844 } },
    },
  ],
});
