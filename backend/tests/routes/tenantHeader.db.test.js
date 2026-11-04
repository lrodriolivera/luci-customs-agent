/**
 * La cabecera X-Tenant-ID no da acceso a otro tenant a traves de las rutas de
 * /api/tenant*.
 *
 * tenantRoutes se monta en /api antes que el resto de routers y su
 * router.use(extractTenant) copiaba X-Tenant-ID en req.tenantId antes de
 * autenticar. GET /api/tenant/me y GET/PUT /api/tenant/eori leian y escribian
 * el tenant de esa cabecera, y las rutas del controller con requireTenant pero
 * sin auth respondian a cualquiera que la mandase (hallazgos F18, F35, F45 y
 * F63 del escaneo del 3/Nov/2026).
 *
 * Se monta el router real con Mongo en memoria. Solo se sustituye `auth` por
 * uno que carga el usuario indicado en la cabecera de test x-test-user.
 */

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const mockUsuarios = {};
jest.mock('../../src/middleware/auth', () => {
  const auth = (req, res, next) => {
    const user = mockUsuarios[req.headers['x-test-user']];
    if (!user) return res.status(401).json({ success: false, error: 'No autenticado' });
    req.user = user;
    next();
  };
  return { auth, requireAuth: auth, requirePermission: () => (req, res, next) => next() };
});
jest.mock('../../src/services/auditService', () => ({
  log: jest.fn(() => Promise.resolve()),
  middleware: (req, res, next) => next(),
  query: jest.fn()
}));

const Tenant = require('../../src/models/Tenant');
const tenantService = require('../../src/services/tenant/tenantService');
const auditService = require('../../src/services/auditService');

usarBaseDeDatosEnMemoria();

let tenantA, tenantB, demoA, demoB;

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', require('../../src/routes/tenant'));
  return app;
}

beforeEach(async () => {
  const sufijo = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
  tenantA = await Tenant.create({
    name: 'Tenant A', slug: `tenant-a-${sufijo}`,
    businessInfo: { eori: 'ESA0000000A' }, customsConfig: { eoriNumbers: { ES: 'ESA0000000A' } }
  });
  tenantB = await Tenant.create({
    name: 'Tenant B', slug: `tenant-b-${sufijo}`,
    businessInfo: { eori: 'ESB0000000B' }, customsConfig: { eoriNumbers: { ES: 'ESB0000000B' } }
  });
  // Tenants del Map en memoria, que es lo que usa tenantController.
  demoA = (await tenantService.createTenant({ name: 'Demo A', slug: `demo-a-${sufijo}` })).tenant;
  demoB = (await tenantService.createTenant({ name: 'Demo B', slug: `demo-b-${sufijo}` })).tenant;
  await tenantService.activateTenant(demoA.id);
  await tenantService.activateTenant(demoB.id);

  mockUsuarios.adminA = { _id: new mongoose.Types.ObjectId(), id: 'adminA', role: 'admin', tenantId: tenantA._id };
  mockUsuarios.adminDemoA = { _id: new mongoose.Types.ObjectId(), id: 'adminDemoA', role: 'admin', tenantId: demoA.id };
  mockUsuarios.superAdmin = { _id: new mongoose.Types.ObjectId(), id: 'super', role: 'super_admin', tenantId: tenantA._id };
  auditService.log.mockClear();
});

describe('GET /api/tenant/me', () => {
  test('un admin recibe su tenant aunque mande X-Tenant-ID de otro', async () => {
    const res = await request(crearApp())
      .get('/api/tenant/me')
      .set('x-test-user', 'adminA')
      .set('x-tenant-id', String(tenantB._id));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(String(tenantA._id));
    expect(res.body.data.name).toBe('Tenant A');
  });

  test('un super_admin puede leer otro tenant con la cabecera y queda auditado', async () => {
    const res = await request(crearApp())
      .get('/api/tenant/me')
      .set('x-test-user', 'superAdmin')
      .set('x-tenant-id', String(tenantB._id));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(String(tenantB._id));
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tenant_override', resourceId: String(tenantB._id)
    }));
  });
});

describe('GET/PUT /api/tenant/eori', () => {
  test('GET devuelve los EORI del propio tenant, no los de la cabecera', async () => {
    const res = await request(crearApp())
      .get('/api/tenant/eori')
      .set('x-test-user', 'adminA')
      .set('x-tenant-id', String(tenantB._id));

    expect(res.status).toBe(200);
    expect(res.body.data.defaultEori).toBe('ESA0000000A');
  });

  test('PUT escribe en el propio tenant y deja intacto el de la cabecera', async () => {
    const res = await request(crearApp())
      .put('/api/tenant/eori')
      .set('x-test-user', 'adminA')
      .set('x-tenant-id', String(tenantB._id))
      .send({ eoriNumbers: { ES: 'ESPWNED0001' } });

    expect(res.status).toBe(200);
    const b = await Tenant.findById(tenantB._id).lean();
    const a = await Tenant.findById(tenantA._id).lean();
    expect(b.customsConfig.eoriNumbers.ES).toBe('ESB0000000B');
    expect(a.customsConfig.eoriNumbers.ES).toBe('ESPWNED0001');
  });
});

describe('rutas de tenantController con contexto de tenant', () => {
  test('sin autenticar no hay contexto de tenant aunque se mande la cabecera', async () => {
    const res = await request(crearApp())
      .get('/api/tenant/settings')
      .set('x-tenant-id', demoB.id);

    expect(res.status).not.toBe(200);
    expect(res.body.settings).toBeUndefined();
  });

  test('GET /api/tenant/settings devuelve los del propio tenant, no los de la cabecera', async () => {
    const res = await request(crearApp())
      .get('/api/tenant/settings')
      .set('x-test-user', 'adminDemoA')
      .set('x-tenant-id', demoB.id);

    expect(res.status).toBe(200);
    expect(res.body.settings).toEqual(tenantService.getTenant(demoA.id).tenant.settings);
  });

  test('GET /api/tenant devuelve el propio tenant, no el de la cabecera', async () => {
    const res = await request(crearApp())
      .get('/api/tenant')
      .set('x-test-user', 'adminDemoA')
      .set('x-tenant-id', demoB.id);

    expect(res.status).toBe(200);
    expect(res.body.tenant.id).toBe(demoA.id);
  });

  test('los catalogos publicos siguen abiertos sin autenticar', async () => {
    const res = await request(crearApp()).get('/api/tenant/plans');
    expect(res.status).toBe(200);
  });
});
