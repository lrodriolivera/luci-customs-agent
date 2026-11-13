/**
 * Arreglo final (antes del PR) del 4.2: POST /api/auth/register usaba su
 * propia regla (minlength 6) en vez de la politica unica (BAJO-C de la 2a
 * revision: .isString(), 10-128 caracteres, letra y numero) que ya aplican
 * changePassword, reset-password y adminController.createUser/updateUser.
 * Un registro publico con 'abc123' quedaba fuera de esa politica sin que
 * nadie lo notara.
 */

const express = require('express');
const request = require('supertest');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const auditService = require('../../src/services/auditService');

usarBaseDeDatosEnMemoria();

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(auditService.middleware);
  app.use('/api/auth', require('../../src/routes/auth'));
  return app;
}

describe('POST /api/auth/register exige la misma politica de contrasena', () => {
  test('400 con una contrasena corta tipo abc123', async () => {
    const res = await request(crearApp())
      .post('/api/auth/register')
      .send({ email: 'nuevo@ejemplo.es', password: 'abc123', name: 'Nuevo', companyName: 'Empresa Nueva' });

    expect(res.status).toBe(400);
  });

  test('400 si la contrasena llega como array', async () => {
    const res = await request(crearApp())
      .post('/api/auth/register')
      .send({ email: 'nuevo2@ejemplo.es', password: ['a', 'b'], name: 'Nuevo', companyName: 'Empresa Nueva' });

    expect(res.status).toBe(400);
  });

  test('201 con una contrasena que cumple la politica', async () => {
    const res = await request(crearApp())
      .post('/api/auth/register')
      .send({ email: 'nuevo3@ejemplo.es', password: 'PasswordValida1', name: 'Nuevo', companyName: 'Empresa Nueva' });

    expect(res.status).toBe(201);
  });
});
