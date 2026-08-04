/**
 * Tests para classificationController (estaba al 0%).
 *
 * Es el nucleo del producto: asigna el codigo TARIC del que dependen el arancel
 * y el IVA de cada importacion. El foco esta en los endpoints con consecuencia
 * —aplicar una clasificacion a un expediente, marcar busquedas, operaciones
 * globales sobre el catalogo— y en las invariantes que el resto del codigo
 * mantiene y aqui se rompian.
 */

const request = require('supertest');
const express = require('express');

const mockTaricCode = {
  findOne: jest.fn(),
  find: jest.fn(),
  getChapters: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn()
};
const mockExpedition = { findById: jest.fn() };
const mockSearchHistory = { findOneAndUpdate: jest.fn(), getSearchStats: jest.fn(), countDocuments: jest.fn() };
const mockAICache = { cleanOldCache: jest.fn() };

const mockAiService = {
  classifyProduct: jest.fn(),
  validateClassification: jest.fn(),
  improveClassificationWithFeedback: jest.fn(),
  suggestBasedOnHistory: jest.fn(),
  crossValidateWithRegulations: jest.fn(),
  fullTaricAnalysis: jest.fn(),
  recordClassificationFeedback: jest.fn()
};
const mockTaricService = {
  calculateDuties: jest.fn(),
  getRequiredDocuments: jest.fn(),
  getAvailablePreferences: jest.fn(),
  seedCommonCodes: jest.fn(),
  recordSearch: jest.fn(),
  getUserSearchHistory: jest.fn(),
  getMostSearchedCodes: jest.fn(),
  getAICacheStats: jest.fn()
};

jest.mock('../../src/models', () => ({
  TaricCode: mockTaricCode,
  Expedition: mockExpedition,
  TaricSearchHistory: mockSearchHistory,
  TaricAICache: mockAICache
}));
jest.mock('../../src/services/aiService', () => mockAiService);
jest.mock('../../src/services/taricService', () => mockTaricService);

const ctrl = require('../../src/controllers/classificationController');

const TENANT_A = '6a5769e0b11d798e7e783602';
const TENANT_B = '6a5769e0b11d798e7e7836bb';
const USER = { _id: '6a5769e0b11d798e7e783607', name: 'Tester', tenantId: TENANT_A };

function app(handler, metodo = 'post', ruta = '/r') {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); }, handler);
  return a;
}

/** Expediente con una mercancia sin clasificar. */
function expediente(overrides = {}) {
  return {
    _id: 'e1',
    tenantId: TENANT_A,
    status: 'classification_pending',
    goods: [{ description: 'Camisetas', invoiceValue: 1000 }],
    timeline: [],
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe('classificationController.applyClassification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('404 si el expediente es de otro tenant', async () => {
    mockExpedition.findById.mockResolvedValue(expediente({ tenantId: TENANT_B }));

    const res = await request(app(ctrl.applyClassification))
      .post('/r').send({ expeditionId: 'e1', itemIndex: 0, taricCode: '6109100010' });

    expect(res.status).toBe(404);
  });

  test('escribe el codigo TARIC y calcula arancel e IVA', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);
    // Los tipos salen del catalogo TARIC, no del body: enviarlos como
    // parametro no los aplica, y eso es deliberado —el arancel lo fija la
    // norma, no quien clasifica—.
    mockTaricCode.findOne.mockResolvedValue({
      code: '6109100010',
      duties: { thirdCountry: 12 },
      vat: { applicable: 21 }
    });

    const res = await request(app(ctrl.applyClassification))
      .post('/r').send({ expeditionId: 'e1', itemIndex: 0, taricCode: '6109100010' });

    expect(res.status).toBe(200);
    expect(exp.goods[0].taricCode).toBe('6109100010');
    // IVA sobre base + arancel: 1000 + 120 = 1120 * 21% = 235,2
    expect(exp.goods[0].dutyAmount).toBeCloseTo(120);
    expect(exp.goods[0].vatAmount).toBeCloseTo(235.2);
    expect(exp.save).toHaveBeenCalled();
  });

  test('deriva el hsCode de los 6 primeros digitos si no se indica', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    await request(app(ctrl.applyClassification))
      .post('/r').send({ expeditionId: 'e1', itemIndex: 0, taricCode: '6109100010' });

    expect(exp.goods[0].hsCode).toBe('610910');
  });

  test('404 si el itemIndex no existe en el expediente', async () => {
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app(ctrl.applyClassification))
      .post('/r').send({ expeditionId: 'e1', itemIndex: 99, taricCode: '6109100010' });

    expect(res.status).toBe(404);
  });

  test('cuando todas las mercancias quedan clasificadas, avanza el estado', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    await request(app(ctrl.applyClassification))
      .post('/r').send({ expeditionId: 'e1', itemIndex: 0, taricCode: '6109100010' });

    expect(exp.status).toBe('classification_done');
  });

  test('deja traza en el timeline con el usuario', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    await request(app(ctrl.applyClassification))
      .post('/r').send({ expeditionId: 'e1', itemIndex: 0, taricCode: '6109100010' });

    expect(exp.timeline).toHaveLength(1);
    expect(exp.timeline[0].userId).toBe(USER._id);
  });
});

describe('classificationController.markSearchAsUsed', () => {
  beforeEach(() => jest.clearAllMocks());

  test('la consulta se acota al tenant del usuario', async () => {
    // Antes usaba findByIdAndUpdate sin filtro: cualquier autenticado podia
    // marcar como usada la busqueda de otro cliente.
    mockSearchHistory.findOneAndUpdate.mockResolvedValue(null);

    await request(app(ctrl.markSearchAsUsed, 'put', '/r/:searchId')).put('/r/s1').send({});

    const [filtro] = mockSearchHistory.findOneAndUpdate.mock.calls[0];
    expect(filtro).toEqual({ _id: 's1', tenantId: TENANT_A });
  });

  test('404 si la busqueda es de otro tenant', async () => {
    mockSearchHistory.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app(ctrl.markSearchAsUsed, 'put', '/r/:searchId')).put('/r/s1').send({});

    expect(res.status).toBe(404);
  });
});

describe('classificationController.calculateDuties', () => {
  beforeEach(() => jest.clearAllMocks());

  test('delega en taricService con la preferencia por defecto', async () => {
    mockTaricService.calculateDuties.mockResolvedValue({ total: 120 });

    await request(app(ctrl.calculateDuties)).post('/r').send({ taricCode: '6109100010', customsValue: 1000 });

    const [args] = mockTaricService.calculateDuties.mock.calls[0];
    expect(args.preference).toBe('100');
  });

  test('un error interno NO se filtra al cliente', async () => {
    // Rompia la invariante del resto del controller: devolvia error.message,
    // que puede llevar rutas o respuestas crudas de la API del TARIC europeo.
    mockTaricService.calculateDuties.mockRejectedValue(
      new Error('connect ECONNREFUSED ec.europa.eu:443')
    );

    const res = await request(app(ctrl.calculateDuties)).post('/r').send({ taricCode: '6109100010' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error al calcular derechos de importacion');
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|europa\.eu/);
  });
});

describe('classificationController: endpoints de IA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('improve-with-feedback exige descripcion del producto', async () => {
    const res = await request(app(ctrl.aiImproveWithFeedback)).post('/r').send({});

    expect(res.status).toBe(400);
    expect(mockAiService.improveClassificationWithFeedback).not.toHaveBeenCalled();
  });

  test('improve-with-feedback usa listas vacias por defecto', async () => {
    mockAiService.improveClassificationWithFeedback.mockResolvedValue({ ok: true });

    await request(app(ctrl.aiImproveWithFeedback)).post('/r').send({ productDescription: 'Camisetas de algodon' });

    expect(mockAiService.improveClassificationWithFeedback).toHaveBeenCalledWith('Camisetas de algodon', [], []);
  });

  test('cross-validate exige una clasificacion con codigo TARIC', async () => {
    const res = await request(app(ctrl.aiCrossValidate)).post('/r').send({ classification: {} });

    expect(res.status).toBe(400);
    expect(mockAiService.crossValidateWithRegulations).not.toHaveBeenCalled();
  });

  test('full-analysis exige productData con descripcion', async () => {
    const res = await request(app(ctrl.aiFullAnalysis)).post('/r').send({ productData: {} });

    expect(res.status).toBe(400);
    expect(mockAiService.fullTaricAnalysis).not.toHaveBeenCalled();
  });

  test('un fallo de la IA no filtra el detalle interno', async () => {
    mockAiService.fullTaricAnalysis.mockRejectedValue(new Error('Bedrock throttling: rate exceeded'));

    const res = await request(app(ctrl.aiFullAnalysis))
      .post('/r').send({ productData: { description: 'Camisetas' } });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/Bedrock|throttling/);
  });
});

describe('classificationController.getChapters', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve los capitulos del catalogo', async () => {
    mockTaricCode.getChapters.mockResolvedValue([{ chapter: '61', description: 'Prendas de punto' }]);

    const res = await request(app(ctrl.getChapters, 'get')).get('/r');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('un fallo de BD no filtra el detalle interno', async () => {
    mockTaricCode.getChapters.mockRejectedValue(new Error('ECONNREFUSED mongo:27017'));

    const res = await request(app(ctrl.getChapters, 'get')).get('/r');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|mongo:/);
  });
});

describe('classificationController.validateClassification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calcula arancel e IVA cuando la clasificacion es valida', async () => {
    mockTaricCode.findOne.mockResolvedValue({
      code: '6109100010',
      duties: { thirdCountry: 12 },
      vat: { applicable: 21 },
      toObject: () => ({ code: '6109100010' })
    });
    mockAiService.validateClassification.mockResolvedValue({ isValid: true });

    const res = await request(app(ctrl.validateClassification))
      .post('/r').send({ taricCode: '6109100010', description: 'Camisetas', customsValue: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.data.dutyCalculation).toBeDefined();
  });

  test('aplica el IVA general del 21% cuando el codigo no lo especifica', async () => {
    mockTaricCode.findOne.mockResolvedValue({
      code: '8471300000',
      duties: {},
      vat: {},
      toObject: () => ({ code: '8471300000' })
    });
    mockAiService.validateClassification.mockResolvedValue({ isValid: true });

    const res = await request(app(ctrl.validateClassification))
      .post('/r').send({ taricCode: '8471300000', customsValue: 1000 });

    expect(res.body.data.dutyCalculation.vatRate).toBe(21);
  });
});

describe('classificationController: mas endpoints de IA (validacion de entrada)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('aiSuggestFromHistory exige descripcion de producto (400)', async () => {
    const res = await request(app(ctrl.aiSuggestFromHistory)).post('/r').send({});

    expect(res.status).toBe(400);
    expect(mockAiService.suggestBasedOnHistory).not.toHaveBeenCalled();
  });

  test('aiSuggestFromHistory delega en el servicio con los defaults', async () => {
    mockAiService.suggestBasedOnHistory.mockResolvedValue({ suggestions: ['x'] });

    const res = await request(app(ctrl.aiSuggestFromHistory))
      .post('/r').send({ productDescription: 'Camisetas de algodon' });

    expect(res.status).toBe(200);
    // Sin historial ni perfil, el controller pasa [] y {} por defecto.
    expect(mockAiService.suggestBasedOnHistory).toHaveBeenCalledWith('Camisetas de algodon', [], {});
  });

  test('aiRecordFeedback exige ambos campos (400)', async () => {
    const res = await request(app(ctrl.aiRecordFeedback)).post('/r').send({ feedback: 'ok' });

    expect(res.status).toBe(400);
  });

  test('aiRecordFeedback registra el feedback cuando llega completo', async () => {
    mockAiService.recordClassificationFeedback.mockResolvedValue({ recorded: true });

    const res = await request(app(ctrl.aiRecordFeedback))
      .post('/r').send({ classificationData: { taricCode: 'x' }, feedback: 'correcto' });

    expect(res.status).toBe(200);
    expect(res.body.data.recorded).toBe(true);
  });
});

describe('classificationController: utilidades del catalogo', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getRequiredDocuments devuelve los documentos del servicio', async () => {
    mockTaricService.getRequiredDocuments.mockResolvedValue([{ code: 'N851' }]);

    const res = await request(app(ctrl.getRequiredDocuments, 'get', '/r/:code'))
      .get('/r/6109100010').query({ origin: 'CN' });

    expect(res.status).toBe(200);
    expect(mockTaricService.getRequiredDocuments).toHaveBeenCalledWith('6109100010', 'CN');
    expect(res.body.data).toEqual([{ code: 'N851' }]);
  });

  test('getPreferences devuelve el origen y sus preferencias', async () => {
    mockTaricService.getAvailablePreferences.mockReturnValue([{ code: '300' }]);

    const res = await request(app(ctrl.getPreferences, 'get', '/r/:origin')).get('/r/CN');

    expect(res.status).toBe(200);
    expect(res.body.data.origin).toBe('CN');
    expect(res.body.data.preferences).toEqual([{ code: '300' }]);
  });

  test('calculateDuties aplica la preferencia 100 por defecto', async () => {
    mockTaricService.calculateDuties.mockResolvedValue({ dutyRate: 12 });

    await request(app(ctrl.calculateDuties))
      .post('/r').send({ taricCode: '6109100010', customsValue: 1000, origin: 'CN' });

    const arg = mockTaricService.calculateDuties.mock.calls[0][0];
    expect(arg.preference).toBe('100');
  });

  test('un fallo del servicio de aranceles devuelve 500', async () => {
    mockTaricService.calculateDuties.mockRejectedValue(new Error('boom'));

    const res = await request(app(ctrl.calculateDuties))
      .post('/r').send({ taricCode: 'x', customsValue: 1 });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('classificationController: historial y cache', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getSearchHistory acota por el usuario autenticado', async () => {
    mockTaricService.getUserSearchHistory.mockResolvedValue([{ code: 'x' }]);

    const res = await request(app(ctrl.getSearchHistory, 'get')).get('/r').query({ limit: 5 });

    expect(res.status).toBe(200);
    // El primer argumento es el _id del usuario: no debe agregar el de otros.
    expect(mockTaricService.getUserSearchHistory).toHaveBeenCalledWith(USER._id, 5);
    expect(res.body.data.count).toBe(1);
  });

  test('getMostSearched acota por el tenant del usuario', async () => {
    mockTaricService.getMostSearchedCodes.mockResolvedValue([{ code: 'y', hits: 3 }]);

    const res = await request(app(ctrl.getMostSearched, 'get')).get('/r').query({ days: 7, limit: 10 });

    expect(res.status).toBe(200);
    expect(mockTaricService.getMostSearchedCodes).toHaveBeenCalledWith(TENANT_A, 7, 10);
  });

  test('getSearchStats devuelve ceros cuando no hay busquedas', async () => {
    mockSearchHistory.getSearchStats.mockResolvedValue([]);

    const res = await request(app(ctrl.getSearchStats, 'get')).get('/r').query({ days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data.totalSearches).toBe(0);
  });

  test('cleanOldCache borra las entradas antiguas', async () => {
    mockAICache.cleanOldCache.mockResolvedValue({ deletedCount: 4 });

    const res = await request(app(ctrl.cleanOldCache, 'delete')).delete('/r').query({ daysOld: 90 });

    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(4);
  });
});
