// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const OUT = path.join(__dirname, 'crash-diagnose');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let token, user;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const r = await request.post('/api/auth/login', { data: TEST_USER });
  const body = await r.json();
  token = body?.data?.token;
  user = body?.data?.user;
});

const ROUTES = ['/preferences', '/rules-engine', '/quotas', '/integrations'];

for (const route of ROUTES) {
  test(`crash diagnose ${route}`, async ({ context, page }) => {
    await context.addInitScript(({ t, u }) => {
      if (t) localStorage.setItem('token', t);
      if (u) localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('cookieConsent', 'accepted');
    }, { t: token, u: user });

    const errors = [];
    const consoleAll = [];
    const network = [];
    const requests = [];
    page.on('pageerror', (err) => errors.push({ message: err.message, stack: err.stack?.slice(0, 500) }));
    page.on('console', (msg) => {
      consoleAll.push({ type: msg.type(), text: msg.text().slice(0, 300) });
    });
    page.on('requestfailed', (req) => requests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText }));
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/api/') && res.status() >= 400) {
        network.push({ status: res.status(), method: res.request().method(), url: u.replace('https://aduanas.strixai.es', '') });
      }
    });

    // Inject error capture before any other JS runs
    await context.addInitScript(() => {
      window.__capturedErrors = [];
      window.addEventListener('error', (e) => {
        window.__capturedErrors.push({ kind: 'error', message: e.message, source: e.filename, line: e.lineno });
      });
      window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason || {};
        window.__capturedErrors.push({ kind: 'rejection', message: r.message || String(r), stack: r.stack?.slice(0, 500) });
      });
      // Patch console.error to capture React errors logged by error boundary in dev
      const origErr = console.error;
      console.error = (...args) => {
        try {
          window.__capturedErrors.push({ kind: 'console.error', args: args.map(a => {
            if (a instanceof Error) return { name: a.name, message: a.message, stack: a.stack?.slice(0, 800) };
            if (typeof a === 'object') return JSON.stringify(a).slice(0, 500);
            return String(a).slice(0, 800);
          }) });
        } catch {}
        return origErr.apply(console, args);
      };
    });

    await page.goto(route, { timeout: 20_000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const captured = await page.evaluate(() => window.__capturedErrors || []).catch(() => []);

    const safe = route.replace(/[^a-z0-9]/gi, '_');
    fs.writeFileSync(path.join(OUT, `${safe}.json`),
      JSON.stringify({ route, errors, captured, consoleErrors: consoleAll.filter(c => c.type === 'error'), network, requests }, null, 2));
    await page.screenshot({ path: path.join(OUT, `${safe}.png`), fullPage: true });
    console.log(`\n--- ${route} ---`);
    for (const e of errors) console.log(`PAGEERROR: ${e.message}`);
    for (const e of captured) console.log(`CAPTURED: [${e.kind}] ${e.message}`);
    for (const c of consoleAll.filter(c => c.type === 'error').slice(0, 4)) console.log(`CONSOLE: ${c.text}`);
    for (const n of network) console.log(`HTTP-${n.status}: ${n.method} ${n.url}`);
  });
}
