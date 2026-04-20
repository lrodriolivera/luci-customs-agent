/**
 * Smoke E2E — valida los cambios desplegados hoy (20/04/2026).
 *
 * Estrategia: el UI login es el PRIMER test (consume 1 slot del rate-limiter).
 * El token del UI login se reusa para las siguientes pruebas API → solo
 * consumimos 1 slot de /api/auth/login para toda la suite (max 10/15min).
 */

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' }
let sharedToken = null

function auth() {
  return { Authorization: `Bearer ${sharedToken}` }
}

describe('Smoke E2E - batch final 2026-04-20', () => {

  it('01 - UI login completo (consume 1 slot del rate-limiter)', () => {
    cy.visit('/login')
    cy.get('input[id="email"]', { timeout: 15000 }).should('be.visible').clear().type(TEST_USER.email)
    cy.get('input[id="password"]').clear().type(TEST_USER.password)
    cy.intercept('POST', '/api/auth/login').as('loginReq')
    cy.get('button[type="submit"]').click()
    cy.wait('@loginReq').then((i) => {
      expect(i.response.statusCode, 'login status').to.eq(200)
      sharedToken = i.response.body?.data?.token
      expect(sharedToken).to.be.a('string')
    })
    cy.url({ timeout: 20000 }).should('not.include', '/login')
    cy.window().its('localStorage.token').should('exist')
  })

  it('02 - Lazy-load i18n sirve los 7 idiomas', () => {
    ['es', 'ca', 'va', 'en', 'fr', 'it', 'pt'].forEach((l) => {
      cy.request(`/locales/${l}.json`).then((r) => {
        expect(r.status).to.eq(200)
        expect(Object.keys(r.body).length).to.be.greaterThan(10)
      })
    })
  })

  it('03 - OpenAPI 50+ paths + Swagger UI', () => {
    cy.request('/api/openapi.json').then((r) => {
      expect(r.status).to.eq(200)
      expect(Object.keys(r.body.paths).length).to.be.greaterThan(50)
    })
    cy.request('/api/docs/').its('status').should('eq', 200)
  })

  it('04 - JWT token tiene iss/aud/tenantId', () => {
    expect(sharedToken, 'token del UI login previo').to.be.a('string')
    const payload = JSON.parse(atob(sharedToken.split('.')[1]))
    expect(payload.iss).to.eq('luci-customs-agent')
    expect(payload.aud).to.eq('luci-api')
    expect(payload.tenantId).to.be.a('string')
    expect(payload.role).to.be.a('string')
  })

  it('05 - Expeditions list (tenant-scoped)', () => {
    cy.request({ url: '/api/expeditions', headers: auth() }).its('status').should('eq', 200)
  })

  it('06 - H7 list (tenant-scoped)', () => {
    cy.request({ url: '/api/h7', headers: auth() }).its('status').should('eq', 200)
  })

  it('07 - Clasificación TARIC pública', () => {
    cy.request('/api/classification/search?q=chocolate&limit=5').its('status').should('eq', 200)
    cy.request('/api/classification/taric/1806').its('status').should('eq', 200)
  })

  it('08 - GDPR export (Art. 15)', () => {
    cy.request({ url: '/api/gdpr/export', headers: auth() }).then((r) => {
      expect(r.status).to.eq(200)
      expect(r.body).to.have.property('article').that.includes('Art. 15')
      expect(r.body.data).to.have.property('user')
      expect(r.body.data).to.have.property('expeditions')
    })
  })

  it('09 - Audit log (tenant-scoped, append-only)', () => {
    cy.request({ url: '/api/audit?limit=3', headers: auth() }).then((r) => {
      expect(r.status).to.eq(200)
      expect(r.body.success).to.eq(true)
      expect(r.body.data).to.be.an('array')
    })
  })

  it('10 - Admin /users tenant-scoped', () => {
    cy.request({ url: '/api/admin/users', headers: auth() }).its('status').should('eq', 200)
  })

  it('11 - Metrics endpoint (endpoints + aiTokens)', () => {
    cy.request({ url: '/api/internal/metrics', headers: auth() }).then((r) => {
      expect(r.status).to.eq(200)
      expect(r.body).to.have.property('endpoints')
      expect(r.body).to.have.property('aiTokens')
      expect(r.body.aiTokens).to.have.all.keys('inputTokens', 'outputTokens', 'cachedTokens', 'callCount')
    })
  })

  it('12 - Refresh-token renueva JWT con iss/aud', () => {
    cy.request({ method: 'POST', url: '/api/auth/refresh-token', headers: auth() }).then((r) => {
      expect(r.status).to.eq(200)
      const newToken = r.body?.data?.token
      expect(newToken).to.be.a('string')
      const p = JSON.parse(atob(newToken.split('.')[1]))
      expect(p.iss).to.eq('luci-customs-agent')
      expect(p.aud).to.eq('luci-api')
    })
  })

  it('13 - Security headers (CSP, HSTS, X-Frame, X-Content-Type)', () => {
    cy.request({ url: '/api/auth/me', headers: auth() }).then((r) => {
      expect(r.status).to.eq(200)
      expect(r.headers).to.have.property('content-security-policy')
      expect(r.headers).to.have.property('strict-transport-security')
      expect(r.headers).to.have.property('x-frame-options')
      expect(r.headers).to.have.property('x-content-type-options', 'nosniff')
    })
  })
})
