const { defineConfig } = require('cypress')

// Las specs corren en el navegador y no ven process.env: se copian aqui las
// variables E2E_* del entorno (solo las definidas) para Cypress.env().
const E2E_ENV_VARS = ['E2E_USER', 'E2E_PASS', 'E2E_CERT_PASSWORD']
const e2eEnv = Object.fromEntries(
  E2E_ENV_VARS.filter((name) => process.env[name]).map((name) => [name, process.env[name]])
)

module.exports = defineConfig({
  e2e: {
    // Por defecto el servidor local de Vite. Produccion solo si se pasa BASE_URL
    // explicitamente (BASE_URL=https://... npm run test:e2e:cypress).
    baseUrl: process.env.BASE_URL || 'http://localhost:5173',
    viewportWidth: 1440,
    viewportHeight: 900,
    video: true,
    videoCompression: 15,
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    defaultCommandTimeout: 20000,
    requestTimeout: 30000,
    responseTimeout: 60000,
    chromeWebSecurity: false,
    specPattern: 'cypress/e2e/demo-changes-*.cy.js',
    env: e2eEnv,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
})
