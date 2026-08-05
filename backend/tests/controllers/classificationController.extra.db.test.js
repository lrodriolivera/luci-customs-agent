/**
 * classificationController (complemento): handlers que tocan la BD real, contra
 * Mongo en memoria. El fichero previo (classificationController.test.js) mockea
 * `src/models`, asi que la logica real de escritura/lectura no se ejercitaba.
 *
 * Aqui NO se mockean los modelos: se cubren los caminos que dan valor de negocio
 *   1. applyClassification: escribe el TARIC en goods[itemIndex], calcula
 *      dutyAmount/vatAmount con el arancel real de TaricCode, transiciona
 *      classification_pending -> classification_done cuando TODO queda
 *      clasificado, y aplica el guard de tenant (id ajeno -> 404).
 *   2. suggestTaricCode: persiste las sugerencias IA en aiAnalysis, enriquece
 *      con el TaricCode real y respeta el guard de tenant.
 *   3. validateClassification: calcula aranceles a partir del TaricCode real.
 *   4. getChapters: static getChapters (level 2) sobre datos reales.
 *   5. markSearchAsUsed: guard por tenant sobre TaricSearchHistory real
 *      (id ajeno -> 404, no se marca).
 *   6. getSearchStats / getCacheStats: agregaciones reales sobre las colecciones.
 *
 * Se mockea SOLO lo externo: aiService (Bedrock) y taricService (envuelve red/
 * EU API). TaricCode/Expedition/TaricSearchHistory son reales. BD efimera,
 * NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// resetMocks:true borra las implementaciones de fabrica antes de cada test; los
// mocks se declaran vacios y se les da implementacion en beforeEach.
jest.mock('../../src/services/aiService', () => ({
  classifyProduct: jest.fn(),
  validateClassification: jest.fn()
}));
jest.mock('../../src/services/taricService', () => ({
  getUserSearchHistory: jest.fn(),
  getMostSearchedCodes: jest.fn(),
  getAICacheStats: jest.fn()
}));

const { TaricCode, Expedition, TaricSearchHistory } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const taricService = require('../../src/services/taricService');
const controller = require('../../src/controllers/classificationController');

// --- Helpers -----------------------------------------------------------------

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

function usuario(tenantId = TENANT_A) {
  return { _id: new mongoose.Types.ObjectId(), name: 'Operador', tenantId };
}

function crearRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((payload) => { res.body = payload; return res; });
  return res;
}

// Expediente minimo valido (client.nif/companyName, transportMode/operationType
// son required por el schema) con un item importado.
async function crearExpediente(tenantId = TENANT_A, { goods, status = 'classification_pending' } = {}) {
  return Expedition.create({
    tenantId,
    operationType: 'import',
    transportMode: 'maritime',
    status,
    client: { companyName: 'Importadora SL', nif: 'B12345678' },
    goods: goods || [
      { itemNumber: 1, description: 'Camisetas algodon', quantity: 100, unit: 'KG', invoiceValue: 1000 }
    ]
  });
}

async function crearTaric(code, { thirdCountry = 12, vatApplicable = 21, docs = [], measures = [] } = {}) {
  return TaricCode.create({
    code,
    description: { es: `Descripcion ${code}` },
    level: 10,
    duties: { thirdCountry },
    vat: { applicable: vatApplicable, standard: vatApplicable },
    supplementaryUnit: { required: false },
    requiredDocuments: docs,
    measures,
    breakdown: {
      chapter: code.substring(0, 2),
      heading: code.substring(0, 4),
      subheading: code.substring(0, 6),
      cnCode: code.substring(0, 8),
      taricCode: code
    }
  });
}

describe('classificationController (BD real)', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(() => {
    aiService.classifyProduct.mockResolvedValue([]);
    aiService.validateClassification.mockResolvedValue({
      isValid: true, confidence: 0.9, reasoning: 'ok', warnings: []
    });
    taricService.getUserSearchHistory.mockResolvedValue([]);
    taricService.getMostSearchedCodes.mockResolvedValue([]);
    taricService.getAICacheStats.mockResolvedValue({ totalEntries: 0 });
  });

  // --- applyClassification ---------------------------------------------------

  describe('applyClassification', () => {
    it('escribe el TARIC y calcula arancel + IVA con el codigo real', async () => {
      const user = usuario();
      const exp = await crearExpediente(TENANT_A);
      await crearTaric('6109100010', { thirdCountry: 12, vatApplicable: 21 });

      const res = crearRes();
      await controller.applyClassification(
        { body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '6109100010' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const item = res.body.data.item;
      expect(item.taricCode).toBe('6109100010');
      expect(item.hsCode).toBe('610910'); // derivado de los 6 primeros digitos
      expect(item.dutyRate).toBe(12);
      expect(item.vatRate).toBe(21);
      // 1000 * 12% = 120 de arancel; IVA sobre (1000+120) * 21% = 235,2
      expect(item.dutyAmount).toBeCloseTo(120, 5);
      expect(item.vatAmount).toBeCloseTo(235.2, 5);

      // persistido de verdad
      const recargado = await Expedition.findById(exp._id);
      expect(recargado.goods[0].taricCode).toBe('6109100010');
      expect(recargado.goods[0].dutyAmount).toBeCloseTo(120, 5);
    });

    it('transiciona classification_pending -> classification_done al clasificar el ultimo item', async () => {
      const user = usuario();
      const exp = await crearExpediente(TENANT_A, {
        goods: [{ itemNumber: 1, description: 'Item', quantity: 1, unit: 'KG', invoiceValue: 500 }],
        status: 'classification_pending'
      });
      await crearTaric('6109100010');

      const res = crearRes();
      await controller.applyClassification(
        { body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '6109100010' }, user },
        res
      );

      expect(res.body.data.expeditionStatus).toBe('classification_done');
      const recargado = await Expedition.findById(exp._id);
      expect(recargado.status).toBe('classification_done');
    });

    it('NO transiciona si aun queda algun item sin clasificar', async () => {
      const user = usuario();
      const exp = await crearExpediente(TENANT_A, {
        goods: [
          { itemNumber: 1, description: 'A', quantity: 1, unit: 'KG', invoiceValue: 100 },
          { itemNumber: 2, description: 'B', quantity: 1, unit: 'KG', invoiceValue: 200 }
        ],
        status: 'classification_pending'
      });
      await crearTaric('6109100010');

      const res = crearRes();
      await controller.applyClassification(
        { body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '6109100010' }, user },
        res
      );

      expect(res.body.data.expeditionStatus).toBe('classification_pending');
    });

    it('respeta hsCode explicito del body cuando se envia', async () => {
      const user = usuario();
      const exp = await crearExpediente(TENANT_A);
      await crearTaric('6109100010');

      const res = crearRes();
      await controller.applyClassification(
        { body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '6109100010', hsCode: '610900' }, user },
        res
      );
      expect(res.body.data.item.hsCode).toBe('610900');
    });

    it('devuelve 404 si el item no existe en el expediente', async () => {
      const user = usuario();
      const exp = await crearExpediente(TENANT_A);

      const res = crearRes();
      await controller.applyClassification(
        { body: { expeditionId: exp._id.toString(), itemIndex: 5, taricCode: '6109100010' }, user },
        res
      );
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toMatch(/Item no encontrado/i);
    });

    it('devuelve 404 si el expediente es de otro tenant (guard)', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_B); // ajeno

      const res = crearRes();
      await controller.applyClassification(
        { body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '6109100010' }, user },
        res
      );
      expect(res.statusCode).toBe(404);
      // no debe haber tocado el expediente ajeno
      const recargado = await Expedition.findById(exp._id);
      expect(recargado.goods[0].taricCode).toBeUndefined();
    });

    it('aplica el TARIC aun sin ficha en la BD (dejando montos sin calcular)', async () => {
      const user = usuario();
      const exp = await crearExpediente(TENANT_A);
      // sin crearTaric: TaricCode.findOne devuelve null

      const res = crearRes();
      await controller.applyClassification(
        { body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '9999999999' }, user },
        res
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.data.item.taricCode).toBe('9999999999');
      expect(res.body.data.item.dutyAmount).toBeUndefined();
    });
  });

  // --- suggestTaricCode ------------------------------------------------------

  describe('suggestTaricCode', () => {
    it('persiste las sugerencias IA en aiAnalysis y las enriquece con el TARIC real', async () => {
      const user = usuario();
      const exp = await crearExpediente(TENANT_A);
      await crearTaric('6109100010', { thirdCountry: 12 });
      aiService.classifyProduct.mockResolvedValue([
        { code: '6109100010', confidence: 0.95, reasoning: 'algodon' }
      ]);

      const res = crearRes();
      await controller.suggestTaricCode(
        { body: { description: 'camisetas', expeditionId: exp._id.toString(), itemIndex: 0 }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const sug = res.body.data.suggestions[0];
      expect(sug.code).toBe('6109100010');
      expect(sug.taricInfo).not.toBeNull();
      expect(sug.taricInfo.duties.thirdCountry).toBe(12);

      // persistido en el expediente
      const recargado = await Expedition.findById(exp._id);
      expect(recargado.aiAnalysis.classificationSuggestions).toHaveLength(1);
      expect(recargado.aiAnalysis.classificationSuggestions[0].suggestedTaricCode).toBe('6109100010');
      expect(recargado.aiAnalysis.lastAnalysisAt).toBeInstanceOf(Date);
    });

    it('devuelve taricInfo null cuando el codigo sugerido no esta en la BD', async () => {
      const user = usuario();
      aiService.classifyProduct.mockResolvedValue([
        { code: '0000000000', confidence: 0.5, reasoning: 'x' }
      ]);

      const res = crearRes();
      await controller.suggestTaricCode({ body: { description: 'algo' }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.suggestions[0].taricInfo).toBeNull();
    });

    it('devuelve 404 sin llamar a la IA si el expediente es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_B);

      const res = crearRes();
      await controller.suggestTaricCode(
        { body: { description: 'x', expeditionId: exp._id.toString() }, user },
        res
      );
      expect(res.statusCode).toBe(404);
      expect(aiService.classifyProduct).not.toHaveBeenCalled();
    });
  });

  // --- validateClassification ------------------------------------------------

  describe('validateClassification', () => {
    it('calcula aranceles con el TARIC real cuando la validacion IA es valida', async () => {
      const user = usuario();
      await crearTaric('6109100010', { thirdCountry: 10, vatApplicable: 21, docs: [{ code: 'C400', description: 'CITES' }], measures: [{ type: 'surveillance' }] });

      const res = crearRes();
      await controller.validateClassification(
        { body: { taricCode: '6109100010', description: 'camisetas', origin: 'CN', value: 2000 }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const d = res.body.data;
      expect(d.isValid).toBe(true);
      expect(d.dutyCalculation.dutyRate).toBe(10);
      expect(d.dutyCalculation.estimatedDuty).toBeCloseTo(200, 5); // 2000 * 10%
      expect(d.dutyCalculation.estimatedVat).toBeCloseTo(420, 5); // 2000 * 21%
      expect(d.requiredDocuments).toHaveLength(1);
      expect(d.requiredDocuments[0].code).toBe('C400');
      expect(d.measures).toHaveLength(1);
    });

    it('no calcula aranceles si el codigo no existe en la BD', async () => {
      const user = usuario();
      const res = crearRes();
      await controller.validateClassification(
        { body: { taricCode: '0000000000', value: 100 }, user },
        res
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.data.dutyCalculation).toBeNull();
    });

    it('no calcula aranceles si la IA marca la clasificacion como invalida', async () => {
      const user = usuario();
      await crearTaric('6109100010');
      aiService.validateClassification.mockResolvedValue({ isValid: false, confidence: 0.2, warnings: ['dudoso'] });

      const res = crearRes();
      await controller.validateClassification(
        { body: { taricCode: '6109100010', value: 100 }, user },
        res
      );
      expect(res.body.data.isValid).toBe(false);
      expect(res.body.data.dutyCalculation).toBeNull();
    });
  });

  // --- getChapters -----------------------------------------------------------

  describe('getChapters', () => {
    it('devuelve solo los codigos de nivel 2 (capitulos) ordenados', async () => {
      await TaricCode.create({ code: '01', description: { es: 'Animales vivos' }, level: 2, isActive: true, breakdown: { chapter: '01' }, supplementaryUnit: { required: false } });
      await TaricCode.create({ code: '61', description: { es: 'Prendas de punto' }, level: 2, isActive: true, breakdown: { chapter: '61' }, supplementaryUnit: { required: false } });
      await crearTaric('6109100010'); // nivel 10, no debe salir

      const res = crearRes();
      await controller.getChapters({ user: usuario() }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map(c => c.code)).toEqual(['01', '61']);
    });
  });

  // --- markSearchAsUsed ------------------------------------------------------

  describe('markSearchAsUsed', () => {
    async function crearBusqueda(tenantId, userId) {
      return TaricSearchHistory.create({
        userId: userId || new mongoose.Types.ObjectId(),
        tenantId,
        code: '6109100010',
        normalizedCode: '6109100010',
        found: true,
        source: 'local_db'
      });
    }

    it('marca la busqueda como usada y guarda el expediente', async () => {
      const user = usuario(TENANT_A);
      const busqueda = await crearBusqueda(TENANT_A, user._id);
      const expId = new mongoose.Types.ObjectId();

      const res = crearRes();
      await controller.markSearchAsUsed(
        { params: { searchId: busqueda._id.toString() }, body: { expeditionId: expId.toString() }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.data.wasUsed).toBe(true);
      const recargado = await TaricSearchHistory.findById(busqueda._id);
      expect(recargado.wasUsed).toBe(true);
      expect(String(recargado.expeditionId)).toBe(expId.toString());
    });

    it('devuelve 404 y NO marca la busqueda de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const busqueda = await crearBusqueda(TENANT_B); // ajena

      const res = crearRes();
      await controller.markSearchAsUsed(
        { params: { searchId: busqueda._id.toString() }, body: {}, user },
        res
      );

      expect(res.statusCode).toBe(404);
      const recargado = await TaricSearchHistory.findById(busqueda._id);
      expect(recargado.wasUsed).toBe(false); // intacta
    });
  });

  // --- getSearchStats --------------------------------------------------------

  describe('getSearchStats', () => {
    it('agrega estadisticas SOLO del tenant del usuario', async () => {
      const user = usuario(TENANT_A);
      const base = {
        code: '6109100010', normalizedCode: '6109100010', found: true, source: 'local_db',
        responseTime: 100, userId: new mongoose.Types.ObjectId()
      };
      // 2 del tenant A (una usada), 1 del tenant B
      await TaricSearchHistory.create({ ...base, tenantId: TENANT_A, wasUsed: true });
      await TaricSearchHistory.create({ ...base, tenantId: TENANT_A, wasUsed: false });
      await TaricSearchHistory.create({ ...base, tenantId: TENANT_B, wasUsed: true });

      const res = crearRes();
      await controller.getSearchStats({ query: {}, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalSearches).toBe(2); // no cuenta el de B
      expect(res.body.data.usedCount).toBe(1);
    });

    it('devuelve ceros cuando no hay busquedas', async () => {
      const res = crearRes();
      await controller.getSearchStats({ query: {}, user: usuario() }, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalSearches).toBe(0);
    });
  });

  // --- regresion del schema TaricCode ----------------------------------------

  describe('TaricCode.supplementaryUnit (regresion de schema)', () => {
    it('persiste supplementaryUnit como objeto (require/type/description)', async () => {
      // Antes del fix, la clave reservada `type` colapsaba el subobjeto a un
      // SchemaString requerido y esto reventaba con "Cast to string failed".
      const doc = await TaricCode.create({
        code: '8471300000', description: { es: 'Portatiles' }, level: 10,
        breakdown: { chapter: '84' },
        supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
      });
      const recargado = await TaricCode.findById(doc._id);
      expect(recargado.supplementaryUnit.required).toBe(true);
      expect(recargado.supplementaryUnit.type).toBe('p/st');
      expect(recargado.supplementaryUnit.description).toBe('Numero de articulos');
    });
  });

  // --- getCacheStats ---------------------------------------------------------

  describe('getCacheStats', () => {
    it('combina el cache IA (mock) con conteos reales de TaricCode', async () => {
      await crearTaric('6109100010');
      await crearTaric('0101210000');
      taricService.getAICacheStats.mockResolvedValue({ totalEntries: 3, totalHits: 9 });

      const res = crearRes();
      await controller.getCacheStats({ query: {}, user: usuario() }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalEntries).toBe(3);
      expect(res.body.data.taricCodesTotal).toBe(2);
      expect(res.body.data.taricChapters).toBe(2); // capitulos 61 y 01 distintos
    });
  });
});
