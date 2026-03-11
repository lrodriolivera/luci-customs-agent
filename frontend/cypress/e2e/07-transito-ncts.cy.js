describe('07 - NCTS: Transito comunitario', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Navega al gestor de transito', () => {
    cy.visit('/transit')
    cy.wait(3000)
    cy.captureStep('07-01-gestor-transito')
  })

  it('Verifica la interfaz de transito', () => {
    cy.visit('/transit')
    cy.wait(2000)

    cy.get('body').then(($body) => {
      if ($body.text().includes('Nuevo') || $body.text().includes('Crear')) {
        cy.captureStep('07-02-opciones-transito')
      }

      // Verificar que la pagina carga correctamente
      cy.captureStep('07-03-transito-cargado')
    })
  })
})
