/**
 * Test: H7 Declaracion Directa (sin expedicion)
 * Cambio: Nuevo formulario /h7/new
 */
const DELAY = 2000

describe('H7 Declaracion Directa', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.wait(1000)
    cy.get('input[name="email"], input[type="email"]').clear().type('bvillanueva@airgoexpress.com')
    cy.get('input[name="password"], input[type="password"]').clear().type('AirgoDemo2026')
    cy.get('button[type="submit"]').click()
    cy.wait(3000)
  })

  it('Crear H7 manualmente sin expedicion', () => {
    // Navegar a H7
    cy.visit('/h7')
    cy.wait(DELAY)
    cy.screenshot('01-lista-h7')

    // Click Nueva H7
    cy.contains('a', /Nueva H7|New H7/i).click()
    cy.wait(DELAY)
    cy.screenshot('02-formulario-h7-vacio')

    // Rellenar datos del envio
    cy.get('input[name="trackingNumber"]').type('AWB-DEMO-2026-001')
    cy.get('select[name="carrierCode"]').select('DHL')
    cy.get('select[name="customsOffice"]').select('ES002801')
    cy.wait(1000)
    cy.screenshot('03-datos-envio')

    // N337
    cy.get('input[name="documentoPrevioRef"]').type('G4-2801-2026-00001')
    cy.get('input[name="garantiaGRN"]').type('26ESAGL2800000054')
    cy.wait(1000)
    cy.screenshot('04-n337-garantia')

    // Remitente
    cy.get('input[name="senderName"]').type('Shenzhen Electronics Co Ltd')
    cy.get('input[name="senderCountry"]').clear().type('CN')
    cy.get('input[name="senderStreet"]').type('Nanshan District 88')
    cy.get('input[name="senderCity"]').type('Shenzhen')
    cy.get('input[name="senderPostalCode"]').type('518000')
    cy.wait(1000)
    cy.screenshot('05-remitente')

    // Destinatario
    cy.get('input[name="recipientName"]').type('Maria Garcia Lopez')
    cy.get('input[name="recipientStreet"]').type('Calle Mayor 10, 3A')
    cy.get('input[name="recipientCity"]').type('Madrid')
    cy.get('input[name="recipientPostalCode"]').type('28013')
    cy.wait(1000)
    cy.screenshot('06-destinatario')

    // Articulo 1
    cy.get('input[placeholder*="Funda"]').first().type('Funda protectora silicona para movil')
    cy.get('input[placeholder*="392690"]').first().type('392690')
    cy.get('input[placeholder*="CN"]').first().clear().type('CN')
    cy.get('input[type="number"][min="1"]').first().clear().type('2')
    cy.wait(500)

    // Valor y peso
    cy.get('input[type="number"][step="0.01"]').first().clear().type('4.25')
    cy.get('input[type="number"][step="0.001"]').first().clear().type('0.05')
    cy.wait(1000)
    cy.screenshot('07-articulo')

    // Costes
    cy.get('input[name="shippingCost"]').clear().type('3.50')
    cy.get('input[name="grossWeight"]').clear().type('0.08')
    cy.wait(DELAY)
    cy.screenshot('08-totales-resumen')

    // Scroll down para ver resumen
    cy.scrollTo('bottom')
    cy.wait(1000)
    cy.screenshot('09-boton-crear')

    // Crear
    cy.contains('button', /Crear declaracion H7/i).click()
    cy.wait(5000)
    cy.screenshot('10-h7-creada')
  })
})
