/**
 * Test: H1 Declaracion DUA Completo
 * Cambio: Nuevo formulario /declarations/h1/new con todas las casillas
 */
const DELAY = 2000

describe('H1 Declaracion DUA Completo', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.wait(1000)
    cy.get('input[name="email"], input[type="email"]').clear().type('bvillanueva@airgoexpress.com')
    cy.get('input[name="password"], input[type="password"]').clear().type('AirgoDemo2026')
    cy.get('button[type="submit"]').click()
    cy.wait(3000)
  })

  it('Navegar al formulario H1 y verificar todas las casillas', () => {
    // Navegar via sidebar
    cy.visit('/declarations/h1/new')
    cy.wait(DELAY)
    cy.screenshot('01-h1-formulario-cabecera')

    // Verificar que existen las secciones principales
    cy.contains('Casilla 1').should('be.visible')
    cy.wait(500)
    cy.screenshot('02-casilla-1-declaracion')

    // Scroll a expedidor
    cy.contains('Casilla 2').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('03-casilla-2-expedidor')

    // Rellenar expedidor
    cy.get('input[name="senderName"]').type('SENSORY ANALYTICS LLC')
    cy.get('input[name="senderStreet"]').type('405 POMONA DR')
    cy.get('input[name="senderCity"]').type('GREENSBORO')
    cy.get('input[name="senderPostalCode"]').type('27407')
    cy.get('input[name="senderCountry"]').clear().type('US')
    cy.wait(1000)
    cy.screenshot('04-expedidor-relleno')

    // Scroll a destinatario
    cy.contains('Casilla 8').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('05-casilla-8-destinatario')

    // Scroll a condiciones entrega
    cy.contains('Casilla 20').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('06-casillas-transporte')

    // Scroll a partidas
    cy.contains('Casilla 31').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('07-casilla-31-partida')

    // Scroll a casilla 33 (codigo mercancias)
    cy.contains('Casilla 33').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('08-casilla-33-taric')

    // Scroll a casilla 44 (documentos)
    cy.contains('Casilla 44').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('09-casilla-44-documentos')

    // Scroll a casilla 47 (tributos)
    cy.contains('Casilla 47').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('10-casilla-47-tributos')

    // Scroll al final
    cy.scrollTo('bottom')
    cy.wait(1000)
    cy.screenshot('11-casilla-54-final')
  })
})
