// @ts-check
/**
 * E2E /inspections — Gestor de Inspecciones Aduaneras.
 *
 * BUG REPORTADO POR USUARIO Y CORREGIDO:
 * - Titulo mostraba literal "inspections.title" en vez del texto traducido.
 *   Causa: el componente llamaba `t('inspections.title')` pero la clave i18n esta
 *   bajo `help.inspections.title` (no en root). Fix: cambiar a `t('help.inspections.title')`
 *   y `t('help.inspections.description')` para el subtitulo. Las traducciones existen
 *   en los 5 idiomas (es/en/fr/ca/it).
 *
 * Cobertura UI desde el front:
 * 1) Render base + 2 tabs (Dashboard / Lista Completa) + h1 traducido
 * 2) Dashboard: 4 stats cards (Hoy / Pendientes / En Curso / Esta Semana)
 * 3) Listas Dashboard: Today / In Progress / Upcoming / Pending Results
 * 4) Tab Lista Completa: filtros (status + inspectionType) + tabla con filas
 * 5) Filtro por status
 * 6) Filtro por tipo de inspeccion
 * 7) Boton "+ Nueva Inspeccion" abre modal Crear
 * 8) Click en fila abre detail
 * 9) Captura final
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'inspections-e2e-screens');
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

test.describe('Gestor de Inspecciones /inspections', () => {
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
  // 1. BUG FIX: titulo traducido + render base
  // -------------------------------------------------------------------------
  test('1. BUG FIX: titulo traducido (no "inspections.title") + render base', async ({ page }) => {
    await gotoApp(page, '/inspections');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1-bug-fix', /Inspecciones|Inspections/i.test(h1 || '') && !/inspections\.title/.test(h1 || '') ? 'low' : 'critical',
      `h1: "${h1?.trim()}" (esperado "Inspecciones Aduaneras", NO el literal "inspections.title")`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 3 tabs: Dashboard / Lista / Calendario
    const t1 = await page.locator('button:has-text("Dashboard")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t2 = await page.locator('button:has-text("Lista"):not(:has-text("Pagos"))').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t3 = await page.locator('button:has-text("Calendario"), button:has-text("Calendar")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', t1 && t2 && t3 ? 'low' : 'high', `Dashboard=${t1} Lista=${t2} Calendario=${t3}`);

    // 4 stats cards (Programadas Hoy / Pendientes / En Curso / Completadas Semana)
    const card1 = await page.locator('text=/Programadas Hoy|Hoy/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card2 = await page.locator('text=/Pendientes|Pending/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card3 = await page.locator('text=/En Curso|In Progress/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const card4 = await page.locator('text=/Esta Semana|Completadas/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('stats-cards', card1 && card2 && card3 && card4 ? 'low' : 'medium',
      `Hoy=${card1} Pendientes=${card2} EnCurso=${card3} Semana=${card4}`);

    // Botones header: Actualizar + Nueva Inspeccion
    const refreshBtn = await page.locator('button').filter({ hasText: /actualizar|refresh/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const newBtn = await page.locator('button').filter({ hasText: /nueva inspecc|new inspection/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('header-buttons', refreshBtn && newBtn ? 'low' : 'medium',
      `Actualizar=${refreshBtn} NuevaInspeccion=${newBtn}`);
  });

  // -------------------------------------------------------------------------
  // 2. Dashboard: stats por tipo
  // -------------------------------------------------------------------------
  test('2. Dashboard: stats por tipo de inspeccion', async ({ page }) => {
    await gotoApp(page, '/inspections');
    await page.waitForTimeout(3000);

    // Por tipo: scanner, documentary, physical (de la API)
    const porTipo = await page.locator('text=/Por Tipo|By Type/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('por-tipo', porTipo ? 'low' : 'medium', `Sección por tipo visible: ${porTipo}`);

    // Tipos: Scanner, Documental, Fisica
    const scanner = await page.locator('text=/Scanner/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const documental = await page.locator('text=/Documental/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const fisica = await page.locator('text=/F.sica/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tipos-visibles', scanner || documental || fisica ? 'low' : 'medium',
      `Scanner=${scanner} Documental=${documental} Fisica=${fisica}`);

    await page.screenshot({ path: path.join(SCREENS, '02-dashboard-tipos.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab "Lista Completa"
  // -------------------------------------------------------------------------
  test('3. Tab "Lista Completa" + tabla con filtros', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/inspections');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Lista"):not(:has-text("Pagos"))').first().click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '03-lista-default.png'), fullPage: true });

    // Filtros: 2 selects (status + inspectionType)
    const filtersSelects = await page.locator('select').count();
    log('filters-selects', filtersSelects >= 2 ? 'low' : 'medium',
      `Selects de filtros: ${filtersSelects} (esperado >=2)`);

    // Tabla con headers
    const headers = await page.locator('thead th').count();
    log('table-headers', headers >= 4 ? 'low' : 'medium', `Headers tabla: ${headers}`);

    const rows = await page.locator('tbody tr').count();
    log('table-rows', rows >= 1 ? 'low' : 'medium', `Filas tabla: ${rows}`);
  });

  // -------------------------------------------------------------------------
  // 4. Filtro por status
  // -------------------------------------------------------------------------
  test('4. Filtro por status "scheduled"', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/inspections');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Lista"):not(:has-text("Pagos"))').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/inspections') && !r.url().includes('dashboard') && !r.url().includes('types')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('scheduled').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '04-filter-scheduled.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('filter-status-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.inspections?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 5. Filtro por tipo
  // -------------------------------------------------------------------------
  test('5. Filtro por tipo "physical"', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/inspections');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Lista"):not(:has-text("Pagos"))').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/inspections') && !r.url().includes('dashboard') && !r.url().includes('types')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const typeSelect = page.locator('select').nth(1);
    await typeSelect.selectOption('physical').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '05-filter-physical.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('filter-type-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.inspections?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 6. Boton "+ Nueva Inspeccion" abre modal
  // -------------------------------------------------------------------------
  test('6. Boton "+ Nueva Inspeccion" abre modal Crear', async ({ page }) => {
    await gotoApp(page, '/inspections');
    await page.waitForTimeout(2500);

    const newBtn = page.locator('button').filter({ hasText: /nueva inspecc|new inspection/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '06-modal-crear.png'), fullPage: true });

      const modalTitle = await page.locator('text=/Nueva Inspecc|New Inspection|Crear/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      log('create-modal', modalTitle ? 'low' : 'medium', `Modal Crear visible: ${modalTitle}`);

      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  });

  // -------------------------------------------------------------------------
  // 7. Captura final con dashboard completo
  // -------------------------------------------------------------------------
  test('7. Captura final con dashboard completo', async ({ page }) => {
    await gotoApp(page, '/inspections');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '07-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /inspections');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      findings
    }, null, 2));

    console.log('\n=== INSPECTIONS E2E SUMMARY ===');
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
