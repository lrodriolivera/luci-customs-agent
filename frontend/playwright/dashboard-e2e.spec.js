// @ts-check
/**
 * E2E Dashboard inicial — pruebas exhaustivas con capturas.
 *
 *   npx playwright test playwright/dashboard-e2e.spec.js --project=chromium-headless-shell
 *
 * Capturas en: playwright/dashboard-test-screens/
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS_DIR = path.join(__dirname, 'dashboard-test-screens');
const REPORT_PATH = path.join(SCREENS_DIR, 'report.json');
if (!fs.existsSync(SCREENS_DIR)) fs.mkdirSync(SCREENS_DIR, { recursive: true });

const findings = [];
function record(category, severity, message, extra = {}) {
  findings.push({ category, severity, message, ...extra });
}

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const apiData = {};

async function gotoDashboard(page) {
  // Cierra cookie banner si aparece
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const acceptBtn = page.locator('button', { hasText: /^Accept$|^Aceptar$/i }).first();
  if (await acceptBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await acceptBtn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

test.describe('Dashboard E2E LUCI', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status(), 'login API').toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;
    expect(token).toBeTruthy();

    const exp = await request.get('/api/expeditions?limit=5', { headers: { Authorization: `Bearer ${token}` } });
    apiData.expeditions = (await exp.json())?.data;

    const al = await request.get('/api/dashboard/alerts', { headers: { Authorization: `Bearer ${token}` } });
    apiData.alerts = (await al.json())?.data;

    const cs = await request.get('/api/classification/cache-stats', { headers: { Authorization: `Bearer ${token}` } });
    apiData.cache = (await cs.json())?.data;

    record('api-expeditions', 'low',
      `expeditions: total=${apiData.expeditions?.total ?? '?'}, items=${apiData.expeditions?.expeditions?.length ?? 0}`);
    record('api-alerts', 'low',
      `alerts: total=${apiData.alerts?.stats?.total ?? '?'}, critical=${apiData.alerts?.stats?.critical ?? '?'}, warning=${apiData.alerts?.stats?.warning ?? '?'}`);
    record('api-cache', 'low',
      `cache: entries=${apiData.cache?.totalEntries ?? '?'}, hits=${apiData.cache?.totalHits ?? '?'}`);
  });

  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(({ t, u }) => {
      if (t) localStorage.setItem('token', t);
      if (u) localStorage.setItem('user', JSON.stringify(u));
      // Force ES locale (Playwright Chromium defaults to en-US which makes i18n load EN)
      localStorage.setItem('i18nextLng', 'es');
      // Auto-accept cookies
      localStorage.setItem('cookieConsent', 'accepted');
      localStorage.setItem('cookies-accepted', 'true');
    }, { t: token, u: user });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('favicon') && !txt.includes('sentry')) {
          record('console-error', 'medium', txt);
        }
      }
    });
    page.on('pageerror', (err) => record('page-error', 'critical', err.message));
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/api/') && res.status() >= 400 && !u.includes('/api/email')) {
        record('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  test('1. Login form snapshot (sin token)', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const hasEmail = await page.locator('input#email').isVisible({ timeout: 10_000 }).catch(() => false);
    record('login-form', hasEmail ? 'low' : 'critical', `Login input#email visible=${hasEmail}`);
    await page.screenshot({ path: path.join(SCREENS_DIR, '01-login-page.png'), fullPage: true });
    await ctx.close();
  });

  test('2. Dashboard renders + hero banner', async ({ page }) => {
    await gotoDashboard(page);
    await page.screenshot({ path: path.join(SCREENS_DIR, '02-dashboard-full.png'), fullPage: true });

    // Scope to hero banner (slate background)
    const hero = page.locator('div.bg-gradient-to-br.from-slate-900').first();
    const greeting = await hero.locator('p.text-sky-400').first().textContent().catch(() => null);
    const username = await hero.locator('h1').first().textContent().catch(() => null);
    const dateText = await hero.locator('p.text-slate-400').first().textContent().catch(() => null);
    record('hero', 'low', `greeting="${greeting?.trim()}" name="${username?.trim()}" date="${dateText?.trim()}"`);
    if (!username || username.trim() === 'Usuario') record('hero-username', 'medium', 'user.name vacio o fallback');

    // Validar fecha vs hoy
    const today = new Date();
    const monthEs = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][today.getMonth()];
    const expectFragment = `${today.getDate()} de ${monthEs}`;
    if (dateText && !dateText.includes(expectFragment)) {
      record('hero-date-mismatch', 'high',
        `Fecha del hero "${dateText.trim()}" no contiene "${expectFragment}" (hoy ${today.toISOString().slice(0, 10)})`);
    }
  });

  test('3. KPIs vs API', async ({ page }) => {
    await gotoDashboard(page);
    const kpiTexts = await page.locator('p.text-3xl.font-bold.text-white').allTextContents();
    record('kpi-render', 'low', `KPI values: ${JSON.stringify(kpiTexts)}`);

    // API limit:5 returns pagination.total = real total of all expeditions
    const apiTotal = apiData.expeditions?.pagination?.total
      ?? apiData.expeditions?.total
      ?? apiData.expeditions?.expeditions?.length
      ?? 0;
    const uiTotal = parseInt(kpiTexts[0] || '0', 10);
    if (uiTotal !== apiTotal) {
      record('kpi-total-mismatch', 'high', `UI Total=${uiTotal} vs API pagination.total=${apiTotal}`);
    }
    await page.screenshot({ path: path.join(SCREENS_DIR, '03-kpis.png'), clip: { x: 0, y: 100, width: 1280, height: 280 } });
  });

  test('4. Country selector ES <-> NL', async ({ page }) => {
    await gotoDashboard(page);
    const hero = page.locator('div.bg-gradient-to-br.from-slate-900').first();
    const aeat = hero.locator('button:has-text("AEAT")').first();
    const dms = hero.locator('button:has-text("DMS")').first();
    await expect(aeat).toBeVisible({ timeout: 10_000 });
    await expect(dms).toBeVisible({ timeout: 10_000 });

    await dms.click({ force: true });
    await page.waitForTimeout(300);
    const nl = await page.evaluate(() => localStorage.getItem('activeCustomsCountry'));
    if (nl !== 'NL') record('country-NL-switch', 'medium', `localStorage activeCustomsCountry esperaba NL, got=${nl}`);
    await page.screenshot({ path: path.join(SCREENS_DIR, '04a-country-NL.png'), clip: { x: 0, y: 0, width: 1280, height: 250 } });

    await aeat.click({ force: true });
    await page.waitForTimeout(300);
    const es = await page.evaluate(() => localStorage.getItem('activeCustomsCountry'));
    if (es !== 'ES') record('country-ES-switch', 'medium', `localStorage activeCustomsCountry esperaba ES, got=${es}`);
    await page.screenshot({ path: path.join(SCREENS_DIR, '04b-country-ES.png'), clip: { x: 0, y: 0, width: 1280, height: 250 } });
  });

  test('5. Quick Actions — 4 cards', async ({ page }) => {
    const cards = [
      { href: '/classification', name: 'classification' },
      { href: '/calculator', name: 'calculator' },
      { href: '/pue', name: 'pue' },
      { href: '/declarations', name: 'declarations' },
    ];
    // Verify dashboard renders the 4 cards
    await gotoDashboard(page);
    for (const { href } of cards) {
      const card = page.locator(`a.group.bg-white[href="${href}"]`).first();
      const visible = await card.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!visible) record('quick-action-card', 'high', `Quick Action card a.group.bg-white[href="${href}"] NO visible`);
    }
    // Navigate by direct URL (avoids sidebar overlap issues)
    for (const { href, name } of cards) {
      const resp = await page.goto(href, { timeout: 20_000 }).catch((e) => ({ error: e.message }));
      if (resp?.error) {
        record(`qa-${name}-goto`, 'high', `goto ${href} threw: ${resp.error}`);
        continue;
      }
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const status = resp?.status();
      const url = page.url();
      const titleVisible = await page.locator('h1, h2').first().isVisible({ timeout: 5_000 }).catch(() => false);
      const okUrl = url.includes(href);
      const ok = okUrl && titleVisible && (!status || status < 400);
      record(`qa-${name}`, ok ? 'low' : 'medium',
        `${href} → status=${status} url-ok=${okUrl} title=${titleVisible}`);
      await page.screenshot({ path: path.join(SCREENS_DIR, `05-qa-${name}.png`), fullPage: true });
    }
  });

  test('6. Alerts vs API', async ({ page }) => {
    await gotoDashboard(page);
    const apiTotal = apiData.alerts?.stats?.total ?? 0;
    const apiCritical = apiData.alerts?.stats?.critical ?? 0;
    const apiWarning = apiData.alerts?.stats?.warning ?? 0;

    if (apiTotal === 0) {
      const empty = await page.locator('text=/sin alertas|no alerts|no hay alertas|al dia|all good/i').first().isVisible({ timeout: 5_000 }).catch(() => false);
      if (!empty) record('alerts-empty-state', 'medium', 'API sin alertas, UI no muestra empty state explicito');
    } else {
      const alertsHeader = page.locator('text=/Alerts|Alertas/i').first();
      const visible = await alertsHeader.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!visible) record('alerts-header', 'high', `API tiene ${apiTotal} alertas pero header "Alerts" no visible`);
      const items = await page.locator('a[href*="/requirements"], a[href*="/guarantees"]').count();
      record('alerts-items', 'low', `Items en sidebar alertas (links a requirements/guarantees): ${items}`);
    }
    await page.screenshot({ path: path.join(SCREENS_DIR, '06-alerts.png'), fullPage: true });
  });

  test('7. Recent Expeditions', async ({ page }) => {
    await gotoDashboard(page);
    const apiList = apiData.expeditions?.expeditions || [];
    const expCount = apiList.length;
    const uiLinks = await page.locator('a[href^="/expeditions/"]:not([href="/expeditions/new"])').count();
    record('recent-exp-count', 'low', `API expeditions=${expCount}, UI links a expedition detail=${uiLinks}`);
    if (expCount > 0 && uiLinks === 0) {
      record('recent-exp-render', 'high', `API tiene ${expCount} expeditions pero UI no las renderiza`);
    }
    if (expCount === 0) {
      const empty = await page.locator('text=/no expeditions|sin expediciones|crear.*expedicion|create.*expedition/i').first().isVisible({ timeout: 5_000 }).catch(() => false);
      if (!empty) record('recent-exp-empty', 'medium', 'API vacia y UI sin empty state');
    }
    await page.screenshot({ path: path.join(SCREENS_DIR, '07-recent-expeditions.png'), fullPage: true });
  });

  test('8. AI Engine card vs cache real', async ({ page }) => {
    await gotoDashboard(page);
    const taricTotal = apiData.cache?.taricCodesTotal ?? 0;
    const aiQueries = apiData.cache?.aiQueriesLast30d ?? 0;
    record('ai-engine-stats', 'low', `taricCodesTotal=${taricTotal}, aiQueriesLast30d=${aiQueries}`);
    if (taricTotal < 10000) {
      record('ai-engine-low', 'medium',
        `Card AI Engine muestra solo ${taricTotal} codigos TARIC; deberian ser ~21,946`);
    }
    await page.screenshot({ path: path.join(SCREENS_DIR, '08-ai-engine.png'), fullPage: true });
  });

  test('9. Platform stats vs API', async ({ page }) => {
    await gotoDashboard(page);
    const taricTotal = apiData.cache?.taricCodesTotal ?? 0;
    const taricChapters = apiData.cache?.taricChapters ?? 0;

    const has195 = await page.locator('text=/^\\s*195\\s*$/').first().isVisible({ timeout: 2_000 }).catch(() => false);
    const has98 = await page.locator('text=/^\\s*98\\s*$/').first().isVisible({ timeout: 2_000 }).catch(() => false);
    if (has195) record('platform-still-hardcoded-195', 'medium', 'Card "Países 195" sigue hardcoded');
    if (has98) record('platform-still-hardcoded-98', 'medium', 'Card "Capítulos 98" sigue hardcoded');

    record('platform-real', 'low',
      `Backend reporta taricCodesTotal=${taricTotal}, taricChapters=${taricChapters}`);
    await page.screenshot({ path: path.join(SCREENS_DIR, '09-platform-stats.png'), fullPage: true });
  });

  test('10. LUCI Assistant CTA', async ({ page }) => {
    await gotoDashboard(page);
    const cta = page.locator('a.bg-gradient-to-r[href="/assistant"]').first();
    const visible = await cta.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      record('assistant-cta', 'high', 'CTA "LUCI Assistant" NO visible en dashboard');
    } else {
      record('assistant-cta', 'low', 'CTA visible');
    }
    const resp = await page.goto('/assistant', { timeout: 20_000 }).catch((e) => ({ error: e.message }));
    if (resp?.error) {
      record('assistant-goto', 'high', `goto /assistant fallo: ${resp.error}`);
      return;
    }
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    const status = resp?.status();
    if (status && status >= 400) record('assistant-status', 'high', `/assistant returned HTTP ${status}`);
    await page.screenshot({ path: path.join(SCREENS_DIR, '10-assistant.png'), fullPage: true });
    const inputs = await page.locator('textarea, input[type="text"]').count();
    record('assistant-page', inputs > 0 ? 'low' : 'medium',
      `Assistant page inputs (textarea/text)=${inputs}`);
  });

  test('11. New Expedition button', async ({ page }) => {
    await gotoDashboard(page);
    const hero = page.locator('div.bg-gradient-to-br.from-slate-900').first();
    const btn = hero.locator('a[href="/expeditions/new"]').first();
    const visible = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
    record('new-exp-btn', visible ? 'low' : 'high', `Boton "Nueva Expedicion" hero visible=${visible}`);

    const resp = await page.goto('/expeditions/new', { timeout: 20_000 }).catch((e) => ({ error: e.message }));
    if (resp?.error) record('new-exp-goto', 'high', `goto fallo: ${resp.error}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENS_DIR, '11-new-expedition.png'), fullPage: true });
    const formFields = await page.locator('input, select, textarea').count();
    record('new-exp-form', formFields > 0 ? 'low' : 'medium', `Form fields en /expeditions/new=${formFields}`);
  });

  test('12. Sidebar links — verifica que ninguno esta roto', async ({ page }) => {
    await gotoDashboard(page);
    const sidebarLinks = await page.locator('nav a[href^="/"]').evaluateAll((els) =>
      els.map((e) => ({ href: e.getAttribute('href'), text: e.textContent?.trim().slice(0, 40) })),
    );
    record('sidebar-count', 'low', `Sidebar links encontrados: ${sidebarLinks.length}`);

    const sample = sidebarLinks
      .filter((l) => l.href && !l.href.includes('://') && l.href !== '/' && l.href !== '#')
      .filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i);

    for (const { href, text } of sample) {
      const resp = await page.goto(href, { timeout: 15_000 }).catch((e) => ({ error: e.message }));
      if (resp?.error) {
        record('sidebar-link-error', 'high', `${href} ("${text}"): ${resp.error}`);
        continue;
      }
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      const status = resp?.status?.() ?? 200;
      const titleVisible = await page.locator('h1, h2').first().isVisible({ timeout: 3_000 }).catch(() => false);
      // Specific error boundary detection — "Something went wrong" is the exact ErrorBoundary heading
      const errorBoundary = await page.locator('h1:has-text("Something went wrong"), h1:has-text("Algo salio mal"), h1:has-text("Algo salió mal")').first().isVisible({ timeout: 1_500 }).catch(() => false);
      const safe = href.replace(/[^a-z0-9]/gi, '_');
      await page.screenshot({ path: path.join(SCREENS_DIR, `12-link${safe}.png`) });
      if (status >= 400) record('sidebar-link-http', 'high', `${href} HTTP ${status}`);
      if (!titleVisible) record('sidebar-link-empty', 'medium', `${href} ("${text}") sin h1/h2 visible`);
      if (errorBoundary) record('sidebar-link-error-boundary', 'critical', `${href} ("${text}") muestra error boundary`);
    }
  });

  test.afterAll(async () => {
    fs.writeFileSync(REPORT_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      apiData: {
        expeditionsTotal: apiData.expeditions?.total ?? null,
        expeditionsCount: apiData.expeditions?.expeditions?.length ?? 0,
        alertsTotal: apiData.alerts?.stats?.total ?? null,
        alertsCritical: apiData.alerts?.stats?.critical ?? null,
        alertsWarning: apiData.alerts?.stats?.warning ?? null,
        cacheEntries: apiData.cache?.totalEntries ?? null,
        cacheHits: apiData.cache?.totalHits ?? null,
      },
      findings,
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.severity}] (${f.category}) ${f.message}`);
    console.log(`\n=== REPORT ${REPORT_PATH} ===`);
  });
});
