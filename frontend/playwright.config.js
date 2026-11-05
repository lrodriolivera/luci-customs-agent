// @ts-check
const { defineConfig, devices } = require('@playwright/test')

/**
 * Playwright configuration — E2E smoke alternativo a Cypress.
 * Por defecto apunta al servidor local de Vite (http://localhost:5173).
 * Para otro entorno, incluida produccion, pasar BASE_URL de forma explicita:
 *   BASE_URL=https://... npx playwright test --project=chromium-headless-shell
 * Credenciales: E2E_USER, E2E_PASS, E2E_CERT_PASSWORD (ver e2e/env.js).
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
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
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
