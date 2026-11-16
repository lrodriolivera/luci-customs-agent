/**
 * GET /api/tenant/users/role-counts — usuarios activos del tenant por rol.
 *
 * Ajustes › Roles enseñaba recuentos de demostración fijos (2/5/12/8/3) que no
 * tenían nada que ver con el tenant (el de pruebas tiene 4 admin, 1 agent y 1
 * supervisor). Ahora se cuentan en la base de datos, acotados al tenant del
 * usuario.
 */

const express = require('express');
const request = require('supertest');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/middleware/auth', () => {
  const auth = (req, res, next) => { req.user = req.app.get('testUser'); next(); };
  return { auth, requireAuth: auth, requirePermission: () => (req, res, next) => next() };
});

const Tenant = require('../../src/models/Tenant');
const User = require('../../src/models/User');

usarBaseDeDatosEnMemoria();

function crearApp(user) {
  const app = express();
  app.use(express.json());
  app.set('testUser', user);
  app.use('/api', require('../../src/routes/tenant'));
  return app;
}

let contador = 0;
const sufijo = () => `${Date.now()}-${contador++}`;

async function crearTenantConUsuarios(roles, extra = []) {
  const tenant = await Tenant.create({ name: 'Tenant', slug: `tenant-${sufijo()}` });
  for (const role of roles) {
    await User.create({ email: `u-${sufijo()}@demo.es`, name: 'Usuario', role, tenantId: tenant._id });
  }
  for (const u of extra) {
    await User.create({ email: `u-${sufijo()}@demo.es`, name: 'Usuario', tenantId: tenant._id, ...u });
  }
  return tenant;
}

const usuario = (tenant, role) => ({ id: `u-${role}`, _id: `u-${role}`, role, tenantId: tenant._id });

describe('GET /api/tenant/users/role-counts', () => {
  test('cuenta los usuarios activos del tenant por rol', async () => {
    const tenant = await crearTenantConUsuarios(
      ['admin', 'admin', 'admin', 'admin', 'agent', 'supervisor'],
      [{ role: 'agent', isActive: false }]
    );

    const res = await request(crearApp(usuario(tenant, 'admin'))).get('/api/tenant/users/role-counts');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      counts: { admin: 4, supervisor: 1, agent: 1, viewer: 0 },
      total: 6
    });
  });

  test('no cuenta usuarios de otros tenants', async () => {
    const propio = await crearTenantConUsuarios(['admin']);
    await crearTenantConUsuarios(['admin', 'agent', 'agent', 'viewer']);

    const res = await request(crearApp(usuario(propio, 'admin')))
      .get('/api/tenant/users/role-counts');

    expect(res.body.data.counts).toEqual({ admin: 1, supervisor: 0, agent: 0, viewer: 0 });
    expect(res.body.data.total).toBe(1);
  });

  test('un supervisor puede verlos (ve la pestaña de roles)', async () => {
    const tenant = await crearTenantConUsuarios(['admin', 'supervisor']);

    const res = await request(crearApp(usuario(tenant, 'supervisor'))).get('/api/tenant/users/role-counts');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
  });

  test.each(['agent', 'viewer'])('un %s recibe 403', async (role) => {
    const tenant = await crearTenantConUsuarios(['admin']);

    const res = await request(crearApp(usuario(tenant, role))).get('/api/tenant/users/role-counts');

    expect(res.status).toBe(403);
  });
});
