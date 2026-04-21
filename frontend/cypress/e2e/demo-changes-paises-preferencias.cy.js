/**
 * Test: Motor de Reglas - 226 paises + preferencias con EUR.1/ATR/REX
 * Cambios: Lista paises ampliada, 60+ acuerdos preferenciales
 */
const DELAY = 2500

describe('Motor de Reglas - Paises y Preferencias', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.wait(1000)
    cy.get('input[name="email"], input[type="email"]').clear().type('bvillanueva@airgoexpress.com')
    cy.get('input[name="password"], input[type="password"]').clear().type('AirgoDemo2026')
    cy.get('button[type="submit"]').click()
    cy.wait(3000)
  })

  it('Motor de reglas con lista completa de paises', () => {
    cy.visit('/rules-engine')
    cy.wait(DELAY)
    cy.screenshot('01-motor-reglas')

    // Verificar que el selector de pais tiene muchas opciones
    cy.get('select').first().find('option').should('have.length.greaterThan', 50)
    cy.screenshot('02-selector-paises-ampliado')

    // Seleccionar Marruecos (pais con EUR.1)
    cy.get('select').first().select('MA')
    cy.wait(1000)
    cy.screenshot('03-pais-marruecos-seleccionado')
  })

  it('Preferencias arancelarias con lista completa', () => {
    cy.visit('/preferences')
    cy.wait(DELAY)
    cy.screenshot('04-preferencias-inicio')

    // Verificar paises ampliados
    cy.get('select').first().find('option').should('have.length.greaterThan', 50)
    cy.wait(500)
    cy.screenshot('05-preferencias-paises-completos')

    // Seleccionar Vietnam (FTA con REX)
    cy.get('select').first().select('VN')
    cy.wait(DELAY)
    cy.screenshot('06-preferencia-vietnam')
  })

  it('Contingentes con lista completa de paises', () => {
    cy.visit('/quotas')
    cy.wait(DELAY)
    cy.screenshot('07-contingentes-inicio')

    // Verificar paises
    cy.get('select').first().find('option').should('have.length.greaterThan', 50)
    cy.screenshot('08-contingentes-paises-completos')
  })
})
