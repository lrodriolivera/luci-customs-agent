/**
 * transitController (NCTS) contra Mongo real en memoria.
 *
 * El controller es una capa fina sobre transitService (ya cubierto en
 * tests/services/transitService.db.test.js): aqui se ejercita el CONTROLLER,
 * que estaba a 0%. Lo que aporta valor:
 *   1. El mapeo de errores del servicio a codigos HTTP (getById: 404 vs 500;
 *      create/update/delete/submit: 400).
 *   2. Los handlers IA (validate-route/predict-incidents/suggest-guarantee/
 *      full-analysis) con su guard de aislamiento: un transito de OTRO owner
 *      devuelve 404 SIN llegar a llamar a la IA (que se factura a Bedrock).
 *   3. Las notificaciones NCTS (arrival/unloading) y su guard de tenant.
 *
 * Se mockea SOLO lo externo: aiService (Bedrock) y aeatSubmitService (AEAT/NCTS
 * por red). Transit/Guarantee/Expedition van con BD real. NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  autoCompleteTransitData: jest.fn(),
  validateTransitRoute: jest.fn(),
  predictTransitIncidents: jest.fn(),
  suggestTransitGuarantee: jest.fn(),
  fullTransitAnalysis: jest.fn()
}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitNCTS: jest.fn(),
  submitNCTSArrival: jest.fn(),
  submitNCTSUnloading: jest.fn()
}));

const { Transit } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const transitService = require('../../src/services/transitService');
const ctrl = require('../../src/controllers/transitController');

usarBaseDeDatosEnMemoria();

const OWNER = () => new mongoose.Types.ObjectId();

beforeEach(() => {
  aeatSubmitService.submitNCTS.mockResolvedValue({ success: true, mrn: '26ES0008512345678X', code: 'IE028' });
});

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function req({ user, body = {}, params = {}, query = {} } = {}) {
  return { user: { _id: user || OWNER() }, body, params, query };
}

function datosTransito(extra = {}) {
  return {
    reference: 'REF-T1-001',
    transitType: 'T1',
    departureOffice: { code: 'ES000851' },
    destinationOffice: { code: 'FR001300' },
    transport: { mode: '3' },
    principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
    guarantee: { type: '1' },
    goodsItems: [{ description: 'Textil', grossWeight: 300, packages: { count: 5 } }],
    ...extra
  };
}

describe('CRUD basico', () => {
  test('create devuelve 201 con el transito y su LRN', async () => {
    const owner = OWNER();
    const res = crearRes();
    await ctrl.create(req({ user: owner, body: datosTransito() }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.lrn).toMatch(/^LRN/);
    expect(res.body.data.status).toBe('draft');
  });

  test('create con datos invalidos devuelve 400', async () => {
    const res = crearRes();
    await ctrl.create(req({ body: { transitType: 'X1' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('list devuelve la pagina de transitos del owner', async () => {
    const owner = OWNER();
    await transitService.create(datosTransito(), owner);
    await transitService.create(datosTransito({ reference: 'REF-T1-002' }), owner);

    const res = crearRes();
    await ctrl.list(req({ user: owner, query: {} }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.transits.length).toBe(2);
  });

  test('getById devuelve el transito del propio owner', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    const res = crearRes();

    await ctrl.getById(req({ user: owner, params: { id: t._id } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data._id.toString()).toBe(t._id.toString());
  });

  test('getById de un transito inexistente/ajeno devuelve 404', async () => {
    const res = crearRes();
    await ctrl.getById(req({ params: { id: new mongoose.Types.ObjectId() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('getById de un transito de OTRO owner devuelve 404 (aislamiento)', async () => {
    const t = await transitService.create(datosTransito(), OWNER());
    const res = crearRes();
    await ctrl.getById(req({ user: OWNER(), params: { id: t._id } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('update modifica un transito en draft', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    const res = crearRes();

    await ctrl.update(req({ user: owner, params: { id: t._id }, body: { reference: 'REF-NUEVA' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.reference).toBe('REF-NUEVA');
  });

  test('update de un transito ajeno devuelve 400 (servicio no lo encuentra)', async () => {
    const t = await transitService.create(datosTransito(), OWNER());
    const res = crearRes();
    await ctrl.update(req({ user: OWNER(), params: { id: t._id }, body: { reference: 'X' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('delete elimina un transito en draft', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    const res = crearRes();

    await ctrl.delete(req({ user: owner, params: { id: t._id } }), res);

    expect(res.statusCode).toBe(200);
    expect(await Transit.findById(t._id)).toBeNull();
  });
});

describe('lifecycle', () => {
  test('submit envia la declaracion y asigna un MRN', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    const res = crearRes();

    await ctrl.submit(req({ user: owner, params: { id: t._id } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/MRN/);
  });

  test('submit sobre un transito ajeno devuelve 400', async () => {
    const t = await transitService.create(datosTransito(), OWNER());
    const res = crearRes();
    await ctrl.submit(req({ user: OWNER(), params: { id: t._id } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('getStats devuelve las estadisticas del owner', async () => {
    const owner = OWNER();
    await transitService.create(datosTransito(), owner);
    const res = crearRes();

    await ctrl.getStats(req({ user: owner, query: {} }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  test('getOverdue no revienta y devuelve una lista', async () => {
    const res = crearRes();
    await ctrl.getOverdue(req({ user: OWNER() }), res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('handlers IA: guard de aislamiento (no facturar Bedrock por transitos ajenos)', () => {
  test('aiValidateRoute del propio transito llama a la IA y devuelve 200', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    aiService.validateTransitRoute.mockResolvedValue({ optimized: true, warnings: [] });

    const res = crearRes();
    await ctrl.aiValidateRoute(req({ user: owner, params: { id: t._id } }), res);

    expect(res.statusCode).toBe(200);
    expect(aiService.validateTransitRoute).toHaveBeenCalled();
    expect(res.body.data.optimized).toBe(true);
  });

  test('aiValidateRoute sobre un transito ajeno devuelve 404 SIN llamar a la IA', async () => {
    const t = await transitService.create(datosTransito(), OWNER());
    const res = crearRes();

    await ctrl.aiValidateRoute(req({ user: OWNER(), params: { id: t._id } }), res);

    expect(res.statusCode).toBe(404);
    expect(aiService.validateTransitRoute).not.toHaveBeenCalled();
  });

  test('aiPredictIncidents del propio transito devuelve 200', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    aiService.predictTransitIncidents.mockResolvedValue({ risk: 'low', incidents: [] });

    const res = crearRes();
    await ctrl.aiPredictIncidents(req({ user: owner, params: { id: t._id } }), res);

    expect(res.statusCode).toBe(200);
    expect(aiService.predictTransitIncidents).toHaveBeenCalled();
  });

  test('aiSuggestGuarantee del propio transito devuelve 200', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    aiService.suggestTransitGuarantee.mockResolvedValue({ recommended: 'global' });

    const res = crearRes();
    await ctrl.aiSuggestGuarantee(req({ user: owner, params: { id: t._id } }), res);

    expect(res.statusCode).toBe(200);
    expect(aiService.suggestTransitGuarantee).toHaveBeenCalled();
  });

  test('aiSuggestGuarantee sobre un transito ajeno devuelve 404 sin IA', async () => {
    const t = await transitService.create(datosTransito(), OWNER());
    const res = crearRes();
    await ctrl.aiSuggestGuarantee(req({ user: OWNER(), params: { id: t._id } }), res);
    expect(res.statusCode).toBe(404);
    expect(aiService.suggestTransitGuarantee).not.toHaveBeenCalled();
  });
});

describe('notificaciones NCTS (arrival/unloading)', () => {
  test('notifyArrival exige que el transito tenga MRN (400)', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner); // draft, sin MRN
    const res = crearRes();

    await ctrl.notifyArrival(req({ user: owner, params: { id: t._id }, body: {} }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/MRN/);
    expect(aeatSubmitService.submitNCTSArrival).not.toHaveBeenCalled();
  });

  test('notifyArrival con MRN envia el CC007 y pasa a arrived', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    t.mrn = '26ES0008512345678X';
    await t.save();
    aeatSubmitService.submitNCTSArrival.mockResolvedValue({ success: true });

    const res = crearRes();
    await ctrl.notifyArrival(req({ user: owner, params: { id: t._id }, body: { arrivalDate: '2026-08-05' } }), res);

    expect(res.statusCode).toBe(200);
    expect(aeatSubmitService.submitNCTSArrival).toHaveBeenCalled();
    const guardado = await Transit.findById(t._id);
    expect(guardado.status).toBe('arrived');
  });

  test('notifyArrival sobre un transito ajeno devuelve 404 sin enviar nada', async () => {
    const t = await transitService.create(datosTransito(), OWNER());
    t.mrn = '26ES0008512345678X';
    await t.save();
    const res = crearRes();

    await ctrl.notifyArrival(req({ user: OWNER(), params: { id: t._id }, body: {} }), res);

    expect(res.statusCode).toBe(404);
    expect(aeatSubmitService.submitNCTSArrival).not.toHaveBeenCalled();
  });

  test('notifyUnloading con MRN envia el CC044 y pasa a unloaded', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    t.mrn = '26ES0008512345678X';
    t.status = 'arrived';
    await t.save();
    aeatSubmitService.submitNCTSUnloading.mockResolvedValue({ success: true });

    const res = crearRes();
    await ctrl.notifyUnloading(req({ user: owner, params: { id: t._id }, body: { sealsOk: true, goodsConform: true } }), res);

    expect(res.statusCode).toBe(200);
    expect(aeatSubmitService.submitNCTSUnloading).toHaveBeenCalled();
    const guardado = await Transit.findById(t._id);
    expect(guardado.status).toBe('unloaded');
  });
});
