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

const exciseDutiesService = require('../../src/services/exciseDutiesService');
const rulesEngine = require('../../src/services/rulesEngine');

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
