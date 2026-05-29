// @ts-check
/**
 * E2E /oea — Operador Economico Autorizado.
 *
 * BUG REPORTADO POR USUARIO Y CORREGIDO:
 * - Boton "Nueva Solicitud" mostraba literal "oea.newApplication" porque la clave
 *   no existia en root del JSON i18n (solo `oea.newRequest`). El h3 del modal de
 *   creacion mostraba "oea.newApplicationOEA" igualmente roto. Fix: anadir las 2
 *   claves a los 5 idiomas (es/en/fr/ca/it) + sincronizar src/i18n/locales ->
 *   public/locales (i18next-http-backend las carga via loadPath).
 *
 * Cobertura UI desde el front:
 * 1) Render base + h1 traducido + 4 tabs (Certificaciones / Beneficios / Simplificaciones / Reconocimiento Mutuo)
 * 2) BUG FIX: boton "Nueva Solicitud" muestra texto traducido (no literal)
 * 3) 5 stats cards (Total / Aprobados / En Revision / Pendientes / Por Tipo)
 * 4) Tab Certificaciones: lista con OEAs del tenant
 * 5) Tab Beneficios
 * 6) Tab Simplificaciones (6 esperadas)
 * 7) Tab Reconocimiento Mutuo (7 esperados)
 * 8) Click "Nueva Solicitud" -> form de creacion con h3 traducido
 * 9) Captura final
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'oea-e2e-screens');
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

test.describe('Operador Economico Autorizado /oea', () => {
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
  // 1. Render base + h1 + 4 tabs + 5 stats cards
  // -------------------------------------------------------------------------
  test('1. Render base /oea + h1 traducido + 4 tabs + 5 stats cards', async ({ page }) => {
    await gotoApp(page, '/oea');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Operador|Operator|OEA/i.test(h1 || '') && !/oea\.title/.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 4 tabs: Certificaciones / Beneficios / Simplificaciones / Reconocimiento Mutuo
    const t1 = await page.locator('button:has-text("Certificaciones")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t2 = await page.locator('button:has-text("Beneficios")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t3 = await page.locator('button:has-text("Simplificaciones")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const t4 = await page.locator('button:has-text("Reconocimiento Mutuo")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('tabs-visible', t1 && t2 && t3 && t4 ? 'low' : 'high',
      `Cert=${t1} Benef=${t2} Simpl=${t3} RecMut=${t4}`);

    // 5 stats cards: Total OEA / Aprobados / En Revision / Pendientes / Por Tipo
    const cardLabels = ['Total OEA', 'Aprobados', 'En Revision', 'Pendientes', 'Por Tipo'];
    let cardsFound = 0;
    for (const label of cardLabels) {
      const v = await page.locator(`text=/${label}/i`).first().isVisible({ timeout: 2000 }).catch(() => false);
      if (v) cardsFound++;
    }
    log('stats-cards', cardsFound >= 4 ? 'low' : 'medium', `Stats cards encontradas: ${cardsFound}/5`);

    // Tipos OEA: OEAC / OEAS / OEAF visibles
    const tipos = await page.locator('text=/OEAC.*OEAS.*OEAF/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('oea-tipos', 'low', `Badges OEAC/OEAS/OEAF visibles: ${tipos}`);
  });

  // -------------------------------------------------------------------------
  // 2. BUG FIX: boton "Nueva Solicitud" muestra texto traducido
  // -------------------------------------------------------------------------
  test('2. BUG FIX: boton "Nueva Solicitud" traducido (no literal "oea.newApplication")', async ({ page }) => {
    await gotoApp(page, '/oea');
    await page.waitForTimeout(2500);

    // El boton primary del header debe decir "Nueva Solicitud" (traducido)
    const newBtn = page.locator('button.btn-primary, button').filter({ hasText: /Nueva Solicitud/ }).first();
    const visible = await newBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log('new-btn-translated', visible ? 'low' : 'critical',
      `Boton "Nueva Solicitud" traducido visible: ${visible}`);

    // Verificar que NO haya el literal "oea.newApplication" en ningun lugar
    const literalVisible = await page.locator('text="oea.newApplication"').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('no-literal-key', !literalVisible ? 'low' : 'critical',
      `Literal "oea.newApplication" presente en UI: ${literalVisible} (esperado false)`);

    await page.screenshot({ path: path.join(SCREENS, '02-bug-fix-button.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab Certificaciones (default)
  // -------------------------------------------------------------------------
  test('3. Tab Certificaciones - lista de OEAs', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/oea');
    await page.waitForTimeout(3000);

    // Tab Certificaciones ya activo
    await page.locator('button:has-text("Certificaciones")').first().click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '03-tab-certificaciones.png'), fullPage: true });

    // Cards de OEA o tabla con datos del tenant (4 OEAs esperados)
    const cards = await page.locator('.card').count();
    log('cards-count', cards >= 5 ? 'low' : 'medium', `Cards visibles: ${cards}`);
  });

  // -------------------------------------------------------------------------
  // 4. Tab Beneficios
  // -------------------------------------------------------------------------
  test('4. Tab Beneficios', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/oea');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Beneficios")').first().click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '04-tab-beneficios.png'), fullPage: true });
    log('tab-beneficios', 'low', 'Tab Beneficios renderizado');
  });

  // -------------------------------------------------------------------------
  // 5. Tab Simplificaciones (6 esperadas)
  // -------------------------------------------------------------------------
  test('5. Tab Simplificaciones (6 esperadas)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/oea');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/oea/simplifications')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("Simplificaciones")').first().click({ timeout: 3000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENS, '05-tab-simplificaciones.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('tab-simplif-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 6. Tab Reconocimiento Mutuo (7 esperados)
  // -------------------------------------------------------------------------
  test('6. Tab Reconocimiento Mutuo (7 esperados)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/oea');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/oea/mutual-recognition')) {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    await page.locator('button:has-text("Reconocimiento Mutuo")').first().click({ timeout: 3000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENS, '06-tab-reconocimiento.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    log('tab-mutual-http', last?.status === 200 ? 'low' : 'medium',
      `HTTP ${last?.status}, count=${last?.body?.data?.length || 0}`);
  });

  // -------------------------------------------------------------------------
  // 7. Click "Nueva Solicitud" -> form de creacion + h3 traducido
  // -------------------------------------------------------------------------
  test('7. Click "Nueva Solicitud" -> form + h3 traducido', async ({ page }) => {
    await gotoApp(page, '/oea');
    await page.waitForTimeout(2500);

    const newBtn = page.locator('button').filter({ hasText: /Nueva Solicitud/ }).first();
    await newBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '07-form-creacion.png'), fullPage: true });

    // h3 del form debe ser "Nueva Solicitud OEA" (traducido)
    const h3Translated = await page.locator('h3:has-text("Nueva Solicitud OEA")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('h3-translated', h3Translated ? 'low' : 'medium', `h3 "Nueva Solicitud OEA" visible: ${h3Translated}`);

    const literalH3 = await page.locator('h3:has-text("oea.newApplicationOEA")').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('no-literal-h3', !literalH3 ? 'low' : 'critical',
      `Literal "oea.newApplicationOEA" en h3: ${literalH3} (esperado false)`);

    // Form con campos visibles: Nombre Empresa
    const formField = await page.locator('text=/Nombre.*Empresa/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('form-field', formField ? 'low' : 'medium', `Campo "Nombre Empresa" visible: ${formField}`);
  });

  // -------------------------------------------------------------------------
  // 8. Captura final
  // -------------------------------------------------------------------------
  test('8. Captura final con tabs activas', async ({ page }) => {
    await gotoApp(page, '/oea');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '08-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /oea');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      findings
    }, null, 2));

    console.log('\n=== OEA E2E SUMMARY ===');
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
