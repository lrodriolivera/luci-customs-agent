/**
 * BAJO-4 de la 2a revision de seguridad del 4.2 (invitar usuarios): ademas
 * del cupo por admin (routes/auth.js, 20/hora por usuario), un tope por
 * TENANT, para que no se pueda esquivar el cupo por admin creando varios
 * admins -- cada uno por debajo de su propio limite, pero sumando muchas
 * invitaciones en el mismo tenant.
 *
 * Fichero aparte (no el mismo que adminInvite.db.test.js) porque el
 * limitador vive a nivel de modulo: compartir fichero con otras decenas de
 * llamadas a /admin/invite haria el contador del tenant impredecible segun
 * el orden de ejecucion de los tests.
 *
 * El limite de produccion es 50/dia (ADMIN_INVITE_TENANT_DAILY_LIMIT, ver
 * routes/auth.js); aqui se baja a 3 via variable de entorno para no
 * necesitar 50+ peticiones reales (cada una con su propio hash bcrypt) solo
 * para probarlo.
 */

process.env.ADMIN_INVITE_TENANT_DAILY_LIMIT = '3';

const express = require('express');
const request = require('supertest');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const auditService = require('../../src/services/auditService');

usarBaseDeDatosEnMemoria();

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(auditService.middleware);
  app.use('/api/auth', require('../../src/routes/auth'));
  return app;
}

let tenantA;
let tenantB;

beforeEach(async () => {
  const sufijo = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
  tenantA = await Tenant.create({
    name: 'Tenant Cupo A', slug: `tenant-cupo-a-${sufijo}`, status: 'active',
    businessInfo: { eori: 'ESCUPOA001' }
  });
  tenantB = await Tenant.create({
    name: 'Tenant Cupo B', slug: `tenant-cupo-b-${sufijo}`, status: 'active',
    businessInfo: { eori: 'ESCUPOB001' }
  });
});

async function crearAdmin(tenantId, sufijo) {
  const admin = await User.create({
    email: `admin-cupo-${sufijo}@ejemplo.es`, password: 'Password123!', name: 'Admin Cupo',
    role: 'admin', tenantId, isActive: true
  });
  return admin;
}

describe('cupo de invitaciones por tenant (ademas del cupo por admin)', () => {
  test('tres admins distintos del MISMO tenant, cada uno bajo su propio limite, agotan el cupo del tenant', async () => {
    const app = crearApp();

    for (let i = 0; i < 3; i++) {
      const admin = await crearAdmin(tenantA._id, `mismo-tenant-${i}`);
      const res = await request(app)
        .post('/api/auth/admin/invite')
        .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
        .send({ email: `invitado-cupo-${i}@t-a.es`, name: 'Invitado', role: 'agent' });
      expect(res.status).toBe(201);
    }

    // Un CUARTO admin, que nunca ha invitado a nadie (muy por debajo de su
    // propio limite de 20/hora), topa con el cupo del TENANT.
    const cuartoAdmin = await crearAdmin(tenantA._id, 'mismo-tenant-cuarto');
    const res = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${cuartoAdmin.generateAuthToken()}`)
      .send({ email: 'invitado-cupo-cuarto@t-a.es', name: 'Invitado', role: 'agent' });

    expect(res.status).toBe(429);
  });

  test('el cupo es por tenant: otro tenant no se ve afectado', async () => {
    const app = crearApp();

    // Agota el cupo de tenantA.
    for (let i = 0; i < 3; i++) {
      const admin = await crearAdmin(tenantA._id, `agotar-${i}`);
      await request(app)
        .post('/api/auth/admin/invite')
        .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
        .send({ email: `agotar-invitado-${i}@t-a.es`, name: 'Invitado', role: 'agent' });
    }

    const adminB = await crearAdmin(tenantB._id, 'otro-tenant');
    const res = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${adminB.generateAuthToken()}`)
      .send({ email: 'invitado-otro-tenant@t-b.es', name: 'Invitado', role: 'agent' });

    expect(res.status).toBe(201);
  });
});
