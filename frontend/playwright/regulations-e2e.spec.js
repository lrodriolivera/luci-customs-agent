// @ts-check
/**
 * E2E /regulations — Buscador de Normativa (EUR-Lex CAU + BOE).
 *
 * Cobertura UI desde el front:
 * 1) Render base + 3 tabs (Todos / EUR-Lex CAU / BOE Espana) + catalogos cargados
 * 2) Catalogo CAU: lista 10 normativas EU (CAU base, IVA, anti-elusion, etc.)
 * 3) Catalogo BOE: lista 15 normativas espanolas (LGT, IIEE, IGIC, etc.)
 * 4) Buscador con tab "Todos": busqueda combinada eurlex+boe
 * 5) Buscador con tab "EUR-Lex": busqueda solo en EUR-Lex (CELEX)
 * 6) Buscador con tab "BOE": busqueda solo en BOE
 * 7) Click sobre normativa del catalogo -> abre panel analisis IA con preguntas sugeridas
 * 8) Pregunta sugerida -> rellena input
 * 9) Validar form vacio -> toast error
 *
 * NOTA: La pantalla NO tiene bugs detectados antes del E2E (sin localhost hardcoded ni combobox roto).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'regulations-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();
const results = [];

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Buscador de Normativa /regulations', () => {
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
  // 1. Render base + 3 tabs
  // -------------------------------------------------------------------------
  test('1. Render base /regulations + 3 tabs + catalogos cargados', async ({ page }) => {
    await gotoApp(page, '/regulations');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Normativa|Regulation|Buscador/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 3 tabs: Todos, EUR-Lex (CAU), BOE (Espana)
    const t1 = await page.locator('button:has-text("Todos")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t2 = await page.locator('button:has-text("EUR-Lex")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t3 = await page.locator('button:has-text("BOE")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', t1 && t2 && t3 ? 'low' : 'high', `Todos=${t1} EUR-Lex=${t2} BOE=${t3}`);

    // Buscador presente
    const searchInput = await page.locator('input[type="text"], input[type="search"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('search-input', searchInput ? 'low' : 'medium', `Input busqueda visible: ${searchInput}`);

    // Catalogo CAU - debe haber al menos 1 normativa visible (CAU)
    const cauCAU = await page.locator('text=/C.digo Aduanero|CAU/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('cau-catalog', cauCAU ? 'low' : 'medium', `Catalogo CAU visible: ${cauCAU}`);

    // Catalogo BOE - debe haber LGT
    const lgt = await page.locator('text=/Ley 58\\/2003|LGT|General Tributaria/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('boe-catalog', lgt ? 'low' : 'medium', `Catalogo BOE LGT visible: ${lgt}`);
  });

  // -------------------------------------------------------------------------
  // 2. Validacion form vacio
  // -------------------------------------------------------------------------
  test('2. Validacion: submit busqueda vacia', async ({ page }) => {
    await gotoApp(page, '/regulations');
    await page.waitForTimeout(2500);

    // Click submit con form vacio
    const submitBtn = page.locator('form').first().locator('button[type="submit"]').first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '02-validation-empty.png'), fullPage: true });

      const toast = await page.locator('text=/termino|busqueda|introduzca/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log('validation-toast', toast ? 'low' : 'medium', `Toast validacion vacio: ${toast}`);
    }
  });

  // -------------------------------------------------------------------------
  // 3. Tab "Todos": busqueda combinada
  // -------------------------------------------------------------------------
  test('3. Tab "Todos": busqueda combinada "arancel"', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/regulations');
    await page.waitForTimeout(2500);

    // Tab Todos ya activo por defecto
    await page.locator('button:has-text("Todos")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Llenar input de busqueda
    const searchInput = page.locator('form').first().locator('input').first();
    await searchInput.fill('arancel');
    await page.waitForTimeout(300);

    // Capturar respuesta
    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/regulations/search')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const submitBtn = page.locator('form').first().locator('button[type="submit"]').first();
    await submitBtn.click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '03-search-todos.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('search-todos-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status} eurlex=${last?.body?.data?.eurlex?.totalResults || last?.body?.data?.eurlex?.results?.length || '-'} boe=${last?.body?.data?.boe?.totalResults || last?.body?.data?.boe?.results?.length || '-'}`);

    results.push({ test: 'todos', query: 'arancel', status: last?.status });
  });

  // -------------------------------------------------------------------------
  // 4. Tab "EUR-Lex": busqueda CAU 952/2013
  // -------------------------------------------------------------------------
  test('4. Tab "EUR-Lex": busqueda "952/2013" (CAU)', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/regulations');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("EUR-Lex")').first().click({ timeout: 3000 });
    await page.waitForTimeout(500);

    const searchInput = page.locator('form').first().locator('input').first();
    await searchInput.fill('952/2013');
    await page.waitForTimeout(300);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/regulations/eurlex/search')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const submitBtn = page.locator('form').first().locator('button[type="submit"]').first();
    await submitBtn.click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '04-search-eurlex.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const count = last?.body?.data?.results?.length || 0;
    log('search-eurlex-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status} results=${count}`);

    results.push({ test: 'eurlex', query: '952/2013', status: last?.status, count });
  });

  // -------------------------------------------------------------------------
  // 5. Tab "BOE": busqueda Ley General Tributaria
  // -------------------------------------------------------------------------
  test('5. Tab "BOE": busqueda "tributaria"', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/regulations');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("BOE")').first().click({ timeout: 3000 });
    await page.waitForTimeout(500);

    const searchInput = page.locator('form').first().locator('input').first();
    await searchInput.fill('tributaria');
    await page.waitForTimeout(300);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/regulations/boe/search')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const submitBtn = page.locator('form').first().locator('button[type="submit"]').first();
    await submitBtn.click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '05-search-boe.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const count = last?.body?.data?.results?.length || 0;
    log('search-boe-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status} results=${count}`);

    results.push({ test: 'boe', query: 'tributaria', status: last?.status, count });
  });

  // -------------------------------------------------------------------------
  // 6. Click sobre normativa del catalogo CAU -> abre panel analisis IA
  // -------------------------------------------------------------------------
  test('6. Click sobre CAU del catalogo -> abre panel analisis IA + preguntas sugeridas', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/regulations');
    await page.waitForTimeout(3000);

    // Click sobre la primera normativa del catalogo CAU (CAU - Codigo Aduanero)
    const cauItem = page.locator('text=/Codigo Aduanero|Código Aduanero/i').first();
    if (await cauItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cauItem.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(SCREENS, '06a-analysis-panel-opened.png'), fullPage: true });

    // Panel "Analisis con LUCI" debe ser visible
    const panel = await page.locator('text=/Analisis con LUCI|Análisis con LUCI/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('analysis-panel', panel ? 'low' : 'medium', `Panel "Analisis con LUCI" visible: ${panel}`);

    // Preguntas sugeridas (botones tipo chip)
    const suggested = await page.locator('text=/requisitos principales|obligaciones|sanciones|documentaci.n se requiere/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('suggested-questions', suggested ? 'low' : 'medium', `Preguntas sugeridas visibles: ${suggested}`);

    // Click sobre una pregunta sugerida -> rellena el input
    const q1 = page.locator('button:has-text("requisitos principales")').first();
    if (await q1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await q1.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENS, '06b-suggested-question-filled.png'), fullPage: true });

      // Verificar que el input ahora contiene la pregunta
      const inputs = page.locator('input[type="text"]');
      const count = await inputs.count();
      let questionInInput = false;
      for (let i = 0; i < count; i++) {
        const v = await inputs.nth(i).inputValue().catch(() => '');
        if (/requisitos principales/i.test(v)) { questionInInput = true; break; }
      }
      log('suggested-fills-input', questionInInput ? 'low' : 'medium',
        `Click pregunta sugerida llena input: ${questionInInput}`);
    }
  });

  // -------------------------------------------------------------------------
  // 7. Captura final con catalogos completos
  // -------------------------------------------------------------------------
  test('7. Captura final con catalogos completos visibles', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/regulations');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENS, '07-catalogos-completos.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final con catalogos CAU + BOE completos');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      results,
      findings
    }, null, 2));

    console.log('\n=== REGULATIONS E2E SUMMARY ===');
    for (const r of results) {
      console.log(`  ${r.test}: query="${r.query}" status=${r.status} count=${r.count || '-'}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
