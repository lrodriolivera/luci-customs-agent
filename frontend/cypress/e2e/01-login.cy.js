describe('01 - Login al sistema', () => {
  it('Accede al login y se autentica correctamente', () => {
    cy.visit('/login')
    cy.wait(1000)
    cy.captureStep('01-01-login-page')

    cy.get('input[id="email"]').type('test@luci.es')
    cy.get('input[id="password"]').type('test123')
    cy.captureStep('01-02-credenciales-ingresadas')

    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login', { timeout: 15000 })
    cy.wait(2000)
    cy.captureStep('01-03-dashboard-cargado')
  })
})
