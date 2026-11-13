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
    // El frontend habilita paises con EORI + el pais base del tenant
    expect(res.body.data.country).toBe('ES');
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

  test('GET /api/tenant cae a Mongo cuando el tenant del usuario no esta en el Map de demo (caso real de produccion)', async () => {
    // adminA tiene tenantId = tenantA._id (documento real de Mongo), que no
    // existe en el Map de tenantService. Antes del arreglo, req.tenant salia
    // null y la ruta respondia 400 "No tenant context": la pestana General de
    // Ajustes se quedaba vacia para cualquier tenant real.
    const res = await request(crearApp())
      .get('/api/tenant')
      .set('x-test-user', 'adminA');

    expect(res.status).toBe(200);
    expect(res.body.tenant.id).toBe(String(tenantA._id));
    expect(res.body.tenant.name).toBe('Tenant A');
    expect(res.body.tenant.businessInfo.eori).toBe('ESA0000000A');
  });

  test('GET /api/tenant con tenant real no existente en Mongo responde 404', async () => {
    const idInexistente = new mongoose.Types.ObjectId();
    mockUsuarios.adminFantasma = { _id: new mongoose.Types.ObjectId(), id: 'adminFantasma', role: 'admin', tenantId: idInexistente };

    const res = await request(crearApp())
      .get('/api/tenant')
      .set('x-test-user', 'adminFantasma');

    expect(res.status).toBe(404);
  });

  test('los catalogos publicos siguen abiertos sin autenticar', async () => {
    const res = await request(crearApp()).get('/api/tenant/plans');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/tenant y /api/tenant/me nunca devuelven el EORI/NIF cifrado', () => {
  const PII_KEY_PREVIO = process.env.PII_ENCRYPTION_KEY;
  const ENCRYPT_PREVIO = process.env.ENCRYPT_PII;

  beforeEach(() => {
    process.env.PII_ENCRYPTION_KEY = 'x'.repeat(32);
    process.env.ENCRYPT_PII = 'true';
  });

  afterEach(() => {
    if (PII_KEY_PREVIO === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = PII_KEY_PREVIO;
    if (ENCRYPT_PREVIO === undefined) delete process.env.ENCRYPT_PII;
    else process.env.ENCRYPT_PII = ENCRYPT_PREVIO;
  });

  test('GET /api/tenant/me y GET /api/tenant descifran nif/eori antes de responder', async () => {
    const tenantCifrado = await Tenant.create({
      name: 'Tenant Cifrado',
      slug: `tenant-cifrado-${Date.now()}`,
      businessInfo: { nif: 'B99999999', eori: 'ESB99999999' }
    });
    mockUsuarios.adminCifrado = {
      _id: new mongoose.Types.ObjectId(), id: 'adminCifrado', role: 'admin', tenantId: tenantCifrado._id
    };

    // El valor guardado en Mongo esta cifrado (prefijo v1:)
    const crudo = await mongoose.connection.collection('tenants').findOne({ _id: tenantCifrado._id });
    expect(crudo.businessInfo.eori.startsWith('v1:')).toBe(true);
    expect(crudo.businessInfo.nif.startsWith('v1:')).toBe(true);

    const resMe = await request(crearApp()).get('/api/tenant/me').set('x-test-user', 'adminCifrado');
    expect(resMe.status).toBe(200);
    expect(resMe.body.data.businessInfo.eori).toBe('ESB99999999');
    expect(resMe.body.data.businessInfo.nif).toBe('B99999999');
    expect(resMe.body.data.businessInfo.eori.startsWith('v1:')).toBe(false);

    const resLegacy = await request(crearApp()).get('/api/tenant').set('x-test-user', 'adminCifrado');
    expect(resLegacy.status).toBe(200);
    expect(resLegacy.body.tenant.businessInfo.eori).toBe('ESB99999999');
    expect(resLegacy.body.tenant.businessInfo.nif).toBe('B99999999');
    expect(resLegacy.body.tenant.businessInfo.eori.startsWith('v1:')).toBe(false);
  });
});

describe('GET/PUT /api/tenant/h1 (cómo se presenta el H1)', () => {
  const CONTACTO = { name: 'Ana Ruiz', phone: '+34 910000000', email: 'aduanas@agencia.es' };
  const put = (cuerpo, usuario = 'adminA') => request(crearApp()).put('/api/tenant/h1').set('x-test-user', usuario).send(cuerpo);

  test('sin configurar devuelve el servicio anterior, pago previo y sin garantía', async () => {
    const res = await request(crearApp()).get('/api/tenant/h1').set('x-test-user', 'adminA');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ h1Service: 'precau', medioDePago: 'A', garantiaGRN: '', contacto: { name: '', phone: '', email: '' } });
  });

  test('guarda servicio, pago, garantía y contacto en el propio tenant, no en el de la cabecera', async () => {
    const res = await put({ h1Service: 'cau', medioDePago: 'R', garantiaGRN: '26esagl2800000054', contacto: CONTACTO })
      .set('x-tenant-id', String(tenantB._id));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ h1Service: 'cau', medioDePago: 'R', garantiaGRN: '26ESAGL2800000054', contacto: CONTACTO });
    const [a, b] = await Promise.all([Tenant.findById(tenantA._id).lean(), Tenant.findById(tenantB._id).lean()]);
    expect(a.customsConfig).toMatchObject({ h1Service: 'cau', medioDePago: 'R', garantiaGRN: '26ESAGL2800000054', eoriNumbers: { ES: 'ESA0000000A' } });
    expect(a.primaryContact).toMatchObject(CONTACTO);
    expect(b.customsConfig.h1Service).toBeUndefined();
  });

  test('el pago aplazado sin garantía no se guarda', async () => {
    const res = await put({ medioDePago: 'R' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('GRN');
    expect((await Tenant.findById(tenantA._id).lean()).customsConfig.medioDePago).toBeUndefined();
  });

  test('rechaza valores no válidos sin guardar nada', async () => {
    const res = await put({ h1Service: 'otro', medioDePago: 'Z', garantiaGRN: '123', contacto: { name: 'Ana', phone: '', email: 'sin-arroba' } });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(5);
    expect((await Tenant.findById(tenantA._id).lean()).primaryContact).toBeUndefined();
  });

  test('exige sesión', async () => {
    expect((await request(crearApp()).get('/api/tenant/h1')).status).toBe(401);
    expect((await request(crearApp()).put('/api/tenant/h1').send({ h1Service: 'cau' })).status).toBe(401);
  });
});
