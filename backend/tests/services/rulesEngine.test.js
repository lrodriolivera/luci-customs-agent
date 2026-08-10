/**
 * rulesEngine: motor de reglas aduaneras (sanciones, restricciones, doble uso,
 * preferencias, aranceles, controles paraduaneros y documentacion).
 *
 * Es logica de negocio PURA salvo el calculo de impuestos especiales, que
 * delega en exciseDutiesService (dep externa, se mockea). El resto —el mapa de
 * acuerdos, sanciones y restricciones— se prueba directamente: son las tablas
 * que deciden si una operacion puede pasar, que garantia exige y que documentos
 * pide. Un error aqui deja pasar una operacion prohibida o pierde una
 * preferencia arancelaria del cliente.
 */

jest.mock('../../src/services/exciseDutiesService', () => ({
  calculateTotalExciseDuties: jest.fn(),
  detectExciseProduct: jest.fn()
}));

// preferencesService y quotaService son servicios YA cubiertos por sus propias
// baterias; aqui se mockean como fronteras para poder ejercitar cada rama de
// analyzeOperation (preferencia con/sin ahorro, warnings, contingentes criticos,
// caida al fallback simple) sin depender de sus tablas internas.
jest.mock('../../src/services/preferencesService', () => ({
  checkEligibility: jest.fn()
}));
jest.mock('../../src/services/quotaService', () => ({
  checkQuotaAvailability: jest.fn(),
  calculateQuotaSavings: jest.fn()
}));

const exciseDutiesService = require('../../src/services/exciseDutiesService');
const preferencesService = require('../../src/services/preferencesService');
const quotaService = require('../../src/services/quotaService');
const rulesEngine = require('../../src/services/rulesEngine');

/**
 * Valores por defecto neutros para las fronteras. Cada test que necesite un
 * comportamiento distinto los sobrescribe. Como jest.config tiene
 * resetMocks:true, hay que re-armarlos en cada beforeEach.
 */
function armarFronterasNeutras() {
  exciseDutiesService.calculateTotalExciseDuties.mockReturnValue({
    total: 0, byCategory: {}, items: []
  });
  preferencesService.checkEligibility.mockResolvedValue({
    eligible: false, agreements: [], recommended: null,
    savings: 0, requirements: [], warnings: []
  });
  // El servicio de contingentes consulta el catalogo oficial en Mongo, asi que es
  // asincrono: con `mockReturnValue` el motor recibiria una promesa y
  // `quotaCheck.found` saldria undefined sin que ningun test se queje.
  quotaService.checkQuotaAvailability.mockResolvedValue({ found: false, quotas: [] });
  quotaService.calculateQuotaSavings.mockResolvedValue({ applicable: false });
}

describe('checkSanctions', () => {
  test('un pais sin sanciones no esta sancionado', () => {
    expect(rulesEngine.checkSanctions('ES')).toEqual({ sanctioned: false });
  });

  test('embargo total bloquea la operacion', () => {
    const r = rulesEngine.checkSanctions('KP');

    expect(r.sanctioned).toBe(true);
    expect(r.level).toBe('total');
    expect(r.action).toBe('block_operation');
  });

  test('sancion sectorial solo requiere autorizacion, no bloquea', () => {
    const r = rulesEngine.checkSanctions('RU');

    expect(r.sanctioned).toBe(true);
    expect(r.action).toBe('require_authorization');
  });
});

describe('checkRestrictions', () => {
  test('sin codigo TARIC no hay restriccion', () => {
    expect(rulesEngine.checkRestrictions(null)).toEqual({ restricted: false });
  });

  test('armas (capitulo 93) estan prohibidas y requieren permiso de Defensa', () => {
    const r = rulesEngine.checkRestrictions('93012000');

    expect(r.restricted).toBe(true);
    expect(r.restriction).toBe('prohibited');
    expect(r.authority).toBe('Defensa');
  });

  test('un match por partida (4 digitos) prima: explosivos 3601', () => {
    const r = rulesEngine.checkRestrictions('36010000');

    expect(r.restricted).toBe(true);
    expect(r.authority).toBe('Industria');
  });

  test('un TARIC sin restriccion no esta restringido', () => {
    expect(rulesEngine.checkRestrictions('09012100')).toEqual({ restricted: false });
  });
});

describe('checkDualUse', () => {
  test('detecta productos de doble uso por capitulo y exige licencia MINCOTUR', () => {
    const r = rulesEngine.checkDualUse([{ taricCode: '85423100', description: 'Circuitos' }]);

    expect(r.isDualUse).toBe(true);
    expect(r.requiresLicense).toBe(true);
    expect(r.authority).toBe('MINCOTUR');
    expect(r.goods).toHaveLength(1);
  });

  test('mercancias comunes no son de doble uso', () => {
    const r = rulesEngine.checkDualUse([{ taricCode: '09012100' }]);

    expect(r.isDualUse).toBe(false);
    expect(r.requiresLicense).toBe(false);
  });

  test('lista vacia o indefinida no rompe', () => {
    expect(rulesEngine.checkDualUse([]).isDualUse).toBe(false);
    expect(rulesEngine.checkDualUse(undefined).isDualUse).toBe(false);
  });
});

describe('getTariffRate', () => {
  test('sin TARIC devuelve la tasa por defecto del 5%', () => {
    expect(rulesEngine.getTariffRate(null)).toBe(0.05);
  });

  test('maquinaria (cap. 84) tributa al 3%', () => {
    expect(rulesEngine.getTariffRate('84713000')).toBe(0.03);
  });

  test('un capitulo sin tasa especifica cae al 5% por defecto', () => {
    expect(rulesEngine.getTariffRate('99999999')).toBe(0.05);
  });
});

describe('calculateTariff', () => {
  test('acumula el arancel de cada partida sobre su valor en aduana', async () => {
    // cap 09 (cafe) = 9%; cap 84 = 3%.  1000*0.09 + 2000*0.03 = 90 + 60 = 150
    const tariff = await rulesEngine.calculateTariff({
      goods: [
        { taricCode: '09012100', customsValue: 1000 },
        { taricCode: '84713000', customsValue: 2000 }
      ]
    });

    expect(tariff.standard).toBeCloseTo(150);
    expect(tariff.applied).toBeCloseTo(150);
    expect(tariff.currency).toBe('EUR');
  });

  test('sin mercancias el arancel es cero', async () => {
    const tariff = await rulesEngine.calculateTariff({ goods: [] });
    expect(tariff.standard).toBe(0);
  });
});

describe('calculateTaxes', () => {
  beforeEach(() => {
    exciseDutiesService.calculateTotalExciseDuties.mockReturnValue({
      total: 0, byCategory: {}, items: []
    });
  });

  test('la base imponible del IVA es valor en aduana mas arancel, al 21%', async () => {
    // customsValue 1000 + tariff 100 = base 1100 ; IVA = 231
    const taxes = await rulesEngine.calculateTaxes(
      { goods: [{ customsValue: 1000 }] },
      { applied: 100 }
    );

    expect(taxes.taxableBase).toBe(1100);
    expect(taxes.vat.amount).toBeCloseTo(231);
    expect(taxes.total).toBeCloseTo(100 + 231); // arancel + IVA (excise 0)
  });

  test('marca los impuestos especiales como aplicables cuando el servicio los devuelve', async () => {
    exciseDutiesService.calculateTotalExciseDuties.mockReturnValue({
      total: 50, byCategory: { alcohol: 50 }, items: [{ x: 1 }]
    });

    const taxes = await rulesEngine.calculateTaxes(
      { goods: [{ customsValue: 1000 }] },
      { applied: 0 }
    );

    expect(taxes.excise.applicable).toBe(true);
    expect(taxes.excise.amount).toBe(50);
  });
});

describe('checkPreferences', () => {
  test('un pais con acuerdo FTA moderno usa declaracion de origen', () => {
    const r = rulesEngine.checkPreferences({ originCountry: 'JP' }); // JEFTA

    expect(r.available).toBe(true);
    expect(r.agreements.some(a => a.name === 'JEFTA')).toBe(true);
    expect(r.proofOfOrigin).toContain('DeclaracionOrigen');
  });

  test('un origen con REX activa la nota de exportador registrado', () => {
    const r = rulesEngine.checkPreferences({ originCountry: 'VN' }); // EU-Vietnam proofExport REX

    expect(r.requiresREX).toBe(true);
    expect(r.rexNote).toMatch(/REX/);
  });

  test('una union aduanera activa la nota de ATR/T2L', () => {
    const r = rulesEngine.checkPreferences({ originCountry: 'TR' }); // EU-Turkey

    expect(r.customsUnion).toBe(true);
    expect(r.customsUnionNote).toMatch(/ATR|T2L/);
  });

  test('un origen sin acuerdo no tiene preferencias', () => {
    const r = rulesEngine.checkPreferences({ originCountry: 'US' });

    expect(r.available).toBe(false);
    expect(r.agreements).toHaveLength(0);
  });
});

describe('determineParacustomsControls', () => {
  test('carne (cap. 02) exige control veterinario del MAPA', async () => {
    const c = await rulesEngine.determineParacustomsControls({ goods: [{ taricCode: '02013000' }] });

    expect(c.some(x => x.type === 'veterinary' && x.authority === 'MAPA')).toBe(true);
  });

  test('los controles duplicados (mismo tipo y autoridad) se colapsan en uno', async () => {
    // Dos mercancias del mismo capitulo generan un solo control.
    const c = await rulesEngine.determineParacustomsControls({
      goods: [{ taricCode: '02013000' }, { taricCode: '02024000' }]
    });

    expect(c.filter(x => x.type === 'veterinary')).toHaveLength(1);
  });

  test('un producto industrial (cap. 85) genera control SOIVRE no obligatorio', async () => {
    const c = await rulesEngine.determineParacustomsControls({ goods: [{ taricCode: '85287200' }] });
    const soivre = c.find(x => x.authority === 'SOIVRE');

    expect(soivre).toBeTruthy();
    expect(soivre.required).toBe(false);
  });
});

describe('determineDocumentation', () => {
  const baseAnalysis = { preferences: {}, controls: { paracustoms: [] }, permits: [] };

  test('siempre incluye la documentacion basica (factura, BL, packing)', () => {
    const docs = rulesEngine.determineDocumentation({}, baseAnalysis);
    const codes = docs.map(d => d.code);

    expect(codes).toEqual(expect.arrayContaining(['N380', 'N703', 'N730']));
  });

  test('anade el certificado de origen si hay preferencias disponibles', () => {
    const docs = rulesEngine.determineDocumentation({}, {
      ...baseAnalysis,
      preferences: { available: true, certificate: 'EUR.1' }
    });

    expect(docs.some(d => d.code === 'C501' && d.name === 'EUR.1')).toBe(true);
  });

  /**
   * `checkSanctions` marca `action: 'require_authorization'` para los paises
   * sancionados parcialmente (RU, nivel sectorial), pero esa autorizacion no
   * llegaba NUNCA a la documentacion. Detectado en produccion el 10/Ago/2026:
   * una importacion textil desde Rusia salia "con Restricciones" y a la vez
   * listaba como documentacion solo Factura + BL/AWB + Packing List, omitiendo
   * el unico requisito que impide despacharla.
   */
  test('una sancion que exige autorizacion la anade a la documentacion', () => {
    const docs = rulesEngine.determineDocumentation({}, {
      ...baseAnalysis,
      controls: {
        paracustoms: [],
        sanctions: { sanctioned: true, country: 'RU', level: 'sectorial', reason: 'Rusia - sanciones por conflicto Ucrania', action: 'require_authorization' }
      }
    });

    const autorizacion = docs.find(d => /Autorizacion de importacion/i.test(d.name));
    expect(autorizacion).toBeTruthy();
    expect(autorizacion.mandatory).toBe(true);
    expect(autorizacion.name).toContain('RU');
  });

  test('sin sancion no se anade ninguna autorizacion', () => {
    const docs = rulesEngine.determineDocumentation({}, {
      ...baseAnalysis,
      controls: { paracustoms: [], sanctions: { sanctioned: false } }
    });

    expect(docs.some(d => /Autorizacion de importacion/i.test(d.name))).toBe(false);
  });

  // Una sancion TOTAL bloquea la operacion (`block_operation`): no procede pedir
  // una autorizacion para algo que no se puede importar.
  test('una sancion total no pide autorizacion: bloquea', () => {
    const docs = rulesEngine.determineDocumentation({}, {
      ...baseAnalysis,
      controls: { paracustoms: [], sanctions: { sanctioned: true, country: 'KP', level: 'total', action: 'block_operation' } }
    });

    expect(docs.some(d => /Autorizacion de importacion/i.test(d.name))).toBe(false);
  });

  test('desglosa los documentos de los controles paraduaneros', () => {
    const docs = rulesEngine.determineDocumentation({}, {
      ...baseAnalysis,
      controls: { paracustoms: [{ required: true, authority: 'MAPA', documents: ['C620 - Certificado Veterinario'] }] }
    });

    const vet = docs.find(d => d.code === 'C620');
    expect(vet).toBeTruthy();
    expect(vet.name).toBe('Certificado Veterinario');
    expect(vet.mandatory).toBe(true);
  });
});

describe('generateRequirementsSummary', () => {
  test('agrupa documentacion obligatoria, controles, permisos e IIEE', () => {
    const summary = rulesEngine.generateRequirementsSummary({
      documentation: [{ name: 'Factura', mandatory: true }, { name: 'Opcional', mandatory: false }],
      controls: { paracustoms: [{ authority: 'MAPA', type: 'veterinary' }] },
      permits: [{ required: true, authority: 'Defensa', type: 'weapons' }],
      taxes: { excise: { applicable: true, type: 'alcohol' } }
    });

    const cats = summary.map(s => s.category);
    expect(cats).toEqual(expect.arrayContaining(['documentation', 'paracustoms_controls', 'permits', 'excise_duties']));
    // Solo cuenta la documentacion obligatoria (1 de 2).
    expect(summary.find(s => s.category === 'documentation').count).toBe(1);
  });

  test('sin requisitos devuelve un resumen vacio', () => {
    const summary = rulesEngine.generateRequirementsSummary({
      documentation: [], controls: { paracustoms: [] }, permits: [], taxes: {}
    });

    expect(summary).toEqual([]);
  });
});

describe('getApplicableAgreements', () => {
  test('devuelve los acuerdos de un pais con su certificado (regresion del bug getCertificateType)', () => {
    // Antes: getApplicableAgreements llamaba a this.getCertificateType, que NO
    // existia -> TypeError -> 500 en GET /api/rules/agreements/:pais para
    // CUALQUIER pais con acuerdo. Ahora el metodo existe y mapea el tipo.
    const r = rulesEngine.getApplicableAgreements('JP'); // JEFTA (fta)

    expect(r.length).toBeGreaterThan(0);
    const jefta = r.find(a => a.name === 'JEFTA');
    expect(jefta.certificate).toBe('DeclaracionOrigen');
  });

  test('un pais sin acuerdo devuelve lista vacia', () => {
    expect(rulesEngine.getApplicableAgreements('US')).toEqual([]);
  });
});

describe('getCertificateType', () => {
  test('mapea cada tipo de acuerdo a su certificado caracteristico', () => {
    expect(rulesEngine.getCertificateType('bilateral')).toBe('EUR.1');
    expect(rulesEngine.getCertificateType('fta')).toBe('DeclaracionOrigen');
    expect(rulesEngine.getCertificateType('gsp')).toBe('REX');
    expect(rulesEngine.getCertificateType('customs_union')).toBe('ATR');
  });

  test('un tipo desconocido cae a EUR.1', () => {
    expect(rulesEngine.getCertificateType('desconocido')).toBe('EUR.1');
  });
});

describe('checkExciseDuty', () => {
  test('delega la deteccion de impuestos especiales en el servicio completo', () => {
    exciseDutiesService.detectExciseProduct.mockReturnValue({ isExcise: true, category: 'alcohol' });

    const r = rulesEngine.checkExciseDuty('22030000');

    expect(exciseDutiesService.detectExciseProduct).toHaveBeenCalledWith('22030000');
    expect(r).toEqual({ isExcise: true, category: 'alcohol' });
  });
});

describe('determineParacustomsControls (ramas restantes)', () => {
  test('fruta fresca (cap. 08) exige control fitosanitario del MAPA', async () => {
    const c = await rulesEngine.determineParacustomsControls({ goods: [{ taricCode: '08051000' }] });
    const fito = c.find(x => x.type === 'phytosanitary');

    expect(fito).toBeTruthy();
    expect(fito.authority).toBe('MAPA');
    expect(fito.documents).toContain('C633 - Certificado Fitosanitario');
  });

  test('conservas de pescado (cap. 16) exigen control sanitario de SANIDAD', async () => {
    const c = await rulesEngine.determineParacustomsControls({ goods: [{ taricCode: '16041400' }] });
    const food = c.find(x => x.type === 'food_safety');

    expect(food).toBeTruthy();
    expect(food.authority).toBe('SANIDAD');
    expect(food.required).toBe(true);
  });

  test('sin mercancias no hay controles', async () => {
    expect(await rulesEngine.determineParacustomsControls({})).toEqual([]);
  });
});

describe('determineDocumentation (permisos)', () => {
  const baseAnalysis = { preferences: {}, controls: { paracustoms: [] }, permits: [] };

  test('cada permiso especial anade un documento C990 con su autoridad y obligatoriedad', () => {
    const docs = rulesEngine.determineDocumentation({}, {
      ...baseAnalysis,
      permits: [{ authority: 'Defensa', required: true }]
    });

    const permisoDoc = docs.find(d => d.code === 'C990');
    expect(permisoDoc).toBeTruthy();
    expect(permisoDoc.name).toBe('Permiso Defensa');
    expect(permisoDoc.mandatory).toBe(true);
    expect(permisoDoc.authority).toBe('Defensa');
  });
});

describe('analyzeOperation', () => {
  beforeEach(() => {
    armarFronterasNeutras();
  });

  test('operacion limpia de importacion: elegible, con impuestos y documentacion basica', async () => {
    const analysis = await rulesEngine.analyzeOperation({
      id: 'OP-1',
      type: 'import',
      originCountry: 'US',
      goods: [{ taricCode: '84713000', description: 'Ordenador', customsValue: 1000, quantity: 1 }]
    });

    expect(analysis.summary.eligible).toBe(true);
    expect(analysis.controls.sanctions).toBeNull();
    // Import -> se calculan aranceles e impuestos
    expect(analysis.tariff).not.toBeNull();
    expect(analysis.taxes.vat.rate).toBe(0.21);
    // Documentacion basica siempre presente
    expect(analysis.documentation.map(d => d.code)).toEqual(expect.arrayContaining(['N380', 'N703', 'N730']));
    // El resumen incluye la documentacion obligatoria
    expect(analysis.summary.requirements.some(r => r.category === 'documentation')).toBe(true);
    expect(analysis.operationId).toBe('OP-1');
  });

  test('origen con embargo total: no elegible y alerta critica de sanciones', async () => {
    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'KP',
      goods: [{ taricCode: '84713000', customsValue: 500 }]
    });

    expect(analysis.summary.eligible).toBe(false);
    expect(analysis.controls.sanctions.sanctioned).toBe(true);
    expect(analysis.summary.alerts.some(a => a.code === 'SANCTIONS' && a.severity === 'critical')).toBe(true);
  });

  test('producto prohibido: no elegible, alerta PROHIBITED y permiso requerido', async () => {
    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'US',
      goods: [{ taricCode: '93012000', description: 'Fusil', customsValue: 800 }]
    });

    expect(analysis.summary.eligible).toBe(false);
    expect(analysis.summary.alerts.some(a => a.code === 'PROHIBITED')).toBe(true);
    const permiso = analysis.permits.find(p => p.authority === 'Defensa');
    expect(permiso).toBeTruthy();
    expect(permiso.required).toBe(true);
    expect(permiso.type).toBe('prohibited');
  });

  test('producto controlado (no prohibido): registra permiso pero sigue elegible', async () => {
    // 2939 (alcaloides) -> controlled / AEMPS / required, restriction != prohibited
    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'US',
      goods: [{ taricCode: '29391000', description: 'Alcaloide', customsValue: 300 }]
    });

    expect(analysis.summary.eligible).toBe(true);
    expect(analysis.summary.alerts.some(a => a.code === 'PROHIBITED')).toBe(false);
    expect(analysis.permits.some(p => p.authority === 'AEMPS')).toBe(true);
  });

  test('exportacion de producto de doble uso: warning DUAL_USE y control registrado', async () => {
    const analysis = await rulesEngine.analyzeOperation({
      type: 'export',
      originCountry: 'ES',
      goods: [{ taricCode: '85423100', description: 'Circuito integrado' }]
    });

    expect(analysis.controls.dual_use.isDualUse).toBe(true);
    expect(analysis.summary.warnings.some(w => w.code === 'DUAL_USE')).toBe(true);
    // Export no calcula aranceles ni consulta preferencias
    expect(analysis.tariff).toBeNull();
    expect(preferencesService.checkEligibility).not.toHaveBeenCalled();
  });

  test('preferencia con ahorro emite recomendacion cost_saving y conserva los datos ricos', async () => {
    // Regresion del bug corregido: antes analyzeOperation empujaba a
    // analysis.summary.recommendations (inexistente) -> TypeError capturado por
    // el catch de preferencias -> degradaba al fallback con savings=0 y perdia
    // la recomendacion en silencio. El fix apunta el push a analysis.recommendations
    // (el array real de la raiz). Ahora la recomendacion SI se emite y los datos
    // de preferencesService se conservan.
    preferencesService.checkEligibility.mockResolvedValue({
      eligible: true,
      agreements: [{ certificate: 'EUR.1', name: 'EU-Chile' }],
      recommended: { certificate: 'EUR.1', name: 'EU-Chile' },
      savings: 123.456,
      requirements: [],
      warnings: []
    });

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'CL',
      goods: [{ taricCode: '08051000', customsValue: 1000 }]
    });

    // Se conservan los datos ricos de preferencesService (no cae al fallback).
    expect(analysis.preferences.available).toBe(true);
    expect(analysis.preferences.savings).toBe(123.456);
    // La recomendacion de ahorro se emite en la raiz del analysis.
    const rec = analysis.recommendations.find(r => r.type === 'cost_saving');
    expect(rec).toBeTruthy();
    expect(rec.message).toContain('123.46');
    // Sin ANALYSIS_ERROR: el camino ya no revienta.
    expect(analysis.summary.alerts.some(a => a.code === 'ANALYSIS_ERROR')).toBe(false);
  });

  test('warnings de preferencias se propagan al resumen', async () => {
    preferencesService.checkEligibility.mockResolvedValue({
      eligible: false, agreements: [], recommended: null, savings: 0, requirements: [],
      warnings: [{ code: 'NO_AGREEMENTS', message: 'Sin acuerdo' }]
    });

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'US',
      goods: [{ taricCode: '84713000', customsValue: 100 }]
    });

    expect(analysis.summary.warnings.some(w => w.code === 'NO_AGREEMENTS')).toBe(true);
  });

  test('si preferencesService falla, cae al fallback checkPreferences (simple)', async () => {
    preferencesService.checkEligibility.mockRejectedValue(new Error('servicio caido'));

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'JP', // JEFTA -> el fallback simple encuentra acuerdo
      goods: [{ taricCode: '84713000', customsValue: 100 }]
    });

    // El fallback (checkPreferences) devuelve la forma con agreements[]
    expect(analysis.preferences.available).toBe(true);
    expect(analysis.preferences.agreements.some(a => a.name === 'JEFTA')).toBe(true);
  });

  test('informa de que existe contingente sin afirmar un ahorro', async () => {
    // El motor NO tiene el tipo dentro del contingente (esta en la medida de
    // TARIC del codigo y el origen concretos), asi que no puede cifrar el ahorro.
    // La version anterior leia un `duty.savings` del catalogo cableado y llamaba a
    // calculateQuotaSavings con el; ahora se recomienda comprobar y se deja el
    // ahorro en null, que es lo que se sabe.
    quotaService.checkQuotaAvailability.mockResolvedValue({
      found: true,
      quotas: [{
        orderNumber: '090006',
        available: true,
        critical: false,
        volume: { utilizationPercent: 17.53, syncedAt: '2026-08-10T06:00:00.000Z', balanceStale: false }
      }]
    });

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'CN',
      goods: [{ taricCode: '0302410000', description: 'Arenques', customsValue: 1000, quantity: 500, unit: 'kg' }]
    });

    expect(analysis.quotas).toHaveLength(1);
    expect(analysis.quotas[0].taricCode).toBe('0302410000');

    const rec = analysis.recommendations.find(r => r.type === 'quota_available');
    expect(rec).toBeTruthy();
    expect(rec.quota).toBe('090006');
    expect(rec.savings).toBeNull();
    expect(rec.message).toMatch(/Comprobar el saldo y el tipo aplicable/i);
    // Y no se inventa un tipo para poder llamar al calculo de ahorro.
    expect(quotaService.calculateQuotaSavings).not.toHaveBeenCalled();
    expect(analysis.summary.alerts.some(a => a.code === 'ANALYSIS_ERROR')).toBe(false);
  });

  test('no afirma que el contingente sea "para" el codigo si coincide por prefijo', async () => {
    // 090101 no esta definido en `5007200000` sino en `5007201110`, `5007201910`...
    // El contingente se localiza por prefijo, pero decir "existe contingente para
    // 5007200000" afirmaria una cobertura que no se ha comprobado: puede aplicar a
    // otra subdivision del epigrafe y no a la mercancia declarada.
    quotaService.checkQuotaAvailability.mockResolvedValue({
      found: true,
      quotas: [{
        orderNumber: '090101',
        available: null,
        critical: false,
        codeMatch: 'prefijo',
        taricCodes: ['5007201110', '5007201910'],
        volume: { utilizationPercent: null, syncedAt: '2026-08-10T06:00:00.000Z', balanceStale: false }
      }]
    });

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'IN',
      goods: [{ taricCode: '5007200000', description: 'Tejidos de seda', customsValue: 1000, quantity: 100, unit: 'kg' }]
    });

    const rec = analysis.recommendations.find(r => r.type === 'quota_available');
    expect(rec).toBeTruthy();
    expect(rec.message).toMatch(/subdivisiones/i);
    expect(rec.message).not.toMatch(/Existe contingente arancelario 090101 para 5007200000\./);
    expect(rec.codeMatch).toBe('prefijo');
  });

  test('avisa de criticidad con el dato de TARIC, no con el porcentaje de consumo', async () => {
    // Un contingente al 17,53% puede ser critico: la Comision lo declara por sus
    // reglas de gestion. Deducirlo de >90% de consumo dejaba pasar precisamente
    // los que se agotan en horas.
    quotaService.checkQuotaAvailability.mockResolvedValue({
      found: true,
      quotas: [{
        orderNumber: '090006',
        available: true,
        critical: true,
        volume: { utilizationPercent: 17.53, syncedAt: '2026-08-10T06:00:00.000Z', balanceStale: false }
      }]
    });

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'CN',
      goods: [{ taricCode: '0302410000', customsValue: 1000, quantity: 100 }]
    });

    const w = analysis.summary.warnings.find(x => x.code === 'QUOTA_CRITICAL');
    expect(w).toBeTruthy();
    expect(w.message).toContain('090006');
    expect(w.message).toMatch(/TARIC marca/i);
    expect(analysis.summary.alerts.some(a => a.code === 'ANALYSIS_ERROR')).toBe(false);
  });

  test('avisa cuando el saldo del contingente esta caducado', async () => {
    // Un saldo de hace dias presentado sin fecha es lo que hace que un FCFS
    // agotado parezca disponible.
    quotaService.checkQuotaAvailability.mockResolvedValue({
      found: true,
      quotas: [{
        orderNumber: '090006',
        available: true,
        critical: false,
        volume: { utilizationPercent: 17.53, syncedAt: '2026-08-01T06:00:00.000Z', balanceStale: true }
      }]
    });

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'CN',
      goods: [{ taricCode: '0302410000', customsValue: 1000, quantity: 100 }]
    });

    const w = analysis.summary.warnings.find(x => x.code === 'QUOTA_BALANCE_STALE');
    expect(w).toBeTruthy();
    expect(w.message).toContain('2026-08-01T06:00:00.000Z');
  });

  test('operacion sin mercancias no rompe y sigue siendo elegible', async () => {
    const analysis = await rulesEngine.analyzeOperation({ type: 'import', originCountry: 'US' });

    expect(analysis.summary.eligible).toBe(true);
    expect(analysis.controls.paracustoms).toEqual([]);
  });

  test('un error interno se captura y se registra como alerta ANALYSIS_ERROR', async () => {
    // Forzar un fallo dentro del try: calculateTotalExciseDuties lanza durante
    // calculateTaxes (import). analyzeOperation debe capturarlo, no propagarlo.
    exciseDutiesService.calculateTotalExciseDuties.mockImplementation(() => {
      throw new Error('excise roto');
    });

    const analysis = await rulesEngine.analyzeOperation({
      type: 'import',
      originCountry: 'US',
      goods: [{ taricCode: '84713000', customsValue: 100 }]
    });

    expect(analysis.summary.alerts.some(a => a.code === 'ANALYSIS_ERROR' && a.message === 'excise roto')).toBe(true);
  });
});

describe('validateCompliance', () => {
  beforeEach(() => {
    armarFronterasNeutras();
  });

  test('valida documentos y permisos obligatorios (regresion: ahora espera analyzeOperation)', async () => {
    // Regresion del bug corregido: validateCompliance llamaba a analyzeOperation
    // SIN await -> analysis era una Promise y analysis.documentation undefined ->
    // TypeError en el primer .filter. Con el fix (async + await) el metodo
    // funciona y evalua los documentos/permisos obligatorios reales.
    const compliance = await rulesEngine.validateCompliance(
      { type: 'import', originCountry: 'US', goods: [{ taricCode: '84713000', customsValue: 100 }] },
      []
    );
    expect(compliance).toHaveProperty('compliant');
    expect(Array.isArray(compliance.missing)).toBe(true);
  });

  test('marca no conforme si faltan documentos obligatorios; conforme si se aportan', async () => {
    // Un origen con control paraduanero fuerza documentacion obligatoria; sin
    // aportarla -> no conforme; aportando todos los codigos -> conforme.
    const operacion = {
      type: 'import',
      originCountry: 'CN',
      goods: [{ taricCode: '93012000', customsValue: 1000, quantity: 1 }] // armas: control estricto
    };
    const sinDocs = await rulesEngine.validateCompliance(operacion, []);
    const analysis = await rulesEngine.analyzeOperation(operacion);
    const obligatorios = analysis.documentation.filter(d => d.mandatory).map(d => d.code);

    if (obligatorios.length > 0) {
      expect(sinDocs.compliant).toBe(false);
      expect(sinDocs.missing.some(m => m.type === 'document')).toBe(true);
    }
    // Aportando todos los documentos obligatorios ya no faltan documentos.
    const conDocs = await rulesEngine.validateCompliance(operacion, obligatorios);
    expect(conDocs.missing.filter(m => m.type === 'document')).toHaveLength(0);
  });
});
