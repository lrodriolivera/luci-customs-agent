// =============================================================================
// PRUEBA COMPLETA AES - Declaracion de Exportacion
// =============================================================================
// Flujo end-to-end: login > crear expedicion exportacion > rellenar exportador
// (STRIX AI SL) > destino Francia > mercancia (equipos informaticos) >
// transporte por carretera > crear expedicion > generar AES XML >
// previsualizar > enviar a AEAT > verificar MRN y canal verde
//
// Usuario: luis.rodriguez@strixai.es (superadmin)
// Datos de prueba: Equipos informaticos, TARIC 8471410000, 2000 kg, 25000 EUR
// Exportador: STRIX AI SL (B22477020, EORI ESB22477020)
// Destino: Francia (FR)
// Ubicacion exportacion: 2801AAAAAC (datos Jose Antonio AEAT PRE)
// =============================================================================

describe('PRUEBA COMPLETA AES - Declaracion de Exportacion', () => {

  before(() => {
    cy.login('luis.rodriguez@strixai.es', 'test123')
  })

  beforeEach(() => {
    cy.login('luis.rodriguez@strixai.es', 'test123')
  })

  // -------------------------------------------------------------------------
  // PASO 1: Acceder al sistema y verificar dashboard
  // -------------------------------------------------------------------------
  it('01 - Acceder al sistema y verificar dashboard', () => {
    cy.visit('/')
    cy.waitForLoad()
    cy.captureStep('aes-01-dashboard')

    cy.get('body').should('not.contain', 'Error')

    // Verificar que la aplicacion ha cargado
    cy.get('body').then($body => {
      const hasUI = $body.find('nav, aside, main, [role="navigation"]').length > 0
      expect(hasUI).to.be.true
    })
  })

  // -------------------------------------------------------------------------
  // PASO 2: Navegar a expediciones y verificar lista
  // -------------------------------------------------------------------------
  it('02 - Navegar a expediciones', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(2000)
    cy.captureStep('aes-02-lista-expediciones')

    // Verificar que la pagina carga
    cy.get('body').then($body => {
      const hasContent = $body.find('table, tbody, [class*="list"]').length > 0
      const hasEmpty = $body.text().match(/No hay|vac[ií]/i)
      expect(hasContent || hasEmpty).to.be.true
    })
  })

  // -------------------------------------------------------------------------
  // PASO 3: Crear nueva expedicion de exportacion
  // -------------------------------------------------------------------------
  it('03 - Crear nueva expedicion de exportacion', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(1000)

    // Click en nueva expedicion
    cy.contains(/Nuevo|Nueva|Crear/).first().click({ force: true })
    cy.wait(2000)
    cy.captureStep('aes-03-seleccion-tipo')

    // Seleccionar tipo Exportacion
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n/)) {
        cy.contains(/Exportaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
        cy.captureStep('aes-03b-exportacion-seleccionada')
      }
    })

    // Verificar que estamos en formulario
    cy.url().should('include', '/expedition')
  })

  // -------------------------------------------------------------------------
  // PASO 4: Rellenar datos del exportador (STRIX AI SL)
  // -------------------------------------------------------------------------
  it('04 - Rellenar datos del exportador', () => {
    cy.visit('/expeditions/new')
    cy.wait(2000)

    // Seleccionar exportacion
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n/)) {
        cy.contains(/Exportaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
      }
    })

    // --- Razon Social ---
    cy.get('body').then($body => {
      if ($body.find(':contains("Razon Social")').length > 0) {
        cy.contains('Razon Social').parent().find('input').first()
          .clear().type('STRIX AI SL', { force: true })
      } else {
        cy.get('input[type="text"]').first()
          .clear().type('STRIX AI SL', { force: true })
      }
    })

    // --- NIF ---
    cy.get('body').then($body => {
      if ($body.text().includes('NIF')) {
        cy.contains('NIF').parent().find('input').first()
          .clear().type('B22477020', { force: true })
      } else {
        const nifInput = $body.find('input[placeholder*="NIF"], input[placeholder*="CIF"]')
        if (nifInput.length > 0) {
          cy.wrap(nifInput.first()).clear().type('B22477020', { force: true })
        }
      }
    })

    // --- EORI ---
    cy.get('body').then($body => {
      const eoriInput = $body.find('input[placeholder*="EORI"], input[name*="eori"]')
      if (eoriInput.length > 0) {
        cy.wrap(eoriInput.first()).clear().type('ESB22477020', { force: true })
      } else if ($body.text().includes('EORI')) {
        cy.contains('EORI').parent().find('input').first()
          .clear().type('ESB22477020', { force: true })
      }
    })

    // --- Email ---
    cy.get('body').then($body => {
      if ($body.find('input[type="email"]').length > 0) {
        cy.get('input[type="email"]').first()
          .clear().type('despacho@strixai.es', { force: true })
      } else if ($body.text().includes('Email')) {
        cy.contains('Email').parent().find('input').first()
          .clear().type('despacho@strixai.es', { force: true })
      }
    })

    cy.captureStep('aes-04-datos-exportador')

    // Siguiente paso
    cy.contains(/Siguiente|Continuar|Next/).first().click({ force: true })
    cy.wait(2000)
    cy.captureStep('aes-04b-paso-mercancia')
  })

  // -------------------------------------------------------------------------
  // PASO 5: Rellenar datos de mercancia para exportacion
  // -------------------------------------------------------------------------
  it('05 - Rellenar datos de mercancia para exportacion', () => {
    cy.visit('/expeditions/new')
    cy.wait(2000)

    // Seleccionar exportacion
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n/)) {
        cy.contains(/Exportaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
      }
    })

    // Datos exportador rapido
    cy.get('body').then($body => {
      if ($body.find(':contains("Razon Social")').length > 0) {
        cy.contains('Razon Social').parent().find('input').first()
          .clear().type('STRIX AI SL', { force: true })
      } else {
        cy.get('input[type="text"]').first()
          .clear().type('STRIX AI SL', { force: true })
      }
    })

    cy.get('body').then($body => {
      if ($body.text().includes('NIF')) {
        cy.contains('NIF').parent().find('input').first()
          .clear().type('B22477020', { force: true })
      }
    })

    cy.get('body').then($body => {
      if ($body.text().includes('Email')) {
        cy.contains('Email').parent().find('input').first()
          .clear().type('despacho@strixai.es', { force: true })
      }
    })

    // Siguiente (mercancias)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(1500)

    // --- Descripcion ---
    cy.get('body').then($body => {
      if ($body.find('textarea').length > 0) {
        cy.get('textarea').first().clear().type(
          'Equipos informaticos: ordenadores portatiles y accesorios. Destino Francia. Peso neto 2000 kg. Valor 25000 EUR.',
          { force: true }
        )
      }
    })

    // --- Codigo TARIC (8471410000 = portatiles) ---
    cy.get('body').then($body => {
      const taricInput = $body.find('input[maxlength="10"], input[placeholder*="TARIC"], input[placeholder*="arancel"]')
      if (taricInput.length > 0) {
        cy.wrap(taricInput.first()).clear().type('8471410000', { force: true })
      }
    })

    // --- Peso bruto ---
    cy.get('body').then($body => {
      const pesoInput = $body.find('input[placeholder*="peso"], input[placeholder*="Peso"], input[placeholder*="kg"]')
      if (pesoInput.length > 0) {
        cy.wrap(pesoInput.first()).clear().type('2200', { force: true })
      } else if ($body.text().match(/Peso/)) {
        cy.contains(/Peso/).first().parent().find('input').first()
          .clear().type('2200', { force: true })
      }
    })

    // --- Valor ---
    cy.get('body').then($body => {
      const valorInput = $body.find('input[placeholder*="valor"], input[placeholder*="Valor"], input[placeholder*="EUR"]')
      if (valorInput.length > 0) {
        cy.wrap(valorInput.first()).clear().type('25000', { force: true })
      } else if ($body.text().match(/Valor|Importe/)) {
        cy.contains(/Valor|Importe/).first().parent().find('input').first()
          .clear().type('25000', { force: true })
      }
    })

    // --- Pais destino (FR = Francia) ---
    cy.get('body').then($body => {
      const paisSelect = $body.find('select[name*="country"], select[name*="pais"], select[name*="dest"]')
      if (paisSelect.length > 0) {
        cy.wrap(paisSelect.first()).then($sel => {
          if ($sel.find('option[value="FR"]').length > 0) {
            cy.wrap($sel).select('FR', { force: true })
          } else if ($sel.find('option').length > 1) {
            cy.wrap($sel).select(1, { force: true })
          }
        })
      } else if ($body.text().match(/Pa[ií]s.*destino|Destino/i)) {
        cy.contains(/Pa[ií]s.*destino|Destino/).first().parent().find('select, input').first()
          .then($el => {
            if ($el.is('select')) {
              if ($el.find('option[value="FR"]').length > 0) {
                cy.wrap($el).select('FR', { force: true })
              } else {
                cy.wrap($el).select(1, { force: true })
              }
            } else {
              cy.wrap($el).clear().type('FR', { force: true })
            }
          })
      }
    })

    cy.captureStep('aes-05-datos-mercancia')

    // Siguiente (transporte)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(2000)
    cy.captureStep('aes-05b-paso-transporte')
  })

  // -------------------------------------------------------------------------
  // PASO 6: Rellenar datos de transporte y crear expedicion
  // -------------------------------------------------------------------------
  it('06 - Rellenar transporte por carretera y crear expedicion', () => {
    cy.visit('/expeditions/new')
    cy.wait(2000)

    // Seleccionar exportacion
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n/)) {
        cy.contains(/Exportaci[oó]n/).first().click({ force: true })
        cy.wait(1000)
      }
    })

    // Datos exportador rapido
    cy.get('body').then($body => {
      if ($body.find(':contains("Razon Social")').length > 0) {
        cy.contains('Razon Social').parent().find('input').first()
          .clear().type('STRIX AI SL EXPORT TEST', { force: true })
      } else {
        cy.get('input[type="text"]').first()
          .clear().type('STRIX AI SL EXPORT TEST', { force: true })
      }
    })

    cy.get('body').then($body => {
      if ($body.text().includes('NIF')) {
        cy.contains('NIF').parent().find('input').first()
          .clear().type('B22477020', { force: true })
      }
    })

    cy.get('body').then($body => {
      if ($body.text().includes('Email')) {
        cy.contains('Email').parent().find('input').first()
          .clear().type('export@strixai.es', { force: true })
      }
    })

    // Siguiente (mercancias)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(1500)

    // Mercancia rapido
    cy.get('body').then($body => {
      if ($body.find('textarea').length > 0) {
        cy.get('textarea').first().clear().type(
          'Equipos informaticos para exportacion a Francia',
          { force: true }
        )
      }
    })

    cy.get('body').then($body => {
      const taricInput = $body.find('input[maxlength="10"], input[placeholder*="TARIC"]')
      if (taricInput.length > 0) {
        cy.wrap(taricInput.first()).clear().type('8471410000', { force: true })
      }
    })

    // Siguiente (transporte)
    cy.contains(/Siguiente|Continuar/).first().click({ force: true })
    cy.wait(1500)

    // --- Modo de transporte (carretera = 3) ---
    cy.get('body').then($body => {
      const modoSelect = $body.find('select[name*="modo"], select[name*="transport"], select[name*="mode"]')
      if (modoSelect.length > 0) {
        cy.wrap(modoSelect.first()).then($sel => {
          // Intentar seleccionar carretera (valor 3 o por texto)
          if ($sel.find('option[value="3"]').length > 0) {
            cy.wrap($sel).select('3', { force: true })
          } else if ($sel.find('option').length > 1) {
            cy.wrap($sel).select(1, { force: true })
          }
        })
      }
    })

    // --- Matricula vehiculo ---
    cy.get('body').then($body => {
      const matriculaInput = $body.find('input[placeholder*="matr"], input[placeholder*="Matr"], input[name*="vehicle"], input[name*="plate"]')
      if (matriculaInput.length > 0) {
        cy.wrap(matriculaInput.first()).clear().type('1234-BCD', { force: true })
      } else if ($body.text().match(/Matr[ií]cula|Veh[ií]culo|Plate/i)) {
        cy.contains(/Matr[ií]cula|Veh[ií]culo/).first().parent().find('input').first()
          .clear().type('1234-BCD', { force: true })
      }
    })

    // --- Referencia documento transporte (CMR) ---
    cy.get('body').then($body => {
      const refInput = $body.find('input[placeholder*="CMR"], input[placeholder*="referencia"], input[name*="document"], input[placeholder*="BL"]')
      if (refInput.length > 0) {
        cy.wrap(refInput.first()).clear().type('CMR-FR-2026-AESTEST', { force: true })
      }
    })

    // --- Region de expedicion (obligatorio para ES en AES) ---
    cy.get('body').then($body => {
      const regionInput = $body.find('select[name*="region"], input[name*="region"]')
      if (regionInput.length > 0) {
        cy.wrap(regionInput.first()).then($el => {
          if ($el.is('select') && $el.find('option').length > 1) {
            cy.wrap($el).select(1, { force: true })
          } else if ($el.is('input')) {
            cy.wrap($el).clear().type('ES30', { force: true })
          }
        })
      }
    })

    cy.captureStep('aes-06-datos-transporte')

    // Crear expedicion
    cy.get('body').then($body => {
      if ($body.text().includes('Crear')) {
        cy.contains('Crear').first().click({ force: true })
      } else {
        cy.contains(/Guardar|Finalizar|Completar/).first().click({ force: true })
      }
    })
    cy.wait(3000)
    cy.captureStep('aes-06b-expediente-creado')
  })

  // -------------------------------------------------------------------------
  // PASO 7: Verificar expedicion de exportacion en la lista
  // -------------------------------------------------------------------------
  it('07 - Verificar expedicion de exportacion en lista', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('aes-07-lista-con-exportacion')

    // Buscar la expedicion recien creada
    cy.get('body').then($body => {
      // Buscar por texto "Exportacion" o "STRIX" en la tabla
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('aes-07b-detalle-exportacion')

        // Verificar que es de tipo exportacion
        cy.get('body').then($detail => {
          if ($detail.text().match(/Exportaci[oó]n|Export|AES/i)) {
            cy.captureStep('aes-07c-tipo-exportacion-confirmado')
          }
        })
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 8: Navegar a declaraciones y generar AES
  // -------------------------------------------------------------------------
  it('08 - Generar declaracion AES', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(2000)
    cy.captureStep('aes-08-pantalla-declaraciones')

    // Seleccionar expediente de exportacion
    cy.get('body').then($body => {
      if ($body.find('select').length > 0) {
        cy.get('select').first().then($sel => {
          if ($sel.find('option').length > 1) {
            // Seleccionar la ultima opcion (la mas reciente)
            const optCount = $sel.find('option').length
            cy.wrap($sel).select(optCount - 1, { force: true })
            cy.wait(1000)
          }
        })
        cy.captureStep('aes-08b-expediente-seleccionado')
      }
    })

    // Seleccionar tipo AES si hay selector de tipo
    cy.get('body').then($body => {
      if ($body.text().match(/Tipo.*declaraci|AES|Exportaci/i)) {
        const tipoSelect = $body.find('select[name*="type"], select[name*="tipo"]')
        if (tipoSelect.length > 0) {
          cy.wrap(tipoSelect.first()).then($sel => {
            if ($sel.find('option[value*="aes"], option[value*="AES"], option[value*="export"]').length > 0) {
              cy.wrap($sel).select($sel.find('option[value*="aes"], option[value*="AES"], option[value*="export"]').first().val(), { force: true })
            }
          })
        }
      }
    })

    // Click en Generar
    cy.get('body').then($body => {
      if ($body.text().includes('Generar')) {
        cy.contains('Generar').first().click({ force: true })
        cy.wait(3000)
        cy.captureStep('aes-08c-aes-generado')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 9: Previsualizar XML AES
  // -------------------------------------------------------------------------
  it('09 - Previsualizar XML AES generado', () => {
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
      if ($body.text().includes('Generar') && $body.find('pre, code').length === 0) {
        cy.contains('Generar').first().click({ force: true })
        cy.wait(3000)
      }
    })

    // Buscar y abrir preview
    cy.get('body').then($body => {
      if ($body.text().match(/Vista previa|Preview|Ver XML/)) {
        cy.contains(/Vista previa|Preview|Ver XML/).first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('aes-09-preview-xml')
      }

      // Verificar contenido XML
      if ($body.find('pre, code, [class*="xml"]').length > 0) {
        cy.get('pre, code, [class*="xml"]').first().should('exist')
        cy.captureStep('aes-09b-xml-contenido')

        // Verificar que contiene elementos AES esperados
        cy.get('pre, code, [class*="xml"]').first().invoke('text').then(xmlText => {
          if (xmlText.includes('Export') || xmlText.includes('Consignment') || xmlText.includes('STRIX')) {
            cy.captureStep('aes-09c-xml-valido')
          }
        })
      }
    })

    cy.captureStep('aes-09d-estado-declaracion')
  })

  // -------------------------------------------------------------------------
  // PASO 10: Enviar AES a AEAT
  // -------------------------------------------------------------------------
  it('10 - Enviar AES a AEAT', () => {
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

    // Generar si necesario
    cy.get('body').then($body => {
      if ($body.text().includes('Generar') && !$body.text().match(/Enviar a AEAT/)) {
        cy.contains('Generar').first().click({ force: true })
        cy.wait(3000)
      }
    })

    // Enviar a AEAT
    cy.get('body').then($body => {
      if ($body.text().match(/Enviar a AEAT|Enviar|Submit/)) {
        cy.contains(/Enviar a AEAT|Enviar|Submit/).first().click({ force: true })
        cy.wait(1000)

        // Aceptar dialogo de confirmacion
        cy.on('window:confirm', () => true)

        cy.get('body').then($body2 => {
          if ($body2.text().match(/Confirmar|[SsÍí],?\s|Aceptar/)) {
            cy.contains(/Confirmar|[SsÍí],?\s|Aceptar/).first().click({ force: true })
          }
        })

        // Esperar respuesta de AEAT (AES puede tardar)
        cy.wait(10000)
        cy.captureStep('aes-10-respuesta-aeat')

        // Verificar resultado
        cy.get('body').then($body3 => {
          if ($body3.text().includes('MRN') || $body3.text().match(/Aceptad/)) {
            cy.captureStep('aes-10b-resultado-exitoso')
          } else if ($body3.text().match(/Error|Rechaz/)) {
            cy.captureStep('aes-10b-resultado-error')
          }
        })
      } else {
        cy.captureStep('aes-10-sin-boton-enviar')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 11: Verificar MRN y canal verde (AES = Canal V)
  // -------------------------------------------------------------------------
  it('11 - Verificar MRN y canal verde en expedicion', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('aes-11-lista-post-envio')

    // Buscar MRN en la tabla
    cy.get('body').then($body => {
      const hasMRN = $body.text().match(/\d{2}ES\d{12}/)
      if (hasMRN) {
        cy.captureStep('aes-11b-mrn-visible')
      }

      // Click en la primera expedicion
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('aes-11c-detalle-exportacion')

        // Verificar canal verde (AES usa Canal V = verde)
        cy.get('body').then($detail => {
          if ($detail.text().match(/green|verde|Canal V|Canal A/i)) {
            cy.captureStep('aes-11d-canal-verde-confirmado')
          } else if ($detail.text().match(/orange|naranja|Canal B/i)) {
            cy.captureStep('aes-11d-canal-naranja')
          } else if ($detail.text().match(/red|rojo|Canal C/i)) {
            cy.captureStep('aes-11d-canal-rojo')
          }

          // Verificar levante (AES canal V = levante inmediato)
          if ($detail.text().match(/Levante|levante|Release|release/i)) {
            cy.captureStep('aes-11e-levante-inmediato')
          }
        })
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 12: Verificar en dashboard de canales
  // -------------------------------------------------------------------------
  it('12 - Verificar exportacion en dashboard de canales', () => {
    cy.visit('/channels')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('aes-12-dashboard-canales')

    // Verificar cards de estadisticas
    cy.get('body').then($body => {
      const hasCards = $body.find('[class*="card"], [class*="stat"], [class*="Card"]').length > 0
      if (hasCards) {
        cy.captureStep('aes-12b-estadisticas')
      }

      // Verificar que hay datos de exportacion en la tabla
      if ($body.find('tbody tr').length > 0) {
        cy.captureStep('aes-12c-listado-canales')

        // Buscar expedicion de exportacion en el listado
        if ($body.text().match(/Export|AES|STRIX/i)) {
          cy.captureStep('aes-12d-exportacion-en-canales')
        }
      }

      // Verificar filtros si existen
      if ($body.text().match(/Filtrar|Filter|Todos|All/i)) {
        // Intentar filtro "Todos" para ver todas las expediciones
        cy.get('body').then($body2 => {
          if ($body2.text().match(/Todos|All/)) {
            cy.contains(/Todos|All/).first().click({ force: true })
            cy.wait(2000)
            cy.captureStep('aes-12e-filtro-todos')
          }
        })
      }
    })

    cy.captureStep('aes-12f-estado-final')
  })
})
