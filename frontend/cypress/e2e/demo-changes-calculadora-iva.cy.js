/**
 * Test: Calculadora de derechos - IVA corregido + aranceles reales
 * Cambios: IVA 4% frutas/verduras, 344 codigos con duty rates EU reales
 */
const DELAY = 2500

describe('Calculadora Derechos - IVA y Aranceles', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.wait(1000)
    cy.get('input[name="email"], input[type="email"]').clear().type('bvillanueva@airgoexpress.com')
    cy.get('input[name="password"], input[type="password"]').clear().type('AirgoDemo2026')
    cy.get('button[type="submit"]').click()
    cy.wait(3000)
  })

  it('Calcular derechos para melocotones - IVA 4% superreducido', () => {
    cy.visit('/calculator')
    cy.wait(DELAY)
    cy.screenshot('01-calculadora-vacia')

    // Rellenar melocotones
    cy.get('input[name="taricCode"], input[placeholder*="TARIC"]').first().clear().type('0809300000')
    cy.get('input[name="value"], input[placeholder*="valor"]').first().clear().type('10000')
    cy.get('select[name="origin"]').select('CN')
    cy.wait(1000)
    cy.screenshot('02-melocotones-datos')

    // Calcular
    cy.contains('button', /Calcular/i).click()
    cy.wait(5000)
    cy.screenshot('03-melocotones-resultado-iva-4')

    // Scroll para ver detalles
    cy.scrollTo('bottom')
    cy.wait(1000)
    cy.screenshot('04-melocotones-detalle-estacional')
  })

  it('Calcular derechos para telefonos - IVA 21%', () => {
    cy.visit('/calculator')
    cy.wait(DELAY)

    cy.get('input[name="taricCode"], input[placeholder*="TARIC"]').first().clear().type('8517120000')
    cy.get('input[name="value"], input[placeholder*="valor"]').first().clear().type('5000')
    cy.get('select[name="origin"]').select('CN')
    cy.wait(1000)

    cy.contains('button', /Calcular/i).click()
    cy.wait(5000)
    cy.screenshot('05-telefonos-resultado-iva-21')
  })

  it('Calcular derechos para farmaceuticos - IVA 4%', () => {
    cy.visit('/calculator')
    cy.wait(DELAY)

    cy.get('input[name="taricCode"], input[placeholder*="TARIC"]').first().clear().type('3004900000')
    cy.get('input[name="value"], input[placeholder*="valor"]').first().clear().type('2000')
    cy.get('select[name="origin"]').select('US')
    cy.wait(1000)

    cy.contains('button', /Calcular/i).click()
    cy.wait(5000)
    cy.screenshot('06-farmaceuticos-resultado-iva-4')
  })
})
