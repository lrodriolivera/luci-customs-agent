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

jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/cacheService', () => ({ getCache: () => mockCache }));
jest.mock('../../src/models/TaricCode', () => ({ findOne: jest.fn() }));
jest.mock('../../src/models/TaricAICache', () => ({ getFromCache: jest.fn(), saveToCache: jest.fn() }));

const TaricCode = require('../../src/models/TaricCode');
const TaricAICache = require('../../src/models/TaricAICache');
const { getDutyInfo } = require('../../src/services/dutyCalculationService');

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
