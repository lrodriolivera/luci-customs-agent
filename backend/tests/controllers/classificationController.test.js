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
  fullTaricAnalysis: jest.fn()
};
const mockTaricService = {
  calculateDuties: jest.fn(),
  getRequiredDocuments: jest.fn(),
  getAvailablePreferences: jest.fn(),
  seedCommonCodes: jest.fn(),
  recordSearch: jest.fn()
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
