import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config — runs the full dev stack (`npm run dev:all`) against an isolated
 * data directory on dedicated ports, so a test run never touches real Pod data.
 *
 * Ports: API `COFFEE_POD_PORT` (default 8907) · UI `COFFEE_POD_UI_PORT` (default 5273).
 * The webServer command resets `.e2e-data/` first, so every invocation starts
 * from a fresh first-run Pod — the onboarding journey is part of the suite.
 */
const API_PORT = Number(process.env.COFFEE_POD_PORT ?? 8907);
const UI_PORT = Number(process.env.COFFEE_POD_UI_PORT ?? 5273);
const BASE_URL = `http://127.0.0.1:${UI_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Single worker: the suite shares one live Pod instance (serial by design).
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: process.env.E2E_VIDEO ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /onboarding\.setup\.ts/ },
    { name: 'cockpit', testMatch: /cockpit\.spec\.ts/, dependencies: ['setup'] },
    { name: 'a11y', testMatch: /a11y\.spec\.ts/, dependencies: ['setup'] },
    { name: 'visual', testMatch: /visual\.spec\.ts/, dependencies: ['setup'] },
  ],
  webServer: {
    command: 'rm -rf .e2e-data && npm run dev:all',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      COFFEE_POD_HOST: '127.0.0.1',
      COFFEE_POD_PORT: String(API_PORT),
      COFFEE_POD_UI_PORT: String(UI_PORT),
      COFFEE_POD_DATA_DIR: './.e2e-data',
      COFFEE_POD_ID: 'e2e',
      COFFEE_POD_NAME: 'E2E Pod',
      COFFEE_POD_API_TOKEN: '',
    },
  },
});
