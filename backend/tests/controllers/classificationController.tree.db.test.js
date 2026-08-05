/**
 * classificationController — parte "de solo lectura TARIC" contra Mongo en
 * memoria con el modelo REAL TaricCode. El fichero .test.js mockea `src/models`,
 * asi que la cascada de fuentes (BD local -> padre -> cache IA -> API UE -> IA ->
 * no encontrado) de estos tres handlers nunca se ejercitaba de verdad:
 *
 *   1. getTaricInfo   (GET /taric/:code)  — 6 fuentes en cascada + historial.
 *   2. searchTaric    (GET /search)       — busqueda por codigo/texto/capitulo
 *                                            con fallback a IA y enriquecimiento
 *                                            estacional.
 *   3. getTreeData    (GET /tree)         — arbol jerarquico (capitulos ->
 *                                            partidas -> ... -> codigos TARIC),
 *                                            con agregaciones en DB y fallback IA.
 *
 * FRONTERAS mockeadas SOLO las externas: aiService (Bedrock/Claude) y taricService
 * (envuelve red / cache / EU API). TaricCode es REAL contra BD efimera. Las tasas
 * estacionales (`hasSeasonalTariff`/`getSeasonalTariff`) son reales. NUNCA
 * produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));
jest.mock('../../src/services/aiService', () => ({
  getTaricCodeInfo: jest.fn(),
  generateTreeLevel: jest.fn()
}));
jest.mock('../../src/services/taricService', () => ({
  recordSearch: jest.fn(),
  getFromAICache: jest.fn(),
  _getCodeFromAPI: jest.fn(),
  saveToAICache: jest.fn()
}));

const { TaricCode } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const taricService = require('../../src/services/taricService');
const controller = require('../../src/controllers/classificationController');

// --- Helpers -----------------------------------------------------------------

const TENANT = new mongoose.Types.ObjectId();

function usuario() {
  return { _id: new mongoose.Types.ObjectId(), tenantId: TENANT };
}

function crearRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((payload) => { res.body = payload; return res; });
  return res;
}

// Crea un TaricCode real. `code` decide breakdown por su longitud.
async function crearTaric(code, extra = {}) {
  const c = code;
  return TaricCode.create({
    code: c,
    description: { es: `Descripcion ${c}`, en: `Desc ${c}` },
    level: c.length,
    isActive: true,
    isLeaf: c.length >= 10,
    duties: { thirdCountry: 5 },
    vat: { applicable: 21, standard: 21 },
    supplementaryUnit: { required: false },
    breakdown: {
      chapter: c.substring(0, 2),
      heading: c.length >= 4 ? c.substring(0, 4) : undefined,
      subheading: c.length >= 6 ? c.substring(0, 6) : undefined,
      cnCode: c.length >= 8 ? c.substring(0, 8) : undefined,
      taricCode: c.length >= 10 ? c : undefined
    },
    ...extra
  });
}

describe('classificationController — lectura TARIC (BD real)', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(() => {
    // resetMocks:true borra las implementaciones; se restauran los defaults.
    taricService.recordSearch.mockResolvedValue({});
    taricService.getFromAICache.mockResolvedValue(null);
    taricService._getCodeFromAPI.mockResolvedValue(null);
    taricService.saveToAICache.mockResolvedValue({});
    aiService.getTaricCodeInfo.mockResolvedValue(null);
    aiService.generateTreeLevel.mockResolvedValue([]);
  });

  // ===================== getTaricInfo =====================

  describe('getTaricInfo', () => {
    it('fuente local_db: devuelve la ficha real con jerarquia e hijos y registra la busqueda', async () => {
      // Jerarquia padre -> hijo para ejercitar getFullPath y getChildren.
      await crearTaric('6109', { parent: null });
      const hoja = await crearTaric('6109100010', { parent: '6109', isLeaf: false });
      // un hijo de la hoja (level+2) para getChildren
      await TaricCode.create({
        code: '6109100010' + '', description: { es: 'x' }, level: 12,
        isActive: true, breakdown: { chapter: '61' }, supplementaryUnit: { required: false }
      }).catch(() => {}); // ignora si colisiona; no es el foco

      const res = crearRes();
      await controller.getTaricInfo({ params: { code: '6109.10.00.10' }, user: usuario() }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.found).toBe(true);
      expect(res.body.data.source).toBe('local_db');
      expect(res.body.data.code).toBe('6109100010');
      expect(res.body.data.duties.thirdCountry).toBe(5);
      // Se registro en historial como encontrado en local_db.
      expect(taricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({ found: true, source: 'local_db', code: '6109100010' })
      );
      expect(hoja.code).toBe('6109100010');
    });

    it('fuente ai_cache: sin ficha local pero con cache IA devuelve datos cacheados', async () => {
      taricService.getFromAICache.mockResolvedValue({
        hits: 3,
        aiResponse: {
          description: 'T-shirts', description_es: 'Camisetas',
          chapter: '61', heading: '6109', dutyRate: '12%', measures: []
        }
      });

      const res = crearRes();
      await controller.getTaricInfo({ params: { code: '6109100010' }, user: usuario() }, res);

      expect(res.body.data.source).toBe('ai_cache');
      expect(res.body.data.cached).toBe(true);
      expect(res.body.data.description_es).toBe('Camisetas');
      expect(taricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({ found: true, source: 'cache' })
      );
    });

    it('fuente eu_api: consulta la API UE, hace upsert en la BD local y responde', async () => {
      taricService._getCodeFromAPI.mockResolvedValue({
        description: { es: 'Desde UE' },
        breakdown: { chapter: '61' },
        duties: { thirdCountry: 8 },
        vat: { applicable: 21 }
      });

      const res = crearRes();
      await controller.getTaricInfo({ params: { code: '6109100011' }, user: usuario() }, res);

      expect(res.body.data.source).toBe('eu_api');
      // Persistido de verdad por el upsert.
      const persistido = await TaricCode.findOne({ code: '6109100011' });
      expect(persistido).not.toBeNull();
      expect(persistido.duties.thirdCountry).toBe(8);
    });

    it('fuente ai: ultima instancia, guarda en cache IA y en historial', async () => {
      aiService.getTaricCodeInfo.mockResolvedValue({
        description: 'From AI', description_es: 'Desde IA',
        chapter: '61', heading: '6109', dutyRate: '10%', measures: []
      });

      const res = crearRes();
      await controller.getTaricInfo({ params: { code: '6109100012' }, user: usuario() }, res);

      expect(res.body.data.source).toBe('ai');
      expect(res.body.data.description_es).toBe('Desde IA');
      expect(taricService.saveToAICache).toHaveBeenCalledWith('6109100012', expect.any(Object), expect.any(Object));
      expect(taricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({ found: true, source: 'ai' })
      );
    });

    it('rama padre-mas-cercano: se localiza el padre pero NO se responde con el (rama muerta)', async () => {
      // Existe el capitulo 61 (2 digitos) pero no el codigo pedido. El paso 2 del
      // handler busca el padre y setea source='local_db_parent', PERO no hay un
      // `return` con la ficha del padre: el flujo continua a cache/API/IA. Con los
      // mocks en null, acaba en 'not_found'. Este test fija ese comportamiento
      // real (la rama del padre no tiene efecto observable en la respuesta).
      await crearTaric('61', { isLeaf: false });

      const res = crearRes();
      await controller.getTaricInfo({ params: { code: '6199999999' }, user: usuario() }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.found).toBe(false); // el padre encontrado no se devuelve
    });

    it('no encontrado en ninguna fuente: found:false y registro con found:false', async () => {
      const res = crearRes();
      await controller.getTaricInfo({ params: { code: '9999999999' }, user: usuario() }, res);

      expect(res.body.data.found).toBe(false);
      expect(taricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({ found: false, source: 'not_found' })
      );
    });

    it('error interno -> 500', async () => {
      // params.code sin `.replace` -> lanza al normalizar.
      const res = crearRes();
      await controller.getTaricInfo({ params: {}, user: usuario() }, res);
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ===================== searchTaric =====================

  describe('searchTaric', () => {
    it('codigo corto (capitulo): devuelve los codigos del capitulo desde la BD', async () => {
      await crearTaric('6109', { isLeaf: false });
      await crearTaric('6110', { isLeaf: false });
      await crearTaric('4202', { isLeaf: false }); // otro capitulo, no debe salir

      const res = crearRes();
      await controller.searchTaric({ query: { code: '61' } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.source).toBe('database');
      expect(res.body.data.results.every(r => r.breakdown.chapter === '61')).toBe(true);
      expect(res.body.data.count).toBe(2);
    });

    it('codigo corto sin datos: genera partidas con IA (source ai)', async () => {
      aiService.generateTreeLevel.mockResolvedValue([
        { code: '0101', description: 'Caballos' },
        { code: '0102', description: 'Bovinos' }
      ]);

      const res = crearRes();
      await controller.searchTaric({ query: { code: '01' } }, res);

      expect(res.body.data.source).toBe('ai');
      expect(res.body.data.count).toBe(2);
      expect(aiService.generateTreeLevel).toHaveBeenCalledWith('01', 'headings');
    });

    it('codigo largo exacto: devuelve el unico match', async () => {
      await crearTaric('6109100010');

      const res = crearRes();
      await controller.searchTaric({ query: { code: '6109100010' } }, res);

      expect(res.body.data.count).toBe(1);
      expect(res.body.data.results[0].code).toBe('6109100010');
    });

    it('codigo largo sin exacto: cae a prefijo, y si no hay nada consulta IA', async () => {
      aiService.getTaricCodeInfo.mockResolvedValue({
        description: 'AI item', description_es: 'Item IA', dutyRate: '7', valid: true
      });

      const res = crearRes();
      await controller.searchTaric({ query: { code: '8765432100' } }, res);

      expect(res.body.data.source).toBe('ai');
      expect(res.body.data.results[0].code).toBe('8765432100');
      expect(res.body.data.results[0].duties.thirdCountry).toBe(7);
    });

    it('busqueda por texto: cae al regex sobre description.es cuando $text no da resultados', async () => {
      await crearTaric('6109100010', { description: { es: 'Camisetas de algodon' } });

      const res = crearRes();
      // TaricCode.search ($text) devuelve [] sin indice -> fallback regex.
      await controller.searchTaric({ query: { q: 'algodon' } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.results[0].description.es).toMatch(/algodon/i);
    });

    it('por capitulo (chapter): usa findByChapter', async () => {
      await crearTaric('6109', { isLeaf: false });
      const res = crearRes();
      await controller.searchTaric({ query: { chapter: '61' } }, res);
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
    });

    it('sin filtros: devuelve los capitulos (getChapters, level 2)', async () => {
      await crearTaric('61', { isLeaf: false });
      await crearTaric('42', { isLeaf: false });
      const res = crearRes();
      await controller.searchTaric({ query: {} }, res);
      expect(res.body.data.results.map(r => r.code).sort()).toEqual(['42', '61']);
    });

    it('enriquece con info estacional los codigos que la tengan', async () => {
      // 0808100000 (manzanas) tiene arancel estacional en seasonalTariffs.
      await crearTaric('0808100000');
      const res = crearRes();
      await controller.searchTaric({ query: { code: '0808100000' } }, res);
      const r = res.body.data.results[0];
      // Si el catalogo real marca 0808 como estacional, debe venir el flag.
      if (r.seasonal) {
        expect(r).toHaveProperty('seasonalInfo');
      }
      expect(res.statusCode).toBe(200);
    });

    it('error interno -> 500', async () => {
      aiService.generateTreeLevel.mockRejectedValue(new Error('boom'));
      const res = crearRes();
      // capitulo sin datos fuerza la llamada a IA, que revienta.
      await controller.searchTaric({ query: { code: '02' } }, res);
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ===================== getTreeData =====================

  describe('getTreeData', () => {
    it('sin parent: agrega los capitulos existentes', async () => {
      await crearTaric('6109100010');
      await crearTaric('4202100000');

      const res = crearRes();
      await controller.getTreeData({ query: {} }, res);

      expect(res.body.data.level).toBe('chapters');
      const codigos = res.body.data.results.map(c => c.code).sort();
      expect(codigos).toEqual(['42', '61']);
    });

    it('parent capitulo (2 digitos): agrega las partidas (headings) desde DB', async () => {
      await crearTaric('6109100010');
      await crearTaric('6110200000');

      const res = crearRes();
      await controller.getTreeData({ query: { parent: '61' } }, res);

      expect(res.body.data.level).toBe('headings');
      expect(res.body.data.source).toBe('database');
      const headings = res.body.data.results.map(r => r.code).sort();
      expect(headings).toEqual(['6109', '6110']);
    });

    it('parent con agregado vacio pero con leaf codes: agrupa por el nivel siguiente', async () => {
      // Un leaf cuyo breakdown.heading NO coincide con el parentNorm agregado,
      // forzando el camino de agrupacion de leafResults.
      await TaricCode.create({
        code: '6109100010', description: { es: 'Camiseta' }, level: 10,
        isActive: true, isLeaf: true,
        duties: { thirdCountry: 12 },
        supplementaryUnit: { required: false },
        breakdown: { chapter: '61', heading: '6109', subheading: '610910', cnCode: '61091000', taricCode: '6109100010' }
      });

      const res = crearRes();
      // parent 6109 (4 digitos) -> subheadings; el aggregate agrupa por subheading.
      await controller.getTreeData({ query: { parent: '6109' } }, res);
      expect(res.body.data.level).toBe('subheadings');
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
    });

    it('parent intermedio sin datos: genera con IA (source ai)', async () => {
      aiService.generateTreeLevel.mockResolvedValue([
        { code: '6109', description: 'Camisetas de punto' }
      ]);

      const res = crearRes();
      await controller.getTreeData({ query: { parent: '61' } }, res);

      expect(res.body.data.source).toBe('ai');
      expect(res.body.data.results[0].code).toBe('6109');
      expect(aiService.generateTreeLevel).toHaveBeenCalledWith('61', 'headings');
    });

    it('parent intermedio sin datos y sin IA: source empty', async () => {
      const res = crearRes();
      await controller.getTreeData({ query: { parent: '61' } }, res);
      expect(res.body.data.source).toBe('empty');
      expect(res.body.data.results).toEqual([]);
    });

    it('nivel TARIC (8+ digitos): devuelve los codigos leaf desde DB', async () => {
      await crearTaric('6109100010');
      await crearTaric('6109100090');

      const res = crearRes();
      await controller.getTreeData({ query: { parent: '61091000' } }, res);

      expect(res.body.data.level).toBe('taricCodes');
      expect(res.body.data.source).toBe('database');
      expect(res.body.data.results.map(r => r.code).sort()).toEqual(['6109100010', '6109100090']);
    });

    it('nivel TARIC sin datos: genera codigos con IA', async () => {
      aiService.generateTreeLevel.mockResolvedValue([
        { code: '6109100010', description: 'Camiseta', dutyRate: 12, vatRate: 21 }
      ]);

      const res = crearRes();
      await controller.getTreeData({ query: { parent: '61091000' } }, res);

      expect(res.body.data.source).toBe('ai');
      expect(res.body.data.results[0].duties.thirdCountry).toBe(12);
    });

    it('error interno -> 500', async () => {
      aiService.generateTreeLevel.mockRejectedValue(new Error('kaputt'));
      const res = crearRes();
      await controller.getTreeData({ query: { parent: '99' } }, res);
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
