// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const OUT = path.join(__dirname, 'assistant-crash-diagnose');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
let token, user;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const r = await request.post('/api/auth/login', { data: TEST_USER });
  const body = await r.json();
  token = body?.data?.token;
  user = body?.data?.user;
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript(({ t, u }) => {
    if (t) localStorage.setItem('token', t);
    if (u) localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('i18nextLng', 'es');
    localStorage.setItem('cookieConsent', 'accepted');
  }, { t: token, u: user });
});

test('A. /assistant directo (full reload)', async ({ page, context }) => {
  const errors = [];
  await context.addInitScript(() => {
    window.__caps = [];
    const origErr = console.error;
    console.error = (...a) => {
      window.__caps.push(a.map((x) => x?.stack || x?.message || String(x)).join(' | ').slice(0, 500));
      origErr.apply(console, a);
    };
  });
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack?.slice(0, 500)}`));

  await page.goto('/assistant');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const caps = await page.evaluate(() => window.__caps || []);
  await page.screenshot({ path: path.join(OUT, 'A-direct.png'), fullPage: true });
  fs.writeFileSync(path.join(OUT, 'A-direct.json'), JSON.stringify({ errors, caps }, null, 2));
});

test('B. /expeditions → click link /assistant (SPA) with sourcemap decode', async ({ page, context }) => {
  const errors = [];
  await context.addInitScript(() => {
    window.__caps = [];
    const origErr = console.error;
    console.error = (...a) => {
      window.__caps.push(a.map((x) => x?.stack || x?.message || String(x)).join(' | ').slice(0, 1500));
      origErr.apply(console, a);
    };
  });
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack?.slice(0, 500)}`));

  await page.goto('/expeditions');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('a[href="/assistant"]').first().click({ force: true });
  await page.waitForURL(/\/assistant/, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const caps = await page.evaluate(() => window.__caps || []);
  const boundary = await page.evaluate(() => window.__lastBoundaryError || null);
  await page.screenshot({ path: path.join(OUT, 'B-spa.png'), fullPage: true });
  fs.writeFileSync(path.join(OUT, 'B-spa.json'), JSON.stringify({ errors, caps, boundary }, null, 2));
});

test.afterAll(() => {
  for (const f of ['A-direct.json', 'B-spa.json']) {
    const p = path.join(OUT, f);
    if (fs.existsSync(p)) {
      console.log(`\n=== ${f} ===`);
      console.log(fs.readFileSync(p, 'utf8').slice(0, 3000));
    }
  }
});
