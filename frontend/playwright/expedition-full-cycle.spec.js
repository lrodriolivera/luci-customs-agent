// @ts-check
/**
 * E2E ciclo completo de un expediente:
 *  1. Crear + 4 docs validados
 *  2. Generar H1 (real, con validaciones)
 *  3. Enviar a AEAT PRE real → MRN + canal
 *  4. Portal público (sin auth, token-based): leer datos + subir doc + listar pagos
 *  5. Crear pago de aranceles
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'expedition-full-cycle-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg, extra = {}) => findings.push({ cat, sev, msg, ...extra });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
let mongoId = null;
let expeditionId = null;
let mrn = null;
let channel = null;
let portalToken = null;
let portalUrl = null;
let docIds = [];
let paymentId = null;

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

test.describe('Ciclo completo expediente', () => {
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
      if (u.includes('/api/') && res.status() >= 400 && !u.includes('/cache-stats')) {
        log('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  // ==========================================================================
  // FASE 1: Crear expediente + docs + validar
  // ==========================================================================

  test('1. Crear expediente IMPORT + subir 4 docs + validar', async ({ request }) => {
    test.setTimeout(120_000);
    const payload = {
      operationType: 'import',
      country: 'ES',
      client: {
        // Cliente = STRIX porque AEAT PRE solo tiene ESB22477020 dado de alta
        companyName: 'STRIX AI SL',
        nif: 'B22477020', eori: 'ESB22477020',
        address: 'Calle Aduana 12', city: 'Madrid', postalCode: '28013',
        country: 'ES',
        contactPerson: 'Luis Rodriguez',
        email: 'luis.rodriguez@strixai.es', phone: '+34 911 222 333'
      },
      exporter: {
        companyName: 'Anatolian Mobilya AS',
        address: 'Organize Sanayi Bolgesi 12', city: 'Istanbul', country: 'TR'
      },
      goods: [{
        // TARIC 9404.21.10 (colchones de espuma) origen TR (no UE) → evita antidumping CN
        // y conflicto pais-UE-en-IM. Acuerdo aduanero EU-Turquia, preferencia 300.
        description: 'Colchones de espuma de poliuretano para uso residencial',
        taricCode: '9404211000', originCountry: 'TR',
        quantity: 200, unit: 'KGM',
        netWeight: 1500, grossWeight: 1600,
        invoiceValue: 9500, currency: 'EUR'
      }],
      transportMode: 'SEA', incoterm: 'CIF', incotermPlace: 'Valencia, ES',
      // Aduana de pruebas peninsular (recinto AEAT PRE) — evita validaciones TARIC estrictas.
      customsOffice: '009999',
      transport: { entryCustomsOffice: '009999' }
    };

    const r = await request.post('/api/expeditions', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: payload
    });
    expect(r.status(), 'create').toBeLessThan(400);
    const body = await r.json();
    mongoId = body?.data?._id;
    expeditionId = body?.data?.expeditionId;
    log('create', 'low', `Created _id=${mongoId} expId=${expeditionId}`);

    // Subir 4 docs
    const docs = [
      { type: 'commercial_invoice', name: 'invoice.pdf', body: fakePdf('FACTURA INV-2026-FULL-CYCLE') },
      { type: 'packing_list', name: 'packing.pdf', body: fakePdf('PACKING 50 laptops 85kg') },
      { type: 'bill_of_lading', name: 'bl.pdf', body: fakePdf('B/L MAEU-FULL-001 Shenzhen-Valencia') },
      { type: 'certificate_origin', name: 'origen.pdf', body: fakePdf('Form A CCPIT origen CN') }
    ];
    for (const d of docs) {
      const ur = await request.post('/api/documents/upload', {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          expeditionId: mongoId, documentType: d.type,
          file: { name: d.name, mimeType: 'application/pdf', buffer: d.body }
        }
      });
      const ok = ur.status() === 200;
      if (ok) {
        const ub = await ur.json();
        const docId = ub?.data?.document?._id;
        if (docId) docIds.push({ type: d.type, id: docId });
      }
      log(`upload-${d.type}`, ok ? 'low' : 'high', `HTTP ${ur.status()}`);
    }

    // Validar los 4
    let validated = 0;
    for (const d of docIds) {
      const vr = await request.post(`/api/documents/${mongoId}/${d.id}/validate`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60_000
      });
      if (vr.status() === 200) validated++;
    }
    log('validated', validated === 4 ? 'low' : 'high', `Docs validados: ${validated}/4`);
  });

  // ==========================================================================
  // FASE 2: Generar H1 (modo real con validaciones)
  // ==========================================================================

  test('2. Generar H1 (con validaciones)', async ({ request }) => {
    test.skip(!mongoId);
    test.setTimeout(60_000);
    const r = await request.post('/api/declarations/h1/generate', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { expeditionId: mongoId, regime: '40', preference: '100' },
      timeout: 50_000
    });
    const ok = r.status() < 400;
    const body = ok ? await r.json() : await r.text();
    log('h1-generate', ok ? 'low' : 'high', `POST h1/generate → ${r.status()}`);
    if (ok) {
      const data = body?.data;
      const xmlLen = data?.xmlContent?.length || data?.declaration?.xmlContent?.length || 0;
      const lrn = data?.lrn || data?.declaration?.lrn;
      log('h1-result', 'low', `XML ${xmlLen} bytes, LRN=${lrn}`);
    } else {
      log('h1-error', 'high', `body=${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    }
  });

  // ==========================================================================
  // FASE 3: Submit a AEAT PRE real
  // ==========================================================================

  test('3. Submit a AEAT PRE → MRN + canal', async ({ page }) => {
    test.skip(!mongoId);
    test.setTimeout(120_000);

    await gotoApp(page, `/expeditions/${mongoId}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '01-pre-submit.png'), fullPage: true });

    // Click "Enviar a AEAT" via UI
    const submitBtn = page.locator('button').filter({
      hasText: /Enviar a AEAT|Submit to AEAT/i
    }).first();
    const visible = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);
    log('aeat-button', visible ? 'low' : 'high', `Boton "Enviar a AEAT" visible: ${visible}`);

    // Submit via API directly to verify response cleanly
    const r = await page.request.post(`/api/declarations/${mongoId}/submit`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 90_000
    });
    const ok = r.status() < 400;
    const body = await r.json().catch(() => ({}));
    log('aeat-submit', ok ? 'low' : 'high', `POST /declarations/${mongoId}/submit → ${r.status()}`);

    if (ok) {
      const data = body?.data || body;
      mrn = data?.mrn || data?.declaration?.mrn;
      channel = data?.channel || data?.declaration?.channel;
      log('aeat-mrn', mrn ? 'low' : 'medium', `MRN: ${mrn}`);
      log('aeat-channel', channel ? 'low' : 'medium', `Canal: ${channel}`);
      log('aeat-simulated', 'low', `simulated=${data?.simulated || false}`);
    } else {
      log('aeat-error', 'high', `error: ${body?.error || 'unknown'}, code: ${body?.aeatResponse?.code || '?'}`);
    }

    // UI should refresh and show MRN
    await gotoApp(page, `/expeditions/${mongoId}`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '02-post-submit.png'), fullPage: true });

    if (mrn) {
      const mrnVisible = await page.locator(`text=${mrn}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('mrn-in-ui', mrnVisible ? 'low' : 'medium', `MRN ${mrn} visible en UI: ${mrnVisible}`);
    }
  });

  // ==========================================================================
  // FASE 4: Portal del cliente público (sin auth, token-based)
  // ==========================================================================

  test('4.1 — Generar token portal + extraer URL', async ({ request }) => {
    test.skip(!mongoId);
    const r = await request.post(`/api/expeditions/${mongoId}/send-portal-link`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {}
    });
    expect(r.status()).toBeLessThan(400);
    const body = await r.json();
    portalUrl = body?.portalUrl;
    // Extract token from URL: https://aduanas.strixai.es/portal/<token>
    const match = portalUrl?.match(/\/portal\/([0-9a-f-]+)/);
    portalToken = match?.[1];
    log('portal-token', portalToken ? 'low' : 'high',
      `Portal token extracted: ${portalToken?.slice(0, 8)}... URL=${portalUrl}`);
  });

  test('4.2 — GET /api/portal/:token (sin auth)', async ({ request }) => {
    test.skip(!portalToken);
    const r = await request.get(`/api/portal/${portalToken}`);  // NO auth header
    const ok = r.status() === 200;
    const body = ok ? await r.json() : await r.text();
    log('portal-get', ok ? 'low' : 'high',
      `GET /api/portal/:token (no auth) → ${r.status()}`);
    if (ok) {
      const data = body?.data || body;
      log('portal-data', 'low',
        `Portal devuelve expedientId=${data?.expeditionId}, docs=${data?.documents?.length}, status=${data?.status}`);
    }
  });

  test('4.3 — Subir documento desde portal público (sin auth)', async ({ request }) => {
    test.skip(!portalToken);
    const r = await request.post(`/api/portal/${portalToken}/documents`, {
      // NO Authorization header
      multipart: {
        documentType: 'other',
        file: {
          name: 'cliente-extra-doc.pdf',
          mimeType: 'application/pdf',
          buffer: fakePdf('Documento subido por el cliente desde portal publico - sin login')
        }
      }
    });
    const ok = r.status() < 400;
    const body = ok ? await r.json() : await r.text();
    log('portal-upload', ok ? 'low' : 'high',
      `POST /portal/:token/documents → ${r.status()}`);
    if (!ok) {
      log('portal-upload-error', 'high', `body=${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    } else {
      log('portal-upload-ok', 'low', `Doc del cliente subido OK`);
    }
  });

  test('4.4 — Render del portal público en navegador (sin token de auth)', async ({ browser }) => {
    test.skip(!portalToken);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // Sin token de auth en localStorage
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/api/') && res.status() >= 400) {
        log('portal-page-http', 'medium',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
    await page.goto(`/portal/${portalToken}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '03-portal-public.png'), fullPage: true });

    const h1 = await page.locator('h1, h2').first().textContent({ timeout: 3000 }).catch(() => null);
    log('portal-render', h1 ? 'low' : 'medium', `h1/h2 portal: "${h1?.trim()?.slice(0, 80)}"`);
    await ctx.close();
  });

  // ==========================================================================
  // FASE 5: Pagos
  // ==========================================================================

  test('5.0 — Calcular aranceles (popular calculations)', async ({ request }) => {
    test.skip(!mongoId);
    // /calculation/total acepta items[] y actualiza expedition.calculations (que paymentService lee)
    const r = await request.post('/api/calculation/total', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        expeditionId: mongoId,
        items: [{
          taricCode: '9404211000',
          value: 9500,
          currency: 'EUR',
          origin: 'TR',
          weight: 1500,
          quantity: 200
        }],
        freightCost: 800,
        insuranceCost: 100,
        preference: '300'  // Origen UE → preferencia comunidad
      }
    });
    const ok = r.status() < 400;
    const body = ok ? await r.json() : await r.text();
    log('calc-duties', ok ? 'low' : 'high', `POST /calculation/duties → ${r.status()}`);
    if (ok) {
      const summary = body?.data?.summary || body?.summary;
      log('calc-result', 'low',
        `customsValue=${summary?.customsValue} duties=${summary?.totalDuties} VAT=${summary?.totalVat} totalToPay=${summary?.totalToPay}`);
    }
  });

  test('5.1 — Listar pagos (portal público)', async ({ request }) => {
    test.skip(!portalToken);
    const r = await request.get(`/api/portal/${portalToken}/payments`);
    const ok = r.status() < 400;
    const body = ok ? await r.json() : await r.text();
    log('payments-list', ok ? 'low' : 'high',
      `GET /portal/:token/payments → ${r.status()}`);
    if (ok) {
      const data = body?.data;
      const count = Array.isArray(data?.payments) ? data.payments.length : (Array.isArray(data) ? data.length : 0);
      log('payments-count', 'low', `${count} pagos existentes`);
    }
  });

  test('5.2 — Crear pago de aranceles', async ({ request }) => {
    test.skip(!portalToken);
    const r = await request.post(`/api/portal/${portalToken}/payments`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        type: 'duty',
        description: 'Aranceles de importacion expediente test',
        amount: 1240.00,
        currency: 'EUR'
      }
    });
    const ok = r.status() < 400;
    const body = ok ? await r.json() : await r.text();
    log('payment-create', ok ? 'low' : 'high',
      `POST /portal/:token/payments → ${r.status()}`);
    if (ok) {
      const data = body?.data || body;
      paymentId = data?.paymentId || data?.payment?.paymentId || data?.payment?._id || data?._id;
      log('payment-id', paymentId ? 'low' : 'medium',
        `paymentId=${paymentId} totalAmount=${data?.totalAmount || data?.payment?.totalAmount}€ items=${data?.items?.length || 0}`);
    } else {
      log('payment-error', 'medium', `body=${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    }
  });

  test('5.3 — Status del pago + checkout Stripe', async ({ request }) => {
    test.skip(!portalToken || !paymentId);
    const sr = await request.get(`/api/portal/${portalToken}/payments/${paymentId}`);
    const ok = sr.status() < 400;
    const body = ok ? await sr.json() : await sr.text();
    log('payment-status', ok ? 'low' : 'high',
      `GET payment/${paymentId} → ${sr.status()}`);
    if (ok) {
      const data = body?.data || body;
      log('payment-status-info', 'low',
        `Status: ${data?.payment?.status || data?.status}, amount: ${data?.payment?.amount || data?.amount}`);
    }

    // Try Stripe checkout (likely fails if Stripe not configured, that's expected)
    const cr = await request.post(`/api/portal/${portalToken}/payments/${paymentId}/checkout`, {
      headers: { 'Content-Type': 'application/json' },
      data: {}
    });
    const cBody = cr.status() < 400 ? await cr.json() : await cr.text();
    log('payment-checkout', cr.status() < 400 ? 'low' : 'medium',
      `POST checkout → ${cr.status()} ${cr.status() >= 400 ? '(Stripe puede no estar configurado)' : ''}`);
    if (cr.status() < 400) {
      const data = cBody?.data || cBody;
      log('payment-checkout-url', data?.checkoutUrl ? 'low' : 'medium',
        `Checkout URL: ${data?.checkoutUrl?.slice(0, 80)}`);
    } else {
      log('payment-checkout-info', 'low',
        `body=${typeof cBody === 'string' ? cBody.slice(0, 200) : JSON.stringify(cBody).slice(0, 200)}`);
    }
  });

  // ==========================================================================
  // FASE 6: Verificación final del expediente
  // ==========================================================================

  test('6. Detail final con TODO el ciclo', async ({ page }) => {
    test.skip(!mongoId);
    await gotoApp(page, `/expeditions/${mongoId}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '04-final-detail.png'), fullPage: true });

    const status = await page.locator('span[class*="rounded-full"]').filter({
      hasText: /verde|naranja|rojo|levante|completed|submitted/i
    }).first().textContent({ timeout: 3000 }).catch(() => null);
    log('final-status-badge', 'low', `Estado UI: "${status?.trim()}"`);

    // Final API state
    const r = await page.request.get(`/api/expeditions/${mongoId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await r.json();
    const exp = body?.data;
    log('final-expedition', 'low',
      `status=${exp?.status} mrn=${exp?.declaration?.mrn} channel=${exp?.declaration?.channel} docs=${exp?.documents?.length} payments=${exp?.payments?.length || 0} timeline=${exp?.timeline?.length}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      expedition: { _id: mongoId, expeditionId, mrn, channel },
      portal: { token: portalToken, url: portalUrl },
      paymentId,
      docIds: docIds.length,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
