describe('06 - AES: Exportacion', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Navega al generador de declaraciones', () => {
    cy.visit('/declarations')
    cy.wait(2000)
    cy.captureStep('06-01-generador-declaraciones')
  })

  it('Crea expediente de exportacion', () => {
    cy.visit('/expeditions/new')
    cy.wait(1500)

    // Seleccionar exportacion
    cy.contains('Exportacion').click({ force: true })
    cy.wait(500)
    cy.captureStep('06-02-tipo-exportacion')

    // Razon Social por label
    cy.contains('Razon Social').parent().find('input').clear().type('STRIX AI SL')
    cy.captureStep('06-03-razon-social-export')

    // NIF
    cy.contains('NIF').parent().find('input').clear().type('B22477020')

    // Email
    cy.contains('Email').parent().find('input').clear().type('despacho@strixai.es')
    cy.captureStep('06-04-datos-exportador')

    // Siguiente
    cy.contains('Siguiente').click({ force: true })
    cy.wait(1000)

    // Mercancia
    cy.get('textarea').first().clear().type('Equipos informaticos para exportacion')
    cy.get('body').then(($body) => {
      const taricInput = $body.find('input[placeholder*="TARIC"], input[maxlength="10"]')
      if (taricInput.length) {
        cy.wrap(taricInput.first()).clear().type('8471410000')
      }
    })
    cy.captureStep('06-05-mercancia-export')

    cy.contains('Siguiente').click({ force: true })
    cy.wait(1000)
    cy.captureStep('06-06-transporte-export')

    cy.contains('Crear').click({ force: true })
    cy.wait(3000)
    cy.captureStep('06-07-expediente-export-creado')
  })
})
