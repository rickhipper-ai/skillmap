import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: 'corepack pnpm --filter @skill-maps/web dev --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-tablet', use: { ...devices['iPad Pro 11'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
});
