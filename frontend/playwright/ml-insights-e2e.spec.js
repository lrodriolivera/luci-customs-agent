// @ts-check
/**
 * E2E /ml-insights — Sistema ML para aduanas (6 tabs).
 *
 * Cobertura UI:
 *  1) Render base + h1 "ML Insights" + 6 tabs + boton Actualizar
 *  2) Tab Overview: 5 stats cards + Estado Sistema + Confianza Modelos (3 barras)
 *  3) Tab Classification: form (descripcion/material/uso) + boton "Clasificar con ML" -> POST /api/ml/classify -> render TARIC + confianza
 *  4) Tab Fraud: form (origen/TARIC/valor/cantidad) + "Analizar Fraude" -> POST /api/ml/fraud/analyze -> render risk level + alerts
 *  5) Tab Channel: form (origen/TARIC/valor/EORI) + "Predecir Circuito" -> POST /api/ml/predict-channel -> render canal verde/naranja/rojo + probabilidades
 *  6) Tab Recommendations: form + "Generar Recomendaciones" -> POST /api/ml/recommendations
 *  7) Tab Auto-Response: lista plantillas (GET /api/ml/auto-response/templates)
 *  8) Boton Actualizar header recarga stats
 *
 * 5 endpoints IA validados: /classify, /fraud/analyze, /predict-channel, /recommendations, /auto-response/templates.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'ml-insights-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });
test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

// Tab interno del ml-insights (scope al nav que contiene "Vista General"/"Clasificacion"/...).
function mlTab(page, re) {
  return page.locator('nav button').filter({ hasText: re }).first();
}

test.describe('ML Insights /ml-insights', () => {
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
  test('1. Render base /ml-insights + h1 + 6 tabs + boton Actualizar', async ({ page }) => {
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '01-render-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /ML Insights/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    const expectedTabs = [
      /Vista General|Overview/i,
      /Clasificacion|Classification/i,
      /Deteccion Fraude|Fraud/i,
      /Prediccion Circuito|Channel/i,
      /Recomendaciones|Recommendations/i,
      /Auto-Respuesta|Auto Response/i,
    ];
    let tabsFound = 0;
    for (const re of expectedTabs) {
      const v = await mlTab(page, re).isVisible({ timeout: 1500 }).catch(() => false);
      if (v) tabsFound++;
    }
    log('tabs-count', tabsFound === 6 ? 'low' : 'medium', `Tabs visibles: ${tabsFound}/6`);

    const refreshBtn = await page.locator('button').filter({ hasText: /Actualizar|Refresh/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('refresh-btn', refreshBtn ? 'low' : 'medium', `Boton Actualizar visible: ${refreshBtn}`);
  });

  // -------------------------------------------------------------------------
  // 2. Tab Overview - stats + system health + model confidence
  // -------------------------------------------------------------------------
  test('2. Tab Overview - 5 stats cards + Estado del Sistema + Confianza Modelos', async ({ page }) => {
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(3000);

    for (const lbl of ['Clasificaciones', 'Analisis Fraude', 'Predicciones', 'Recomendaciones', 'Auto-Respuestas']) {
      const v = await page.locator(`text=/^${lbl}$/`).first().isVisible({ timeout: 2500 }).catch(() => false);
      log('stat-card', v ? 'low' : 'medium', `Card "${lbl}" visible: ${v}`);
    }

    const health = await page.locator('text=/Estado del Sistema ML/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('system-health', health ? 'low' : 'medium', `Estado Sistema ML visible: ${health}`);

    const confidence = await page.locator('text=/Confianza de Modelos/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('confidence', confidence ? 'low' : 'medium', `Confianza Modelos visible: ${confidence}`);

    // 3 barras: clasificacion, prediccion circuito, deteccion fraude
    for (const lbl of ['Clasificacion TARIC', 'Prediccion de Circuito', 'Deteccion de Fraude']) {
      const v = await page.locator(`text=/${lbl}/`).first().isVisible({ timeout: 2000 }).catch(() => false);
      log('confidence-bar', v ? 'low' : 'medium', `Barra "${lbl}": ${v}`);
    }

    await page.screenshot({ path: path.join(SCREENS, '02-overview.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 3. Tab Classification - clasificar producto con ML
  // -------------------------------------------------------------------------
  test('3. Tab Classification - clasificar camiseta algodon con ML', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(2500);

    await mlTab(page, /Clasificacion|Classification/i).click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Form
    await page.locator('textarea').first().fill('Camiseta de algodon para hombre, manga corta, cuello redondo');
    const matInput = page.locator('input[placeholder*="algodon"], input[placeholder*="100%"]').first();
    if (await matInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await matInput.fill('100% algodon').catch(() => {});
    }
    const useInput = page.locator('input[placeholder*="vestir"]').first();
    if (await useInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await useInput.fill('vestir').catch(() => {});
    }

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/ml/classify') && !r.url().includes('feedback') && !r.url().includes('stats')) {
        try {
          const body = await r.json();
          apiCalls.push({ status: r.status(), success: body?.success, hasResult: !!body?.classification });
        } catch {}
      }
    });

    await page.locator('button').filter({ hasText: /Clasificar con ML/i }).first().click({ timeout: 3000 });
    await page.waitForResponse((r) => r.url().includes('/api/ml/classify') && r.status() < 500, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2500);

    log('classify-call', apiCalls.length > 0 ? 'low' : 'medium',
      `POST /classify: ${apiCalls.length} llamadas, status=${apiCalls[0]?.status}, hasResult=${apiCalls[0]?.hasResult}`);

    // Resultado visible
    const taricVisible = await page.locator('text=/Codigo TARIC Sugerido|TARIC|Capitulo/').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('classify-result', taricVisible ? 'low' : 'medium', `Resultado TARIC visible: ${taricVisible}`);

    await page.screenshot({ path: path.join(SCREENS, '03-classification.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 4. Tab Fraud - analizar fraude
  // -------------------------------------------------------------------------
  test('4. Tab Fraud - analisis fraude CN textil', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(2500);

    await mlTab(page, /Deteccion Fraude|Fraud/i).click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Form: CN ya seleccionado por defecto
    await page.locator('input[placeholder*="6109100010"]').first().fill('6109100010').catch(() => {});
    await page.locator('input[placeholder="Ej: 10000"]').first().fill('5000').catch(() => {});
    await page.locator('input[placeholder="Ej: 1000"]').first().fill('500').catch(() => {});

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/ml/fraud/analyze')) {
        try {
          const body = await r.json();
          apiCalls.push({ status: r.status(), success: body?.success, riskLevel: body?.overallRiskLevel });
        } catch {}
      }
    });

    await page.locator('button').filter({ hasText: /Analizar Fraude/i }).first().click({ timeout: 3000 });
    await page.waitForResponse((r) => r.url().includes('/api/ml/fraud/analyze') && r.status() < 500, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2500);

    log('fraud-call', apiCalls.length > 0 ? 'low' : 'medium',
      `POST /fraud/analyze: ${apiCalls.length} llamadas, status=${apiCalls[0]?.status}, riskLevel=${apiCalls[0]?.riskLevel}`);

    const riskCardVisible = await page.locator('text=/Nivel de Riesgo|Puntuacion/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('fraud-result', riskCardVisible ? 'low' : 'medium', `Card riesgo visible: ${riskCardVisible}`);

    await page.screenshot({ path: path.join(SCREENS, '04-fraud.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 5. Tab Channel - predecir circuito
  // -------------------------------------------------------------------------
  test('5. Tab Channel - predecir canal CN laptops', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(2500);

    await mlTab(page, /Prediccion Circuito|Channel/i).click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    await page.locator('input[placeholder*="8471300000"]').first().fill('8471300000').catch(() => {});
    await page.locator('input[placeholder*="50000"]').first().fill('50000').catch(() => {});

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/ml/predict-channel') && !r.url().includes('batch') && !r.url().includes('feedback') && !r.url().includes('stats')) {
        try {
          const body = await r.json();
          apiCalls.push({ status: r.status(), success: body?.success, channel: body?.predictedChannel });
        } catch {}
      }
    });

    await page.locator('button').filter({ hasText: /Predecir Circuito/i }).first().click({ timeout: 3000 });
    await page.waitForResponse((r) => r.url().includes('/api/ml/predict-channel') && r.status() < 500, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2500);

    log('channel-call', apiCalls.length > 0 ? 'low' : 'medium',
      `POST /predict-channel: ${apiCalls.length} llamadas, status=${apiCalls[0]?.status}, channel=${apiCalls[0]?.channel}`);

    const channelCardVisible = await page.locator('text=/Circuito Predicho|Probabilidades/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('channel-result', channelCardVisible ? 'low' : 'medium', `Card circuito visible: ${channelCardVisible}`);

    await page.screenshot({ path: path.join(SCREENS, '05-channel.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 6. Tab Recommendations
  // -------------------------------------------------------------------------
  test('6. Tab Recommendations - generar recomendaciones', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(2500);

    await mlTab(page, /Recomendaciones|Recommendations/i).click({ timeout: 3000 });
    await page.waitForTimeout(1500);

    // Llenar TARIC + valor (los inputs visibles)
    const inputs = page.locator('input[type="text"], input[type="number"]');
    const count = await inputs.count();
    if (count > 0) {
      // Encontrar input TARIC (placeholder con codigo)
      for (let i = 0; i < count; i++) {
        const inp = inputs.nth(i);
        const placeholder = await inp.getAttribute('placeholder').catch(() => '');
        if (/\d{8,10}/.test(placeholder)) {
          await inp.fill('6109100010').catch(() => {});
          break;
        }
      }
    }

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().match(/\/api\/ml\/recommendations(\?|$)/) || (r.url().includes('/api/ml/recommendations') && r.request().method() === 'POST')) {
        try {
          const body = await r.json();
          apiCalls.push({ status: r.status(), success: body?.success });
        } catch {}
      }
    });

    const genBtn = page.locator('button').filter({ hasText: /Generar.*Recomendaciones|Get.*Recommendations/i }).first();
    if (await genBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await genBtn.click({ timeout: 3000 });
      await page.waitForResponse((r) => r.url().includes('/api/ml/recommendations') && r.status() < 500 && r.request().method() === 'POST', { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }
    log('recs-call', apiCalls.length > 0 ? 'low' : 'medium',
      `POST /recommendations: ${apiCalls.length} llamadas, status=${apiCalls[0]?.status}`);

    await page.screenshot({ path: path.join(SCREENS, '06-recommendations.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 7. Tab Auto-Response - lista plantillas
  // -------------------------------------------------------------------------
  test('7. Tab Auto-Response - listar plantillas', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(2500);

    const apiCalls = [];
    page.on('response', async (r) => {
      if (r.url().includes('/api/ml/auto-response/templates')) {
        try {
          const body = await r.json();
          apiCalls.push({ status: r.status(), success: body?.success, count: (body?.templates || []).length });
        } catch {}
      }
    });

    await mlTab(page, /Auto-Respuesta|Auto Response/i).click({ timeout: 3000 });
    await page.waitForTimeout(3000);

    log('templates-call', apiCalls.length > 0 ? 'low' : 'medium',
      `GET /auto-response/templates: ${apiCalls.length}, status=${apiCalls[0]?.status}, count=${apiCalls[0]?.count}`);

    await page.screenshot({ path: path.join(SCREENS, '07-autoresponse.png'), fullPage: true });
  });

  // -------------------------------------------------------------------------
  // 8. Refresh stats
  // -------------------------------------------------------------------------
  test('8. Boton Actualizar header recarga stats', async ({ page }) => {
    await gotoApp(page, '/ml-insights');
    await page.waitForTimeout(3000);

    const apiCalls = [];
    page.on('response', (r) => {
      if (r.url().includes('/api/ml/stats')) {
        apiCalls.push({ status: r.status() });
      }
    });

    await page.locator('button').filter({ hasText: /Actualizar|Refresh/i }).first().click({ timeout: 3000 });
    await page.waitForTimeout(2500);

    log('stats-refresh', apiCalls.length > 0 ? 'low' : 'medium',
      `GET /api/ml/stats: ${apiCalls.length}, status=${apiCalls[0]?.status}`);

    await page.screenshot({ path: path.join(SCREENS, '08-after-refresh.png'), fullPage: true });
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
