/**
 * PUT /api/tenant/general — Ajustes › General guarda de verdad los datos de la
 * empresa (antes el botón «Guardar cambios» era un setTimeout que solo
 * mostraba «guardado»).
 *
 * Se guardan: nombre de la organización, REA y dirección (la dirección la usa
 * el H7 como dirección del declarante). NO se tocan aquí el NIF, el EORI, el
 * tipo de organización ni el slug: el EORI tiene su pantalla (Ajustes ›
 * Aduanas), el NIF es un dato fiscal cifrado que no se cambia desde Ajustes y
 * el tipo decide si el tenant actúa como parte o como representante ante la
 * AEAT.
 */

const express = require('express');
const request = require('supertest');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/middleware/auth', () => {
  const auth = (req, res, next) => { req.user = req.app.get('testUser'); next(); };
  return { auth, requireAuth: auth, requirePermission: () => (req, res, next) => next() };
});

const Tenant = require('../../src/models/Tenant');

usarBaseDeDatosEnMemoria();

function crearApp(user) {
  const app = express();
  app.use(express.json());
  app.set('testUser', user);
  app.use('/api', require('../../src/routes/tenant'));
  return app;
}

const sufijo = () => `${Date.now()}-${Math.round(performance.now() * 1000)}`;

async function crearTenant(extra = {}) {
  return Tenant.create({
    name: 'Aduanas Demo',
    slug: `aduanas-demo-${sufijo()}`,
    businessInfo: {
      type: 'customs_agent',
      nif: 'B12345678',
      eori: 'ESB12345678',
      rea: 'REA-1',
      address: { street: 'Calle Vieja 1', city: 'Zaragoza', postalCode: '50001', province: 'Zaragoza', country: 'ES' }
    },
    ...extra
  });
}

const usuario = (tenant, role) => ({ id: `u-${role}`, _id: `u-${role}`, role, tenantId: tenant._id });

const cambiosValidos = {
  name: 'Aduanas Nuevo Nombre',
  rea: 'REA-2',
  address: { street: 'Avenida Nueva 22', city: 'Madrid', province: 'Madrid', postalCode: '28001', country: 'es' }
};

describe('PUT /api/tenant/general', () => {
  test('un admin guarda nombre, REA y dirección y recibe el tenant actualizado', async () => {
    const tenant = await crearTenant();

    const res = await request(crearApp(usuario(tenant, 'admin')))
      .put('/api/tenant/general')
      .send(cambiosValidos);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Aduanas Nuevo Nombre');
    expect(res.body.data.businessInfo.address.country).toBe('ES');

    const tras = await Tenant.findById(tenant._id).lean();
    expect(tras.name).toBe('Aduanas Nuevo Nombre');
    expect(tras.businessInfo.rea).toBe('REA-2');
    expect(tras.businessInfo.address).toEqual({
      street: 'Avenida Nueva 22', city: 'Madrid', province: 'Madrid', postalCode: '28001', country: 'ES'
    });
  });

  test('no toca NIF, EORI ni tipo de organización', async () => {
    const tenant = await crearTenant();

    await request(crearApp(usuario(tenant, 'admin'))).put('/api/tenant/general').send(cambiosValidos);

    const tras = await Tenant.findById(tenant._id).lean();
    expect(tras.businessInfo.nif).toBe('B12345678');
    expect(tras.businessInfo.eori).toBe('ESB12345678');
    expect(tras.businessInfo.type).toBe('customs_agent');
    expect(tras.slug).toBe(tenant.slug);
  });

  test('rechaza con 400 los campos que no se editan desde esta pantalla', async () => {
    const tenant = await crearTenant();

    const res = await request(crearApp(usuario(tenant, 'admin')))
      .put('/api/tenant/general')
      .send({ ...cambiosValidos, nif: 'X0000000T', eori: 'ESX0000000T', slug: 'otro', type: 'importer' });

    expect(res.status).toBe(400);
    const tras = await Tenant.findById(tenant._id).lean();
    expect(tras.name).toBe('Aduanas Demo');
    expect(tras.businessInfo.nif).toBe('B12345678');
  });

  test.each([
    ['nombre vacío', { name: '   ' }],
    ['nombre de más de 70 caracteres', { name: 'x'.repeat(71) }],
    ['país que no es un código de dos letras', { address: { ...cambiosValidos.address, country: 'España' } }],
    ['calle de más de 70 caracteres', { address: { ...cambiosValidos.address, street: 'c'.repeat(71) } }],
    ['ciudad de más de 35 caracteres', { address: { ...cambiosValidos.address, city: 'c'.repeat(36) } }],
    ['código postal de más de 17 caracteres', { address: { ...cambiosValidos.address, postalCode: '1'.repeat(18) } }],
    ['REA de más de 35 caracteres', { rea: 'r'.repeat(36) }],
    ['nombre que no es texto', { name: { $gt: '' } }]
  ])('rechaza con 400: %s', async (_caso, cambios) => {
    const tenant = await crearTenant();

    const res = await request(crearApp(usuario(tenant, 'admin')))
      .put('/api/tenant/general')
      .send({ ...cambiosValidos, ...cambios });

    expect(res.status).toBe(400);
    const tras = await Tenant.findById(tenant._id).lean();
    expect(tras.name).toBe('Aduanas Demo');
  });

  test.each(['supervisor', 'agent', 'viewer'])('un %s recibe 403 y no cambia nada', async (rol) => {
    const tenant = await crearTenant();

    const res = await request(crearApp(usuario(tenant, rol)))
      .put('/api/tenant/general')
      .send(cambiosValidos);

    expect(res.status).toBe(403);
    const tras = await Tenant.findById(tenant._id).lean();
    expect(tras.name).toBe('Aduanas Demo');
  });

  test('solo modifica el tenant del usuario, nunca otro', async () => {
    const propio = await crearTenant();
    const ajeno = await crearTenant({ name: 'Otra Empresa' });

    const res = await request(crearApp(usuario(propio, 'admin')))
      .put('/api/tenant/general')
      .set('X-Tenant-ID', String(ajeno._id))
      .send(cambiosValidos);

    expect(res.status).toBe(200);
    expect((await Tenant.findById(ajeno._id).lean()).name).toBe('Otra Empresa');
    expect((await Tenant.findById(propio._id).lean()).name).toBe('Aduanas Nuevo Nombre');
  });

  test('con el NIF cifrado en la BD, guardar no lo altera y GET /tenant/me lo sigue mostrando en claro', async () => {
    const { encrypt, isEncrypted } = require('../../src/utils/piiCrypto');
    const anterior = process.env.PII_ENCRYPTION_KEY;
    process.env.PII_ENCRYPTION_KEY = 'a'.repeat(64);
    try {
      const tenant = await crearTenant();
      const nifCifrado = encrypt('B12345678');
      expect(isEncrypted(nifCifrado)).toBe(true);
      await Tenant.collection.updateOne({ _id: tenant._id }, { $set: { 'businessInfo.nif': nifCifrado } });

      const app = crearApp(usuario(tenant, 'admin'));
      const res = await request(app).put('/api/tenant/general').send(cambiosValidos);
      expect(res.status).toBe(200);
      expect(res.body.data.businessInfo.nif).toBe('B12345678');

      const crudo = await Tenant.collection.findOne({ _id: tenant._id });
      expect(crudo.businessInfo.nif).toBe(nifCifrado);
    } finally {
      if (anterior === undefined) delete process.env.PII_ENCRYPTION_KEY;
      else process.env.PII_ENCRYPTION_KEY = anterior;
    }
  });
});
