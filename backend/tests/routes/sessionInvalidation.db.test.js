/**
 * Arreglo 1 de la revision de seguridad del 4.2 (invitar usuarios):
 *
 * - Un token emitido ANTES de cambiar la contrasena deja de valer despues
 *   (incluye refresh-token, que pasa por el mismo middleware auth).
 * - El login con una contrasena temporal pendiente de cambio (mustChangePassword)
 *   emite un token de vida corta (15 min), no el de 7 dias habitual.
 * - PUT /api/auth/password devuelve un token nuevo tras el cambio.
 * - La caducidad de 72h de la temporal se comprueba tambien en PUT /password,
 *   no solo en el login.
 *
 * Mismo patron que adminInvite.db.test.js: router real, Mongo en memoria, JWT real.
 */

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

beforeEach(async () => {
  tenantA = await Tenant.create({
    name: 'Tenant A',
    slug: `tenant-a-${Date.now()}-${Math.round(performance.now() * 1000)}`,
    businessInfo: { eori: 'ESA0000000A' },
    customsConfig: { eoriNumbers: { ES: 'ESA0000000A' } }
  });
});

describe('un token deja de valer tras cambiar la contrasena', () => {
  test('el token viejo es rechazado; refresh-token con el tambien falla', async () => {
    const app = crearApp();
    const user = await User.create({
      email: 'sesion@t-a.es', password: 'Password123!', name: 'Sesion Test',
      role: 'agent', tenantId: tenantA._id, isActive: true
    });
    const tokenViejo = user.generateAuthToken();

    // El token viejo funciona antes del cambio.
    const antes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenViejo}`);
    expect(antes.status).toBe(200);

    const cambio = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${tokenViejo}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NuevaPassword456' });
    expect(cambio.status).toBe(200);
    const tokenNuevo = cambio.body.data.token;
    expect(tokenNuevo).toBeTruthy();
    expect(tokenNuevo).not.toBe(tokenViejo);

    const despuesViejo = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenViejo}`);
    expect(despuesViejo.status).toBe(401);

    const refreshViejo = await request(app).post('/api/auth/refresh-token').set('Authorization', `Bearer ${tokenViejo}`);
    expect(refreshViejo.status).toBe(401);

    const despuesNuevo = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenNuevo}`);
    expect(despuesNuevo.status).toBe(200);
  });
});

describe('token de vida corta mientras hay una contrasena temporal pendiente', () => {
  function decodificar(token) {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  }

  test('el login con la temporal emite un token que caduca en 15 min, no en el plazo normal', async () => {
    const app = crearApp();
    const admin = await User.create({
      email: 'admin-sesion@t-a.es', password: 'Password123!', name: 'Admin',
      role: 'admin', tenantId: tenantA._id, isActive: true
    });

    const invite = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
      .send({ email: 'temporal@t-a.es', name: 'Con Temporal', role: 'agent' });
    expect(invite.status).toBe(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'temporal@t-a.es', password: invite.body.data.temporaryPassword });
    expect(login.status).toBe(200);

    const payloadTemporal = decodificar(login.body.data.token);
    expect(payloadTemporal.exp - payloadTemporal.iat).toBeLessThanOrEqual(15 * 60);

    const payloadAdmin = decodificar(admin.generateAuthToken());
    expect(payloadAdmin.exp - payloadAdmin.iat).toBeGreaterThan(15 * 60);
  });

  test('tras cambiar la contrasena, el token nuevo ya no es de vida corta', async () => {
    const app = crearApp();
    const admin = await User.create({
      email: 'admin-sesion2@t-a.es', password: 'Password123!', name: 'Admin',
      role: 'admin', tenantId: tenantA._id, isActive: true
    });
    const invite = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
      .send({ email: 'temporal2@t-a.es', name: 'Con Temporal', role: 'agent' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'temporal2@t-a.es', password: invite.body.data.temporaryPassword });

    const cambio = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ currentPassword: invite.body.data.temporaryPassword, newPassword: 'DefinitivaSegura1' });
    expect(cambio.status).toBe(200);

    const payloadDefinitivo = decodificar(cambio.body.data.token);
    expect(payloadDefinitivo.exp - payloadDefinitivo.iat).toBeGreaterThan(15 * 60);
  });
});

describe('la caducidad de 72h tambien se comprueba en PUT /api/auth/password', () => {
  test('con la temporal caducada, el cambio de contrasena da 401 aunque el token siga vivo', async () => {
    const app = crearApp();
    const admin = await User.create({
      email: 'admin-sesion3@t-a.es', password: 'Password123!', name: 'Admin',
      role: 'admin', tenantId: tenantA._id, isActive: true
    });
    const invite = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
      .send({ email: 'caducaenPassword@t-a.es', name: 'Caduca', role: 'agent' });
    const temporal = invite.body.data.temporaryPassword;

    const invitado = await User.findOne({ email: 'caducaenPassword@t-a.es' });
    const tokenInvitado = invitado.generateAuthToken();
    await User.updateOne(
      { email: 'caducaenPassword@t-a.es' },
      { $set: { tempPasswordExpires: new Date(Date.now() - 1000) } }
    );

    const cambio = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${tokenInvitado}`)
      .send({ currentPassword: temporal, newPassword: 'OtraSeguraDefinitiva1' });

    expect(cambio.status).toBe(401);
    expect(cambio.body.code).toBe('TEMP_PASSWORD_EXPIRED');
  });
});
