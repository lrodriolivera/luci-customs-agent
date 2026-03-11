describe('10 - Certificados AEAT y funcionalidades adicionales', () => {
  before(() => {
    cy.login()
  })

  it('Verifica el gestor de certificados', () => {
    cy.visit('/aeat/certificates')
    cy.wait(2000)
    cy.captureStep('10-01-certificados-aeat')
  })

  it('Verifica el monitor AEAT', () => {
    cy.visit('/aeat/monitor')
    cy.wait(2000)
    cy.captureStep('10-02-monitor-aeat')
  })

  it('Verifica la calculadora de aranceles', () => {
    cy.visit('/calculator')
    cy.wait(2000)
    cy.captureStep('10-03-calculadora-aranceles')
  })

  it('Verifica el asistente IA', () => {
    cy.visit('/assistant')
    cy.wait(2000)
    cy.captureStep('10-04-asistente-ia')
  })

  it('Verifica configuracion del sistema', () => {
    cy.visit('/settings')
    cy.wait(2000)
    cy.captureStep('10-05-configuracion')
  })

  it('Verifica analytics', () => {
    cy.visit('/analytics')
    cy.wait(2000)
    cy.captureStep('10-06-analytics')
  })
})
