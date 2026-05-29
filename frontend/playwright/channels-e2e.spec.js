// @ts-check
/**
 * E2E /channels (circuitos) — UI + cards + datos vs API + links + asistente.
 *
 *   npx playwright test playwright/channels-e2e.spec.js --project=chromium-headless-shell
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'channels-test-screens');
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

test.describe('Channels (Circuitos) E2E', () => {
  test.beforeAll(async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: TEST_USER });
    expect(r.status()).toBe(200);
    const body = await r.json();
    token = body?.data?.token;
    user = body?.data?.user;

    const stats = await request.get('/api/channels/stats', { headers: { Authorization: `Bearer ${token}` } });
    apiData.stats = (await stats.json())?.data;
    const exps = await request.get('/api/channels/expeditions', { headers: { Authorization: `Bearer ${token}` } });
    const expsBody = await exps.json();
    apiData.expeditions = Array.isArray(expsBody?.data) ? expsBody.data : (expsBody?.data?.expeditions || []);

    log('api-stats', 'low',
      `stats: green=${apiData.stats?.green?.count} yellow=${apiData.stats?.yellow?.count} orange=${apiData.stats?.orange?.count} red=${apiData.stats?.red?.count} total=${apiData.stats?.total}`);
    log('api-expeditions', 'low', `expeditions: ${apiData.expeditions.length} items`);
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

  test('1. Render base /channels', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.screenshot({ path: path.join(SCREENS, '01-channels-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', h1 ? 'low' : 'high', `h1="${h1?.trim()}"`);

    // Country badge ES
    const esBadge = await page.locator('text=/AEAT|Espana/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('country-badge', esBadge ? 'low' : 'medium', `Badge AEAT/ES visible: ${esBadge}`);

    // Date range select
    const dateSelect = await page.locator('select').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('date-select', dateSelect ? 'low' : 'medium', `Selector fecha visible: ${dateSelect}`);
  });

  test('2. 4 cards estadísticas vs API', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(1000);

    // Each card has count as text-2xl font-bold
    const counts = await page.locator('button.p-4 span.text-2xl.font-bold').allTextContents();
    log('cards-counts-ui', 'low', `Counts UI: [${counts.join(', ')}]`);

    const expected = [
      apiData.stats?.green?.count ?? 0,
      apiData.stats?.yellow?.count ?? 0,
      apiData.stats?.orange?.count ?? 0,
      apiData.stats?.red?.count ?? 0
    ];
    const got = counts.slice(0, 4).map((c) => parseInt(c, 10));
    let mismatch = 0;
    for (let i = 0; i < 4; i++) {
      if (got[i] !== expected[i]) {
        mismatch++;
        log(`card-mismatch-${i}`, 'high',
          `Card ${i} (${['green','yellow','orange','red'][i]}): UI=${got[i]} API=${expected[i]}`);
      }
    }
    if (mismatch === 0) log('cards-match', 'low', `4/4 cards coinciden con API`);
    await page.screenshot({ path: path.join(SCREENS, '02-cards-stats.png'), clip: { x: 0, y: 0, width: 1280, height: 400 } });
  });

  test('3. Cards resumen (total, atencion, tiempo)', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    const total = await page.locator('text=/Total Procesados|Total processed/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const attention = await page.locator('text=/Requieren atencion|require attention/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const avg = await page.locator('text=/Tiempo medio|avg.*release/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('summary-cards', total && attention && avg ? 'low' : 'medium',
      `total=${total} attention=${attention} avg=${avg}`);

    const totalUI = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('p.text-2xl.font-bold'))
        .find((e) => e.parentElement?.parentElement?.textContent?.includes('Total'));
      return el?.textContent?.trim();
    });
    if (totalUI && parseInt(totalUI, 10) === apiData.stats?.total) {
      log('summary-total', 'low', `Total card: UI=${totalUI} = API ${apiData.stats?.total}`);
    } else {
      log('summary-total', 'medium', `Total card: UI="${totalUI}" vs API=${apiData.stats?.total}`);
    }
    await page.screenshot({ path: path.join(SCREENS, '03-summary-cards.png'), fullPage: true });
  });

  test('4. Tabla expedientes + datos vs API', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(1000);

    const rowCount = await page.locator('tbody tr').count();
    log('table-rows', 'low', `Filas tabla: ${rowCount}, API expeditions: ${apiData.expeditions.length}`);
    if (Math.abs(rowCount - apiData.expeditions.length) > 2) {
      log('table-mismatch', 'medium',
        `Discrepancia significativa filas vs API: UI=${rowCount} API=${apiData.expeditions.length}`);
    }

    // Verify first row has MRN if API has it
    if (apiData.expeditions[0]?.mrn) {
      const mrnVisible = await page.locator(`text=${apiData.expeditions[0].mrn}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('first-mrn', mrnVisible ? 'low' : 'medium',
        `MRN ${apiData.expeditions[0].mrn} visible: ${mrnVisible}`);
    }
    await page.screenshot({ path: path.join(SCREENS, '04-table.png'), fullPage: true });
  });

  test('5. Click card "verde" filtra tabla', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    const before = await page.locator('tbody tr').count();
    // Click green card (first button.p-4 in cards grid)
    const greenCard = page.locator('button.p-4.rounded-lg').first();
    await greenCard.click({ force: true });
    await page.waitForTimeout(600);
    const afterGreen = await page.locator('tbody tr').count();
    log('filter-green', 'low', `Click green: ${before} → ${afterGreen} filas`);

    if (apiData.stats?.green?.count !== afterGreen) {
      log('filter-green-count', 'medium',
        `Filas filtradas verde: UI=${afterGreen} vs API stats.green.count=${apiData.stats?.green?.count}`);
    }
    await page.screenshot({ path: path.join(SCREENS, '05-filter-green.png'), fullPage: true });

    // Click "Ver todo" — limpia filtro
    const verAll = page.locator('button:has-text("Ver todo"), button:has-text("View all")').first();
    if (await verAll.isVisible({ timeout: 2000 }).catch(() => false)) {
      await verAll.click();
      await page.waitForTimeout(500);
      const afterClear = await page.locator('tbody tr').count();
      log('filter-clear', afterClear === before ? 'low' : 'medium',
        `Click "Ver todo": ${afterGreen} → ${afterClear} (esperado ${before})`);
    }
  });

  test('6. Click cards naranja y rojo', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    // Naranja = card 3 (index 2)
    const cards = page.locator('button.p-4.rounded-lg');
    await cards.nth(2).click({ force: true });
    await page.waitForTimeout(500);
    const orangeCount = await page.locator('tbody tr').count();
    log('filter-orange', 'low',
      `Filtro naranja: ${orangeCount} filas (API esperado ${apiData.stats?.orange?.count})`);
    await page.screenshot({ path: path.join(SCREENS, '06-filter-orange.png'), fullPage: true });

    // Rojo = card 4 (index 3)
    await page.locator('button.p-4.rounded-lg').nth(3).click({ force: true });
    await page.waitForTimeout(500);
    const redCount = await page.locator('tbody tr').count();
    log('filter-red', 'low',
      `Filtro rojo: ${redCount} filas (API esperado ${apiData.stats?.red?.count})`);
    await page.screenshot({ path: path.join(SCREENS, '07-filter-red.png'), fullPage: true });
  });

  test('7. Selector fecha refresca data', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    const beforeCount = await page.locator('tbody tr').count();

    // Cambia a "today"
    const select = page.locator('select').first();
    await select.selectOption('today');
    await page.waitForTimeout(1500);
    const todayCount = await page.locator('tbody tr').count();
    log('filter-today', 'low', `Filtro fecha "today": ${beforeCount} → ${todayCount}`);
    await page.screenshot({ path: path.join(SCREENS, '08-filter-today.png'), fullPage: true });

    // Reset to "all"
    await select.selectOption('all');
    await page.waitForTimeout(1500);
  });

  test('8. Botón refresh', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    const refreshBtn = page.locator('button[title*="Actualizar"], button[title*="Refresh"]').first();
    const visible = await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await refreshBtn.click({ force: true });
      await page.waitForTimeout(1500);
      log('refresh-btn', 'low', 'Botón refresh OK');
    } else {
      log('refresh-btn', 'medium', 'Botón refresh no visible por title attr');
    }
  });

  test('9. Leyenda colores visible', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    const legendHeader = await page.locator('text=/Leyenda|Legend/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('legend', legendHeader ? 'low' : 'medium', `Sección leyenda visible: ${legendHeader}`);

    // Verde, Amarillo, Naranja, Rojo
    const labels = ['Verde', 'Amarillo', 'Naranja', 'Rojo'];
    let visibleCount = 0;
    for (const l of labels) {
      const count = await page.locator(`text=${l}`).count();
      if (count >= 1) visibleCount++;
    }
    log('legend-channels', visibleCount === 4 ? 'low' : 'medium',
      `Etiquetas leyenda: ${visibleCount}/4 visibles`);
    await page.screenshot({ path: path.join(SCREENS, '09-legend.png'), fullPage: true });
  });

  test('10. Links de filas no rotos', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(1000);

    const rowLinks = await page.locator('tbody tr a[href^="/expeditions/"], tbody tr a[href^="/h7/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')).filter(Boolean)
    );
    const unique = [...new Set(rowLinks)].slice(0, 5);  // sample of 5
    log('row-links-count', 'low', `Links de tabla únicos: ${unique.length} (sample 5)`);

    let broken = 0;
    for (const href of unique) {
      const r = await page.request.get(href);
      if (r.status() >= 400) { broken++; log('row-link-broken', 'high', `${href} → HTTP ${r.status()}`); }
    }
    log('row-links-summary', broken === 0 ? 'low' : 'high',
      `${unique.length - broken}/${unique.length} links sirven 200`);
  });

  test('11. Click en una fila navega al detail', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(1000);

    const firstLink = page.locator('tbody tr a').first();
    if (!await firstLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('row-nav', 'medium', 'No hay filas para click');
      return;
    }
    const href = await firstLink.getAttribute('href');
    await firstLink.click({ force: true });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const url = page.url();
    log('row-nav', url.includes(href) ? 'low' : 'high',
      `Click fila → ${url.split('strixai.es')[1]} (esperado ${href})`);
    await page.screenshot({ path: path.join(SCREENS, '10-row-detail.png'), fullPage: true });
  });

  test('12. Sidebar links + asistente accesible desde /channels', async ({ page }) => {
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    const assistantLink = page.locator('a[href="/assistant"]').first();
    const visible = await assistantLink.isVisible({ timeout: 3000 }).catch(() => false);
    log('assistant-cta', visible ? 'low' : 'high', `Asistente CTA visible: ${visible}`);
    if (visible) {
      await assistantLink.click({ force: true });
      await page.waitForURL(/\/assistant/, { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SCREENS, '11-assistant.png'), fullPage: true });
      const inputs = await page.locator('textarea, input[type="text"]').count();
      log('assistant-renders', inputs > 0 ? 'low' : 'high',
        `Asistente carga sin error boundary: inputs=${inputs}`);
    }
  });

  test('13. Vista NL (Países Bajos)', async ({ page, context }) => {
    // Override country to NL
    await context.addInitScript(() => localStorage.setItem('activeCustomsCountry', 'NL'));
    await gotoApp(page, '/channels');
    await page.waitForTimeout(800);

    const nlBadge = await page.locator('text=/Douane NL/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('nl-badge', nlBadge ? 'low' : 'medium', `Badge NL visible cuando country=NL: ${nlBadge}`);

    // Interpretacion NL
    const nlInterp = await page.locator('text=/Codigo 00|Codigo 10|Codigo 11/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('nl-interp', nlInterp ? 'low' : 'medium', `Interpretación NL (00/10/11) visible: ${nlInterp}`);
    await page.screenshot({ path: path.join(SCREENS, '12-channels-NL.png'), fullPage: true });
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      apiData: {
        stats: apiData.stats,
        expeditionsCount: apiData.expeditions?.length
      },
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
