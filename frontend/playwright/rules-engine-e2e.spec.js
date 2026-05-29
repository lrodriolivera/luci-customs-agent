// @ts-check
/**
 * E2E /rules-engine — Motor de Reglas Aduaneras (RulesEngineAnalyzer).
 *
 * Cobertura UI desde el front:
 * 1) Render base + estado vacio (panel "Complete el formulario...")
 * 2) Combobox pais origen + destino: 195 paises en optgroups (BUG FIX antes mostraba "()")
 * 3) Tipo operacion (import/export)
 * 4) Productos: agregar/eliminar dinamicamente
 * 5) Submit: caso China laptops -> resultado completo (eligible + impuestos + docs)
 * 6) Submit: caso Bangladesh textiles -> arancel + IVA
 * 7) Submit: caso Turquia colchones -> arancel + IVA
 * 8) Resultado UI muestra cards: Resumen + Impuestos + Documentacion + Recomendaciones + Contingentes
 *
 * BUGS CORREGIDOS:
 * - `fetch('http://localhost:5001/api/rules/analyze')` hardcoded -> usa api service
 * - Combobox paises mostraba "()" (mismo bug que /preferences)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'rules-engine-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();
const results = [];

const ANALYSIS_CASES = [
  { id: 'CN-laptops', origin: 'CN', taricCode: '8471300000', desc: 'Laptops DELL', qty: 50, value: 50000, expectTariff: { min: 0, max: 5000 } },
  { id: 'BD-textiles', origin: 'BD', taricCode: '6109100090', desc: 'Camisetas algodon', qty: 1000, value: 8000, expectTariff: { min: 100, max: 2000 } },
  { id: 'TR-colchones', origin: 'TR', taricCode: '9404211000', desc: 'Colchones espuma', qty: 50, value: 10000, expectTariff: { min: 0, max: 1500 } }
];

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function fillProduct(page, idx, c) {
  // Cada producto tiene 4 inputs: TARIC, descripcion, cantidad, valor
  const productCard = page.locator('.bg-gray-50').nth(idx);
  const inputs = productCard.locator('input');
  await inputs.nth(0).fill(c.taricCode);
  await inputs.nth(1).fill(c.desc);
  await inputs.nth(2).fill(String(c.qty));
  await inputs.nth(3).fill(String(c.value));
  await page.waitForTimeout(200);
}

test.describe('Motor de Reglas Aduaneras /rules-engine', () => {
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
  test('1. Render base /rules-engine + estado vacio', async ({ page }) => {
    await gotoApp(page, '/rules-engine');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Motor.*Reglas|Rules.*Engine|Reglas Aduan/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Form visible: 3 selects (tipo, origen, destino) + 1 producto inicial + boton "Agregar Producto" + boton "Analizar"
    const tipoLabel = await page.locator('text=/Tipo de Operac/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const originLabel = await page.locator('text=/Pa.*s de Origen/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const destLabel = await page.locator('text=/Pa.*s de Destino/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('form-labels', tipoLabel && originLabel && destLabel ? 'low' : 'medium',
      `tipo=${tipoLabel} origen=${originLabel} destino=${destLabel}`);

    const addBtn = await page.locator('button:has-text("Agregar Producto")').first().isVisible({ timeout: 2000 }).catch(() => false);
    const analyzeBtn = await page.locator('button:has-text("Analizar")').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('action-buttons', addBtn && analyzeBtn ? 'low' : 'medium',
      `Agregar=${addBtn} Analizar=${analyzeBtn}`);

    // Estado vacio: panel "Complete el formulario..."
    const emptyState = await page.locator('text=/Complete el formulario|Analizar.*Operac/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('empty-state', emptyState ? 'low' : 'medium', `Estado vacio visible: ${emptyState}`);
  });

  // -------------------------------------------------------------------------
  // 2. BUG FIX: comboboxes de paises con optgroups y nombres
  // -------------------------------------------------------------------------
  test('2. BUG FIX: comboboxes paises muestran nombres con optgroups', async ({ page }) => {
    await gotoApp(page, '/rules-engine');
    await page.waitForTimeout(2000);

    for (const sel of ['rules-origin', 'rules-destination']) {
      const select = page.locator(`[data-testid="${sel}"]`).first();
      const visible = await select.isVisible({ timeout: 3000 }).catch(() => false);
      log(`select-${sel}`, visible ? 'low' : 'high', `Select ${sel} visible: ${visible}`);

      const optgroups = await select.locator('optgroup').count();
      log(`${sel}-optgroups`, optgroups >= 2 ? 'low' : 'high',
        `Optgroups ${sel}: ${optgroups} (esperado 2)`);

      const options = await select.locator('option').count();
      log(`${sel}-options`, options >= 100 ? 'low' : 'high',
        `Total opciones ${sel}: ${options} (esperado ~195)`);

      // Verificar opciones rotas
      const optionTexts = await select.locator('option').allTextContents();
      const broken = optionTexts.filter(t => t.trim() === '()' || t.trim() === '');
      log(`${sel}-broken`, broken.length === 0 ? 'low' : 'critical',
        `Opciones rotas "()" en ${sel}: ${broken.length}`);

      // Spot-check unos paises
      const cn = await select.locator('option[value="CN"]').first().textContent().catch(() => '');
      const tr = await select.locator('option[value="TR"]').first().textContent().catch(() => '');
      log(`${sel}-spotcheck`, /China/.test(cn) && /Turquia|Turqu/.test(tr) ? 'low' : 'high',
        `${sel}: CN="${cn?.trim()}" TR="${tr?.trim()}"`);
    }

    await page.screenshot({ path: path.join(SCREENS, '02-comboboxes-paises.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tipo operacion + Agregar/Eliminar producto dinamicamente
  // -------------------------------------------------------------------------
  test('3. Cambio tipo operacion + agregar/eliminar producto', async ({ page }) => {
    await gotoApp(page, '/rules-engine');
    await page.waitForTimeout(2000);

    // Cambiar a Exportacion
    const tipoSelect = page.locator('select').first();
    await tipoSelect.selectOption('export');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '03a-tipo-export.png'), fullPage: true });

    // Volver a Importacion
    await tipoSelect.selectOption('import');
    await page.waitForTimeout(300);

    // Agregar producto adicional
    const addBtn = page.locator('button:has-text("Agregar Producto")').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const productCount = await page.locator('text=/Producto \\d+/').count();
    log('add-product', productCount >= 2 ? 'low' : 'medium', `Productos tras Agregar: ${productCount}`);

    // Eliminar el segundo producto
    const removeBtn = page.locator('button:has-text("Eliminar")').first();
    if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(500);
      const after = await page.locator('text=/Producto \\d+/').count();
      log('remove-product', after === 1 ? 'low' : 'medium', `Productos tras Eliminar: ${after}`);
    }

    await page.screenshot({ path: path.join(SCREENS, '03b-add-remove.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 4-6. Casos de analisis reales
  // -------------------------------------------------------------------------
  for (const [idx, c] of ANALYSIS_CASES.entries()) {
    test(`${idx + 4}. Analisis: ${c.id}`, async ({ page }) => {
      test.setTimeout(60_000);
      await gotoApp(page, '/rules-engine');
      await page.waitForTimeout(2000);

      // Seleccionar pais origen
      await page.locator('[data-testid="rules-origin"]').selectOption(c.origin);
      await page.waitForTimeout(200);
      // Llenar producto
      await fillProduct(page, 0, c);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 4}a-${c.id}-form.png`), fullPage: true });

      // Capturar respuesta API
      const apiResp = [];
      page.on('response', async (r) => {
        if (r.url().includes('/api/rules/analyze')) {
          try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
        }
      });

      await page.locator('button:has-text("Analizar")').first().click({ timeout: 5000 });
      await page.waitForTimeout(10_000);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 4}b-${c.id}-result.png`), fullPage: true });

      const last = apiResp[apiResp.length - 1];
      const data = last?.body?.data;
      const r = {
        id: c.id,
        httpStatus: last?.status,
        eligible: data?.summary?.eligible,
        alerts: data?.summary?.alerts?.length || 0,
        warnings: data?.summary?.warnings?.length || 0,
        tariff: data?.taxes?.tariff,
        vat: data?.taxes?.vat?.amount,
        total: data?.taxes?.total,
        docs: data?.documentation?.length || 0,
        quotas: data?.quotas?.length || 0,
        recs: data?.summary?.recommendations?.length || 0
      };
      results.push(r);

      log(`${c.id}-http`, last?.status === 200 ? 'low' : 'high',
        `HTTP ${last?.status}, eligible=${r.eligible}, tariff=${r.tariff}, total=${r.total}`);

      log(`${c.id}-tariff-range`,
        r.tariff >= c.expectTariff.min && r.tariff <= c.expectTariff.max ? 'low' : 'medium',
        `Arancel ${r.tariff} EUR (rango esperado ${c.expectTariff.min}-${c.expectTariff.max})`);

      // UI muestra resultados
      const resumenVisible = await page.locator('text=/Resumen.*An.lisis|Operaci.n.*Eleg/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`${c.id}-ui-resumen`, resumenVisible ? 'low' : 'medium', `Resumen visible: ${resumenVisible}`);

      const impuestosVisible = await page.locator('text=/Impuestos|TOTAL/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`${c.id}-ui-impuestos`, impuestosVisible ? 'low' : 'medium', `Impuestos visible: ${impuestosVisible}`);

      const docsVisible = await page.locator('text=/Documentaci.n Requerida/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`${c.id}-ui-docs`, docsVisible ? 'low' : 'medium', `Documentacion visible: ${docsVisible}`);
    });
  }

  // -------------------------------------------------------------------------
  // 7. Captura final con resultado completo
  // -------------------------------------------------------------------------
  test('7. Captura final - Bangladesh textiles analizado', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/rules-engine');
    await page.waitForTimeout(2000);

    await page.locator('[data-testid="rules-origin"]').selectOption('BD');
    await fillProduct(page, 0, ANALYSIS_CASES[1]);
    await page.locator('button:has-text("Analizar")').first().click();
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: path.join(SCREENS, '07-resultado-completo.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final BD textiles con resumen + impuestos + documentacion');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      results,
      findings
    }, null, 2));

    console.log('\n=== RULES-ENGINE E2E SUMMARY ===');
    for (const r of results) {
      console.log(`  ${r.id}: eligible=${r.eligible} tariff=${r.tariff} vat=${r.vat} total=${r.total} docs=${r.docs}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
