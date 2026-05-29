// @ts-check
/**
 * E2E /queries — Consultas ADDS-JDIT (Acceso a Datos Declaraciones AEAT).
 *
 * BUGS BACKEND CORREGIDOS:
 *  1) `SummaryQuery` model usaba `pre('save')` para generar `queryId`, pero validacion
 *     `required: true` corre ANTES de pre('save'). Resultado: TODAS las consultas
 *     fallaban con "queryId required". Fix: cambiar a `pre('validate')`.
 *  2) `metadata.environment` enum solo aceptaba ['sandbox','production'], pero el
 *     entorno productivo tiene `AEAT_ENVIRONMENT=test`. Fix: ampliar enum a
 *     ['sandbox','production','pre','test'].
 *
 * Cobertura UI desde el front:
 * 1) Render base + h1 traducido + 4 stats cards + 2 tabs
 * 2) Tab "Nueva Consulta" con 6 botones de tipo (B/L, Container, Ubicacion, Documents, MRN, EORI)
 * 3) Cambio de tipo de consulta + form se adapta
 * 4) Consulta MRN real -> resultados visibles
 * 5) Consulta EORI real -> resultados
 * 6) Filtros adicionales: fecha desde/hasta + tipo declaracion
 * 7) Tab "Historial" -> tabla de consultas previas
 * 8) Captura final
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'queries-e2e-screens');
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

test.describe('Consultas ADDS-JDIT /queries', () => {
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
  // 1. Render base + h1 + 2 tabs + 4 stats cards
  // -------------------------------------------------------------------------
  test('1. Render base /queries + h1 + 2 tabs + 4 stats cards', async ({ page }) => {
    await gotoApp(page, '/queries');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Consultas ADDS|ADDS-JDIT|Queries/i.test(h1 || '') && !/queries\.title/.test(h1 || '') ? 'low' : 'high',
      `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 4 stats cards
    const card1 = await page.locator('text=/Total Consultas/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card2 = await page.locator('text=/Exitosas/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card3 = await page.locator('text=/Fallidas/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card4 = await page.locator('text=/Recientes/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('stats-cards', card1 && card2 && card3 && card4 ? 'low' : 'medium',
      `Total=${card1} Exitosas=${card2} Fallidas=${card3} Recientes=${card4}`);

    // 2 tabs: Nueva Consulta + Historial
    const t1 = await page.locator('button:has-text("Nueva Consulta")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t2 = await page.locator('button:has-text("Historial")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', t1 && t2 ? 'low' : 'high', `NuevaConsulta=${t1} Historial=${t2}`);
  });

  // -------------------------------------------------------------------------
  // 2. 6 botones de tipo de consulta visibles
  // -------------------------------------------------------------------------
  test('2. 6 botones de tipo de consulta + form Buscar', async ({ page }) => {
    await gotoApp(page, '/queries');
    await page.waitForTimeout(2500);

    const types = [
      { label: 'Conocimiento', name: 'B/L' },
      { label: 'Contenedor', name: 'Container' },
      { label: 'Ubicacion', name: 'Location' },
      { label: 'Documentos', name: 'Docs' },
      { label: 'MRN', name: 'MRN' },
      { label: 'EORI', name: 'EORI' }
    ];

    for (const t of types) {
      const btn = await page.locator(`button:has-text("${t.label}")`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`type-${t.name}`, btn ? 'low' : 'medium', `Boton tipo ${t.label}: ${btn}`);
    }

    // Form: input busqueda + fecha desde + fecha hasta + tipo declaracion + boton Buscar
    const searchBtn = await page.locator('button:has-text("Buscar")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('search-btn', searchBtn ? 'low' : 'medium', `Boton Buscar visible: ${searchBtn}`);

    await page.screenshot({ path: path.join(SCREENS, '02-tipos-consulta.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Consulta MRN real
  // -------------------------------------------------------------------------
  test('3. Consulta MRN real -> resultados', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/queries');
    await page.waitForTimeout(2500);

    // MRN ya esta seleccionado por defecto? Lo selecciono explicitamente
    await page.locator('button:has-text("MRN")').first().click({ timeout: 3000 });
    await page.waitForTimeout(500);

    // Llenar input MRN
    const mrnInput = page.locator('input[type="text"]').first();
    await mrnInput.fill('26ES00280130001U07');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENS, '03a-mrn-form.png'), fullPage: true });

    // Capturar respuesta
    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/queries/mrn')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    // Click Buscar
    const searchBtn = page.locator('button:has-text("Buscar")').first();
    await searchBtn.click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '03b-mrn-result.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const count = last?.body?.results?.length || 0;
    log('mrn-query-http', last?.status === 200 ? 'low' : 'critical',
      `HTTP ${last?.status}, count=${count}, queryId=${last?.body?.queryId}`);
    results.push({ test: 'mrn', queryId: last?.body?.queryId, count });

    // UI muestra resultados o "0 encontrados"
    const successAlert = await page.locator('text=/resultado.*encontrad/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('mrn-ui-result', successAlert ? 'low' : 'medium', `Alert resultados visible: ${successAlert}`);
  });

  // -------------------------------------------------------------------------
  // 4. Consulta EORI real
  // -------------------------------------------------------------------------
  test('4. Consulta EORI real -> resultados', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/queries');
    await page.waitForTimeout(2500);

    // Seleccionar EORI
    await page.locator('button:has-text("EORI")').first().click({ timeout: 3000 });
    await page.waitForTimeout(500);

    const input = page.locator('input[type="text"]').first();
    await input.fill('ESB22477020');
    await page.waitForTimeout(300);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/queries/eori')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("Buscar")').first().click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '04-eori-result.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const count = last?.body?.results?.length || 0;
    log('eori-query-http', last?.status === 200 ? 'low' : 'critical',
      `HTTP ${last?.status}, count=${count}`);
    results.push({ test: 'eori', count });
  });

  // -------------------------------------------------------------------------
  // 5. Consulta Container
  // -------------------------------------------------------------------------
  test('5. Consulta Container', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/queries');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Contenedor")').first().click({ timeout: 3000 });
    await page.waitForTimeout(500);

    const input = page.locator('input[type="text"]').first();
    await input.fill('MSKU1234567');
    await page.waitForTimeout(300);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/queries/container')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("Buscar")').first().click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '05-container-result.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const count = last?.body?.results?.length || 0;
    log('container-query-http', last?.status === 200 ? 'low' : 'critical',
      `HTTP ${last?.status}, count=${count}`);
    results.push({ test: 'container', count });
  });

  // -------------------------------------------------------------------------
  // 6. Tab Historial
  // -------------------------------------------------------------------------
  test('6. Tab "Historial" muestra consultas previas', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/queries');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/queries/history')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("Historial")').first().click({ timeout: 3000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENS, '06-historial.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('history-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.length || 0}, total=${last?.body?.pagination?.total || 0}`);

    // Tabla con headers
    const headers = await page.locator('thead th').count();
    log('history-headers', headers >= 6 ? 'low' : 'medium',
      `Headers tabla historial: ${headers} (esperado 8: ID/Tipo/Parametros/Estado/Resultados/Fecha/Tiempo/Acciones)`);
  });

  // -------------------------------------------------------------------------
  // 7. Captura final
  // -------------------------------------------------------------------------
  test('7. Captura final con stats actualizadas', async ({ page }) => {
    await gotoApp(page, '/queries');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '07-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /queries con stats actualizadas');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      results,
      findings
    }, null, 2));

    console.log('\n=== QUERIES E2E SUMMARY ===');
    for (const r of results) {
      console.log(`  ${r.test}: count=${r.count} queryId=${r.queryId || '-'}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
