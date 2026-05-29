// @ts-check
/**
 * E2E /classification — minucioso. 4 tabs (basic IA, lookup código, tree, advanced).
 * Valida cada modo y cruza los resultados con la BD oficial TARIC EU.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'classification-test-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg, extra = {}) => findings.push({ cat, sev, msg, ...extra });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;

const REFERENCE = [
  {
    desc: 'Ordenadores portatiles DELL Latitude para uso comercial',
    material: 'plastico y aluminio', use: 'ofimatica empresarial',
    expectedChapter: '84',
  },
  {
    desc: 'Camisetas de algodon manga corta para hombre adulto',
    material: 'algodon 100%', use: 'vestir uso diario',
    expectedChapter: '61',
  },
];

const LOOKUPS = [
  { code: '8471300000', expChap: '84', expHead: '8471', expDuty: 0 },
  { code: '6109100090', expChap: '61', expHead: '6109', expDuty: 12 },
  { code: '9404211000', expChap: '94', expHead: '9404', expDuty: 3.7 },
];

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function clickTabByText(page, regex) {
  return page.evaluate((rg) => {
    const re = new RegExp(rg, 'i');
    const btn = Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  }, regex.source);
}

async function setTextarea(page, value) {
  await page.evaluate((v) => {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, v);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function setInputByPlaceholder(page, placeholderRegex, value) {
  return page.evaluate(({ rg, v }) => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const re = new RegExp(rg, 'i');
    const inp = inputs.find((i) => re.test(i.placeholder || ''));
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, { rg: placeholderRegex.source, v: value });
}

// Wait for IA classification result by polling DOM for any TARIC code (8-10 digits)
async function waitForCodes(page, maxMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const codes = await page.evaluate(() => {
      // Search ANY element with font-mono that contains a TARIC code
      const els = Array.from(document.querySelectorAll('[class*="font-mono"]'));
      return [...new Set(els.map((e) => e.textContent?.trim()).filter((c) => /^\d{8,10}$/.test(c || '')))];
    });
    if (codes.length > 0) return codes;
    await page.waitForTimeout(2000);
  }
  return [];
}

test.describe('Classification TARIC E2E minucioso', () => {
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

  // =========================================================================
  // FASE 1: Render
  // =========================================================================

  test('1. Render base + 4 tabs', async ({ page }) => {
    await gotoApp(page, '/classification');
    await page.screenshot({ path: path.join(SCREENS, '01-classification-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', h1 ? 'low' : 'high', `h1="${h1?.trim()}"`);

    const tabs = ['Basic', 'Buscar Codigo', 'Explorar Arbol', 'Avanzado'];
    let visible = 0;
    for (const t of tabs) {
      const found = await page.locator('button').filter({ hasText: new RegExp(t, 'i') }).count();
      if (found > 0) visible++;
    }
    log('tabs-count', visible >= 3 ? 'low' : 'medium', `Tabs visibles: ${visible}/4`);
  });

  // =========================================================================
  // FASE 2: LOOKUP — rápido, no IA
  // =========================================================================

  test('2.1 — Lookup 8471300000 (laptops, oficial 0%)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Buscar/);
    await page.waitForTimeout(800);

    const lk = LOOKUPS[0];
    await page.locator('input[maxlength="10"]').first().fill(lk.code);
    await page.locator('form button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '02-lookup-laptops.png'), fullPage: true });

    const codeShown = await page.locator('p.font-mono.text-2xl').first().textContent({ timeout: 5000 }).catch(() => null);
    log('lookup-laptops-code', codeShown?.trim() === lk.code ? 'low' : 'medium',
      `Código mostrado: "${codeShown?.trim()}" esperado "${lk.code}"`);

    const dutyShown = await page.locator(`text=/${lk.expDuty}\\s*%/`).first().isVisible({ timeout: 2000 }).catch(() => false);
    log('lookup-laptops-duty', 'low', `Arancel ${lk.expDuty}% visible: ${dutyShown}`);

    const portatiles = await page.locator('text=/portatiles|portátiles/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('lookup-laptops-desc', portatiles ? 'low' : 'medium',
      `Descripción contiene "portátiles" (CAU oficial): ${portatiles}`);
  });

  test('2.2 — Lookup 6109100090 (camisetas, 12% MFN)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Buscar/);
    await page.waitForTimeout(800);

    const lk = LOOKUPS[1];
    await page.locator('input[maxlength="10"]').first().fill(lk.code);
    await page.locator('form button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '03-lookup-camisetas.png'), fullPage: true });

    const code = await page.locator('p.font-mono.text-2xl').first().textContent({ timeout: 5000 }).catch(() => null);
    log('lookup-camisetas-code', code?.trim() === lk.code ? 'low' : 'medium',
      `Código: "${code?.trim()}" esperado "${lk.code}"`);

    const dutyText = await page.locator('text=/12\\s*%/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('lookup-camisetas-duty', dutyText ? 'low' : 'medium',
      `Arancel 12% (MFN textiles cap. 61 según TARIC EU): ${dutyText}`);
  });

  test('2.3 — Lookup 9404211000 (colchones, 3.7% MFN)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Buscar/);
    await page.waitForTimeout(800);

    const lk = LOOKUPS[2];
    await page.locator('input[maxlength="10"]').first().fill(lk.code);
    await page.locator('form button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '04-lookup-colchones.png'), fullPage: true });

    const code = await page.locator('p.font-mono.text-2xl').first().textContent({ timeout: 5000 }).catch(() => null);
    log('lookup-colchones-code', code?.trim() === lk.code ? 'low' : 'medium',
      `Código: "${code?.trim()}" esperado "${lk.code}"`);

    const dutyText = await page.locator('text=/3\\.7\\s*%|3,7\\s*%/').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('lookup-colchones-duty', 'low',
      `Arancel 3.7% (MFN cap. 94 según TARIC EU): ${dutyText}`);
  });

  test('2.4 — Lookup capítulo "84" (drill-down 2 dígitos)', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Buscar/);
    await page.waitForTimeout(800);

    await page.locator('input[maxlength="10"]').first().fill('84');
    await page.locator('form button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENS, '05-lookup-cap84-drilldown.png'), fullPage: true });

    const headingCount = await page.locator('span.font-mono.text-sm.font-bold').count();
    log('lookup-cap84-headings', headingCount >= 5 ? 'low' : 'medium',
      `Drill-down cap 84: ${headingCount} headings (CAU cap. 84 = "Reactores nucleares, calderas, máquinas")`);

    const cap84Title = await page.locator('text=/Reactores nucleares|maquinas|aparatos mecanicos|Calderas/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('lookup-cap84-title', cap84Title ? 'low' : 'medium', `Título oficial cap 84 visible: ${cap84Title}`);
  });

  test('2.5 — Lookup código inválido', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Buscar/);
    await page.waitForTimeout(800);

    await page.locator('input[maxlength="10"]').first().fill('9999999999');
    await page.locator('form button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '06-lookup-invalid.png'), fullPage: true });

    const found = await page.locator('p.font-mono.text-2xl').filter({ hasText: '9999999999' }).first().isVisible({ timeout: 2000 }).catch(() => false);
    const errToast = await page.locator('text=/no encontrado|not found|no existe/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('lookup-invalid-handle', !found || errToast ? 'low' : 'medium',
      `Código inválido: encontrado=${found} errMsg=${errToast}`);
  });

  // =========================================================================
  // FASE 3: ÁRBOL
  // =========================================================================

  test('3. Tab Árbol arancelario', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Arbol/);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '07-tree-default.png'), fullPage: true });

    const chapters = await page.locator('button, div').filter({ hasText: /^\d{2}\b/ }).count();
    log('tree-chapters', chapters >= 5 ? 'low' : 'medium',
      `Capítulos visibles en árbol: ${chapters}`);

    const cap84 = page.locator('button, div').filter({ hasText: /^84\b/ }).first();
    if (await cap84.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cap84.click({ force: true });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SCREENS, '08-tree-cap84-drilldown.png'), fullPage: true });
      log('tree-drilldown', 'low', 'Drill-down cap 84 OK');
    } else {
      log('tree-cap84', 'medium', 'No se encuentra cap 84 clickeable en árbol');
    }
  });

  // =========================================================================
  // FASE 4: IA BASIC
  // =========================================================================

  test('4.1 — IA Basic: laptops (cap. 84 esperado)', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Basic/);
    await page.waitForTimeout(800);

    const ref = REFERENCE[0];
    await setTextarea(page, ref.desc);
    await setInputByPlaceholder(page, /aluminio|metal|madera|tela/i, ref.material);
    await setInputByPlaceholder(page, /oficina|cocina|construccion/i, ref.use);
    await page.screenshot({ path: path.join(SCREENS, '09-basic-form-laptops.png'), fullPage: true });

    await page.locator('button[type="submit"]').first().click({ force: true });

    // Esperar dinámicamente por sugerencias TARIC
    const codes = await waitForCodes(page, 100_000);
    await page.screenshot({ path: path.join(SCREENS, '10-basic-result-laptops.png'), fullPage: true });

    log('basic-laptops-codes', codes.length > 0 ? 'low' : 'high',
      `IA sugirió ${codes.length} códigos: [${codes.slice(0, 5).join(', ')}]`);

    if (codes.length > 0) {
      const top = codes[0];
      const correct = top.startsWith(ref.expectedChapter);
      log('basic-laptops-chapter', correct ? 'low' : 'medium',
        `Top "${top}" inicia con cap ${ref.expectedChapter}: ${correct}`);
    }
  });

  test('4.2 — IA Basic: camisetas algodón (cap. 61 esperado)', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page, '/classification');
    await clickTabByText(page, /Basic/);
    await page.waitForTimeout(800);

    const ref = REFERENCE[1];
    await setTextarea(page, ref.desc);
    await setInputByPlaceholder(page, /aluminio|metal|madera|tela/i, ref.material);
    await page.locator('button[type="submit"]').first().click({ force: true });

    const codes = await waitForCodes(page, 100_000);
    await page.screenshot({ path: path.join(SCREENS, '11-basic-result-camisetas.png'), fullPage: true });

    log('basic-camisetas-codes', codes.length > 0 ? 'low' : 'high',
      `Sugerencias: [${codes.slice(0, 5).join(', ')}]`);

    if (codes.length > 0) {
      const top = codes[0];
      const correct = top.startsWith(ref.expectedChapter);
      log('basic-camisetas-chapter', correct ? 'low' : 'medium',
        `Top "${top}" inicia con cap ${ref.expectedChapter} (textiles): ${correct}`);
    }
  });

  // =========================================================================
  // FASE 5: ADVANCED — full analysis
  // =========================================================================

  test('5. Tab Avanzado: full-analysis IA', async ({ page }) => {
    test.setTimeout(240_000);
    await gotoApp(page, '/classification');
    // Click via evaluate sobre el tab "Avanzado" — tabs viven en un div con clase bg-gray-100 rounded-lg
    const clicked = await page.evaluate(() => {
      // Find the tab container (specific to ClassificationTool header)
      const containers = document.querySelectorAll('div[class*="bg-gray-100"][class*="rounded-lg"]');
      for (const c of containers) {
        const buttons = c.querySelectorAll('button');
        for (const b of buttons) {
          if (/Avanzado/i.test(b.textContent || '')) {
            b.click();
            return b.textContent?.trim();
          }
        }
      }
      // Fallback: search any button and pick the one whose text starts with Avanzado
      const all = Array.from(document.querySelectorAll('button'));
      const adv = all.find((b) => /Avanzado/i.test(b.textContent || '') && b.textContent.length < 25);
      if (adv) { adv.click(); return 'fallback:' + adv.textContent?.trim(); }
      return null;
    });
    log('advanced-tab-click', clicked ? 'low' : 'high', `Click tab: "${clicked}"`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '12a-advanced-tab-active.png'), fullPage: true });

    // Verify activeTab really changed
    const tabActive = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const activeBtn = btns.find((b) => /Avanzado/i.test(b.textContent || '') && (b.className.includes('shadow') || b.className.includes('bg-white')));
      return activeBtn ? activeBtn.textContent?.trim() : null;
    });
    log('advanced-tab-active', tabActive ? 'low' : 'medium', `Tab activo: "${tabActive}"`);

    await setTextarea(page, REFERENCE[0].desc);
    await setInputByPlaceholder(page, /aluminio|metal|madera|tela/i, REFERENCE[0].material);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '12-advanced-form.png'), fullPage: true });

    // Wait specifically for the SECOND button (Full Analysis IA)
    const formBtnCount = await page.locator('form button').count();
    log('advanced-buttons', 'low', `Botones en form: ${formBtnCount} (esperado 2: Clasificar + Análisis Completo IA)`);

    const fullBtn = page.locator('form button').nth(1);
    if (!await fullBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('advanced-btn', 'medium', `Segundo botón (Full Analysis) NO visible — total form buttons=${formBtnCount}`);
      return;
    }
    const fullBtnText = await fullBtn.textContent();
    log('advanced-btn-text', 'low', `Segundo botón texto: "${fullBtnText?.trim()}"`);
    await fullBtn.click({ force: true });

    // Wait dynamically — full analysis can take 60-120s
    let resultFound = false;
    const start = Date.now();
    while (Date.now() - start < 200_000) {
      const has = await page.locator('text=/recomendado|recommendation|recommendedCode|finalAssessment/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      if (has) { resultFound = true; break; }
      const codes = await page.evaluate(() => Array.from(document.querySelectorAll('span.font-mono, p.font-mono'))
        .map((e) => e.textContent?.trim()).filter((c) => /^\d{8,10}$/.test(c || '')));
      if (codes.length > 0) { resultFound = true; break; }
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: path.join(SCREENS, '13-advanced-result.png'), fullPage: true });

    log('advanced-result', resultFound ? 'low' : 'medium', `Full-analysis result visible: ${resultFound}`);

    const codes = await page.evaluate(() => Array.from(document.querySelectorAll('span.font-mono, p.font-mono'))
      .map((e) => e.textContent?.trim()).filter((c) => /^\d{8,10}$/.test(c || '')));
    log('advanced-codes', codes.length > 0 ? 'low' : 'medium',
      `Códigos en análisis avanzado: [${codes.slice(0, 5).join(', ')}]`);
  });

  // =========================================================================
  // FASE 6: VALIDACIÓN BACKEND vs CAU/TARIC oficial
  // =========================================================================

  test('6.1 — BD: códigos lookup existen y datos coinciden con TARIC EU', async ({ request }) => {
    let consistent = 0;
    for (const lk of LOOKUPS) {
      const r = await request.get(`/api/classification/taric/${lk.code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await r.json();
      const data = body?.data;
      if (!data?.found) {
        log(`bd-${lk.code}-missing`, 'high', `Código ${lk.code} NO encontrado en BD`);
        continue;
      }
      const desc = data.description_es || data.description || '';
      const apiDuty = data.duties?.thirdCountry;
      log(`bd-${lk.code}`, 'low',
        `${lk.code}: chap=${data.chapter} duty=${apiDuty}% desc="${desc.slice(0, 60)}"`);

      if (data.chapter === lk.expChap) consistent++;
      else log(`bd-${lk.code}-chapter`, 'medium',
        `chapter mismatch: API=${data.chapter} expected=${lk.expChap}`);
    }
    log('bd-consistency', consistent === LOOKUPS.length ? 'low' : 'medium',
      `Consistencia capítulos: ${consistent}/${LOOKUPS.length}`);
  });

  test('6.2 — BD: total códigos TARIC y capítulos', async ({ request }) => {
    const r = await request.get('/api/classification/cache-stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await r.json();
    const total = body?.data?.taricCodesTotal;
    const chapters = body?.data?.taricChapters;
    log('bd-total', total >= 20000 ? 'low' : 'medium',
      `BD: ${total} códigos TARIC (memoria 21,946), ${chapters} capítulos (CAU oficial: 97)`);
  });

  test('6.3 — Capítulos endpoint /chapters', async ({ request }) => {
    const r = await request.get('/api/classification/chapters', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await r.json();
    const arr = Array.isArray(body?.data) ? body.data : (body?.chapters || body?.data?.chapters || []);
    log('bd-chapters', arr.length >= 90 ? 'low' : 'medium',
      `Endpoint /chapters: ${arr.length} capítulos`);
  });

  // =========================================================================
  // FASE 7: Asistente
  // =========================================================================

  test('7. Asistente desde /classification', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/classification');
    const link = page.locator('a[href="/assistant"]').first();
    if (!await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('assistant-cta', 'medium', 'CTA asistente no visible');
      return;
    }
    await link.click({ force: true });
    await page.waitForURL(/\/assistant/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '14-assistant.png'), fullPage: true });
    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    const inputs = await page.locator('textarea, input[type="text"]').count();
    log('assistant-renders', !errorBoundary && inputs > 0 ? 'low' : 'high',
      `Asistente OK: errorBoundary=${errorBoundary} inputs=${inputs}`);
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      reference: REFERENCE,
      lookups: LOOKUPS,
      findings
    }, null, 2));
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`[${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
