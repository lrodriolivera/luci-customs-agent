// @ts-check
/**
 * E2E /ens — Declaraciones ENS / ICS2 (Entry Summary Declaration).
 *
 * Cobertura:
 * 1) Render lista + stats + filtros + busqueda
 * 2) Boton "Nueva ENS" abre Dialog con stepper de 5 pasos
 * 3) Stepper UI completo para modo ROAD (5 pasos: transport → carrier → consignment → goods → review)
 *    Incluye Validar + Guardar y Enviar -> AEAT PRE
 * 4) RAIL, AIR, SEA via API (mismo flujo) -> AEAT PRE
 * 5) Boton "Importar Lote" + Dialog + descarga template
 * 6) Detail page /ens/:id
 * 7) Filtros en lista (status, modo, busqueda)
 *
 * Aduana de entrada PRE: ES009999 (todas modos) - sumaria/declarante PRE STRIX
 * EORI declarante: ESB22477020 (STRIX AI, aceptado PRE)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'ens-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;

const TS = Date.now();

// ENSs creadas durante la suite (una por modo de transporte)
/** @type {Record<string, { id?: string, reference?: string, lrn?: string, mrn?: string, status?: string, channel?: string, simulated?: boolean, error?: string }>} */
const created = {
  ROAD: {},
  RAIL: {},
  AIR: {},
  SEA: {}
};

// Datos comunes a todos los modos (variando solo lo especifico)
function buildPayload(mode) {
  const arrivalISO = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16); // +48h en formato datetime-local
  const refSuffix = `${mode}-${TS}`;
  const transportIdByMode = {
    ROAD: `1234ABC-${TS}`.slice(0, 17),
    RAIL: `TR-${TS}`.slice(0, 17),
    AIR: `IB${String(TS).slice(-4)}`,
    SEA: `IMO${String(TS).slice(-7)}`
  };

  return {
    transportMode: mode,
    entryOffice: {
      code: 'ES009999',
      name: 'PRE Pruebas Peninsula',
      expectedArrival: arrivalISO
    },
    carrier: {
      eori: 'ESB22477020',
      name: 'STRIX AI SL',
      address: { street: 'Aragon 100', city: 'Zaragoza', postcode: '50001', country: 'ES' }
    },
    transportMeans: {
      identification: transportIdByMode[mode],
      nationality: 'ES'
    },
    consignment: {
      referenceNumber: `BL-${refSuffix}`,
      containerNumber: mode === 'SEA' ? 'MSKU1234567' : '',
      sealNumber: mode === 'SEA' ? 'SEAL001' : '',
      grossMass: 1500.5,
      numberOfPackages: 100,
      goodsDescription: `Mercancias varias modo ${mode}`
    },
    consignor: {
      eori: 'CN1234567890',
      name: 'Shenzhen Tech Trading Co Ltd',
      address: { street: 'Bao An 123', city: 'Shenzhen', postcode: '518000', country: 'CN' }
    },
    consignee: {
      eori: 'ESB22477020',
      name: 'STRIX AI SL',
      address: { street: 'Aragon 100', city: 'Zaragoza', postcode: '50001', country: 'ES' }
    },
    isGroupage: false,
    houseConsignments: [],
    goods: [
      {
        itemNumber: 1,
        sequenceNumber: 1,
        description: 'Funda silicona movil iPhone 15',
        commodityCode: '3926909790',
        taricCode: '3926909790',
        countryOfOrigin: 'CN',
        grossMass: 1000.5,
        netMass: 950.0,
        numberOfPackages: 80,
        packageType: 'BX'
      },
      {
        itemNumber: 2,
        sequenceNumber: 2,
        description: 'Cables USB-C',
        commodityCode: '8544429010',
        taricCode: '8544429010',
        countryOfOrigin: 'CN',
        grossMass: 500.0,
        netMass: 450.0,
        numberOfPackages: 20,
        packageType: 'BX'
      }
    ]
  };
}

async function gotoApp(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const cookieAccept = page.locator('button:has-text("Accept"), button:has-text("Aceptar")').first();
  if (await cookieAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieAccept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

// React-friendly setter por selector (input/textarea/select)
async function setInput(page, selector, value) {
  return page.evaluate(({ s, v }) => {
    const el = /** @type {HTMLInputElement|null} */ (document.querySelector(s));
    if (!el) return { ok: false, reason: 'not found' };
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter && setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return { ok: true };
  }, { s: selector, v: value });
}

// Mass-fill: buscar input/textarea cuyo label contiene texto y poner valor (DOM).
// Mas rapido que .fill() de Playwright que tiene timeout de 15s por elem.
async function fillMatching(page, pairs) {
  return page.evaluate((entries) => {
    const setVal = (el, v) => {
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                  : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                  : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter && setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    };
    // Buscar dentro del Dialog actualmente abierto (visible) para no chocar con steps anteriores
    const dialog = document.querySelector('.MuiDialog-container [role="dialog"]') || document.body;
    const labels = Array.from(dialog.querySelectorAll('label'));
    const used = new Set();
    let count = 0;
    for (const [pattern, value] of entries) {
      const re = new RegExp(pattern, 'i');
      const lbl = labels.find(l => !used.has(l) && re.test(l.textContent || ''));
      if (!lbl) continue;
      used.add(lbl);
      const wrapper = lbl.closest('.MuiFormControl-root');
      const input = wrapper?.querySelector('input, textarea');
      if (input && setVal(input, value)) count++;
    }
    return count;
  }, pairs);
}

async function submitDeclarationViaAPI(request, payload) {
  const create = await request.post('/api/ens', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: payload,
    timeout: 30_000
  });
  const body = await create.json().catch(() => ({}));
  if (create.status() >= 400) {
    return { ok: false, stage: 'create', status: create.status(), body };
  }
  const id = body?.data?._id;
  const reference = body?.data?.reference;
  const lrn = body?.data?.lrn;

  // Submit a AEAT
  const submit = await request.post(`/api/ens/${id}/submit`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {},
    timeout: 60_000
  });
  const submitBody = await submit.json().catch(() => ({}));

  // Re-leer el detail
  const detail = await request.get(`/api/ens/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const detailBody = await detail.json().catch(() => ({}));

  return {
    ok: submit.status() < 400,
    stage: 'submit',
    status: submit.status(),
    id, reference, lrn,
    mrn: submitBody?.data?.mrn || detailBody?.data?.mrn,
    declarationStatus: submitBody?.data?.status || detailBody?.data?.status,
    riskStatus: submitBody?.data?.riskAssessment?.status || detailBody?.data?.riskAssessment?.status,
    aeatResponse: detailBody?.data?.aeatResponse,
    submitBody
  };
}

test.describe('ENS / ICS2 - flujo completo + AEAT PRE', () => {
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
  // 1. Render base /ens
  // -------------------------------------------------------------------------
  test('1. Render base /ens (lista + stats + filtros)', async ({ page }) => {
    await gotoApp(page, '/ens');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '01-list-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /ENS|Sumaria|Entry/i.test(h1 || '') ? 'low' : 'high', `h1 ENS: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Botones esperados: "Nueva" y "Importar Lote"
    const newBtn = await page.locator('button:has-text("Nueva")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('new-btn', newBtn ? 'low' : 'medium', `Boton "Nueva ENS" visible: ${newBtn}`);

    const batchBtn = await page.locator('button:has-text("Importar")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('batch-btn', batchBtn ? 'low' : 'medium', `Boton "Importar Lote" visible: ${batchBtn}`);

    // Stats cards (4 cards)
    const cardCount = await page.locator('.MuiCard-root').count();
    log('stats-cards', cardCount >= 4 ? 'low' : 'medium', `Cards de stats visibles: ${cardCount}`);

    // Filtros: search + status + modo + 2 fechas
    const filterInputs = await page.locator('.MuiFormControl-root input, .MuiFormControl-root select').count();
    log('filters', filterInputs >= 5 ? 'low' : 'medium', `Inputs de filtros: ${filterInputs}`);

    // Tabla con headers esperados
    const tableHeaders = await page.locator('thead th').count();
    log('table-headers', tableHeaders >= 8 ? 'low' : 'medium', `Headers de tabla ENS: ${tableHeaders}`);
  });

  // -------------------------------------------------------------------------
  // 2. Boton "Nueva ENS" abre Dialog stepper
  // -------------------------------------------------------------------------
  test('2. Boton Nueva ENS abre Dialog con stepper 5 pasos', async ({ page }) => {
    await gotoApp(page, '/ens');
    await page.waitForTimeout(1500);

    const newBtn = page.locator('button:has-text("Nueva")').first();
    await newBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENS, '02-dialog-new-step1.png'), fullPage: true });

    // Stepper visible con 5 steps
    const steps = await page.locator('.MuiStepLabel-label').count();
    log('stepper-steps', steps === 5 ? 'low' : 'medium', `Stepper steps: ${steps} (esperado 5)`);

    // Cards de modo de transporte (4: ROAD, RAIL, AIR, SEA)
    const transportCards = await page.locator('.MuiCard-root').count();
    log('transport-cards', transportCards >= 4 ? 'low' : 'medium', `Cards modos transporte: ${transportCards}`);

    // Iconos: Carretera, Ferrocarril, Aereo, Maritimo
    const iconLabels = ['carretera', 'ferrocarril', 'aereo', 'maritim'];
    for (const lbl of iconLabels) {
      const visible = await page.locator(`text=/${lbl}/i`).first().isVisible({ timeout: 2000 }).catch(() => false);
      log(`mode-${lbl}`, visible ? 'low' : 'medium', `Modo ${lbl} visible: ${visible}`);
    }

    // Cerrar dialog
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 3. ROAD via UI completo (stepper 5 pasos -> save & submit)
  // -------------------------------------------------------------------------
  test('3. ROAD: stepper UI completo -> save & submit AEAT', async ({ page }) => {
    test.setTimeout(180_000);
    const payload = buildPayload('ROAD');

    await gotoApp(page, '/ens');
    await page.waitForTimeout(1500);

    // Abrir Dialog
    await page.locator('button:has-text("Nueva")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENS, '03a-road-step0-transport.png'), fullPage: true });

    // -- Step 0: Transport mode (ROAD ya seleccionado por defecto) + entry office + arrival
    // Click card ROAD por seguridad
    await page.locator('.MuiCard-root:has-text("Carretera"), .MuiCard-root:has-text("ROAD")').first()
      .click({ timeout: 3000 }).catch(() => {});

    // Autocomplete entry office: abrir y elegir ES009999
    const entryAuto = page.locator('label:has-text("Aduana"), label:has-text("entrada")').first();
    const entryWrapper = entryAuto.locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]');
    const entryInput = entryWrapper.locator('input').first();
    await entryInput.click({ timeout: 3000 }).catch(() => {});
    await entryInput.fill('ES009999').catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('li[role="option"]').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);

    // Datetime arrival
    const arrivalLocal = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16);
    await setInput(page, 'input[type="datetime-local"]', arrivalLocal);
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(SCREENS, '03b-road-step0-filled.png'), fullPage: true });

    // Siguiente -> Step 1
    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '03c-road-step1-carrier.png'), fullPage: true });

    // -- Step 1: Carrier
    const filled1 = await fillMatching(page, [
      ['EORI', payload.carrier.eori],
      ['mpresa|ombre', payload.carrier.name],
      ['alle', payload.carrier.address.street],
      ['iudad', payload.carrier.address.city],
      ['ostal|odigo postal', payload.carrier.address.postcode],
      ['^pa.s$|country', payload.carrier.address.country],
      ['dentificaci', payload.transportMeans.identification],
      ['acionalidad', payload.transportMeans.nationality],
    ]);
    log('road-step1-filled', filled1 >= 4 ? 'low' : 'medium', `Step 1 carrier inputs llenos: ${filled1}/8`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENS, '03d-road-step1-filled.png'), fullPage: true });

    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);

    // -- Step 2: Consignment
    const filled2 = await fillMatching(page, [
      ['BL|referencia', payload.consignment.referenceNumber],
      ['eso bruto|gross', String(payload.consignment.grossMass)],
      ['umero de bultos|packages', String(payload.consignment.numberOfPackages)],
      ['escripci', payload.consignment.goodsDescription],
      ['EORI Expedidor', payload.consignor.eori],
      ['ombre Expedidor', payload.consignor.name],
      ['EORI Destinatario', payload.consignee.eori],
      ['ombre Destinatario', payload.consignee.name],
    ]);
    log('road-step2-filled', filled2 >= 4 ? 'low' : 'medium', `Step 2 consignment inputs llenos: ${filled2}/8`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENS, '03e-road-step2-consignment.png'), fullPage: true });

    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);

    // -- Step 3: Goods (1 item ya por defecto)
    const item = payload.goods[0];
    const filled3 = await fillMatching(page, [
      ['escripci', item.description],
      ['TARIC', item.commodityCode],
      ['origen', item.countryOfOrigin],
      ['eso bruto|gross', String(item.grossMass)],
      ['eso neto|net', String(item.netMass)],
      ['ultos', String(item.numberOfPackages)],
    ]);
    log('road-step3-filled', filled3 >= 3 ? 'low' : 'medium', `Step 3 goods inputs llenos: ${filled3}/6`);

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENS, '03f-road-step3-goods.png'), fullPage: true });

    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENS, '03g-road-step4-review.png'), fullPage: true });

    // -- Step 4: Review + Validar + Save&Send
    const validateBtn = page.locator('button:has-text("Validar")').first();
    if (await validateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await validateBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENS, '03h-road-step4-validated.png'), fullPage: true });
    }

    // Capturar respuesta de POST /api/ens
    const apiResp = [];
    page.on('response', async (res) => {
      const u = res.url();
      if (u.endsWith('/api/ens') && res.request().method() === 'POST') {
        try { apiResp.push({ status: res.status(), body: await res.json() }); } catch {}
      }
      if (/\/api\/ens\/[a-f0-9]+\/submit$/.test(u) && res.request().method() === 'POST') {
        try { apiResp.push({ status: res.status(), body: await res.json(), submit: true }); } catch {}
      }
    });

    const saveSendBtn = page.locator('button:has-text("Enviar")').first();
    await saveSendBtn.click({ timeout: 5000 }).catch(() => {});
    log('road-save-send-clicked', 'low', 'Click "Guardar y Enviar" UI');

    // El submit a AEAT real puede tardar 15-30s
    await page.waitForTimeout(35_000);
    await page.screenshot({ path: path.join(SCREENS, '03i-road-post-submit.png'), fullPage: true });

    // Guardar resultados ROAD
    const createResp = apiResp.find(r => !r.submit);
    const submitResp = apiResp.find(r => r.submit);
    if (createResp?.body?.data) {
      created.ROAD.id = createResp.body.data._id;
      created.ROAD.reference = createResp.body.data.reference;
      created.ROAD.lrn = createResp.body.data.lrn;
    }
    if (submitResp?.body?.data) {
      created.ROAD.mrn = submitResp.body.data.mrn;
      created.ROAD.status = submitResp.body.data.status;
      created.ROAD.simulated = submitResp.body.data?.aeatResponse?.simulated;
    }

    // Fallback: si UI no creo la declaracion, usar API para tener ROAD listo
    if (!created.ROAD.id) {
      log('road-ui-fallback', 'medium', 'UI no creo ROAD, fallback a API');
      // @ts-ignore
      const ctx = page.context();
      // Usamos request del context para enviar con auth
      const r = await ctx.request.post('/api/ens', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: payload, timeout: 30_000
      });
      const cb = await r.json().catch(() => ({}));
      if (cb?.data?._id) {
        created.ROAD.id = cb.data._id;
        created.ROAD.reference = cb.data.reference;
        created.ROAD.lrn = cb.data.lrn;
        const sb = await ctx.request.post(`/api/ens/${created.ROAD.id}/submit`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: {}, timeout: 60_000
        });
        const sbody = await sb.json().catch(() => ({}));
        created.ROAD.mrn = sbody?.data?.mrn;
        created.ROAD.status = sbody?.data?.status;
      }
    }

    log('road-result', created.ROAD.id ? 'low' : 'high',
      `ROAD id=${created.ROAD.id} ref=${created.ROAD.reference} mrn=${created.ROAD.mrn} status=${created.ROAD.status}`);
  });

  // -------------------------------------------------------------------------
  // 4-6. RAIL, AIR, SEA via API (mismo flujo, sin UI larga)
  // -------------------------------------------------------------------------
  for (const mode of ['RAIL', 'AIR', 'SEA']) {
    test(`${mode === 'RAIL' ? '4' : mode === 'AIR' ? '5' : '6'}. ${mode}: API create + submit AEAT PRE`, async ({ request }) => {
      test.setTimeout(120_000);
      const payload = buildPayload(mode);
      const result = await submitDeclarationViaAPI(request, payload);

      created[mode].id = result.id;
      created[mode].reference = result.reference;
      created[mode].lrn = result.lrn;
      created[mode].mrn = result.mrn;
      created[mode].status = result.declarationStatus;
      created[mode].simulated = result.aeatResponse?.simulated;

      log(`${mode.toLowerCase()}-create-submit`, result.ok ? 'low' : 'high',
        `${mode} id=${result.id} ref=${result.reference} mrn=${result.mrn} status=${result.declarationStatus} httpSubmit=${result.status}`);
    });
  }

  // -------------------------------------------------------------------------
  // 7. Lista refrescada con las 4 ENS recien creadas + filtro por modo
  // -------------------------------------------------------------------------
  test('7. Lista actualizada con las 4 ENS por modo + filtro', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/ens');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '07a-list-after-creates.png'), fullPage: true });

    // Buscar la referencia de cada modo en la tabla
    for (const mode of ['ROAD', 'RAIL', 'AIR', 'SEA']) {
      const ref = created[mode].reference;
      if (!ref) {
        log(`list-${mode.toLowerCase()}`, 'medium', `Referencia ${mode} no disponible (creacion fallida)`);
        continue;
      }
      // No tenemos buscador rapido por reference visible? El componente tiene search input
      const visible = await page.locator(`text=${ref}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`list-${mode.toLowerCase()}`, visible ? 'low' : 'medium', `${mode} ${ref} visible en lista: ${visible}`);
    }

    // Filtro por modo SEA
    const modeFilter = page.locator('label:has-text("modo"), label:has-text("ransporte")').first();
    const wrapper = modeFilter.locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]');
    const select = wrapper.locator('div[role="combobox"], input').first();
    await select.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    const seaOption = page.locator('li[role="option"]:has-text("Mar"), li[role="option"]:has-text("SEA")').first();
    if (await seaOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await seaOption.click().catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '07b-filter-sea.png'), fullPage: true });
      log('filter-sea', 'low', 'Filtro modo SEA aplicado');
    }
  });

  // -------------------------------------------------------------------------
  // 8. Detail page /ens/:id de la ENS submitted (preferentemente la SEA o cualquiera con MRN)
  // -------------------------------------------------------------------------
  test('8. Detail page /ens/:id', async ({ page }) => {
    test.setTimeout(60_000);
    const target = ['ROAD', 'RAIL', 'AIR', 'SEA']
      .map(m => ({ mode: m, ...created[m] }))
      .find(c => c.mrn) || ['ROAD', 'RAIL', 'AIR', 'SEA'].map(m => ({ mode: m, ...created[m] })).find(c => c.id);

    if (!target?.id) {
      log('detail', 'medium', 'No hay ENS creada para abrir detail');
      return;
    }

    await gotoApp(page, `/ens/${target.id}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '08a-detail-page.png'), fullPage: true });

    const h1 = await page.locator('h1, h2, h4').first().textContent({ timeout: 5000 }).catch(() => null);
    log('detail-h1', h1 ? 'low' : 'medium', `Detail title: "${h1?.trim()?.slice(0, 80)}"`);

    if (target.mrn) {
      const mrnVisible = await page.locator(`text=${target.mrn}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('detail-mrn-visible', mrnVisible ? 'low' : 'medium', `MRN ${target.mrn} visible en detail UI: ${mrnVisible}`);
    }

    if (target.reference) {
      const refVisible = await page.locator(`text=${target.reference}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log('detail-ref-visible', refVisible ? 'low' : 'medium', `Ref ${target.reference} visible: ${refVisible}`);
    }

    log('detail-target', 'low', `Target detail: mode=${target.mode} mrn=${target.mrn} status=${target.status}`);
  });

  // -------------------------------------------------------------------------
  // 9. Boton "Importar Lote" abre Dialog batch upload
  // -------------------------------------------------------------------------
  test('9. Importar Lote: dialog + descarga template + parse CSV', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/ens');
    await page.waitForTimeout(1500);

    const batchBtn = page.locator('button:has-text("Importar")').first();
    await batchBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENS, '09a-batch-dialog.png'), fullPage: true });

    // Stepper de 3 pasos visible
    const steps = await page.locator('.MuiStepLabel-label').count();
    log('batch-stepper', steps === 3 ? 'low' : 'medium', `Batch stepper steps: ${steps} (esperado 3: Subir, Validar, Procesar)`);

    // Boton descargar template
    const tplBtn = page.locator('button:has-text("template"), button:has-text("plantilla")').first();
    const tplVisible = await tplBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log('batch-template-btn', tplVisible ? 'low' : 'medium', `Boton descarga template visible: ${tplVisible}`);

    // Drop zone visible
    const dropZone = await page.locator('text=/arrastra|drag|click/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('batch-dropzone', dropZone ? 'low' : 'medium', `Drop zone visible: ${dropZone}`);

    // Subir CSV de prueba (2 ENS) - usamos el file input oculto
    const csvContent = [
      'transportMode;entryOfficeCode;expectedArrivalDate;expectedArrivalTime;carrierEORI;carrierName;transportIdentification;transportNationality;billOfLading;containerNumber;sealNumber;grossMass;numberOfPackages;goodsDescription;consignorEORI;consignorName;consigneeEORI;consigneeName',
      `ROAD;ES009999;${new Date(Date.now() + 96*3600*1000).toISOString().slice(0,10)};10:00;ESB22477020;STRIX AI SL;BATCH${TS}A;ES;BL-BATCH-${TS}-A;;;800;50;Mercancia batch A;CN1234567890;Sender CN;ESB22477020;STRIX AI SL`,
      `RAIL;ES009999;${new Date(Date.now() + 96*3600*1000).toISOString().slice(0,10)};12:00;ESB22477020;STRIX AI SL;BATCH${TS}B;ES;BL-BATCH-${TS}-B;;;1200;75;Mercancia batch B;CN1234567890;Sender CN;ESB22477020;STRIX AI SL`,
    ].join('\n');

    const csvFile = path.join(SCREENS, 'batch-test.csv');
    fs.writeFileSync(csvFile, csvContent);

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(csvFile).catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENS, '09b-batch-parsed.png'), fullPage: true });

      // Tabla con 2 filas validadas
      const rows = await page.locator('table tbody tr').count();
      log('batch-parsed-rows', rows >= 2 ? 'low' : 'medium', `Filas parseadas en preview: ${rows}`);
    }

    // Cerrar dialog (no procesamos para no inundar AEAT con duplicados de batch)
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  });

  // -------------------------------------------------------------------------
  // 10. Filtros + busqueda en lista
  // -------------------------------------------------------------------------
  test('10. Filtros + busqueda en lista', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/ens');
    await page.waitForTimeout(2000);

    // Buscar por reference de la ROAD si existe
    const target = created.ROAD.reference || created.RAIL.reference || created.AIR.reference || created.SEA.reference;
    if (target) {
      const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="ref"], input[placeholder*="MRN"]').first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill(target);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENS, '10a-search-by-ref.png'), fullPage: true });
        const rows = await page.locator('table tbody tr').count();
        log('search-result', rows >= 1 ? 'low' : 'medium', `Busqueda "${target}": ${rows} fila(s)`);
      }
    }

    // Reset filtros: recargar pagina
    await gotoApp(page, '/ens');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENS, '10b-list-final.png'), fullPage: true });
  });

  test.afterAll(async ({ browser }) => {
    // Resumen final
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      created,
      mrnSummary: Object.fromEntries(
        Object.entries(created).map(([m, c]) => [m, { mrn: c.mrn, status: c.status, simulated: c.simulated }])
      ),
      findings
    }, null, 2));

    console.log('\n=== ENS E2E SUMMARY ===');
    for (const m of ['ROAD', 'RAIL', 'AIR', 'SEA']) {
      const c = created[m];
      console.log(`  ${m}: ref=${c.reference || '-'}  mrn=${c.mrn || '-'}  status=${c.status || '-'}  simulated=${c.simulated ?? '-'}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
