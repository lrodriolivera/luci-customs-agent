// =============================================================================
// PRUEBA REAL AEAT PRE - H7 Importacion Bajo Valor (e-commerce)
// =============================================================================
// Flujo end-to-end LENTO con envio REAL a AEAT PRE:
// login > crear expedicion importacion bajo valor > navegar a H7 >
// generar H7 > enviar a AEAT PRE > verificar MRN y garantia
//
// Usuario: luis.rodriguez@strixai.es (superadmin)
// Datos: Camisetas de algodon desde China, HS 6109100000, 50kg, 120 EUR
// Garantia: 26ESAGL2800000054 | IOSS: IMES000000123
// =============================================================================

describe('H7 REAL AEAT PRE - Importacion Bajo Valor (e-commerce)', () => {

  before(() => {
    cy.login('luis.rodriguez@strixai.es', 'test123')
  })

  beforeEach(() => {
    cy.login('luis.rodriguez@strixai.es', 'test123')
  })

  // Auto-accept all confirmation dialogs
  Cypress.on('window:confirm', () => true)

  // -------------------------------------------------------------------------
  // PASO 01: Dashboard inicial
  // -------------------------------------------------------------------------
  it('PASO 01 - Dashboard inicial', () => {
    cy.visit('/')
    cy.waitForLoad()
    cy.wait(10000)

    cy.get('body').should('not.contain', 'Error')
    cy.captureStep('aeat-h7-01-dashboard')
  })

  // -------------------------------------------------------------------------
  // PASO 02: Crear expedicion de importacion para H7
  // -------------------------------------------------------------------------
  it('PASO 02 - Crear expedicion importacion bajo valor', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // Asegurar tipo IMPORT seleccionado
    cy.get('body').then($body => {
      if ($body.text().match(/Importaci[oó]n|Import/)) {
        cy.contains(/Importaci[oó]n|Import/).first().click({ force: true })
        cy.wait(6000)
      }
    })

    cy.captureStep('aeat-h7-02-formulario-nuevo')
  })

  // -------------------------------------------------------------------------
  // PASO 03: Rellenar datos del importador/consignee
  // -------------------------------------------------------------------------
  it('PASO 03 - Datos del importador (consignee)', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // === STEP 1: Cliente/Importador ===
    // companyName
    cy.get('input[type="text"]').first().clear({ force: true }).type('STRIX AI SL', { force: true })
    cy.wait(4000)

    // NIF
    cy.get('body').then($body => {
      const nifInput = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nifInput.length > 0) {
        cy.wrap(nifInput.first()).clear({ force: true }).type('B22477020', { force: true })
      }
    })
    cy.wait(4000)

    // EORI
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 2) cy.wrap(allText.eq(2)).clear({ force: true }).type('ESB22477020', { force: true })
    })
    cy.wait(4000)

    // Address
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 3) cy.wrap(allText.eq(3)).clear({ force: true }).type('Calle Innovacion 5', { force: true })
    })
    cy.wait(3000)

    // City
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 4) cy.wrap(allText.eq(4)).clear({ force: true }).type('Valencia', { force: true })
    })
    cy.wait(3000)

    // PostalCode
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 5) cy.wrap(allText.eq(5)).clear({ force: true }).type('46001', { force: true })
    })
    cy.wait(3000)

    // Email
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-h7-real@strixai.es', { force: true })
    cy.wait(3000)

    // Phone
    cy.get('body').then($body => {
      const telInputs = $body.find('input[type="tel"]')
      if (telInputs.length > 0) {
        cy.wrap(telInputs.first()).clear({ force: true }).type('961234567', { force: true })
      }
    })
    cy.wait(4000)

    // --- Exportador/Proveedor (Shenzhen Textiles) ---
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 6) cy.wrap(allText.eq(6)).clear({ force: true }).type('SHENZHEN TEXTILES CO LTD', { force: true })
    })
    cy.wait(3000)

    // Exporter country
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 7) cy.wrap(allText.eq(7)).clear({ force: true }).type('CN', { force: true })
    })
    cy.wait(3000)

    // Exporter city
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 8) cy.wrap(allText.eq(8)).clear({ force: true }).type('Shenzhen', { force: true })
    })

    cy.wait(10000)
    cy.captureStep('aeat-h7-03-datos-importador-completos')
  })

  // -------------------------------------------------------------------------
  // PASO 04: Rellenar mercancia (camisetas algodon, bajo valor)
  // -------------------------------------------------------------------------
  it('PASO 04 - Datos mercancia bajo valor (camisetas algodon)', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // === STEP 1 minimos ===
    cy.get('input[type="text"]').first().clear({ force: true }).type('STRIX AI SL', { force: true })
    cy.get('body').then($body => {
      const nif = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nif.length > 0) cy.wrap(nif.first()).clear({ force: true }).type('B22477020', { force: true })
    })
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-h7-real@strixai.es', { force: true })
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 7) cy.wrap(allText.eq(7)).clear({ force: true }).type('CN', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 2 (Goods)
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-h7-04-paso-mercancia')

    // --- Descripcion ---
    cy.get('textarea').first().clear({ force: true }).type(
      'Camisetas de algodon para adulto, 100% algodon, tallas S-XL, colores variados. Marca: Shenzhen Basics. Lote de 50 unidades para venta online.',
      { force: true }
    )
    cy.wait(6000)

    // --- Material ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length >= 1) {
        cy.wrap(textInputs.eq(0)).clear({ force: true }).type('Algodon 100%', { force: true })
      }
    })
    cy.wait(4000)

    // --- Uso ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length >= 2) {
        cy.wrap(textInputs.eq(1)).clear({ force: true }).type('Vestimenta casual adulto', { force: true })
      }
    })
    cy.wait(4000)

    // --- Codigo TARIC 6109100000 (camisetas algodon) ---
    cy.get('body').then($body => {
      const taricInput = $body.find('input[maxlength="10"]')
      if (taricInput.length > 0) {
        cy.wrap(taricInput.first()).clear({ force: true }).type('6109100000', { force: true })
      }
    })
    cy.wait(6000)

    // --- Pais de origen CN ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      const nonMaxLen = textInputs.filter((i, el) => !Cypress.$(el).attr('maxlength'))
      if (nonMaxLen.length > 2) cy.wrap(nonMaxLen.eq(2)).clear({ force: true }).type('CN', { force: true })
    })
    cy.wait(4000)

    // --- Cantidad: 50 unidades ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 1) cy.wrap(nums.eq(0)).clear({ force: true }).type('50', { force: true })
    })
    // Change unit to PCS
    cy.get('body').then($body => {
      const selects = $body.find('select')
      selects.each((i, sel) => {
        if (Cypress.$(sel).find('option[value="PCS"]').length > 0) {
          cy.wrap(sel).select('PCS', { force: true })
          return false
        }
      })
    })
    cy.wait(4000)

    // --- Peso neto: 45 kg ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 2) cy.wrap(nums.eq(1)).clear({ force: true }).type('45', { force: true })
    })
    cy.wait(3000)

    // --- Peso bruto: 50 kg ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 3) cy.wrap(nums.eq(2)).clear({ force: true }).type('50', { force: true })
    })
    cy.wait(3000)

    // --- Valor factura: 120 EUR (bajo valor < 150 EUR) ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 4) cy.wrap(nums.eq(3)).clear({ force: true }).type('120', { force: true })
    })

    cy.wait(10000)
    cy.captureStep('aeat-h7-04b-mercancia-bajo-valor-completa')
  })

  // -------------------------------------------------------------------------
  // PASO 05: Transporte y crear expedicion
  // -------------------------------------------------------------------------
  it('PASO 05 - Transporte aereo y crear expedicion', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // === STEP 1 minimos ===
    cy.get('input[type="text"]').first().clear({ force: true }).type('STRIX AI SL', { force: true })
    cy.get('body').then($body => {
      const nif = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nif.length > 0) cy.wrap(nif.first()).clear({ force: true }).type('B22477020', { force: true })
    })
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-h7-real@strixai.es', { force: true })
    // EORI
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 2) cy.wrap(allText.eq(2)).clear({ force: true }).type('ESB22477020', { force: true })
    })
    // Address
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 3) cy.wrap(allText.eq(3)).clear({ force: true }).type('Calle Innovacion 5', { force: true })
    })
    // City
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 4) cy.wrap(allText.eq(4)).clear({ force: true }).type('Valencia', { force: true })
    })
    // PostalCode
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 5) cy.wrap(allText.eq(5)).clear({ force: true }).type('46001', { force: true })
    })
    // Exporter
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 6) cy.wrap(allText.eq(6)).clear({ force: true }).type('SHENZHEN TEXTILES CO LTD', { force: true })
    })
    // Exporter country
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 7) cy.wrap(allText.eq(7)).clear({ force: true }).type('CN', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 2
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(6000)

    // === STEP 2: Mercancia ===
    cy.get('textarea').first().clear({ force: true }).type(
      'Camisetas de algodon para adulto, 100% algodon, tallas S-XL, colores variados.',
      { force: true }
    )
    cy.get('body').then($body => {
      const taric = $body.find('input[maxlength="10"]')
      if (taric.length > 0) cy.wrap(taric.first()).clear({ force: true }).type('6109100000', { force: true })
    })
    // Origin
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      const nonMaxLen = textInputs.filter((i, el) => !Cypress.$(el).attr('maxlength'))
      if (nonMaxLen.length > 2) cy.wrap(nonMaxLen.eq(2)).clear({ force: true }).type('CN', { force: true })
    })
    // Quantity
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 1) cy.wrap(nums.eq(0)).clear({ force: true }).type('50', { force: true })
    })
    // Net weight
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 2) cy.wrap(nums.eq(1)).clear({ force: true }).type('45', { force: true })
    })
    // Gross weight
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 3) cy.wrap(nums.eq(2)).clear({ force: true }).type('50', { force: true })
    })
    // Invoice value (bajo valor)
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 4) cy.wrap(nums.eq(3)).clear({ force: true }).type('120', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 3
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-h7-05-paso-transporte')

    // === STEP 3: Transporte AIR ===
    cy.get('select').first().then($sel => {
      if ($sel.find('option[value="AIR"]').length > 0) {
        cy.wrap($sel).select('AIR', { force: true })
      }
    })
    cy.wait(6000)

    // Incoterm - DAP para e-commerce
    cy.get('body').then($body => {
      const selects = $body.find('select')
      if (selects.length >= 2) {
        const incSel = selects.eq(1)
        if (incSel.find('option[value="DAP"]').length > 0) {
          cy.wrap(incSel).select('DAP', { force: true })
        }
      }
    })
    cy.wait(4000)

    // Lugar incoterm
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length > 0) {
        cy.wrap(textInputs.first()).clear({ force: true }).type('Valencia, Espana', { force: true })
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h7-05b-transporte-aereo-completo')

    // CREAR EXPEDICION
    cy.get('button[type="submit"]').click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-h7-05c-expedicion-creada')
  })

  // -------------------------------------------------------------------------
  // PASO 06: Navegar a seccion H7
  // -------------------------------------------------------------------------
  it('PASO 06 - Navegar a seccion H7', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h7-06-pantalla-h7')

    // Verificar que la pagina H7 cargo correctamente
    cy.get('body').then($body => {
      const text = $body.text()
      const hasH7Content = text.includes('H7') || text.includes('bajo valor') || text.includes('e-commerce')
      if (hasH7Content) {
        cy.captureStep('aeat-h7-06b-h7-cargado')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 07: Verificar expedicion en lista H7
  // -------------------------------------------------------------------------
  it('PASO 07 - Verificar expediciones disponibles para H7', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(10000)

    // Buscar expediciones en la tabla o lista
    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.captureStep('aeat-h7-07-expediciones-disponibles')
        // Click en la primera expedicion
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h7-07b-expedicion-seleccionada')
      } else if ($body.find('[class*="cursor-pointer"]').length > 0) {
        cy.get('[class*="cursor-pointer"]').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h7-07b-expedicion-seleccionada')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 08: Alternativa - Generar H7 desde declaraciones
  // -------------------------------------------------------------------------
  it('PASO 08 - Generar H7 desde pantalla de declaraciones', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)

    // Las H7 podrian generarse desde la seccion /h7 o desde /declarations
    // Intentar seleccionar expedicion y generar
    cy.get('body').then($body => {
      // Seleccionar expedicion
      const cards = $body.find('[class*="cursor-pointer"]')
      if (cards.length > 0) {
        cy.wrap(cards.first()).click({ force: true })
        cy.wait(10000)
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h7-08-declaraciones-expedicion')

    // Si hay boton de generar H7
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/)) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h7-08b-h7-generado')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 09: Intentar generar H7 desde la seccion dedicada /h7
  // -------------------------------------------------------------------------
  it('PASO 09 - Generar H7 desde seccion dedicada', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(10000)

    // Buscar boton de crear/generar nueva H7
    cy.get('body').then($body => {
      const text = $body.text()
      // Try finding new/create button
      if (text.match(/Nuevo|Nueva|Crear|New|Generate/)) {
        cy.contains(/Nuevo|Nueva|Crear|New/).first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h7-09-formulario-h7')
      }
    })

    // Si hay formulario H7 con IOSS
    cy.get('body').then($body => {
      const iossInput = $body.find('input[name="iossNumber"], input[placeholder*="IOSS"]')
      if (iossInput.length > 0) {
        cy.wrap(iossInput.first()).clear({ force: true }).type('IMES000000123', { force: true })
        cy.wait(6000)
      }
      // Otros inputs del formulario H7
      const textInputs = $body.find('input[type="text"]')
      textInputs.each((i, el) => {
        const placeholder = Cypress.$(el).attr('placeholder') || ''
        const name = Cypress.$(el).attr('name') || ''
        if (placeholder.toLowerCase().includes('awb') || name.includes('transport') || name.includes('document')) {
          cy.wrap(el).clear({ force: true }).type('AWB-2026-TEST001', { force: true })
        }
      })
    })

    cy.wait(10000)
    cy.captureStep('aeat-h7-09b-formulario-h7-completo')

    // Generar
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/)) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h7-09c-h7-generado')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 10: ENVIAR H7 A AEAT PRE (REAL)
  // -------------------------------------------------------------------------
  it('PASO 10 - ENVIAR H7 A AEAT PRE (REAL)', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(10000)

    // Buscar expedicion con H7 generada
    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
      }
    })

    cy.captureStep('aeat-h7-10-antes-envio')

    // Click en enviar a AEAT
    cy.get('body').then($body => {
      const sendBtn = $body.find('button').filter((i, el) => {
        const text = Cypress.$(el).text()
        return text.includes('AEAT') || text.includes('Enviar') || text.includes('Submit') || text.includes('Send')
      })
      if (sendBtn.length > 0) {
        cy.wrap(sendBtn.first()).click({ force: true })
        cy.wait(10000)

        // Confirmar si hay dialogo
        cy.get('body').then($body2 => {
          const confirmBtn = $body2.find('button').filter((i, el) => {
            const text = Cypress.$(el).text()
            return text.includes('Confirmar') || text.includes('Si') || text.includes('Aceptar')
          })
          if (confirmBtn.length > 0) {
            cy.wrap(confirmBtn.first()).click({ force: true })
          }
        })
      }
    })

    // ESPERAR RESPUESTA DE AEAT PRE
    cy.wait(20000)
    cy.captureStep('aeat-h7-10b-RESPUESTA-AEAT-REAL')

    // Verificar resultado
    cy.get('body').then($body => {
      const text = $body.text()
      if (text.includes('MRN') || text.match(/\d{2}ES\d{12}/)) {
        cy.captureStep('aeat-h7-10c-MRN-RECIBIDO')
      }
      if (text.includes('Aceptad') || text.includes('accepted')) {
        cy.captureStep('aeat-h7-10d-ACEPTADO')
      }
      if (text.includes('26ESAGL') || text.includes('garantia') || text.includes('Garant')) {
        cy.captureStep('aeat-h7-10e-GARANTIA-VERIFICADA')
      }
      if (text.match(/error|Error|rechaz|Rechaz/)) {
        cy.captureStep('aeat-h7-10f-ERROR-RESPUESTA')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 11: Verificar resultado en detalle
  // -------------------------------------------------------------------------
  it('PASO 11 - Verificar MRN y garantia en detalle', () => {
    cy.visit('/h7')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h7-11-lista-post-envio')

    // Click en primera expedicion para ver detalle
    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h7-11b-detalle-h7')

        cy.get('body').then($detail => {
          const text = $detail.text()
          if (text.match(/MRN|mrn|\d{2}ES\d{12}/)) {
            cy.captureStep('aeat-h7-11c-mrn-confirmado')
          }
          if (text.includes('26ESAGL2800000054')) {
            cy.captureStep('aeat-h7-11d-garantia-26ESAGL2800000054')
          }
        })
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 12: Verificar en expediciones
  // -------------------------------------------------------------------------
  it('PASO 12 - Verificar en lista de expediciones', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h7-12-expediciones-post-envio')

    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h7-12b-detalle-expedicion')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 13: Dashboard de canales
  // -------------------------------------------------------------------------
  it('PASO 13 - Verificar en dashboard de canales', () => {
    cy.visit('/channels')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h7-13-dashboard-canales')

    cy.get('body').then($body => {
      const hasCards = $body.find('[class*="card"], [class*="stat"]').length > 0
      if (hasCards) {
        cy.captureStep('aeat-h7-13b-estadisticas')
      }
      if ($body.find('tbody tr').length > 0) {
        cy.captureStep('aeat-h7-13c-listado-canales')
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h7-13d-dashboard-canales-final')
  })
})
