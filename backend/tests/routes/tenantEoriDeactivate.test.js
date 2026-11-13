/**
 * PUT /api/tenant/eori debe REEMPLAZAR el mapa de EORI por pais, no fusionarlo.
 *
 * Ajustes > Paises y Aduanas: el frontend (TenantSettings.jsx CustomsTab)
 * manda siempre el mapa completo de los paises que quedan ACTIVOS tras el
 * toggle. Si el handler fusiona ese mapa con el que ya habia en el tenant
 * (`{ ...existente, ...nuevo }`), el EORI de un pais que el usuario acaba de
 * desactivar nunca se borra: sigue en `customsConfig.eoriNumbers` aunque el
 * pais ya no aparezca activo en pantalla.
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

describe('PUT /api/tenant/eori — desactivar un pais quita su EORI', () => {
  test('el pais que no viene en el body desaparece del mapa guardado', async () => {
    const sufijo = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
    const tenant = await Tenant.create({
      name: 'Tenant Multi-pais',
      slug: `multi-pais-${sufijo}`,
      businessInfo: { eori: 'ESA0000000A' },
      customsConfig: { country: 'ES', eoriNumbers: { ES: 'ESA0000000A', NL: 'NLA0000000A' } }
    });
    const admin = { _id: tenant._id, id: 'admin', role: 'admin', tenantId: tenant._id };

    // El usuario desactiva NL en pantalla: el payload solo trae ES, el pais que queda activo.
    const res = await request(crearApp(admin))
      .put('/api/tenant/eori')
      .send({ eoriNumbers: { ES: 'ESA0000000A' } });

    expect(res.status).toBe(200);
    const tras = await Tenant.findById(tenant._id).lean();
    expect(tras.customsConfig.eoriNumbers).toEqual({ ES: 'ESA0000000A' });
  });

  test('actualizar el EORI de un pais activo no afecta a los demas paises activos', async () => {
    const sufijo = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
    const tenant = await Tenant.create({
      name: 'Tenant Multi-pais 2',
      slug: `multi-pais2-${sufijo}`,
      businessInfo: { eori: 'ESA0000000A' },
      customsConfig: { country: 'ES', eoriNumbers: { ES: 'ESA0000000A', NL: 'NLA0000000A' } }
    });
    const admin = { _id: tenant._id, id: 'admin', role: 'admin', tenantId: tenant._id };

    // Los dos paises siguen activos: el payload trae los dos, uno con el EORI corregido.
    const res = await request(crearApp(admin))
      .put('/api/tenant/eori')
      .send({ eoriNumbers: { ES: 'ESA0000000B', NL: 'NLA0000000A' } });

    expect(res.status).toBe(200);
    const tras = await Tenant.findById(tenant._id).lean();
    expect(tras.customsConfig.eoriNumbers).toEqual({ ES: 'ESA0000000B', NL: 'NLA0000000A' });
  });
});
