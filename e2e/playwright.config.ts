import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression test configuration for Sarmal.
 *
 * Goals:
 * - Catch silent, pixel-level renderer bugs with real-browser snapshot tests
 * - Run across 3 browsers (Chromium, Firefox, WebKit) × 2 DPRs (1, 2)
 * - Deterministic: seek-based fixtures with no animation
 *
 * @see planning/visual-regression-testing.md
 */
export default defineConfig({
  testDir: './tests',

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'list',

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:4321',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
  },

  // Configure projects for major browsers × DPR matrix
  projects: [
    // Chromium at DPR=1 and DPR=2
    {
      name: 'chromium-dpr1',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'chromium-dpr2',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 2,
      },
    },

    // Firefox at DPR=1 and DPR=2
    {
      name: 'firefox-dpr1',
      use: {
        ...devices['Desktop Firefox'],
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'firefox-dpr2',
      use: {
        ...devices['Desktop Firefox'],
        deviceScaleFactor: 2,
      },
    },

    // WebKit at DPR=1 and DPR=2
    {
      name: 'webkit-dpr1',
      use: {
        ...devices['Desktop Safari'],
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'webkit-dpr2',
      use: {
        ...devices['Desktop Safari'],
        deviceScaleFactor: 2,
      },
    },
  ],

  // Run the docs dev server before starting the tests
  webServer: {
    command: 'pnpm --filter docs dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
});
