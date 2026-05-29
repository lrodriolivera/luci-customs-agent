// @ts-check
/**
 * E2E /excise-duties — Calculadora de Impuestos Especiales (SILICIE).
 *
 * Cobertura UI desde el front:
 * 1) Render base: h1, panel SILICIE info, form Detectar
 * 2) Detect TARIC NO sujeto (laptops 8471) -> mensaje "no sujeto"
 * 3) Detect TARIC ALCOHOL (cerveza 2203) -> badge ALCOHOL + form Calcular aparece
 * 4) Calc cerveza 1000L 5% -> 5.50 EUR
 * 5) Detect TARIC TOBACCO (cigarrillos 2402) -> badge TOBACCO + form aparece
 * 6) Calc cigarrillos 100k unidades 5000 EUR -> 18.800 EUR
 * 7) Detect TARIC HYDROCARBONS (diesel 2710) -> badge HIDROCARBONS + form aparece
 * 8) Calc gasolina 10000L -> 3.310 EUR
 * 9) Captura final con resultado completo
 *
 * BUG CORREGIDO: `toast.info()` no existe en react-hot-toast v2 (solo .success/.error/.loading/.custom).
 * Cuando se detectaba un TARIC no sujeto la app crasheaba. Fix: cambiar `toast.info()` -> `toast()`.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'excise-duties-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();
const results = [];

const CASES = [
  { id: 'no-sujeto-laptops', taric: '8471300000', expectSubject: false },
  { id: 'alcohol-cerveza', taric: '2203000010', expectCategory: 'ALCOHOL', expectName: /Alcoh/i,
    calc: { quantity: 1000, alcoholContent: 5, expectedAmount: 5.50 } },
  { id: 'tobacco-cigarrillos', taric: '2402200010', expectCategory: 'TOBACCO', expectName: /Tabaco/i,
    calc: { quantity: 100000, price: 5000, expectedAmount: 18800 } },
  { id: 'hydrocarbons-diesel', taric: '2710192100', expectCategory: 'HYDROCARBONS', expectName: /Hidrocarb/i,
    calc: { quantity: 10000, productType: 'DIESEL', expectedAmount: 3310 } }
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

async function detectTaric(page, taric) {
  // Form Detectar: input TARIC + boton "Detectar Producto"
  const taricInput = page.locator('input[placeholder*="2203"], input[maxlength="10"]').first();
  await taricInput.fill(taric);
  await page.waitForTimeout(200);
  const detectBtn = page.locator('button:has-text("Detectar")').first();
  await detectBtn.click({ timeout: 5000 });
  await page.waitForTimeout(5000);
}

test.describe('Calculadora Impuestos Especiales /excise-duties (SILICIE)', () => {
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
  test('1. Render base /excise-duties', async ({ page }) => {
    await gotoApp(page, '/excise-duties');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Especiales|Excise|SILICIE/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Form 1 "Detectar Producto"
    const detectForm = await page.locator('text=/1\\..*Detectar Producto/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('detect-form', detectForm ? 'low' : 'medium', `Form Detectar visible: ${detectForm}`);

    // Panel SILICIE info
    const silicieInfo = await page.locator('text=/SILICIE|Ley 38\\/1992|EMCS/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('silicie-info', silicieInfo ? 'low' : 'medium', `Panel info SILICIE visible: ${silicieInfo}`);

    // Boton Detectar
    const detectBtn = await page.locator('button:has-text("Detectar")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('detect-btn', detectBtn ? 'low' : 'medium', `Boton Detectar visible: ${detectBtn}`);
  });

  // -------------------------------------------------------------------------
  // 2-9. Casos detect + calc
  // -------------------------------------------------------------------------
  for (const [idx, c] of CASES.entries()) {
    test(`${idx + 2}. ${c.id}: detect + calc`, async ({ page }) => {
      test.setTimeout(80_000);
      await gotoApp(page, '/excise-duties');
      await page.waitForTimeout(2000);

      // Capturar respuestas API
      const apiResp = { detect: null, calc: null };
      page.on('response', async (r) => {
        const u = r.url();
        if (u.includes('/api/excise/detect')) {
          try { apiResp.detect = { status: r.status(), body: await r.json() }; } catch {}
        }
        if (u.includes('/api/excise/calculate')) {
          try { apiResp.calc = { status: r.status(), body: await r.json() }; } catch {}
        }
      });

      // 1. Detectar
      await detectTaric(page, c.taric);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 2}a-${c.id}-detect.png`), fullPage: true });

      const detectData = apiResp.detect?.body?.data;
      log(`${c.id}-detect-http`, apiResp.detect?.status === 200 ? 'low' : 'high',
        `Detect HTTP ${apiResp.detect?.status} subject=${detectData?.subject} category=${detectData?.category || '-'}`);

      // Si no esperamos sujeto, verificar mensaje "no sujeto"
      if (c.expectSubject === false) {
        const noSubject = await page.locator('text=/NO sujeto|no sujeto|no requieren/i').first().isVisible({ timeout: 3000 }).catch(() => false);
        log(`${c.id}-no-subject-ui`, noSubject ? 'low' : 'medium', `UI muestra "no sujeto": ${noSubject}`);
        return;
      }

      // 2. Calcular - el form debe aparecer
      const calcForm = await page.locator('text=/2\\..*Calcular Impuesto/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`${c.id}-calc-form-appears`, calcForm ? 'low' : 'high', `Form Calcular aparece: ${calcForm}`);

      if (!calcForm) return;

      // Llenar campos comunes: cantidad
      const allInputs = page.locator('form').nth(1).locator('input[type="number"]');
      // input[0]: cantidad, input[1]: alcoholContent (alcohol) o price (tabaco)
      await allInputs.nth(0).fill(String(c.calc.quantity));
      await page.waitForTimeout(200);

      if (c.calc.alcoholContent !== undefined) {
        await allInputs.nth(1).fill(String(c.calc.alcoholContent));
        await page.waitForTimeout(200);
      }
      if (c.calc.price !== undefined) {
        await allInputs.nth(1).fill(String(c.calc.price));
        await page.waitForTimeout(200);
      }
      if (c.calc.productType) {
        // Hidrocarburos: select de tipo (gasoil/diesel/etc)
        const typeSelect = page.locator('form').nth(1).locator('select').last();
        await typeSelect.selectOption(c.calc.productType).catch(() => {});
        await page.waitForTimeout(200);
      }

      await page.screenshot({ path: path.join(SCREENS, `0${idx + 2}b-${c.id}-calc-form-filled.png`), fullPage: true });

      // Submit Calcular
      const calcBtn = page.locator('button:has-text("Calcular Impuesto")').first();
      await calcBtn.click({ timeout: 5000 });
      await page.waitForTimeout(7000);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 2}c-${c.id}-result.png`), fullPage: true });

      const calcData = apiResp.calc?.body?.data;
      const r = {
        id: c.id,
        taric: c.taric,
        category: detectData?.category,
        applicable: calcData?.applicable,
        amount: calcData?.amount,
        calculation: calcData?.calculation
      };
      results.push(r);

      log(`${c.id}-calc-http`, apiResp.calc?.status === 200 ? 'low' : 'high',
        `Calc HTTP ${apiResp.calc?.status} amount=${calcData?.amount}`);

      const amountOk = Math.abs((calcData?.amount || 0) - c.calc.expectedAmount) < 1;
      log(`${c.id}-amount-math`, amountOk ? 'low' : 'high',
        `Amount=${calcData?.amount} EUR (esperado ${c.calc.expectedAmount}). Calc: ${calcData?.calculation}`);

      // UI muestra el monto destacado
      const amountInUI = await page.locator(`text=/${(c.calc.expectedAmount).toFixed(2).replace('.', '\\.')}.*EUR/`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`${c.id}-ui-amount`, amountInUI ? 'low' : 'medium', `Amount visible en UI: ${amountInUI}`);
    });
  }

  // -------------------------------------------------------------------------
  // 6. Captura final con cobertura completa
  // -------------------------------------------------------------------------
  test('6. Captura final con resultado tabaco completo', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/excise-duties');
    await page.waitForTimeout(2000);

    // Detect tabaco
    await detectTaric(page, '2402200010');
    await page.waitForTimeout(2000);

    // Calc cigarrillos
    const allInputs = page.locator('form').nth(1).locator('input[type="number"]');
    await allInputs.nth(0).fill('100000');
    await page.waitForTimeout(200);
    await allInputs.nth(1).fill('5000');
    await page.waitForTimeout(200);

    const calcBtn = page.locator('button:has-text("Calcular Impuesto")').first();
    await calcBtn.click();
    await page.waitForTimeout(7000);

    await page.screenshot({ path: path.join(SCREENS, '06-resultado-completo-tabaco.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final tabaco con specific+proportional+minimum');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      results,
      findings
    }, null, 2));

    console.log('\n=== EXCISE-DUTIES E2E SUMMARY ===');
    for (const r of results) {
      console.log(`  ${r.id} (${r.category}): TARIC ${r.taric} -> ${r.amount} EUR`);
      console.log(`    ${r.calculation}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
