describe('08 - PUE/SOIVRE: Certificados ROHS', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Navega al gestor PUE', () => {
    cy.visit('/pue')
    cy.wait(3000)
    cy.captureStep('08-01-gestor-pue')
  })

  it('Verifica la interfaz PUE', () => {
    cy.visit('/pue')
    cy.wait(2000)
    cy.captureStep('08-02-pue-estado')
  })
})
