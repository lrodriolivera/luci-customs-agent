const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://aduanas.strixai.es',
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
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
})
