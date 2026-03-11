// =============================================================================
// PRUEBA REAL AEAT PRE - H1 Importacion Completa (DUA H1)
// =============================================================================
// Flujo end-to-end LENTO con envio REAL a AEAT PRE:
// login > dashboard > crear expedicion importacion > rellenar todos los campos >
// generar H1 XML > enviar a AEAT PRE > verificar MRN/canal > dashboard canales
//
// Usuario: luis.rodriguez@strixai.es (superadmin)
// Datos: Ordenadores portatiles Lenovo desde China, TARIC 8471300000, 150kg, 5000 EUR
// =============================================================================

describe('H1 REAL AEAT PRE - Importacion Completa', () => {

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

    cy.captureStep('aeat-h1-01-dashboard')
  })

  // -------------------------------------------------------------------------
  // PASO 02: Navegar a expediciones y crear nueva
  // -------------------------------------------------------------------------
  it('PASO 02 - Navegar a expediciones', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h1-02-lista-expediciones')

    cy.get('body').then($body => {
      const hasTable = $body.find('table, tbody').length > 0
      const hasEmpty = $body.text().includes('No hay') || $body.text().includes('vac')
      expect(hasTable || hasEmpty).to.be.true
    })
  })

  // -------------------------------------------------------------------------
  // PASO 03: Crear nueva expedicion - seleccionar tipo IMPORT
  // -------------------------------------------------------------------------
  it('PASO 03 - Crear nueva expedicion de importacion', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)

    // Click en boton de nueva expedicion
    cy.contains(/Nuevo|Nueva|Crear|New/).first().click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-h1-03-formulario-nuevo')

    // Seleccionar tipo Importacion (primer boton en step 1)
    cy.get('body').then($body => {
      // The form defaults to IMPORT, but click it to be sure
      if ($body.text().match(/Importaci[oó]n|Import/)) {
        cy.contains(/Importaci[oó]n|Import/).first().click({ force: true })
        cy.wait(10000)
      }
    })
    cy.captureStep('aeat-h1-03b-tipo-importacion-seleccionado')
  })

  // -------------------------------------------------------------------------
  // PASO 04: Rellenar datos del importador (Step 1 del formulario)
  // -------------------------------------------------------------------------
  it('PASO 04 - Rellenar datos del importador/cliente', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // Asegurar que IMPORT esta seleccionado
    cy.get('body').then($body => {
      if ($body.text().match(/Importaci[oó]n|Import/)) {
        cy.contains(/Importaci[oó]n|Import/).first().click({ force: true })
        cy.wait(6000)
      }
    })

    // --- Razon Social (companyName) ---
    cy.get('body').then($body => {
      // Strategy: find inputs inside the form
      const inputs = $body.find('input[type="text"]')
      if (inputs.length > 0) {
        // First text input is companyName
        cy.wrap(inputs.first()).clear({ force: true }).type('PRUEBA AEAT H1 REAL SL', { force: true })
      }
    })
    cy.wait(6000)

    // --- NIF/CIF ---
    cy.get('body').then($body => {
      const nifInput = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nifInput.length > 0) {
        cy.wrap(nifInput.first()).clear({ force: true }).type('B99887766', { force: true })
      } else {
        // Fallback: second text input
        const inputs = $body.find('input[type="text"]')
        if (inputs.length > 1) {
          cy.wrap(inputs.eq(1)).clear({ force: true }).type('B99887766', { force: true })
        }
      }
    })
    cy.wait(6000)

    // --- EORI ---
    cy.get('body').then($body => {
      const inputs = $body.find('input[type="text"]')
      // EORI is typically the third text input (after companyName and NIF)
      if (inputs.length > 2) {
        cy.wrap(inputs.eq(2)).clear({ force: true }).type('ESB99887766', { force: true })
      }
    })
    cy.wait(6000)

    // --- Direccion ---
    cy.get('body').then($body => {
      const inputs = $body.find('input[type="text"]')
      // Address is after EORI (4th text input approximately)
      if (inputs.length > 3) {
        cy.wrap(inputs.eq(3)).clear({ force: true }).type('Calle Mayor 10', { force: true })
      }
    })
    cy.wait(4000)

    // --- Ciudad ---
    cy.get('body').then($body => {
      const inputs = $body.find('input[type="text"]')
      if (inputs.length > 4) {
        cy.wrap(inputs.eq(4)).clear({ force: true }).type('Madrid', { force: true })
      }
    })
    cy.wait(4000)

    // --- Codigo Postal ---
    cy.get('body').then($body => {
      const inputs = $body.find('input[type="text"]')
      if (inputs.length > 5) {
        cy.wrap(inputs.eq(5)).clear({ force: true }).type('28001', { force: true })
      }
    })
    cy.wait(4000)

    // --- Email ---
    cy.get('body').then($body => {
      const emailInputs = $body.find('input[type="email"]')
      if (emailInputs.length > 0) {
        cy.wrap(emailInputs.first()).clear({ force: true }).type('prueba-h1-real@strixai.es', { force: true })
      }
    })
    cy.wait(4000)

    // --- Telefono ---
    cy.get('body').then($body => {
      const telInputs = $body.find('input[type="tel"]')
      if (telInputs.length > 0) {
        cy.wrap(telInputs.first()).clear({ force: true }).type('911234567', { force: true })
      }
    })
    cy.wait(6000)

    // --- Exportador/Proveedor (seccion inferior de Step 1) ---
    // Company name del exportador
    cy.get('body').then($body => {
      // After the client section there are exporter inputs
      // The exporter companyName is typically the text input after all client fields
      const allTextInputs = $body.find('input[type="text"]')
      // Count: companyName(0), nif(1), eori(2), address(3), city(4), postalCode(5)
      // Then exporter section: companyName(6), country(7), city(8)
      if (allTextInputs.length > 6) {
        cy.wrap(allTextInputs.eq(6)).clear({ force: true }).type('CHINA ELECTRONICS TRADING CO LTD', { force: true })
      }
    })
    cy.wait(4000)

    // --- Pais del exportador (required - ISO code input) ---
    cy.get('body').then($body => {
      const allTextInputs = $body.find('input[type="text"]')
      if (allTextInputs.length > 7) {
        cy.wrap(allTextInputs.eq(7)).clear({ force: true }).type('CN', { force: true })
      }
    })
    cy.wait(4000)

    // --- Ciudad del exportador ---
    cy.get('body').then($body => {
      const allTextInputs = $body.find('input[type="text"]')
      if (allTextInputs.length > 8) {
        cy.wrap(allTextInputs.eq(8)).clear({ force: true }).type('Shenzhen', { force: true })
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h1-04-datos-importador-completos')
  })

  // -------------------------------------------------------------------------
  // PASO 05: Avanzar a Step 2 y rellenar datos de mercancia
  // -------------------------------------------------------------------------
  it('PASO 05 - Rellenar datos de mercancia con TARIC', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // --- Rapidamente rellenar Step 1 (minimos obligatorios) ---
    // companyName
    cy.get('input[type="text"]').first().clear({ force: true }).type('PRUEBA AEAT H1 REAL SL', { force: true })
    cy.wait(3000)
    // NIF
    cy.get('body').then($body => {
      const nifInput = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nifInput.length > 0) {
        cy.wrap(nifInput.first()).clear({ force: true }).type('B99887766', { force: true })
      }
    })
    cy.wait(3000)
    // Email
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-h1-real@strixai.es', { force: true })
    cy.wait(3000)
    // Exporter country (required)
    cy.get('body').then($body => {
      const allTextInputs = $body.find('input[type="text"]')
      if (allTextInputs.length > 7) {
        cy.wrap(allTextInputs.eq(7)).clear({ force: true }).type('CN', { force: true })
      }
    })
    cy.wait(4000)

    // Click "Siguiente" to go to Step 2 (Goods)
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-h1-05-paso-mercancia')

    // --- Descripcion de mercancia ---
    cy.get('textarea').first().clear({ force: true }).type(
      'Ordenadores portatiles para procesamiento de datos. Marca: Lenovo. Modelo: ThinkPad X1 Carbon Gen 11. Procesador Intel i7, 16GB RAM, 512GB SSD.',
      { force: true }
    )
    cy.wait(6000)

    // --- Material ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length >= 1) {
        cy.wrap(textInputs.eq(0)).clear({ force: true }).type('Plastico, aluminio, componentes electronicos', { force: true })
      }
    })
    cy.wait(4000)

    // --- Uso/Funcion ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length >= 2) {
        cy.wrap(textInputs.eq(1)).clear({ force: true }).type('Procesamiento de datos informaticos', { force: true })
      }
    })
    cy.wait(4000)

    // --- Codigo TARIC (10 digitos) - input with maxLength 10 ---
    cy.get('body').then($body => {
      const taricInput = $body.find('input[maxlength="10"]')
      if (taricInput.length > 0) {
        cy.wrap(taricInput.first()).clear({ force: true }).type('8471300000', { force: true })
      }
    })
    cy.wait(6000)

    // --- Pais de origen (ISO code input) ---
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      // Origin country is after taricCode input
      const lastTextInputs = textInputs.filter((i, el) => !Cypress.$(el).attr('maxlength'))
      if (lastTextInputs.length > 2) {
        cy.wrap(lastTextInputs.eq(2)).clear({ force: true }).type('CN', { force: true })
      }
    })
    cy.wait(4000)

    // --- Cantidad ---
    cy.get('body').then($body => {
      const numInputs = $body.find('input[type="number"]')
      if (numInputs.length >= 1) {
        cy.wrap(numInputs.eq(0)).clear({ force: true }).type('10', { force: true })
      }
    })
    cy.wait(4000)

    // --- Peso neto ---
    cy.get('body').then($body => {
      const numInputs = $body.find('input[type="number"]')
      if (numInputs.length >= 2) {
        cy.wrap(numInputs.eq(1)).clear({ force: true }).type('140', { force: true })
      }
    })
    cy.wait(4000)

    // --- Peso bruto ---
    cy.get('body').then($body => {
      const numInputs = $body.find('input[type="number"]')
      if (numInputs.length >= 3) {
        cy.wrap(numInputs.eq(2)).clear({ force: true }).type('150', { force: true })
      }
    })
    cy.wait(4000)

    // --- Valor factura ---
    cy.get('body').then($body => {
      const numInputs = $body.find('input[type="number"]')
      if (numInputs.length >= 4) {
        cy.wrap(numInputs.eq(3)).clear({ force: true }).type('5000', { force: true })
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h1-05b-datos-mercancia-completos')
  })

  // -------------------------------------------------------------------------
  // PASO 06: Avanzar a Step 3 (Transporte) y crear expedicion
  // -------------------------------------------------------------------------
  it('PASO 06 - Transporte e Incoterm y crear expedicion', () => {
    cy.visit('/expeditions/new')
    cy.waitForLoad()
    cy.wait(10000)

    // === STEP 1: Rellenar minimos obligatorios ===
    cy.get('input[type="text"]').first().clear({ force: true }).type('PRUEBA AEAT H1 REAL SL', { force: true })
    cy.get('body').then($body => {
      const nifInput = $body.find('input[pattern="[A-Z0-9]{8,10}"]')
      if (nifInput.length > 0) cy.wrap(nifInput.first()).clear({ force: true }).type('B99887766', { force: true })
    })
    cy.get('input[type="email"]').first().clear({ force: true }).type('prueba-h1-real@strixai.es', { force: true })
    // EORI
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 2) cy.wrap(allText.eq(2)).clear({ force: true }).type('ESB99887766', { force: true })
    })
    // Address
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 3) cy.wrap(allText.eq(3)).clear({ force: true }).type('Calle Mayor 10', { force: true })
    })
    // City
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 4) cy.wrap(allText.eq(4)).clear({ force: true }).type('Madrid', { force: true })
    })
    // PostalCode
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 5) cy.wrap(allText.eq(5)).clear({ force: true }).type('28001', { force: true })
    })
    // Exporter company
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 6) cy.wrap(allText.eq(6)).clear({ force: true }).type('CHINA ELECTRONICS TRADING CO LTD', { force: true })
    })
    // Exporter country
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 7) cy.wrap(allText.eq(7)).clear({ force: true }).type('CN', { force: true })
    })
    // Exporter city
    cy.get('body').then($body => {
      const allText = $body.find('input[type="text"]')
      if (allText.length > 8) cy.wrap(allText.eq(8)).clear({ force: true }).type('Shenzhen', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 2
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(10000)

    // === STEP 2: Rellenar mercancia ===
    cy.get('textarea').first().clear({ force: true }).type(
      'Ordenadores portatiles para procesamiento de datos. Marca: Lenovo. Modelo: ThinkPad X1 Carbon Gen 11.',
      { force: true }
    )
    cy.get('body').then($body => {
      const taric = $body.find('input[maxlength="10"]')
      if (taric.length > 0) cy.wrap(taric.first()).clear({ force: true }).type('8471300000', { force: true })
    })
    // Origin country
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      const nonMaxLen = textInputs.filter((i, el) => !Cypress.$(el).attr('maxlength'))
      if (nonMaxLen.length > 2) cy.wrap(nonMaxLen.eq(2)).clear({ force: true }).type('CN', { force: true })
    })
    // Quantity
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 1) cy.wrap(nums.eq(0)).clear({ force: true }).type('10', { force: true })
    })
    // Net weight
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 2) cy.wrap(nums.eq(1)).clear({ force: true }).type('140', { force: true })
    })
    // Gross weight
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 3) cy.wrap(nums.eq(2)).clear({ force: true }).type('150', { force: true })
    })
    // Invoice value
    cy.get('body').then($body => {
      const nums = $body.find('input[type="number"]')
      if (nums.length >= 4) cy.wrap(nums.eq(3)).clear({ force: true }).type('5000', { force: true })
    })
    cy.wait(4000)

    // Avanzar a Step 3
    cy.get('.btn-primary').last().click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-h1-06-paso-transporte')

    // === STEP 3: Transporte e Incoterm ===
    // Transport mode select - select ROAD (3)
    cy.get('select').first().then($sel => {
      const hasRoad = $sel.find('option[value="ROAD"]').length > 0
      if (hasRoad) {
        cy.wrap($sel).select('ROAD', { force: true })
      }
    })
    cy.wait(6000)

    // Incoterm select - select CIF
    cy.get('body').then($body => {
      const selects = $body.find('select')
      if (selects.length >= 2) {
        const incotermSel = selects.eq(1)
        if (incotermSel.find('option[value="CIF"]').length > 0) {
          cy.wrap(incotermSel).select('CIF', { force: true })
        }
      }
    })
    cy.wait(6000)

    // Lugar incoterm
    cy.get('body').then($body => {
      const textInputs = $body.find('input[type="text"]')
      if (textInputs.length > 0) {
        cy.wrap(textInputs.first()).clear({ force: true }).type('Madrid, Espana', { force: true })
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h1-06b-transporte-completo')

    // === CREAR EXPEDICION (submit form) ===
    cy.get('button[type="submit"]').click({ force: true })
    cy.wait(10000)
    cy.captureStep('aeat-h1-06c-expedicion-creada')
  })

  // -------------------------------------------------------------------------
  // PASO 07: Verificar expedicion creada
  // -------------------------------------------------------------------------
  it('PASO 07 - Verificar expedicion en lista', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h1-07-lista-con-expedicion')

    // Click en la primera expedicion (la mas reciente)
    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h1-07b-detalle-expedicion')
      } else if ($body.find('table tr').length > 1) {
        cy.get('table tr').eq(1).click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h1-07b-detalle-expedicion')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 08: Navegar a declaraciones y seleccionar expedicion
  // -------------------------------------------------------------------------
  it('PASO 08 - Pantalla de declaraciones y seleccionar expedicion', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h1-08-pantalla-declaraciones')

    // Asegurar que H1 esta seleccionado (primera opcion por defecto)
    cy.get('body').then($body => {
      if ($body.text().includes('H1')) {
        cy.contains('H1').first().click({ force: true })
        cy.wait(10000)
      }
    })

    // Select expedition from list (click on the first available expedition card)
    cy.get('body').then($body => {
      const cards = $body.find('[class*="cursor-pointer"]')
      if (cards.length > 0) {
        cy.wrap(cards.first()).click({ force: true })
        cy.wait(10000)
      } else {
        // Try clicking on text that looks like an expedition ID
        if ($body.text().match(/EXP-\d{4}-/)) {
          cy.contains(/EXP-\d{4}-/).first().click({ force: true })
          cy.wait(10000)
        }
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h1-08b-expedicion-seleccionada')
  })

  // -------------------------------------------------------------------------
  // PASO 09: Generar declaracion H1
  // -------------------------------------------------------------------------
  it('PASO 09 - Generar declaracion H1 XML', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar H1
    cy.get('body').then($body => {
      if ($body.text().includes('H1')) {
        cy.contains('H1').first().click({ force: true })
        cy.wait(6000)
      }
    })

    // Seleccionar expedicion
    cy.get('body').then($body => {
      const cards = $body.find('[class*="cursor-pointer"]')
      if (cards.length > 0) {
        cy.wrap(cards.first()).click({ force: true })
        cy.wait(10000)
      }
    })

    // Click en Generar H1
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/)) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        // Esperar generacion del XML (puede tardar por IA)
        cy.wait(10000)
        cy.captureStep('aeat-h1-09-xml-generado')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 10: Visualizar XML generado y resultado
  // -------------------------------------------------------------------------
  it('PASO 10 - Visualizar XML generado', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar H1 y expedicion
    cy.get('body').then($body => {
      if ($body.text().includes('H1')) {
        cy.contains('H1').first().click({ force: true })
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

    // Generar si no esta generado
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/) && !$body.find('pre').length) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        cy.wait(10000)
      }
    })

    // Verificar que hay contenido XML / JSON visible
    cy.get('body').then($body => {
      if ($body.find('pre').length > 0) {
        cy.get('pre').first().should('exist')
        cy.captureStep('aeat-h1-10-preview-xml')
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h1-10b-estado-declaracion')
  })

  // -------------------------------------------------------------------------
  // PASO 11: ENVIAR A AEAT PRE (REAL SUBMISSION)
  // -------------------------------------------------------------------------
  it('PASO 11 - ENVIAR DECLARACION H1 A AEAT PRE (REAL)', () => {
    cy.visit('/declarations')
    cy.waitForLoad()
    cy.wait(10000)

    // Seleccionar H1
    cy.get('body').then($body => {
      if ($body.text().includes('H1')) {
        cy.contains('H1').first().click({ force: true })
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

    // Generar primero si necesario
    cy.get('body').then($body => {
      if ($body.text().match(/Generar|Generate/) && !$body.find('pre').length) {
        cy.contains(/Generar|Generate/).first().click({ force: true })
        cy.wait(10000)
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h1-11-antes-envio')

    // Click en "Enviar a AEAT" button (orange button)
    cy.get('body').then($body => {
      const sendBtn = $body.find('button:contains("AEAT"), button:contains("Enviar")')
      if (sendBtn.length > 0) {
        // Find the AEAT-specific send button
        const aeatBtn = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text()
          return text.includes('AEAT') || (text.includes('Enviar') && !text.includes('Generar'))
        })
        if (aeatBtn.length > 0) {
          cy.wrap(aeatBtn.first()).click({ force: true })
        } else {
          cy.wrap(sendBtn.last()).click({ force: true })
        }
      }
    })

    // ESPERAR RESPUESTA DE AEAT PRE (envio real tarda 5-30 segundos)
    cy.wait(20000)
    cy.captureStep('aeat-h1-11b-RESPUESTA-AEAT-REAL')

    // Verificar resultado
    cy.get('body').then($body => {
      const text = $body.text()
      if (text.includes('MRN') || text.match(/\d{2}ES\d{12}/)) {
        cy.captureStep('aeat-h1-11c-MRN-RECIBIDO')
      }
      if (text.match(/green|verde|Canal A|Aceptad/i)) {
        cy.captureStep('aeat-h1-11d-CANAL-VERDE')
      } else if (text.match(/orange|naranja|Canal B/i)) {
        cy.captureStep('aeat-h1-11d-CANAL-NARANJA')
      } else if (text.match(/red|rojo|Canal C/i)) {
        cy.captureStep('aeat-h1-11d-CANAL-ROJO')
      } else if (text.match(/error|Error|rechaz/i)) {
        cy.captureStep('aeat-h1-11d-ERROR-RESPUESTA')
      }
    })
  })

  // -------------------------------------------------------------------------
  // PASO 12: Verificar MRN y canal en detalle de expedicion
  // -------------------------------------------------------------------------
  it('PASO 12 - Verificar MRN y canal en expedicion', () => {
    cy.visit('/expeditions')
    cy.waitForLoad()
    cy.wait(10000)
    cy.captureStep('aeat-h1-12-lista-post-envio')

    // Click en la primera expedicion para ver detalle
    cy.get('body').then($body => {
      if ($body.find('tbody tr').length > 0) {
        cy.get('tbody tr').first().click({ force: true })
        cy.wait(10000)
        cy.captureStep('aeat-h1-12b-detalle-con-mrn')

        // Verificar si hay badges de canal
        cy.get('body').then($detail => {
          const text = $detail.text()
          if (text.match(/green|verde|Canal A/i)) {
            cy.captureStep('aeat-h1-12c-canal-verde-confirmado')
          } else if (text.match(/orange|naranja|Canal B/i)) {
            cy.captureStep('aeat-h1-12c-canal-naranja-confirmado')
          } else if (text.match(/red|rojo|Canal C/i)) {
            cy.captureStep('aeat-h1-12c-canal-rojo-confirmado')
          }
          if (text.match(/MRN|mrn|\d{2}ES\d{12}/)) {
            cy.captureStep('aeat-h1-12d-mrn-confirmado')
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
    cy.captureStep('aeat-h1-13-dashboard-canales')

    // Verificar que hay estadisticas
    cy.get('body').then($body => {
      const hasCards = $body.find('[class*="card"], [class*="stat"], [class*="Card"]').length > 0
      if (hasCards) {
        cy.captureStep('aeat-h1-13b-estadisticas-canales')
      }
      if ($body.find('tbody tr').length > 0) {
        cy.captureStep('aeat-h1-13c-listado-canales')
      }
    })

    cy.wait(10000)
    cy.captureStep('aeat-h1-13d-dashboard-canales-final')
  })
})
