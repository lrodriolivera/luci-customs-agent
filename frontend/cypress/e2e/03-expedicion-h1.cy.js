describe('03 - Crear expedicion y generar H1 (Importacion Completa)', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Crea un nuevo expediente de importacion', () => {
    cy.visit('/expeditions')
    cy.wait(2000)
    cy.captureStep('03-01-lista-expediciones')

    cy.contains('Nuevo').click({ force: true })
    cy.url().should('include', '/expeditions/new')
    cy.wait(1000)
    cy.captureStep('03-02-nuevo-expediente')

    // Paso 1: Importacion ya seleccionada por defecto
    cy.contains('Importacion').click({ force: true })
    cy.wait(500)

    // Rellenar Razon Social - buscar por label
    cy.contains('Razon Social').parent().find('input').clear().type('EMPRESA TEST IMPORTACION SL')
    cy.captureStep('03-03-razon-social')

    // NIF
    cy.contains('NIF').parent().find('input').clear().type('B99999999')

    // Email
    cy.contains('Email').parent().find('input').clear().type('test@empresa.es')
    cy.captureStep('03-04-datos-cliente-completos')

    // Siguiente
    cy.contains('Siguiente').click({ force: true })
    cy.wait(1000)
    cy.captureStep('03-05-paso-mercancias')

    // Paso 2: Mercancias - buscar textarea o input de descripcion
    cy.get('textarea').first().clear().type('Cafe verde sin tostar ni descafeinar para importacion')

    // TARIC
    cy.get('body').then(($body) => {
      const taricInput = $body.find('input[placeholder*="TARIC"], input[maxlength="10"]')
      if (taricInput.length) {
        cy.wrap(taricInput.first()).clear().type('0901110000')
      }
    })
    cy.captureStep('03-06-mercancia-completada')

    cy.contains('Siguiente').click({ force: true })
    cy.wait(1000)
    cy.captureStep('03-07-paso-transporte')

    // Paso 3: Crear
    cy.contains('Crear').click({ force: true })
    cy.wait(3000)
    cy.captureStep('03-08-expediente-creado')
  })

  it('Navega a declaraciones y genera H1', () => {
    cy.visit('/declarations')
    cy.wait(2000)
    cy.captureStep('03-09-generador-declaraciones')

    // Seleccionar expediente si hay selector
    cy.get('body').then(($body) => {
      if ($body.find('select').length > 0) {
        cy.get('select').first().then(($sel) => {
          if ($sel.find('option').length > 1) {
            cy.wrap($sel).select(1, { force: true })
            cy.wait(1000)
          }
        })
      }
    })
    cy.captureStep('03-10-declaracion-configurada')

    // Generar
    cy.get('body').then(($body) => {
      if ($body.text().includes('Generar')) {
        cy.contains('Generar').click({ force: true })
        cy.wait(3000)
        cy.captureStep('03-11-declaracion-generada')
      }
    })

    // Enviar a AEAT
    cy.get('body').then(($body) => {
      if ($body.text().includes('Enviar a AEAT')) {
        cy.contains('Enviar a AEAT').click({ force: true })
        cy.on('window:confirm', () => true)
        cy.wait(5000)
        cy.captureStep('03-12-h1-enviado-aeat')
      }
    })
  })
})
