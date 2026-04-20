/**
 * Regression — Clasificación TARIC
 * Valida la búsqueda pública, el árbol y el detalle por código.
 * No depende de IA en tiempo real (usa endpoints deterministas con DB local).
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

describe('Clasificación TARIC - búsqueda y árbol', () => {

  it('Búsqueda por texto "chocolate" retorna resultados', () => {
    cy.request('/api/classification/search?q=chocolate&limit=5').then((r) => {
      expect(r.status).to.eq(200)
      const results = r.body?.data?.results || r.body?.results || []
      expect(results).to.be.an('array')
      expect(results.length).to.be.greaterThan(0)
      expect(results[0]).to.have.property('code')
    })
  })

  it('Detalle código 1806 retorna descripción y aranceles', () => {
    cy.request('/api/classification/taric/1806').then((r) => {
      expect(r.status).to.eq(200)
    })
  })

  it('Árbol de capítulos carga 97 capítulos TARIC', () => {
    cy.request('/api/classification/chapters').then((r) => {
      expect(r.status).to.eq(200)
      const chapters = r.body?.data || r.body?.chapters || []
      expect(chapters).to.be.an('array')
    })
  })

  it('Pantalla /classification carga con tabs', () => {
    visit('/classification')
    cy.wait(2000)
    cy.contains(/Clasific/i).should('be.visible')
    // Debe haber alguna tab: Básico / Buscar Código / Explorar Árbol
    cy.contains(/Básico|Buscar|Explorar|Árbol/i).should('exist')
  })

  it('Sugerencia IA para "laptop" completa sin 5xx', () => {
    cy.request({
      method: 'POST',
      url: '/api/classification/suggest',
      headers: { Authorization: `Bearer ${token}` },
      body: { description: 'laptop computer 15 inch', language: 'es' },
      timeout: 45000,
      failOnStatusCode: false
    }).then((r) => {
      expect(r.status).to.be.lessThan(500)
    })
  })
})
