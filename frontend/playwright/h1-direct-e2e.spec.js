// @ts-check
/**
 * E2E /declarations/h1/new — formulario directo H1 (DUA Importación).
 * Rellena las casillas oficiales 1-54 y prueba submit + validaciones.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'h1-direct-test-screens');
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

// Set value on a form field via React-friendly setter
async function setByName(page, name, value) {
  return page.evaluate(({ n, v }) => {
    const el = document.querySelector(`[name="${n}"]`);
    if (!el) return { ok: false, reason: 'not found' };
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }, { n: name, v: value });
}

// H1 form data — every field a customs broker would fill
const FORM = {
  // Casilla 1: Tipo
  declarationType: 'IM',
  declarationAdditional: 'A',
  // Casilla 7: Referencia
  referenceNumber: 'REF-H1-DIRECT-2026',
  // Casilla 2: Expedidor (no-EU)
  senderName: 'Anatolian Mobilya AS',
  senderAddress: 'Organize Sanayi Bolgesi 12',
  senderCity: 'Istanbul',
  senderPostal: '34000',
  senderCountry: 'TR',
  // Casilla 8: Destinatario (importador en ES)
  recipientName: 'STRIX AI SL',
  recipientEori: 'ESB22477020',
  recipientAddress: 'Calle Aduana 12',
  recipientCity: 'Madrid',
  recipientPostal: '28013',
  recipientCountry: 'ES',
  // Casilla 9: Responsable financiero
  financialResponsible: 'ESB22477020',
  // Casilla 14: Declarante
  declarantStatus: '2',
  declarantEori: 'ESB22477020',
  declarantName: 'STRIX AI SL',
  declarantAddress: 'Calle Aduana 12, Madrid',
  // Casilla 15: País expedición
  dispatchCountryCode: 'TR',
  dispatchCountryName: 'Turquia',
  // Casilla 17: País destino
  destinationCountry: 'ES',
  // Casilla 18: Identidad transporte
  transportIdAtDeparture: 'MAEU-2026-0429-VAL',
  // Casilla 19: Contenedor
  containers: '1',
  // Casilla 20: Incoterm
  incoterm: 'CIF',
  incotermLocation: 'Valencia',
  incotermCountry: 'ES',
  // Casilla 21: Nacionalidad transporte
  borderTransportNationality: 'TR',
  // Casilla 22: Moneda + factura
  currency: 'EUR',
  totalInvoiceAmount: '9500',
  exchangeRate: '1',
  // Casilla 24: Naturaleza transacción
  transactionNature: '11',
  // Casilla 25-26: Modo transporte
  borderTransportMode: '1',  // marítimo
  inlandTransportMode: '3',  // carretera
  // Casilla 29: Aduana
  customsOffice: 'ES000101',  // Valencia
  // Casilla 48: Aplazamiento
  defermentReference: '',
  // Casilla 49: Garantía
  guaranteeGRN: '26ESAGL2800000054',
  // Casilla 54: Lugar y fecha
  placeAndDate: 'Madrid, 29/04/2026'
};

test.describe('H1 Direct Form E2E', () => {
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

  test('1. Render base + secciones', async ({ page }) => {
    await gotoApp(page, '/declarations/h1/new');
    await page.screenshot({ path: path.join(SCREENS, '01-form-empty.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', h1 ? 'low' : 'high', `h1="${h1?.trim()}"`);
    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Sections (h2 elements)
    const sectionCount = await page.locator('h2').count();
    log('sections', sectionCount >= 5 ? 'low' : 'medium',
      `Secciones h2 visibles: ${sectionCount} (esperado >= 5: tipo, expedidor, destinatario, declarante, transporte, aduana, partidas, casilla 47, totales)`);

    // Specific sections
    const expectedSections = [
      'Tipo de declaracion',
      'Expedidor',
      'Destinatario',
      'Declarante',
      'Transporte',
      'Aduana',
      'Partidas',
      'Casilla 47',
      'Garantia'
    ];
    let visibleSections = 0;
    for (const s of expectedSections) {
      const found = await page.locator(`text=/${s}/i`).count();
      if (found > 0) visibleSections++;
    }
    log('expected-sections', visibleSections >= 6 ? 'low' : 'medium',
      `Secciones específicas detectadas: ${visibleSections}/${expectedSections.length}`);
  });

  test('2. Validación: submit con form vacío', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/declarations/h1/new');
    await page.waitForTimeout(800);

    // Click submit button (last button in form, usually "Crear declaracion H1")
    const submitBtn = page.locator('button[type="submit"]').first();
    if (!await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('submit-btn', 'medium', 'Botón submit no visible');
      return;
    }

    // Listen for toast
    const toastTexts = [];
    page.on('console', () => {});
    await submitBtn.click({ force: true });
    await page.waitForTimeout(1500);

    const toastVisible = await page.locator('[role="status"], .Toaster__manager-bottom, [class*="toast"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    const errorToast = await page.locator('text=/requerido|EORI declarante|TARIC.*partidas|Destinatario/i').first().textContent({ timeout: 2000 }).catch(() => null);
    log('validation-toast', errorToast ? 'low' : 'medium',
      `Toast validación form vacío: "${errorToast?.trim()?.slice(0, 80)}"`);
    await page.screenshot({ path: path.join(SCREENS, '02-validation-empty.png'), fullPage: true });
  });

  test('3. Rellenar formulario completo (50+ campos UI)', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page, '/declarations/h1/new');
    await page.waitForTimeout(800);

    // Fill all fields in FORM object
    let filled = 0;
    let errors = [];
    for (const [name, value] of Object.entries(FORM)) {
      const r = await setByName(page, name, value);
      if (r.ok) filled++;
      else errors.push(name);
    }
    log('form-fill', filled >= 30 ? 'low' : 'medium',
      `Campos llenos: ${filled}/${Object.keys(FORM).length} (errores: ${errors.slice(0, 5).join(', ')})`);

    await page.screenshot({ path: path.join(SCREENS, '03-form-filled-section1.png'), fullPage: false });

    // Now fill the goods item (partida)
    // Items are nested — need to find inputs in the partidas section
    const itemFilled = await page.evaluate(() => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                    : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                    : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      let count = 0;
      // Description (textarea inside partida)
      const ta = document.querySelector('textarea');
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, 'Colchones de espuma de poliuretano para uso residencial');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        count++;
      }
      // TARIC
      const taricInputs = Array.from(document.querySelectorAll('input[maxlength="10"]'));
      const taric = taricInputs.find((i) => /partida|taric/i.test(i.name || '') || taricInputs[0]);
      if (taric || taricInputs[0]) {
        const t = taric || taricInputs[0];
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(t, '9404211000');
        t.dispatchEvent(new Event('input', { bubbles: true }));
        count++;
      }
      // Origin country (input maxlength=2)
      const origins = Array.from(document.querySelectorAll('input[maxlength="2"]'));
      origins.forEach((o) => {
        if (!o.value) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(o, 'TR');
          o.dispatchEvent(new Event('input', { bubbles: true }));
          count++;
        }
      });
      // Number inputs (weights, value)
      const numInputs = Array.from(document.querySelectorAll('input[type="number"]'));
      const samples = ['1500', '1600', '9500', '50']; // weights, value, supp units
      numInputs.slice(0, 4).forEach((inp, idx) => {
        if (samples[idx] && !inp.readOnly && !inp.value) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(inp, samples[idx]);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          count++;
        }
      });
      return count;
    });
    log('item-fill', itemFilled >= 3 ? 'low' : 'medium',
      `Campos partida 1 llenados: ${itemFilled}`);

    await page.screenshot({ path: path.join(SCREENS, '04-form-filled-complete.png'), fullPage: true });
  });

  test('4. Submit del formulario completo', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page, '/declarations/h1/new');
    await page.waitForTimeout(800);

    // Re-fill all fields
    for (const [name, value] of Object.entries(FORM)) {
      await setByName(page, name, value);
    }

    // Fill goods
    await page.evaluate(() => {
      const setVal = (el, v) => {
        if (!el) return;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const ta = document.querySelector('textarea');
      setVal(ta, 'Colchones de espuma de poliuretano para uso residencial');
      const taric = document.querySelector('input[maxlength="10"]');
      setVal(taric, '9404211000');
      const origins = document.querySelectorAll('input[maxlength="2"]');
      origins.forEach((o) => { if (!o.value) setVal(o, 'TR'); });
      const numInputs = Array.from(document.querySelectorAll('input[type="number"]'));
      const samples = ['1500', '1600', '9500', '50'];
      numInputs.forEach((inp, idx) => {
        if (samples[idx] && !inp.readOnly && !inp.value) setVal(inp, samples[idx]);
      });
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '05-pre-submit.png'), fullPage: true });

    // Click submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click({ force: true });
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENS, '06-post-submit.png'), fullPage: true });

    const url = page.url();
    log('submit-redirect', !url.includes('/h1/new') ? 'low' : 'medium',
      `URL post-submit: ${url.split('strixai.es')[1] || url}`);

    // Toast success
    const successToast = await page.locator('text=/H1 creada correctamente|H1 generated|exito/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('submit-toast', successToast ? 'low' : 'medium', `Toast éxito visible: ${successToast}`);
  });

  test('5. Asistente desde /declarations/h1/new', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/declarations/h1/new');
    const link = page.locator('a[href="/assistant"]').first();
    if (!await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('assistant-cta', 'medium', 'CTA asistente no visible');
      return;
    }
    await link.click({ force: true });
    await page.waitForURL(/\/assistant/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '07-assistant.png'), fullPage: true });
    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    const inputs = await page.locator('textarea, input[type="text"]').count();
    log('assistant-renders', !errorBoundary && inputs > 0 ? 'low' : 'high',
      `Asistente OK: errorBoundary=${errorBoundary} inputs=${inputs}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      formFields: Object.keys(FORM).length,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
