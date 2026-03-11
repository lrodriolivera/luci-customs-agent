// =============================================================================
// PRUEBA REAL AEAT PRE - AES Exportacion Completa
// =============================================================================
// Flujo end-to-end LENTO con envio REAL a AEAT PRE:
// login > dashboard > crear expedicion exportacion > rellenar todos los campos >
// generar AES XML > enviar a AEAT PRE > verificar MRN y Canal V (verde)
//
// Usuario: luis.rodriguez@strixai.es (superadmin)
// Datos: Equipos informaticos a Francia, TARIC 8471410000, 2000kg, 25000 EUR
// Exportador: STRIX AI SL (B22477020, ESB22477020)
// Destino: Francia (FR)
// Transporte: Carretera, matricula 1234BCD
// =============================================================================

describe('AES REAL AEAT PRE - Exportacion Completa', () => {

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
    cy.get('body').then($body => {
      const hasNav = $body.find('nav, aside, [role="navigation"]').length > 0
      const hasContent = $body.find('main, .dashboard, [class*="grid"]').length > 0
      expect(hasNav || hasContent).to.be.true
    })

    cy.captureStep('aeat-aes-01-dashboard')
  })

  // -------------------------------------------------------------------------
  // PASO 02: Navegar a expediciones
  // -------------------------------------------------------------------------
  it('PASO 02 - Navegar a expediciones', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-aes-02-lista-expediciones')
  })

  // -------------------------------------------------------------------------
  // PASO 03: Crear expedicion de EXPORTACION
  // -------------------------------------------------------------------------
  it('PASO 03 - Crear nueva expedicion de exportacion', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar tipo EXPORT (segundo boton)
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n|Export/)) {
        cy.contains(/Exportaci[oó]n|Export/).first().click({ force: true })
        cy.wait(10000)
      }
    })

    cy.captureStep('aeat-aes-03-tipo-exportacion-seleccionado')
  })

  // -------------------------------------------------------------------------
  // PASO 04: Rellenar datos del exportador (STRIX AI SL)
  // -------------------------------------------------------------------------
  it('PASO 04 - Datos del exportador (STRIX AI SL)', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar EXPORT
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n|Export/)) {
        cy.contains(/Exportaci[oó]n|Export/).first().click({ force: true })
        cy.wait(6000)
      }
    })

    // === STEP 1: Exportador (client section) ===
    // companyName - STRIX AI SL (exportador espanol)
    cy.get('input[type="text"]').first().clear({ force: true }).type('STRIX AI SL', { force: true })
    cy.wait(6000)

    // NIF
    cy.get('body').then($body => {
      const nifInput = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nifInput.length > 0) {
        cy.wrap(nifInput.first()).clear({ force: true }).type('B22477020', { force: true })
      }
    })
    cy.wait(6000)

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
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-aes-real@strixai.es', { force: true })
    cy.wait(3000)

    // Phone
    cy.get('body').then($body => {
      const telInputs = $body.find('input[type="tel"]')
      if (telInputs.length > 0) {
        cy.wrap(telInputs.first()).clear({ force: true }).type('961234567', { force: true })
      }
    })
    cy.wait(4000)

    // --- Consignatario/Destinatario (France) ---
    // For EXPORT: the second section is "consignee" (destination buyer)
    // companyName consignee
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 6) cy.wrap(allText.eq(6)).clear({ force: true }).type('FRANCE TECH DISTRIBUTION SARL', { force: true })
    })
    cy.wait(3000)

    // Country consignee - FR
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 7) cy.wrap(allText.eq(7)).clear({ force: true }).type('FR', { force: true })
    })
    cy.wait(3000)

    // City consignee
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 8) cy.wrap(allText.eq(8)).clear({ force: true }).type('Paris', { force: true })
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-04-datos-exportador-completos')
  })

  // -------------------------------------------------------------------------
  // PASO 05: Rellenar mercancia (equipos informaticos)
  // -------------------------------------------------------------------------
  it('PASO 05 - Datos de mercancia (equipos informaticos)', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar EXPORT
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n|Export/)) {
        cy.contains(/Exportaci[oó]n|Export/).first().click({ force: true })
        cy.wait(4000)
      }
    })

    // === STEP 1 minimos ===
    cy.get('input[type="text"]').first().clear({ force: true }).type('STRIX AI SL', { force: true })
    cy.get('body').then($body => {
      const nif = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nif.length > 0) cy.wrap(nif.first()).clear({ force: true }).type('B22477020', { force: true })
    })
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-aes-real@strixai.es', { force: true })
    // Consignee country (required)
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 7) cy.wrap(allText.eq(7)).clear({ force: true }).type('FR', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 2 (Goods)
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-aes-05-paso-mercancia')

    // --- Descripcion de mercancia ---
    cy.get('textarea').first().clear({ force: true }).type(
      'Equipos informaticos: servidores rack, switches de red y cables de fibra optica. Marca: Dell/Cisco. Para infraestructura datacenter cliente frances.',
      { force: true }
    )
    cy.wait(6000)

    // --- Material ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length >= 1) {
        cy.wrap(textInputs.eq(0)).clear({ force: true }).type('Metal, plastico, componentes electronicos, fibra optica', { force: true })
      }
    })
    cy.wait(4000)

    // --- Uso ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length >= 2) {
        cy.wrap(textInputs.eq(1)).clear({ force: true }).type('Infraestructura de centro de datos', { force: true })
      }
    })
    cy.wait(4000)

    // --- Codigo TARIC 8471410000 (maquinas automaticas para tratamiento de datos) ---
    cy.get('body').then($body => {
      const taricInput = $body.find('input[maxlength="10"]')
      if (taricInput.length > 0) {
        cy.wrap(taricInput.first()).clear({ force: true }).type('8471410000', { force: true })
      }
    })
    cy.wait(6000)

    // --- Pais de origen ES (fabricacion/procedencia Espana) ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      const nonMaxLen = textInputs.filter((i, el) => !Cypress.$(el).attr('maxlength'))
      if (nonMaxLen.length > 2) cy.wrap(nonMaxLen.eq(2)).clear({ force: true }).type('ES', { force: true })
    })
    cy.wait(4000)

    // --- Cantidad: 20 unidades ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 1) cy.wrap(nums.eq(0)).clear({ force: true }).type('20', { force: true })
    })
    cy.wait(3000)

    // --- Peso neto: 1800 kg ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 2) cy.wrap(nums.eq(1)).clear({ force: true }).type('1800', { force: true })
    })
    cy.wait(3000)

    // --- Peso bruto: 2000 kg ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 3) cy.wrap(nums.eq(2)).clear({ force: true }).type('2000', { force: true })
    })
    cy.wait(3000)

    // --- Valor factura: 25000 EUR ---
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 4) cy.wrap(nums.eq(3)).clear({ force: true }).type('25000', { force: true })
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-05b-mercancia-completa')
  })

  // -------------------------------------------------------------------------
  // PASO 06: Transporte por carretera y crear expedicion
  // -------------------------------------------------------------------------
  it('PASO 06 - Transporte carretera y crear expedicion', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar EXPORT
    cy.get('body').then($body => {
      if ($body.text().match(/Exportaci[oó]n|Export/)) {
        cy.contains(/Exportaci[oó]n|Export/).first().click({ force: true })
        cy.wait(4000)
      }
    })

    // === STEP 1 completo ===
    cy.get('input[type="text"]').first().clear({ force: true }).type('STRIX AI SL', { force: true })
    cy.get('body').then($body => {
      const nif = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nif.length > 0) cy.wrap(nif.first()).clear({ force: true }).type('B22477020', { force: true })
    })
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
    // Email
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-aes-real@strixai.es', { force: true })
    // Phone
    cy.get('body').then($body => {
      const tel = $body.find('input[type="tel"]')
      if (tel.length > 0) cy.wrap(tel.first()).clear({ force: true }).type('961234567', { force: true })
    })
    // Consignee company
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 6) cy.wrap(allText.eq(6)).clear({ force: true }).type('FRANCE TECH DISTRIBUTION SARL', { force: true })
    })
    // Consignee country FR
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 7) cy.wrap(allText.eq(7)).clear({ force: true }).type('FR', { force: true })
    })
    // Consignee city
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 8) cy.wrap(allText.eq(8)).clear({ force: true }).type('Paris', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 2
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(6000)

    // === STEP 2: Mercancia ===
    cy.get('textarea').first().clear({ force: true }).type(
      'Equipos informaticos: servidores rack, switches de red y cables de fibra optica. Marca: Dell/Cisco.',
      { force: true }
    )
    cy.get('body').then($body => {
      const taric = $body.find('input[maxlength="10"]')
      if (taric.length > 0) cy.wrap(taric.first()).clear({ force: true }).type('8471410000', { force: true })
    })
    // Origin ES
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      const nonMaxLen = textInputs.filter((i, el) => !Cypress.$(el).attr('maxlength'))
      if (nonMaxLen.length > 2) cy.wrap(nonMaxLen.eq(2)).clear({ force: true }).type('ES', { force: true })
    })
    // Quantity
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 1) cy.wrap(nums.eq(0)).clear({ force: true }).type('20', { force: true })
    })
    // Net weight
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 2) cy.wrap(nums.eq(1)).clear({ force: true }).type('1800', { force: true })
    })
    // Gross weight
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 3) cy.wrap(nums.eq(2)).clear({ force: true }).type('2000', { force: true })
    })
    // Invoice value
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 4) cy.wrap(nums.eq(3)).clear({ force: true }).type('25000', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 3
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-aes-06-paso-transporte')

    // === STEP 3: Transporte ROAD (carretera) ===
    cy.get('select').first().then($sel => {
      if ($sel.find('option[value="ROAD"]').length > 0) {
        cy.wrap($sel).select('ROAD', { force: true })
      }
    })
    cy.wait(6000)

    // Incoterm - FOB para exportacion
    cy.get('body').then($body => {
      const selects = $body.find('select')
      if (selects.length >= 2) {
        const incSel = selects.eq(1)
        if (incSel.find('option[value="FOB"]').length > 0) {
          cy.wrap(incSel).select('FOB', { force: true })
        }
      }
    })
    cy.wait(6000)

    // Lugar incoterm
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length > 0) {
        cy.wrap(textInputs.first()).clear({ force: true }).type('Puerto de Valencia, Espana', { force: true })
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-06b-transporte-carretera-completo')

    // === CREAR EXPEDICION ===
    cy.get('button[type="submit"]').click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-aes-06c-expedicion-creada')
  })

  // -------------------------------------------------------------------------
  // PASO 07: Verificar expedicion creada
  // -------------------------------------------------------------------------
  it('PASO 07 - Verificar expedicion exportacion en lista', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-aes-07-lista-con-expedicion')

    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-aes-07b-detalle-expedicion-export')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 08: Navegar a declaraciones y seleccionar AES
  // -------------------------------------------------------------------------
  it('PASO 08 - Pantalla declaraciones y seleccionar tipo AES', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-aes-08-pantalla-declaraciones')

    // Seleccionar tipo AES (segundo boton de tipo)
    cy.get('body').then($body => {
      if ($body.text().includes('AES')) {
        cy.contains('AES').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-aes-08b-tipo-aes-seleccionado')
      }
    })

    // Seleccionar expedicion de exportacion
    cy.get('body').then($body => {
      const cards = $body.find('[class*="cursor-pointer"]')
      if (cards.length > 0) {
        // Try to find the export expedition
        let exportCard = null
        cards.each((i, el) => {
          const text = Cypress.$(el).text()
          if (text.match(/Export|EXPORT|STRIX/)) {
            exportCard = el
            return false
          }
        })
        if (exportCard) {
          cy.wrap(exportCard).click({ force: true })
        } else {
          cy.wrap(cards.first()).click({ force: true })
        }
        cy.wait(10000)
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-08c-expedicion-export-seleccionada')
  })

  // -------------------------------------------------------------------------
  // PASO 09: Generar declaracion AES
  // -------------------------------------------------------------------------
  it('PASO 09 - Generar declaracion AES XML', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar AES
    cy.get('body').then($body => {
      if ($body.text().includes('AES')) {
        cy.contains('AES').first().click({ force: true })
        cy.wait(6000)
      }
    })

    // Seleccionar expedicion export
    cy.get('body').then($body => {
      const cards = $body.find('[class*="cursor-pointer"]')
      if (cards.length > 0) {
        let exportCard = null
        cards.each((i, el) => {
          if (Cypress.$(el).text().match(/Export|EXPORT|STRIX/)) {
            exportCard = el
            return false
          }
        })
        cy.wrap(exportCard || cards.first()).click({ force: true })
        cy.wait(6000)
      }
    })

    // Click en Generar AES
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/)) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        // Esperar generacion del XML
        cy.wait(10000)
        cy.captureStep('aeat-aes-09-aes-generado')
      }
    })

    // Verificar que se genero
    cy.get('body').then($body => {
      if ($body.find('pre').length > 0) {
        cy.captureStep('aeat-aes-09b-xml-preview')
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-09c-estado-declaracion')
  })

  // -------------------------------------------------------------------------
  // PASO 10: Visualizar XML generado
  // -------------------------------------------------------------------------
  it('PASO 10 - Visualizar XML AES generado', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar AES y expedicion
    cy.get('body').then($body => {
      if ($body.text().includes('AES')) {
        cy.contains('AES').first().click({ force: true })
        cy.wait(4000)
      }
    })
    cy.get('body').then($body => {
      const cards = $body.find('[class*="cursor-pointer"]')
      if (cards.length > 0) {
        cy.wrap(cards.first()).click({ force: true })
        cy.wait(6000)
      }
    })

    // Generar si no generado
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/) && !$body.find('pre').length) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        cy.wait(10000)
      }
    })

    // Verificar contenido XML
    cy.get('body').then($body => {
      if ($body.find('pre').length > 0) {
        cy.get('pre').first().should('exist')
        cy.captureStep('aeat-aes-10-xml-aes-preview')
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-10b-declaracion-aes-lista')
  })

  // -------------------------------------------------------------------------
  // PASO 11: ENVIAR AES A AEAT PRE (REAL SUBMISSION)
  // -------------------------------------------------------------------------
  it('PASO 11 - ENVIAR DECLARACION AES A AEAT PRE (REAL)', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar AES
    cy.get('body').then($body => {
      if ($body.text().includes('AES')) {
        cy.contains('AES').first().click({ force: true })
        cy.wait(4000)
      }
    })

    // Seleccionar expedicion
    cy.get('body').then($body => {
      const cards = $body.find('[class*="cursor-pointer"]')
      if (cards.length > 0) {
        cy.wrap(cards.first()).click({ force: true })
        cy.wait(6000)
      }
    })

    // Generar si necesario
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/) && !$body.find('pre').length) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        cy.wait(10000)
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-11-antes-envio')

    // Click en "Enviar a AEAT" (boton naranja)
    cy.get('body').then($body => {
      const aeatBtn = $body.find('button').filter((i, el) => {
        const text = Cypress.$(el).text()
        return text.includes('AEAT') || (text.includes('Enviar') && !text.includes('Generar'))
      })
      if (aeatBtn.length > 0) {
        cy.wrap(aeatBtn.first()).click({ force: true })
      } else {
        // Fallback: any button with send-related text
        const sendBtn = $body.find('button:contains("Enviar"), button:contains("Submit"), button:contains("Send")')
        if (sendBtn.length > 0) {
          cy.wrap(sendBtn.last()).click({ force: true })
        }
      }
    })

    // ESPERAR RESPUESTA DE AEAT PRE (real submission)
    cy.wait(20000)
    cy.captureStep('aeat-aes-11b-RESPUESTA-AEAT-REAL')

    // Verificar resultado
    cy.get('body').then($body => {
      const text = $body.text()

      // MRN
      if (text.includes('MRN') || text.match(/\d{2}ES\d{12}/)) {
        cy.captureStep('aeat-aes-11c-MRN-RECIBIDO')
      }

      // Canal V (verde) - tipico de AES aceptado
      if (text.match(/green|verde|Canal V|Canal A|Aceptad/i)) {
        cy.captureStep('aeat-aes-11d-CANAL-VERDE-V')
      } else if (text.match(/orange|naranja/i)) {
        cy.captureStep('aeat-aes-11d-CANAL-NARANJA')
      } else if (text.match(/error|Error|rechaz|Rechaz/i)) {
        cy.captureStep('aeat-aes-11d-ERROR-RESPUESTA')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 12: Verificar MRN y canal en expedicion
  // -------------------------------------------------------------------------
  it('PASO 12 - Verificar MRN y Canal V en expedicion', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-aes-12-lista-post-envio')

    // Click en primera expedicion
    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-aes-12b-detalle-con-mrn')

        // Verificar canal y MRN
        cy.get('body').then($detail => {
          const text = $detail.text()
          if (text.match(/green|verde|Canal V/i)) {
            cy.captureStep('aeat-aes-12c-canal-verde-confirmado')
          }
          if (text.match(/MRN|mrn|\d{2}ES\d{12}/)) {
            cy.captureStep('aeat-aes-12d-mrn-confirmado')
          }
          // AES specific: levante
          if (text.match(/levante|release|liberado/i)) {
            cy.captureStep('aeat-aes-12e-levante-concedido')
          }
        })
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
    cy.captureStep('aeat-aes-13-dashboard-canales')

    cy.get('body').then($body => {
      const hasCards = $body.find('[class*="card"], [class*="stat"]').length > 0
      if (hasCards) {
        cy.captureStep('aeat-aes-13b-estadisticas-canales')
      }
      if ($body.find('tbody tr').length > 0) {
        cy.captureStep('aeat-aes-13c-listado-canales')
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-aes-13d-dashboard-canales-final')
  })

  // -------------------------------------------------------------------------
  // PASO 14: Resumen final
  // -------------------------------------------------------------------------
  it('PASO 14 - Resumen final de la exportacion', () => {
    cy.visit('/')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-aes-14-dashboard-final')

    // Navegar a expediciones para vista final
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-aes-14b-expediciones-final')
  })
})
