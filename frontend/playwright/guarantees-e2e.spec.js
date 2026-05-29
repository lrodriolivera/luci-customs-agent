// @ts-check
/**
 * E2E /guarantees — Garantias Aduaneras (CGU, avales, depositos, seguros caucion).
 *
 * Cobertura UI desde el front:
 * 1) Render base + h1 traducido + 4 stats cards + 3 botones header (IA / Calculadora / Nueva)
 * 2) Estado vacio: panel "No hay garantias" + boton "Crear primera"
 * 3) Crear garantia via API (CGU 100k EUR) -> aparece en lista UI
 * 4) Filtros (status + type) + boton refresh
 * 5) Boton "Nueva Garantia" -> abre modal GuaranteeForm
 * 6) Boton "Calculadora" -> abre modal GuaranteeCalculator
 * 7) Boton "Analisis IA" -> abre panel GuaranteeAIPanel
 * 8) Boton "Ver detalles" -> abre modal GuaranteeDetail
 * 9) Captura final con garantia creada
 * 10) Cleanup
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'guarantees-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();
const created = { id: null, name: null, reference: null };

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Garantias Aduaneras /guarantees', () => {
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
  test('1. Render base /guarantees + h1 + 3 botones header + 4 stats cards', async ({ page }) => {
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Garantias|Garantías|Guarantees/i.test(h1 || '') && !/guarantees\.title/.test(h1 || '') ? 'low' : 'high',
      `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 3 botones header
    const aiBtn = await page.locator('button').filter({ hasText: /An.lisis IA|AI Analysis/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const calcBtn = await page.locator('button').filter({ hasText: /Calculadora|Calculator/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const newBtn = await page.locator('button').filter({ hasText: /Nueva Garan|New Guar/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('header-buttons', aiBtn && calcBtn && newBtn ? 'low' : 'medium',
      `AnalisisIA=${aiBtn} Calculadora=${calcBtn} NuevaGarantia=${newBtn}`);

    // 4 stats cards
    const c1 = await page.locator('text=/Garantias Activas/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const c2 = await page.locator('text=/Importe Total/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const c3 = await page.locator('text=/Disponible/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const c4 = await page.locator('text=/Consumido/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('stats-cards', c1 && c2 && c3 && c4 ? 'low' : 'medium',
      `Activas=${c1} Total=${c2} Disponible=${c3} Consumido=${c4}`);

    // Filtros: 2 selects (status + type)
    const filterSelects = await page.locator('select').count();
    log('filter-selects', filterSelects >= 2 ? 'low' : 'medium', `Selects filtros: ${filterSelects}`);
  });

  // -------------------------------------------------------------------------
  // 2. Estado vacio o lista
  // -------------------------------------------------------------------------
  test('2. Lista o estado vacio', async ({ page }) => {
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(2500);

    const emptyState = await page.locator('text=/No.*garantias|No.*guarantees|No hay/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('empty-or-list', 'low', `Estado vacio visible: ${emptyState} (depende del tenant)`);
    await page.screenshot({ path: path.join(SCREENS, '02-state.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Crear garantia via API + verificar en lista UI
  // -------------------------------------------------------------------------
  test('3. Crear garantia via API + verificar en lista UI', async ({ page, request }) => {
    test.setTimeout(60_000);
    const validUntil = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const validFrom = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const r = await request.post('/api/guarantees', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `E2E Guarantee ${TS}`,
        type: 'CGU',
        totalAmount: 250000,
        currency: 'EUR',
        validFrom,
        validUntil,
        issuingEntity: 'Banco Santander S.A.',
        referenceNumber: `AVAL-E2E-${TS}`,
        purpose: 'general',
        usage: 'general'
      }
    });
    const body = await r.json().catch(() => ({}));
    log('create-api', r.status() < 400 ? 'low' : 'high',
      `POST /api/guarantees HTTP ${r.status()} id=${body?.data?._id}`);

    if (body?.data?._id) {
      created.id = body.data._id;
      created.name = body.data.name;
      created.reference = body.data.reference;
    }

    // Recargar pagina
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '03-list-with-new.png'), fullPage: true });

    if (created.name) {
      const visible = await page.locator(`text=${created.name}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('new-in-list', visible ? 'low' : 'medium', `Garantia "${created.name}" visible en lista UI: ${visible}`);
    }

    // Stats cards deben mostrar valores > 0 ahora
    const totalCard = await page.locator('text=/250.000|250\\.000,00/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('stats-updated', totalCard ? 'low' : 'medium', `Importe Total 250.000 EUR visible: ${totalCard}`);
  });

  // -------------------------------------------------------------------------
  // 4. Filtros status + type
  // -------------------------------------------------------------------------
  test('4. Filtros status + type', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(2500);

    // Status select (primero)
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('draft').catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '04a-filter-status.png'), fullPage: true });

    // Type select (segundo)
    const typeSelect = page.locator('select').nth(1);
    await typeSelect.selectOption('CGU').catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '04b-filter-type.png'), fullPage: true });

    log('filters-applied', 'low', 'Filtros status=draft + type=CGU aplicados');
  });

  // -------------------------------------------------------------------------
  // 5. Boton "Nueva Garantia" -> modal Form
  // -------------------------------------------------------------------------
  test('5. Boton "Nueva Garantia" abre modal Form', async ({ page }) => {
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(2500);

    const newBtn = page.locator('button').filter({ hasText: /Nueva Garan|New Guar/i }).first();
    await newBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '05-modal-nueva.png'), fullPage: true });

    // Modal con titulo o form de crear
    const modal = await page.locator('text=/Nueva Garan|Crear Garan|Tipo de Garant/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('new-modal', modal ? 'low' : 'medium', `Modal Nueva Garantia visible: ${modal}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 6. Boton "Calculadora" -> modal Calculator
  // -------------------------------------------------------------------------
  test('6. Boton "Calculadora" abre modal Calculator', async ({ page }) => {
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(2500);

    const calcBtn = page.locator('button').filter({ hasText: /Calculadora|Calculator/i }).first();
    await calcBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '06-modal-calculadora.png'), fullPage: true });

    const modal = await page.locator('text=/Calculadora|Calculator|Calcular Garant|Calcular Importe/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('calc-modal', modal ? 'low' : 'medium', `Modal Calculadora visible: ${modal}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 7. Boton "Analisis IA" -> panel AI
  // -------------------------------------------------------------------------
  test('7. Boton "Analisis IA" abre panel AI', async ({ page }) => {
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(2500);

    const aiBtn = page.locator('button').filter({ hasText: /An.lisis IA|AI Analysis/i }).first();
    await aiBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '07-panel-ai.png'), fullPage: true });

    // Panel debe tener tabs o contenido (analyze/optimize/recommend)
    const panel = await page.locator('text=/An.lisis|Analyze|Optimiz|Recomend/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('ai-panel', panel ? 'low' : 'medium', `Panel AI visible: ${panel}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 8. Boton "Ver detalles" -> modal Detail
  // -------------------------------------------------------------------------
  test('8. Boton "Ver detalles" abre modal Detail', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(2500);

    if (!created.id) {
      log('detail-modal', 'medium', 'No hay garantia creada');
      return;
    }

    const detailBtn = page.locator('button:has-text("Ver detalles")').first();
    if (await detailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await detailBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '08-modal-detail.png'), fullPage: true });

      const modal = await page.locator('text=/Detalles|Detail|Vigencia|Importe/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log('detail-modal', modal ? 'low' : 'medium', `Modal Detalles visible: ${modal}`);

      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    } else {
      log('detail-modal', 'medium', 'Boton Ver detalles no encontrado');
    }
  });

  // -------------------------------------------------------------------------
  // 9. Captura final con garantia creada
  // -------------------------------------------------------------------------
  test('9. Captura final con garantia + stats', async ({ page }) => {
    await gotoApp(page, '/guarantees');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '09-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /guarantees');
  });

  // -------------------------------------------------------------------------
  // 10. Cleanup: cancelar garantia de prueba
  // -------------------------------------------------------------------------
  test('10. Cleanup: cancelar garantia de prueba', async ({ request }) => {
    if (!created.id) {
      log('cleanup', 'medium', 'No hay garantia para cleanup');
      return;
    }
    const r = await request.post(`/api/guarantees/${created.id}/cancel`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { reason: 'Cleanup E2E' }
    });
    log('cleanup', r.status() < 400 ? 'low' : 'medium', `POST /cancel HTTP ${r.status()}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      created,
      findings
    }, null, 2));

    console.log('\n=== GUARANTEES E2E SUMMARY ===');
    console.log(`  created: id=${created.id} name=${created.name} ref=${created.reference}`);
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
