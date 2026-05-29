// @ts-check
/**
 * E2E Expediciones — flujos avanzados:
 *  1. Form 100% UI (3 pasos rellenados manualmente)
 *  2. Validar documentos PENDING → VALIDATED
 *  3. Generar declaración H1
 *  4. Enviar portal link al cliente
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'expeditions-advanced-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg, extra = {}) => findings.push({ cat, sev, msg, ...extra });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let uiCreatedMongoId = null;
let uiCreatedExpId = null;
let apiExpedMongoId = null;
let apiExpedId = null;
let uploadedDocIds = [];

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

function fakePdf(label) {
  const stream = `BT /F1 12 Tf 50 750 Td (${label.replace(/[()\\]/g, '')}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000054 00000 n
0000000099 00000 n
0000000185 00000 n
0000000${(255 + stream.length).toString().padStart(3, '0')} 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
${300 + stream.length}
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

// Helper: set input/textarea value reliably (bypasses overlays + React's controlled input quirks)
async function setValue(page, selector, value, nth = 0) {
  return page.evaluate(({ sel, val, n }) => {
    const els = document.querySelectorAll(sel);
    if (els.length <= n) return { ok: false, count: els.length };
    const el = els[n];
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }, { sel: selector, val: value, n: nth });
}

async function clickByText(page, text) {
  return page.evaluate((txt) => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const btn = buttons.find((b) => (b.textContent || '').trim() === txt
      || (b.textContent || '').trim().startsWith(txt));
    if (btn) { btn.click(); return true; }
    return false;
  }, text);
}

test.describe('Expediciones flujos avanzados', () => {
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
    }, { t: token, u: user });
    page.on('pageerror', (err) => log('page-error', 'critical', err.message));
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/api/') && res.status() >= 400) {
        log('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  // =========================================================================
  // FLUJO 1: Crear expediente 100% via UI (3 pasos manuales)
  // =========================================================================

  test('1.1 — Step 1: País + Tipo + Cliente + Exportador', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/expeditions/new');
    await page.screenshot({ path: path.join(SCREENS, '11-step1-empty.png'), fullPage: true });

    // País España (already selected by default but click for safety)
    await clickByText(page, 'Espana');
    await page.waitForTimeout(200);

    // Tipo Importación (default)
    await clickByText(page, 'Importacion');
    await page.waitForTimeout(200);

    // Importador (Cliente) — fill by id labels via setValue
    // Razon Social * is the first text input in the client section
    // We use evaluate to find inputs after the "Importador" heading
    const clientFilled = await page.evaluate(() => {
      // Find inputs by label text via DOM walk
      const result = { filled: 0, errors: [] };
      const setVal = (input, val) => {
        if (!input) return false;
        const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const findInputByLabel = (labelText) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const lbl = labels.find((l) => (l.textContent || '').trim().startsWith(labelText));
        if (!lbl) return null;
        const id = lbl.getAttribute('for');
        if (id) return document.getElementById(id);
        // sibling input
        const parent = lbl.parentElement;
        return parent?.querySelector('input, textarea, select');
      };
      const fields = {
        'Razon Social': 'ACME Importadora UI Test SL',
        'NIF/CIF': 'B22477020',
        'EORI': 'ESB22477020',
        'Direccion': 'Calle Mayor 1',
        'Ciudad': 'Madrid',
        'Codigo Postal': '28013',
        'Email': 'importador-ui@acme.es',
        'Telefono': '+34 911 222 333'
      };
      for (const [k, v] of Object.entries(fields)) {
        const inp = findInputByLabel(k);
        if (inp && setVal(inp, v)) result.filled++;
        else result.errors.push(`no input: ${k}`);
      }
      // Exporter section: there are TWO "Razon Social" labels — exporter is the 2nd
      const allRazonSocial = Array.from(document.querySelectorAll('label'))
        .filter((l) => (l.textContent || '').trim().startsWith('Razon Social'));
      if (allRazonSocial[1]) {
        const id = allRazonSocial[1].getAttribute('for');
        const exporterCompany = id ? document.getElementById(id) : allRazonSocial[1].parentElement?.querySelector('input');
        if (exporterCompany) { setVal(exporterCompany, 'Shenzhen Electronics Co Ltd'); result.filled++; }
      }
      // Country fields: "Pais *" with placeholder ISO is the exporter country (only one in step1 with that placeholder)
      const countryInput = document.querySelector('input[placeholder*="ISO"], input[placeholder*="ES, CN"]');
      if (countryInput) { setVal(countryInput, 'CN'); result.filled++; }
      // Exporter city — "Ciudad" appears 2 times: client + exporter
      const allCities = Array.from(document.querySelectorAll('label'))
        .filter((l) => (l.textContent || '').trim() === 'Ciudad');
      if (allCities[1]) {
        const id = allCities[1].getAttribute('for');
        const cityEl = id ? document.getElementById(id) : allCities[1].parentElement?.querySelector('input');
        if (cityEl) { setVal(cityEl, 'Shenzhen'); result.filled++; }
      }
      return result;
    });
    log('step1-filled', clientFilled.filled >= 8 ? 'low' : 'high',
      `Campos rellenados: ${clientFilled.filled}, errores=${JSON.stringify(clientFilled.errors)}`);
    await page.screenshot({ path: path.join(SCREENS, '12-step1-filled.png'), fullPage: true });

    // Click Siguiente
    const advanced = await clickByText(page, 'Siguiente');
    log('step1-next', advanced ? 'low' : 'high', `click Siguiente: ${advanced}`);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '13-step2-empty.png'), fullPage: true });

    // === STEP 2: Mercancias ===
    const goodsFilled = await page.evaluate(() => {
      const result = { filled: 0, errors: [] };
      const setVal = (input, val) => {
        if (!input) return false;
        const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                    : input.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                    : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      // Description
      const desc = document.querySelector('textarea');
      if (desc) { setVal(desc, 'Ordenadores portatiles para uso comercial DELL Latitude 5530'); result.filled++; }
      // Material + Use
      const inputs = Array.from(document.querySelectorAll('input'));
      const matInput = inputs.find((i) => i.placeholder?.toLowerCase().includes('aluminio'));
      if (matInput) { setVal(matInput, 'plastico y aluminio'); result.filled++; }
      const useInput = inputs.find((i) => i.placeholder?.toLowerCase().includes('oficina'));
      if (useInput) { setVal(useInput, 'uso ofimatica empresarial'); result.filled++; }
      // TARIC
      const taric = inputs.find((i) => i.maxLength === 10);
      if (taric) { setVal(taric, '8471300000'); result.filled++; }
      // Origin country
      const origin = inputs.find((i) => i.placeholder?.toLowerCase().includes('iso') || i.placeholder?.toLowerCase().includes('es, cn'));
      if (origin) { setVal(origin, 'CN'); result.filled++; }
      // Quantity, weights, value (number inputs)
      const numInputs = inputs.filter((i) => i.type === 'number');
      const values = ['100', '150', '170', '60000'];
      numInputs.slice(0, 4).forEach((inp, idx) => {
        if (values[idx]) { setVal(inp, values[idx]); result.filled++; }
      });
      return result;
    });
    log('step2-filled', goodsFilled.filled >= 7 ? 'low' : 'high',
      `Step 2 campos rellenados: ${goodsFilled.filled}`);
    await page.screenshot({ path: path.join(SCREENS, '14-step2-filled.png'), fullPage: true });

    // Click Siguiente -> Step 3
    await clickByText(page, 'Siguiente');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '15-step3-empty.png'), fullPage: true });

    // === STEP 3: Transporte ===
    const transportFilled = await page.evaluate(() => {
      const result = { filled: 0 };
      const setVal = (input, val) => {
        if (!input) return false;
        const proto = input.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                    : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      // Transport mode select
      const selects = Array.from(document.querySelectorAll('select'));
      const transportSelect = selects.find((s) => Array.from(s.options).some((o) => o.value === 'SEA'));
      if (transportSelect) { setVal(transportSelect, 'SEA'); result.filled++; }
      // Incoterm select
      const incotermSelect = selects.find((s) => Array.from(s.options).some((o) => o.value === 'CIF'));
      if (incotermSelect) { setVal(incotermSelect, 'CIF'); result.filled++; }
      // Incoterm place input (last text input on this page)
      const txtInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      if (txtInputs.length > 0) { setVal(txtInputs[txtInputs.length - 1], 'Valencia, ES'); result.filled++; }
      return result;
    });
    log('step3-filled', transportFilled.filled >= 2 ? 'low' : 'high',
      `Step 3 campos rellenados: ${transportFilled.filled}`);
    await page.screenshot({ path: path.join(SCREENS, '16-step3-filled.png'), fullPage: true });

    // Click "Crear expediente"
    const created = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => /Crear|Creando/.test((b.textContent || '').trim()));
      if (btn) { btn.click(); return true; }
      return false;
    });
    log('step3-submit', created ? 'low' : 'high', `Click Crear: ${created}`);

    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '17-after-submit.png'), fullPage: true });

    const url = page.url();
    log('ui-create-redirect', /\/expeditions\/[a-f0-9]{20,}/.test(url) ? 'low' : 'high',
      `URL post-submit: ${url}`);

    if (/\/expeditions\/[a-f0-9]{20,}/.test(url)) {
      uiCreatedMongoId = url.split('/expeditions/')[1].split('?')[0];
      try {
        const r = await page.request.get(`/api/expeditions/${uiCreatedMongoId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const body = await r.json();
        uiCreatedExpId = body?.data?.expeditionId;
        log('ui-create-ok', 'low',
          `Expediente creado por UI: _id=${uiCreatedMongoId} expeditionId=${uiCreatedExpId}`);
      } catch (e) {
        log('ui-create-fetch-fail', 'medium', e.message);
      }
    }
  });

  // =========================================================================
  // FLUJO 2: Validar documentos PENDING -> VALIDATED
  // =========================================================================

  test('2.1 — Crear expediente API + subir 4 docs', async ({ request }) => {
    const payload = {
      operationType: 'IMPORT',
      country: 'ES',
      client: {
        companyName: 'BetaTech Imports SL',
        nif: 'B22477020', eori: 'ESB22477020',
        address: 'Av. Diagonal 123', city: 'Barcelona', postalCode: '08008',
        country: 'ES', email: 'beta@example.com', phone: '+34 933 444 555'
      },
      exporter: { companyName: 'Asia Manufacturing Ltd', address: '88 Industry Rd', city: 'Shanghai', country: 'CN' },
      goods: [{
        description: 'Componentes electronicos pasivos (resistencias, condensadores)',
        taricCode: '8533100000', originCountry: 'CN',
        quantity: '5000', quantityUnit: 'PCS',
        netWeight: '50', grossWeight: '60', invoiceValue: '15000', currency: 'EUR'
      }],
      transportMode: 'SEA', incoterm: 'CIF', incotermPlace: 'Barcelona, ES'
    };
    const r = await request.post('/api/expeditions', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: payload
    });
    expect(r.status()).toBeLessThan(400);
    const body = await r.json();
    apiExpedMongoId = body?.data?._id;
    apiExpedId = body?.data?.expeditionId;
    log('api-create', 'low', `_id=${apiExpedMongoId} expId=${apiExpedId}`);

    const docs = [
      { type: 'commercial_invoice', name: 'invoice.pdf', body: fakePdf('FACTURA INV-2026-VALID-A') },
      { type: 'packing_list', name: 'packing.pdf', body: fakePdf('PACKING 5000 componentes') },
      { type: 'bill_of_lading', name: 'bl.pdf', body: fakePdf('B/L MAEU-VALID-001 Shanghai-Barcelona') },
      { type: 'certificate_origin', name: 'origen.pdf', body: fakePdf('Form A CCPIT origen CN') }
    ];
    for (const d of docs) {
      const ur = await request.post('/api/documents/upload', {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          expeditionId: apiExpedMongoId,
          documentType: d.type,
          file: { name: d.name, mimeType: 'application/pdf', buffer: d.body }
        }
      });
      const ok = ur.status() === 200;
      if (ok) {
        const ub = await ur.json();
        const docId = ub?.data?.document?._id || ub?.data?.documents?.slice(-1)?.[0]?._id;
        if (docId) uploadedDocIds.push({ type: d.type, id: docId });
      }
      log(`upload-${d.type}`, ok ? 'low' : 'high', `HTTP ${ur.status()}`);
    }
    log('docs-collected', uploadedDocIds.length === 4 ? 'low' : 'medium',
      `Docs uploaded: ${uploadedDocIds.length}`);
  });

  test('2.2 — Validar cada documento (PENDING → VALIDATED)', async ({ request, page }) => {
    test.skip(!apiExpedMongoId, 'No expedition');
    test.setTimeout(180_000);

    // First fetch the expedition to get docIds in case test 2.1 didn't capture them
    if (uploadedDocIds.length === 0) {
      const ex = await request.get(`/api/expeditions/${apiExpedMongoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await ex.json();
      const docs = body?.data?.documents || [];
      uploadedDocIds = docs.map((d) => ({ type: d.type, id: d._id }));
      log('docs-from-api', 'low', `Recovered ${uploadedDocIds.length} docs from API`);
    }

    let validated = 0;
    for (const d of uploadedDocIds) {
      const r = await request.post(`/api/documents/${apiExpedMongoId}/${d.id}/validate`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 60_000
      });
      const ok = r.status() === 200;
      const body = ok ? await r.json() : await r.text();
      const status = body?.data?.document?.status || body?.data?.status;
      if (ok) validated++;
      log(`validate-${d.type}`, ok ? 'low' : 'medium',
        `HTTP ${r.status()}, status=${status || 'unknown'}, body=${typeof body === 'string' ? body.slice(0, 200) : ''}`);
    }
    log('validate-summary', validated >= 2 ? 'low' : 'medium',
      `Documentos validados: ${validated}/${uploadedDocIds.length}`);

    // Verify in UI
    await gotoApp(page, `/expeditions/${apiExpedMongoId}`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '21-detail-after-validate.png'), fullPage: true });

    const validatedBadges = await page.locator('text=/validado|validated/i').count();
    log('ui-validated-badges', validatedBadges >= 1 ? 'low' : 'medium',
      `Badges "Validado/Validated" en UI: ${validatedBadges}`);
  });

  // =========================================================================
  // FLUJO 3: Generar declaración H1
  // =========================================================================

  test('3.1 — Generar H1 desde el detail (UI)', async ({ page }) => {
    test.skip(!apiExpedMongoId, 'No expedition');
    test.setTimeout(120_000);
    await gotoApp(page, `/expeditions/${apiExpedMongoId}`);
    await page.waitForTimeout(2000);

    const h1Btn = page.locator('button').filter({
      hasText: /Generar H1|Generate H1|Generar declaracion/i
    }).first();
    const visible = await h1Btn.isVisible({ timeout: 5_000 }).catch(() => false);
    log('h1-button', visible ? 'low' : 'high', `Boton "Generar H1" visible: ${visible}`);

    if (visible) {
      await h1Btn.click({ force: true });
      // H1 generation may take some seconds
      await page.waitForTimeout(15_000);
      await page.screenshot({ path: path.join(SCREENS, '31-h1-generated.png'), fullPage: true });

      // Check for LRN or "H1 Generada" indicator
      const lrnText = await page.locator('text=/LRN|H1 Generada|H1 Generated/i').first().textContent({ timeout: 3000 }).catch(() => null);
      log('h1-result-ui', lrnText ? 'low' : 'medium', `Texto post-H1: "${lrnText?.trim().slice(0, 80)}"`);
    }
  });

  test('3.2 — Generar H1 vía API directa (verificación)', async ({ page }) => {
    test.skip(!apiExpedMongoId, 'No expedition');
    test.setTimeout(60_000);
    const r = await page.request.post('/api/declarations/h1/generate', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { expeditionId: apiExpedMongoId, regime: '40', preference: '100' },
      timeout: 50_000
    });
    const ok = r.status() < 400;
    const body = ok ? await r.json() : await r.text();
    log('h1-api', ok ? 'low' : 'high', `POST h1/generate → ${r.status()}`);
    if (ok) {
      const data = body?.data;
      const xmlLen = data?.xmlContent?.length || data?.declaration?.xmlContent?.length || 0;
      const lrn = data?.lrn || data?.declaration?.lrn;
      log('h1-xml', xmlLen > 100 ? 'low' : 'medium', `XML generado: ${xmlLen} bytes, LRN=${lrn}`);
    } else {
      log('h1-api-error', 'medium', `body=${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    }
  });

  // =========================================================================
  // FLUJO 4: Enviar portal link al cliente
  // =========================================================================

  test('4.1 — Enviar portal link (UI)', async ({ page }) => {
    test.skip(!apiExpedMongoId, 'No expedition');
    await gotoApp(page, `/expeditions/${apiExpedMongoId}`);
    await page.waitForTimeout(1500);

    const portalBtn = page.locator('button').filter({
      hasText: /Enviar Portal|Send Portal|portal del cliente/i
    }).first();
    const visible = await portalBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    log('portal-button', visible ? 'low' : 'high', `Boton portal visible: ${visible}`);

    if (visible) {
      await portalBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENS, '41-portal-modal.png'), fullPage: true });

      // Modal/toast with URL
      const portalUrl = await page.locator('text=/portal|http.*expedition/i').first().textContent({ timeout: 3000 }).catch(() => null);
      log('portal-url-ui', portalUrl ? 'low' : 'medium', `Texto portal: "${portalUrl?.trim().slice(0, 100)}"`);
    }
  });

  test('4.2 — Enviar portal link (API)', async ({ page }) => {
    test.skip(!apiExpedMongoId, 'No expedition');
    const r = await page.request.post(`/api/expeditions/${apiExpedMongoId}/send-portal-link`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {}
    });
    const ok = r.status() < 400;
    const body = ok ? await r.json() : await r.text();
    log('portal-api', ok ? 'low' : 'high', `POST send-portal-link → ${r.status()}`);
    if (ok) {
      // sendPortalLink returns portalUrl at TOP level, not under data
      const url = body?.portalUrl || body?.data?.portalUrl;
      log('portal-url', url ? 'low' : 'medium', `Portal URL: ${url}`);
      log('portal-message', 'low', `message="${body?.message}"`);
    } else {
      log('portal-api-error', 'medium', `body=${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
    }
  });

  // =========================================================================
  // VERIFICACIÓN FINAL
  // =========================================================================

  test('5. Detail final con H1 + portal + docs', async ({ page }) => {
    test.skip(!apiExpedMongoId, 'No expedition');
    await gotoApp(page, `/expeditions/${apiExpedMongoId}`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '50-final-detail.png'), fullPage: true });

    // Verify state changed
    const statusBadge = await page.locator('span').filter({
      hasText: /draft|borrador|pendiente|levante|verde|naranja|rojo|completed/i
    }).first().textContent({ timeout: 3000 }).catch(() => null);
    log('final-status', 'low', `Estado final UI: "${statusBadge?.trim()}"`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      uiCreated: { _id: uiCreatedMongoId, expId: uiCreatedExpId },
      apiCreated: { _id: apiExpedMongoId, expId: apiExpedId },
      uploadedDocIds: uploadedDocIds.length,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
