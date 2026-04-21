/**
 * Test: Transito NCTS - Precintos y fechas
 * Cambios: Formulario precintos, detalle con fechas ultimacion
 */
const DELAY = 2500

describe('Transito NCTS - Precintos y Fechas', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.wait(1000)
    cy.get('input[name="email"], input[type="email"]').clear().type('bvillanueva@airgoexpress.com')
    cy.get('input[name="password"], input[type="password"]').clear().type('AirgoDemo2026')
    cy.get('button[type="submit"]').click()
    cy.wait(3000)
  })

  it('Formulario de transito con precintos', () => {
    cy.visit('/transit')
    cy.wait(DELAY)
    cy.screenshot('01-transito-lista')

    // Crear nuevo transito
    cy.contains('button', /Nuevo|Crear|New/i).first().click()
    cy.wait(DELAY)
    cy.screenshot('02-formulario-transito')

    // Scroll hasta precintos
    cy.contains('Precintos').scrollIntoView()
    cy.wait(1000)
    cy.screenshot('03-seccion-precintos')

    // Rellenar precinto
    cy.get('input[placeholder*="Precinto 1"]').type('SEAL-2026-001')
    cy.get('select').last().select('customs')
    cy.get('input[placeholder*="Colocado"]').type('Aduana Madrid-Barajas')
    cy.wait(1000)
    cy.screenshot('04-precinto-relleno')

    // Agregar otro precinto
    cy.contains('Agregar precinto').click()
    cy.wait(500)
    cy.get('input[placeholder*="Precinto 2"]').type('SEAL-2026-002')
    cy.wait(1000)
    cy.screenshot('05-dos-precintos')

    // Scroll a vehiculo
    cy.get('input[placeholder*="Matricula"]').type('1234-BCD')
    cy.get('input[placeholder*="Nacionalidad"]').type('ES')
    cy.wait(1000)
    cy.screenshot('06-vehiculo-precintos')
  })
})
