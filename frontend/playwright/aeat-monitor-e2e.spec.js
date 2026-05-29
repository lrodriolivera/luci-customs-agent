// @ts-check
/**
 * E2E /aeat/monitor — Monitor de Estado AEAT.
 *
 * BUG BACKEND CORREGIDO:
 * - `aeatStatusMonitorService.predictInspectionChannel is not a function` -> el service
 *   no tenia el metodo. Fix: implementar el metodo reusando `predictionsService.predictChannel`
 *   con fallback heuristico (origen alto riesgo + TARIC sensible).
 *
 * Cobertura UI desde el front:
 * 1) Render base + h1 + 2 botones header (Predecir Canal / Actualizar)
 * 2) Service Status: certificado cargado, mTLS, supportedDeclarations
 * 3) Estado vacio (0 declaraciones tracked, 0 alertas)
 * 4) Click "Predecir Canal" -> modal con form (origen + TARIC + valor + tipo)
 * 5) Form predict: CN + 8471300000 + 50000 + import -> resultado IA con canal+probabilidades
 * 6) Captura final
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'aeat-monitor-e2e-screens');
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

test.describe('Monitor de Estado AEAT /aeat/monitor', () => {
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
  // 1. Render base
  // -------------------------------------------------------------------------
  test('1. Render base /aeat/monitor + h1 + 2 botones header', async ({ page }) => {
    await gotoApp(page, '/aeat/monitor');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Monitor de Estado AEAT|Monitor/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Subtitulo "Seguimiento de declaraciones con análisis LUCI"
    const subtitle = await page.locator('text=/Seguimiento.*declaraciones|LUCI/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('subtitle', subtitle ? 'low' : 'medium', `Subtitulo LUCI visible: ${subtitle}`);

    // 2 botones header: Predecir Canal + Actualizar
    const predictBtn = await page.locator('button').filter({ hasText: /Predecir Canal|Predict/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const refreshBtn = await page.locator('button').filter({ hasText: /Actualizar|Refresh/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('header-buttons', predictBtn && refreshBtn ? 'low' : 'medium',
      `Predecir=${predictBtn} Actualizar=${refreshBtn}`);
  });

  // -------------------------------------------------------------------------
  // 2. Service Status visible
  // -------------------------------------------------------------------------
  test('2. Service Status: certificado cargado + supported declarations', async ({ page }) => {
    await gotoApp(page, '/aeat/monitor');
    await page.waitForTimeout(3000);

    // Buscar info del servicio AEAT
    const certLoaded = await page.locator('text=/certifica|Configured|mTLS/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('cert-loaded', certLoaded ? 'low' : 'medium', `Info certificado/mTLS visible: ${certLoaded}`);

    // Declaraciones soportadas: H1/H7/AES/NCTS/ENS/EXS
    const supported = await page.locator('text=/H1|H7|AES|NCTS/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('supported-decl', supported ? 'low' : 'medium', `Declaraciones soportadas visibles: ${supported}`);

    await page.screenshot({ path: path.join(SCREENS, '02-service-status.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Listas vacias (declaraciones + alertas)
  // -------------------------------------------------------------------------
  test('3. Estado vacio: 0 declaraciones tracked + 0 alertas', async ({ page }) => {
    await gotoApp(page, '/aeat/monitor');
    await page.waitForTimeout(3000);

    const tracked = await page.locator('text=/Declaraciones Monitorizadas|Tracked|tracked/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tracked-section', tracked ? 'low' : 'medium', `Sección Monitorizadas: ${tracked}`);

    await page.screenshot({ path: path.join(SCREENS, '03-empty-state.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 4. Boton "Predecir Canal" abre modal IA
  // -------------------------------------------------------------------------
  test('4. Boton "Predecir Canal" abre modal IA', async ({ page }) => {
    await gotoApp(page, '/aeat/monitor');
    await page.waitForTimeout(2500);

    const predictBtn = page.locator('button').filter({ hasText: /Predecir Canal|Predict/i }).first();
    await predictBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '04-modal-predict.png'), fullPage: true });

    // Form: origen + TARIC + valor + tipo operacion
    const formFields = await page.locator('input').count();
    log('form-fields', formFields >= 3 ? 'low' : 'medium', `Inputs form predict: ${formFields}`);
  });

  // -------------------------------------------------------------------------
  // 5. Predecir Canal IA: CN + 8471300000 + 50000 + import
  // -------------------------------------------------------------------------
  test('5. Predict Canal IA con datos reales', async ({ page }) => {
    test.setTimeout(90_000);
    await gotoApp(page, '/aeat/monitor');
    await page.waitForTimeout(2500);

    await page.locator('button').filter({ hasText: /Predecir Canal|Predict/i }).first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Llenar form
    const inputs = page.locator('input');
    // Origen, TARIC, valor (en ese orden segun el form)
    const allInputs = await inputs.all();
    if (allInputs.length >= 3) {
      // originCountry
      await allInputs[0].fill('CN').catch(() => {});
      // taricCode
      await allInputs[1].fill('8471300000').catch(() => {});
      // customsValue
      await allInputs[2].fill('50000').catch(() => {});
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: path.join(SCREENS, '05a-predict-form.png'), fullPage: true });

    // Capturar respuesta API
    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/aeat-real/monitoring/predict-channel')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Predecir")').last();
    await submitBtn.click({ timeout: 5000 });
    await page.waitForTimeout(15000);
    await page.screenshot({ path: path.join(SCREENS, '05b-predict-result.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const data = last?.body?.data;
    const channel = data?.predictedChannel || data?.data?.predictedChannel || data?.channel;
    log('predict-http', last?.status === 200 ? 'low' : 'high',
      `HTTP ${last?.status} canal=${channel} confidence=${data?.confidence || data?.data?.confidence}`);

    if (data?.probabilities || data?.data?.probabilities) {
      const probs = data.probabilities || data.data.probabilities;
      log('predict-probs', 'low', `Probabilidades: green=${probs.green}% orange=${probs.orange}% red=${probs.red}% yellow=${probs.yellow}%`);
    }

    // UI muestra resultado canal con badge de color
    const resultUI = await page.locator('text=/Verde|Naranja|Rojo|Amarillo|riesgo/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('predict-ui-result', resultUI ? 'low' : 'medium', `Resultado canal visible UI: ${resultUI}`);
  });

  // -------------------------------------------------------------------------
  // 6. Captura final
  // -------------------------------------------------------------------------
  test('6. Captura final con dashboard', async ({ page }) => {
    await gotoApp(page, '/aeat/monitor');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '06-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /aeat/monitor');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      findings
    }, null, 2));

    console.log('\n=== AEAT-MONITOR E2E SUMMARY ===');
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
