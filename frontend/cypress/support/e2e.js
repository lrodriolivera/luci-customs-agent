import './commands'

// Ignore uncaught exceptions from the app
Cypress.on('uncaught:exception', (err, runnable) => {
  return false
})
