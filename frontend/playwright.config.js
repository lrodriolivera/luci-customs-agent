// @ts-check
const { defineConfig, devices } = require('@playwright/test')

/**
 * Playwright configuration — E2E smoke alternativo a Cypress.
 * Se ejecuta contra aduanas.strixai.es por defecto.
 *
 *   npx playwright test --project=chromium-headless-shell
 */
module.exports = defineConfig({
  testDir: './playwright',
  fullyParallel: false,       // evita rate-limit colisiones
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://aduanas.strixai.es',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false
  },
  projects: [
    {
      name: 'chromium-headless-shell',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium-headless-shell'
      }
    }
  ]
})
