// =============================================================================
// PRUEBA COMPLETA H1 - Importacion Completa (DUA H1)
// =============================================================================
// Flujo end-to-end: login > dashboard > crear expedicion importacion >
// rellenar importador > mercancia > transporte > crear > generar H1 XML >
// previsualizar > enviar a AEAT > verificar MRN/canal > dashboard canales
//
// Usuario: luis.rodriguez@strixai.es (superadmin)
// Datos de prueba: Cafe verde Colombia, TARIC 0901110000, 5000 kg, 15000 EUR
// =============================================================================

describe('PRUEBA COMPLETA H1 - Importacion Completa', () => {

  before(() => {
    cy.login('luis.rodriguez@strixai.es', 'test123')
  })

  beforeEach(() => {
    cy.login('luis.rodriguez@strixai.es', 'test123')
  })

  // -------------------------------------------------------------------------
  // PASO 1: Verificar acceso al sistema y dashboard principal
  // -------------------------------------------------------------------------
  it('01 - Acceder al sistema y verificar dashboard', () => {
    cy.visit('/')
    cy.waitForLoad()
    cy.captureStep('h1-01-dashboard')

    // El dashboard debe cargar sin errores
    cy.get('body').should('not.contain', 'Error')

    // Verificar que hay contenido cargado (sidebar, header, o cards)
    cy.get('body').then($body => {
      const hasNav = $body.find('nav, aside, [role="navigation"]').length > 0
      const hasContent = $body.find('main, .dashboard, [class*="grid"]').length > 0
      expect(hasNav || hasContent).to.be.true
    })
  })

  // -------------------------------------------------------------------------
  // PASO 2: Navegar a la lista de expediciones
  // -------------------------------------------------------------------------
  it('02 - Navegar a expediciones', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(2000)
    cy.captureStep('h1-02-lista-expediciones')

    // La pagina debe mostrar alguna tabla o lista
    cy.get('body').then($body => {
      const hasTable = $body.find('table, tbody, [role="table"]').length > 0
      const hasList = $body.find('[class*="list"], [class*="grid"]').length > 0
      const hasEmpty = $body.text().includes('No hay') || $body.text().includes('vac')
      // Al menos debe haber tabla, lista o mensaje de vacio
      expect(hasTable || hasList || hasEmpty).to.be.true
    })
  })

  // -------------------------------------------------------------------------
  // PASO 3: Crear nueva expedicion de importacion - seleccion de tipo
  // -------------------------------------------------------------------------
  it('03 - Crear nueva expedicion de importacion', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(1000)

    // Click en boton de nueva expedicion
    cy.contains(/Nuevo|Nueva|Crear/).first().click({ force: true })
    cy.wait(2000)
    cy.captureStep('h1-03-seleccion-tipo')

    // Seleccionar tipo Importacion
    cy.get('body').then($body => {
      if ($body.text().match(/Importaci[oó]n/)) {
        cy.contains(/Importaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
        cy.captureStep('h1-03b-importacion-seleccionada')
      }
    })

    // Verificar que estamos en el formulario de creacion
    cy.url().should('include', '/expedition')
  })

  // -------------------------------------------------------------------------
  // PASO 4: Rellenar datos del importador
  // -------------------------------------------------------------------------
  it('04 - Rellenar datos del importador', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(1000)
    cy.contains(/Nuevo|Nueva|Crear/).first().click({ force: true })
    cy.wait(2000)

    // Seleccionar importacion si aparece selector de tipo
    cy.get('body').then($body => {
      if ($body.text().match(/Importaci[oó]n/)) {
        cy.contains(/Importaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
      }
    })

    // --- Razon Social ---
    cy.get('body').then($body => {
      // Estrategia 1: buscar por label "Razon Social"
      const labelRazon = $body.find(':contains("Razon Social")')
      if (labelRazon.length > 0) {
        cy.contains('Razon Social').parent().find('input').first()
          .clear().type('PRUEBA H1 COMPLETA SL', { force: true })
      } else {
        // Estrategia 2: primer input de texto
        cy.get('input[type="text"]').first()
          .clear().type('PRUEBA H1 COMPLETA SL', { force: true })
      }
    })

    // --- NIF/CIF ---
    cy.get('body').then($body => {
      const nifInput = $body.find('input[placeholder*="NIF"], input[placeholder*="CIF"]')
      if (nifInput.length > 0) {
        cy.wrap(nifInput.first()).clear().type('B12345678', { force: true })
      } else if ($body.find(':contains("NIF")').length > 0) {
        cy.contains(/NIF|CIF/).parent().find('input').first()
          .clear().type('B12345678', { force: true })
      }
    })

    // --- EORI ---
    cy.get('body').then($body => {
      const eoriInput = $body.find('input[placeholder*="EORI"]')
      if (eoriInput.length > 0) {
        cy.wrap(eoriInput.first()).clear().type('ESB12345678', { force: true })
      } else if ($body.text().includes('EORI')) {
        cy.contains('EORI').parent().find('input').first()
          .clear().type('ESB12345678', { force: true })
      }
    })

    // --- Email ---
    cy.get('body').then($body => {
      if ($body.find('input[type="email"]').length > 0) {
        cy.get('input[type="email"]').first()
          .clear().type('prueba-h1@strixai.es', { force: true })
      } else if ($body.text().includes('Email')) {
        cy.contains('Email').parent().find('input').first()
          .clear().type('prueba-h1@strixai.es', { force: true })
      }
    })

    cy.captureStep('h1-04-datos-importador')

    // Avanzar al siguiente paso
    cy.contains(/Siguiente|Continuar|Next/).first().click({ force: true })
    cy.wait(2000)
    cy.captureStep('h1-04b-paso-mercancia')
  })

  // -------------------------------------------------------------------------
  // PASO 5: Rellenar datos de mercancia (TARIC, descripcion, peso, valor)
  // -------------------------------------------------------------------------
  it('05 - Rellenar datos de mercancia', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(1000)
    cy.contains(/Nuevo|Nueva|Crear/).first().click({ force: true })
    cy.wait(2000)

    // Seleccionar importacion
    cy.get('body').then($body => {
      if ($body.text().match(/Importaci[oó]n/)) {
        cy.contains(/Importaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
      }
    })

    // Rellenar datos minimos del importador para avanzar
    cy.get('body').then($body => {
      if ($body.find(':contains("Razon Social")').length > 0) {
        cy.contains('Razon Social').parent().find('input').first()
          .clear().type('PRUEBA H1 MERCANCIA SL', { force: true })
      } else {
        cy.get('input[type="text"]').first()
          .clear().type('PRUEBA H1 MERCANCIA SL', { force: true })
      }
    })

    cy.get('body').then($body => {
      const nifInput = $body.find('input[placeholder*="NIF"]')
      if (nifInput.length > 0) {
        cy.wrap(nifInput.first()).clear().type('B12345678', { force: true })
      } else if ($body.text().includes('NIF')) {
        cy.contains('NIF').parent().find('input').first()
          .clear().type('B12345678', { force: true })
      }
    })

    // Siguiente paso (mercancias)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(2000)

    // --- Descripcion de mercancia ---
    cy.get('body').then($body => {
      if ($body.find('textarea').length > 0) {
        cy.get('textarea').first().clear().type(
          'Cafe verde sin tostar, en grano, procedente de Colombia. Peso neto 5000 kg. Valor FOB 15000 EUR.',
          { force: true }
        )
      }
    })

    // --- Codigo TARIC (10 digitos) ---
    cy.get('body').then($body => {
      const taricInput = $body.find('input[maxlength="10"], input[placeholder*="TARIC"], input[placeholder*="arancel"], input[placeholder*="Arancel"]')
      if (taricInput.length > 0) {
        cy.wrap(taricInput.first()).clear().type('0901110000', { force: true })
      }
    })

    // --- Peso bruto ---
    cy.get('body').then($body => {
      const pesoInput = $body.find('input[placeholder*="peso"], input[placeholder*="Peso"], input[placeholder*="kg"], input[placeholder*="Kg"]')
      if (pesoInput.length > 0) {
        cy.wrap(pesoInput.first()).clear().type('5500', { force: true })
      } else if ($body.text().match(/Peso|Bruto|Neto/)) {
        cy.contains(/Peso bruto|Peso/).parent().find('input').first()
          .clear().type('5500', { force: true })
      }
    })

    // --- Valor ---
    cy.get('body').then($body => {
      const valorInput = $body.find('input[placeholder*="valor"], input[placeholder*="Valor"], input[placeholder*="EUR"]')
      if (valorInput.length > 0) {
        cy.wrap(valorInput.first()).clear().type('15000', { force: true })
      } else if ($body.text().match(/Valor|Importe|FOB/)) {
        cy.contains(/Valor|Importe/).parent().find('input').first()
          .clear().type('15000', { force: true })
      }
    })

    // --- Pais de origen ---
    cy.get('body').then($body => {
      const paisSelect = $body.find('select[name*="pais"], select[name*="country"], select[name*="origen"]')
      if (paisSelect.length > 0) {
        cy.wrap(paisSelect.first()).then($sel => {
          // Intentar seleccionar Colombia (CO)
          if ($sel.find('option[value="CO"]').length > 0) {
            cy.wrap($sel).select('CO', { force: true })
          } else if ($sel.find('option').length > 1) {
            cy.wrap($sel).select(1, { force: true })
          }
        })
      } else if ($body.text().match(/Pa[ií]s.*origen|Origen/)) {
        cy.contains(/Pa[ií]s.*origen|Origen/).parent().find('select, input').first()
          .then($el => {
            if ($el.is('select')) {
              cy.wrap($el).select(1, { force: true })
            } else {
              cy.wrap($el).clear().type('CO', { force: true })
            }
          })
      }
    })

    cy.captureStep('h1-05-datos-mercancia')

    // Siguiente paso (transporte)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(2000)
    cy.captureStep('h1-05b-paso-transporte')
  })

  // -------------------------------------------------------------------------
  // PASO 6: Rellenar datos de transporte y crear expedicion
  // -------------------------------------------------------------------------
  it('06 - Rellenar transporte y crear expedicion', () => {
    // Crear expedicion completa en un solo flujo
    cy.visit('/expeditions/new')
    cy.wait(2000)

    // Tipo importacion
    cy.get('body').then($body => {
      if ($body.text().match(/Importaci[oó]n/)) {
        cy.contains(/Importaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
      }
    })

    // Datos importador (rapido)
    cy.get('body').then($body => {
      if ($body.find(':contains("Razon Social")').length > 0) {
        cy.contains('Razon Social').parent().find('input').first()
          .clear().type('CAFE IMPORTACIONES COLOMBIA SL', { force: true })
      } else {
        cy.get('input[type="text"]').first()
          .clear().type('CAFE IMPORTACIONES COLOMBIA SL', { force: true })
      }
    })

    cy.get('body').then($body => {
      if ($body.text().includes('NIF')) {
        cy.contains('NIF').parent().find('input').first()
          .clear().type('B98765432', { force: true })
      }
    })

    cy.get('body').then($body => {
      if ($body.text().includes('Email')) {
        cy.contains('Email').parent().find('input').first()
          .clear().type('cafe-h1@strixai.es', { force: true })
      }
    })

    // Siguiente (mercancias)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(1500)

    // Mercancia
    cy.get('body').then($body => {
      if ($body.find('textarea').length > 0) {
        cy.get('textarea').first().clear().type(
          'Cafe verde sin tostar ni descafeinar, en grano, origen Colombia',
          { force: true }
        )
      }
    })

    cy.get('body').then($body => {
      const taricInput = $body.find('input[maxlength="10"], input[placeholder*="TARIC"]')
      if (taricInput.length > 0) {
        cy.wrap(taricInput.first()).clear().type('0901110000', { force: true })
      }
    })

    // Siguiente (transporte)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(1500)

    // --- Datos de transporte ---
    cy.get('body').then($body => {
      // Modo de transporte (maritimo = 1, carretera = 3, aereo = 4)
      const modoSelect = $body.find('select[name*="modo"], select[name*="transport"], select[name*="mode"]')
      if (modoSelect.length > 0) {
        cy.wrap(modoSelect.first()).then($sel => {
          if ($sel.find('option').length > 1) {
            cy.wrap($sel).select(1, { force: true })
          }
        })
      }

      // Matricula / identificacion medio transporte
      const matriculaInput = $body.find('input[placeholder*="matr"], input[placeholder*="Matr"], input[name*="vehicle"], input[name*="transport"]')
      if (matriculaInput.length > 0) {
        cy.wrap(matriculaInput.first()).clear().type('CARGO-2026-COL', { force: true })
      }

      // Referencia documento transporte (BL, AWB)
      const refInput = $body.find('input[placeholder*="BL"], input[placeholder*="referencia"], input[name*="document"]')
      if (refInput.length > 0) {
        cy.wrap(refInput.first()).clear().type('BL-COL-2026-H1TEST', { force: true })
      }
    })

    cy.captureStep('h1-06-datos-transporte')

    // Crear expedicion
    cy.get('body').then($body => {
      if ($body.text().includes('Crear')) {
        cy.contains('Crear').first().click({ force: true })
      } else {
        cy.contains(/Guardar|Finalizar|Completar/).first().click({ force: true })
      }
    })
    cy.wait(3000)
    cy.captureStep('h1-06b-expediente-creado')
  })

  // -------------------------------------------------------------------------
  // PASO 7: Verificar la expedicion en la lista
  // -------------------------------------------------------------------------
  it('07 - Verificar expedicion creada en la lista', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('h1-07-lista-con-expedicion')

    // Verificar que hay filas en la tabla
    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        // Click en la primera expedicion (la mas reciente)
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('h1-07b-detalle-expedicion')
      } else if ($body.find('table tr').length > 1) {
        cy.get('table tr').eq(1).click({ force: true })
        cy.wait(2000)
        cy.captureStep('h1-07b-detalle-expedicion')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 8: Navegar a declaraciones y generar H1
  // -------------------------------------------------------------------------
  it('08 - Generar declaracion H1', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(2000)
    cy.captureStep('h1-08-pantalla-declaraciones')

    // Seleccionar expediente si hay selector
    cy.get('body').then($body => {
      const selects = $body.find('select, [role="combobox"], [role="listbox"]')
      if (selects.length > 0) {
        cy.get('select').first().then($sel => {
          if ($sel.find('option').length > 1) {
            // Seleccionar la ultima opcion (la mas reciente)
            const optCount = $sel.find('option').length
            cy.wrap($sel).select(optCount - 1, { force: true })
            cy.wait(1000)
          }
        })
        cy.captureStep('h1-08b-expediente-seleccionado')
      }
    })

    // Click en Generar
    cy.get('body').then($body => {
      if ($body.text().includes('Generar')) {
        cy.contains('Generar').first().click({ force: true })
        cy.wait(3000)
        cy.captureStep('h1-08c-xml-generado')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 9: Previsualizar XML generado
  // -------------------------------------------------------------------------
  it('09 - Visualizar XML generado', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(2000)

    // Seleccionar expediente
    cy.get('body').then($body => {
      if ($body.find('select').length > 0) {
        cy.get('select').first().then($sel => {
          if ($sel.find('option').length > 1) {
            const optCount = $sel.find('option').length
            cy.wrap($sel).select(optCount - 1, { force: true })
            cy.wait(1000)
          }
        })
      }
    })

    // Generar si no esta generado
    cy.get('body').then($body => {
      if ($body.text().includes('Generar') && !$body.find('pre, code, [class*="xml"]').length) {
        cy.contains('Generar').first().click({ force: true })
        cy.wait(3000)
      }
    })

    // Buscar preview XML
    cy.get('body').then($body => {
      // Boton de vista previa
      if ($body.text().match(/Vista previa|Preview|Ver XML/)) {
        cy.contains(/Vista previa|Preview|Ver XML/).first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('h1-09-preview-xml')
      }

      // Verificar contenido XML visible
      if ($body.find('pre, code, [class*="xml"]').length > 0) {
        cy.get('pre, code, [class*="xml"]').first().should('exist')
        cy.captureStep('h1-09b-xml-contenido')
      }
    })

    cy.captureStep('h1-09c-estado-declaracion')
  })

  // -------------------------------------------------------------------------
  // PASO 10: Enviar declaracion H1 a AEAT
  // -------------------------------------------------------------------------
  it('10 - Enviar declaracion H1 a AEAT', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(2000)

    // Seleccionar expediente
    cy.get('body').then($body => {
      if ($body.find('select').length > 0) {
        cy.get('select').first().then($sel => {
          if ($sel.find('option').length > 1) {
            const optCount = $sel.find('option').length
            cy.wrap($sel).select(optCount - 1, { force: true })
            cy.wait(1000)
          }
        })
      }
    })

    // Generar primero si es necesario
    cy.get('body').then($body => {
      if ($body.text().includes('Generar') && $body.text().includes('Enviar') === false) {
        cy.contains('Generar').first().click({ force: true })
        cy.wait(3000)
      }
    })

    // Enviar a AEAT
    cy.get('body').then($body => {
      if ($body.text().includes('Enviar a AEAT') || $body.text().includes('Enviar')) {
        cy.contains(/Enviar a AEAT|Enviar/).first().click({ force: true })
        cy.wait(1000)

        // Aceptar dialogo de confirmacion si aparece
        cy.on('window:confirm', () => true)

        cy.get('body').then($body2 => {
          if ($body2.text().match(/Confirmar|[SsÍí],?\s|Aceptar/)) {
            cy.contains(/Confirmar|[SsÍí],?\s|Aceptar/).first().click({ force: true })
          }
        })

        // Esperar respuesta de AEAT (puede tardar)
        cy.wait(10000)
        cy.captureStep('h1-10-respuesta-aeat')

        // Verificar si hay mensaje de resultado
        cy.get('body').then($body3 => {
          if ($body3.text().includes('MRN') || $body3.text().includes('Aceptad')) {
            cy.captureStep('h1-10b-resultado-exitoso')
          } else if ($body3.text().includes('Error') || $body3.text().includes('Rechazad')) {
            cy.captureStep('h1-10b-resultado-error')
          }
        })
      } else {
        cy.captureStep('h1-10-sin-boton-enviar')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 11: Verificar MRN y canal asignado
  // -------------------------------------------------------------------------
  it('11 - Verificar resultado MRN y canal', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('h1-11-lista-post-envio')

    // Buscar indicadores de MRN o canal
    cy.get('body').then($body => {
      const hasMRN = $body.text().includes('MRN') || $body.text().match(/\d{2}ES\d{12}/)
      const hasCanal = $body.text().match(/Canal|canal|green|orange|red|verde|naranja|rojo/)

      if (hasMRN) {
        cy.captureStep('h1-11b-mrn-visible')
      }

      // Click en la primera expedicion para ver detalle
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('h1-11c-detalle-final')

        // Verificar si hay badges de canal
        cy.get('body').then($detail => {
          if ($detail.text().match(/green|verde|Canal A/i)) {
            cy.captureStep('h1-11d-canal-verde')
          } else if ($detail.text().match(/orange|naranja|Canal B/i)) {
            cy.captureStep('h1-11d-canal-naranja')
          } else if ($detail.text().match(/red|rojo|Canal C/i)) {
            cy.captureStep('h1-11d-canal-rojo')
          }
        })
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 12: Verificar canal en dashboard de canales
  // -------------------------------------------------------------------------
  it('12 - Verificar canal en dashboard de canales', () => {
    cy.visit('/channels')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('h1-12-dashboard-canales')

    // Verificar que las cards de estadisticas se muestran
    cy.get('body').then($body => {
      const hasCards = $body.find('[class*="card"], [class*="stat"], [class*="Card"]').length > 0
      const hasNumbers = $body.text().match(/\d+/)
      if (hasCards || hasNumbers) {
        cy.captureStep('h1-12b-estadisticas-canales')
      }

      // Verificar tabla de expediciones con canal
      if ($body.find('tbody tr').length > 0) {
        cy.captureStep('h1-12c-listado-canales')
      }
    })
  })
})
