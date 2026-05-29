// @ts-check
/**
 * E2E /calculator — Calculadora de Derechos arancelarios.
 *
 * Cobertura:
 * 1) Render base: h1, formulario completo (TARIC, valor, origen, preferencia, incoterm, fecha)
 * 2) Validacion form: submit vacio dispara toast "Complete los campos obligatorios"
 * 3) Calculo MFN colchones TR (TARIC 9404211000, 10000 EUR, origen TR) -> 3.7% + IVA 21%
 * 4) Calculo ITA laptops CN (TARIC 8471300000, 5000 EUR, origen CN) -> 0% + IVA 21%
 * 5) Calculo textiles MFN BD (TARIC 6109100090, 8000 EUR) -> 12%
 * 6) Cambio de incoterm: actualiza panel info incoterm
 * 7) Cambio de preferencia: SPG vs MFN (mismo TARIC, distinto codigo preferencia)
 * 8) Cambio de fecha de importacion (efecto en aranceles estacionales si aplica)
 * 9) Validacion cruzada: comparar resultado UI con cifras esperadas
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'calculator-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();

const results = [];

// Casos de prueba: TARIC + valor + origen + preferencia + esperado
const TEST_CASES = [
  {
    id: 'colchones-TR-MFN',
    label: 'Colchones espuma poliuretano - origen Turquia 10000 EUR (MFN 3.7%)',
    taricCode: '9404211000',
    value: 10000,
    origin: 'TR',
    preference: '100',
    expected: { dutyRate: 3.7, dutyAmount: 370, vatRate: 21, total: 12547.7 }
  },
  {
    id: 'laptops-CN-ITA',
    label: 'Laptops CN 5000 EUR (ITA exento 0%)',
    taricCode: '8471300000',
    value: 5000,
    origin: 'CN',
    preference: '100',
    expected: { dutyRate: 0, dutyAmount: 0, vatRate: 21, total: 6050 }
  },
  {
    id: 'textiles-BD-MFN',
    label: 'Camisetas algodon BD 8000 EUR (MFN 12% textiles erga omnes)',
    taricCode: '6109100090',
    value: 8000,
    origin: 'BD',
    preference: '100',
    expected: { dutyRate: 12, dutyAmount: 960, vatRate: 21, total: 10841.6 }
  }
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

async function fillCalculator(page, c) {
  await page.locator('[data-testid="calc-taric"]').fill(c.taricCode);
  await page.locator('[data-testid="calc-value"]').fill(String(c.value));
  await page.locator('[data-testid="calc-origin"]').selectOption(c.origin);
  // preference: localizar el select que contiene option value="100" (no es calc-origin)
  if (c.preference) {
    // Buscamos selects no-origin y eligimos el que tiene value=100 disponible
    const allSelects = page.locator('select').filter({ has: page.locator('option[value="100"]') });
    const count = await allSelects.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const s = allSelects.nth(i);
      const id = await s.getAttribute('data-testid').catch(() => null);
      if (id === 'calc-origin') continue;
      await s.selectOption(c.preference).catch(() => {});
      break;
    }
  }
  await page.waitForTimeout(300);
}

test.describe('Calculadora de Derechos /calculator', () => {
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
      if (u.includes('/api/') && res.status() >= 400 && !u.includes('cache-stats') && !u.includes('incoterm')) {
        log('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 1. Render base
  // -------------------------------------------------------------------------
  test('1. Render base /calculator (form + selectores + boton)', async ({ page }) => {
    await gotoApp(page, '/calculator');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '01-form-empty.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /alculadora|alcul|aranc|uti/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Inputs principales
    const taricInput = await page.locator('[data-testid="calc-taric"]').isVisible({ timeout: 3000 }).catch(() => false);
    const valueInput = await page.locator('[data-testid="calc-value"]').isVisible({ timeout: 3000 }).catch(() => false);
    const originSelect = await page.locator('[data-testid="calc-origin"]').isVisible({ timeout: 3000 }).catch(() => false);
    const submitBtn = await page.locator('[data-testid="calc-submit"]').isVisible({ timeout: 3000 }).catch(() => false);
    log('form-fields', taricInput && valueInput && originSelect && submitBtn ? 'low' : 'high',
      `taric=${taricInput} value=${valueInput} origin=${originSelect} submit=${submitBtn}`);

    // Preferencia + Incoterm + Fecha (selectores secundarios)
    const allSelects = await page.locator('select').count();
    log('all-selects', allSelects >= 3 ? 'low' : 'medium', `Selectores totales: ${allSelects} (esperado >=3: origen + preferencia + incoterm)`);

    // Origen: optgroups "Mas comunes" y "Todos" + paises
    const optgroups = await page.locator('[data-testid="calc-origin"] optgroup').count();
    log('origin-optgroups', optgroups >= 2 ? 'low' : 'medium', `Optgroups origen: ${optgroups} (esperado 2)`);

    const totalCountries = await page.locator('[data-testid="calc-origin"] option').count();
    log('origin-countries', totalCountries >= 100 ? 'low' : 'medium', `Total opciones pais: ${totalCountries}`);

    // Panel incoterm info (lateral)
    const incotermPanel = await page.locator('text=/CIF|Cost.*Insurance|Coste.*Seguro/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('incoterm-panel', incotermPanel ? 'low' : 'medium', `Panel info incoterm CIF: ${incotermPanel}`);
  });

  // -------------------------------------------------------------------------
  // 2. Validacion form vacio
  // -------------------------------------------------------------------------
  test('2. Validacion: submit con form vacio', async ({ page }) => {
    await gotoApp(page, '/calculator');
    await page.waitForTimeout(1500);

    // Click submit con form vacio (HTML5 validation bloquea)
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        form.noValidate = true;
        form.requestSubmit();
      }
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '02-validation-empty.png'), fullPage: true });

    // Toast de error
    const toast = await page.locator('text=/obligatorio|requerido|Complete|fill/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('validation-toast', toast ? 'low' : 'medium', `Toast validacion form vacio: ${toast}`);
  });

  // -------------------------------------------------------------------------
  // 3-5. Calculos para cada caso de prueba
  // -------------------------------------------------------------------------
  for (const [idx, c] of TEST_CASES.entries()) {
    test(`${idx + 3}. Calculo: ${c.id}`, async ({ page }) => {
      test.setTimeout(60_000);
      await gotoApp(page, '/calculator');
      await page.waitForTimeout(1500);

      await fillCalculator(page, c);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 3}a-${c.id}-form.png`), fullPage: true });

      // Capturar respuesta API
      const apiResp = [];
      page.on('response', async (r) => {
        if (r.url().includes('/api/calculation/duties') && r.request().method() === 'POST') {
          try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
        }
      });

      await page.locator('[data-testid="calc-submit"]').click();
      await page.waitForTimeout(15_000);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 3}b-${c.id}-result.png`), fullPage: true });

      const last = apiResp[apiResp.length - 1];
      const data = last?.body?.data;
      const r = {
        id: c.id,
        httpStatus: last?.status,
        customsValue: data?.customsValue,
        dutyAmount: data?.dutyAmount,
        dutyRate: data?.dutyRate,
        vatAmount: data?.vatAmount,
        vatRate: data?.vatRate,
        totalToPay: data?.totalToPay,
        source: data?.source,
        confidence: data?.confidence
      };
      results.push(r);

      log(`${c.id}-http`, last?.status === 200 ? 'low' : 'high',
        `HTTP ${last?.status}, source=${data?.source}, confidence=${data?.confidence}%`);

      // Validar matematica
      const dutyOk = Math.abs((data?.dutyAmount || 0) - c.expected.dutyAmount) < 1;
      const totalOk = Math.abs((data?.totalToPay || 0) - c.expected.total) < 1;
      const rateOk = Math.abs((data?.dutyRate || 0) - c.expected.dutyRate) < 0.1;

      log(`${c.id}-math`, dutyOk && totalOk && rateOk ? 'low' : 'high',
        `duty=${data?.dutyAmount} (esperado ${c.expected.dutyAmount}) ` +
        `rate=${data?.dutyRate}% (esp ${c.expected.dutyRate}%) ` +
        `total=${data?.totalToPay} (esp ${c.expected.total})`);

      // Validar UI muestra el resultado
      const totalUI = await page.locator(`text=/${c.expected.total.toFixed(2)}|${Math.round(c.expected.total)}/`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`${c.id}-ui-total`, totalUI ? 'low' : 'medium', `Total visible en UI: ${totalUI}`);
    });
  }

  // -------------------------------------------------------------------------
  // 6. Cambio de incoterm actualiza panel
  // -------------------------------------------------------------------------
  test('6. Cambio de incoterm refresca panel info', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/calculator');
    await page.waitForTimeout(1500);

    const incotermSelect = page.locator('select').filter({ has: page.locator('option:has-text("EXW")') }).first();
    if (!(await incotermSelect.isVisible({ timeout: 3000 }).catch(() => false))) {
      log('incoterm-select', 'medium', 'No se encontro selector de incoterm');
      return;
    }

    // Cambiar a EXW
    await incotermSelect.selectOption('EXW');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '06a-incoterm-EXW.png'), fullPage: true });

    const exwPanel = await page.locator('text=/EXW|Ex.*Works|En F.brica/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('incoterm-EXW', exwPanel ? 'low' : 'medium', `Panel info EXW: ${exwPanel}`);

    // Cambiar a DDP
    await incotermSelect.selectOption('DDP');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '06b-incoterm-DDP.png'), fullPage: true });

    const ddpPanel = await page.locator('text=/DDP|Delivered.*Duty|Entregada.*Derechos/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('incoterm-DDP', ddpPanel ? 'low' : 'medium', `Panel info DDP: ${ddpPanel}`);
  });

  // -------------------------------------------------------------------------
  // 7. Cambio de preferencia (MFN vs SPG) sobre mismo TARIC
  // -------------------------------------------------------------------------
  test('7. Preferencia MFN vs SPG mismo TARIC', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/calculator');
    await page.waitForTimeout(1500);

    // 1ra calcular con MFN
    await fillCalculator(page, { taricCode: '6109100090', value: 8000, origin: 'BD', preference: '100' });
    await page.locator('[data-testid="calc-submit"]').click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '07a-MFN.png'), fullPage: true });

    // 2da calcular con SPG (codigo 200)
    const prefSelect = page.locator('label:has-text("preferencial"), label:has-text("Preferencia")').first().locator('..').locator('select').first();
    if (await prefSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prefSelect.selectOption('200');
      await page.waitForTimeout(500);
      await page.locator('[data-testid="calc-submit"]').click();
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(SCREENS, '07b-SPG.png'), fullPage: true });
      log('preference-spg', 'low', 'Calculo con preferencia SPG ejecutado');
    }
  });

  // -------------------------------------------------------------------------
  // 8. Cambio de fecha de importacion (efecto estacional si aplica)
  // -------------------------------------------------------------------------
  test('8. Cambio fecha importacion + TARIC estacional', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/calculator');
    await page.waitForTimeout(1500);

    // TARIC 0808100090 (manzanas frescas - puede tener arancel estacional)
    await page.locator('[data-testid="calc-taric"]').fill('0808100090');
    await page.locator('[data-testid="calc-value"]').fill('5000');
    await page.locator('[data-testid="calc-origin"]').selectOption('CL'); // Chile
    await page.waitForTimeout(300);

    // Fecha invierno
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill('2026-01-15');
      await page.waitForTimeout(300);
    }

    await page.locator('[data-testid="calc-submit"]').click();
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: path.join(SCREENS, '08a-seasonal-jan.png'), fullPage: true });

    // Cambiar fecha a verano
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill('2026-07-15');
      await page.waitForTimeout(300);
      await page.locator('[data-testid="calc-submit"]').click();
      await page.waitForTimeout(10_000);
      await page.screenshot({ path: path.join(SCREENS, '08b-seasonal-jul.png'), fullPage: true });
    }

    log('seasonal-test', 'low', 'Probado calculo con fechas distintas (efecto estacional si aplica)');
  });

  // -------------------------------------------------------------------------
  // 9. Captura final con resultado completo
  // -------------------------------------------------------------------------
  test('9. Captura resumen calculo completo (colchones)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/calculator');
    await page.waitForTimeout(1500);

    // Repetir caso colchones para captura final clara
    await fillCalculator(page, TEST_CASES[0]);
    await page.locator('[data-testid="calc-submit"]').click();
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: path.join(SCREENS, '09-resultado-completo.png'), fullPage: true });
    log('final-capture', 'low', 'Captura resultado completo colchones TR 10k');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      results,
      findings
    }, null, 2));

    console.log('\n=== CALCULATOR E2E SUMMARY ===');
    for (const r of results) {
      console.log(`  ${r.id}: customsValue=${r.customsValue} duty=${r.dutyAmount} (${r.dutyRate}%) vat=${r.vatAmount} total=${r.totalToPay} src=${r.source}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
