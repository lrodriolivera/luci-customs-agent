const { getE2ECredentials } = require('../../e2e/env')

describe('01 - Login al sistema', () => {
  it('Accede al login y se autentica correctamente', () => {
    cy.visit('/login')
    cy.wait(1000)
    cy.captureStep('01-01-login-page')

    cy.get('input[id="email"]').type(getE2ECredentials().email)
    cy.get('input[id="password"]').type(getE2ECredentials().password)
    cy.captureStep('01-02-credenciales-ingresadas')

    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login', { timeout: 15000 })
    cy.wait(2000)
    cy.captureStep('01-03-dashboard-cargado')
  })
})
