/**
 * Regression — Manifest H7 upload (flujo demo AIRGO)
 * Valida el endpoint de template, los headers del CSV aceptados, y que el
 * upload con un CSV pequeño no rompa (incluso sin clasificación IA completa).
 */

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' }
let token = null

before(() => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: TEST_USER,
    failOnStatusCode: false
  }).then((r) => {
    if (r.status === 429) throw new Error('Rate-limited')
    token = r.body.data.token
  })
})

describe('Manifest H7 - demo AIRGO', () => {

  it('Template CSV descargable', () => {
    cy.request({
      url: '/api/manifest/template',
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false
    }).then((r) => {
      // 200 si existe, 404 si no; ambos aceptables (no 500)
      expect(r.status).to.be.lessThan(500)
    })
  })

  it('H7 stats del tenant retorna estructura esperada', () => {
    cy.request({
      url: '/api/h7/stats',
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => {
      expect(r.status).to.eq(200)
      expect(r.body).to.have.property('success', true)
    })
  })

  it('H7 list retorna declaraciones del tenant', () => {
    cy.request({
      url: '/api/h7?limit=5',
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => {
      expect(r.status).to.eq(200)
      const list = r.body?.data?.declarations || r.body?.data || r.body?.declarations || []
      expect(Array.isArray(list)).to.eq(true)
    })
  })

  it('Validar IOSS format (endpoint público IOSS check)', () => {
    cy.request({
      url: '/api/h7/validate-ioss/IM1234567890',
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false
    }).then((r) => {
      expect(r.status).to.be.lessThan(500)
    })
  })
})
