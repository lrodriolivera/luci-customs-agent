/**
 * Aislamiento por tenant en requirementController.
 *
 * Era el controller con mas rutas desprotegidas (17 findById sobre ids del
 * cliente sin comprobar la propiedad). Ademas Requirement no declaraba
 * tenantId, asi que hubo que añadirlo al schema y derivarlo de la expedicion,
 * que es el unico dueño posible de un requerimiento.
 */

const request = require('supertest');
const express = require('express');

const mockRequirement = { findById: jest.fn() };
const mockExpedition = { findById: jest.fn() };

jest.mock('../../src/models/Requirement', () => mockRequirement);
jest.mock('../../src/models/Expedition', () => mockExpedition);
jest.mock('../../src/services/aeat/aeatRealService', () => ({}));
jest.mock('../../src/services/aeat/certificateService', () => ({}));

const requirementController = require('../../src/controllers/requirementController');

const USER = { _id: 'u1', name: 'Tester', tenantId: 't1' };

function app(handler, metodo = 'get', ruta = '/r/:id') {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); }, handler);
  return a;
}

/** findById(...).populate().populate()... encadenable. */
function requirementQuery(doc) {
  const chain = { populate: jest.fn().mockReturnThis(), then: undefined };
  chain.populate = jest.fn(() => chain);
  // getRequirementById hace await sobre la cadena: se resuelve como promesa.
  chain.then = (res) => Promise.resolve(doc).then(res);
  return chain;
}

describe('requirementController: aislamiento por tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('404 al leer un requerimiento de otro tenant', async () => {
    mockRequirement.findById.mockReturnValue(requirementQuery({ _id: 'r1', tenantId: 't2' }));

    const res = await request(app(requirementController.getRequirementById)).get('/r/r1');

    expect(res.status).toBe(404);
  });

  test('deja pasar el requerimiento del propio tenant', async () => {
    mockRequirement.findById.mockReturnValue(requirementQuery({ _id: 'r1', tenantId: 't1' }));

    const res = await request(app(requirementController.getRequirementById)).get('/r/r1');

    expect(res.status).toBe(200);
  });

  test('404 si el requerimiento no existe', async () => {
    mockRequirement.findById.mockReturnValue(requirementQuery(null));

    const res = await request(app(requirementController.getRequirementById)).get('/r/r1');

    expect(res.status).toBe(404);
  });

  test('404 al actualizar un requerimiento de otro tenant', async () => {
    const doc = { _id: 'r1', tenantId: 't2', status: 'open', save: jest.fn(), timeline: [] };
    mockRequirement.findById.mockResolvedValue(doc);

    const res = await request(app(requirementController.updateRequirement, 'put', '/r/:id'))
      .put('/r/r1').send({ status: 'resolved' });

    expect(res.status).toBe(404);
    expect(doc.save).not.toHaveBeenCalled();
  });

  describe('creacion', () => {
    test('404 al crear sobre un expediente de otro tenant', async () => {
      mockExpedition.findById.mockResolvedValue({ _id: 'e1', tenantId: 't2' });

      const res = await request(app(requirementController.createRequirement, 'post', '/r'))
        .post('/r').send({ expeditionId: 'e1', channel: 'orange', subject: 'x' });

      expect(res.status).toBe(404);
    });

    test('no se puede colar el tenant por el body', async () => {
      // El guard mira la expedicion, no lo que venga en el payload.
      mockExpedition.findById.mockResolvedValue({ _id: 'e1', tenantId: 't2' });

      const res = await request(app(requirementController.createRequirement, 'post', '/r'))
        .post('/r').send({ expeditionId: 'e1', channel: 'orange', subject: 'x', tenantId: 't1' });

      expect(res.status).toBe(404);
    });
  });
});
