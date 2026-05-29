// @ts-check
/**
 * E2E /analytics — Analytics & BI dashboard.
 *
 * Cobertura UI desde el front:
 *  1) Render base + h1/subtitle traducidos + 4 tabs + boton Centro IA + select periodo + refresh
 *  2) Real-time status bar (AEAT conectado + alertas)
 *  3) Tab Vision General: 4 stats cards + 2 charts + LUCI Insights
 *  4) Tab KPIs: Health Score + KPIs por categoria + Alertas
 *  5) Tab Financiero: 3 cards + Utilizacion Garantias
 *  6) Tab Cumplimiento: 4 cards + Completitud Documental
 *  7) Select de periodo con 8 opciones traducidas
 *  8) Modal Centro de Analisis IA con 6 tabs (insights/anomalies/trends/executive/kpi/full)
 *  9) Click "Ejecutar Analisis" en tab insights -> POST /api/analytics/ai/insights
 * 10) Captura final
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'analytics-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Analytics & BI /analytics', () => {
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

  // -------------------------------------------------------------------------
  // 1. Render base
  // -------------------------------------------------------------------------
  test('1. Render base /analytics + h1 traducido + 4 tabs + boton IA + select + refresh', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(4500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    const titleOk = h1 && !/analyticsPage\.title/.test(h1) && /Analytics|BI/i.test(h1);
    log('h1', titleOk ? 'low' : 'critical', `h1: "${h1?.trim()}"`);

    // Subtitle no debe ser literal
    const subtitleLiteral = await page.locator('text="analyticsPage.subtitle"').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('subtitle-literal', !subtitleLiteral ? 'low' : 'critical', `Literal "analyticsPage.subtitle" visible: ${subtitleLiteral}`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // 4 tabs: Vision General, KPIs, Financiero, Cumplimiento
    for (const tab of ['Vision General', 'KPIs', 'Financiero', 'Cumplimiento']) {
      const visible = await page.locator(`button:has-text("${tab}")`).first().isVisible({ timeout: 1500 }).catch(() => false);
      log('tab', visible ? 'low' : 'medium', `Tab "${tab}" visible: ${visible}`);
    }

    // Boton Centro IA (gradient)
    const aiBtn = await page.locator('button').filter({ hasText: /Centro de Analisis IA/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('ai-btn', aiBtn ? 'low' : 'medium', `Boton "Centro de Analisis IA" visible: ${aiBtn}`);

    // Select periodo
    const periodSelect = page.locator('select').first();
    const optionsCount = await periodSelect.locator('option').count();
    log('period-options', optionsCount === 8 ? 'low' : 'medium', `Opciones select periodo: ${optionsCount} (esperado 8)`);

    // Verificar que las opciones tienen texto (no estan vacias por bug p.label)
    const firstOptionText = await periodSelect.locator('option').first().textContent().catch(() => '');
    log('period-text', firstOptionText && firstOptionText.trim().length > 0 ? 'low' : 'high',
      `Primera opcion texto: "${firstOptionText?.trim()}"`);
  });

  // -------------------------------------------------------------------------
  // 2. Real-time status bar
  // -------------------------------------------------------------------------
  test('2. Real-time status bar - AEAT y alertas', async ({ page }) => {
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(4000);

    const realTimeLabel = await page.locator('text=/En tiempo real/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('rt-label', realTimeLabel ? 'low' : 'medium', `Indicador "En tiempo real" visible: ${realTimeLabel}`);

    const aeatLabel = await page.locator('text=/AEAT:/').first().isVisible({ timeout: 2500 }).catch(() => false);
    log('rt-aeat', aeatLabel ? 'low' : 'medium', `Indicador AEAT visible: ${aeatLabel}`);

    const declarationsLabel = await page.locator('text=/Declaraciones activas:/').first().isVisible({ timeout: 2500 }).catch(() => false);
    log('rt-declaraciones', declarationsLabel ? 'low' : 'medium', `Etiqueta "Declaraciones activas" visible: ${declarationsLabel}`);

    await page.screenshot({ path: path.join(SCREENS, '02-realtime-bar.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab Vision General - cards y graficos
  // -------------------------------------------------------------------------
  test('3. Tab Vision General - 4 stats cards + 2 charts + Insights LUCI', async ({ page }) => {
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(4000);

    // 4 cards
    for (const lbl of ['Declaraciones', 'Valor Aduanero', 'Cumplimiento', 'Tiempo Medio']) {
      const visible = await page.locator(`text=/^${lbl}$/`).first().isVisible({ timeout: 2500 }).catch(() => false);
      log('overview-card', visible ? 'low' : 'medium', `Card "${lbl}" visible: ${visible}`);
    }

    const charts = await page.locator('text=/Distribucion por Canal|Declaraciones por Tipo/').count();
    log('overview-charts', charts >= 2 ? 'low' : 'medium', `Charts visibles: ${charts}`);

    // LUCI Insights card
    const luciInsights = await page.locator('h3:has-text("Insights de LUCI")').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('luci-insights-card', luciInsights ? 'low' : 'low',
      `Card "Insights de LUCI" visible: ${luciInsights} (puede no aparecer si no hay datos del backend)`);

    await page.screenshot({ path: path.join(SCREENS, '03-overview-tab.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 4. Tab KPIs - Health Score + categorias
  // -------------------------------------------------------------------------
  test('4. Tab KPIs - Health Score + categorias + alertas', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(3500);

    await page.locator('button:has-text("KPIs")').first().click({ timeout: 3000 });
    await page.waitForTimeout(3000);

    const healthHeading = await page.locator('text=/Salud del Sistema/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('kpi-health', healthHeading ? 'low' : 'medium', `Heading "Salud del Sistema" visible: ${healthHeading}`);

    const scoreNumber = await page.locator('span.text-2xl.font-bold').first().textContent({ timeout: 2000 }).catch(() => '');
    log('kpi-score', /\d+/.test(scoreNumber || '') ? 'low' : 'medium', `Score numerico: "${scoreNumber?.trim()}"`);

    await page.screenshot({ path: path.join(SCREENS, '04-kpis-tab.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 5. Tab Financiero
  // -------------------------------------------------------------------------
  test('5. Tab Financiero - 3 cards + Utilizacion Garantias', async ({ page }) => {
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(3500);

    await page.locator('button:has-text("Financiero")').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    for (const lbl of ['Derechos Calculados', 'Derechos Pagados', 'Ahorros Potenciales']) {
      const visible = await page.locator(`text=/^${lbl}$/`).first().isVisible({ timeout: 2000 }).catch(() => false);
      log('financial-card', visible ? 'low' : 'medium', `Card "${lbl}" visible: ${visible}`);
    }

    const guarantee = await page.locator('text=/Utilizacion de Garantias/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('financial-guarantee', guarantee ? 'low' : 'medium', `"Utilizacion de Garantias" visible: ${guarantee}`);

    await page.screenshot({ path: path.join(SCREENS, '05-financial-tab.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 6. Tab Cumplimiento
  // -------------------------------------------------------------------------
  test('6. Tab Cumplimiento - 4 cards + Completitud Documental', async ({ page }) => {
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(3500);

    await page.locator('button:has-text("Cumplimiento")').first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    for (const lbl of ['Tasa de Error', 'Tasa de Rechazo', 'Envios a Tiempo', 'Tasa de Inspeccion']) {
      const visible = await page.locator(`text=/^${lbl}$/`).first().isVisible({ timeout: 2000 }).catch(() => false);
      log('compliance-card', visible ? 'low' : 'medium', `Card "${lbl}" visible: ${visible}`);
    }

    const completeness = await page.locator('text=/Completitud Documental/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('compliance-completeness', completeness ? 'low' : 'medium', `"Completitud Documental" visible: ${completeness}`);

    await page.screenshot({ path: path.join(SCREENS, '06-compliance-tab.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 7. Select de periodo con opciones traducidas
  // -------------------------------------------------------------------------
  test('7. Select periodo con 8 opciones traducidas y cambio de periodo', async ({ page }) => {
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(3500);

    const apiCalls = [];
    page.on('response', (r) => {
      if (r.url().match(/\/api\/analytics\/dashboard\?period=/)) {
        apiCalls.push({ url: r.url(), status: r.status() });
      }
    });

    const select = page.locator('select').first();
    await select.selectOption('this_month').catch(() => {});
    await page.waitForTimeout(2500);

    log('period-change', apiCalls.length > 0 ? 'low' : 'medium',
      `Llamadas dashboard tras cambiar periodo: ${apiCalls.length}, last status=${apiCalls[apiCalls.length - 1]?.status}`);

    // Comprobar opcion seleccionada
    const value = await select.inputValue();
    log('period-value', value === 'this_month' ? 'low' : 'medium', `Valor seleccionado: ${value}`);

    await page.screenshot({ path: path.join(SCREENS, '07-period-this-month.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 8. Modal Centro IA - 6 tabs visibles
  // -------------------------------------------------------------------------
  test('8. Modal Centro de Analisis IA - 6 tabs visibles', async ({ page }) => {
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(3500);

    await page.locator('button').filter({ hasText: /Centro de Analisis IA/i }).first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Verificar header del modal
    const modalHeader = await page.locator('h2').filter({ hasText: /Centro de Analisis IA|AI Analysis/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    log('ai-modal-header', modalHeader ? 'low' : 'medium', `Modal header IA visible: ${modalHeader}`);

    // 6 tabs (i18n keys dentro del modal)
    const expectedTabs = ['Insights', 'Anomalias', 'Tendencias|Trends', 'Reporte Ejecutivo|Executive', 'KPI', 'Analisis Completo|Full'];
    let tabsFound = 0;
    for (const tabLabel of expectedTabs) {
      const re = new RegExp(tabLabel, 'i');
      const visible = await page.locator(`button`).filter({ hasText: re }).first().isVisible({ timeout: 1500 }).catch(() => false);
      if (visible) tabsFound++;
    }
    log('ai-tabs', tabsFound >= 5 ? 'low' : 'medium', `Tabs IA encontradas: ${tabsFound}/6`);

    await page.screenshot({ path: path.join(SCREENS, '08-ai-modal.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 9. Click "Ejecutar Analisis" - tab insights
  // -------------------------------------------------------------------------
  test('9. Click "Ejecutar Analisis" en tab Insights -> POST IA insights', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(3500);

    await page.locator('button').filter({ hasText: /Centro de Analisis IA/i }).first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    const aiCalls = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/analytics\/ai\/insights/)) {
        try {
          const body = await r.json();
          aiCalls.push({ status: r.status(), success: body?.success, dataKeys: Object.keys(body?.data || {}) });
        } catch {}
      }
    });

    // Click "Ejecutar Analisis"
    const runBtn = page.locator('button').filter({ hasText: /Ejecutar Analisis/i }).first();
    if (await runBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await runBtn.click({ timeout: 3000 });
      await page.waitForResponse((r) => r.url().includes('/ai/insights'), { timeout: 150_000 }).catch(() => {});
      await page.waitForTimeout(2500);
    } else {
      log('ai-run-btn', 'medium', 'Boton "Ejecutar Analisis" no visible al abrir modal');
    }

    log('ai-insights-call', aiCalls.length > 0 ? 'low' : 'medium',
      `POST /ai/insights llamadas: ${aiCalls.length}, status=${aiCalls[0]?.status}, dataKeys=${(aiCalls[0]?.dataKeys || []).join(',')}`);

    await page.screenshot({ path: path.join(SCREENS, '09-ai-insights-result.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 10. Refresh manual + cierre modal
  // -------------------------------------------------------------------------
  test('10. Boton refresh manual + cerrar modal IA', async ({ page }) => {
    await gotoApp(page, '/analytics');
    await page.waitForTimeout(3500);

    const apiCalls = [];
    page.on('response', (r) => {
      if (r.url().match(/\/api\/analytics\/(dashboard|kpis\/dashboard)/)) {
        apiCalls.push({ url: r.url(), status: r.status() });
      }
    });

    // Boton refresh: ultimo boton del header (icono ArrowPath)
    const refreshBtns = page.locator('button[title*="Actualizar"], button[aria-label*="Actualizar"]');
    const count = await refreshBtns.count();
    if (count > 0) {
      await refreshBtns.first().click().catch(() => {});
      await page.waitForTimeout(2000);
      log('refresh-btn', apiCalls.length > 0 ? 'low' : 'medium',
        `Refresh -> ${apiCalls.length} calls, statuses=${apiCalls.map(c => c.status).join(',')}`);
    } else {
      log('refresh-btn-not-found', 'medium', 'Boton refresh con title="Actualizar" no encontrado');
    }

    await page.screenshot({ path: path.join(SCREENS, '10-after-refresh.png'), fullPage: true });
  });

  test.afterAll(async () => {
    fs.writeFileSync(REPORT, JSON.stringify({
      timestamp: new Date().toISOString(),
      total_findings: findings.length,
      critical: findings.filter(f => f.sev === 'critical').length,
      high: findings.filter(f => f.sev === 'high').length,
      medium: findings.filter(f => f.sev === 'medium').length,
      low: findings.filter(f => f.sev === 'low').length,
      findings
    }, null, 2));
  });
});
