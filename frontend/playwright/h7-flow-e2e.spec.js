// @ts-check
/**
 * E2E /h7: lista + manifiesto CSV + nueva H7 + submit AEAT.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'h7-flow-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let createdH7Id = null;
let createdH7DeclarationId = null;
let aeatMrn = null;
let aeatChannel = null;

const MANIFEST_CSV = `tracking,sender_name,sender_country,recipient_name,recipient_id,recipient_address,recipient_city,recipient_postal,description,quantity,value,weight
LUCI-MOK-001,Shenzhen Tech Ltd,CN,Maria Garcia,12345678Z,Calle Mayor 10,Madrid,28013,Funda silicona movil iPhone,2,15.99,0.3
LUCI-MOK-002,Tokyo Fashion Co,JP,Juan Lopez,87654321X,Av Diagonal 100,Barcelona,08001,Camiseta algodon estampada,1,29.50,0.2
LUCI-MOK-003,Korean Beauty Inc,KR,Ana Martin,11223344Y,Plaza Mayor 5,Valencia,46001,Crema hidratante facial 50ml,3,42.99,0.5
LUCI-MOK-004,Hong Kong Crafts,HK,Pedro Sanchez,55667788H,Gran Via 50,Sevilla,41001,Llavero metalico decorativo,5,8.50,0.15
LUCI-MOK-005,Vietnam Textiles,VN,Laura Ruiz,99887766J,Calle Real 25,Zaragoza,50001,Bufanda lana invierno,1,18.75,0.25`;

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('H7 flow E2E', () => {
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

  test('1. Render /h7 + stats', async ({ page }) => {
    await gotoApp(page, '/h7');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '01-h7-list.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', h1 ? 'low' : 'high', `h1="${h1?.trim()}"`);

    // Stats cards (Total declaraciones, Total valor, Aranceles, Carriers)
    const statsTexts = await page.locator('p.text-2xl.font-bold').allTextContents();
    log('stats-cards', statsTexts.length >= 3 ? 'low' : 'medium',
      `Stats: [${statsTexts.slice(0, 4).join(' · ')}]`);

    const importBtn = await page.locator('button:has-text("Importar Manifiesto")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const newBtn = await page.locator('button:has-text("Nueva H7"), a:has-text("Nueva H7")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('action-buttons', importBtn ? 'low' : 'medium', `Botones: import=${importBtn} new=${newBtn}`);

    const rowCount = await page.locator('tbody tr').count();
    log('list-rows', 'low', `H7 declarations en lista: ${rowCount}`);
  });

  test('2. Importar manifiesto CSV (5 envios)', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page, '/h7');
    await page.waitForTimeout(1500);

    // Click "Importar Manifiesto"
    const importBtn = page.locator('button:has-text("Importar Manifiesto")').first();
    if (!await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('import-btn', 'high', 'Botón "Importar Manifiesto" no visible');
      return;
    }
    await importBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '02-manifest-modal-step1.png'), fullPage: true });

    // Step 1: Upload CSV via setInputFiles
    const csvBuffer = Buffer.from(MANIFEST_CSV, 'utf8');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'manifiesto-luci-mok.csv',
      mimeType: 'text/csv',
      buffer: csvBuffer,
    });
    log('csv-uploaded', 'low', `CSV cargado: ${MANIFEST_CSV.split('\n').length - 1} envíos`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '03-manifest-uploaded.png'), fullPage: true });

    // Step 2 ya activo (Vista previa). Scroll dentro del modal para encontrar botón siguiente
    await page.evaluate(() => {
      // Find the modal scrollable container
      const modal = document.querySelector('div[class*="overflow-y-auto"][class*="max-h"]');
      if (modal) modal.scrollTop = modal.scrollHeight;
      // Also scroll the dialog
      document.querySelectorAll('[role="dialog"], .modal, div[class*="bg-white"][class*="rounded"]').forEach((d) => {
        d.scrollTop = d.scrollHeight;
      });
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '04a-manifest-preview-scrolled.png'), fullPage: true });

    // Click step 3 "Clasificacion IA" via direct click on button "Siguiente" / "Clasificar IA"
    const nextBtn = page.locator('button').filter({
      hasText: /Siguiente|Continuar|Clasificar.*IA|Analizar|Procesar/i
    }).last();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const nextText = await nextBtn.textContent();
      log('next-btn-text', 'low', `Botón siguiente: "${nextText?.trim()}"`);
      await nextBtn.click({ force: true });
      log('process-clicked', 'low', `Click en botón siguiente`);
      // IA classification of 5 items can take 30-60s
      await page.waitForTimeout(45_000);
      await page.screenshot({ path: path.join(SCREENS, '04b-manifest-step3.png'), fullPage: true });
    } else {
      log('process-btn', 'medium', 'Botón siguiente no encontrado tras preview');
    }

    // Click "Crear N declaraciones H7" — usamos evaluate para mejor robustez
    const createResult = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => /Crear\s+\d+\s+declaracion(es)?\s+H7/i.test(b.textContent || ''));
      if (btn) { btn.click(); return btn.textContent?.trim(); }
      return null;
    });
    if (createResult) {
      log('create-btn-text', 'low', `Botón clickeado: "${createResult}"`);
      await page.waitForTimeout(45_000);
      await page.screenshot({ path: path.join(SCREENS, '05-manifest-results.png'), fullPage: true });
      const successCount = await page.locator('text=/creada|creadas|created|exitos/i').count();
      log('manifest-success', successCount > 0 ? 'low' : 'medium',
        `Mensajes éxito creación: ${successCount}`);
    } else {
      log('create-btn', 'medium', 'Botón "Crear N declaraciones H7" no encontrado');
    }
  });

  test('3. Cerrar modal + lista actualizada', async ({ page }) => {
    await gotoApp(page, '/h7');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '06-h7-list-after-import.png'), fullPage: true });

    const rowCount = await page.locator('tbody tr').count();
    log('list-after', 'low', `Filas tras manifiesto: ${rowCount}`);

    // Search for our LUCI-MOK references
    const lucimok = await page.locator('text=/LUCI-MOK/i').count();
    log('lucimok-rows', lucimok > 0 ? 'low' : 'medium', `Filas con LUCI-MOK: ${lucimok}`);
  });

  test('4. Crear H7 manual (Nueva H7)', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page, '/h7');
    await page.waitForTimeout(1500);

    // Try "+ Nueva H7" or "Crear primera declaracion" (when list empty)
    let newBtn = page.locator('button').filter({ hasText: /Nueva H7|\+ Nueva|Crear primera/i }).first();
    if (!await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('new-h7-btn', 'medium', 'Botón "Nueva H7" / "Crear primera" no visible');
      return;
    }
    await newBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '07-h7-form-empty.png'), fullPage: true });

    // Fill the H7 form via DOM manipulation
    const filled = await page.evaluate(() => {
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
      // Find inputs by label (form has many labels)
      const findByLabel = (text) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const lbl = labels.find((l) => new RegExp(text, 'i').test(l.textContent || ''));
        if (!lbl) return null;
        const id = lbl.getAttribute('for');
        if (id) return document.getElementById(id);
        return lbl.parentElement?.querySelector('input, textarea, select');
      };

      const fields = [
        ['Tracking', 'LUCI-H7-MANUAL-' + Date.now()],
        ['AWB|MAWB', 'AWB-MOK-2026'],
        ['Remitente|Sender|Expedidor', 'Shenzhen Express Co Ltd'],
        ['Destinatario|Recipient', 'Carlos Lopez Garcia'],
        ['NIF|DNI|Identif', '78901234L'],
        ['Direccion|Address|Calle', 'Calle Aduana 12'],
        ['Ciudad|City', 'Madrid'],
        ['CP|Postal|Codigo postal', '28013'],
        ['Email', 'cliente@example.com'],
        ['Pais', 'CN'],
        ['Descripcion|Description', 'Auriculares bluetooth inalambricos'],
        ['Cantidad|Quantity', '1'],
        ['Valor|Value', '45.50'],
        ['Peso|Weight', '0.18'],
        ['IOSS', 'IM7770000020'],
      ];
      fields.forEach(([labelRe, val]) => {
        const inp = findByLabel(labelRe);
        if (inp && setVal(inp, val)) count++;
      });

      return { count };
    });
    log('h7-form-fill', filled.count >= 5 ? 'low' : 'medium',
      `H7 form fields llenos: ${filled.count}`);
    await page.screenshot({ path: path.join(SCREENS, '08-h7-form-filled.png'), fullPage: true });

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click({ force: true });
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(SCREENS, '09-h7-form-submitted.png'), fullPage: true });

      const url = page.url();
      log('h7-submit-url', /\/h7\/[a-f0-9]{20,}/.test(url) ? 'low' : 'medium',
        `Post-submit URL: ${url.split('strixai.es')[1] || url}`);
      // If detail page
      if (/\/h7\/[a-f0-9]{20,}/.test(url)) {
        createdH7Id = url.split('/h7/')[1].split('?')[0];
        log('h7-created', 'low', `H7 created: _id=${createdH7Id}`);
      }
    }
  });

  test('5. Localizar un H7 del manifiesto para AEAT submit', async ({ request }) => {
    test.setTimeout(60_000);
    // Buscar uno de los LUCI-MOK creados por manifiesto
    const r = await request.get('/api/h7?search=LUCI-MOK&limit=5', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await r.json();
    const items = body?.data?.declarations || body?.data || [];
    const luciMok = items.find((d) => /LUCI-MOK/i.test(d.declarationNumber || d.trackingNumber || ''));
    if (luciMok) {
      createdH7Id = luciMok._id;
      createdH7DeclarationId = luciMok.declarationNumber || luciMok.trackingNumber;
      log('h7-from-manifest', 'low',
        `H7 del manifiesto: _id=${createdH7Id} number=${createdH7DeclarationId}`);
      return;
    }

    // Fallback: crear via API
    const payload = {
      trackingNumber: 'LUCI-H7-API-' + Date.now(),
      carrier: { code: 'AIRGO', name: 'AIRGO EXPRESS' },
      declarationNumber: 'H7-MOK-' + Date.now(),
      transportDocument: { type: 'AWB', number: 'AWB-MOK-2026-0429-FINAL' },
      sender: {
        name: 'Shenzhen Tech Ltd',
        address: { country: 'CN', city: 'Shenzhen' }
      },
      recipient: {
        name: 'Maria Garcia Test',
        taxId: '12345678Z',
        identification: '12345678Z',
        eori: '',
        email: 'maria.test@example.com',
        address: {
          street: 'Calle Mayor 10',
          city: 'Madrid',
          postalCode: '28013',
          country: 'ES'
        }
      },
      goods: {
        description: 'Funda silicona movil iPhone',
        descriptionEn: 'Silicone phone case',
        quantity: 2,
        unit: 'PCS',
        weight: 0.3,
        weightUnit: 'KG',
        value: 15.99,
        currency: 'EUR'
      },
      // H7Declaration model requires totals
      totals: {
        netWeight: 0.3,
        grossWeight: 0.3,
        intrinsicValue: 15.99,
        value: 15.99,
        duties: 3.36,
        ivaImport: 3.36,
        currency: 'EUR'
      },
      // items array required (model nests goods inside items[])
      items: [{
        description: 'Funda silicona movil iPhone',
        descriptionEn: 'Silicone phone case',
        taricCode: '3926909790',
        hsCode: '392690',
        quantity: 2,
        unit: 'PCS',
        netWeight: 0.3,
        grossWeight: 0.3,
        unitValue: 7.995,
        totalValue: 15.99,
        currency: 'EUR',
        countryOfOrigin: 'CN'
      }],
      // intrinsic value (sum of items.totalValue)
      intrinsicValue: 15.99,
      ioss: { number: 'IM7770000020' },
      customsOffice: '002801',
      // Required for AEAT submission
      preference: '100',
      regime: '40'
    };
    const cr = await request.post('/api/h7', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: payload
    });
    const cBody = await cr.json();
    if (cr.status() < 400 && cBody?.success) {
      createdH7Id = cBody?.data?._id || cBody?.data?.id;
      createdH7DeclarationId = cBody?.data?.declarationNumber;
      log('h7-api-create', 'low',
        `H7 creada vía API: _id=${createdH7Id} declarationNumber=${createdH7DeclarationId}`);
    } else {
      log('h7-api-create', 'high', `HTTP ${cr.status()}: ${JSON.stringify(cBody).slice(0, 250)}`);
    }
  });

  test('6. Submit H7 a AEAT desde detail UI', async ({ page }) => {
    test.skip(!createdH7Id, 'No H7 created');
    test.setTimeout(120_000);

    page.on('dialog', (d) => d.accept().catch(() => {}));

    // Capture API responses
    const apiCalls = [];
    page.on('response', async (res) => {
      const u = res.url();
      if (u.includes('/api/h7/') && u.includes('/submit')) {
        try {
          const body = await res.json();
          apiCalls.push({ status: res.status(), body });
        } catch {}
      }
    });

    await gotoApp(page, `/h7/${createdH7Id}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '10-h7-detail-pre-submit.png'), fullPage: true });

    // Click "Enviar AEAT"
    const sendBtn = page.locator('button').filter({ hasText: /Enviar.*AEAT|Submit.*AEAT/i }).first();
    if (!await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      log('h7-send-btn', 'medium', 'Botón "Enviar a AEAT" no visible en H7 detail');
      return;
    }
    await sendBtn.click({ force: true });
    await page.waitForTimeout(15_000);
    await page.screenshot({ path: path.join(SCREENS, '11-h7-detail-post-submit.png'), fullPage: true });

    if (apiCalls.length > 0) {
      const last = apiCalls[apiCalls.length - 1];
      const data = last.body?.data || last.body;
      aeatMrn = data?.mrn;
      aeatChannel = data?.channel;
      log('h7-aeat', last.status < 400 ? 'low' : 'medium',
        `H7 submit AEAT: HTTP ${last.status} mrn=${aeatMrn} channel=${aeatChannel}`);
    }

    // Pull final state
    const detail = await page.request.get(`/api/h7/${createdH7Id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dBody = await detail.json();
    const dData = dBody?.data;
    log('h7-final', 'low',
      `Final: status=${dData?.status} mrn=${dData?.mrn || dData?.aeatResponse?.mrn} channel=${dData?.channel || dData?.aeatResponse?.channel}`);
  });

  test('7. Asistente desde /h7', async ({ page }) => {
    await gotoApp(page, '/h7');
    const link = page.locator('a[href="/assistant"]').first();
    if (!await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('assistant-cta', 'medium', 'CTA asistente no visible');
      return;
    }
    await link.click({ force: true });
    await page.waitForURL(/\/assistant/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '12-assistant.png'), fullPage: true });
    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    const inputs = await page.locator('textarea, input[type="text"]').count();
    log('assistant-renders', !errorBoundary && inputs > 0 ? 'low' : 'high',
      `Asistente OK: errorBoundary=${errorBoundary} inputs=${inputs}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      createdH7Id, createdH7DeclarationId,
      aeatMrn, aeatChannel,
      manifestRows: MANIFEST_CSV.split('\n').length - 1,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
