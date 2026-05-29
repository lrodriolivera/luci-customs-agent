// @ts-check
/**
 * Envía a AEAT PRE el H1 recién creado (EXP-2026-MOKAF2T9).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'submit-h1-screens');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const MONGO_ID = '69f235f9b824b23085bfcf23';
const EXP_ID = 'EXP-2026-MOKAF2T9';

let token = null;
let user = null;

test('Enviar H1 EXP-2026-MOKAF2T9 a AEAT PRE', async ({ context, page, request }) => {
  test.setTimeout(180_000);

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

  // Auto-accept any confirm dialog
  page.on('dialog', (d) => {
    console.log(`[DIALOG] ${d.type()}: ${d.message()}`);
    d.accept().catch(() => {});
  });

  // Capture API responses
  const apiCalls = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/api/declarations/') && u.includes('/submit')) {
      try {
        const body = await res.json();
        apiCalls.push({ url: u, status: res.status(), body });
        console.log(`[API] ${res.status()} ${u}`);
      } catch {}
    }
  });

  // Step 1: navegar al detail
  console.log(`[1] Navigating to ${EXP_ID}...`);
  await page.goto(`/expeditions/${MONGO_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENS, '01-detail-pre-submit.png'), fullPage: true });

  // Step 2: localizar y hacer click en "Enviar a AEAT"
  console.log('[2] Looking for "Enviar a AEAT" button...');
  const sendBtn = page.locator('button').filter({ hasText: /Enviar a AEAT|Enviar AEAT/i }).first();
  const visible = await sendBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[2] Botón visible: ${visible}`);

  if (!visible) {
    fs.writeFileSync(path.join(SCREENS, 'report.json'), JSON.stringify({
      error: 'Botón "Enviar a AEAT" no encontrado',
      url: page.url()
    }, null, 2));
    return;
  }

  console.log('[3] Clicking "Enviar a AEAT"...');
  await sendBtn.click({ force: true });

  // Step 4: Wait for AEAT response (puede tardar 5-15s)
  console.log('[4] Waiting for AEAT response...');
  await page.waitForTimeout(20_000);
  await page.screenshot({ path: path.join(SCREENS, '02-after-aeat-submit.png'), fullPage: true });

  // Step 5: Extract MRN + canal from UI
  const mrnText = await page.locator('text=/MRN[:\\s]*[0-9A-Z]{18,}/i').first().textContent({ timeout: 3000 }).catch(() => null);
  const channelText = await page.locator('text=/CANAL\\s+(VERDE|NARANJA|ROJO)|Canal\\s+(verde|naranja|rojo)/i').first().textContent({ timeout: 3000 }).catch(() => null);

  console.log(`[5] MRN UI: "${mrnText?.trim()}"`);
  console.log(`[5] Canal UI: "${channelText?.trim()}"`);

  // Step 6: Pull final state via API
  const detailResp = await request.get(`/api/expeditions/${MONGO_ID}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const detail = await detailResp.json();
  const expData = detail?.data;
  console.log(`[6] Final state: status=${expData?.status} mrn=${expData?.declaration?.mrn} channel=${expData?.declaration?.channel}`);

  // Step 7: Final screenshot
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENS, '03-final-detail.png'), fullPage: true });

  fs.writeFileSync(path.join(SCREENS, 'report.json'), JSON.stringify({
    expedition: { mongoId: MONGO_ID, expeditionId: EXP_ID },
    aeatResponse: {
      mrn: expData?.declaration?.mrn,
      channel: expData?.declaration?.channel,
      status: expData?.status,
      acceptanceDate: expData?.declaration?.acceptanceDate,
      simulated: expData?.declaration?.aeatResponse?.simulated || false
    },
    uiTexts: { mrnText: mrnText?.trim(), channelText: channelText?.trim() },
    apiCalls: apiCalls.map((c) => ({
      status: c.status,
      url: c.url.replace('https://aduanas.strixai.es', ''),
      response: { success: c.body?.success, mrn: c.body?.data?.mrn || c.body?.mrn, channel: c.body?.data?.channel || c.body?.channel, error: c.body?.error }
    }))
  }, null, 2));
});
