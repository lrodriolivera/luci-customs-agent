/**
 * Rutas de los mensajes NCTS del operador: POST /api/transit/:id/present
 * (CC170C), /amend (CC013C) y /invalidate (CC014C).
 *
 * Se ejercita el router real con supertest, el requireRole real y Mongo en
 * memoria. Solo se simulan la autenticación (inyecta el usuario) y la AEAT
 * (aeatSubmitService). Lo que se prueba:
 *   - rol: un `viewer` no presenta nada ante la AEAT (403, sin envío);
 *   - aislamiento: el tránsito de otro usuario/tenant da 404 sin envío;
 *   - errores: validación 422, estado/rechazo 400, y el mensaje llega tal cual.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitNCTS: jest.fn(),
  submitNCTSAmendment: jest.fn(),
  submitNCTSInvalidation: jest.fn(),
  submitNCTSPresentation: jest.fn()
}));

let mockUsuario;
jest.mock('../../src/middleware/auth', () => {
  const real = jest.requireActual('../../src/middleware/auth');
  return {
    ...real,
    requireAuth: (req, res, next) => { req.user = mockUsuario; next(); }
  };
});

const { Transit } = require('../../src/models');
const Tenant = require('../../src/models/Tenant');
const aeat = require('../../src/services/aeat/aeatSubmitService');

usarBaseDeDatosEnMemoria();

const MRN = '26ES002801501441J7';
let app;
let usuarioA;
let tenantA;

function crearApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/transit', require('../../src/routes/transit'));
  return a;
}

async function predeclaracion(owner, extra = {}) {
  return Transit.create({
    reference: 'R1', lrn: `LRN${Math.random().toString(36).slice(2, 10)}`, mrn: `26ES0028015${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}X`,
    transitType: 'T1', status: 'prelodged', additionalDeclarationType: 'D',
    departureOffice: { code: 'ES002801' }, destinationOffice: { code: 'ES002901' },
    transport: { mode: '3' }, principal: { eori: 'ESB22477020', name: 'STRIX' }, guarantee: { type: '1' },
    goodsItems: [{ description: 'Ropa', taricCode: '6302100000', grossWeight: 25 }],
    ncts: { estado: 'PA' }, owner, ...extra
  });
}

beforeAll(() => { app = crearApp(); });

beforeEach(async () => {
  tenantA = await Tenant.create({ name: 'A', slug: `a-${Date.now()}-${Math.random()}`, businessInfo: { type: 'customs_agent', eori: 'ESB22477020' } });
  usuarioA = { _id: new mongoose.Types.ObjectId(), role: 'agent', tenantId: tenantA._id };
  mockUsuario = usuarioA;
  aeat.submitNCTSPresentation.mockResolvedValue({ success: true, mrn: MRN, estado: 'DE', circuito: 'V' });
  aeat.submitNCTSAmendment.mockResolvedValue({ success: true, mrn: MRN, estado: 'PA' });
  aeat.submitNCTSInvalidation.mockResolvedValue({ success: true, mrn: MRN, estado: 'CA' });
});

const CASOS = [
  ['present', {}, () => aeat.submitNCTSPresentation],
  ['amend', { notes: 'cambio' }, () => aeat.submitNCTSAmendment],
  ['invalidate', { motivo: 'error' }, () => aeat.submitNCTSInvalidation]
];

describe.each(CASOS)('POST /:id/%s', (accion, cuerpo, envio) => {
  test('un agente de su tenant lo envía (200)', async () => {
    const t = await predeclaracion(usuarioA._id);
    const res = await request(app).post(`/api/transit/${t._id}/${accion}`).send(cuerpo);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(envio()).toHaveBeenCalledTimes(1);
  });

  test('un viewer no presenta nada ante la AEAT (403)', async () => {
    const t = await predeclaracion(usuarioA._id);
    mockUsuario = { ...usuarioA, role: 'viewer' };
    const res = await request(app).post(`/api/transit/${t._id}/${accion}`).send(cuerpo);
    expect(res.status).toBe(403);
    expect(envio()).not.toHaveBeenCalled();
  });

  test('el tránsito de otro usuario/tenant no existe (404) y no sale nada', async () => {
    const ajeno = await predeclaracion(new mongoose.Types.ObjectId());
    const res = await request(app).post(`/api/transit/${ajeno._id}/${accion}`).send(cuerpo);
    expect(res.status).toBe(404);
    expect(envio()).not.toHaveBeenCalled();
    expect((await Transit.findById(ajeno._id)).status).toBe('prelodged');
  });

  test('un rechazo de la AEAT llega como 400 con su texto', async () => {
    envio().mockResolvedValue({ success: false, error: 'ADDS_Partida_1_Ubicación incorrecta' });
    const t = await predeclarado();
    const res = await request(app).post(`/api/transit/${t._id}/${accion}`).send(cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Ubicación incorrecta');
  });

  async function predeclarado() { return predeclaracion(usuarioA._id); }
});

test('un 422 de validación (EORI del firmante, código NC...) se respeta', async () => {
  const err = Object.assign(new Error('Falta el EORI del representante: configúralo en Ajustes > Aduanas'), { status: 422 });
  aeat.submitNCTSPresentation.mockRejectedValue(err);
  const t = await predeclaracion(usuarioA._id);
  const res = await request(app).post(`/api/transit/${t._id}/present`).send({});
  expect(res.status).toBe(422);
  expect(res.body.error).toMatch(/EORI del representante/);
});

test('anular un tránsito despachado (DE) es 400 con la indicación de pedirlo por registro', async () => {
  const t = await predeclaracion(usuarioA._id, { status: 'accepted', additionalDeclarationType: 'A', ncts: { estado: 'DE' } });
  const res = await request(app).post(`/api/transit/${t._id}/invalidate`).send({ motivo: 'x' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/registro/);
  expect(aeat.submitNCTSInvalidation).not.toHaveBeenCalled();
});
