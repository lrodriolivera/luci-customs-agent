// @ts-check
/**
 * Crea un H1 real desde la UI /declarations/h1/new.
 * Llena TODO el form y hace submit. Captura el resultado.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'create-h1-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

let token = null;
let user = null;
let createdId = null;
let createdExpeditionId = null;

test.use({ actionTimeout: 30_000 });

test.describe.configure({ mode: 'serial' });

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

const HEADER = {
  declarationType: 'IM',
  declarationAdditional: 'A',
  referenceNumber: 'REF-H1-UI-' + Date.now(),
  // Expedidor (Casilla 2)
  senderName: 'Anatolian Mobilya AS',
  senderAddress: 'Organize Sanayi Bolgesi 12',
  senderCity: 'Istanbul',
  senderPostal: '34000',
  senderCountry: 'TR',
  // Destinatario (Casilla 8)
  recipientName: 'STRIX AI SL',
  recipientEori: 'ESB22477020',
  recipientAddress: 'Calle Aduana 12',
  recipientCity: 'Madrid',
  recipientPostal: '28013',
  recipientCountry: 'ES',
  // Casilla 9
  financialResponsible: 'ESB22477020',
  // Declarante (Casilla 14)
  declarantStatus: '2',
  declarantEori: 'ESB22477020',
  declarantName: 'STRIX AI SL',
  declarantAddress: 'Calle Aduana 12, Madrid',
  // Casilla 15
  dispatchCountryCode: 'TR',
  dispatchCountryName: 'Turquia',
  destinationCountry: 'ES',
  // Transporte
  transportIdAtDeparture: 'MAEU-2026-0429-VAL',
  containers: '1',
  borderTransportNationality: 'TR',
  borderTransportMode: '1',  // marítimo
  inlandTransportMode: '3',  // carretera
  // Incoterm (Casilla 20)
  incoterm: 'CIF',
  incotermLocation: 'Valencia',
  incotermCountry: 'ES',
  // Casilla 22
  currency: 'EUR',
  totalInvoiceAmount: '9500',
  exchangeRate: '1',
  transactionNature: '11',
  // Casilla 29
  customsOffice: 'ES000101',  // Valencia
  // Casilla 49
  guaranteeGRN: '26ESAGL2800000054',
  // Casilla 54
  placeAndDate: 'Madrid, 29/04/2026'
};

const ITEM = {
  marks: 'STX-2026-001',
  containerNumber: 'MAEU1234567',
  packageCount: '50',
  packageType: 'CT',
  description: 'Colchones de espuma de poliuretano para uso residencial',
  taricCode: '94042110',  // 8 digitos (CN)
  taricAdditional: '00',  // 2 digitos (TARIC)
  countryOfOrigin: 'TR',
  grossWeight: '1600',
  netWeight: '1500',
  supplementaryUnits: '50',
  preference: '100',
  procedure: '4000',
  itemPrice: '9500',
  valuationMethod: '1',
  adjustment: '',
  // Casilla 44 - Documento factura
  doc1_code: 'N380',
  doc1_country: 'TR',
  doc1_ref: 'INV-2026-0429-MOBILYA',
};

const TAXES = [
  // A00 (Arancel) — 3.7% sobre 9500 = 351.50
  { classCode: 'A00', base: '9500', rate: '3.7', method: 'D' },
  // B00 (IVA) — 21% sobre 10500 (valor + arancel) = 2205
  { classCode: 'B00', base: '9851.50', rate: '21', method: 'D' },
];

test('Crear H1 real desde la UI completa', async ({ context, page, request }) => {
  test.setTimeout(180_000);

  // Login
  const r = await request.post('/api/auth/login', { data: TEST_USER });
  expect(r.status()).toBe(200);
  const body = await r.json();
  token = body?.data?.token;
  user = body?.data?.user;

  await context.addInitScript(({ t, u }) => {
    if (t) localStorage.setItem('token', t);
    if (u) localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('i18nextLng', 'es');
    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('cookies-accepted', 'true');
    localStorage.setItem('activeCustomsCountry', 'ES');
  }, { t: token, u: user });

  // Capture network errors
  const httpErrors = [];
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('/api/') && res.status() >= 400 && !u.includes('cache-stats')) {
      httpErrors.push({ status: res.status(), url: u.replace('https://aduanas.strixai.es', '') });
    }
  });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });

  // Step 1: Navigate
  await gotoApp(page, '/declarations/h1/new');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENS, '01-form-loaded.png'), fullPage: true });

  // Step 2: Fill header by name
  console.log('[H1] Filling header...');
  for (const [name, value] of Object.entries(HEADER)) {
    await page.evaluate(({ n, v }) => {
      const el = document.querySelector(`[name="${n}"]`);
      if (!el) return;
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                  : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                  : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { n: name, v: value });
  }
  console.log(`[H1] Header filled (${Object.keys(HEADER).length} fields)`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENS, '02-header-filled.png'), fullPage: true });

  // Step 3: Fill partida (item 1) by placeholder/structure
  console.log('[H1] Filling partida...');
  const itemFilled = await page.evaluate((it) => {
    const setVal = (el, v) => {
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                  : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                  : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    let count = 0;

    // Identify partida block (gray bg)
    const partidaBlock = document.querySelector('.bg-gray-50');
    if (!partidaBlock) return { ok: false, count };

    // Inputs by placeholder within partida
    const byPlaceholder = (re) => Array.from(partidaBlock.querySelectorAll('input, textarea, select'))
      .find((i) => re.test(i.placeholder || ''));

    // Marcas (placeholder N/M)
    if (setVal(byPlaceholder(/^N\/M$/i), it.marks)) count++;
    // Contenedor (placeholder MSKU...)
    if (setVal(byPlaceholder(/MSKU/i), it.containerNumber)) count++;

    // N. bultos (number input, first one in partida)
    const numberInputs = Array.from(partidaBlock.querySelectorAll('input[type="number"]'))
      .filter((i) => !i.readOnly);
    // Order: packageCount, grossWeight, netWeight, itemPrice
    if (numberInputs[0]) { setVal(numberInputs[0], it.packageCount); count++; }
    // Tipo bulto (maxLength=2 con placeholder CT)
    if (setVal(byPlaceholder(/^CT$/i), it.packageType)) count++;
    // Descripción (placeholder Mercancias)
    if (setVal(byPlaceholder(/Mercancias/i), it.description)) count++;
    // TARIC 8 dig (maxLength=8, placeholder 84713000)
    if (setVal(byPlaceholder(/84713000/i), it.taricCode)) count++;
    // TARIC adicional (maxLength=4, placeholder "00")
    const taricAdd = Array.from(partidaBlock.querySelectorAll('input[maxlength="4"]'))[0];
    if (setVal(taricAdd, it.taricAdditional)) count++;
    // Origen (maxLength=2, placeholder CN)
    if (setVal(byPlaceholder(/^CN$/i), it.countryOfOrigin)) count++;

    // grossWeight, netWeight
    if (numberInputs[1]) { setVal(numberInputs[1], it.grossWeight); count++; }
    if (numberInputs[2]) { setVal(numberInputs[2], it.netWeight); count++; }

    // Supplementary units (no placeholder, sin type=number — input texto)
    // Está después de masa neta y antes de Preferencia. Buscarlo por orden.
    // Mejor: inputs sin placeholder ni type=number en la fila de pesos
    const allItemInputs = Array.from(partidaBlock.querySelectorAll('input'));
    // Casilla 41 supplementaryUnits es text (no number ni select) — buscamos uno que no tiene maxLength fija
    // Try: item.supplementaryUnits is in row 2 (TARIC, origin, weights, supp)
    // It's a text input WITHOUT type='number' and not maxLength=2 nor =4 nor =8
    const suppInput = allItemInputs.find((i) =>
      i.type !== 'number' && i.type !== 'hidden' &&
      !i.readOnly && !i.maxLength && i.value === '' &&
      i.parentElement?.previousElementSibling?.textContent?.includes('41'));
    if (setVal(suppInput, it.supplementaryUnits)) count++;

    // Casilla 42 itemPrice (next number input)
    if (numberInputs[3]) { setVal(numberInputs[3], it.itemPrice); count++; }

    // Selects: preference, procedure, valuationMethod
    const selects = Array.from(partidaBlock.querySelectorAll('select'));
    // 0: Preferencia, 1: Régimen (procedure), 2: Cod M.E. (valuation)
    if (selects[0]) { setVal(selects[0], it.preference); count++; }
    if (selects[1]) { setVal(selects[1], it.procedure); count++; }
    if (selects[2]) { setVal(selects[2], it.valuationMethod); count++; }

    // Adjustment (placeholder "+5 / -3")
    if (setVal(byPlaceholder(/\+5|\-3/), it.adjustment || '')) count++;

    // Documento Casilla 44 (within nested .bg-white)
    const docBlock = partidaBlock.querySelector('.bg-white');
    if (docBlock) {
      // 3 inputs: code (placeholder N380), country (maxLength=2, placeholder ES), reference
      const docInputs = Array.from(docBlock.querySelectorAll('input'));
      const docCode = docInputs.find((i) => /N380|C514|N740/.test(i.placeholder || ''));
      const docCountry = docInputs.find((i) => i.maxLength === 2 && i.placeholder === 'ES');
      const docRef = docInputs.find((i) => /referencia/i.test(i.placeholder || ''));
      if (setVal(docCode, it.doc1_code)) count++;
      if (setVal(docCountry, it.doc1_country)) count++;
      if (setVal(docRef, it.doc1_ref)) count++;
    }

    return { ok: true, count };
  }, ITEM);
  console.log(`[H1] Partida fields filled: ${itemFilled.count}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENS, '03-partida-filled.png'), fullPage: true });

  // Step 4: Fill tributos (Casilla 47)
  console.log('[H1] Filling tributos...');
  const taxesFilled = await page.evaluate((taxes) => {
    const setVal = (el, v) => {
      if (!el) return false;
      const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                  : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    // The taxes section is identified by "Calculo de tributos" h2
    let taxSection = null;
    const sections = document.querySelectorAll('div.bg-white');
    for (const s of sections) {
      const h2 = s.querySelector('h2');
      if (h2 && /Calculo de tributos|Casilla 47/i.test(h2.textContent || '')) {
        taxSection = s;
        break;
      }
    }
    if (!taxSection) return { ok: false, count: 0 };

    let count = 0;

    // Click "Agregar linea" to have 2 tax rows (we already have 1)
    const addLine = Array.from(taxSection.querySelectorAll('button')).find((b) => /Agregar linea/.test(b.textContent || ''));
    if (addLine && taxes.length > 1) {
      addLine.click();
    }

    // After re-render, get all rows (grid-cols-12)
    setTimeout(() => {}, 100);

    return { ok: true, count, _section: !!taxSection, _addLine: !!addLine };
  }, TAXES);

  await page.waitForTimeout(500);

  // Now fill each tax row (after potential add)
  const taxRowsFilled = await page.evaluate((taxes) => {
    const setVal = (el, v) => {
      if (!el) return false;
      const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                  : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    let taxSection = null;
    const sections = document.querySelectorAll('div.bg-white');
    for (const s of sections) {
      const h2 = s.querySelector('h2');
      if (h2 && /Calculo de tributos|Casilla 47/i.test(h2.textContent || '')) {
        taxSection = s;
        break;
      }
    }
    if (!taxSection) return { ok: false, count: 0 };

    // Each row is .grid.grid-cols-12 (skip header row)
    const rows = Array.from(taxSection.querySelectorAll('.grid.grid-cols-12'))
      .filter((r) => r.querySelector('select') || r.querySelector('input[type="number"]'));

    let count = 0;
    rows.forEach((row, idx) => {
      const tax = taxes[idx];
      if (!tax) return;
      const selects = row.querySelectorAll('select');
      const numberInputs = Array.from(row.querySelectorAll('input[type="number"]')).filter((i) => !i.readOnly);

      // selects[0] = classCode
      if (selects[0]) { setVal(selects[0], tax.classCode); count++; }
      // numberInputs[0] = base, [1] = rate
      if (numberInputs[0]) { setVal(numberInputs[0], tax.base); count++; }
      if (numberInputs[1]) { setVal(numberInputs[1], tax.rate); count++; }
      // selects[1] = method
      if (selects[1]) { setVal(selects[1], tax.method); count++; }
    });

    return { ok: true, count, rows: rows.length };
  }, TAXES);
  console.log(`[H1] Taxes filled: ${taxRowsFilled.count} fields across ${taxRowsFilled.rows} rows`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENS, '04-taxes-filled.png'), fullPage: true });

  // Step 5: Submit
  console.log('[H1] Submitting form...');
  await page.screenshot({ path: path.join(SCREENS, '05-pre-submit.png'), fullPage: true });

  const submitBtn = page.locator('button[type="submit"]').last();
  await submitBtn.click({ force: true });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(8000);

  const url = page.url();
  console.log(`[H1] Post-submit URL: ${url}`);
  await page.screenshot({ path: path.join(SCREENS, '06-post-submit.png'), fullPage: true });

  // Detect redirect to /expeditions/:id
  const redirected = /\/expeditions\/[a-f0-9]{20,}/.test(url);
  if (redirected) {
    createdId = url.split('/expeditions/')[1].split('?')[0];
    console.log(`[H1] ✓ Redirected to /expeditions/${createdId}`);
    // Pull info
    const detail = await request.get(`/api/expeditions/${createdId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const detailBody = await detail.json();
    createdExpeditionId = detailBody?.data?.expeditionId;
    console.log(`[H1] expeditionId=${createdExpeditionId} status=${detailBody?.data?.status} declType=${detailBody?.data?.declaration?.type} lrn=${detailBody?.data?.declaration?.lrn}`);
    await page.screenshot({ path: path.join(SCREENS, '07-expedition-detail.png'), fullPage: true });
  } else {
    console.log('[H1] ⚠ No redirect — checking for toast errors');
    const errToast = await page.locator('[class*="toast"], [role="status"]').first().textContent({ timeout: 2000 }).catch(() => null);
    console.log(`[H1] Toast: "${errToast?.trim()}"`);
  }

  fs.writeFileSync(REPORT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    redirected, createdId, createdExpeditionId,
    headerFields: Object.keys(HEADER).length,
    itemFields: itemFilled.count,
    taxFields: taxRowsFilled.count,
    httpErrors, consoleErrors,
    finalUrl: url
  }, null, 2));
});
