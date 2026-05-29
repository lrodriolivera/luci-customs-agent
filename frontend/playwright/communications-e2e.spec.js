// @ts-check
/**
 * E2E /communications — Comunicaciones con Inspectores.
 *
 * Cobertura UI desde el front:
 * 1) Render base + 3 tabs (Dashboard / Todas / Recursos) + h1 traducido
 * 2) Dashboard: 4 stats cards (Pendientes / Vencidos / Pte. Respuesta / Recursos Activos)
 *    + listas Recientes + Plazos Pendientes + Recursos Activos + Por Categoria + Por Estado
 * 3) Tab Todas: filtros (status, category, type) + tabla con filas + acciones
 * 4) Filtro por status
 * 5) Filtro por category
 * 6) Tab Recursos: lista de recursos administrativos (8 esperados)
 * 7) Boton "Nueva Comunicacion" abre modal
 * 8) Captura final
 *
 * NOTA: claves i18n verificadas — communications.title/subtitle/newCommunication SI existen en root.
 * Sin bug de literal i18n a corregir (a diferencia de /inspections o /deadlines).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'communications-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Comunicaciones con Inspectores /communications', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status()).toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;
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
  // 1. Render base + 3 tabs + h1 traducido
  // -------------------------------------------------------------------------
  test('1. Render base /communications + 3 tabs + h1 traducido', async ({ page }) => {
    await gotoApp(page, '/communications');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Comunicaciones|Communications/i.test(h1 || '') && !/communications\.title/.test(h1 || '') ? 'low' : 'high',
      `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 3 tabs: Dashboard / Todas / Recursos
    const t1 = await page.locator('button:has-text("Dashboard")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t2 = await page.locator('button:has-text("Todas"):not(:has-text("aduana"))').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t3 = await page.locator('button:has-text("Recursos")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', t1 && t2 && t3 ? 'low' : 'high', `Dashboard=${t1} Todas=${t2} Recursos=${t3}`);

    // Header buttons: Nueva Comunicacion + Refresh
    const newBtn = await page.locator('button').filter({ hasText: /Nueva Comunicac|New Communication/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('new-btn', newBtn ? 'low' : 'medium', `Boton Nueva Comunicacion visible: ${newBtn}`);
  });

  // -------------------------------------------------------------------------
  // 2. Dashboard: stats cards + listas + por categoria/estado
  // -------------------------------------------------------------------------
  test('2. Dashboard: 4 stats cards + agrupaciones', async ({ page }) => {
    await gotoApp(page, '/communications');
    await page.waitForTimeout(3000);

    // 4 stats cards: Pendientes / Vencidos / Pte. Respuesta / Recursos
    const card1 = await page.locator('text=/Pendientes/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card2 = await page.locator('text=/Vencidos/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card3 = await page.locator('text=/Esperando Respuesta|Pte.*Respuesta/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card4 = await page.locator('text=/Recursos/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('stats-cards', card1 && card2 && card3 && card4 ? 'low' : 'medium',
      `Pendientes=${card1} Vencidos=${card2} PteResp=${card3} Recursos=${card4}`);

    // Dashboard tiene secciones Por Categoria y Por Estado
    const porCategoria = await page.locator('text=/Por Categor/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('por-categoria', porCategoria ? 'low' : 'medium', `Por Categoria: ${porCategoria}`);

    const porEstado = await page.locator('text=/Por Estado/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('por-estado', porEstado ? 'low' : 'medium', `Por Estado: ${porEstado}`);

    await page.screenshot({ path: path.join(SCREENS, '02-dashboard-stats.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab "Todas" - tabla con filtros
  // -------------------------------------------------------------------------
  test('3. Tab "Todas" + tabla con filtros', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/communications');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Todas"):not(:has-text("aduana"))').first().click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '03-tab-todas.png'), fullPage: true });

    // 3 selects de filtros: status / category / type
    const filtersSelects = await page.locator('select').count();
    log('filters-selects', filtersSelects >= 3 ? 'low' : 'medium',
      `Selects de filtros: ${filtersSelects} (esperado 3: status + category + type)`);

    // Tabla con headers
    const headers = await page.locator('thead th').count();
    log('table-headers', headers >= 5 ? 'low' : 'medium',
      `Headers tabla: ${headers} (esperado 6: Comunicacion / Tipo / Autoridad / Plazo / Estado / Acciones)`);

    const rows = await page.locator('tbody tr').count();
    log('table-rows', rows >= 1 ? 'low' : 'medium', `Filas tabla: ${rows}`);

    // Boton Limpiar filtros
    const limpiar = await page.locator('button:has-text("Limpiar")').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('limpiar-btn', limpiar ? 'low' : 'medium', `Boton Limpiar: ${limpiar}`);
  });

  // -------------------------------------------------------------------------
  // 4. Filtro por status "sent"
  // -------------------------------------------------------------------------
  test('4. Filtro por status "sent"', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/communications');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Todas"):not(:has-text("aduana"))').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/communications(\?|$)/)) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('sent').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '04-filter-sent.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('filter-status-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.communications?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 5. Filtro por category "appeal"
  // -------------------------------------------------------------------------
  test('5. Filtro por category "appeal"', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/communications');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Todas"):not(:has-text("aduana"))').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/communications(\?|$)/)) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const catSelect = page.locator('select').nth(1);
    await catSelect.selectOption('appeal').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '05-filter-appeal.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('filter-cat-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.communications?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 6. Tab "Recursos"
  // -------------------------------------------------------------------------
  test('6. Tab "Recursos" - lista recursos administrativos', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/communications');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/communications/appeals')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("Recursos")').first().click({ timeout: 3000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENS, '06-tab-recursos.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('tab-appeals-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.length || 0} (esperado ~8)`);
  });

  // -------------------------------------------------------------------------
  // 7. Boton "Nueva Comunicacion" abre modal
  // -------------------------------------------------------------------------
  test('7. Boton "Nueva Comunicacion" abre modal Crear', async ({ page }) => {
    await gotoApp(page, '/communications');
    await page.waitForTimeout(2500);

    const newBtn = page.locator('button').filter({ hasText: /Nueva Comunicac|New Communication/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '07-modal-crear.png'), fullPage: true });

      const modalTitle = await page.locator('text=/Nueva Comunicac|Crear Comunic|New Communication/i').count();
      log('create-modal', modalTitle >= 1 ? 'low' : 'medium', `Modal crear visible (matches=${modalTitle})`);

      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  });

  // -------------------------------------------------------------------------
  // 8. Captura final con dashboard completo
  // -------------------------------------------------------------------------
  test('8. Captura final con dashboard completo', async ({ page }) => {
    await gotoApp(page, '/communications');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '08-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /communications');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      findings
    }, null, 2));

    console.log('\n=== COMMUNICATIONS E2E SUMMARY ===');
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
