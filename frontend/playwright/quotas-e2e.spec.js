// @ts-check
/**
 * E2E /quotas — Gestion de Contingentes Arancelarios.
 *
 * Cobertura UI desde el front:
 * 1) Render base + 3 tabs (Buscar Disponibilidad / Todos los Contingentes / Contingentes Criticos)
 * 2) Combobox pais origen: 195 paises en optgroups (BUG FIX antes mostraba "()")
 * 3) Tab "Buscar Disponibilidad": casos reales (AR vacuno encontrado, CN laptops no encontrado)
 * 4) Tab "Todos los Contingentes": tabla con 11 contingentes EU (carne vacuno, leche, queso, etc.)
 * 5) Tab "Contingentes Criticos": cards con 4 criticos + utilization > 80%
 * 6) Mostrar volumen + utilizacion + arancel in-quota vs out-quota + ahorro
 *
 * BUGS CORREGIDOS:
 * - 3 fetch hardcoded a localhost:5001 (list, critical, check-availability) -> migrados a `api`
 * - Combobox paises mostraba "()" (mismo bug que /preferences y /rules-engine)
 * - `toast.info()` no existe en react-hot-toast (mismo bug que /excise-duties)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'quotas-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();
const results = [];

const SEARCH_CASES = [
  { id: 'AR-vacuno', taric: '02011000', origin: 'AR', quantity: 10000, unit: 'kg', value: 50000, expectFound: true },
  { id: 'CN-laptops', taric: '8471300000', origin: 'CN', quantity: 100, unit: 'units', value: 50000, expectFound: false }
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

test.describe('Gestion de Contingentes Arancelarios /quotas', () => {
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
  test('1. Render base /quotas + 3 tabs visibles', async ({ page }) => {
    await gotoApp(page, '/quotas');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Contingentes|Quota/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 3 tabs
    const t1 = await page.locator('button:has-text("Buscar Disponibilidad")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t2 = await page.locator('button:has-text("Todos los Contingentes")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t3 = await page.locator('button:has-text("Contingentes Cr")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', t1 && t2 && t3 ? 'low' : 'high',
      `Buscar=${t1} Todos=${t2} Criticos=${t3}`);

    // Form Buscar visible (default tab)
    const form = await page.locator('text=/Verificar Disponibilidad/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('default-form', form ? 'low' : 'medium', `Form Verificar Disponibilidad visible: ${form}`);
  });

  // -------------------------------------------------------------------------
  // 2. BUG FIX: combobox pais con optgroups
  // -------------------------------------------------------------------------
  test('2. BUG FIX: combobox pais con optgroups + nombres reales', async ({ page }) => {
    await gotoApp(page, '/quotas');
    await page.waitForTimeout(2000);

    const select = page.locator('[data-testid="quotas-origin"]').first();
    const visible = await select.isVisible({ timeout: 3000 }).catch(() => false);
    log('select-found', visible ? 'low' : 'high', `Select quotas-origin visible: ${visible}`);

    const optgroups = await select.locator('optgroup').count();
    log('optgroups', optgroups >= 2 ? 'low' : 'high', `Optgroups: ${optgroups} (esperado 2)`);

    const options = await select.locator('option').count();
    log('options', options >= 100 ? 'low' : 'high', `Total opciones: ${options} (esperado ~195)`);

    const optionTexts = await select.locator('option').allTextContents();
    const broken = optionTexts.filter(t => t.trim() === '()' || t.trim() === '');
    log('options-broken', broken.length === 0 ? 'low' : 'critical',
      `Opciones rotas "()": ${broken.length}`);

    const ar = await select.locator('option[value="AR"]').first().textContent().catch(() => '');
    const cn = await select.locator('option[value="CN"]').first().textContent().catch(() => '');
    log('spotcheck', /Argentina/.test(ar) && /China/.test(cn) ? 'low' : 'high',
      `AR="${ar?.trim()}" CN="${cn?.trim()}"`);

    await page.screenshot({ path: path.join(SCREENS, '02-combobox-paises.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3-4. Tab "Buscar Disponibilidad": casos
  // -------------------------------------------------------------------------
  for (const [idx, c] of SEARCH_CASES.entries()) {
    test(`${idx + 3}. Buscar: ${c.id}`, async ({ page }) => {
      test.setTimeout(60_000);
      await gotoApp(page, '/quotas');
      await page.waitForTimeout(2000);

      // Llenar form
      const taricInput = page.locator('input[placeholder*="02011000"]').first();
      await taricInput.fill(c.taric);
      await page.locator('[data-testid="quotas-origin"]').selectOption(c.origin);
      const numberInputs = page.locator('input[type="number"]');
      await numberInputs.nth(0).fill(String(c.quantity));
      // Unit select (segundo select tras quotas-origin)
      const unitSelect = page.locator('select').nth(1);
      await unitSelect.selectOption(c.unit).catch(() => {});
      // Customs value (opcional)
      if (c.value) {
        await numberInputs.nth(1).fill(String(c.value));
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 3}a-${c.id}-form.png`), fullPage: true });

      // Capturar respuesta
      const apiResp = [];
      page.on('response', async (r) => {
        if (r.url().includes('/api/quotas/check-availability')) {
          try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
        }
      });

      // Submit
      const submitBtn = page.locator('button:has-text("Verificar Disponibilidad")').last();
      await submitBtn.click({ timeout: 5000 });
      await page.waitForTimeout(7000);
      await page.screenshot({ path: path.join(SCREENS, `0${idx + 3}b-${c.id}-result.png`), fullPage: true });

      const last = apiResp[apiResp.length - 1];
      const data = last?.body?.data;
      const r = {
        id: c.id,
        httpStatus: last?.status,
        found: data?.found,
        count: data?.count || 0,
        firstQuotaDesc: data?.quotas?.[0]?.description,
        firstQuotaUtil: data?.quotas?.[0]?.volume?.utilizationPercent
      };
      results.push(r);

      log(`${c.id}-http`, last?.status === 200 ? 'low' : 'high',
        `HTTP ${last?.status}, found=${r.found}, count=${r.count}`);

      log(`${c.id}-found-match`,
        r.found === c.expectFound ? 'low' : 'medium',
        `found=${r.found} (esperado ${c.expectFound})`);

      if (c.expectFound) {
        const quotaCard = await page.locator('text=/Utilizaci|En contingente|NMF/i').first().isVisible({ timeout: 3000 }).catch(() => false);
        log(`${c.id}-ui-quota`, quotaCard ? 'low' : 'medium', `Card contingente visible UI: ${quotaCard}`);
      } else {
        const noMatchUI = await page.locator('text=/No se encontraron contingentes|NMF.*Naci/i').first().isVisible({ timeout: 3000 }).catch(() => false);
        log(`${c.id}-ui-no-match`, noMatchUI ? 'low' : 'medium', `UI muestra "no encontrados": ${noMatchUI}`);
      }
    });
  }

  // -------------------------------------------------------------------------
  // 5. Tab "Todos los Contingentes"
  // -------------------------------------------------------------------------
  test('5. Tab "Todos los Contingentes": tabla con 11 contingentes', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/quotas');
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Todos los Contingentes")').first().click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENS, '05-tab-todos.png'), fullPage: true });

    // Tabla con headers Orden / Descripcion / Tipo / Utilizacion / Estado
    const headers = await page.locator('thead th').count();
    log('table-headers', headers >= 5 ? 'low' : 'medium', `Headers tabla: ${headers}`);

    const rows = await page.locator('tbody tr').count();
    log('table-rows', rows >= 5 ? 'low' : 'medium', `Filas en tabla: ${rows} (esperado ~11)`);

    // Spot-check: una fila debe tener "Carne de vacuno" (Q090001)
    const vacunoVisible = await page.locator('text=/Carne de vacuno/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('vacuno-row', vacunoVisible ? 'low' : 'medium', `Fila vacuno visible: ${vacunoVisible}`);
  });

  // -------------------------------------------------------------------------
  // 6. Tab "Contingentes Criticos"
  // -------------------------------------------------------------------------
  test('6. Tab "Contingentes Criticos": cards con criticos', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/quotas');
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Contingentes Cr")').first().click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENS, '06-tab-criticos.png'), fullPage: true });

    // Cards con border naranja
    const cards = await page.locator('.border-orange-500').count();
    log('critical-cards', cards >= 1 ? 'low' : 'medium',
      `Cards criticos visibles: ${cards} (esperado ~4)`);

    // Spot-check: alguno debe tener "Leche en polvo desnatada" (94.85% util)
    const leche = await page.locator('text=/Leche en polvo desnatada/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('leche-card', leche ? 'low' : 'medium', `Card leche desnatada visible: ${leche}`);

    // Cada card muestra "Solicite reserva urgente"
    const reserva = await page.locator('text=/reserva urgente/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('reserva-warning', reserva ? 'low' : 'medium', `Warning "reserva urgente" visible: ${reserva}`);
  });

  // -------------------------------------------------------------------------
  // 7. Captura final con resultado AR-vacuno completo
  // -------------------------------------------------------------------------
  test('7. Captura final - busqueda AR-vacuno con detalle', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/quotas');
    await page.waitForTimeout(2000);

    const taricInput = page.locator('input[placeholder*="02011000"]').first();
    await taricInput.fill('02011000');
    await page.locator('[data-testid="quotas-origin"]').selectOption('AR');
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('10000');
    if (await numberInputs.nth(1).isVisible({ timeout: 1000 }).catch(() => false)) {
      await numberInputs.nth(1).fill('50000');
    }

    const submitBtn = page.locator('button:has-text("Verificar Disponibilidad")').last();
    await submitBtn.click();
    await page.waitForTimeout(7000);
    await page.screenshot({ path: path.join(SCREENS, '07-resultado-completo-vacuno.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final AR vacuno con detalle contingente + ahorro');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      results,
      findings
    }, null, 2));

    console.log('\n=== QUOTAS E2E SUMMARY ===');
    for (const r of results) {
      console.log(`  ${r.id}: found=${r.found} count=${r.count} firstDesc=${r.firstQuotaDesc?.slice(0,40) || '-'} util=${r.firstQuotaUtil || '-'}%`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
