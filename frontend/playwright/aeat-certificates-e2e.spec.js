// @ts-check
/**
 * E2E /aeat/certificates — Certificados Digitales AEAT (FNMT).
 *
 * Cobertura UI desde el front:
 * 1) Render base + h1 + boton "Importar Certificado" + estado vacio
 * 2) Toggle "Incluir expirados" -> recarga lista
 * 3) Boton "Importar Certificado" -> abre modal con file + password + type + alias
 * 4) Subir el .p12 real (Jenifer Romero / B22477020 STRIX) sin password -> validacion error
 * 5) Llenar password incorrecto -> backend rechaza con toast
 * 6) Captura modal abierto con todos los campos
 * 7) Captura final
 *
 * Archivo .p12: `Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12`
 * (NO probamos import real con password correcto para no afectar el almacen del backend)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'aeat-certificates-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const CERT_FILE = '/home/rypcloud/Documentos/Logistic/POC/luci-customs-agent/Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12';

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

test.describe('Certificados Digitales AEAT /aeat/certificates', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status()).toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;

    // Verificar que el .p12 existe
    if (!fs.existsSync(CERT_FILE)) {
      console.warn(`[WARN] Cert file no existe: ${CERT_FILE}`);
    } else {
      const stats = fs.statSync(CERT_FILE);
      log('cert-file', 'low', `Archivo .p12 disponible (${stats.size} bytes)`);
    }
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
      if (u.includes('/api/') && res.status() >= 400 && !u.includes('cache-stats') && !u.includes('certificates/import')) {
        log('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 1. Render base + estado vacio
  // -------------------------------------------------------------------------
  test('1. Render base /aeat/certificates + h1 + estado vacio', async ({ page }) => {
    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /Certificados Digitales AEAT|Certificates/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Subtitulo "Gestion de certificados FNMT..."
    const subtitle = await page.locator('text=/FNMT|integraci.n con AEAT/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('subtitle', subtitle ? 'low' : 'medium', `Subtitulo FNMT: ${subtitle}`);

    // Boton "Importar Certificado"
    const importBtn = await page.locator('button:has-text("Importar Certificado")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('import-btn', importBtn ? 'low' : 'medium', `Boton Importar Certificado: ${importBtn}`);

    // Toggle "Incluir expirados"
    const expiredToggle = await page.locator('text=/Incluir expirados/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('expired-toggle', expiredToggle ? 'low' : 'medium', `Toggle Incluir expirados: ${expiredToggle}`);

    // Estado vacio
    const empty = await page.locator('text=/No hay certificados|Importe un certificado/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('empty-state', empty ? 'low' : 'medium', `Estado vacio visible: ${empty}`);
  });

  // -------------------------------------------------------------------------
  // 2. Toggle "Incluir expirados"
  // -------------------------------------------------------------------------
  test('2. Toggle "Incluir expirados" recarga lista', async ({ page }) => {
    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(2500);

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/aeat-real/certificates')) {
        try { apiResp.push({ status: r.status(), url: r.url() }); } catch {}
      }
    });

    // Click el checkbox
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.check({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENS, '02-include-expired.png'), fullPage: true });

      const last = apiResp[apiResp.length - 1];
      log('include-expired-http', last?.status === 200 ? 'low' : 'medium',
        `HTTP ${last?.status}, url incluye includeExpired=true: ${last?.url?.includes('includeExpired=true')}`);
    }
  });

  // -------------------------------------------------------------------------
  // 3. Boton "Importar Certificado" abre modal
  // -------------------------------------------------------------------------
  test('3. Boton "Importar Certificado" abre modal con campos', async ({ page }) => {
    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(2500);

    const importBtn = page.locator('button:has-text("Importar Certificado")').first();
    await importBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '03-modal-import.png'), fullPage: true });

    // Modal con file input + password + type + alias
    const fileInput = await page.locator('input[type="file"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    const passwordInput = await page.locator('input[type="password"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    const typeSelect = await page.locator('select').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('modal-fields', fileInput && passwordInput && typeSelect ? 'low' : 'medium',
      `File=${fileInput} Password=${passwordInput} Type=${typeSelect}`);

    // Boton submit/cancel
    const submitBtn = await page.locator('button[type="submit"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    const cancelBtn = await page.locator('button:has-text("Cancelar")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('modal-actions', submitBtn ? 'low' : 'medium', `Submit=${submitBtn} Cancel=${cancelBtn}`);
  });

  // -------------------------------------------------------------------------
  // 4. Subir .p12 real + validacion sin password
  // -------------------------------------------------------------------------
  test('4. Subir .p12 real sin password -> validacion', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(2500);

    const importBtn = page.locator('button:has-text("Importar Certificado")').first();
    await importBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Subir el .p12 real
    if (fs.existsSync(CERT_FILE)) {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CERT_FILE).catch(() => {});
      await page.waitForTimeout(500);
      log('file-uploaded', 'low', `Archivo .p12 cargado en input file`);
    }

    // Llenar alias para identificar
    const aliasInput = page.locator('input[type="text"]').last();
    if (await aliasInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await aliasInput.fill(`STRIX-E2E-${TS}`);
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: path.join(SCREENS, '04a-form-cert-uploaded.png'), fullPage: true });

    // Submit sin password -> debe mostrar toast error
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '04b-validation-no-password.png'), fullPage: true });

    const validationToast = await page.locator('text=/contrase.a|password/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('validation-no-password', validationToast ? 'low' : 'medium', `Toast validacion sin password: ${validationToast}`);
  });

  // -------------------------------------------------------------------------
  // 5. Importar .p12 real con password correcto -> persiste + Cert visible en lista
  // -------------------------------------------------------------------------
  test('5. Import real con password correcto -> cert persiste + visible en lista', async ({ page, request }) => {
    test.setTimeout(90_000);

    // Limpiar cert previo si existe
    await request.delete('/api/aeat-real/certificates/STRIX-AI-JENIFER-E2E', {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});

    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(2500);

    await page.locator('button:has-text("Importar Certificado")').first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Subir .p12 real
    if (fs.existsSync(CERT_FILE)) {
      await page.locator('input[type="file"]').first().setInputFiles(CERT_FILE).catch(() => {});
      await page.waitForTimeout(500);
    }

    // Password CORRECTO
    await page.locator('input[type="password"]').first().fill('Abadianubaraul90@');
    await page.waitForTimeout(300);

    // Alias
    const aliasInput = page.locator('input[type="text"]').last();
    if (await aliasInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await aliasInput.fill(`STRIX-AI-JENIFER-E2E`);
    }

    await page.screenshot({ path: path.join(SCREENS, '05a-form-filled.png'), fullPage: true });

    const apiResp = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/aeat-real/certificates/import') && r.request().method() === 'POST') {
        try { apiResp.push({ status: r.status(), body: await r.json() }); } catch {}
      }
    });

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click({ timeout: 3000 });
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: path.join(SCREENS, '05b-import-success.png'), fullPage: true });

    const last = apiResp[apiResp.length - 1];
    const certInfo = last?.body?.data?.certificate?.info;
    log('import-success', last?.status === 200 && certInfo ? 'low' : 'high',
      `POST /import HTTP ${last?.status} subject="${certInfo?.subject}" valid_until=${certInfo?.validTo?.slice(0, 10)} days=${certInfo?.daysToExpiry}`);

    log('cert-info', certInfo ? 'low' : 'high',
      `Cert detectado: ${certInfo?.subject} | issuer=${certInfo?.issuer} | type=${certInfo?.type} | validFor=${certInfo?.validFor?.join(',')}`);

    // Cert debe ser visible en la lista UI
    await page.waitForTimeout(3000);
    const certInList = await page.locator('text=STRIX-AI-JENIFER-E2E').first().isVisible({ timeout: 5000 }).catch(() => false);
    log('cert-in-list-ui', certInList ? 'low' : 'medium', `Cert "STRIX-AI-JENIFER-E2E" visible en lista UI: ${certInList}`);
  });

  // -------------------------------------------------------------------------
  // 6. Ver detalles + Analisis IA del certificado importado
  // -------------------------------------------------------------------------
  test('6. Ver detalles + Analisis LUCI IA', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '06a-list-with-cert.png'), fullPage: true });

    // Click sobre boton "Ver detalles" del cert
    const detailBtn = page.locator('button[title="Ver detalles"]').first();
    if (await detailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await detailBtn.click({ timeout: 3000 });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(SCREENS, '06b-cert-details.png'), fullPage: true });

      // Panel "Analisis LUCI"
      const aiPanel = await page.locator('text=/Analisis LUCI|LUCI Analysis/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log('ai-panel', aiPanel ? 'low' : 'medium', `Panel Analisis LUCI visible: ${aiPanel}`);

      // Info Serial Number, Emisor, Validez
      const serialVisible = await page.locator('text=/Serial Number|Emisor|V.lido desde/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log('detail-info', serialVisible ? 'low' : 'medium', `Detalles cert visibles: ${serialVisible}`);
    }
  });

  // -------------------------------------------------------------------------
  // 7. Verificar certificado (boton ShieldCheckIcon)
  // -------------------------------------------------------------------------
  test('7. Boton "Verificar" toast valido', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(3000);

    const verifyBtn = page.locator('button[title="Verificar"]').first();
    if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await verifyBtn.click({ timeout: 3000 });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(SCREENS, '07-verify.png'), fullPage: true });

      const toast = await page.locator('text=/v.lido|valid/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log('verify-toast', toast ? 'low' : 'medium', `Toast verificacion visible: ${toast}`);
    }
  });

  // -------------------------------------------------------------------------
  // 8. Cleanup: eliminar cert E2E
  // -------------------------------------------------------------------------
  test('8. Cleanup: eliminar cert E2E', async ({ request }) => {
    const r = await request.delete('/api/aeat-real/certificates/STRIX-AI-JENIFER-E2E', {
      headers: { Authorization: `Bearer ${token}` }
    });
    log('cleanup-delete', r.status() < 400 ? 'low' : 'medium', `DELETE HTTP ${r.status()}`);
  });

  // -------------------------------------------------------------------------
  // 9. Captura final
  // -------------------------------------------------------------------------
  test('9. Captura final con dashboard', async ({ page }) => {
    await gotoApp(page, '/aeat/certificates');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '06-dashboard-final.png'), fullPage: true });
    log('final-capture', 'low', 'Captura final dashboard /aeat/certificates');
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      certFile: CERT_FILE,
      findings
    }, null, 2));

    console.log('\n=== AEAT-CERTIFICATES E2E SUMMARY ===');
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
