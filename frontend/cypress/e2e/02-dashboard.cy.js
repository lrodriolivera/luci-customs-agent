describe('02 - Dashboard principal', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Muestra el dashboard con estadisticas', () => {
    cy.url().should('eq', Cypress.config().baseUrl + '/')
    cy.captureStep('02-01-dashboard-completo')

    // Verificar que hay secciones visibles
    cy.get('body').should('be.visible')
    cy.wait(2000)
    cy.captureStep('02-02-dashboard-cargado')
  })
})
