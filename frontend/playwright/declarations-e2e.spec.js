// @ts-check
/**
 * E2E /declarations — wizard de generación H1/AES + envío AEAT desde la pantalla.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'declarations-test-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg, extra = {}) => findings.push({ cat, sev, msg, ...extra });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let testExpedition = null;

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Declarations E2E', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status()).toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;

    // Find an existing expedition with declaration generated
    const exps = await request.get('/api/expeditions?limit=20', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const list = (await exps.json())?.data?.expeditions || [];
    // Prefer a recent IMPORT with mrn (already submitted) — but for testing we want one ready
    testExpedition = list.find((e) => e.declaration?.mrn) || list[0];
    log('test-expedition', testExpedition ? 'low' : 'high',
      `Test expedition: ${testExpedition?.expeditionId} status=${testExpedition?.status} mrn=${testExpedition?.declaration?.mrn || 'none'}`);
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

  test('1. Render base /declarations', async ({ page }) => {
    await gotoApp(page, '/declarations');
    await page.screenshot({ path: path.join(SCREENS, '01-declarations-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', h1 ? 'low' : 'high', `h1="${h1?.trim()}"`);

    const esBadge = await page.locator('text=/Espana.*AEAT|Spain.*AEAT/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('country-badge', esBadge ? 'low' : 'medium', `Badge España AEAT visible: ${esBadge}`);

    const h1Btn = await page.locator('button').filter({ hasText: /H1.*Import|Importacion/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const aesBtn = await page.locator('button').filter({ hasText: /AES.*Export|Exportacion AES/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('type-buttons', h1Btn && aesBtn ? 'low' : 'medium',
      `Botones tipo: H1=${h1Btn} AES=${aesBtn}`);
  });

  test('2. Listado de expediciones disponible', async ({ page }) => {
    await gotoApp(page, '/declarations');
    await page.waitForTimeout(2000);

    const expRows = await page.locator('div.cursor-pointer').count();
    log('expeditions-list', expRows >= 1 ? 'low' : 'high',
      `Expediciones seleccionables en listado: ${expRows}`);
    await page.screenshot({ path: path.join(SCREENS, '02-expeditions-list.png'), fullPage: true });
  });

  test('3. Seleccionar H1 + expediente + opciones', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/declarations');
    await page.waitForTimeout(2000);

    // Tipo H1 (default ya, pero clickeo para asegurar)
    const h1Btn = page.locator('button').filter({ hasText: /H1.*Import|Importacion/i }).first();
    await h1Btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);

    // Seleccionar primera expedición
    const firstExp = page.locator('div.cursor-pointer').first();
    if (!await firstExp.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('select-exp', 'high', 'No hay expediciones para seleccionar');
      return;
    }
    await firstExp.click({ force: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '03-h1-selected.png'), fullPage: true });

    // Verificar que aparecen opciones (regimen, procedimiento)
    const regime = await page.locator('select').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('h1-options', regime ? 'low' : 'medium', `Opciones H1 (regimen) visibles: ${regime}`);
  });

  test('4. Generar H1', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page, '/declarations');
    await page.waitForTimeout(2000);

    // Click H1
    await page.locator('button').filter({ hasText: /H1.*Import|Importacion/i }).first().click({ force: true });
    await page.waitForTimeout(400);
    // Select first expedition
    await page.locator('div.cursor-pointer').first().click({ force: true });
    await page.waitForTimeout(800);

    // Click "Generar"
    const generateBtn = page.locator('button').filter({ hasText: /Generar/i }).first();
    if (!await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('generate-btn', 'medium', 'Botón Generar no visible');
      return;
    }
    await generateBtn.click({ force: true });
    await page.waitForTimeout(35_000);
    await page.screenshot({ path: path.join(SCREENS, '04-h1-generated.png'), fullPage: true });

    // Look for LRN or success toast
    const lrnVisible = await page.locator('text=/LRN/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const xmlVisible = await page.locator('text=/MessageHeader|Importacion|H1/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('h1-generated-ui', lrnVisible || xmlVisible ? 'low' : 'medium',
      `H1 generado en UI: LRN=${lrnVisible} XML=${xmlVisible}`);
  });

  test('5. Enviar H1 a AEAT desde pantalla', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page, '/declarations');
    await page.waitForTimeout(2000);

    // Auto-confirm dialog
    page.on('dialog', (d) => d.accept().catch(() => {}));

    // Select H1 + first expedition
    await page.locator('button').filter({ hasText: /H1.*Import|Importacion/i }).first().click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('div.cursor-pointer').first().click({ force: true });
    await page.waitForTimeout(800);

    // Generate first
    const generateBtn = page.locator('button').filter({ hasText: /^Generar/i }).first();
    if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateBtn.click({ force: true });
      await page.waitForTimeout(35_000);
    }

    // Click "Enviar AEAT"
    const sendBtn = page.locator('button').filter({ hasText: /Enviar.*AEAT|Send.*AEAT/i }).first();
    if (!await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('send-aeat-btn', 'medium', 'Botón "Enviar a AEAT" no visible (puede requerir docs validados)');
      return;
    }
    await sendBtn.click({ force: true });
    await page.waitForTimeout(15_000);
    await page.screenshot({ path: path.join(SCREENS, '05-h1-aeat-result.png'), fullPage: true });

    const channel = await page.locator('text=/CANAL VERDE|CANAL NARANJA|CANAL ROJO|Canal verde|Canal naranja|Canal rojo/i').first().textContent({ timeout: 3000 }).catch(() => null);
    log('aeat-h1-channel', channel ? 'low' : 'medium', `Canal AEAT mostrado: "${channel?.trim()}"`);

    const errorMsg = await page.locator('text=/error|Faltan documentos/i').first().textContent({ timeout: 2000 }).catch(() => null);
    if (errorMsg) log('aeat-h1-error', 'low', `AEAT respuesta legítima: "${errorMsg?.trim()?.slice(0, 100)}"`);
  });

  test('6. Tab AES (exportación)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/declarations');
    await page.waitForTimeout(2000);

    const aesBtn = page.locator('button').filter({ hasText: /AES.*Export|Exportacion AES/i }).first();
    if (!await aesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('aes-tab', 'medium', 'Botón AES no visible');
      return;
    }
    await aesBtn.click({ force: true });
    await page.waitForTimeout(2000);  // wait for filter re-render
    await page.screenshot({ path: path.join(SCREENS, '06-aes-tab.png'), fullPage: true });

    const exportCount = await page.locator('div.cursor-pointer').count();
    log('aes-export-count', 'low', `Tras click AES, expediciones export visibles: ${exportCount}`);

    if (exportCount > 0) {
      await page.locator('div.cursor-pointer').first().click({ force: true });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENS, '07-aes-selected.png'), fullPage: true });
    }
    log('aes-form', exportCount > 0 ? 'low' : 'medium', `AES form: exports visibles=${exportCount}`);
  });

  test('7. Generar AES', async ({ page }) => {
    test.setTimeout(90_000);
    await gotoApp(page, '/declarations');
    await page.waitForTimeout(2000);

    await page.locator('button').filter({ hasText: /AES.*Export|Exportacion AES/i }).first().click({ force: true });
    await page.waitForTimeout(2000);  // re-render

    const exportCount = await page.locator('div.cursor-pointer').count();
    if (exportCount === 0) {
      log('aes-no-exports', 'medium', 'No hay export expeditions visibles');
      return;
    }
    await page.locator('div.cursor-pointer').first().click({ force: true });
    await page.waitForTimeout(800);

    const genBtn = page.locator('button').filter({ hasText: /^Generar/i }).first();
    if (!await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('aes-gen-btn', 'medium', 'Botón Generar AES no visible');
      return;
    }
    await genBtn.click({ force: true });
    await page.waitForTimeout(25_000);
    await page.screenshot({ path: path.join(SCREENS, '08-aes-generated.png'), fullPage: true });

    const generated = await page.locator('text=/LRN|MessageHeader|Exportacion/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('aes-generated', generated ? 'low' : 'medium', `AES generado en UI: ${generated}`);
  });

  test('8. Asistente desde /declarations', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/declarations');
    const link = page.locator('a[href="/assistant"]').first();
    if (!await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('assistant-cta', 'medium', 'CTA asistente no visible');
      return;
    }
    await link.click({ force: true });
    await page.waitForURL(/\/assistant/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '09-assistant.png'), fullPage: true });
    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    const inputs = await page.locator('textarea, input[type="text"]').count();
    log('assistant-renders', !errorBoundary && inputs > 0 ? 'low' : 'high',
      `Asistente OK: errorBoundary=${errorBoundary} inputs=${inputs}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      testExpedition: testExpedition ? {
        _id: testExpedition._id,
        expeditionId: testExpedition.expeditionId,
        mrn: testExpedition.declaration?.mrn,
        channel: testExpedition.declaration?.channel
      } : null,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
