/**
 * Arreglo 2 de la revision de seguridad del 4.2 (invitar usuarios):
 *
 * - PUT /api/auth/password exige que newPassword tenga entre 10 y 128
 *   caracteres, con letras y numeros.
 * - Rechaza con 400 una newPassword igual a la actual (no se puede "cambiar"
 *   la temporal dejandola igual).
 * - La politica NUEVA solo se aplica al PONER una contrasena nueva aqui: no
 *   se tocó el minlength del esquema de User, asi que un usuario existente
 *   con una contrasena corta (de antes de este cambio) sigue pudiendo
 *   iniciar sesion sin problema.
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

async function crearUsuarioYToken(password = 'Password123!') {
  const user = await User.create({
    email: `politica-${Date.now()}-${Math.round(performance.now() * 1000)}@t-a.es`,
    password, name: 'Usuario Politica', role: 'agent', tenantId: tenantA._id, isActive: true
  });
  return { user, token: user.generateAuthToken() };
}

describe('PUT /api/auth/password exige una contrasena nueva fuerte', () => {
  test('400 si la nueva tiene menos de 10 caracteres', async () => {
    const { token } = await crearUsuarioYToken();
    const res = await request(crearApp())
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123!', newPassword: 'Corta1' });

    expect(res.status).toBe(400);
  });

  test('400 si la nueva no tiene ningun numero', async () => {
    const { token } = await crearUsuarioYToken();
    const res = await request(crearApp())
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123!', newPassword: 'SoloLetrasSinNumeros' });

    expect(res.status).toBe(400);
  });

  test('400 si la nueva no tiene ninguna letra', async () => {
    const { token } = await crearUsuarioYToken();
    const res = await request(crearApp())
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123!', newPassword: '1234567890123' });

    expect(res.status).toBe(400);
  });

  test('400 si la nueva es igual a la actual', async () => {
    const { token } = await crearUsuarioYToken('Password123!');
    const res = await request(crearApp())
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123!', newPassword: 'Password123!' });

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain('igual');
  });

  test('200 con una contrasena nueva que cumple la politica y es distinta', async () => {
    const { token } = await crearUsuarioYToken('Password123!');
    const res = await request(crearApp())
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NuevaValida99' });

    expect(res.status).toBe(200);
  });

  // BAJO-C de la 2a revision de seguridad del 4.2: un valor no-string no debe
  // llegar a .length ni a una regex (eso es un 500, no una validacion).
  test('400 (no 500) si la nueva llega como array', async () => {
    const { token } = await crearUsuarioYToken();
    const res = await request(crearApp())
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123!', newPassword: ['NuevaValida99', 'OtraMas1'] });

    expect(res.status).toBe(400);
  });
});

describe('la politica nueva no rompe a usuarios existentes con contrasena corta', () => {
  test('un usuario creado antes de este cambio (password corta) sigue pudiendo iniciar sesion', async () => {
    await User.create({
      email: 'legacy@t-a.es', password: 'abc123', name: 'Legacy', role: 'agent',
      tenantId: tenantA._id, isActive: true
    });

    const res = await request(crearApp())
      .post('/api/auth/login')
      .send({ email: 'legacy@t-a.es', password: 'abc123' });

    expect(res.status).toBe(200);
  });
});

// BAJO-C: la misma politica (10-128, letra+numero, .isString()) tambien en
// POST /api/auth/reset-password/:token, que antes solo exigia minlength 6.
describe('POST /api/auth/reset-password/:token exige la misma politica', () => {
  const crypto = require('crypto');

  async function crearUsuarioConTokenDeReset() {
    const user = await User.create({
      email: `reset-${Date.now()}-${Math.round(performance.now() * 1000)}@t-a.es`,
      password: 'Password123!', name: 'Usuario Reset', role: 'agent', tenantId: tenantA._id, isActive: true
    });
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save({ validateBeforeSave: false });
    return { user, token };
  }

  test('400 (no 500) si la password llega como array', async () => {
    const { token } = await crearUsuarioConTokenDeReset();
    const res = await request(crearApp())
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: ['NuevaValida99', 'OtraMas1'] });

    expect(res.status).toBe(400);
  });

  test('400 si la nueva no tiene ningun numero', async () => {
    const { token } = await crearUsuarioConTokenDeReset();
    const res = await request(crearApp())
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: 'SoloLetrasSinNumeros' });

    expect(res.status).toBe(400);
  });

  test('400 si la nueva tiene menos de 10 caracteres', async () => {
    const { token } = await crearUsuarioConTokenDeReset();
    const res = await request(crearApp())
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: 'Corta1' });

    expect(res.status).toBe(400);
  });

  test('200 con una contrasena que cumple la politica', async () => {
    const { token } = await crearUsuarioConTokenDeReset();
    const res = await request(crearApp())
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: 'NuevaValidaReset99' });

    expect(res.status).toBe(200);
  });
});
