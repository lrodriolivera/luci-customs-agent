// @ts-check
/**
 * E2E /integrations — Integraciones (AEAT/VUA/TRACES/NCTS).
 *
 * Cobertura UI desde el front:
 *  1) Render base + h1 + 4 tabs (Dashboard/VUA/TRACES/NCTS) + refresh
 *  2) Dashboard: 5 stats cards (Total/Activas/Simulacion/Error/Inactivas)
 *  3) Grid integraciones + boton Test por tarjeta
 *  4) Tabla "Estadisticas de Uso (Ultimos 30 dias)" con totales
 *  5) Test connectivity (POST /api/integrations/:code/test) -> recarga status
 *  6) Click tarjeta -> modal detalle (categoria/pais/estado/ambiente/timestamp)
 *  7) Tab VUA: servicios + autoridades
 *  8) Tab TRACES: tipos CHED + BCPs
 *  9) Tab NCTS: tipos transito + tipos garantia + aduanas (salida/destino)
 *
 * Nota: la pantalla NO tiene panel/boton IA dedicado (los endpoints
 * /api/integrations/* son catalogos+test, no llaman a LUCI).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'integrations-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let integrationCodes = [];

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Integraciones /integrations', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status()).toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;

    // Pre-cargar lista de codigos para tests
    const list = await request.get('/api/integrations/list', { headers: { Authorization: `Bearer ${token}` } });
    const lbody = await list.json().catch(() => ({}));
    integrationCodes = (lbody?.data || []).map(i => i.code);
    log('api-list', 'low', `Integraciones disponibles: ${integrationCodes.join(', ')}`);
  });

  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(({ t, u }) => {
      if (t) localStorage.setItem('token', t);
      if (u) localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('i18nextLng', 'es');
      localStorage.setItem('cookieConsent', 'accepted');
      localStorage.setItem('cookies-accepted', 'true');
      localStorage.setItem('activeCustomsCountry', 'ES');
    }, { t: token, u: user });
    page.on('pageerror', (err) => log('page-error', 'critical', err.message));
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/api/') && res.status() >= 400 && !u.includes('cache-stats')) {
        log('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 1. Render base
  // -------------------------------------------------------------------------
  test('1. Render base /integrations + h1 + 4 tabs + refresh', async ({ page }) => {
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Integraciones|Integrations/i.test(h1 || '') && !/integrations\.title/.test(h1 || '') ? 'low' : 'high',
      `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 4 tabs
    for (const tab of ['Dashboard', 'VUA', 'TRACES', 'NCTS']) {
      const visible = await page.locator(`button:has-text("${tab}")`).first().isVisible({ timeout: 1500 }).catch(() => false);
      log('tab', visible ? 'low' : 'medium', `Tab "${tab}" visible: ${visible}`);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Dashboard: stats cards (5)
  // -------------------------------------------------------------------------
  test('2. Dashboard - 5 stats cards (Total/Activas/Simulacion/Error/Inactivas)', async ({ page }) => {
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(3000);

    for (const lbl of ['Total', 'Activas', 'Simulacion', 'Error', 'Inactivas']) {
      const visible = await page.locator(`text=/^${lbl}$/`).first().isVisible({ timeout: 2500 }).catch(() => false);
      log('stat-card', visible ? 'low' : 'medium', `Card "${lbl}" visible: ${visible}`);
    }

    await page.screenshot({ path: path.join(SCREENS, '02-dashboard-stats.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Grid integraciones + verificar codigos AEAT/VUA/TRACES/NCTS
  // -------------------------------------------------------------------------
  test('3. Grid integraciones - tarjetas AEAT/VUA/TRACES/NCTS visibles', async ({ page }) => {
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(3500);

    for (const code of ['AEAT', 'VUA', 'TRACES', 'NCTS']) {
      const visible = await page.locator(`h3:has-text("${code}")`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('integration-card', visible ? 'low' : 'medium', `Card ${code} visible: ${visible}`);
    }

    await page.screenshot({ path: path.join(SCREENS, '03-grid-integrations.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 4. Estadisticas de Uso table
  // -------------------------------------------------------------------------
  test('4. Estadisticas de Uso (Ultimos 30 dias) con tabla + totales', async ({ page }) => {
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(3500);

    const heading = await page.locator('text=/Estadisticas de Uso/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('stats-heading', heading ? 'low' : 'medium', `Heading "Estadisticas de Uso" visible: ${heading}`);

    const totalsRow = await page.locator('tfoot >> text=/Total/i').first().isVisible({ timeout: 2500 }).catch(() => false);
    log('stats-totals', totalsRow ? 'low' : 'medium', `Fila Total en tfoot visible: ${totalsRow}`);

    // Hacer scroll para capturar tabla
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '04-usage-stats.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 5. Test connectivity (Test button per card)
  // -------------------------------------------------------------------------
  test('5. Test connectivity - boton "Test" recarga status', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(3500);

    const testCalls = [];
    page.on('response', async (r) => {
      const m = r.url().match(/\/api\/integrations\/([A-Z]+)\/test/);
      if (m) {
        try { testCalls.push({ code: m[1], status: r.status(), body: await r.json() }); } catch {}
      }
    });

    // Click el primer boton "Test"
    const testBtn = page.locator('button').filter({ hasText: /^Test$/ }).first();
    await testBtn.scrollIntoViewIfNeeded();
    await testBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(2500);

    log('test-connectivity', testCalls.length > 0 ? 'low' : 'medium',
      `Llamadas /test: ${testCalls.length}, status=${testCalls[0]?.status}, code=${testCalls[0]?.code}`);

    await page.screenshot({ path: path.join(SCREENS, '05-test-connectivity.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 6. Click tarjeta -> modal detalle
  // -------------------------------------------------------------------------
  test('6. Click tarjeta integracion abre modal detalle', async ({ page }) => {
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(3500);

    // Click en h3 AEAT (dentro del card)
    const card = page.locator('h3:has-text("AEAT")').first();
    await card.click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    const modalTitle = await page.locator('h2:has-text("AEAT")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('modal-title', modalTitle ? 'low' : 'medium', `Modal con titulo "AEAT - ..." visible: ${modalTitle}`);

    const conexionBlock = await page.locator('text=/Estado de Conexion/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('modal-conexion', conexionBlock ? 'low' : 'medium', `Bloque "Estado de Conexion" visible: ${conexionBlock}`);

    const ultimaVerif = await page.locator('text=/Ultima Verificacion/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('modal-timestamp', ultimaVerif ? 'low' : 'medium', `Etiqueta "Ultima Verificacion" visible: ${ultimaVerif}`);

    await page.screenshot({ path: path.join(SCREENS, '06-modal-aeat-detail.png'), fullPage: true });

    // Cerrar modal
    await page.locator('h2:has-text("AEAT")').locator('..').locator('button').first().click().catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 7. Tab VUA: servicios + autoridades
  // -------------------------------------------------------------------------
  test('7. Tab VUA - servicios y autoridades', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(2500);

    const vuaCalls = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/integrations\/vua\/(services|authorities)/)) {
        try { vuaCalls.push({ url: r.url(), status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("VUA")').first().click({ timeout: 3000 });
    await page.waitForTimeout(3500);

    const heading = await page.locator('text=/Ventanilla Unica Aduanera/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('vua-heading', heading ? 'low' : 'medium', `Heading VUA visible: ${heading}`);

    const servicios = await page.locator('text=/Servicios Disponibles/').first().isVisible({ timeout: 2000 }).catch(() => false);
    const autoridades = await page.locator('text=/Autoridades Conectadas/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('vua-sections', servicios && autoridades ? 'low' : 'medium', `Servicios=${servicios}, Autoridades=${autoridades}`);

    const services = vuaCalls.find(c => c.url.includes('services'))?.body?.data || [];
    const authorities = vuaCalls.find(c => c.url.includes('authorities'))?.body?.data || [];
    log('vua-data', services.length > 0 && authorities.length > 0 ? 'low' : 'medium',
      `Services API count=${services.length}, Authorities API count=${authorities.length}`);

    await page.screenshot({ path: path.join(SCREENS, '07-vua-panel.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 8. Tab TRACES: CHED types + BCPs
  // -------------------------------------------------------------------------
  test('8. Tab TRACES - tipos CHED y BCPs', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(2500);

    const tracesCalls = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/integrations\/traces\/(ched-types|bcps)/)) {
        try { tracesCalls.push({ url: r.url(), status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("TRACES")').first().click({ timeout: 3000 });
    await page.waitForTimeout(3500);

    const heading = await page.locator('text=/TRACES NT/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('traces-heading', heading ? 'low' : 'medium', `Heading TRACES NT visible: ${heading}`);

    const tipos = await page.locator('text=/Tipos de CHED/').first().isVisible({ timeout: 2000 }).catch(() => false);
    const bcps = await page.locator('text=/Puntos de Control Fronterizo/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('traces-sections', tipos && bcps ? 'low' : 'medium', `Tipos CHED=${tipos}, BCPs=${bcps}`);

    const ched = tracesCalls.find(c => c.url.includes('ched-types'))?.body?.data || [];
    const bcpsApi = tracesCalls.find(c => c.url.includes('bcps'))?.body?.data || [];
    log('traces-data', ched.length > 0 && bcpsApi.length > 0 ? 'low' : 'medium',
      `CHED types=${ched.length}, BCPs=${bcpsApi.length}`);

    await page.screenshot({ path: path.join(SCREENS, '08-traces-panel.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 9. Tab NCTS: tipos transito + tipos garantia + aduanas
  // -------------------------------------------------------------------------
  test('9. Tab NCTS - tipos transito, garantia y aduanas', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(2500);

    const nctsCalls = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/integrations\/ncts\/(transit-types|guarantee-types|offices)/)) {
        try { nctsCalls.push({ url: r.url(), status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("NCTS")').first().click({ timeout: 3000 });
    await page.waitForTimeout(3500);

    const heading = await page.locator('text=/NCTS Phase 5/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('ncts-heading', heading ? 'low' : 'medium', `Heading NCTS Phase 5 visible: ${heading}`);

    const transit = await page.locator('text=/Tipos de Transito/').first().isVisible({ timeout: 2000 }).catch(() => false);
    const guarantee = await page.locator('text=/Tipos de Garantia/').first().isVisible({ timeout: 2000 }).catch(() => false);
    const aduanas = await page.locator('text=/Aduanas de Salida/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('ncts-sections', transit && guarantee && aduanas ? 'low' : 'medium',
      `Transit=${transit}, Guarantee=${guarantee}, Aduanas=${aduanas}`);

    const tt = nctsCalls.find(c => c.url.includes('transit-types'))?.body?.data || [];
    const gt = nctsCalls.find(c => c.url.includes('guarantee-types'))?.body?.data || [];
    const off = nctsCalls.find(c => c.url.includes('offices'))?.body?.data || {};
    log('ncts-data', tt.length > 0 && gt.length > 0 ? 'low' : 'medium',
      `TransitTypes=${tt.length}, GuaranteeTypes=${gt.length}, OfficesDeparture=${off.departure?.length || 0}`);

    await page.screenshot({ path: path.join(SCREENS, '09-ncts-panel.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 10. Refresh button volver a Dashboard
  // -------------------------------------------------------------------------
  test('10. Boton Refresh y volver a Dashboard', async ({ page }) => {
    await gotoApp(page, '/integrations');
    await page.waitForTimeout(3000);

    // Volver a Dashboard
    await page.locator('button:has-text("Dashboard")').first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    const reloadCalls = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/integrations\/(status|list|stats)/)) {
        reloadCalls.push({ url: r.url(), status: r.status() });
      }
    });

    // Click en boton refresh (icono ArrowPath sin texto, ultimo del grupo)
    const allButtons = page.locator('button');
    const count = await allButtons.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const btn = allButtons.nth(i);
      const txt = await btn.textContent().catch(() => '');
      if (txt.trim() === '') {
        // Posible icono refresh, intentar
        const html = await btn.innerHTML().catch(() => '');
        if (html.includes('arrow') || html.includes('animate-spin') || /\bw-5\b/.test(html)) {
          await btn.click().catch(() => {});
          clicked = true;
          break;
        }
      }
    }
    await page.waitForTimeout(2500);
    log('refresh-btn', clicked ? 'low' : 'medium', `Refresh icon clicked=${clicked}, reloads=${reloadCalls.length}`);

    await page.screenshot({ path: path.join(SCREENS, '10-refresh-dashboard.png'), fullPage: true });
  });

  test.afterAll(async () => {
    fs.writeFileSync(REPORT, JSON.stringify({
      timestamp: new Date().toISOString(),
      total_findings: findings.length,
      critical: findings.filter(f => f.sev === 'critical').length,
      high: findings.filter(f => f.sev === 'high').length,
      medium: findings.filter(f => f.sev === 'medium').length,
      low: findings.filter(f => f.sev === 'low').length,
      findings,
      integrationCodes
    }, null, 2));
  });
});
