/**
 * Aislamiento por tenant en pueController y ensController.
 *
 * Ambos hacian findById sobre ids que vienen del cliente sin comprobar la
 * propiedad del documento: conociendo un id se podia leer y operar sobre
 * solicitudes PUE y declaraciones ENS de otro tenant. Estos tests fijan que el
 * guard esta puesto y que la creacion asigna el tenant, que es lo que hace que
 * el guard sirva de algo.
 */

const request = require('supertest');
const express = require('express');

const mockPUE = { findById: jest.fn() };
const mockENS = { findById: jest.fn() };
const mockPueService = { createRequest: jest.fn().mockResolvedValue({ success: true, data: {} }) };

jest.mock('../../src/models', () => ({
  PUERequest: mockPUE,
  ENSDeclaration: mockENS,
  Expedition: { findById: jest.fn() }
}));
jest.mock('../../src/models/ENSDeclaration', () => mockENS);
jest.mock('../../src/services/pueService', () => mockPueService);
jest.mock('../../src/services/ensService', () => ({ createDeclaration: jest.fn() }));
jest.mock('../../src/services/forms/pueGenerator', () => ({}));
jest.mock('../../src/services/aiService', () => ({}));

const pueController = require('../../src/controllers/pueController');

const USER = { _id: 'u1', name: 'Tester', tenantId: 't1' };

function app(handler, metodo = 'get', ruta = '/r/:id') {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); }, handler);
  return a;
}

describe('pueController: aislamiento por tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('404 al leer una solicitud PUE de otro tenant', async () => {
    mockPUE.findById.mockResolvedValue({ _id: 'p1', tenantId: 't2', status: 'draft' });

    const res = await request(app(pueController.getXML)).get('/r/p1');

    expect(res.status).toBe(404);
  });

  test('deja pasar la solicitud del propio tenant', async () => {
    mockPUE.findById.mockResolvedValue({ _id: 'p1', tenantId: 't1', status: 'draft' });

    const res = await request(app(pueController.getXML)).get('/r/p1');

    expect(res.status).not.toBe(404);
  });

  test('404 si la solicitud no existe', async () => {
    mockPUE.findById.mockResolvedValue(null);

    const res = await request(app(pueController.getXML)).get('/r/p1');

    expect(res.status).toBe(404);
  });

  test('al crear, el tenant sale del usuario y no del body', async () => {
    // Sin esto la solicitud nace sin tenantId y el guard la dejaria pasar
    // desde cualquier tenant, porque permite documentos sin tenant.
    const a = express();
    a.use(express.json());
    a.post('/r', (req, _res, next) => { req.user = USER; next(); }, pueController.create);

    await request(a).post('/r').send({ tipo: 'ROHS', tenantId: 't999' });

    const [payload] = mockPueService.createRequest.mock.calls[0];
    expect(payload.tenantId).toBe('t1');
  });
});

describe('ensController: aislamiento por tenant', () => {
  // ensService ya resolvia el tenantId desde el usuario al crear
  // (ensService.js: tenantId: data.tenantId || user?.tenantId), asi que aqui
  // solo faltaba el guard en las lecturas por id.
  let ensController;
  beforeEach(() => {
    jest.clearAllMocks();
    ensController = require('../../src/controllers/ensController');
  });

  test('404 al leer una declaracion ENS de otro tenant', async () => {
    mockENS.findById.mockResolvedValue({ _id: 'n1', tenantId: 't2', mrn: '26ES1' });

    const res = await request(app(ensController.amend, 'post', '/r/:id')).post('/r/n1').send({});

    expect(res.status).toBe(404);
  });

  test('deja pasar la declaracion del propio tenant', async () => {
    mockENS.findById.mockResolvedValue({ _id: 'n1', tenantId: 't1', mrn: '26ES1' });

    const res = await request(app(ensController.amend, 'post', '/r/:id')).post('/r/n1').send({});

    expect(res.status).not.toBe(404);
  });
});
