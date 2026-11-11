// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { UNITS } = require('./data/units');

/**
 * One Playwright project per business unit. The QA Testing Guide limits
 * testing to Dokuma and Fossil: the other 13 units are real businesses.
 *
 * Each spec file runs its steps in order (test.describe.serial) because every
 * step depends on the document the previous role produced. Files run one at a
 * time per unit so two runs never act on each other's records.
 */
module.exports = defineConfig({
  testDir: './tests',
  // The live dashboards can take 6-7 seconds on the first load of the day.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  outputDir: 'test-results/artifacts',
  use: {
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Video needs Playwright's ffmpeg; turn it on with QA_VIDEO=1.
    video: process.env.QA_VIDEO ? 'retain-on-failure' : 'off',
    viewport: { width: 1440, height: 900 },
    locale: 'en-ZA',
    timezoneId: 'Africa/Harare'
  },
  projects: Object.values(UNITS).map((unit) => ({
    name: unit.key,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
      baseURL: unit.baseURL,
      // Run on an installed browser instead of Playwright's own, e.g. QA_BROWSER_CHANNEL=msedge or chrome.
      ...(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {})
    },
    metadata: { unit: unit.key }
  }))
});
