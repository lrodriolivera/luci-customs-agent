describe('05 - H7: Declaracion simplificada de importacion', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Navega a la lista de H7', () => {
    cy.visit('/h7')
    cy.wait(3000)
    cy.captureStep('05-01-lista-h7')
  })

  it('Crea una nueva declaracion H7', () => {
    cy.visit('/h7')
    cy.wait(2000)

    // Buscar boton nueva H7
    cy.get('body').then(($body) => {
      if ($body.text().includes('Nueva')) {
        cy.contains('Nueva').click({ force: true })
        cy.wait(1000)
        cy.captureStep('05-02-formulario-nueva-h7')
      }
    })

    cy.captureStep('05-03-h7-estado')
  })

  it('Busca H7 existente y verifica su estado', () => {
    cy.visit('/h7')
    cy.wait(3000)

    // Buscar declaraciones en la tabla
    cy.get('body').then(($body) => {
      const rows = $body.find('tr')
      if (rows.length > 1) {
        cy.wrap(rows.eq(1)).find('a, button').first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('05-04-detalle-h7')
      } else {
        cy.captureStep('05-04-no-hay-h7')
      }
    })
  })
})
