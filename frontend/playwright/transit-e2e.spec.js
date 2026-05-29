// @ts-check
/**
 * E2E /transit — Transitos NCTS (T1/T2/T2F/TIR).
 *
 * Cobertura UI desde el front:
 * 1) Render base + h1 traducido + 4 stats cards + filtros (tipo + estado)
 * 2) Lista de transitos del tenant (15 esperados)
 * 3) Filtros tipo y estado
 * 4) Boton "Nuevo Transito" -> form de creacion
 * 5) Click sobre fila -> detail con TransitAIPanel
 * 6) Asistente IA: 4 tabs (Validar Ruta / Predecir Incidencias / Sugerir Garantia / Analisis Completo)
 * 7) Captura final
 *
 * NCTS desbloqueado el 24/Abr/2026 con MRN real `26ES002801500473J5` (memoria).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'transit-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let firstTransitId = null;
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

test.describe('Transitos NCTS /transit', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status()).toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;

    // Capturar primer transit id para tests detail/IA
    const list = await request.get('/api/transit?limit=1', { headers: { Authorization: `Bearer ${token}` } });
    const lbody = await list.json().catch(() => ({}));
    firstTransitId = lbody?.data?.transits?.[0]?._id || lbody?.data?.[0]?._id;
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
  test('1. Render base /transit + h1 + boton Nuevo + filtros', async ({ page }) => {
    await gotoApp(page, '/transit');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Transitos NCTS|Transit/i.test(h1 || '') && !/transit\.title/.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Boton Nuevo Transito
    const newBtn = await page.locator('button').filter({ hasText: /Nuevo Transito|New Transit/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('new-btn', newBtn ? 'low' : 'medium', `Boton Nuevo Transito visible: ${newBtn}`);

    // Stats cards: 4 esperados
    const statsCount = await page.locator('text=/Total|Activos|En Transito|Completados|Borradores/i').count();
    log('stats-cards', statsCount >= 3 ? 'low' : 'medium', `Stats labels visibles: ${statsCount}`);

    // Filtros: 2 selects (tipo + estado)
    const filterSelects = await page.locator('select').count();
    log('filter-selects', filterSelects >= 2 ? 'low' : 'medium', `Selects filtros: ${filterSelects}`);
  });

  // -------------------------------------------------------------------------
  // 2. Lista de transitos del tenant
  // -------------------------------------------------------------------------
  test('2. Lista con transitos del tenant', async ({ page }) => {
    await gotoApp(page, '/transit');
    await page.waitForTimeout(3000);

    // Tabla con filas o cards
    const rows = await page.locator('tbody tr, .card, [class*="border-t"]').count();
    log('list-rows', 'low', `Filas/cards en lista: ${rows}`);

    // Verificar referencias NCTS-* visibles
    const nctsRef = await page.locator('text=/NCTS-/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('ncts-refs', nctsRef ? 'low' : 'medium', `Referencias NCTS-* visibles: ${nctsRef}`);

    // Verificar tipos T1 visibles
    const t1Visible = await page.locator('text=/^T1$/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('t1-badges', t1Visible ? 'low' : 'medium', `Badges T1 visibles: ${t1Visible}`);

    await page.screenshot({ path: path.join(SCREENS, '02-list-transits.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Filtro por tipo T1
  // -------------------------------------------------------------------------
  test('3. Filtro por tipo T1', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/transit');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/transit(\?|$)/)) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const typeSelect = page.locator('select').first();
    await typeSelect.selectOption('T1').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '03-filter-T1.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const count = last?.body?.data?.transits?.length || last?.body?.data?.length || 0;
    log('filter-T1', last?.status === 200 ? 'low' : 'medium', `HTTP ${last?.status}, count=${count}`);
  });

  // -------------------------------------------------------------------------
  // 4. Filtro por estado draft
  // -------------------------------------------------------------------------
  test('4. Filtro por estado draft', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/transit');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/transit(\?|$)/)) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const statusSelect = page.locator('select').nth(1);
    await statusSelect.selectOption('draft').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '04-filter-status.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const count = last?.body?.data?.transits?.length || last?.body?.data?.length || 0;
    log('filter-status', last?.status === 200 ? 'low' : 'medium', `HTTP ${last?.status}, count=${count}`);
  });

  // -------------------------------------------------------------------------
  // 5. Boton "Nuevo Transito" abre form
  // -------------------------------------------------------------------------
  test('5. Boton "Nuevo Transito" abre form de creacion', async ({ page }) => {
    await gotoApp(page, '/transit');
    await page.waitForTimeout(2500);

    const newBtn = page.locator('button').filter({ hasText: /Nuevo Transito|New Transit/i }).first();
    await newBtn.click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '05-form-nuevo.png'), fullPage: true });

    const form = await page.locator('text=/Nuevo Transito|tipo.*transito|principal|departure|destination/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('new-form', form ? 'low' : 'medium', `Form Nuevo Transito visible: ${form}`);
  });

  // -------------------------------------------------------------------------
  // 6. Detail + Asistente IA
  // -------------------------------------------------------------------------
  test('6. Click sobre fila -> detail + Asistente IA visible', async ({ page }) => {
    test.setTimeout(60_000);
    if (!firstTransitId) {
      log('detail-skipped', 'medium', 'No hay transit para abrir detail');
      return;
    }

    await gotoApp(page, '/transit');
    await page.waitForTimeout(3000);

    // Click sobre primer ChevronDown o expand para abrir detail
    const expandBtn = page.locator('button:has(svg)').first();
    // Mejor: click sobre la primera referencia
    const firstRef = page.locator('text=/NCTS-/').first();
    if (await firstRef.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRef.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(SCREENS, '06-detail.png'), fullPage: true });

    // Buscar boton IA o chevron
    const aiBtn = page.locator('button').filter({ hasText: /IA|AI|Sparkles|Asistente/i }).first();
    const aiVisible = await aiBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log('ai-btn', aiVisible ? 'low' : 'medium', `Boton IA/Asistente visible: ${aiVisible}`);
  });

  // -------------------------------------------------------------------------
  // 7. Asistente IA: abrir panel y probar 4 tabs
  // -------------------------------------------------------------------------
  test('7. Asistente IA - 4 tabs (Validar Ruta/Incidencias/Garantia/Completo)', async ({ page }) => {
    test.setTimeout(180_000);
    if (!firstTransitId) {
      log('ai-skipped', 'medium', 'No hay transit');
      return;
    }

    await gotoApp(page, '/transit');
    await page.waitForTimeout(3000);

    // Expandir primera fila + buscar boton IA
    const firstRef = page.locator('text=/NCTS-/').first();
    if (await firstRef.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRef.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }

    // Buscar y click sobre boton IA / SparklesIcon / Asistente
    const aiTriggers = await page.locator('button').filter({ hasText: /IA|AI|Asistente|Sparkles/i }).all();
    let aiPanelOpened = false;
    for (const btn of aiTriggers) {
      try {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(1500);
        const panel = await page.locator('text=/Validar Ruta|Predecir Incidencias|Sugerir Garantia|Analisis Completo/i').first().isVisible({ timeout: 3000 }).catch(() => false);
        if (panel) { aiPanelOpened = true; break; }
      } catch (e) {}
    }
    log('ai-panel-opened', aiPanelOpened ? 'low' : 'medium', `Panel IA abierto: ${aiPanelOpened}`);
    await page.screenshot({ path: path.join(SCREENS, '07a-ai-panel.png'), fullPage: true });

    // Probar tab "Validar Ruta"
    const validateTab = page.locator('button:has-text("Validar Ruta")').first();
    if (await validateTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await validateTab.click({ timeout: 3000 });
      await page.waitForTimeout(1500);

      // Boton Analizar dentro de la tab
      const analyzeBtn = page.locator('button').filter({ hasText: /Analizar|Validar|Ejecutar/i }).first();
      if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await analyzeBtn.click({ timeout: 5000 });
        await page.waitForTimeout(20000);
        await page.screenshot({ path: path.join(SCREENS, '07b-ai-validate.png'), fullPage: true });
        log('ai-validate', 'low', 'Tab Validar Ruta ejecutado');
      }
    }

    // Tab "Predecir Incidencias"
    const incidentsTab = page.locator('button:has-text("Predecir Incidencias")').first();
    if (await incidentsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await incidentsTab.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '07c-ai-incidents.png'), fullPage: true });
      log('ai-incidents-tab', 'low', 'Tab Predecir Incidencias visible');
    }

    // Tab "Sugerir Garantia"
    const guaranteeTab = page.locator('button:has-text("Sugerir Garantia")').first();
    if (await guaranteeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await guaranteeTab.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '07d-ai-guarantee.png'), fullPage: true });
      log('ai-guarantee-tab', 'low', 'Tab Sugerir Garantia visible');
    }

    // Tab "Analisis Completo"
    const fullTab = page.locator('button:has-text("Analisis Completo")').first();
    if (await fullTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fullTab.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '07e-ai-full.png'), fullPage: true });
      log('ai-full-tab', 'low', 'Tab Analisis Completo visible');
    }
  });

  // -------------------------------------------------------------------------
  // 8. Captura final
  // -------------------------------------------------------------------------
  test('8. Captura final con lista completa', async ({ page }) => {
    await gotoApp(page, '/transit');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '08-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /transit');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      firstTransitId,
      findings
    }, null, 2));

    console.log('\n=== TRANSIT E2E SUMMARY ===');
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
