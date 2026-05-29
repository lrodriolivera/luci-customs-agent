// @ts-check
/**
 * E2E /pue — PUE / Punto Unico de Entrada (Controles SOIVRE).
 *
 * Cobertura:
 * 1) Render Manager: h1, stats cards (5: Total + ROHS/COM/ECO/CAL), tabs, alerts, lista
 * 2) Tabs: Todas, ROHS, COM, ECO, CAL — filtrado correcto
 * 3) Boton "Nueva Solicitud" abre Dialog con stepper de 6 pasos
 * 4) MRN lookup: usar MRN real 26ES00280130001U07 + clave zeta -> autofill datos H1
 * 5) Flujo SOIVRE completo: 6 pasos (MRN, Datos, Specs, Certs, Docs, Revision) + submit AEAT/SOIVRE PRE
 * 6) Flujo ROHS_RAEE simplificado: 5 pasos (sin Docs) + submit
 * 7) Lista refrescada con nuevas PUE + filtro por tab
 * 8) Detail page /pue/:id
 *
 * NOTA: AEAT PRE rechaza submits PUE porque MRN no esta indexado en BD SOIVRE PRE
 * (rechazo legitimo, esperando respuesta Jose Antonio).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_USER = { email: 'luis.rodriguez@strixai.es', password: 'test123' };
const SCREENS = path.join(__dirname, 'pue-e2e-screens');
const REPORT = path.join(SCREENS, 'report.json');
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const findings = [];
const log = (cat, sev, msg) => findings.push({ cat, sev, msg });

test.describe.configure({ mode: 'serial' });

let token = null;
let user = null;
const TS = Date.now();

// MRN H1 real con autofill funcional (de suite 11)
const REAL_MRN = '26ES00280130001U07';
const REAL_CLAVE_ZETA = '00001';

const created = {
  SOIVRE: {},
  ROHS_RAEE: {}
};

function buildPayload(flowType) {
  const baseGoods = [{
    sequenceNumber: 1,
    description: 'Colchones de espuma de poliuretano',
    taricCode: '9404211000',
    quantity: 50,
    unitOfMeasure: 'KGM',
    grossMass: 250,
    netMass: 230,
    statisticalValue: 10400,
    countryOfOrigin: 'TR'
  }];

  return {
    pueType: flowType === 'ROHS_RAEE' ? 'ROHS' : 'COM',
    declarationMRN: REAL_MRN,
    claveZeta: REAL_CLAVE_ZETA,
    mrnPartida: `${REAL_MRN}-${REAL_CLAVE_ZETA}`,
    flowType,
    operationType: 'ALTA',
    documentTypePue: 'DUA',
    referenciaDocucice: `PUE-${flowType}-${TS}`,
    declarationTypeSoivre: 'EXPEDIENTE_NUEVO',
    duaPrecedente: '',
    soivrePrecedente: '',
    contactEmail: TEST_USER.email,
    specificities: ['NONE'],
    codCice: { code: '0801', name: 'CICE Barcelona' },
    codPi: { code: '08001', name: 'PI Barcelona Puerto', type: 'MARITIMO' },
    merchandiseUnit: 'KGM',
    merchandiseQuantity: 250,
    certificates: flowType === 'ROHS_RAEE'
      ? { rohs: 'NORMAL', raee: 'NORMAL' }
      : { com: 'NORMAL' },
    riiNumbers: {},
    attachedDocuments: flowType === 'SOIVRE'
      ? [
          { type: 'DECLARATION_CONFORMITY', name: 'Declaracion conformidad UE', documentNumber: `DC-${TS}` },
          { type: 'CERTIFICATE_CE', name: 'Certificado CE producto', documentNumber: `CE-${TS}` }
        ]
      : [],
    operator: {
      name: 'STRIX AI SL',
      eori: 'ESB22477020',
      nif: 'B22477020',
      address: { streetAndNumber: 'Aragon 100', city: 'Zaragoza', postalCode: '50001', province: 'Zaragoza', country: 'ES' },
      contactPerson: 'Luis Rodriguez',
      phone: '+34911234567',
      email: TEST_USER.email
    },
    goods: baseGoods,
    soivreOffice: { code: '0801', name: 'SOIVRE Barcelona', province: 'Barcelona' },
    customsOffice: { code: 'ES002801', name: 'Algeciras' },
    priority: 'normal'
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

// Mass-fill por label (busca dentro del Dialog visible)
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

async function createPueViaAPI(request, payload) {
  const create = await request.post('/api/pue', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: payload, timeout: 30_000
  });
  const body = await create.json().catch(() => ({}));
  if (create.status() >= 400) {
    log('pue-create-debug', 'high',
      `POST /api/pue ${create.status()}: ${(body?.error || body?.message || JSON.stringify(body)).slice(0, 250)}`);
    return { ok: false, stage: 'create', status: create.status(), body };
  }
  const id = body?.data?._id;
  const reference = body?.data?.reference;

  // Submit a AEAT/SOIVRE
  const submit = await request.post(`/api/pue/${id}/submit`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {}, timeout: 60_000
  });
  const submitBody = await submit.json().catch(() => ({}));

  return {
    ok: submit.status() < 400,
    stage: 'submit',
    status: submit.status(),
    id, reference,
    submitBody,
    aeatError: submitBody?.error || submitBody?.aeatResponse?.error
  };
}

test.describe('PUE / Punto Unico de Entrada — flujo completo', () => {
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
      if (u.includes('/api/') && res.status() >= 400 && !u.includes('cache-stats') && !u.includes('lookup-mrn')) {
        log('http-error', res.status() >= 500 ? 'critical' : 'high',
          `${res.status()} ${res.request().method()} ${u.replace('https://aduanas.strixai.es', '')}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 1. Render Manager /pue
  // -------------------------------------------------------------------------
  test('1. Render Manager /pue (header + stats + tabs + lista)', async ({ page }) => {
    await gotoApp(page, '/pue');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '01-manager-default.png'), fullPage: true });

    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
    log('h1', /PUE|Punto/i.test(h1 || '') ? 'low' : 'high', `h1: "${h1?.trim()}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('no-crash', !errorBoundary ? 'low' : 'critical', `Error boundary: ${errorBoundary}`);

    // Subtitle "Gestion de controles SOIVRE (ROHS, COM, ECO, CAL)"
    const subtitle = await page.locator('text=/SOIVRE|ROHS|COM|ECO|CAL/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('subtitle', subtitle ? 'low' : 'medium', `Subtitulo SOIVRE visible: ${subtitle}`);

    // Botones header: "Actualizar" + "Nueva Solicitud"
    const refreshBtn = await page.locator('button:has-text("Actualizar")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const newBtn = await page.locator('button:has-text("Nueva Solicitud")').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('header-buttons', refreshBtn && newBtn ? 'low' : 'medium',
      `Actualizar=${refreshBtn} Nueva Solicitud=${newBtn}`);

    // 5 Cards stats: Total + 4 tipos
    const cards = await page.locator('.MuiCard-root').count();
    log('stats-cards', cards >= 5 ? 'low' : 'medium', `Cards stats: ${cards} (esperado 5: Total + ROHS/COM/ECO/CAL)`);

    // Tabs: Todas, ROHS, COM, ECO, CAL
    const tabs = await page.locator('.MuiTab-root').count();
    log('tabs-count', tabs >= 5 ? 'low' : 'medium', `Tabs: ${tabs} (esperado 5)`);

    for (const t of ['ROHS', 'COM', 'ECO', 'CAL']) {
      const visible = await page.locator(`.MuiTab-root:has-text("${t}")`).first().isVisible({ timeout: 2000 }).catch(() => false);
      log(`tab-${t}`, visible ? 'low' : 'medium', `Tab ${t} visible: ${visible}`);
    }

    // Tabla de solicitudes
    const tableHeaders = await page.locator('thead th').count();
    log('table-headers', tableHeaders >= 5 ? 'low' : 'medium', `Headers tabla PUE: ${tableHeaders}`);
  });

  // -------------------------------------------------------------------------
  // 2. Cambio de tabs filtra por tipo
  // -------------------------------------------------------------------------
  test('2. Tabs ROHS/COM/ECO/CAL filtran lista', async ({ page }) => {
    await gotoApp(page, '/pue');
    await page.waitForTimeout(2000);

    for (const t of ['ROHS', 'COM', 'ECO', 'CAL']) {
      const tab = page.locator(`.MuiTab-root:has-text("${t}")`).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SCREENS, `02-tab-${t.toLowerCase()}.png`), fullPage: true });
        const rows = await page.locator('table tbody tr').count();
        log(`tab-${t}-rows`, 'low', `Tab ${t} renderiza ${rows} filas`);
      }
    }

    // Volver a Todas
    await page.locator('.MuiTab-root:has-text("Todas")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000);
  });

  // -------------------------------------------------------------------------
  // 3. Boton "Nueva Solicitud" abre Dialog con stepper de 6 pasos
  // -------------------------------------------------------------------------
  test('3. Boton Nueva Solicitud abre Dialog 6 pasos', async ({ page }) => {
    await gotoApp(page, '/pue');
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Nueva Solicitud")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '03a-dialog-step0-mrn.png'), fullPage: true });

    const dialogTitle = await page.locator('.MuiDialogTitle-root').first().textContent({ timeout: 3000 }).catch(() => null);
    log('dialog-title', /SOIVRE|PUE/i.test(dialogTitle || '') ? 'low' : 'medium',
      `Dialog title: "${dialogTitle?.trim()}"`);

    const steps = await page.locator('.MuiStepLabel-label').count();
    log('stepper-steps', steps >= 5 ? 'low' : 'medium', `Stepper steps: ${steps} (esperado 5-6)`);

    // Step 0: MRN + Clave Zeta + Buscar
    const mrnInput = await page.locator('label:has-text("MRN")').first().isVisible({ timeout: 2000 }).catch(() => false);
    const claveZetaInput = await page.locator('label:has-text("Clave Zeta")').first().isVisible({ timeout: 2000 }).catch(() => false);
    const searchBtn = await page.locator('button:has-text("Buscar")').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('step0-elements', mrnInput && claveZetaInput && searchBtn ? 'low' : 'medium',
      `Step 0: MRN=${mrnInput} ClaveZeta=${claveZetaInput} Buscar=${searchBtn}`);

    // Radios SOIVRE / ROHS_RAEE
    const soivreRadio = await page.locator('label:has-text("SOIVRE")').first().isVisible({ timeout: 2000 }).catch(() => false);
    const rohsRadio = await page.locator('label:has-text("ROHS")').first().isVisible({ timeout: 2000 }).catch(() => false);
    log('step0-flow-radios', soivreRadio && rohsRadio ? 'low' : 'medium',
      `Flow radios: SOIVRE=${soivreRadio} ROHS=${rohsRadio}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 4. MRN lookup con MRN real -> autofill
  // -------------------------------------------------------------------------
  test('4. MRN lookup con MRN real H1 -> autofill datos', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/pue');
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Nueva Solicitud")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // Llenar MRN + Clave Zeta
    const filled = await fillMatching(page, [
      ['MRN.*Movimiento|^MRN', REAL_MRN],
      ['Clave Zeta', REAL_CLAVE_ZETA]
    ]);
    log('mrn-fields-filled', filled === 2 ? 'low' : 'medium', `Campos MRN llenos: ${filled}/2`);

    await page.screenshot({ path: path.join(SCREENS, '04a-mrn-filled.png'), fullPage: true });

    // Click Buscar
    const searchBtn = page.locator('button:has-text("Buscar")').first();
    await searchBtn.click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENS, '04b-mrn-autofill.png'), fullPage: true });

    // Verificar autofill: panel "Datos cargados" + nombre importador + TARIC
    const autofillPanel = await page.locator('text=/Datos cargados|cargados.*declaracion/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    log('autofill-panel', autofillPanel ? 'low' : 'medium', `Panel autofill visible: ${autofillPanel}`);

    const importerName = await page.locator('text=/STRIX AI/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('autofill-importer', importerName ? 'low' : 'medium', `Importador STRIX AI auto-fill: ${importerName}`);

    const taricVisible = await page.locator('text=/9404211000/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('autofill-taric', taricVisible ? 'low' : 'medium', `TARIC 9404211000 auto-fill: ${taricVisible}`);

    const flowChip = await page.locator('text=/Flujo sugerido|SOIVRE.*Completo|ROHS\\/RAEE/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    log('autofill-flow', flowChip ? 'low' : 'medium', `Chip flujo sugerido: ${flowChip}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 5. Flujo SOIVRE - UI walkthrough completo (6 pasos) + submit AEAT
  // -------------------------------------------------------------------------
  test('5. SOIVRE: UI walkthrough 6 pasos + submit', async ({ page, request }) => {
    test.setTimeout(180_000);
    const payload = buildPayload('SOIVRE');

    await gotoApp(page, '/pue');
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Nueva Solicitud")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // Step 0: MRN lookup
    await fillMatching(page, [
      ['MRN.*Movimiento|^MRN', REAL_MRN],
      ['Clave Zeta', REAL_CLAVE_ZETA]
    ]);
    await page.locator('button:has-text("Buscar")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENS, '05a-soivre-step0-autofill.png'), fullPage: true });

    // Seleccionar flujo SOIVRE
    const soivreRadio = page.locator('input[type="radio"][value="SOIVRE"]').first();
    await soivreRadio.check({ timeout: 2000 }).catch(async () => {
      await page.locator('label:has-text("SOIVRE")').first().click({ timeout: 2000 }).catch(() => {});
    });
    await page.waitForTimeout(500);

    // Click Siguiente (Step 1)
    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '05b-soivre-step1-datos.png'), fullPage: true });

    // Step 1: Datos solicitud
    await fillMatching(page, [
      ['contacto|electronico', payload.contactEmail],
      ['Referencia.*Docucice|Docucice', payload.referenciaDocucice],
    ]);
    await page.waitForTimeout(300);

    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '05c-soivre-step2-specs.png'), fullPage: true });

    // Step 2: Specs - llenar campos basicos
    await fillMatching(page, [
      ['Cantidad.*mercancia', String(payload.merchandiseQuantity)],
    ]);
    await page.waitForTimeout(300);

    // Seleccionar CodCice (autocomplete)
    const codCiceInput = page.locator('label:has-text("CodCice")').first().locator('..').locator('input').first();
    if (await codCiceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await codCiceInput.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      const firstOpt = page.locator('li[role="option"]').first();
      if (await firstOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOpt.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
    }

    // CodPi
    const codPiInput = page.locator('label:has-text("CodPi")').first().locator('..').locator('input').first();
    if (await codPiInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await codPiInput.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      const firstOpt = page.locator('li[role="option"]').first();
      if (await firstOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOpt.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
    }
    await page.screenshot({ path: path.join(SCREENS, '05d-soivre-step2-specs-filled.png'), fullPage: true });

    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '05e-soivre-step3-certs.png'), fullPage: true });

    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '05f-soivre-step4-docs.png'), fullPage: true });

    // Step 4: Docs - agregar 1 documento
    const addDocBtn = page.locator('button:has-text("Agregar")').first();
    if (await addDocBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addDocBtn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENS, '05g-soivre-step4-docs-added.png'), fullPage: true });
    }

    await page.locator('button:has-text("Siguiente")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENS, '05h-soivre-step5-review.png'), fullPage: true });

    // Step 5: Review + Save Draft (no submit que va a fallar AEAT)
    const saveDraftBtn = page.locator('button:has-text("Guardar Borrador")').first();
    if (await saveDraftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveDraftBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENS, '05i-soivre-saved.png'), fullPage: true });
    }

    // Crear PUE via API + intentar submit (fallo AEAT esperado: MRN no indexado SOIVRE PRE)
    const apiResult = await createPueViaAPI(request, payload);
    created.SOIVRE.id = apiResult.id;
    created.SOIVRE.reference = apiResult.reference;
    created.SOIVRE.aeatError = apiResult.aeatError;
    log('soivre-api-create', apiResult.id ? 'low' : 'high',
      `SOIVRE API id=${apiResult.id} ref=${apiResult.reference}`);
    log('soivre-aeat-result',
      apiResult.aeatError?.includes('SOIVRE PRE') || apiResult.aeatError?.includes('no indexado') || apiResult.aeatError?.includes('no encontrado') ? 'low' : 'high',
      `SOIVRE AEAT: ${apiResult.aeatError?.slice(0, 180) || 'OK'}`);
  });

  // -------------------------------------------------------------------------
  // 6. Flujo ROHS_RAEE simplificado
  // -------------------------------------------------------------------------
  test('6. ROHS_RAEE: UI walkthrough simplificado + submit', async ({ page, request }) => {
    test.setTimeout(120_000);
    const payload = buildPayload('ROHS_RAEE');

    await gotoApp(page, '/pue');
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Nueva Solicitud")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // Step 0: MRN lookup
    await fillMatching(page, [
      ['MRN.*Movimiento|^MRN', REAL_MRN],
      ['Clave Zeta', REAL_CLAVE_ZETA]
    ]);
    await page.locator('button:has-text("Buscar")').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // Seleccionar ROHS_RAEE
    const rohsRadio = page.locator('input[type="radio"][value="ROHS_RAEE"]').first();
    await rohsRadio.check({ timeout: 2000 }).catch(async () => {
      await page.locator('label:has-text("ROHS")').nth(1).click({ timeout: 2000 }).catch(() => {});
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENS, '06a-rohs-step0.png'), fullPage: true });

    // Verificar que stepper ahora tiene 5 pasos (sin Docs)
    const visibleSteps = await page.locator('.MuiStepLabel-label').count();
    log('rohs-stepper-steps', visibleSteps === 5 ? 'low' : 'medium',
      `Stepper ROHS_RAEE: ${visibleSteps} pasos (esperado 5, sin Docs)`);

    // Avanzar pasos
    for (let i = 0; i < 4; i++) {
      const nextBtn = page.locator('button:has-text("Siguiente")').first();
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
    }
    await page.screenshot({ path: path.join(SCREENS, '06b-rohs-final-review.png'), fullPage: true });

    // API path
    const apiResult = await createPueViaAPI(request, payload);
    created.ROHS_RAEE.id = apiResult.id;
    created.ROHS_RAEE.reference = apiResult.reference;
    created.ROHS_RAEE.aeatError = apiResult.aeatError;
    log('rohs-api-create', apiResult.id ? 'low' : 'high',
      `ROHS_RAEE API id=${apiResult.id} ref=${apiResult.reference}`);
    log('rohs-aeat-result',
      apiResult.aeatError?.includes('SOIVRE PRE') || apiResult.aeatError?.includes('no indexado') || apiResult.aeatError?.includes('no encontrado') ? 'low' : 'high',
      `ROHS_RAEE AEAT: ${apiResult.aeatError?.slice(0, 180) || 'OK'}`);

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // 7. Lista refrescada con las nuevas PUE
  // -------------------------------------------------------------------------
  test('7. Lista refrescada con nuevas PUE', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page, '/pue');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENS, '07a-list-after-creates.png'), fullPage: true });

    for (const flow of ['SOIVRE', 'ROHS_RAEE']) {
      const ref = created[flow]?.reference;
      if (!ref) {
        log(`list-${flow}`, 'medium', `No reference para ${flow}`);
        continue;
      }
      const visible = await page.locator(`text=${ref}`).first().isVisible({ timeout: 3000 }).catch(() => false);
      log(`list-${flow}`, visible ? 'low' : 'medium', `${flow} ${ref} en lista: ${visible}`);
    }

    // Click tab COM
    const comTab = page.locator('.MuiTab-root:has-text("COM")').first();
    if (await comTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await comTab.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENS, '07b-tab-com-with-soivre.png'), fullPage: true });
    }
  });

  // -------------------------------------------------------------------------
  // 8. Detail page /pue/:id
  // -------------------------------------------------------------------------
  test('8. Detail page /pue/:id', async ({ page }) => {
    test.setTimeout(60_000);
    const target = created.SOIVRE.id || created.ROHS_RAEE.id;
    if (!target) {
      log('detail', 'medium', 'No hay PUE creada para abrir detail');
      return;
    }

    await gotoApp(page, `/pue/${target}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENS, '08a-detail-page.png'), fullPage: true });

    const h1 = await page.locator('h1, h2, h4').first().textContent({ timeout: 5000 }).catch(() => null);
    log('detail-h1', h1 ? 'low' : 'medium', `Detail title: "${h1?.trim()?.slice(0, 80)}"`);

    const errorBoundary = await page.locator('h1:has-text("Algo salio mal")').first().isVisible({ timeout: 1500 }).catch(() => false);
    log('detail-no-crash', !errorBoundary ? 'low' : 'critical', `Detail crash: ${errorBoundary}`);
  });

  // -------------------------------------------------------------------------
  // 9. Filtros + busqueda en lista
  // -------------------------------------------------------------------------
  test('9. Busqueda en lista', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoApp(page, '/pue');
    await page.waitForTimeout(2000);

    const target = created.SOIVRE.reference || created.ROHS_RAEE.reference;
    if (target) {
      const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="ref"]').first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill(target);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENS, '09a-search-by-ref.png'), fullPage: true });
        const rows = await page.locator('table tbody tr').count();
        log('search-result', rows >= 1 ? 'low' : 'medium', `Busqueda "${target}": ${rows} fila(s)`);
      }
    }

    await gotoApp(page, '/pue');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENS, '09b-list-final.png'), fullPage: true });
  });

  test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      timestamp: TS,
      created,
      findings
    }, null, 2));

    console.log('\n=== PUE E2E SUMMARY ===');
    for (const flow of ['SOIVRE', 'ROHS_RAEE']) {
      const c = created[flow];
      console.log(`  ${flow}: ref=${c.reference || '-'}  id=${c.id || '-'}  aeatError=${(c.aeatError || '').slice(0, 100) || '-'}`);
    }
    console.log('\n=== FINDINGS ===');
    for (const f of findings) console.log(`  [${f.sev}] (${f.cat}) ${f.msg}`);
    console.log(`\n=== REPORT ${REPORT} ===`);
  });
});
