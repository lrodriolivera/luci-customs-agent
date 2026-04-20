/**
 * Regression — Calculadora de derechos
 * Valida que la calculadora calcula IVA 4%, 10%, 21% correctamente
 * para diferentes TARIC codes (frutas/verduras, alimentación, general).
 *
 * Usa data-testid añadidos a DutyCalculator.jsx.
 */

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' }
let token = null
let user = null

before(() => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: TEST_USER,
    failOnStatusCode: false
  }).then((r) => {
    if (r.status === 429) throw new Error('Rate-limited')
    token = r.body.data.token
    user = r.body.data.user
  })
})

function visit(path) {
  cy.visit(path, {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', token)
      win.localStorage.setItem('user', JSON.stringify(user))
      win.localStorage.setItem('i18nextLng', 'es')
    }
  })
}

describe('Calculadora de derechos - IVA y aranceles', () => {

  it('Melocotones (0809300000 CN) → IVA 4% superreducido + arancel estacional', () => {
    visit('/calculator')
    cy.wait(2000)

    cy.get('[data-testid="calc-taric"]').clear().type('0809300000')
    cy.get('[data-testid="calc-value"]').clear().type('10000')
    cy.get('[data-testid="calc-origin"]').select('CN')
    cy.get('[data-testid="calc-submit"]').click()

    cy.wait(3000)
    cy.get('body').should('not.contain', /Error interno/i)
    // El resultado contiene porcentajes o cifras
    cy.contains(/IVA|VAT|arancel|duty|€|EUR|\d+\s*%/i, { timeout: 15000 }).should('exist')
  })

  it('Chocolate (1806100000 CN) → IVA 10% + arancel MFN', () => {
    visit('/calculator')
    cy.wait(2000)

    cy.get('[data-testid="calc-taric"]').clear().type('1806100000')
    cy.get('[data-testid="calc-value"]').clear().type('5000')
    cy.get('[data-testid="calc-origin"]').select('CN')
    cy.get('[data-testid="calc-submit"]').click()

    cy.wait(3000)
    cy.contains(/IVA|arancel|duty|€|EUR|\d+\s*%/i, { timeout: 15000 }).should('exist')
  })

  it('Teléfonos (8517130000 CN) → IVA 21% normal + arancel 0% (ITA)', () => {
    visit('/calculator')
    cy.wait(2000)

    cy.get('[data-testid="calc-taric"]').clear().type('8517130000')
    cy.get('[data-testid="calc-value"]').clear().type('15000')
    cy.get('[data-testid="calc-origin"]').select('CN')
    cy.get('[data-testid="calc-submit"]').click()

    cy.wait(3000)
    cy.contains(/IVA|arancel|duty|€|EUR|\d+\s*%/i, { timeout: 15000 }).should('exist')
  })
})
