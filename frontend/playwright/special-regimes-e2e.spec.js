// @ts-check
/**
 * E2E /special-regimes — Regimenes Aduaneros Especiales (CAU Art. 210-262).
 *
 * Cobertura UI desde el front:
 * 1) Render base + h1 traducido + 3 botones header (Actualizar / Asistente IA / Nuevo Regimen)
 * 2) 5 tipos de regimen: 51 IP / 53 TA / 71 CW / T1 / T2 con cards filtrables
 * 3) 4 cards de resumen (Total / Ultimados / Derechos Suspendidos / Por Vencer)
 * 4) Crear regimen 51 IP via API -> aparece en lista UI
 * 5) Filtros por tipo de regimen + estado
 * 6) Click "Asistente IA" -> abre modal RegimeAdvisor
 * 7) Click "Nuevo Regimen" -> abre form de creacion
 * 8) Captura final con datos
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'special-regimes-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();
const created = { id: null, reference: null };

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Regimenes Especiales /special-regimes', () => {
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
  test('1. Render base + h1 + 3 botones header + 5 tipos regimen + 4 cards resumen', async ({ page }) => {
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Regimenes Especiales|Special Regimes|Regímenes/i.test(h1 || '') && !/specialRegimes\.title/.test(h1 || '') ? 'low' : 'high',
      `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 3 botones header
    const refreshBtn = await page.locator('button[title="Actualizar"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    const aiBtn = await page.locator('button').filter({ hasText: /Asistente IA|AI Assistant/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const newBtn = await page.locator('button').filter({ hasText: /Nuevo Regimen|New Regime/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('header-buttons', refreshBtn && aiBtn && newBtn ? 'low' : 'medium',
      `Refresh=${refreshBtn} AsistenteIA=${aiBtn} NuevoRegimen=${newBtn}`);

    // 5 cards de tipo de regimen (51, 53, 71, T1, T2)
    const codes = ['IP', 'TA', 'CW', 'T1', 'T2'];
    let typesFound = 0;
    for (const c of codes) {
      const v = await page.locator(`text=/^${c}$/`).first().isVisible({ timeout: 2000 }).catch(() => false);
      if (v) typesFound++;
    }
    log('regime-types', typesFound >= 4 ? 'low' : 'medium', `Tipos regimen visibles: ${typesFound}/5 (IP/TA/CW/T1/T2)`);

    // 4 cards de resumen: Total / Ultimados / Derechos Suspendidos / Por Vencer
    const summary1 = await page.locator('text=/Total Regimenes/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const summary2 = await page.locator('text=/Ultimados/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const summary3 = await page.locator('text=/Derechos Suspendidos/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const summary4 = await page.locator('text=/Por Vencer/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('summary-cards', summary1 && summary2 && summary3 && summary4 ? 'low' : 'medium',
      `Total=${summary1} Ultimados=${summary2} Suspendidos=${summary3} PorVencer=${summary4}`);
  });

  // -------------------------------------------------------------------------
  // 2. Crear regimen 51 IP via API + verificar en lista UI
  // -------------------------------------------------------------------------
  test('2. Crear regimen 51 IP via API + verificar en lista UI', async ({ page, request }) => {
    test.setTimeout(60_000);
    const r = await request.post('/api/special-regimes', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        regimeCode: '51',
        regimeType: 'inward_processing',
        reference: `IP-E2E-${TS}`,
        description: 'Perfeccionamiento activo - ensamblaje electronica E2E',
        declarant: { eori: 'ESB22477020', name: 'STRIX AI SL' },
        goods: [{ taricCode: '8471300000', description: 'Componentes laptops', quantity: 100, unitOfMeasure: 'PCE', customsValue: 50000, netWeight: 250 }],
        operations: [{ type: 'transformation', description: 'Ensamblaje + testeo' }],
        expectedYield: 95,
        deadlineDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        suspendedDuties: 6500
      }
    });
    const body = await r.json().catch(() => ({}));
    log('create-api', r.status() < 400 ? 'low' : 'high',
      `POST /api/special-regimes HTTP ${r.status()} ref=${body?.data?.reference}`);
    if (body?.data?._id) {
      created.id = body.data._id;
      created.reference = body.data.reference;
    }

    // Recargar
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '02-list-with-new.png'), fullPage: true });

    if (created.reference) {
      const visible = await page.locator(`text=${created.reference}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('new-in-list', visible ? 'low' : 'medium', `Regimen ${created.reference} visible: ${visible}`);
    }

    // Stats Total Regimenes >= 1
    const total = await page.locator('text=/Total Regimenes/i').first().locator('..').textContent({ timeout: 3000 }).catch(() => '');
    log('stats-updated', /[1-9]/.test(total || '') ? 'low' : 'medium', `Total Regimenes incluye conteo > 0: ${/[1-9]/.test(total || '')}`);
  });

  // -------------------------------------------------------------------------
  // 3. Filtro por tipo IP (codigo 51)
  // -------------------------------------------------------------------------
  test('3. Filtro click sobre card "IP" (regimen 51)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/special-regimes') && !r.url().includes('stats') && !r.url().includes('expiring')) {
        try { apiResp.push({ status: r.status(), url: r.url() }); } catch {}
      }
    });

    // Click sobre el card IP (51)
    const ipCard = page.locator('button:has(p:has-text("IP"))').first();
    await ipCard.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '03-filter-IP.png'), fullPage: true });

    log('filter-ip', 'low', `Click card IP, requests=${apiResp.length}`);
  });

  // -------------------------------------------------------------------------
  // 4. Filtro por estado
  // -------------------------------------------------------------------------
  test('4. Filtro por estado select', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(2500);

    // Selector de estado dentro del Filtros
    const statusSelect = page.locator('select').first();
    if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusSelect.selectOption('draft').catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SCREENS, '04-filter-status.png'), fullPage: true });
      log('filter-status', 'low', 'Filtro estado=draft aplicado');
    }
  });

  // -------------------------------------------------------------------------
  // 5. Boton "Asistente IA" -> modal RegimeAdvisor
  // -------------------------------------------------------------------------
  test('5. Boton "Asistente IA" abre modal RegimeAdvisor', async ({ page }) => {
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(2500);

    const aiBtn = page.locator('button').filter({ hasText: /Asistente IA|AI Assistant/i }).first();
    await aiBtn.click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '05-modal-ai-advisor.png'), fullPage: true });

    // Modal con titulo "Asesor" o similar
    const modal = await page.locator('text=/Asesor|Advisor|operacion|recomendac/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('ai-modal', modal ? 'low' : 'medium', `Modal RegimeAdvisor visible: ${modal}`);

    // Form con tipo de operacion + descripcion
    const formField = await page.locator('text=/Tipo de Operacion|operation_type|Tipo Operacion/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('ai-form-field', formField ? 'low' : 'medium', `Campo Tipo Operacion: ${formField}`);

    // Boton Analizar (probablemente)
    const analyzeBtn = await page.locator('button').filter({ hasText: /Analizar|Analyze/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('ai-analyze-btn', analyzeBtn ? 'low' : 'medium', `Boton Analizar: ${analyzeBtn}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 6. Boton "Nuevo Regimen" -> form de creacion
  // -------------------------------------------------------------------------
  test('6. Boton "Nuevo Regimen" abre form de creacion', async ({ page }) => {
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(2500);

    const newBtn = page.locator('button').filter({ hasText: /Nuevo Regimen|New Regime/i }).first();
    await newBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '06-modal-nuevo.png'), fullPage: true });

    const modal = await page.locator('text=/Nuevo Regimen|Crear Regimen|Tipo de Regimen|regimeType/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('new-modal', modal ? 'low' : 'medium', `Modal Nuevo Regimen visible: ${modal}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 7. Asistente IA - flujo completo: rellenar form y analizar
  // -------------------------------------------------------------------------
  test('7. Asistente IA flujo completo: rellenar + analizar', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(2500);

    // Abrir modal
    await page.locator('button').filter({ hasText: /Asistente IA|AI Assistant/i }).first().click({ timeout: 3000 });
    await page.waitForTimeout(2000);

    // Llenar descripcion en textarea
    const desc = page.locator('textarea').first();
    if (await desc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await desc.fill('Importar componentes electronicos de China para ensamblar laptops y reexportar a Latinoamerica');
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: path.join(SCREENS, '07a-ai-form-filled.png'), fullPage: true });

    // Capturar respuesta IA
    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/special-regimes/') && (r.url().includes('advise') || r.url().includes('analyze') || r.url().includes('recommend'))) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    // Click Analizar
    const analyzeBtn = page.locator('button').filter({ hasText: /Analizar|Analyze/i }).first();
    if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyzeBtn.click({ timeout: 5000 });
      await page.waitForTimeout(30000);
      await page.screenshot({ path: path.join(SCREENS, '07b-ai-result.png'), fullPage: true });

      const last = apiResp[apiResp.length - 1];
      log('ai-analyze-http', last?.status === 200 ? 'low' : 'medium',
        `HTTP ${last?.status || '-'} (analisis IA puede tardar 10-60s)`);
    }
  });

  // -------------------------------------------------------------------------
  // 8. Captura final
  // -------------------------------------------------------------------------
  test('8. Captura final con regimen creado', async ({ page }) => {
    await gotoApp(page, '/special-regimes');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '08-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /special-regimes');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      created,
      findings
    }, null, 2));

    console.log('\n=== SPECIAL-REGIMES E2E SUMMARY ===');
    console.log(`  created: id=${created.id} reference=${created.reference}`);
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
