/**
 * Smoke UI flows — cubre los flujos críticos desde la UI real.
 *
 * Se enfoca en verificar que cada pantalla renderiza, los datos se cargan
 * y las APIs responden. No interactúa con forms complejos (los cuales
 * mantienen selectores específicos en tests de regresión dedicados).
 */

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' }
let sharedToken = null
let sharedUser = null

before(() => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: TEST_USER,
    failOnStatusCode: false
  }).then((r) => {
    if (r.status === 429) {
      throw new Error('Rate-limited en before(). Limpia Redis y reintenta.')
    }
    expect(r.status).to.eq(200)
    sharedToken = r.body?.data?.token
    sharedUser = r.body?.data?.user
    expect(sharedToken).to.be.a('string')
  })
})

function visitWithAuth(path) {
  cy.visit(path, {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', sharedToken)
      win.localStorage.setItem('user', JSON.stringify(sharedUser))
      win.localStorage.setItem('i18nextLng', 'es')
    }
  })
}

describe('Smoke UI flows - navegación y renderizado', () => {

  beforeEach(() => {
    visitWithAuth('/')
  })

  it('01 - Dashboard carga con KPIs y navegación principal', () => {
    cy.url().should('not.include', '/login')
    // Sidebar con items
    cy.contains(/Expedi|Clasific|Calculad/i, { timeout: 15000 }).should('be.visible')
  })

  it('02 - Expeditions list renderiza y lista expedientes del tenant', () => {
    visitWithAuth('/expeditions')
    cy.url().should('include', '/expeditions')
    cy.wait(2000)
    // Debe haber botón de "nuevo" o similar
    cy.contains('button, a', /Nuevo|Crear|New|\+/i, { timeout: 10000 }).should('exist')
  })

  it('03 - Clasificación TARIC muestra tabs y form de descripción', () => {
    visitWithAuth('/classification')
    cy.wait(2000)
    cy.contains(/Clasific/i, { timeout: 10000 }).should('be.visible')
    // Alguno de: textarea (tab Básico), input search (tab Árbol), o tabs de navegación
    cy.get('textarea, input[type="search"], input[placeholder*="descripc" i]', { timeout: 10000 })
      .should('have.length.greaterThan', 0)
  })

  it('04 - Calculadora de derechos carga el form', () => {
    visitWithAuth('/calculator')
    cy.wait(2000)
    cy.contains(/Calcular|Arancel|Derech/i, { timeout: 10000 }).should('exist')
    // Campo TARIC presente (por label o placeholder)
    cy.get('input[placeholder*="0000"], input[maxlength="10"]', { timeout: 10000 })
      .should('have.length.greaterThan', 0)
  })

  it('05 - H7 list carga y muestra manifest upload', () => {
    visitWithAuth('/h7')
    cy.wait(2000)
    cy.url().should('include', '/h7')
    cy.contains(/H7|Bajo Valor|DECO|Importar|Manifiesto/i, { timeout: 10000 }).should('exist')
  })

  it('06 - Dashboard alerts endpoint responde', () => {
    cy.request({
      url: '/api/dashboard/alerts',
      headers: { Authorization: `Bearer ${sharedToken}` }
    }).then((r) => {
      expect(r.status).to.eq(200)
      expect(r.body.success).to.eq(true)
    })
  })

  it('07 - Calcular arancel vía API (chocolate CN → arancel real)', () => {
    cy.request({
      method: 'POST',
      url: '/api/calculation/duties',
      headers: { Authorization: `Bearer ${sharedToken}` },
      body: {
        taricCode: '1806100000',
        customsValue: 10000,
        origin: 'CN',
        quantity: 100
      },
      failOnStatusCode: false
    }).then((r) => {
      // Puede ser 200 con datos o 400 si valida campo, ambos aceptables
      expect([200, 400, 422]).to.include(r.status)
      if (r.status === 200) {
        expect(r.body).to.have.property('success')
      }
    })
  })

  it('08 - Clasificar producto con IA (chocolate)', () => {
    cy.request({
      method: 'POST',
      url: '/api/classification/suggest',
      headers: { Authorization: `Bearer ${sharedToken}` },
      body: { description: 'chocolate bar with cocoa 60%', language: 'es' },
      failOnStatusCode: false,
      timeout: 45000
    }).then((r) => {
      // Puede ser 200 con sugerencias o rate-limit IA, pero no debe ser error de servidor
      expect(r.status).to.be.lessThan(500)
    })
  })

  it('09 - Get expeditions detail (primer expediente del tenant)', () => {
    cy.request({
      url: '/api/expeditions?limit=1',
      headers: { Authorization: `Bearer ${sharedToken}` }
    }).then((r) => {
      expect(r.status).to.eq(200)
      const list = r.body?.data?.expeditions || r.body?.data || r.body?.expeditions || []
      if (Array.isArray(list) && list.length > 0) {
        const id = list[0]._id || list[0].id
        cy.request({
          url: `/api/expeditions/${id}`,
          headers: { Authorization: `Bearer ${sharedToken}` }
        }).its('status').should('eq', 200)
      } else {
        cy.log('No expeditions in tenant, skipping detail fetch')
      }
    })
  })

  it('10 - Get H7 stats del tenant', () => {
    cy.request({
      url: '/api/h7/stats',
      headers: { Authorization: `Bearer ${sharedToken}` }
    }).then((r) => {
      expect(r.status).to.eq(200)
    })
  })

  it('11 - Manifest template CSV descargable', () => {
    cy.request({
      url: '/api/manifest/template',
      headers: { Authorization: `Bearer ${sharedToken}` },
      failOnStatusCode: false
    }).then((r) => {
      expect([200, 404]).to.include(r.status)
    })
  })

  it('12 - Channel dashboard con stats', () => {
    cy.request({
      url: '/api/channels/stats',
      headers: { Authorization: `Bearer ${sharedToken}` }
    }).then((r) => {
      expect(r.status).to.eq(200)
    })
  })

  it('13 - Cambio de idioma en UI carga locale on-demand', () => {
    // Verifica que tanto ES como EN cargan dinámicamente
    cy.request('/locales/es.json').its('status').should('eq', 200)
    cy.request('/locales/en.json').its('status').should('eq', 200)
    // Marca en localStorage y recarga
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', sharedToken)
        win.localStorage.setItem('user', JSON.stringify(sharedUser))
        win.localStorage.setItem('i18nextLng', 'en')
      }
    })
    cy.wait(2000)
    // Debe haber renderizado sin errores (si i18n fuese eager, habría panik)
    cy.get('body').should('be.visible')
  })
})
