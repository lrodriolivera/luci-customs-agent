/**
 * taricService — nucleo de liquidacion: calculateDuties, getCodeInfo (con
 * cache), getRequiredDocuments, searchByDescription y los fallbacks a la API de
 * la UE. Es lo que decide cuanto se paga por importar; un error aqui es dinero.
 *
 * El test existente (taricService.test.js) cubre solo los helpers puros. Este
 * ejercita la logica que toca datos:
 *  - Mongo REAL en memoria: TaricCode/TaricAICache/TaricSearchHistory se usan de
 *    verdad. Vacio, `TaricCode.findOne` devuelve null y getCodeInfo cae al
 *    catalogo COMMON_TARIC_CODES -> calculateDuties corre entero, sin mockear el
 *    codigo bajo prueba. Cuando hace falta un resultado local, se inserta un
 *    documento real y se consulta.
 *  - La UNICA frontera que se mockea es `axios` (red a ec.europa.eu): probar la
 *    red real seria un test flaky que depende de la Comision Europea. Se mockea
 *    axios.get para forzar las ramas de API disponible / caida / fallback.
 *
 * Todos los importes se comprueban con numeros exactos calculados a mano a
 * partir del catalogo (COMMON_TARIC_CODES) para fijar la matematica de la
 * liquidacion, no solo su forma.
 */

const axios = require('axios');
jest.mock('axios');

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const taric = require('../../src/services/taricService');
const TaricCode = require('../../src/models/TaricCode');

usarBaseDeDatosEnMemoria();

beforeEach(() => {
  // getCodeInfo cachea en un Map de instancia; se limpia para que cada test
  // parta de cero y no herede un resultado de otro.
  taric.cache.clear();
  // Por defecto la API de la UE esta "caida": axios.get rechaza. Cada test que
  // quiera la rama de API disponible sobreescribe este mock.
  axios.get.mockRejectedValue(new Error('ENOTFOUND ec.europa.eu'));
});

describe('getCodeInfo', () => {
  test('un codigo del catalogo comun se resuelve sin API y trae breakdown', async () => {
    const info = await taric.getCodeInfo('8471300000'); // portatil, arancel 0, IVA 21
    expect(info.source).toBe('common');
    expect(info.duties.thirdCountry).toBe(0);
    expect(info.vat.applicable).toBe(21);
    expect(info.breakdown.chapter).toBe('84');
    expect(axios.get).not.toHaveBeenCalled(); // no salio a la red
  });

  test('prioriza la base de datos local sobre el catalogo comun', async () => {
    // Insertamos una version local del portatil con arancel distinto: debe ganar.
    await TaricCode.create({
      code: '8471300000',
      description: { es: 'Portatil (local)', en: 'Laptop (local)' },
      duties: { thirdCountry: 5 },
      vat: { applicable: 21 },
      level: 10, isLeaf: true, isActive: true
    });
    const info = await taric.getCodeInfo('8471300000');
    expect(info.duties.thirdCountry).toBe(5); // el local, no el comun (0)
  });

  test('el segundo acceso se sirve de cache (no repite la busqueda)', async () => {
    const spy = jest.spyOn(TaricCode, 'findOne');
    await taric.getCodeInfo('8517120000');
    await taric.getCodeInfo('8517120000');
    expect(spy).toHaveBeenCalledTimes(1); // la segunda vez salio de cache
    spy.mockRestore();
  });

  test('la cache expira pasado el timeout y vuelve a consultar', async () => {
    const spy = jest.spyOn(TaricCode, 'findOne');
    await taric.getCodeInfo('8517120000');
    // envejecer la entrada de cache mas alla del timeout
    const key = 'taric_8517120000';
    taric.cache.get(key).timestamp = Date.now() - taric.cacheTimeout - 1;
    await taric.getCodeInfo('8517120000');
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  test('codigo desconocido, con la API caida, devuelve null', async () => {
    const info = await taric.getCodeInfo('9999999999');
    expect(info).toBeNull();
  });

  test('codigo desconocido: si la API Access2Markets responde, se usa', async () => {
    axios.get.mockResolvedValueOnce({
      data: { description_es: 'Cosa rara', conventionalRate: 7 }
    });
    const info = await taric.getCodeInfo('9999999999');
    expect(info.source).toBe('eu_api');
    expect(info.duties.thirdCountry).toBe(7);
    expect(info.vat.applicable).toBe(21);
  });

  test('codigo desconocido: si Access2Markets cae pero TARIC3 responde, fallback', async () => {
    axios.get
      .mockRejectedValueOnce(new Error('a2m down'))           // Access2Markets
      .mockResolvedValueOnce({ data: { description: 'Via TARIC3', thirdCountryDuty: 3 } }); // TARIC3
    const info = await taric.getCodeInfo('9999999999');
    expect(info.source).toBe('taric3_api');
    expect(info.duties.thirdCountry).toBe(3);
  });
});

describe('calculateDuties — matematica de la liquidacion', () => {
  test('arancel ad valorem + IVA sobre (valor + arancel)', async () => {
    // Camiseta 6109100000: arancel 12%, IVA 21%. Valor 100 EUR desde China.
    const r = await taric.calculateDuties({
      taricCode: '6109100000', customsValue: 100, origin: 'CN', preference: '100'
    });
    expect(r.duties.baseDutyRate).toBe(12);
    expect(r.duties.adValoremDuty).toBe(12);       // 100 * 12%
    expect(r.duties.totalDuty).toBe(12);
    expect(r.vat.base).toBe(112);                  // 100 + 12
    expect(r.vat.amount).toBe(23.52);              // 112 * 21%
    expect(r.totalToPay).toBe(135.52);             // 100 + 12 + 23.52
    expect(r.totalTaxes).toBe(35.52);              // 12 + 23.52
  });

  test('arancel especifico por peso (EUR/1000 kg) frente al ad valorem: gana el mayor', async () => {
    // Platanos 0803901000: thirdCountry 114 (%) y especifico 114 EUR/1000kg, IVA 10.
    // Valor 200 EUR, 500 kg. ad valorem = 200*114% = 228. especifico = 0.5*114 = 57.
    // totalDuty = max(228, 57) = 228.
    const r = await taric.calculateDuties({
      taricCode: '0803901000', customsValue: 200, origin: 'EC', preference: '100', netWeight: 500
    });
    expect(r.duties.adValoremDuty).toBe(228);
    expect(r.duties.specificDuty).toBe(57);
    expect(r.duties.totalDuty).toBe(228); // el mayor
    expect(r.vat.rate).toBe(10);
    expect(r.vat.amount).toBe(42.8);      // (200+228)*10%
  });

  test('arancel especifico por hectolitro (EUR/hl) usando quantity en litros', async () => {
    // Vino 2204210000: thirdCountry 32, especifico 32 EUR/hl, IVA 21,
    // specialTaxes alcohol rate 0 EUR/hl. Valor 50 EUR, 200 litros (=2 hl).
    // ad valorem = 50*32% = 16. especifico = (200/100)*32 = 64. totalDuty = 64.
    const r = await taric.calculateDuties({
      taricCode: '2204210000', customsValue: 50, origin: 'CL', preference: '100', quantity: 200
    });
    expect(r.duties.adValoremDuty).toBe(16);
    expect(r.duties.specificDuty).toBe(64);
    expect(r.duties.totalDuty).toBe(64);
    // impuesto especial alcohol rate 0 -> 0 EUR
    expect(r.specialTaxes).toEqual([{ type: 'alcohol', amount: 0 }]);
    expect(r.totalSpecialTaxes).toBe(0);
  });

  test('impuesto especial porcentual (matriculacion) sobre el valor en aduana', async () => {
    // Coche 8703230000: arancel 10%, IVA 21%, matriculacion 4.75%. Valor 10000.
    const r = await taric.calculateDuties({
      taricCode: '8703230000', customsValue: 10000, origin: 'JP', preference: '100', quantity: 1
    });
    expect(r.duties.totalDuty).toBe(1000);           // 10%
    expect(r.specialTaxes).toEqual([{ type: 'matriculacion', amount: 475 }]); // 10000 * 4.75%
    expect(r.totalSpecialTaxes).toBe(475);
    // total = 10000 + 1000 + IVA + 475 ; IVA = (10000+1000)*21% = 2310
    expect(r.vat.amount).toBe(2310);
    expect(r.totalToPay).toBe(13785);
  });

  test('preferencia aplicada anula el arancel para un origen elegible', async () => {
    // Camiseta 12% desde Japon con acuerdo 300 (EU-Japan, reduction 100%).
    const r = await taric.calculateDuties({
      taricCode: '6109100000', customsValue: 100, origin: 'JP', preference: '300'
    });
    expect(r.duties.baseDutyRate).toBe(0);           // 12 * (1 - 1) = 0
    expect(r.duties.adValoremDuty).toBe(0);
    expect(r.preferenceApplied).toMatchObject({ code: '300', name: 'Acuerdos de libre comercio' });
    expect(r.vat.amount).toBe(21);                   // solo IVA sobre 100
  });

  test('preferencia NO aplicada si el origen no es elegible: se paga el arancel general y avisa', async () => {
    // EE.UU. no tiene acuerdo 300 -> se cobra el 12% y warnings avisa.
    const r = await taric.calculateDuties({
      taricCode: '6109100000', customsValue: 100, origin: 'US', preference: '300'
    });
    expect(r.duties.baseDutyRate).toBe(12);
    expect(r.preferenceApplied).toBeNull();
    expect(r.warnings.some(w => /no tiene derecho/i.test(w))).toBe(true);
  });

  test('codigo inexistente lanza error explicito', async () => {
    await expect(taric.calculateDuties({
      taricCode: '0000000000', customsValue: 100, origin: 'CN'
    })).rejects.toThrow(/no encontrado/i);
  });
});

describe('getRequiredDocuments', () => {
  test('siempre exige factura, packing list y transporte', async () => {
    const r = await taric.getRequiredDocuments('8471300000', 'CN');
    const codes = r.documents.map(d => d.code);
    expect(codes).toEqual(expect.arrayContaining(['N380', 'N714', 'N785']));
  });

  test('producto agricola desde origen de riesgo exige certificado fitosanitario', async () => {
    // Platanos (cap 08 <= 24) desde Ecuador -> C400 obligatorio.
    const r = await taric.getRequiredDocuments('0803901000', 'EC');
    const c400 = r.documents.find(d => d.code === 'C400');
    expect(c400).toBeDefined();
    expect(c400.mandatory).toBe(true);
    expect(c400.authority).toBe('SOIVRE');
  });

  test('producto de origen animal exige documento veterinario', async () => {
    // Cap 02 (carne) -> N851 (DVE). getRequiredDocuments corta antes si el
    // codigo no se resuelve, asi que insertamos la carne en la BD local (no
    // esta en el catalogo comun, que arranca en el cap 08).
    await TaricCode.create({
      code: '0201100000',
      description: { es: 'Carne de bovino', en: 'Beef' },
      duties: { thirdCountry: 12.8 }, vat: { applicable: 10 },
      level: 10, isLeaf: true, isActive: true
    });
    const r = await taric.getRequiredDocuments('0201100000', 'AR');
    expect(r.documents.some(d => d.code === 'N851')).toBe(true);
  });

  test('textil desde origen bajo vigilancia genera warning', async () => {
    // Cap 61 (50-63) desde China -> aviso de vigilancia textil.
    const r = await taric.getRequiredDocuments('6109100000', 'CN');
    expect(r.warnings.some(w => /vigilancia textil/i.test(w))).toBe(true);
  });

  test('electronica (cap 85) exige marcado CE', async () => {
    const r = await taric.getRequiredDocuments('8517120000', 'CN');
    expect(r.documents.some(d => d.code === 'Y922')).toBe(true);
  });

  test('codigo no encontrado devuelve aviso, no error', async () => {
    const r = await taric.getRequiredDocuments('0000000000', 'CN');
    expect(r.documents).toEqual([]);
    expect(r.warnings[0]).toMatch(/no encontrado/i);
  });
});

describe('searchByDescription', () => {
  test('devuelve resultados locales cuando la BD tiene coincidencias', async () => {
    await TaricCode.create({
      code: '6109100000',
      description: { es: 'Camiseta de algodon', en: 'Cotton t-shirt' },
      keywords: ['camiseta', 'algodon'],
      duties: { thirdCountry: 12 }, vat: { applicable: 21 },
      level: 10, isLeaf: true, isActive: true
    });
    const r = await taric.searchByDescription('camiseta', { limit: 5 });
    expect(r.source).toBe('local');
    expect(r.results.length).toBeGreaterThan(0);
  });

  test('sin local, cae al catalogo comun', async () => {
    const r = await taric.searchByDescription('platanos', { limit: 5 });
    expect(r.source).toBe('common');
    expect(r.results.some(x => x.code === '0803901000')).toBe(true);
  });

  test('sin local ni comun ni API, devuelve source none con mensaje', async () => {
    const r = await taric.searchByDescription('zxqwv-inexistente', { limit: 5 });
    expect(r.source).toBe('none');
    expect(r.results).toEqual([]);
    expect(r.message).toMatch(/No se encontraron/i);
  });

  test('sin local ni comun, si la API responde, usa eu_api', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ code: '1234567890', description: 'algo', duties: { thirdCountry: 2 } }]
    });
    const r = await taric.searchByDescription('zxqwv-inexistente', { limit: 5 });
    expect(r.source).toBe('eu_api');
    expect(r.results[0].code).toBe('1234567890');
  });
});

describe('getAvailablePreferences — ramas de acuerdo por tipo', () => {
  test('un pais del SPG (200) obtiene la preferencia de paises menos desarrollados', () => {
    const prefs = taric.getAvailablePreferences('BD'); // Bangladesh
    expect(prefs.some(p => p.code === '200')).toBe(true);
  });

  test('un pais de union aduanera (400) obtiene esa preferencia', () => {
    const prefs = taric.getAvailablePreferences('TR'); // Turquia
    expect(prefs.some(p => p.code === '400')).toBe(true);
  });
});
