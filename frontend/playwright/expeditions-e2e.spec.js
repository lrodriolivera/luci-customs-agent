// @ts-check
/**
 * E2E Expediciones — pruebas exhaustivas con creacion completa + docs + tabs IA + asistente.
 *
 *   npx playwright test playwright/expeditions-e2e.spec.js --project=chromium-headless-shell
 *
 * Capturas en: playwright/expeditions-test-screens/
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'expeditions-test-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg, extra = {}) => findings.push({ cat, sev, msg, ...extra });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let createdMongoId = null;
let createdExpId = null;

async function gotoApp(page, url = '/expeditions') {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(300);
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

test.describe('Expediciones E2E LUCI', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status(), 'login').toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;
    expect(token).toBeTruthy();
    log('login', 'low', `auth ok user=${user?.email} role=${user?.role}`);
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
      if (u.includes('/api/') && res.status() >= 400 && !u.includes('cache-stats')) {
        log('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  test('1. Lista /expeditions render + tabla', async ({ page }) => {
    await gotoApp(page, '/expeditions');
    await page.screenshot({ path: path.join(SCREENS, '01-list-default.png'), fullPage: true });
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    log('list-h1', h1 ? 'low' : 'high', `h1="${h1?.trim()}"`);
    const newBtn = page.locator('a[href="/expeditions/new"]').first();
    log('list-new-btn', await newBtn.isVisible({ timeout: 5000 }).catch(() => false) ? 'low' : 'high',
      'Boton "Nueva Expedicion" visible');
    const rowCount = await page.locator('tbody tr').count();
    log('list-rows', 'low', `Filas en tabla: ${rowCount}`);
  });

  test('2. Lista filtros (estado)', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/expeditions');
    const before = await page.locator('tbody tr').count();
    // Use evaluate to set select + dispatch change event — bypasses overlays
    const changed = await page.evaluate(() => {
      const sel = document.querySelector('select');
      if (!sel) return { ok: false, reason: 'no select' };
      const options = Array.from(sel.options).map((o) => o.value);
      const target = ['green_channel', 'pending_documents', 'draft', 'completed'].find((v) => options.includes(v));
      if (!target) return { ok: false, reason: `options=${JSON.stringify(options)}` };
      sel.value = target;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const form = document.querySelector('form');
      form?.requestSubmit?.() || form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return { ok: true, target, options };
    });
    log('filter-evaluate', 'low', `evaluate: ${JSON.stringify(changed)}`);
    await page.waitForTimeout(1500);
    const after = await page.locator('tbody tr').count();
    log('filter-result', 'low', `Filtro: ${before} → ${after}`);
    await page.screenshot({ path: path.join(SCREENS, '02-list-filtered.png'), fullPage: true });
  });

  test('3. Lista busqueda por EXP', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/expeditions');
    await page.evaluate(() => {
      const inp = document.querySelector('input[type="text"]');
      if (inp) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, 'EXP-2026');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const form = document.querySelector('form');
      form?.requestSubmit?.();
    });
    await page.waitForTimeout(1500);
    const matches = await page.locator('tbody tr').count();
    log('search', matches > 0 ? 'low' : 'medium', `Busqueda "EXP-2026": ${matches} filas`);
    await page.screenshot({ path: path.join(SCREENS, '03-list-search.png'), fullPage: true });
  });

  test('4. Wizard: form de creacion abre con 3 steps + IA button', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/expeditions/new');
    await page.screenshot({ path: path.join(SCREENS, '04-new-step1.png'), fullPage: true });

    const steps = await page.locator('.bg-luci.text-white, .bg-gray-200').count();
    log('wizard-step-count', steps >= 3 ? 'low' : 'medium', `Indicador de pasos: ${steps} circulos`);

    const importBtn = page.locator('button:has-text("Importacion")').first();
    const exportBtn = page.locator('button:has-text("Exportacion")').first();
    log('wizard-op-buttons',
      (await importBtn.isVisible() && await exportBtn.isVisible()) ? 'low' : 'medium',
      'Botones IMPORT/EXPORT visibles');

    const esBtn = page.locator('button:has-text("Espana")').first();
    const nlBtn = page.locator('button:has-text("Paises Bajos")').first();
    log('wizard-country',
      (await esBtn.isVisible() && await nlBtn.isVisible()) ? 'low' : 'medium',
      'Selector ES/NL visible');
  });

  test('5. Crear expediente completo via API', async ({ request }) => {
    const payload = {
      operationType: 'IMPORT',
      country: 'ES',
      client: {
        companyName: 'ACME Importadora SL',
        nif: 'B22477020',
        eori: 'ESB22477020',
        address: 'Calle Mayor 1',
        city: 'Madrid',
        postalCode: '28013',
        country: 'ES',
        contactPerson: 'Luis Rodriguez',
        email: 'importador@acme.es',
        phone: '+34 911 222 333'
      },
      exporter: {
        companyName: 'Shenzhen Electronics Co Ltd',
        address: '88 Bao An Avenue',
        city: 'Shenzhen',
        country: 'CN'
      },
      goods: [{
        description: 'Ordenadores portatiles para uso comercial DELL Latitude 5530',
        taricCode: '8471300000',
        originCountry: 'CN',
        quantity: '100',
        quantityUnit: 'PCS',
        netWeight: '150',
        grossWeight: '170',
        invoiceValue: '60000',
        currency: 'EUR'
      }, {
        description: 'Cargadores 65W USB-C originales DELL',
        taricCode: '8504409090',
        originCountry: 'CN',
        quantity: '100',
        quantityUnit: 'PCS',
        netWeight: '20',
        grossWeight: '25',
        invoiceValue: '2500',
        currency: 'EUR'
      }],
      transportMode: 'SEA',
      incoterm: 'CIF',
      incotermPlace: 'Valencia, ES'
    };

    const r = await request.post('/api/expeditions', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: payload
    });
    const status = r.status();
    const body = await r.json().catch(() => ({}));
    if (status >= 400) {
      log('create-fail', 'critical', `POST /api/expeditions HTTP ${status}: ${JSON.stringify(body).slice(0, 300)}`);
      return;
    }
    createdMongoId = body?.data?._id || body?.data?.id || body?._id;
    createdExpId = body?.data?.expeditionId || body?.expeditionId;
    log('create-ok', 'low', `Expediente creado: _id=${createdMongoId} expeditionId=${createdExpId}`);
  });

  test('6. Ver detail recien creado', async ({ page }) => {
    test.skip(!createdMongoId, 'No se creo expediente');
    await gotoApp(page, `/expeditions/${createdMongoId}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '06-detail-no-docs.png'), fullPage: true });

    const expIdVisible = await page.locator(`text=${createdExpId}`).first().isVisible({ timeout: 5000 }).catch(() => false);
    log('detail-id-visible', expIdVisible ? 'low' : 'medium', `expeditionId visible en detail: ${expIdVisible}`);

    const goodsVisible = await page.locator('text=/portatiles|DELL|Latitude/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('detail-goods-visible', goodsVisible ? 'low' : 'medium', `Mercancias visibles en detail: ${goodsVisible}`);

    const checklist = await page.locator('text=/checklist|documentacion|requeridos/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('detail-checklist', checklist ? 'low' : 'medium', `Sidebar checklist visible: ${checklist}`);
  });

  test('7. Subir 4 documentos (factura/packing/BL/origen)', async ({ request }) => {
    test.skip(!createdMongoId, 'No expedition');
    const docs = [
      { type: 'commercial_invoice', name: 'factura-comercial.pdf', body: fakePdf('FACTURA INV-2026-0428 ACME EUR 62500.00') },
      { type: 'packing_list', name: 'packing-list.pdf', body: fakePdf('PACKING LIST 100 laptops + 100 chargers 195kg') },
      { type: 'bill_of_lading', name: 'bill-of-lading.pdf', body: fakePdf('B/L MAEU2026042801 Shenzhen-Valencia') },
      { type: 'certificate_origin', name: 'certificado-origen.pdf', body: fakePdf('Form A CCPIT - Origen CN') }
    ];

    let okCount = 0;
    for (const doc of docs) {
      const r = await request.post('/api/documents/upload', {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          expeditionId: createdMongoId,
          documentType: doc.type,
          file: { name: doc.name, mimeType: 'application/pdf', buffer: doc.body }
        }
      });
      const ok = r.status() === 200;
      if (ok) okCount++;
      const body = ok ? null : await r.text().catch(() => '');
      log(`upload-${doc.type}`, ok ? 'low' : 'high',
        `Upload ${doc.type}: HTTP ${r.status()}${body ? ` ${body.slice(0, 200)}` : ''}`);
    }
    log('upload-summary', okCount === docs.length ? 'low' : 'high',
      `Documentos subidos: ${okCount}/${docs.length}`);
  });

  test('8. Detail post-upload muestra documentos', async ({ page }) => {
    test.skip(!createdMongoId, 'No expedition');
    await gotoApp(page, `/expeditions/${createdMongoId}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '08-detail-with-docs.png'), fullPage: true });

    const docNames = ['factura-comercial', 'packing-list', 'bill-of-lading', 'certificado-origen'];
    let visible = 0;
    for (const n of docNames) {
      if (await page.locator(`text=/${n}/i`).first().isVisible({ timeout: 1500 }).catch(() => false)) visible++;
    }
    log('detail-docs-rendered', visible >= 2 ? 'low' : 'medium',
      `Docs visibles en UI: ${visible}/${docNames.length}`);
  });

  test('9. Tab IA: suggest-documents', async ({ page }) => {
    test.skip(!createdMongoId, 'No expedition');
    await gotoApp(page, `/expeditions/${createdMongoId}`);
    await page.waitForTimeout(1000);

    const aiTriggers = page.locator('button').filter({
      hasText: /Analisis IA|Sugerir|Sugerencias|AI|IA|Asistente/i
    });
    const count = await aiTriggers.count();
    log('ai-buttons-count', count >= 1 ? 'low' : 'medium', `Botones IA visibles en detail: ${count}`);
    if (count > 0) {
      await aiTriggers.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENS, '09-detail-ai-panel.png'), fullPage: true });
    }
    const r = await page.request.post(`/api/expeditions/${createdMongoId}/ai/suggest-documents`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log('ai-suggest-docs', r.status() < 400 ? 'low' : 'high',
      `POST ai/suggest-documents → ${r.status()}`);
  });

  test('10. Tab IA: full-analysis', async ({ page }) => {
    test.skip(!createdMongoId, 'No expedition');
    test.setTimeout(150_000);
    try {
      const r = await page.request.post(`/api/expeditions/${createdMongoId}/ai/full-analysis`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120_000
      });
      log('ai-full-analysis', r.status() < 400 ? 'low' : 'high',
        `POST ai/full-analysis → ${r.status()}`);
      if (r.status() < 400) {
        const body = await r.json().catch(() => ({}));
        log('ai-full-fields', 'low',
          `Keys: ${Object.keys(body?.data || {}).slice(0, 8).join(', ')}`);
      }
    } catch (e) {
      log('ai-full-timeout', 'medium', `full-analysis timeout (>120s): ${e.message?.slice(0, 80)}`);
    }
  });

  test('11. Detail: links internos sirven 200', async ({ page }) => {
    test.skip(!createdMongoId, 'No expedition');
    await gotoApp(page, `/expeditions/${createdMongoId}`);
    await page.waitForTimeout(1500);

    const links = await page.locator('a[href^="/"]').evaluateAll((els) =>
      els.map((e) => ({ href: e.getAttribute('href'), text: (e.textContent || '').trim().slice(0, 30) }))
        .filter((l) => l.href && l.href !== '/' && !l.href.includes('://'))
    );
    const unique = [...new Map(links.map((l) => [l.href, l])).values()];

    let ok = 0, broken = 0;
    for (const l of unique) {
      const resp = await page.request.get(l.href).catch(() => null);
      const status = resp?.status?.() ?? 0;
      if (status >= 400) { log('detail-link-broken', 'high', `${l.href} → HTTP ${status}`); broken++; }
      else ok++;
    }
    log('detail-links-summary', broken === 0 ? 'low' : 'high',
      `${ok}/${unique.length} links sirven 200, ${broken} rotos`);
  });

  test('12. Asistente desde sidebar', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/expeditions');
    const link = page.locator('a[href="/assistant"]').first();
    if (!await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('assistant-link', 'medium', 'CTA asistente NO visible desde /expeditions');
      return;
    }
    await link.click({ force: true });
    await page.waitForURL(/\/assistant/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '12-assistant.png'), fullPage: true });

    // Use evaluate to set value reliably regardless of overlay
    const setOk = await page.evaluate(() => {
      const inp = document.querySelector('textarea, input[type="text"]');
      if (!inp) return false;
      const setter = Object.getOwnPropertyDescriptor(
        inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(inp, '¿Que documentos son obligatorios para una H1 de importacion?');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    log('assistant-typed', setOk ? 'low' : 'medium', `setValue ok=${setOk}`);
    await page.screenshot({ path: path.join(SCREENS, '13-assistant-typed.png'), fullPage: true });
  });

  test('13. Lista re-revisada: nuevo expediente aparece', async ({ page }) => {
    test.skip(!createdExpId, 'No expedition');
    await gotoApp(page, '/expeditions');
    await page.waitForTimeout(1000);
    await page.locator('input[type="text"]').first().fill(createdExpId);
    await page.locator('form').first().evaluate((f) => f.requestSubmit?.());
    await page.waitForTimeout(1500);
    const visible = await page.locator(`text=${createdExpId}`).first().isVisible({ timeout: 5000 }).catch(() => false);
    log('list-shows-new', visible ? 'low' : 'high',
      `Expediente ${createdExpId} aparece en lista tras buscar: ${visible}`);
    await page.screenshot({ path: path.join(SCREENS, '15-list-with-new.png'), fullPage: true });
  });

  test.afterAll(async () => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      createdMongoId,
      createdExpId,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
