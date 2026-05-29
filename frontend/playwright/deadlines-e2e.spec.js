// @ts-check
/**
 * E2E /deadlines — Gestor de Plazos.
 *
 * Cobertura UI desde el front:
 * 1) Render base + 2 tabs (Dashboard / Lista Completa) + 4 stats cards
 * 2) Tab Dashboard: stats Vencidos/Hoy/Semana/Total + listas Urgentes/Overdue/DueToday + Por Categoria
 * 3) Tab Lista Completa: tabla con filtros (status + category) + filas con acciones
 * 4) Filtro por status (overdue / pending / urgent / etc.)
 * 5) Filtro por category (requirement / guarantee / transit / etc.)
 * 6) Boton "+ Nuevo Plazo" abre modal CrearDeadline
 * 7) Crear plazo via API + verificar aparece en lista
 * 8) Boton "Extender" abre modal Extend (newDate + reason)
 * 9) Marcar plazo como Completado
 * 10) Captura final
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'deadlines-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();

const created = { id: null, title: null };

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Gestor de Plazos /deadlines', () => {
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
  test('1. Render base /deadlines + 2 tabs + stats cards', async ({ page }) => {
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Plazos|Deadlines/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 2 tabs
    const t1 = await page.locator('button:has-text("Dashboard")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t2 = await page.locator('button:has-text("Lista Completa")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', t1 && t2 ? 'low' : 'high', `Dashboard=${t1} ListaCompleta=${t2}`);

    // 4 stats cards: Vencidos / Vencen Hoy / Esta Semana / Total Pendientes
    const vencidos = await page.locator('text=/Vencidos/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const hoy = await page.locator('text=/Vencen Hoy/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const semana = await page.locator('text=/Esta Semana/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const pendientes = await page.locator('text=/Total Pendientes/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('stats-cards', vencidos && hoy && semana && pendientes ? 'low' : 'medium',
      `Vencidos=${vencidos} Hoy=${hoy} Semana=${semana} Pendientes=${pendientes}`);

    // Botones header: Actualizar + Nuevo Plazo
    const refreshBtn = await page.locator('button').filter({ hasText: /actualizar|refresh/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const newBtn = await page.locator('button').filter({ hasText: /nuevo plazo|new deadline/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('header-buttons', refreshBtn && newBtn ? 'low' : 'medium',
      `Actualizar=${refreshBtn} NuevoPlazo=${newBtn}`);

    // Por Categoria - debe haber categorias visibles
    const porCategoria = await page.locator('text=/Por Categor/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('por-categoria', porCategoria ? 'low' : 'medium', `Sección "Por Categoria" visible: ${porCategoria}`);
  });

  // -------------------------------------------------------------------------
  // 2. Dashboard: listas urgentes/overdue/dueToday
  // -------------------------------------------------------------------------
  test('2. Dashboard: listas urgentes/overdue/dueToday', async ({ page }) => {
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(3000);

    const urgent = await page.locator('text=/Plazos Urgentes/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('urgent-section', urgent ? 'low' : 'medium', `Sección "Plazos Urgentes" visible: ${urgent}`);

    const overdueSection = await page.locator('text=/Plazos Vencidos/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('overdue-section', overdueSection ? 'low' : 'medium', `Sección "Plazos Vencidos" visible: ${overdueSection}`);

    // Filas de plazos con badges de status
    const statusBadges = await page.locator('text=/Vencido|Urgente|Critico|Pendiente|Proximo/i').count();
    log('status-badges', statusBadges >= 1 ? 'low' : 'medium', `Status badges visibles: ${statusBadges}`);

    await page.screenshot({ path: path.join(SCREENS, '02-dashboard-listas.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab "Lista Completa" + filtros
  // -------------------------------------------------------------------------
  test('3. Tab "Lista Completa" + tabla con filtros', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Lista Completa")').first().click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '03-lista-default.png'), fullPage: true });

    // Filtros: 2 selects (status + category) + boton Limpiar
    const filtersSelects = await page.locator('select').count();
    log('filters-selects', filtersSelects >= 2 ? 'low' : 'medium',
      `Selects de filtros: ${filtersSelects} (esperado 2: status + category)`);

    const limpiar = await page.locator('button:has-text("Limpiar")').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('limpiar-btn', limpiar ? 'low' : 'medium', `Boton "Limpiar filtros" visible: ${limpiar}`);

    // Tabla con headers
    const headers = await page.locator('thead th').count();
    log('table-headers', headers >= 5 ? 'low' : 'medium',
      `Headers tabla: ${headers} (esperado 6: Plazo / Categoria / Vencimiento / Dias / Estado / Acciones)`);

    const rows = await page.locator('tbody tr').count();
    log('table-rows', rows >= 1 ? 'low' : 'medium', `Filas tabla: ${rows}`);
  });

  // -------------------------------------------------------------------------
  // 4. Filtro por status: overdue
  // -------------------------------------------------------------------------
  test('4. Filtro por status "overdue"', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Lista Completa")').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    // Capturar respuesta API
    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/deadlines') && !r.url().includes('dashboard')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    // Status select (primero de los 2 selects)
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('overdue').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '04-filter-overdue.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('filter-overdue-http', last?.status === 200 ? 'low' : 'medium', `HTTP ${last?.status}, count=${last?.body?.data?.deadlines?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 5. Filtro por category: requirement
  // -------------------------------------------------------------------------
  test('5. Filtro por category "requirement"', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Lista Completa")').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/deadlines') && !r.url().includes('dashboard')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    // Category select (segundo)
    const catSelect = page.locator('select').nth(1);
    await catSelect.selectOption('requirement').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '05-filter-requirement.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('filter-cat-http', last?.status === 200 ? 'low' : 'medium', `HTTP ${last?.status}, count=${last?.body?.data?.deadlines?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 6. Boton "+ Nuevo Plazo" abre modal Crear
  // -------------------------------------------------------------------------
  test('6. Boton "+ Nuevo Plazo" abre modal Crear', async ({ page }) => {
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(2500);

    const newBtn = page.locator('button').filter({ hasText: /nuevo plazo|new deadline/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '06-modal-crear.png'), fullPage: true });

      // Modal visible con form de creacion
      const modalTitle = await page.locator('text=/Crear|Nuevo Plazo|New Deadline/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      log('create-modal', modalTitle ? 'low' : 'medium', `Modal de creacion visible: ${modalTitle}`);

      // Cerrar modal con escape
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    } else {
      log('create-modal', 'medium', 'Boton Nuevo Plazo no encontrado');
    }
  });

  // -------------------------------------------------------------------------
  // 7. Crear plazo via API + verificar en lista
  // -------------------------------------------------------------------------
  test('7. Crear plazo via API + verificar en lista UI', async ({ page, request }) => {
    test.setTimeout(60_000);

    // Crear via API
    const dueDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const create = await request.post('/api/deadlines', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Test Deadline ${TS}`,
        description: 'Plazo creado por suite E2E /deadlines',
        deadlineType: 'requirement_response',
        category: 'requirement',
        dueDate,
        priority: 'high'
      }
    });
    const body = await create.json().catch(() => ({}));
    log('create-api', create.status() < 400 ? 'low' : 'high',
      `POST /api/deadlines HTTP ${create.status()} id=${body?.data?._id}`);

    if (body?.data?._id) {
      created.id = body.data._id;
      created.title = body.data.title;
    }

    // Ver en lista UI
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(2500);
    await page.locator('button:has-text("Lista Completa")').first().click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '07-lista-with-new.png'), fullPage: true });

    if (created.title) {
      const visible = await page.locator(`text=${created.title}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('new-in-list', visible ? 'low' : 'medium', `Nuevo plazo "${created.title}" visible en lista: ${visible}`);
    }
  });

  // -------------------------------------------------------------------------
  // 8. Boton Extender abre modal
  // -------------------------------------------------------------------------
  test('8. Boton Extender abre modal con newDate + reason', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(2500);

    // En el dashboard, las filas tienen botones de Extender
    // Buscar primer boton ArrowPathIcon (Extender)
    const extendBtn = page.locator('button[title="Extender plazo"], button[title="Extender"]').first();
    if (await extendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await extendBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '08-modal-extender.png'), fullPage: true });

      const modalTitle = await page.locator('text=/Extender Plazo/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      log('extend-modal', modalTitle ? 'low' : 'medium', `Modal Extender visible: ${modalTitle}`);

      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    } else {
      log('extend-modal', 'medium', 'Boton Extender no encontrado en dashboard');
    }
  });

  // -------------------------------------------------------------------------
  // 9. Captura final con dashboard completo
  // -------------------------------------------------------------------------
  test('9. Captura final con dashboard completo', async ({ page }) => {
    await gotoApp(page, '/deadlines');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '09-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /deadlines');
  });

  // -------------------------------------------------------------------------
  // 10. Cleanup: marcar plazo de prueba como completado
  // -------------------------------------------------------------------------
  test('10. Cleanup: completar plazo de prueba', async ({ request }) => {
    if (!created.id) {
      log('cleanup', 'medium', 'No hay plazo creado para cleanup');
      return;
    }
    const r = await request.post(`/api/deadlines/${created.id}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { reason: 'Cleanup E2E' }
    });
    log('cleanup', r.status() < 400 ? 'low' : 'medium', `POST /complete HTTP ${r.status()}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      created,
      findings
    }, null, 2));

    console.log('\n=== DEADLINES E2E SUMMARY ===');
    console.log(`  created: id=${created.id} title=${created.title}`);
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
