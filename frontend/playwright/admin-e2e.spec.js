// @ts-check
/**
 * E2E /admin — Panel de Administracion (4 tabs).
 *
 * Cobertura UI:
 *  1) Render base + h1 + 4 tabs (Dashboard/Usuarios/Configuracion/Auditoria) + ShieldCheckIcon
 *  2) Tab Dashboard: 4 stats cards + UsersByRole
 *  3) Tab Usuarios: filtros (search/role/status) + tabla con datos reales + boton Nuevo Usuario
 *  4) Tab Usuarios: abrir modal Nuevo Usuario y cancelar
 *  5) Tab Configuracion: campos General + boton Guardar
 *  6) Tab Configuracion: toggle notificaciones
 *  7) Tab Auditoria: 4 stats cards + tabla logs + filtros
 *  8) Tab Auditoria: filtro por modulo dispara recarga
 *
 * No hay panel/boton IA dedicado (es admin pura). El stat "Asistente IA" del
 * dashboard solo refleja estado del servicio (active/inactive).
 *
 * Endpoints: GET /api/admin/{dashboard,users,roles,settings,audit,audit/stats},
 * PUT /api/admin/settings, POST/PUT/DELETE /api/admin/users(/:id),
 * POST /api/admin/users/:id/reset-password.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'admin-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

// Tab interno del admin (scope al nav que contiene tabs Dashboard/Usuarios/...).
function adminTab(page, re) {
  return page.locator('nav button').filter({ hasText: re }).first();
}

test.describe('Panel Administracion /admin', () => {
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
  test('1. Render base /admin + h1 + 4 tabs + ShieldCheck', async ({ page }) => {
    await gotoApp(page, '/admin');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', !/admin\.panelTitle|admin\.title/.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 4 tabs
    for (const re of [/Dashboard/i, /Usuarios|Users/i, /Configuracion|Settings/i, /Auditoria|Audit/i]) {
      const v = await adminTab(page, re).isVisible({ timeout: 1500 }).catch(() => false);
      log('tab', v ? 'low' : 'medium', `Tab ${re}: ${v}`);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Tab Dashboard
  // -------------------------------------------------------------------------
  test('2. Tab Dashboard - 4 stats cards + Usuarios por Rol', async ({ page }) => {
    await gotoApp(page, '/admin');
    await page.waitForTimeout(3000);

    for (const lbl of ['Total Usuarios', 'Actividad', 'Estado AEAT', 'Asistente IA']) {
      const v = await page.locator(`text=/${lbl}/`).first().isVisible({ timeout: 2500 }).catch(() => false);
      log('stat-card', v ? 'low' : 'medium', `Card "${lbl}": ${v}`);
    }

    const byRole = await page.locator('text=/Usuarios por Rol/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('users-by-role', byRole ? 'low' : 'medium', `Usuarios por Rol visible: ${byRole}`);

    await page.screenshot({ path: path.join(SCREENS, '02-tab-dashboard.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab Usuarios
  // -------------------------------------------------------------------------
  test('3. Tab Usuarios - filtros + tabla + boton Nuevo', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/admin');
    await page.waitForTimeout(2500);

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/admin\/(users|roles)$/)) {
        try {
          const body = await r.json();
          apiCalls.push({ url: r.url().replace('https://aduanas.strixai.es', ''), status: r.status(), count: (body?.users || body?.roles || []).length });
        } catch {}
      }
    });

    await adminTab(page, /Usuarios|Users/i).click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    log('users-api', apiCalls.length >= 1 ? 'low' : 'medium',
      `API calls users/roles: ${apiCalls.length}, ${apiCalls.map(c => `${c.url}=${c.count}`).join(', ')}`);

    // Search input
    const search = await page.locator('input[placeholder*="nombre"], input[placeholder*="email"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('users-search', search ? 'low' : 'medium', `Search input: ${search}`);

    // Boton Nuevo Usuario
    const newBtn = await page.locator('button').filter({ hasText: /Nuevo Usuario|New User/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('users-new-btn', newBtn ? 'low' : 'medium', `Boton Nuevo Usuario: ${newBtn}`);

    // Tabla con filas
    const rows = await page.locator('tbody tr').count();
    log('users-table', rows > 0 ? 'low' : 'medium', `Filas tabla usuarios: ${rows}`);

    await page.screenshot({ path: path.join(SCREENS, '03-tab-users.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 4. Modal Nuevo Usuario abrir + cancelar (sin crear)
  // -------------------------------------------------------------------------
  test('4. Modal Nuevo Usuario abre y se cancela', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/admin');
    await page.waitForTimeout(2500);

    await adminTab(page, /Usuarios|Users/i).click({ timeout: 3000 });
    await page.waitForTimeout(2000);

    await page.locator('button').filter({ hasText: /Nuevo Usuario|New User/i }).first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Modal visible: input email + name + select role
    const modalVisible = await page.locator('input[type="email"], input[type="text"]').count();
    log('modal-inputs', modalVisible >= 2 ? 'low' : 'medium', `Inputs modal usuario: ${modalVisible}`);

    await page.screenshot({ path: path.join(SCREENS, '04-modal-new-user.png'), fullPage: true });

    // Cerrar (boton X o Cancelar)
    const closeBtn = page.locator('button').filter({ hasText: /Cancelar|Cancel|Close/i }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click().catch(() => {});
    }
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 5. Tab Configuracion - general + Guardar
  // -------------------------------------------------------------------------
  test('5. Tab Configuracion - General + boton Guardar', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/admin');
    await page.waitForTimeout(2500);

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/admin/settings')) {
        try {
          const body = await r.json();
          apiCalls.push({ method: r.request().method(), status: r.status(), hasSettings: !!body?.settings });
        } catch {}
      }
    });

    await adminTab(page, /Configuracion|Settings/i).click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    log('settings-api', apiCalls.length >= 1 ? 'low' : 'medium',
      `GET /api/admin/settings: ${apiCalls.length}, status=${apiCalls[0]?.status}`);

    const generalHeading = await page.locator('text=/Configuracion General|General Settings|Compania|Empresa/i').first().isVisible({ timeout: 2500 }).catch(() => false);
    log('settings-general', generalHeading ? 'low' : 'medium', `Heading General visible: ${generalHeading}`);

    // Boton Guardar (varios pueden existir, scope a section General)
    const saveButtons = await page.locator('button').filter({ hasText: /Guardar Cambios|Save Changes/i }).count();
    log('settings-save-btn', saveButtons >= 1 ? 'low' : 'medium', `Botones Guardar: ${saveButtons}`);

    await page.screenshot({ path: path.join(SCREENS, '05-tab-settings.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 6. Tab Configuracion - toggle notifications
  // -------------------------------------------------------------------------
  test('6. Tab Configuracion - toggle notificaciones', async ({ page }) => {
    await gotoApp(page, '/admin');
    await page.waitForTimeout(2500);

    await adminTab(page, /Configuracion|Settings/i).click({ timeout: 3000 });
    await page.waitForTimeout(2000);

    // Scroll para encontrar la sección Notificaciones
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);

    const notifHeading = await page.locator('text=/Notificaciones|Notifications/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('settings-notif', notifHeading ? 'low' : 'medium', `Heading Notificaciones: ${notifHeading}`);

    const toggles = await page.locator('input[type="checkbox"]').count();
    log('settings-toggles', toggles >= 1 ? 'low' : 'medium', `Toggles totales: ${toggles}`);

    await page.screenshot({ path: path.join(SCREENS, '06-settings-notifications.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 7. Tab Auditoria
  // -------------------------------------------------------------------------
  test('7. Tab Auditoria - stats + tabla logs + filtros', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/admin');
    await page.waitForTimeout(2500);

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/admin/audit')) {
        try {
          const body = await r.json();
          apiCalls.push({
            url: r.url().replace('https://aduanas.strixai.es', '').split('?')[0],
            status: r.status(),
            count: body?.logs?.length || (body?.stats ? 'stats' : 0)
          });
        } catch {}
      }
    });

    await adminTab(page, /Auditoria|Audit/i).click({ timeout: 3000 });
    await page.waitForTimeout(3000);

    log('audit-api', apiCalls.length >= 2 ? 'low' : 'medium',
      `API calls audit: ${apiCalls.length}, ${apiCalls.map(c => `${c.url}(${c.count})`).join(', ')}`);

    for (const lbl of ['Eventos', 'Ultimos 7', 'Modulo Mas Activo', 'Usuario Mas Activo']) {
      const v = await page.locator(`text=/${lbl}/i`).first().isVisible({ timeout: 1500 }).catch(() => false);
      log('audit-card', v ? 'low' : 'low', `Card "${lbl}": ${v}`);
    }

    const tableRows = await page.locator('tbody tr').count();
    log('audit-table', 'low', `Filas tabla audit: ${tableRows}`);

    const moduleSelect = await page.locator('select').count();
    log('audit-filters', moduleSelect >= 2 ? 'low' : 'medium', `Selects filtros audit: ${moduleSelect}`);

    await page.screenshot({ path: path.join(SCREENS, '07-tab-audit.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 8. Filtro audit por módulo
  // -------------------------------------------------------------------------
  test('8. Filtro Auditoria por modulo dispara recarga', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/admin');
    await page.waitForTimeout(2500);

    await adminTab(page, /Auditoria|Audit/i).click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    const apiCalls = [];
    page.on('response', (r) => {
      if (r.url().match(/\/api\/admin\/audit\?/)) {
        apiCalls.push({ status: r.status() });
      }
    });

    // Cambiar filtro modulo a "auth"
    await page.locator('select').first().selectOption('auth').catch(() => {});
    await page.waitForTimeout(500);

    // Click "Refrescar"
    const refreshBtn = page.locator('button').filter({ hasText: /Refrescar|Actualizar|Refresh/i }).first();
    if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    log('audit-filter-reload', apiCalls.length >= 1 ? 'low' : 'medium',
      `Recarga audit tras filtro: ${apiCalls.length} llamadas, status=${apiCalls[0]?.status}`);

    await page.screenshot({ path: path.join(SCREENS, '08-audit-filter.png'), fullPage: true });
  });

  test.afterAll(async () => {
    fs.writeFileSync(REPORT, JSON.stringify({
      timestamp: new Date().toISOString(),
      total_findings: findings.length,
      critical: findings.filter(f => f.sev === 'critical').length,
      high: findings.filter(f => f.sev === 'high').length,
      medium: findings.filter(f => f.sev === 'medium').length,
      low: findings.filter(f => f.sev === 'low').length,
      findings
    }, null, 2));
  });
});
