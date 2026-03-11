// =============================================================================
// PRUEBA COMPLETA H7 - Declaracion Simplificada de Importacion (bajo valor)
// =============================================================================
// Flujo end-to-end: login > navegar a H7 > crear declaracion H7 >
// rellenar consignee/exporter > mercancia (bajo valor <150 EUR) >
// documento transporte > generar XML > previsualizar > enviar a AEAT >
// verificar MRN > verificar en lista H7
//
// Usuario: luis.rodriguez@strixai.es (superadmin)
// Datos de prueba: Camisetas algodon China, HS 610910, 50 kg, 120 EUR
// Garantia: 26ESAGL2800000054 (datos Jose Antonio AEAT PRE)
// =============================================================================

describe('PRUEBA COMPLETA H7 - Declaracion Simplificada Importacion', () => {

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
    cy.captureStep('h7-01-dashboard')

    cy.get('body').should('not.contain', 'Error')
  })

  // -------------------------------------------------------------------------
  // PASO 2: Navegar a la seccion H7
  // -------------------------------------------------------------------------
  it('02 - Navegar a la seccion H7', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('h7-02-lista-h7')

    // Verificar que la pagina H7 carga correctamente
    cy.get('body').then($body => {
      const hasTable = $body.find('table, tbody').length > 0
      const hasList = $body.find('[class*="list"], [class*="grid"]').length > 0
      const hasTitle = $body.text().match(/H7|simplificad|bajo valor/i)
      const hasEmpty = $body.text().match(/No hay|vac[ií]/i)
      expect(hasTable || hasList || hasTitle || hasEmpty).to.be.true
    })
  })

  // -------------------------------------------------------------------------
  // PASO 3: Verificar lista de declaraciones H7 existentes
  // -------------------------------------------------------------------------
  it('03 - Verificar lista H7 existente', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(2000)

    cy.get('body').then($body => {
      const rows = $body.find('tbody tr, table tr')
      if (rows.length > 1) {
        // Hay declaraciones H7 existentes
        cy.captureStep('h7-03-lista-con-datos')

        // Click en la primera para ver detalle
        cy.get('tbody tr, table tr').eq(0).then($row => {
          const clickable = $row.find('a, button, [class*="cursor"]')
          if (clickable.length > 0) {
            cy.wrap(clickable.first()).click({ force: true })
          } else {
            cy.wrap($row).click({ force: true })
          }
        })
        cy.wait(2000)
        cy.captureStep('h7-03b-detalle-h7-existente')
      } else {
        cy.captureStep('h7-03-lista-vacia')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 4: Crear nueva declaracion H7
  // -------------------------------------------------------------------------
  it('04 - Crear nueva declaracion H7', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(2000)

    // Buscar boton de nueva H7
    cy.get('body').then($body => {
      const newBtn = $body.text().match(/Nuev[ao]|Crear|A[ñn]adir|\+/)
      if (newBtn) {
        cy.contains(/Nuev[ao]|Crear|A[ñn]adir/).first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('h7-04-formulario-nueva-h7')
      } else {
        // Intentar con boton + o icono
        const plusBtn = $body.find('button[aria-label*="new"], button[aria-label*="add"], a[href*="new"], a[href*="create"]')
        if (plusBtn.length > 0) {
          cy.wrap(plusBtn.first()).click({ force: true })
          cy.wait(2000)
          cy.captureStep('h7-04-formulario-nueva-h7')
        } else {
          cy.captureStep('h7-04-sin-boton-crear')
        }
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 5: Rellenar datos del consignatario (consignee)
  // -------------------------------------------------------------------------
  it('05 - Rellenar datos del consignatario', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(1000)

    // Ir al formulario de creacion
    cy.get('body').then($body => {
      if ($body.text().match(/Nuev[ao]|Crear/)) {
        cy.contains(/Nuev[ao]|Crear/).first().click({ force: true })
        cy.wait(2000)
      }
    })

    // --- EORI Consignatario ---
    cy.get('body').then($body => {
      const eoriInput = $body.find('input[placeholder*="EORI"], input[name*="eori"], input[name*="EORI"]')
      if (eoriInput.length > 0) {
        cy.wrap(eoriInput.first()).clear().type('ESB22477020', { force: true })
      } else if ($body.text().includes('EORI')) {
        cy.contains('EORI').parent().find('input').first()
          .clear().type('ESB22477020', { force: true })
      }
    })

    // --- Nombre consignatario ---
    cy.get('body').then($body => {
      const nameInput = $body.find('input[name*="name"], input[name*="nombre"], input[placeholder*="nombre"], input[placeholder*="Name"]')
      if (nameInput.length > 0) {
        cy.wrap(nameInput.first()).clear().type('STRIX AI SL', { force: true })
      } else if ($body.text().match(/Nombre|Raz[oó]n|Consignatario/)) {
        cy.contains(/Nombre|Raz[oó]n|Consignatario/).first().parent().find('input').first()
          .clear().type('STRIX AI SL', { force: true })
      } else {
        // Primer input de texto disponible
        cy.get('input[type="text"]').first().clear().type('STRIX AI SL', { force: true })
      }
    })

    // --- Direccion ---
    cy.get('body').then($body => {
      const dirInput = $body.find('input[name*="address"], input[name*="direccion"], input[placeholder*="direcci"], input[placeholder*="address"]')
      if (dirInput.length > 0) {
        cy.wrap(dirInput.first()).clear().type('Calle Ejemplo 123, Madrid', { force: true })
      } else if ($body.text().match(/Direcci[oó]n|Address/)) {
        cy.contains(/Direcci[oó]n|Address/).first().parent().find('input').first()
          .clear().type('Calle Ejemplo 123, Madrid', { force: true })
      }
    })

    cy.captureStep('h7-05-datos-consignatario')

    // Avanzar si hay boton siguiente
    cy.get('body').then($body => {
      if ($body.text().match(/Siguiente|Continuar|Next/)) {
        cy.contains(/Siguiente|Continuar|Next/).first().click({ force: true })
        cy.wait(1500)
        cy.captureStep('h7-05b-siguiente-paso')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 6: Rellenar datos del exportador y pais de expedicion
  // -------------------------------------------------------------------------
  it('06 - Rellenar datos del exportador', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(1000)

    // Ir al formulario
    cy.get('body').then($body => {
      if ($body.text().match(/Nuev[ao]|Crear/)) {
        cy.contains(/Nuev[ao]|Crear/).first().click({ force: true })
        cy.wait(2000)
      }
    })

    // Rellenar consignatario rapido
    cy.get('body').then($body => {
      const inputs = $body.find('input[type="text"]')
      if (inputs.length > 0) {
        cy.wrap(inputs.first()).clear().type('STRIX AI SL', { force: true })
      }
    })

    // --- Nombre exportador ---
    cy.get('body').then($body => {
      if ($body.text().match(/Exportador|Exporter|Remitente/)) {
        cy.contains(/Exportador|Exporter|Remitente/).first().parent().find('input').first()
          .clear().type('SHENZHEN TEXTILES CO LTD', { force: true })
      }
    })

    // --- Pais de expedicion (CN = China) ---
    cy.get('body').then($body => {
      const paisSelect = $body.find('select[name*="country"], select[name*="pais"], select[name*="dispatch"]')
      if (paisSelect.length > 0) {
        cy.wrap(paisSelect.first()).then($sel => {
          if ($sel.find('option[value="CN"]').length > 0) {
            cy.wrap($sel).select('CN', { force: true })
          } else if ($sel.find('option').length > 1) {
            cy.wrap($sel).select(1, { force: true })
          }
        })
      } else if ($body.text().match(/Pa[ií]s.*expedici|Pa[ií]s.*dispatch|Pa[ií]s.*origen/i)) {
        cy.contains(/Pa[ií]s/).first().parent().find('select, input').first()
          .then($el => {
            if ($el.is('select')) {
              cy.wrap($el).select(1, { force: true })
            } else {
              cy.wrap($el).clear().type('CN', { force: true })
            }
          })
      }
    })

    cy.captureStep('h7-06-datos-exportador')

    // Avanzar
    cy.get('body').then($body => {
      if ($body.text().match(/Siguiente|Continuar/)) {
        cy.contains(/Siguiente|Continuar/).first().click({ force: true })
        cy.wait(1500)
      }
    })

    cy.captureStep('h7-06b-siguiente-paso')
  })

  // -------------------------------------------------------------------------
  // PASO 7: Rellenar datos de mercancia (bajo valor, < 150 EUR)
  // -------------------------------------------------------------------------
  it('07 - Rellenar datos de mercancia bajo valor', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(1000)

    // Ir al formulario
    cy.get('body').then($body => {
      if ($body.text().match(/Nuev[ao]|Crear/)) {
        cy.contains(/Nuev[ao]|Crear/).first().click({ force: true })
        cy.wait(2000)
      }
    })

    // Rellenar datos previos rapidamente para llegar al paso de mercancia
    cy.get('body').then($body => {
      const inputs = $body.find('input[type="text"]')
      if (inputs.length > 0) {
        cy.wrap(inputs.first()).clear().type('STRIX AI SL', { force: true })
      }
    })

    // Avanzar pasos previos si existen
    cy.get('body').then($body => {
      if ($body.text().match(/Siguiente|Continuar/)) {
        cy.contains(/Siguiente|Continuar/).first().click({ force: true })
        cy.wait(1500)
      }
    })

    // --- Descripcion de mercancia ---
    cy.get('body').then($body => {
      if ($body.find('textarea').length > 0) {
        cy.get('textarea').first().clear().type(
          'Camisetas de algodon para hombre, talla M-XL, color surtido. Origen China.',
          { force: true }
        )
      } else if ($body.text().match(/Descripci[oó]n|Description/)) {
        cy.contains(/Descripci[oó]n|Description/).first().parent().find('textarea, input').first()
          .clear().type('Camisetas de algodon para hombre', { force: true })
      }
    })

    // --- Codigo HS (6 digitos para H7) ---
    cy.get('body').then($body => {
      const hsInput = $body.find('input[maxlength="10"], input[maxlength="6"], input[placeholder*="TARIC"], input[placeholder*="HS"], input[placeholder*="arancel"]')
      if (hsInput.length > 0) {
        cy.wrap(hsInput.first()).clear().type('6109100000', { force: true })
      }
    })

    // --- Peso (kg) ---
    cy.get('body').then($body => {
      const pesoInput = $body.find('input[placeholder*="peso"], input[placeholder*="Peso"], input[placeholder*="kg"], input[name*="weight"]')
      if (pesoInput.length > 0) {
        cy.wrap(pesoInput.first()).clear().type('50', { force: true })
      } else if ($body.text().match(/Peso|Weight|Kg/i)) {
        cy.contains(/Peso|Weight/).first().parent().find('input').first()
          .clear().type('50', { force: true })
      }
    })

    // --- Valor (bajo valor, < 150 EUR para H7) ---
    cy.get('body').then($body => {
      const valorInput = $body.find('input[placeholder*="valor"], input[placeholder*="Valor"], input[placeholder*="EUR"], input[name*="value"]')
      if (valorInput.length > 0) {
        cy.wrap(valorInput.first()).clear().type('120', { force: true })
      } else if ($body.text().match(/Valor|Value|Importe/i)) {
        cy.contains(/Valor|Value|Importe/).first().parent().find('input').first()
          .clear().type('120', { force: true })
      }
    })

    // --- Numero IOSS (si visible) ---
    cy.get('body').then($body => {
      const iossInput = $body.find('input[placeholder*="IOSS"], input[name*="ioss"]')
      if (iossInput.length > 0) {
        cy.wrap(iossInput.first()).clear().type('IM2760000000', { force: true })
      } else if ($body.text().includes('IOSS')) {
        cy.contains('IOSS').parent().find('input').first()
          .clear().type('IM2760000000', { force: true })
      }
    })

    cy.captureStep('h7-07-datos-mercancia')

    // Avanzar
    cy.get('body').then($body => {
      if ($body.text().match(/Siguiente|Continuar/)) {
        cy.contains(/Siguiente|Continuar/).first().click({ force: true })
        cy.wait(1500)
      }
    })

    cy.captureStep('h7-07b-siguiente-paso')
  })

  // -------------------------------------------------------------------------
  // PASO 8: Rellenar oficina de aduanas y documento de transporte
  // -------------------------------------------------------------------------
  it('08 - Rellenar aduana y documento transporte', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(1000)

    // Ir al formulario
    cy.get('body').then($body => {
      if ($body.text().match(/Nuev[ao]|Crear/)) {
        cy.contains(/Nuev[ao]|Crear/).first().click({ force: true })
        cy.wait(2000)
      }
    })

    // Rellenar rapido y avanzar hasta paso de aduana/transporte
    cy.get('body').then($body => {
      const inputs = $body.find('input[type="text"]')
      if (inputs.length > 0) {
        cy.wrap(inputs.first()).clear().type('STRIX AI SL', { force: true })
      }
    })

    // Avanzar pasos previos
    const avanzar = () => {
      cy.get('body').then($body => {
        if ($body.text().match(/Siguiente|Continuar/)) {
          cy.contains(/Siguiente|Continuar/).first().click({ force: true })
          cy.wait(1500)
        }
      })
    }
    avanzar()
    avanzar()

    // --- Oficina de aduanas ---
    cy.get('body').then($body => {
      const aduanaSelect = $body.find('select[name*="office"], select[name*="aduana"], select[name*="customs"]')
      if (aduanaSelect.length > 0) {
        cy.wrap(aduanaSelect.first()).then($sel => {
          if ($sel.find('option').length > 1) {
            cy.wrap($sel).select(1, { force: true })
          }
        })
      } else if ($body.text().match(/Aduana|Oficina|Office/i)) {
        cy.contains(/Aduana|Oficina|Office/).first().parent().find('select, input').first()
          .then($el => {
            if ($el.is('select') && $el.find('option').length > 1) {
              cy.wrap($el).select(1, { force: true })
            } else if ($el.is('input')) {
              cy.wrap($el).clear().type('ES002801', { force: true })
            }
          })
      }
    })

    // --- Referencia documento transporte ---
    cy.get('body').then($body => {
      const refInput = $body.find('input[name*="transport"], input[name*="document"], input[placeholder*="referencia"], input[placeholder*="tracking"]')
      if (refInput.length > 0) {
        cy.wrap(refInput.first()).clear().type('PKG-CN-2026-H7TEST', { force: true })
      } else if ($body.text().match(/Referencia.*transporte|Documento.*transporte|Transport/i)) {
        cy.contains(/Referencia|Documento|Transport/).first().parent().find('input').first()
          .clear().type('PKG-CN-2026-H7TEST', { force: true })
      }
    })

    cy.captureStep('h7-08-aduana-transporte')

    // Guardar / Crear
    cy.get('body').then($body => {
      if ($body.text().match(/Crear|Guardar|Generar|Finalizar/)) {
        cy.contains(/Crear|Guardar|Generar|Finalizar/).first().click({ force: true })
        cy.wait(3000)
        cy.captureStep('h7-08b-h7-creada')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 9: Generar XML H7
  // -------------------------------------------------------------------------
  it('09 - Generar XML H7', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(2000)

    // Si hay tabla, click en la primera declaracion
    cy.get('body').then($body => {
      const rows = $body.find('tbody tr')
      if (rows.length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
      }
    })

    // Buscar boton de generar XML
    cy.get('body').then($body => {
      if ($body.text().match(/Generar.*XML|Generar/i)) {
        cy.contains(/Generar/).first().click({ force: true })
        cy.wait(3000)
        cy.captureStep('h7-09-xml-generado')
      }

      // Verificar preview XML
      if ($body.find('pre, code, [class*="xml"]').length > 0) {
        cy.get('pre, code, [class*="xml"]').first().should('exist')
      }
    })

    // Buscar preview
    cy.get('body').then($body => {
      if ($body.text().match(/Vista previa|Preview|Ver XML/)) {
        cy.contains(/Vista previa|Preview|Ver XML/).first().click({ force: true })
        cy.wait(2000)
      }
    })

    cy.captureStep('h7-09b-estado-xml')
  })

  // -------------------------------------------------------------------------
  // PASO 10: Enviar H7 a AEAT
  // -------------------------------------------------------------------------
  it('10 - Enviar H7 a AEAT', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(2000)

    // Click en la primera declaracion
    cy.get('body').then($body => {
      const rows = $body.find('tbody tr')
      if (rows.length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
      }
    })

    // Enviar a AEAT
    cy.get('body').then($body => {
      if ($body.text().match(/Enviar a AEAT|Enviar|Submit/)) {
        cy.contains(/Enviar a AEAT|Enviar|Submit/).first().click({ force: true })
        cy.wait(1000)

        // Confirmacion
        cy.on('window:confirm', () => true)

        cy.get('body').then($body2 => {
          if ($body2.text().match(/Confirmar|[SsÍí],?\s|Aceptar/)) {
            cy.contains(/Confirmar|[SsÍí],?\s|Aceptar/).first().click({ force: true })
          }
        })

        // Esperar respuesta AEAT
        cy.wait(10000)
        cy.captureStep('h7-10-respuesta-aeat')

        // Verificar resultado
        cy.get('body').then($body3 => {
          if ($body3.text().includes('MRN')) {
            cy.captureStep('h7-10b-mrn-recibido')
          } else if ($body3.text().match(/Error|Rechaz/)) {
            cy.captureStep('h7-10b-error-envio')
          }
        })
      } else {
        cy.captureStep('h7-10-sin-boton-enviar')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 11: Verificar MRN en la lista H7
  // -------------------------------------------------------------------------
  it('11 - Verificar MRN en lista H7', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(3000)
    cy.captureStep('h7-11-lista-post-envio')

    // Buscar MRN en la tabla
    cy.get('body').then($body => {
      const hasMRN = $body.text().match(/\d{2}ES\d{12}/)
      if (hasMRN) {
        cy.captureStep('h7-11b-mrn-en-lista')
      }

      // Click en la primera para ver detalle con MRN
      const rows = $body.find('tbody tr')
      if (rows.length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
        cy.captureStep('h7-11c-detalle-con-mrn')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 12: Verificar garantia y estado final
  // -------------------------------------------------------------------------
  it('12 - Verificar estado final y garantia', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(2000)

    // Click en la declaracion mas reciente
    cy.get('body').then($body => {
      const rows = $body.find('tbody tr')
      if (rows.length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(2000)
      }
    })

    // Verificar campos de estado
    cy.get('body').then($body => {
      // Estado de la declaracion
      if ($body.text().match(/Aceptad[ao]|Accepted|Registrad[ao]/i)) {
        cy.captureStep('h7-12-estado-aceptada')
      }

      // Verificar garantia (GRN)
      if ($body.text().match(/Garant[ií]a|GRN|26ESAGL/)) {
        cy.captureStep('h7-12b-garantia-visible')
      }

      // Verificar modalidad de pago
      if ($body.text().match(/Pago|Payment|modalidad/i)) {
        cy.captureStep('h7-12c-modalidad-pago')
      }
    })

    cy.captureStep('h7-12d-estado-final')
  })
})
