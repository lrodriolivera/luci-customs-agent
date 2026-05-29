// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'submit-h1-screens');

test('Capturar detail con MRN real', async ({ context, page, request }) => {
  test.setTimeout(60_000);
  const r = await request.post('/api/auth/login', { data: TEST_USER });
  const body = await r.json();
  const token = body?.data?.token;
  const user = body?.data?.user;
  await context.addInitScript(({ t, u }) => {
    if (t) localStorage.setItem('token', t);
    if (u) localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('i18nextLng', 'es');
    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('cookies-accepted', 'true');
  }, { t: token, u: user });

  await page.goto('/expeditions/69f2387967c21d69270db342');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENS, '04-FINAL-mrn-canal-verde.png'), fullPage: true });
  console.log('captured');
});
