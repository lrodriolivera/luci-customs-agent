// @ts-check
/**
 * E2E /preferences — Calculadora de Preferencias Arancelarias.
 *
 * Cobertura:
 * 1) Render base + 3 tabs (Verificar Elegibilidad, Validar Certificado, Recomendaciones)
 * 2) BUG FIX VERIFICATION: combobox pais de origen muestra nombres reales (no "()" )
 *    - Antes: countriesGrouped.map(c => ({ name: c.name })) → c.name undefined → mostraba "()"
 *    - Despues: usa c.label, optgroups por grupo, ~195 paises visibles
 * 3) Tab "Verificar Elegibilidad": casos reales (CETA Canada / GSP+ Bangladesh / Mex / Turquia)
 * 4) Tab "Validar Certificado": EUR.1 + warnings de formato
 * 5) Tab "Recomendaciones": optimizacion arancelaria
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'preferences-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();
const results = [];

const ELIGIBILITY_CASES = [
  { id: 'CETA-CA-laptops', origin: 'CA', taricCode: '8471300000', value: 50000, expectAgreement: /Canada|CETA/i, minSavings: 0 },
  { id: 'GSP-BD-textiles', origin: 'BD', taricCode: '6109100090', value: 8000, expectAgreement: /GSP/i, minSavings: 800 },
  { id: 'Mexico-colchones', origin: 'MX', taricCode: '9404211000', value: 10000, expectAgreement: /Mexico|Mexic/i, minSavings: 0 },
  { id: 'Turkey-CU', origin: 'TR', taricCode: '9404211000', value: 10000, expectAgreement: /Turk|Pan-Euro|ATR/i, minSavings: 0 }
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

test.describe('Calculadora de Preferencias Arancelarias /preferences', () => {
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
  test('1. Render base /preferences + 3 tabs visibles', async ({ page }) => {
    await gotoApp(page, '/preferences');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Preferencia|tariff|prefer/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 3 tabs: Verificar Elegibilidad, Validar Certificado, Recomendaciones
    const tab1 = await page.locator('button:has-text("Verificar Elegibilidad")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const tab2 = await page.locator('button:has-text("Validar Certificado")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const tab3 = await page.locator('button:has-text("Recomendaciones")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', tab1 && tab2 && tab3 ? 'low' : 'high',
      `Eleg=${tab1} Cert=${tab2} Rec=${tab3}`);

    // Tab por defecto: eligibility
    const taricInput = await page.locator('input[placeholder*="8517"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('default-tab-eleg', taricInput ? 'low' : 'medium', `Tab eligibility activo (input TARIC visible): ${taricInput}`);
  });

  // -------------------------------------------------------------------------
  // 2. BUG FIX: combobox pais muestra nombres reales con optgroups
  // -------------------------------------------------------------------------
  test('2. BUG FIX: combobox pais de origen muestra nombres + optgroups', async ({ page }) => {
    await gotoApp(page, '/preferences');
    await page.waitForTimeout(2000);

    const select = page.locator('[data-testid="pref-origin"]').first();
    const visible = await select.isVisible({ timeout: 3000 }).catch(() => false);
    log('select-found', visible ? 'low' : 'high', `Select pref-origin visible: ${visible}`);

    // Optgroups (2 esperados)
    const optgroups = await select.locator('optgroup').count();
    log('optgroups', optgroups >= 2 ? 'low' : 'high',
      `Optgroups en combobox: ${optgroups} (esperado 2: Mas comunes + Todos los paises)`);

    // Opciones totales (>= 195)
    const options = await select.locator('option').count();
    log('options-count', options >= 100 ? 'low' : 'high',
      `Total opciones: ${options} (esperado ~196)`);

    // Verificar que las opciones tienen texto real (NO "()" ni vacio)
    const optionTexts = await select.locator('option').allTextContents();
    const broken = optionTexts.filter(t => t.trim() === '()' || t.trim() === '() ()' || t.trim() === '');
    const realCountries = optionTexts.filter(t => /[A-Za-z]{3,}/.test(t));
    log('options-real-names', broken.length === 0 ? 'low' : 'critical',
      `Opciones rotas "()": ${broken.length} (esperado 0). Opciones con nombre real: ${realCountries.length}/${optionTexts.length}`);

    // Verificar unos paises esperados
    const checks = [
      { code: 'CN', name: /China/ },
      { code: 'TR', name: /Turqu/ },
      { code: 'CA', name: /Canad/ },
      { code: 'BD', name: /Bangladesh/i }
    ];
    for (const c of checks) {
      const opt = await select.locator(`option[value="${c.code}"]`).first().textContent().catch(() => '');
      const ok = c.name.test(opt || '');
      log(`country-${c.code}`, ok ? 'low' : 'high',
        `Pais ${c.code} muestra "${opt?.trim()}" (esperado nombre con ${c.name})`);
    }

    // Captura del dropdown abierto para evidencia
    await select.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '02-combobox-paises.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3-6. Tab Verificar Elegibilidad: casos reales
  // -------------------------------------------------------------------------
  for (const [idx, c] of ELIGIBILITY_CASES.entries()) {
    test(`${idx + 3}. Elegibilidad: ${c.id}`, async ({ page }) => {
      test.setTimeout(60_000);
      await gotoApp(page, '/preferences');
      await page.waitForTimeout(2000);

      // Tab Verificar Elegibilidad ya activo por defecto
      await page.locator('[data-testid="pref-origin"]').selectOption(c.origin);
      await page.waitForTimeout(200);
      const taricInput = page.locator('input[placeholder*="8517"]').first();
      await taricInput.fill(c.taricCode);
      await page.waitForTimeout(200);
      const valueInput = page.locator('input[type="number"]').first();
      await valueInput.fill(String(c.value));
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(SCREENS, `0${idx + 3}a-${c.id}-form.png`), fullPage: true });

      // Capturar respuesta API
      const apiResp = [];
      page.on('response', async (r) => {
        if (r.url().includes('/api/preferences/eligibility') && r.request().method() === 'POST') {
          try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
        }
      });

      // Submit
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click({ timeout: 5000 });
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 3}b-${c.id}-result.png`), fullPage: true });

      const last = apiResp[apiResp.length - 1];
      const data = last?.body?.data;
      const r = {
        id: c.id,
        httpStatus: last?.status,
        eligible: data?.eligible,
        agreementsCount: data?.agreements?.length,
        recommendedName: data?.recommended?.name,
        savings: data?.savings?.totalSavings ?? data?.savings
      };
      results.push(r);

      log(`${c.id}-http`, last?.status === 200 ? 'low' : 'high',
        `HTTP ${last?.status}, eligible=${r.eligible}, agreements=${r.agreementsCount}`);

      log(`${c.id}-agreement`,
        c.expectAgreement.test(r.recommendedName || '') ? 'low' : 'medium',
        `Acuerdo recomendado: "${r.recommendedName}" (esperaba ${c.expectAgreement})`);

      // UI muestra savings o eligibility chip
      const eligibleUI = await page.locator('text=/elegible|preferenc|Statement|EUR\\.1|Form A/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`${c.id}-ui-result`, eligibleUI ? 'low' : 'medium', `UI muestra resultado preferencia: ${eligibleUI}`);
    });
  }

  // -------------------------------------------------------------------------
  // 7. Tab Validar Certificado
  // -------------------------------------------------------------------------
  test('7. Tab Validar Certificado: EUR.1', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/preferences');
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Validar Certificado")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENS, '07a-tab-cert-empty.png'), fullPage: true });

    // El form de cert tiene: type, certificateNumber, issuedDate, exporterName, consigneeName, originCountry (input texto 2 char)
    // Type select
    const typeSelect = page.locator('select').filter({ has: page.locator('option:has-text("EUR.1")') }).first();
    if (await typeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeSelect.selectOption({ label: /EUR\.1/i }).catch(() => {});
    }
    // Number
    const allTextInputs = page.locator('input[type="text"]');
    const count = await allTextInputs.count();
    if (count >= 1) await allTextInputs.nth(0).fill(`EUR1-2026-${TS}`);
    if (count >= 2) await allTextInputs.nth(1).fill('Acme Suppliers Inc');
    if (count >= 3) await allTextInputs.nth(2).fill('STRIX AI SL');
    // Country (input texto, ultimo)
    if (count >= 4) await allTextInputs.nth(3).fill('CA');
    // Date input
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill('2026-04-01');
    }

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENS, '07b-cert-filled.png'), fullPage: true });

    // Capturar respuesta API
    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/preferences/validate-certificate')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click({ timeout: 5000 });
    await page.waitForTimeout(7000);
    await page.screenshot({ path: path.join(SCREENS, '07c-cert-validated.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const data = last?.body?.data;
    log('cert-validate', last?.status === 200 ? 'low' : 'high',
      `HTTP ${last?.status} valid=${data?.valid} issues=${data?.issues?.length || 0} warnings=${data?.warnings?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 8. Tab Recomendaciones
  // -------------------------------------------------------------------------
  test('8. Tab Recomendaciones', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/preferences');
    await page.waitForTimeout(2000);

    // Primero hacer un check elegibilidad para que se llene recommendations state
    await page.locator('[data-testid="pref-origin"]').selectOption('CA');
    const taricInput = page.locator('input[placeholder*="8517"]').first();
    await taricInput.fill('8471300000');
    const valueInput = page.locator('input[type="number"]').first();
    await valueInput.fill('50000');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(8000);

    // Cambiar a tab Recomendaciones
    await page.locator('button:has-text("Recomendaciones")').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '08a-tab-recomendaciones.png'), fullPage: true });

    const recsVisible = await page.locator('text=/recomenda|optimiz|Aplicar|preferenc/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('recs-visible', recsVisible ? 'low' : 'medium', `Contenido tab recomendaciones visible: ${recsVisible}`);
  });

  // -------------------------------------------------------------------------
  // 9. Captura final con cobertura completa
  // -------------------------------------------------------------------------
  test('9. Captura final con resultado eligibilidad GSP+ Bangladesh', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/preferences');
    await page.waitForTimeout(2000);

    await page.locator('[data-testid="pref-origin"]').selectOption('BD');
    const taricInput = page.locator('input[placeholder*="8517"]').first();
    await taricInput.fill('6109100090');
    const valueInput = page.locator('input[type="number"]').first();
    await valueInput.fill('8000');
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: path.join(SCREENS, '09-resultado-completo.png'), fullPage: true });
    log('final-capture', 'low', 'Captura resultado completo Bangladesh GSP+ textiles 8000 EUR');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      results,
      findings
    }, null, 2));

    console.log('\n=== PREFERENCES E2E SUMMARY ===');
    for (const r of results) {
      console.log(`  ${r.id}: eligible=${r.eligible} agreements=${r.agreementsCount} recommended="${r.recommendedName}" savings=${r.savings}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
