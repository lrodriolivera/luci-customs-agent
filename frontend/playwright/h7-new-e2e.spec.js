// @ts-check
/**
 * E2E /h7/new — formulario H7 directo (envios bajo valor < 150 EUR).
 * Render base, validacion, rellenado completo (envio + remitente + destinatario + 1 articulo + totales),
 * submit -> redirect /h7/:id, click "Enviar a AEAT" -> MRN + canal real PRE.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'h7-new-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let createdH7Id = null;
let createdH7Tracking = null;
let aeatMrn = null;
let aeatChannel = null;
let aeatStatus = null;

const TS = Date.now();

// Datos del formulario H7
const FORM = {
  // Envio
  trackingNumber: `LUCI-H7-NEW-${TS}`,
  carrierCode: 'DHL',
  customsOffice: 'ES002801', // Madrid - Barajas (ubicacion H7 PRE 2801EEEEEE activa)
  operationType: 'B2C',
  iossNumber: 'IM7770000020',
  ecommercePlatform: 'AMAZON',
  // Documento previo G4
  documentoPrevioTipo: 'N337',
  documentoPrevioRef: `G4-2801-2026-${String(TS).slice(-5)}`,
  garantiaGRN: '26ESAGL2800000054', // GRN PRE Jose Antonio
  // Remitente (no-EU)
  senderName: 'Shenzhen Tech Trading Co Ltd',
  senderEori: '',
  senderCountry: 'CN',
  senderStreet: 'Bao An District 123',
  senderCity: 'Shenzhen',
  senderPostalCode: '518000',
  // Destinatario (ES) - particular sin NIF para que AEAT lo trate como C08="P" (no test fallback)
  recipientName: 'Maria Garcia Lopez',
  recipientTaxId: '',
  recipientCountry: 'ES',
  recipientStreet: 'Calle Aduana 12, 3B',
  recipientCity: 'Madrid',
  recipientPostalCode: '28013',
  recipientProvince: 'Madrid',
  recipientEmail: `mgarcia.test+${TS}@example.com`,
  recipientPhone: '+34911234567',
  // Totales / costes
  shippingCost: '5.99',
  insuranceCost: '0',
  packages: '1',
  currency: 'EUR',
};

// Articulo (1 item dentro del array items[])
const ITEM = {
  description: 'Funda silicona movil iPhone 15 Pro',
  taricCode: '3926909790',
  quantity: '2',
  unitValue: '15.99',     // total = 31.98 (< 150 OK)
  netWeight: '0.3',
  countryOfOrigin: 'CN',
};

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

// React-friendly setter por name=
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

// Fill the article (articulo 1) - inputs without name attribute, by order/placeholder
async function fillFirstItem(page, item) {
  return page.evaluate((it) => {
    const setVal = (el, v) => {
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                  : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    // Description: input with placeholder "Ej: Funda movil silicona"
    const descInput = document.querySelector('input[placeholder*="Funda"]');
    let count = 0;
    if (descInput && setVal(descInput, it.description)) count++;

    // TARIC: input with placeholder "392690"
    const taricInput = document.querySelector('input[placeholder="392690"]');
    if (taricInput && setVal(taricInput, it.taricCode)) count++;

    // Country origin: maxLength=2, look inside item card (first one with placeholder "Ej: Funda...")
    const itemCard = descInput ? descInput.closest('div[class*="bg-gray-50"]') : null;
    if (itemCard) {
      const inputs = Array.from(itemCard.querySelectorAll('input'));
      // Find country input (maxLength=2 inside the item)
      const countryInput = inputs.find((i) => i.maxLength === 2);
      if (countryInput && setVal(countryInput, it.countryOfOrigin)) count++;

      // Quantity (number, min=1)
      const qtyInput = inputs.find((i) => i.type === 'number' && i.min === '1');
      if (qtyInput && setVal(qtyInput, it.quantity)) count++;

      // Unit value (number, step=0.01) - but skip readOnly (totalValue is readonly)
      const numInputs = inputs.filter((i) => i.type === 'number' && !i.readOnly);
      // Order inside item card: quantity (min=1), unitValue (step=0.01), totalValue(readOnly), netWeight (step=0.001)
      const unitValInput = numInputs.find((i) => i.step === '0.01');
      if (unitValInput && setVal(unitValInput, it.unitValue)) count++;

      const weightInput = numInputs.find((i) => i.step === '0.001');
      if (weightInput && setVal(weightInput, it.netWeight)) count++;
    }
    return count;
  }, item);
}

test.describe('H7 directo /h7/new — flujo completo + AEAT', () => {
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

  test('1. Render base /h7/new', async ({ page }) => {
    await gotoApp(page, '/h7/new');
    await page.screenshot({ path: path.join(SCREENS, '01-form-empty.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /H7/i.test(h1 || '') ? 'low' : 'high', `h1="${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Banner Reg. UE 2026/382
    const bannerVisible = await page.locator('text=/Reg.*2026.*382|franquicia.*150|derecho fijo|3.*EUR/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('eu-banner', bannerVisible ? 'low' : 'medium', `Banner Reg. (UE) 2026/382 visible: ${bannerVisible}`);

    // 5 secciones h2: Datos del envio, Remitente, Destinatario, Articulos, Totales
    const sectionCount = await page.locator('h2').count();
    log('sections', sectionCount >= 5 ? 'low' : 'medium',
      `Secciones h2 visibles: ${sectionCount} (esperado >= 5: envio, remitente, destinatario, articulos, totales)`);

    // Validacion campos obligatorios visibles (asterisco *)
    const requiredLabels = await page.locator('label:has-text("*")').count();
    log('required-labels', requiredLabels >= 6 ? 'low' : 'medium', `Labels con asterisco *: ${requiredLabels}`);

    // Submit button presente
    const submitBtnText = await page.locator('button[type="submit"]').first().textContent({ timeout: 3000 }).catch(() => null);
    log('submit-btn', /Crear.*H7/i.test(submitBtnText || '') ? 'low' : 'medium',
      `Submit btn text: "${submitBtnText?.trim()}"`);
  });

  test('2. Validacion: submit con form vacio', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/h7/new');
    await page.waitForTimeout(800);

    // Click submit con form practicamente vacio
    const submitBtn = page.locator('button[type="submit"]').first();
    if (!await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('submit-btn', 'medium', 'Boton submit no visible');
      return;
    }

    // El form tiene html5 required en inputs, asi que al hacer click nativo el browser lo bloquea.
    // Forzamos un submit programmatico para disparar el handler React y ver el toast.
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        // bypass html5 validation
        form.noValidate = true;
        form.requestSubmit();
      }
    });
    await page.waitForTimeout(1500);

    const errorToast = await page.locator('text=/tracking.*requerido|remitente.*requerido|destinatario.*requerido|articulos|valor/i').first().textContent({ timeout: 2000 }).catch(() => null);
    log('validation-toast', errorToast ? 'low' : 'medium',
      `Toast validacion form vacio: "${errorToast?.trim()?.slice(0, 100)}"`);
    await page.screenshot({ path: path.join(SCREENS, '02-validation-empty.png'), fullPage: true });
  });

  test('3. Rellenar formulario H7 completo', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/h7/new');
    await page.waitForTimeout(800);

    // 1) Header form fields by name=
    let filled = 0;
    let errors = [];
    for (const [name, value] of Object.entries(FORM)) {
      const r = await setByName(page, name, value);
      if (r.ok) filled++;
      else errors.push(name);
    }
    log('form-header-fill', filled >= 25 ? 'low' : 'medium',
      `Header llenos: ${filled}/${Object.keys(FORM).length} (errores: ${errors.slice(0, 5).join(', ')})`);

    await page.screenshot({ path: path.join(SCREENS, '03a-form-header-filled.png'), fullPage: true });

    // 2) Articulo 1
    const itemFilled = await fillFirstItem(page, ITEM);
    log('item-fill', itemFilled >= 5 ? 'low' : 'medium',
      `Articulo 1 campos llenos: ${itemFilled}/6`);

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '03b-form-item-filled.png'), fullPage: true });

    // Verificar resumen totales (panel azul abajo) - intrinseco = 2 * 15.99 = 31.98
    const intrinsicText = await page.locator('text=/Valor intrinseco/i').first().locator('..').textContent({ timeout: 3000 }).catch(() => null);
    log('summary-intrinsic', /31\.98/.test(intrinsicText || '') ? 'low' : 'medium',
      `Resumen valor intrinseco: ${intrinsicText?.replace(/\s+/g, ' ').trim()?.slice(0, 80)}`);

    const customsValueText = await page.locator('text=/Valor en aduana|CIF/i').first().locator('..').textContent({ timeout: 3000 }).catch(() => null);
    log('summary-customs', /37\.97/.test(customsValueText || '') ? 'low' : 'medium',
      `Resumen valor aduana: ${customsValueText?.replace(/\s+/g, ' ').trim()?.slice(0, 80)}`);

    await page.screenshot({ path: path.join(SCREENS, '04-form-complete.png'), fullPage: true });
  });

  test('4. Submit -> creacion H7 + redirect /h7/:id', async ({ page }) => {
    test.setTimeout(60_000);

    // Capturar respuesta POST /api/h7
    const apiResponses = [];
    page.on('response', async (res) => {
      const u = res.url();
      if (u.endsWith('/api/h7') && res.request().method() === 'POST') {
        try { apiResponses.push({ status: res.status(), body: await res.json() }); } catch {}
      }
    });

    await gotoApp(page, '/h7/new');
    await page.waitForTimeout(800);

    // Re-rellenar
    for (const [name, value] of Object.entries(FORM)) {
      await setByName(page, name, value);
    }
    await fillFirstItem(page, ITEM);
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENS, '05-pre-submit.png'), fullPage: true });

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click({ force: true });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENS, '06-post-submit.png'), fullPage: true });

    // Verificar respuesta API
    const last = apiResponses[apiResponses.length - 1];
    if (last) {
      const data = last.body?.data;
      createdH7Id = data?._id || data?.id;
      createdH7Tracking = data?.trackingNumber || data?.reference;
      log('h7-create', last.status < 400 && createdH7Id ? 'low' : 'high',
        `POST /api/h7 -> HTTP ${last.status} _id=${createdH7Id} tracking=${createdH7Tracking}`);
    } else {
      log('h7-create', 'high', 'No se capturo respuesta de POST /api/h7');
    }

    // Verificar redirect a /h7/:id
    const url = page.url();
    log('h7-redirect', /\/h7\/[a-f0-9]{20,}/.test(url) ? 'low' : 'medium',
      `URL post-submit: ${url.split('strixai.es')[1] || url}`);

    if (!createdH7Id && /\/h7\/[a-f0-9]{20,}/.test(url)) {
      createdH7Id = url.split('/h7/')[1].split('?')[0];
    }

    // Toast exito
    const successToast = await page.locator('text=/H7 creada correctamente|H7 created|exito/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('h7-toast', successToast ? 'low' : 'medium', `Toast exito visible: ${successToast}`);
  });

  test('5. Detalle H7 + envio AEAT real', async ({ page, request }) => {
    test.skip(!createdH7Id, 'No H7 created en test 4');
    test.setTimeout(120_000);

    page.on('dialog', (d) => d.accept().catch(() => {}));

    // Capturar respuesta POST /api/h7/:id/submit
    const submitResponses = [];
    page.on('response', async (res) => {
      const u = res.url();
      if (u.includes(`/api/h7/${createdH7Id}/submit`) || /\/api\/h7\/.+\/submit$/.test(u)) {
        try { submitResponses.push({ status: res.status(), body: await res.json() }); } catch {}
      }
    });

    await gotoApp(page, `/h7/${createdH7Id}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '07-detail-pre-aeat.png'), fullPage: true });

    // h1 y status badge visibles
    const detailH1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('detail-h1', detailH1 ? 'low' : 'medium', `Detail h1: "${detailH1?.trim()}"`);

    // Click "Enviar a AEAT"
    const sendBtn = page.locator('button').filter({ hasText: /Enviar.*AEAT/i }).first();
    if (!await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      log('h7-send-btn', 'high', 'Boton "Enviar a AEAT" no visible en detail');
      return;
    }
    await sendBtn.click({ force: true });
    log('h7-send-clicked', 'low', 'Boton "Enviar a AEAT" clickeado');

    // El submit a AEAT real puede tardar 10-30s
    await page.waitForTimeout(20_000);
    await page.screenshot({ path: path.join(SCREENS, '08-detail-post-aeat.png'), fullPage: true });

    if (submitResponses.length > 0) {
      const last = submitResponses[submitResponses.length - 1];
      const data = last.body?.data || last.body;
      aeatMrn = data?.mrn || data?.aeatResponse?.mrn;
      aeatChannel = data?.channel || data?.aeatResponse?.channel;
      aeatStatus = data?.status;
      log('h7-aeat-submit', last.status < 400 ? 'low' : 'high',
        `POST /submit HTTP ${last.status} mrn=${aeatMrn} channel=${aeatChannel} status=${aeatStatus} simulated=${data?.simulated ?? data?.aeatResponse?.simulated}`);
    } else {
      log('h7-aeat-submit', 'medium', 'No se capturo respuesta de submit AEAT');
    }

    // Estado final via API
    const detailRes = await request.get(`/api/h7/${createdH7Id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dBody = await detailRes.json();
    const dData = dBody?.data;
    aeatMrn = aeatMrn || dData?.mrn || dData?.aeatResponse?.mrn;
    aeatChannel = aeatChannel || dData?.channel || dData?.aeatResponse?.channel;
    aeatStatus = aeatStatus || dData?.status;
    log('h7-final-state', aeatMrn ? 'low' : 'medium',
      `Final: status=${dData?.status} mrn=${aeatMrn} channel=${aeatChannel} simulated=${dData?.aeatResponse?.simulated}`);

    // Banner MRN/canal visible en UI tras refresh
    await gotoApp(page, `/h7/${createdH7Id}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '09-detail-final-mrn.png'), fullPage: true });

    const mrnVisible = await page.locator(`text=/${aeatMrn || 'MRN'}/i`).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('mrn-banner', mrnVisible ? 'low' : 'medium', `MRN visible en UI: ${mrnVisible}`);

    const greenChannel = await page.locator('text=/canal verde|green channel|levante/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('green-channel-ui', greenChannel ? 'low' : 'medium', `Indicador canal/levante visible: ${greenChannel}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      formFields: Object.keys(FORM).length,
      itemFields: Object.keys(ITEM).length,
      createdH7Id, createdH7Tracking,
      aeatMrn, aeatChannel, aeatStatus,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== H7 CREATED: ${createdH7Id} (${createdH7Tracking}) ===`);
    console.log(`=== AEAT: mrn=${aeatMrn} channel=${aeatChannel} status=${aeatStatus} ===`);
    console.log(`=== REPORT ${REPORT} ===`);
  });
});
