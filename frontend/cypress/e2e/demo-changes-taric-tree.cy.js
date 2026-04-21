/**
 * Test: Arbol TARIC - Navegacion jerarquica + estacionalidad
 * Cambios: Tree browser fix, 2283 codigos, badge estacional, niveles intermedios
 */
const DELAY = 2500

describe('Arbol TARIC - Navegacion y Estacionalidad', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.wait(1000)
    cy.get('input[name="email"], input[type="email"]').clear().type('bvillanueva@airgoexpress.com')
    cy.get('input[name="password"], input[type="password"]').clear().type('AirgoDemo2026')
    cy.get('button[type="submit"]').click()
    cy.wait(3000)
  })

  it('Navegar el arbol TARIC: Capitulo > Partida > Subpartida', () => {
    cy.visit('/classification')
    cy.wait(DELAY)
    cy.screenshot('01-clasificacion-principal')

    // Click en Explorar Arbol
    cy.contains(/Explorar|Tree|Arbol/i).click()
    cy.wait(DELAY)
    cy.screenshot('02-arbol-capitulos')

    // Navegar a Capitulo 08 - Frutas
    cy.contains('08').click()
    cy.wait(DELAY)
    cy.screenshot('03-capitulo-08-frutas-headings')

    // Navegar a 0809 - Albaricoques, cerezas, melocotones
    cy.contains('0809').click()
    cy.wait(DELAY)
    cy.screenshot('04-heading-0809-subheadings-estacional')

    // Verificar badge estacional
    cy.contains('Estacional').should('exist')
    cy.screenshot('05-badge-estacional-visible')

    // Volver a capitulos
    cy.visit('/classification')
    cy.wait(1000)
    cy.contains(/Explorar|Tree|Arbol/i).click()
    cy.wait(DELAY)

    // Navegar a Capitulo 85 - Electronica
    cy.contains('85').click()
    cy.wait(DELAY)
    cy.screenshot('06-capitulo-85-electronica')

    // Navegar a 8517 - Telefonos
    cy.contains('8517').click()
    cy.wait(DELAY)
    cy.screenshot('07-heading-8517-telefonos')
  })

  it('Buscar codigo TARIC por texto', () => {
    cy.visit('/classification')
    cy.wait(DELAY)

    // Buscar por texto
    cy.get('input[placeholder*="Buscar"], input[type="search"], input[placeholder*="codigo"]').first().type('melocotones')
    cy.wait(DELAY)
    cy.screenshot('08-busqueda-melocotones')

    // Buscar por codigo
    cy.get('input[placeholder*="Buscar"], input[type="search"], input[placeholder*="codigo"]').first().clear().type('0809300000')
    cy.wait(DELAY)
    cy.screenshot('09-busqueda-codigo-melocotones')
  })
})
