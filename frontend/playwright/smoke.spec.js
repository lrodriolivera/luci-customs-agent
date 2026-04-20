// @ts-check
/**
 * Playwright smoke — paridad con cypress/e2e/smoke-batch-final.cy.js
 * pero ejecutado con Playwright (sirve como fallback si Cypress peta en CI).
 */
const { test, expect } = require('@playwright/test')

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' }
let sharedToken = null
let sharedUser = null

test.describe.serial('LUCI smoke — Playwright', () => {

  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER })
    if (r.status() === 429) throw new Error('Rate-limited (clean Redis before)')
    expect(r.status()).toBe(200)
    const body = await r.json()
    sharedToken = body?.data?.token
    sharedUser = body?.data?.user
    expect(sharedToken).toBeTruthy()
  })

  test('Home login renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[id="email"]')).toBeVisible({ timeout: 15_000 })
  })

  test('Lazy i18n serves all 7 languages', async ({ request }) => {
    for (const l of ['es', 'ca', 'va', 'en', 'fr', 'it', 'pt']) {
      const r = await request.get(`/locales/${l}.json`)
      expect(r.status(), l).toBe(200)
      const body = await r.json()
      expect(Object.keys(body).length).toBeGreaterThan(10)
    }
  })

  test('OpenAPI 50+ paths + Swagger UI', async ({ request }) => {
    const r = await request.get('/api/openapi.json')
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(Object.keys(body.paths).length).toBeGreaterThan(50)
    const docs = await request.get('/api/docs/')
    expect(docs.status()).toBe(200)
  })

  test('JWT has iss/aud/tenantId', () => {
    const payload = JSON.parse(Buffer.from(sharedToken.split('.')[1], 'base64').toString())
    expect(payload.iss).toBe('luci-customs-agent')
    expect(payload.aud).toBe('luci-api')
    expect(payload.tenantId).toBeTruthy()
    expect(payload.role).toBeTruthy()
  })

  test('Expeditions list (tenant-scoped)', async ({ request }) => {
    const r = await request.get('/api/expeditions', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
  })

  test('H7 list (tenant-scoped)', async ({ request }) => {
    const r = await request.get('/api/h7', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
  })

  test('GDPR export Art. 15', async ({ request }) => {
    const r = await request.get('/api/gdpr/export', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.article).toContain('Art. 15')
    expect(body.data).toHaveProperty('user')
  })

  test('Audit log tenant-scoped', async ({ request }) => {
    const r = await request.get('/api/audit?limit=3', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
  })

  test('Admin /users tenant-scoped', async ({ request }) => {
    const r = await request.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
  })

  test('Metrics endpoint', async ({ request }) => {
    const r = await request.get('/api/internal/metrics', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body).toHaveProperty('endpoints')
    expect(body).toHaveProperty('aiTokens')
  })

  test('Refresh-token renews JWT with iss/aud', async ({ request }) => {
    const r = await request.post('/api/auth/refresh-token', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
    const body = await r.json()
    const newToken = body?.data?.token
    expect(newToken).toBeTruthy()
    const p = JSON.parse(Buffer.from(newToken.split('.')[1], 'base64').toString())
    expect(p.iss).toBe('luci-customs-agent')
    expect(p.aud).toBe('luci-api')
  })

  test('Security headers', async ({ request }) => {
    const r = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${sharedToken}` }
    })
    expect(r.status()).toBe(200)
    const headers = r.headers()
    expect(headers['content-security-policy']).toBeTruthy()
    expect(headers['strict-transport-security']).toBeTruthy()
    expect(headers['x-frame-options']).toBeTruthy()
    expect(headers['x-content-type-options']).toBe('nosniff')
  })

  test('Dashboard loads in browser', async ({ page, context }) => {
    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('i18nextLng', 'es')
    }, { token: sharedToken, user: sharedUser })

    await page.goto('/')
    // One of: sidebar nav, or any main content
    await expect(page.locator('body')).toBeVisible()
    await page.waitForTimeout(3000)
    // Must not be on /login
    expect(page.url()).not.toContain('/login')
  })
})
