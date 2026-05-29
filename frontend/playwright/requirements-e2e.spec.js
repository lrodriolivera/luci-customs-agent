// @ts-check
/**
 * E2E /requirements — UI + datos vs API + filtros + links + asistente.
 *
 *   npx playwright test playwright/requirements-e2e.spec.js --project=chromium-headless-shell
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'requirements-test-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg, extra = {}) => findings.push({ cat, sev, msg, ...extra });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const apiData = {};

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Requirements (Requerimientos) E2E', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status()).toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;

    const stats = await request.get('/api/requirements/stats', { headers: { Authorization: `Bearer ${token}` } });
    apiData.stats = (await stats.json())?.data;
    const list = await request.get('/api/requirements', { headers: { Authorization: `Bearer ${token}` } });
    const listBody = await list.json();
    apiData.list = Array.isArray(listBody?.data) ? listBody.data
      : (listBody?.data?.requirements || []);

    log('api-stats', 'low',
      `stats: total=${apiData.stats?.total} pending=${apiData.stats?.pending} inProgress=${apiData.stats?.inProgress} resolved=${apiData.stats?.resolved} overdue=${apiData.stats?.overdue}`);
    log('api-list', 'low', `list: ${apiData.list.length} requerimientos`);
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

  test('1. Render base /requirements', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.screenshot({ path: path.join(SCREENS, '01-requirements-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', h1 ? 'low' : 'high', `h1="${h1?.trim()}"`);
    const errorBoundary = await page.locator('h1:has-text("Algo salio mal"), h1:has-text("Something went wrong")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);
  });

  test('2. 4 cards stats vs API', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(800);

    const counts = await page.locator('p.text-2xl.font-bold').allTextContents();
    log('stats-counts-ui', 'low', `Counts UI: [${counts.slice(0, 4).join(', ')}]`);

    const expected = [
      apiData.stats?.total ?? 0,
      apiData.stats?.pending ?? 0,
      apiData.stats?.inProgress ?? 0,
      apiData.stats?.resolved ?? 0
    ];
    const got = counts.slice(0, 4).map((c) => parseInt(c, 10));
    let mismatch = 0;
    const labels = ['total', 'pending', 'inProgress', 'resolved'];
    for (let i = 0; i < 4; i++) {
      if (got[i] !== expected[i]) {
        mismatch++;
        log(`stats-mismatch-${labels[i]}`, 'high',
          `${labels[i]}: UI=${got[i]} API=${expected[i]}`);
      }
    }
    if (mismatch === 0) log('stats-match', 'low', `4/4 stats coinciden con API`);
    await page.screenshot({ path: path.join(SCREENS, '02-stats-cards.png'), clip: { x: 0, y: 0, width: 1280, height: 320 } });
  });

  test('3. Tabla con datos reales', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(1000);

    const rowCount = await page.locator('tbody tr').count();
    log('table-rows', 'low', `Filas tabla: ${rowCount} (API: ${apiData.list.length})`);

    if (apiData.list[0]?.requirementNumber) {
      const visible = await page.locator(`text=${apiData.list[0].requirementNumber}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('first-req', visible ? 'low' : 'medium',
        `Primer requerimiento ${apiData.list[0].requirementNumber} visible: ${visible}`);
    }

    // Empty state if 0 rows
    if (rowCount === 0) {
      const empty = await page.locator('text=/no hay|no requirements/i').first().isVisible({ timeout: 3000 }).catch(() => false);
      log('empty-state', empty ? 'low' : 'medium', `Empty state visible: ${empty}`);
    }
    await page.screenshot({ path: path.join(SCREENS, '03-table.png'), fullPage: true });
  });

  test('4. Filtro por estado', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(800);

    const before = await page.locator('tbody tr').count();
    const select = page.locator('select').first();
    await select.selectOption('pending');
    await page.waitForTimeout(1500);
    const afterPending = await page.locator('tbody tr').count();
    log('filter-pending', 'low', `Filtro estado=pending: ${before} → ${afterPending}`);
    await page.screenshot({ path: path.join(SCREENS, '04-filter-pending.png'), fullPage: true });

    await select.selectOption('resolved');
    await page.waitForTimeout(1500);
    const afterResolved = await page.locator('tbody tr').count();
    log('filter-resolved', 'low', `Filtro estado=resolved: ${afterResolved}`);

    // Reset
    await select.selectOption('');
    await page.waitForTimeout(1000);
  });

  test('5. Filtro por canal (orange/red)', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(800);

    const channelSelect = page.locator('select').nth(1);
    await channelSelect.selectOption('orange');
    await page.waitForTimeout(1500);
    const afterOrange = await page.locator('tbody tr').count();
    log('filter-channel-orange', 'low',
      `Filtro canal=orange: ${afterOrange} (API byChannel.orange=${apiData.stats?.byChannel?.orange})`);
    await page.screenshot({ path: path.join(SCREENS, '05-filter-orange.png'), fullPage: true });

    await channelSelect.selectOption('red');
    await page.waitForTimeout(1500);
    const afterRed = await page.locator('tbody tr').count();
    log('filter-channel-red', 'low',
      `Filtro canal=red: ${afterRed} (API byChannel.red=${apiData.stats?.byChannel?.red})`);
    await page.screenshot({ path: path.join(SCREENS, '06-filter-red.png'), fullPage: true });

    // Verify "Limpiar" button appears
    const clearBtn = page.locator('button:has-text("Limpiar"), button:has-text("Clear")').first();
    const clearVisible = await clearBtn.isVisible({ timeout: 2000 }).catch(() => false);
    log('clear-btn', clearVisible ? 'low' : 'medium', `Boton Limpiar visible cuando hay filtros: ${clearVisible}`);
    if (clearVisible) {
      await clearBtn.click({ force: true });
      await page.waitForTimeout(1200);
      const afterClear = await page.locator('tbody tr').count();
      log('clear-result', 'low', `Click Limpiar: ${afterRed} → ${afterClear}`);
    }
  });

  test('6. Filtro por tipo', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(800);

    const typeSelect = page.locator('select').nth(2);
    await typeSelect.selectOption('documentary');
    await page.waitForTimeout(1500);
    const afterDoc = await page.locator('tbody tr').count();
    log('filter-type-doc', 'low', `Filtro tipo=documentary: ${afterDoc}`);
    await page.screenshot({ path: path.join(SCREENS, '07-filter-type.png'), fullPage: true });
  });

  test('7. Botón actualizar', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(800);

    const refresh = page.locator('button:has(svg)').filter({ hasText: /Actualizar|Update/i }).first();
    const visible = await refresh.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await refresh.click();
      await page.waitForTimeout(1500);
      log('refresh', 'low', 'Click Actualizar OK');
    } else {
      log('refresh', 'medium', 'Botón Actualizar no encontrado');
    }
  });

  test('8. Indicador de plazos (overdue/days)', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(1000);

    // Look for "Vencido" or red/orange days indicators
    const expired = await page.locator('text=/Vencido|Expired/i').count();
    const today = await page.locator('text=/Hoy|Today/i').count();
    log('deadline-indicators', 'low',
      `UI muestra: Vencido x${expired}, Hoy x${today}, API overdue=${apiData.stats?.overdue}`);

    const calendarIcons = await page.locator('svg[data-slot="icon"]').count();
    log('calendar-icons', 'low', `Iconos en filas: ${calendarIcons}`);
  });

  test('9. Links de filas no rotos', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(1000);

    const rowLinks = await page.locator('tbody tr a[href^="/expeditions/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')).filter(Boolean)
    );
    const unique = [...new Set(rowLinks)].slice(0, 5);
    log('row-links-count', 'low', `Links únicos a expeditions: ${unique.length} (sample 5)`);

    let broken = 0;
    for (const href of unique) {
      const r = await page.request.get(href);
      if (r.status() >= 400) { broken++; log('row-link-broken', 'high', `${href} → HTTP ${r.status()}`); }
    }
    log('row-links-summary', broken === 0 ? 'low' : 'high',
      `${unique.length - broken}/${unique.length} links sirven 200`);
  });

  test('10. Click en una fila navega al expediente', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(1000);

    const firstLink = page.locator('tbody tr a[href^="/expeditions/"]').first();
    if (!await firstLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('row-nav', 'medium', 'No hay filas navegables');
      return;
    }
    const href = await firstLink.getAttribute('href');
    await firstLink.click({ force: true });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const url = page.url();
    log('row-nav', url.includes(href) ? 'low' : 'high',
      `Click fila → ${url.split('strixai.es')[1]} (esperado ${href})`);
    await page.screenshot({ path: path.join(SCREENS, '08-detail-from-req.png'), fullPage: true });
  });

  test('11. Asistente desde /requirements', async ({ page }) => {
    await gotoApp(page, '/requirements');
    await page.waitForTimeout(800);

    const link = page.locator('a[href="/assistant"]').first();
    const visible = await link.isVisible({ timeout: 3000 }).catch(() => false);
    log('assistant-cta', visible ? 'low' : 'high', `CTA asistente visible: ${visible}`);
    if (visible) {
      await link.click({ force: true });
      await page.waitForURL(/\/assistant/, { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SCREENS, '09-assistant.png'), fullPage: true });
      const inputs = await page.locator('textarea, input[type="text"]').count();
      const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
      log('assistant-renders', !errorBoundary && inputs > 0 ? 'low' : 'high',
        `Asistente OK (no crash, inputs=${inputs})`);
    }
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      apiData: {
        stats: apiData.stats,
        listCount: apiData.list?.length
      },
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
