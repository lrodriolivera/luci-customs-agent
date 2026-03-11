describe('04 - ENS: Crear y enviar declaracion sumaria a AEAT', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Navega a la lista de ENS', () => {
    cy.visit('/ens')
    cy.wait(3000)
    cy.captureStep('04-01-lista-ens')
  })

  it('Crea una nueva declaracion ENS', () => {
    cy.visit('/ens')
    cy.wait(2000)

    // Click en NUEVA ENS
    cy.contains(/NUEVA ENS|Nueva|Crear/).first().click({ force: true })
    cy.wait(1500)
    cy.captureStep('04-02-formulario-nueva-ens')

    // Seleccionar Ferrocarril (card con texto)
    cy.contains('Ferrocarril').click({ force: true })
    cy.wait(500)
    cy.captureStep('04-03-modo-ferrocarril-seleccionado')

    // Click SIGUIENTE
    cy.contains('SIGUIENTE').click({ force: true })
    cy.wait(1000)
    cy.captureStep('04-04-paso-transportista')

    // Rellenar EORI del transportista
    cy.get('body').then(($body) => {
      const eoriInput = $body.find('input[label*="EORI"], input[placeholder*="EORI"]')
      if (eoriInput.length) {
        cy.wrap(eoriInput.first()).clear().type('ESB22477020')
      } else {
        // Buscar primer input visible
        cy.get('input').first().clear().type('ESB22477020')
      }
    })
    cy.captureStep('04-05-transportista-eori')
  })

  it('Busca una ENS existente y muestra detalle', () => {
    cy.visit('/ens')
    cy.wait(3000)

    // Click en la primera fila de la tabla
    cy.get('tbody tr, table tr').then(($rows) => {
      if ($rows.length > 0) {
        cy.wrap($rows.first()).click({ force: true })
        cy.wait(2000)
        cy.captureStep('04-06-detalle-ens')

        // Si tiene boton Enviar a AEAT
        cy.get('body').then(($body) => {
          if ($body.text().includes('Enviar a AEAT')) {
            cy.captureStep('04-07-ens-lista-para-enviar')
          } else if ($body.text().includes('MRN') || $body.text().includes('Aceptada')) {
            cy.captureStep('04-07-ens-ya-aceptada')
          }
        })
      } else {
        cy.captureStep('04-06-no-hay-ens')
      }
    })
  })
})
