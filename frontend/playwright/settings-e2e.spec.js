// @ts-check
/**
 * E2E /settings — Configuracion de Organizacion (multi-tab tenant settings).
 *
 * Cobertura UI desde el front:
 *  1) Render base + h1 + 8 tabs + boton Guardar Cambios
 *  2) Tab General: campos org (nombre/slug/NIF/EORI/REA/tipo) + dirección + plan
 *  3) Tab Branding: logo upload + color picker + display name
 *  4) Tab Defaults: aduana/moneda/idioma/timezone/dateFormat
 *  5) Tab Notifications: 4 toggles
 *  6) Tab Security: MFA + sessionTimeout + IP whitelist + passwordPolicy
 *  7) Tab Roles: tabla 5 roles built-in + boton "Crear rol custom"
 *  8) Tab Customs: 5 países (2 enabled ES/NL + 3 "Proximamente") + EORI/Env + cert upload
 *  9) Tab Integrations: AEAT cert + API Key + Webhooks
 * 10) Boton Guardar global (mensaje feedback)
 *
 * Nota: pantalla NO tiene panel/boton IA dedicado (es config pura).
 * Solo 2 endpoints reales: PUT /api/tenant/eori + POST /api/certificates/upload.
 * Resto de campos vienen de mocks hardcoded en loadData() del componente.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'settings-e2e-screens');
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

// Devuelve el tab interno del settings nav (evita colisión con sidebar).
function settingsTab(page, re) {
  return page.locator('nav.-mb-px button').filter({ hasText: re }).first();
}

test.describe('Configuracion de Organizacion /settings', () => {
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
  // 1. Render base + 8 tabs
  // -------------------------------------------------------------------------
  test('1. Render base /settings + h1 + 8 tabs + boton Guardar', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    const titleOk = h1 && !/settings\.title/.test(h1) && /Configuracion|Settings|Ajustes/i.test(h1);
    log('h1', titleOk ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    // Subtitle no debe ser literal
    const subtitleLiteral = await page.locator('text="settings.subtitle"').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('subtitle-literal', !subtitleLiteral ? 'low' : 'high', `Literal "settings.subtitle" visible: ${subtitleLiteral}`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 8 tabs (los nombres están traducidos; verificar al menos los iconos+texto presentes)
    const expectedTabs = [
      /General/i,
      /Marca|Brand/i,
      /Valores por Defecto|Defaults/i,
      /Notificaciones|Notifications/i,
      /Seguridad|Security/i,
      /Roles|Permisos/i,
      /Aduanas|Customs/i,
      /Integraciones|Integrations/i,
    ];
    let tabsFound = 0;
    for (const re of expectedTabs) {
      const visible = await settingsTab(page, re).isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) tabsFound++;
    }
    log('tabs-count', tabsFound === 8 ? 'low' : 'medium', `Tabs visibles: ${tabsFound}/8`);

    // Boton Guardar Cambios en header
    const saveBtn = await page.locator('button').filter({ hasText: /Guardar|Save/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('save-btn', saveBtn ? 'low' : 'medium', `Boton Guardar Cambios visible: ${saveBtn}`);
  });

  // -------------------------------------------------------------------------
  // 2. Tab General
  // -------------------------------------------------------------------------
  test('2. Tab General - campos empresa + estado cuenta', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(3000);

    // El tab General es el default
    const orgName = await page.locator('input[type="text"]').first().inputValue().catch(() => '');
    log('general-orgname', orgName.length > 0 ? 'low' : 'medium', `Org name input: "${orgName}"`);

    const eoriField = await page.locator('text=/^EORI$/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('general-eori', eoriField ? 'low' : 'medium', `Label EORI visible: ${eoriField}`);

    const accountStatus = await page.locator('text=/active|activo|Plan:/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('general-status', accountStatus ? 'low' : 'low', `Estado cuenta visible: ${accountStatus}`);

    // BUG conocido: datos hardcoded mock ("Agencia Aduanera Demo")
    const isMockData = orgName.includes('Agencia Aduanera Demo') || orgName.includes('Demo');
    log('general-mock-data', isMockData ? 'medium' : 'low',
      `Datos del tenant son MOCK hardcoded: ${isMockData} (orgName="${orgName}", deberia cargar tenant real desde API)`);

    await page.screenshot({ path: path.join(SCREENS, '02-tab-general.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab Branding
  // -------------------------------------------------------------------------
  test('3. Tab Branding - logo + color picker + nombre', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    await settingsTab(page, /Marca|Brand/i).click({ timeout: 3000 });
    await page.waitForTimeout(1000);

    const colorPicker = await page.locator('input[type="color"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('branding-color', colorPicker ? 'low' : 'medium', `Color picker visible: ${colorPicker}`);

    const fileInput = await page.locator('input[type="file"]').first().count();
    log('branding-file-input', fileInput > 0 ? 'low' : 'medium', `Input file logo: ${fileInput}`);

    // Cambiar color a azul
    await page.locator('input[type="color"]').first().fill('#3B82F6').catch(() => {});
    await page.waitForTimeout(500);
    const colorValue = await page.locator('input[type="color"]').first().inputValue().catch(() => '');
    log('branding-color-change', colorValue.toLowerCase() === '#3b82f6' ? 'low' : 'medium', `Color tras cambio: ${colorValue}`);

    await page.screenshot({ path: path.join(SCREENS, '03-tab-branding.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 4. Tab Defaults
  // -------------------------------------------------------------------------
  test('4. Tab Defaults - aduana/moneda/idioma/timezone/fecha', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    await settingsTab(page, /Valores por Defecto|Defaults/i).click({ timeout: 3000 });
    await page.waitForTimeout(1000);

    const selects = await page.locator('select').count();
    log('defaults-selects', selects >= 4 ? 'low' : 'medium', `Selects en Defaults: ${selects} (esperado >=4)`);

    // Cambiar moneda a USD
    const currencySelect = page.locator('select').first();
    await currencySelect.selectOption('USD').catch(() => {});
    const v = await currencySelect.inputValue().catch(() => '');
    log('defaults-currency', v === 'USD' ? 'low' : 'medium', `Moneda tras cambio: ${v}`);

    await page.screenshot({ path: path.join(SCREENS, '04-tab-defaults.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 5. Tab Notifications
  // -------------------------------------------------------------------------
  test('5. Tab Notifications - 4 toggles', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    await settingsTab(page, /Notificaciones|Notifications/i).click({ timeout: 3000 });
    await page.waitForTimeout(1000);

    const toggles = await page.locator('input[type="checkbox"]').count();
    log('notif-toggles', toggles === 4 ? 'low' : 'medium', `Toggles en Notifications: ${toggles}`);

    // Toggle el primero (emailAlerts)
    const firstToggle = page.locator('input[type="checkbox"]').first();
    const initialChecked = await firstToggle.isChecked().catch(() => null);
    await firstToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    const afterChecked = await firstToggle.isChecked().catch(() => null);
    log('notif-toggle-change', initialChecked !== null && afterChecked !== initialChecked ? 'low' : 'medium',
      `Toggle 1 cambio ${initialChecked} -> ${afterChecked}`);

    await page.screenshot({ path: path.join(SCREENS, '05-tab-notifications.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 6. Tab Security
  // -------------------------------------------------------------------------
  test('6. Tab Security - MFA + sessionTimeout + IP whitelist + passwordPolicy', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    await settingsTab(page, /Seguridad|Security/i).click({ timeout: 3000 });
    await page.waitForTimeout(1000);

    const mfaToggle = await page.locator('input[type="checkbox"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('security-mfa', mfaToggle ? 'low' : 'medium', `MFA toggle visible: ${mfaToggle}`);

    const sessionTimeout = await page.locator('input[type="number"]').first().inputValue().catch(() => '');
    log('security-timeout', sessionTimeout === '480' || /\d+/.test(sessionTimeout) ? 'low' : 'medium', `sessionTimeout valor: ${sessionTimeout}`);

    const ipTextarea = await page.locator('textarea').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('security-ip', ipTextarea ? 'low' : 'medium', `IP whitelist textarea visible: ${ipTextarea}`);

    const passwordHeading = await page.locator('text=/Politica.*[Cc]ontrasena|[Pp]assword.*[Pp]olicy/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('security-pw-policy', passwordHeading ? 'low' : 'low', `Heading politica contrasena visible: ${passwordHeading}`);

    await page.screenshot({ path: path.join(SCREENS, '06-tab-security.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 7. Tab Roles
  // -------------------------------------------------------------------------
  test('7. Tab Roles - tabla 5 roles built-in + boton crear rol', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    await settingsTab(page, /^Roles/i).click({ timeout: 3000 });
    await page.waitForTimeout(1000);

    const rows = await page.locator('tbody tr').count();
    log('roles-rows', rows === 5 ? 'low' : 'medium', `Filas roles: ${rows} (esperado 5: admin/manager/agente/operator/viewer)`);

    // Roles built-in
    for (const r of ['Administrador', 'Gestor', 'Agente Aduanero', 'Operador', 'Visualizador']) {
      const visible = await page.locator(`td:has-text("${r}")`).first().isVisible({ timeout: 1000 }).catch(() => false);
      log('role', visible ? 'low' : 'medium', `Rol "${r}" visible: ${visible}`);
    }

    const createBtn = await page.locator('button').filter({ hasText: /Crear rol|Create.*role/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('roles-create-btn', createBtn ? 'low' : 'medium', `Boton crear rol custom visible: ${createBtn}`);

    await page.screenshot({ path: path.join(SCREENS, '07-tab-roles.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 8. Tab Customs - 5 países + toggle + EORI + Save
  // -------------------------------------------------------------------------
  test('8. Tab Customs - 5 paises (ES+NL enabled, BE+DE+FR Proximamente) + cert upload + save', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    await settingsTab(page, /Aduanas|Customs/i).click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // 5 países
    for (const c of ['Espana', 'Paises Bajos', 'Belgica', 'Alemania', 'Francia']) {
      const visible = await page.locator(`text=/${c}/`).first().isVisible({ timeout: 2000 }).catch(() => false);
      log('country', visible ? 'low' : 'medium', `Pais "${c}" visible: ${visible}`);
    }

    // 3 países "Proximamente"
    const proxCount = await page.locator('text=/Proximamente/').count();
    log('proximamente', proxCount === 3 ? 'low' : 'medium', `Etiquetas "Proximamente": ${proxCount}/3`);

    // Activar Países Bajos (toggle del segundo país NL)
    const nlBlock = page.locator('text=/Paises Bajos/').first().locator('xpath=ancestor::div[contains(@class, "border")][1]');
    await nlBlock.locator('input[type="checkbox"]').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    // Boton certificate upload
    const certUpload = await page.locator('button').filter({ hasText: /Subir certificado/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('customs-cert-btn', certUpload ? 'low' : 'medium', `Boton "Subir certificado" visible: ${certUpload}`);

    // Boton Guardar configuracion paises (dispara PUT /api/tenant/eori)
    const apiCalls = [];
    page.on('response', (r) => {
      if (r.url().includes('/api/tenant/eori')) {
        apiCalls.push({ status: r.status(), method: r.request().method() });
      }
    });

    const saveCountriesBtn = page.locator('button').filter({ hasText: /Guardar configuracion de paises/i }).first();
    if (await saveCountriesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveCountriesBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2500);
      log('customs-save', apiCalls.length > 0 ? 'low' : 'medium',
        `PUT /api/tenant/eori: ${apiCalls.length} llamadas, status=${apiCalls[0]?.status}`);
    }

    // Estado de conexión por país
    const connectionStatus = await page.locator('text=/Estado de conexion/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('customs-connection', connectionStatus ? 'low' : 'medium', `Estado de conexion por pais visible: ${connectionStatus}`);

    await page.screenshot({ path: path.join(SCREENS, '08-tab-customs.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 9. Tab Integrations
  // -------------------------------------------------------------------------
  test('9. Tab Integrations - AEAT cert + API Key + Webhooks', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    await settingsTab(page, /Integraciones|Integrations/i).click({ timeout: 3000 });
    await page.waitForTimeout(1000);

    for (const item of ['AEAT', 'API', 'Webhook']) {
      const visible = await page.locator(`text=/${item}/i`).first().isVisible({ timeout: 2000 }).catch(() => false);
      log('integration-card', visible ? 'low' : 'medium', `Card "${item}" visible: ${visible}`);
    }

    const manageBtn = await page.locator('button').filter({ hasText: /Gestionar|Manage/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    const configureBtn = await page.locator('button').filter({ hasText: /Configurar|Configure/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('integration-buttons', manageBtn && configureBtn ? 'low' : 'medium',
      `Botones Gestionar=${manageBtn}, Configurar=${configureBtn}`);

    await page.screenshot({ path: path.join(SCREENS, '09-tab-integrations.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 10. Boton Guardar Cambios global (header)
  // -------------------------------------------------------------------------
  test('10. Boton "Guardar Cambios" global muestra mensaje feedback', async ({ page }) => {
    await gotoApp(page, '/settings');
    await page.waitForTimeout(2500);

    const saveBtn = page.locator('button').filter({ hasText: /Guardar Cambios|Save Changes/i }).first();
    await saveBtn.click({ timeout: 3000 });
    await page.waitForTimeout(2000);

    const successMsg = await page.locator('text=/Configuracion guardada|Cambios guardados|Saved|guardad[ao] correctamente|saved successfully/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('save-feedback', successMsg ? 'low' : 'medium', `Mensaje feedback save: ${successMsg}`);

    await page.screenshot({ path: path.join(SCREENS, '10-save-feedback.png'), fullPage: true });
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
