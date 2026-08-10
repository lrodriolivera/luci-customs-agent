/**
 * Tests para dutyCalculationService (estaba al 0%).
 *
 * Calcula lo que el importador acaba pagando, asi que un error aqui se traduce
 * en dinero mal liquidado ante la AEAT. Se cubren los tipos de IVA por capitulo
 * TARIC —contrastados con la Ley 37/1992— y la precedencia de las fuentes de
 * datos (cache -> BD local -> cache IA).
 *
 * getVATRateByChapter es interna: se ejercita a traves de getDutyInfo, que es
 * la via real de acceso y ademas cubre el flujo completo.
 *
 * Los codigos TARIC son reales; ninguno esta inventado.
 */

const mockCache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

jest.mock('../../src/services/aiService', () => ({ callClaude: jest.fn() }));
jest.mock('../../src/services/cacheService', () => ({ getCache: () => mockCache }));
jest.mock('../../src/models/TaricCode', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../../src/models/TaricAICache', () => ({ getFromCache: jest.fn(), saveToCache: jest.fn() }));

const TaricCode = require('../../src/models/TaricCode');
const TaricAICache = require('../../src/models/TaricAICache');
const aiService = require('../../src/services/aiService');
const {
  getDutyInfo,
  calculateDutiesWithAI,
  getArancelesFromAI,
  validateDutyRate
} = require('../../src/services/dutyCalculationService');

/** Simula que el codigo existe en la BD local con un arancel conocido. */
function enBDLocal(code, dutyRate = 12) {
  TaricCode.findOne.mockResolvedValue({
    code,
    description: { es: 'descripcion' },
    duties: { thirdCountry: dutyRate },
    measures: [],
    requiredDocuments: [],
    preferences: []
  });
}

/**
 * Simula un codigo con el derecho punitivo de Rusia/Bielorrusia separado del
 * arancel general, tal y como queda tras repoblar desde el TARIC oficial.
 */
function conSancion(code, general, punitivo) {
  TaricCode.findOne.mockResolvedValue({
    code,
    description: { es: 'descripcion' },
    duties: {
      thirdCountry: general,
      sancionRusiaBielorrusia: { adValorem: punitivo, certificado: 'Y155' },
      origen: { fuente: 'taric_oficial', metodo: 'condiciones_de_medida' }
    },
    measures: [],
    requiredDocuments: [],
    preferences: []
  });
}

/** Devuelve el tipo de IVA que getDutyInfo asigna a un codigo. */
async function ivaDe(code) {
  enBDLocal(code);
  return (await getDutyInfo(code)).vatRate;
}

describe('dutyCalculationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);      // sin cache por defecto
    TaricAICache.getFromCache.mockResolvedValue(null);
  });

  describe('IVA superreducido 4% (Art. 91.Dos Ley 37/1992)', () => {
    test.each([
      ['0701900000', 'patatas frescas (cap. 07 hortalizas)'],
      ['0805100000', 'naranjas (cap. 08 frutas)'],
      ['1001990000', 'trigo (cap. 10 cereales)'],
      ['3004900000', 'medicamentos (cap. 30 farmaceuticos)']
    ])('%s -> 4%% — %s', async (code) => {
      expect(await ivaDe(code)).toBe(4);
    });

    test('leche y huevos van al 4% por partida, no por su capitulo', async () => {
      // El cap. 04 figura en la lista del 10%, pero 0401 y 0407 se rescatan al 4%.
      expect(await ivaDe('0401200000')).toBe(4); // leche sin concentrar
      expect(await ivaDe('0407210000')).toBe(4); // huevos con cascara
    });

    test('el pan comun va al 4%', async () => {
      expect(await ivaDe('1905900000')).toBe(4);
    });
  });

  describe('IVA reducido 10% (Art. 91.Uno Ley 37/1992)', () => {
    test.each([
      ['0201100000', 'carne de vacuno (cap. 02)'],
      ['0302110000', 'pescado fresco (cap. 03)'],
      ['0901210000', 'cafe tostado (cap. 09)'],
      ['1509100000', 'aceite de oliva virgen (cap. 15)'],
      ['2201100000', 'agua mineral (partida 2201)']
    ])('%s -> 10%% — %s', async (code) => {
      expect(await ivaDe(code)).toBe(10);
    });
  });

  describe('IVA general 21% (Art. 90 Ley 37/1992)', () => {
    test('las bebidas alcoholicas del cap. 22 tributan al 21%, no al 10%', async () => {
      // El capitulo 22 esta en la lista del 10% por el agua; el vino, la cerveza
      // y los destilados son la excepcion explicita.
      expect(await ivaDe('2203000000')).toBe(21); // cerveza
      expect(await ivaDe('2204100000')).toBe(21); // vino espumoso
      expect(await ivaDe('2208300000')).toBe(21); // whisky
    });

    test.each([
      ['6109100010', 'camisetas de algodon (cap. 61)'],
      ['8471300000', 'ordenadores portatiles (cap. 84)'],
      ['9403600000', 'muebles de madera (cap. 94)']
    ])('%s -> 21%% — %s', async (code) => {
      expect(await ivaDe(code)).toBe(21);
    });

    test('el tipo nunca sale fuera de los tres legales en Espana', async () => {
      for (const c of ['0701900000', '0201100000', '6109100010', '2204100000']) {
        expect([4, 10, 21]).toContain(await ivaDe(c));
      }
    });
  });

  describe('precedencia de fuentes de datos', () => {
    test('el cache compartido gana: no toca la BD', async () => {
      mockCache.get.mockResolvedValue({ code: '6109100010', dutyRate: 12, vatRate: 21 });

      const r = await getDutyInfo('6109100010');

      expect(r.source).toBe('shared_cache');
      expect(TaricCode.findOne).not.toHaveBeenCalled();
    });

    test('sin cache usa la BD local y cachea el resultado', async () => {
      enBDLocal('6109100010', 12);

      const r = await getDutyInfo('6109100010');

      expect(r.source).toBe('local_db');
      expect(r.dutyRate).toBe(12);
      expect(mockCache.set).toHaveBeenCalled(); // no repetir la consulta
    });

    test('cae al cache de IA cuando el codigo no esta en la BD', async () => {
      TaricCode.findOne.mockResolvedValue(null);
      TaricAICache.getFromCache.mockResolvedValue({
        aiResponse: { dutyRate: '6.5', description_es: 'via IA' },
        hits: 3,
        updatedAt: new Date()
      });

      const r = await getDutyInfo('6109100010');

      expect(r.source).toBe('ai_cache');
      expect(r.dutyRate).toBe(6.5); // el string del cache se convierte a numero
    });

    /**
     * `duties.specific` es un objeto anidado en linea y **Mongoose SIEMPRE lo
     * materializa como {}** aunque en Mongo no exista. Como {} es truthy, el
     * ternario `duties.specific ? 'mixed' : 'ad_valorem'` marcaba 'mixed' a los
     * ~19.900 codigos del catalogo SIN derecho especifico (21.946 - 2.032).
     * Detectado el 10/Ago/2026 en la calculadora: el TARIC 8471300000
     * (portatiles, arancel MFN 0%) salia como "Tipo de Arancel: Mixed".
     *
     * Importa porque con 'mixed' el importe pasa a `Math.max(adValorem, especifico)`:
     * el arancel deja de ser el ad valorem en cuanto haya un especifico mal leido.
     */
    test('sin importe especifico el arancel es ad valorem, no mixto', async () => {
      TaricCode.findOne.mockResolvedValue({
        code: '8471300000',
        description: { es: 'Portatiles' },
        // Asi es como Mongoose entrega el subdocumento cuando en Mongo NO hay
        // derecho especifico: el contenedor existe y esta vacio.
        duties: { thirdCountry: 0, specific: {} },
        measures: [], requiredDocuments: [], preferences: []
      });

      const r = await getDutyInfo('8471300000');

      expect(r.dutyType).toBe('ad_valorem');
      expect(r.specificDuty).toBeNull();
    });

    test('con importe especifico si es mixto y conserva el importe', async () => {
      // 2204210000 (vino embotellado): 32 EUR/hl ademas del ad valorem. Real.
      TaricCode.findOne.mockResolvedValue({
        code: '2204210000',
        description: { es: 'Vino' },
        duties: { thirdCountry: 50, specific: { amount: 32, unit: 'EUR/hl' } },
        measures: [], requiredDocuments: [], preferences: []
      });

      const r = await getDutyInfo('2204210000');

      expect(r.dutyType).toBe('mixed');
      expect(r.specificDuty).toEqual({ amount: 32, unit: 'EUR/hl' });
    });

    /**
     * El 50% de estos codigos NO era el arancel general: es el derecho punitivo
     * del Reg. (UE) 2024/1392 contra Rusia y Bielorrusia, que en TARIC es la
     * rama de la medida condicionada al certificado Y155. Guardado en
     * `duties.thirdCountry` se cobraba a cualquier origen: un contenedor de
     * aceite de soja argentino se liquidaba al 50% en vez de al 6,40%.
     */
    test('el derecho punitivo RU/BY no se aplica a un origen no sancionado', async () => {
      conSancion('1507109000', 6.4, 50);

      const r = await getDutyInfo('1507109000', 'AR');

      expect(r.dutyRate).toBe(6.4);
      expect(r.sanction).toMatchObject({ adValorem: 50, applied: false });
    });

    test('el derecho punitivo sustituye al general cuando el origen es Rusia', async () => {
      conSancion('1507109000', 6.4, 50);

      const r = await getDutyInfo('1507109000', 'RU');

      expect(r.dutyRate).toBe(50);
      expect(r.sanction.applied).toBe(true);
      expect(r.warnings[0]).toMatch(/2024\/1392/);
    });

    test('lo mismo con Bielorrusia, y en minusculas', async () => {
      conSancion('1507109000', 6.4, 50);

      const r = await getDutyInfo('1507109000', 'by');

      expect(r.dutyRate).toBe(50);
      expect(r.sanction.applied).toBe(true);
    });

    test('sin origen declarado aplica el general pero AVISA del punitivo', async () => {
      // No se puede afirmar ni descartar la sancion: elegir en silencio es lo que
      // hacia que el importe liquidado no se pudiera justificar.
      conSancion('1507109000', 6.4, 50);

      const r = await getDutyInfo('1507109000');

      expect(r.dutyRate).toBe(6.4);
      expect(r.warnings.join(' ')).toMatch(/Rusia o Bielorrusia/);
    });

    test('un codigo sin sancion no genera aviso ni campo', async () => {
      enBDLocal('6109100010', 12);

      const r = await getDutyInfo('6109100010');

      expect(r.sanction).toBeNull();
      expect(r.warnings).toEqual([]);
    });

    test('expone la procedencia del arancel', async () => {
      TaricCode.findOne.mockResolvedValue({
        code: '1507109000',
        description: { es: 'Aceite de soja' },
        duties: {
          thirdCountry: 6.4,
          origen: { fuente: 'taric_oficial', metodo: 'condiciones_de_medida' }
        },
        measures: [], requiredDocuments: [], preferences: []
      });

      const r = await getDutyInfo('1507109000');

      expect(r.dutyOrigin.fuente).toBe('taric_oficial');
    });

    test('la clave de cache separa por origen (el arancel preferencial difiere)', async () => {
      enBDLocal('6109100010');

      await getDutyInfo('6109100010', 'CN');
      await getDutyInfo('6109100010', 'MA');

      const claves = mockCache.get.mock.calls.map(c => c[0]);
      expect(claves[0]).not.toBe(claves[1]);
    });
  });

  describe('normalizacion del codigo', () => {
    test('espacios y puntos no cambian el resultado', async () => {
      // La UI y los ficheros de cliente traen el codigo formateado de formas distintas.
      expect(await ivaDe('0805.10.00.00')).toBe(await ivaDe('0805100000'));
      expect(await ivaDe('0805 10 00 00')).toBe(4);
    });
  });
});

/**
 * calculateDutiesWithAI es el calculo final: sobre la informacion de aranceles
 * aplica estacionalidad, preferencias, antidumping, arancel especifico/mixto e
 * IVA por capitulo, y produce los totales que se liquidan ante la AEAT.
 *
 * Se hace que getArancelesFromAI (via aiService.callClaude) devuelva el JSON que
 * cada rama necesita; getSeasonalTariff usa los datos REALES de
 * src/data/seasonalTariffs (no se mockea: es logica bajo prueba). Cada caso usa
 * un codigo distinto y el cache esta vacio por el beforeEach de arriba mas el de
 * aqui, para que no se acarreen resultados entre tests.
 */
function iaDevuelve(json) {
  // getArancelesFromAI espera { content } del cliente Claude.
  aiService.callClaude.mockResolvedValue({ content: JSON.stringify(json) });
}

describe('calculateDutiesWithAI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    TaricCode.findOne.mockResolvedValue(null);       // sin BD local -> rama IA
    TaricCode.findOneAndUpdate.mockResolvedValue({});
    TaricAICache.getFromCache.mockResolvedValue(null);
    TaricAICache.saveToCache.mockResolvedValue({});
  });

  describe('ad valorem e IVA por capitulo', () => {
    test('cap 84 al 0%: IVA 21%, base sin arancel, totales cuadran', async () => {
      iaDevuelve({ dutyRateNumeric: 0, dutyType: 'ad_valorem', description_es: 'Servidor' });

      const r = await calculateDutiesWithAI({ taricCode: '8471300000', customsValue: 1000, origin: 'CN' });

      expect(r.duties.adValoremDuty).toBe(0);
      expect(r.vat.rate).toBe(21);
      expect(r.vat.base).toBe(1000);
      expect(r.vat.amount).toBe(210);
      expect(r.totalToPay).toBe(1210);
    });

    test('textil cap 61 al 12%: el IVA grava customsValue + arancel', async () => {
      iaDevuelve({ dutyRateNumeric: 12, dutyType: 'ad_valorem' });

      const r = await calculateDutiesWithAI({ taricCode: '6109100010', customsValue: 1000, origin: 'IN' });

      expect(r.duties.adValoremDuty).toBe(120);
      expect(r.duties.totalDuty).toBe(120);
      expect(r.vat.base).toBe(1120);
      expect(r.vat.amount).toBe(235.2);
      expect(r.totalToPay).toBe(1355.2);
    });
  });

  describe('preferencias arancelarias', () => {
    test('SPG (200): aplica la tasa reducida y calcula la reduccion', async () => {
      iaDevuelve({
        dutyRateNumeric: 12,
        dutyType: 'ad_valorem',
        preferences: [{ agreement: 'SPG Vietnam', countries: ['VN'], rate: 0, certificate: 'FORM A' }]
      });

      const r = await calculateDutiesWithAI({ taricCode: '6203420000', customsValue: 1000, origin: 'VN', preference: '200' });

      expect(r.preferenceApplied.reduction).toBe(12);
      expect(r.duties.effectiveDutyRate).toBe(0);
    });

    test('por pais (countries incluye origin) aunque el codigo de preferencia no case', async () => {
      iaDevuelve({
        dutyRateNumeric: 10,
        dutyType: 'ad_valorem',
        preferences: [{ agreement: 'Acuerdo bilateral', countries: ['MX'], rate: 2.5 }]
      });

      const r = await calculateDutiesWithAI({ taricCode: '8703230000', customsValue: 1000, origin: 'MX', preference: '300' });

      expect(r.duties.effectiveDutyRate).toBe(2.5);
      expect(r.preferenceApplied.reduction).toBe(7.5);
    });

    test('preference=100 (erga omnes) ignora las preferencias', async () => {
      iaDevuelve({
        dutyRateNumeric: 12,
        dutyType: 'ad_valorem',
        preferences: [{ agreement: 'SPG', countries: ['VN'], rate: 0 }]
      });

      const r = await calculateDutiesWithAI({ taricCode: '6109909000', customsValue: 1000, origin: 'VN', preference: '100' });

      expect(r.preferenceApplied).toBeNull();
      expect(r.duties.effectiveDutyRate).toBe(12);
    });
  });

  describe('antidumping', () => {
    test('suma el antidumping cuando aplica al origen y avisa', async () => {
      iaDevuelve({
        dutyRateNumeric: 0,
        dutyType: 'ad_valorem',
        antidumping: { applies: true, countries: ['CN'], additionalRate: 30 }
      });

      const r = await calculateDutiesWithAI({ taricCode: '7307930000', customsValue: 1000, origin: 'CN' });

      expect(r.duties.antidumpingDuty).toBe(300);
      expect(r.duties.totalDuty).toBe(300);
      expect(r.warnings.some(w => /antidumping/i.test(w))).toBe(true);
    });

    test('no suma antidumping si el origen no esta en la lista', async () => {
      iaDevuelve({
        dutyRateNumeric: 0,
        dutyType: 'ad_valorem',
        antidumping: { applies: true, countries: ['CN'], additionalRate: 30 }
      });

      const r = await calculateDutiesWithAI({ taricCode: '7307910000', customsValue: 1000, origin: 'TR' });

      expect(r.duties.antidumpingDuty).toBe(0);
    });
  });

  describe('arancel especifico y mixto', () => {
    test('specific por kg usa netWeight/1000', async () => {
      iaDevuelve({ dutyRateNumeric: 0, dutyType: 'specific', specificDuty: { amount: 50, unit: 'EUR/1000 kg' } });

      const r = await calculateDutiesWithAI({ taricCode: '1701140000', customsValue: 1000, origin: 'BR', netWeight: 2000 });

      expect(r.duties.specificDuty).toBe(100);
      expect(r.duties.totalDuty).toBe(100);
    });

    test('specific por unidad (p/st) usa quantity', async () => {
      iaDevuelve({ dutyRateNumeric: 0, dutyType: 'specific', specificDuty: { amount: 3, unit: 'EUR/p/st' } });

      const r = await calculateDutiesWithAI({ taricCode: '8506100000', customsValue: 1000, origin: 'CN', quantity: 40 });

      expect(r.duties.specificDuty).toBe(120);
    });

    test('specific por hl usa quantity/100', async () => {
      iaDevuelve({ dutyRateNumeric: 0, dutyType: 'specific', specificDuty: { amount: 10, unit: 'EUR/hl' } });

      const r = await calculateDutiesWithAI({ taricCode: '2204210000', customsValue: 1000, origin: 'CL', quantity: 500 });

      expect(r.duties.specificDuty).toBe(50);
    });

    test('mixed toma el mayor entre ad valorem y especifico', async () => {
      iaDevuelve({ dutyRateNumeric: 5, dutyType: 'mixed', specificDuty: { amount: 80, unit: 'EUR/100 kg' } });

      // 2005 (conservas de hortalizas) NO es estacional: la tasa de la IA se respeta.
      const r = await calculateDutiesWithAI({ taricCode: '2005800000', customsValue: 1000, origin: 'BR', netWeight: 1000 });

      expect(r.duties.adValoremDuty).toBe(50);
      expect(r.duties.specificDuty).toBe(80);
      expect(r.duties.totalDuty).toBe(80);
    });
  });

  describe('arancel estacional (datos reales)', () => {
    test('tomate (0702) en enero: usa la tasa estacional y avisa de estacional + precio de entrada', async () => {
      // getArancelesFromAI daria 20%, pero la estacional del periodo debe ganar.
      iaDevuelve({ dutyRateNumeric: 20, dutyType: 'ad_valorem' });

      const r = await calculateDutiesWithAI({
        taricCode: '0702000000',
        customsValue: 1000,
        origin: 'MA',
        importDate: '2026-01-15'
      });

      expect(r.seasonal).not.toBeNull();
      expect(r.seasonal.isSeasonal).toBe(true);
      expect(r.duties.effectiveDutyRate).toBe(8.8);
      expect(r.warnings.some(w => /estacional/i.test(w))).toBe(true);
      expect(r.warnings.some(w => /precios de entrada/i.test(w))).toBe(true);
    });
  });

  describe('warnings de cuota, unidad suplementaria y confianza', () => {
    test('quota, supplementaryUnit y confidence<90 producen sus avisos', async () => {
      iaDevuelve({
        dutyRateNumeric: 5,
        dutyType: 'ad_valorem',
        quota: { applies: true, description: 'Contingente 2026' },
        supplementaryUnit: { required: true, description: 'Numero de pares' },
        confidence: 70
      });

      const r = await calculateDutiesWithAI({ taricCode: '6403590000', customsValue: 1000, origin: 'VN' });

      expect(r.warnings.some(w => /contingente/i.test(w))).toBe(true);
      expect(r.warnings.some(w => /suplementarias/i.test(w))).toBe(true);
      expect(r.warnings.some(w => /estimado/i.test(w))).toBe(true);
      expect(r.confidence).toBe(70);
    });
  });

  describe('fallback estimado por capitulo', () => {
    test('codigo desconocido cae al estimado (5% / IVA 21% por defecto)', async () => {
      aiService.callClaude.mockResolvedValue({ content: 'no es json' });

      const r = await calculateDutiesWithAI({ taricCode: '9999999999', customsValue: 100, origin: 'CN' });

      expect(r.duties.effectiveDutyRate).toBe(5);
      expect(r.vat.rate).toBe(21);
      expect(r.source).toBe('estimated');
    });
  });
});

describe('getArancelesFromAI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    TaricCode.findOne.mockResolvedValue(null);
    TaricAICache.getFromCache.mockResolvedValue(null);
  });

  test('parsea JSON envuelto en bloque markdown y usa dutyRateNumeric', async () => {
    aiService.callClaude.mockResolvedValue({
      content: '```json\n{"dutyRateNumeric": 8, "dutyType": "ad_valorem", "description_es": "X"}\n```'
    });

    const r = await getArancelesFromAI('6109100010');

    expect(r.dutyRate).toBe(8);
    expect(r.vatRate).toBe(21);
    expect(r.source).toBe('ai_realtime');
  });

  test('devuelve null si la IA no incluye dutyRate', async () => {
    aiService.callClaude.mockResolvedValue({ content: '{"description_es": "X"}' });
    expect(await getArancelesFromAI('6109100010')).toBeNull();
  });

  test('devuelve null si la respuesta no es JSON', async () => {
    aiService.callClaude.mockResolvedValue({ content: 'texto libre' });
    expect(await getArancelesFromAI('6109100010')).toBeNull();
  });
});

/**
 * updateLocalDatabase es interna: se ejercita por su unica via real, un
 * getDutyInfo que acaba resolviendo con la IA y persiste el resultado.
 */
describe('persistencia del arancel obtenido por IA', () => {
  /** Mock de `TaricCode.findOne(...).select(...).lean()`. */
  const conOrigenExistente = (origen) => {
    TaricCode.findOne.mockImplementation(() => ({
      select: () => ({ lean: async () => (origen ? { duties: { origen } } : null) })
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    TaricAICache.getFromCache.mockResolvedValue(null);
    TaricAICache.saveToCache.mockResolvedValue(null);
    TaricCode.findOneAndUpdate.mockResolvedValue({});
    aiService.callClaude.mockResolvedValue({
      content: '{"dutyRateNumeric": 8, "dutyType": "ad_valorem", "description_es": "X"}'
    });
  });

  /**
   * Asignar `duties: { thirdCountry }` REEMPLAZA el subdocumento entero en
   * Mongo: se llevaba por delante el derecho especifico, la procedencia y el
   * recargo por sanciones. Verificado contra la BD real: tras el update solo
   * quedaba `thirdCountry`. Por eso se escriben rutas puntuales.
   */
  test('escribe rutas puntuales de duties, sin reemplazar el subdocumento', async () => {
    // La primera llamada (busqueda del codigo) devuelve null; la segunda es el
    // findOne().select().lean() de updateLocalDatabase.
    let n = 0;
    TaricCode.findOne.mockImplementation(() => {
      n++;
      if (n === 1) return Promise.resolve(null);
      return { select: () => ({ lean: async () => null }) };
    });

    await getDutyInfo('1507109000');

    const update = TaricCode.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set['duties.thirdCountry']).toBe(8);
    expect(update.duties).toBeUndefined();
  });

  test('no degrada a estimacion de IA un arancel del TARIC oficial', async () => {
    let n = 0;
    TaricCode.findOne.mockImplementation(() => {
      n++;
      if (n === 1) return Promise.resolve(null); // no estaba al buscarlo...
      // ...pero al ir a escribir ya se habia repoblado desde la fuente oficial.
      return { select: () => ({ lean: async () => ({ duties: { origen: { fuente: 'taric_oficial' } } }) }) };
    });

    await getDutyInfo('1507109000');

    expect(TaricCode.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('marca como procedente de IA el arancel que persiste', async () => {
    conOrigenExistente(null);
    TaricCode.findOne.mockImplementationOnce(() => Promise.resolve(null));

    await getDutyInfo('1507109000');

    const update = TaricCode.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set['duties.origen'].fuente).toBe('ia');
  });
});

describe('validateDutyRate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve el JSON de validacion de la IA', async () => {
    aiService.callClaude.mockResolvedValue({ content: '{"isCorrect": true, "correctRate": 12, "confidence": 90}' });

    const r = await validateDutyRate('6109100010', 12);

    expect(r.isCorrect).toBe(true);
    expect(r.correctRate).toBe(12);
  });

  test('devuelve null si la IA falla al parsear', async () => {
    aiService.callClaude.mockResolvedValue({ content: 'no json' });
    expect(await validateDutyRate('6109100010', 12)).toBeNull();
  });
});
