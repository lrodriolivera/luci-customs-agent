/**
 * Saneo de los mensajes de error que salen al cliente.
 *
 * 448 catch de los controllers responden con `error: error.message`. Verificado
 * contra produccion: GET /api/oea/<id-malformado> devolvia
 *   "Cast to ObjectId failed for value \"xxx\" ... for model \"OEA\""
 * exponiendo los nombres de los modelos y la estructura de la BD.
 *
 * El riesgo del middleware es el contrario: si sanea de mas, el usuario deja de
 * ver mensajes que necesita ("Contrasena incorrecta", "Saldo insuficiente").
 * Por eso la mitad de estos tests comprueban lo que NO debe tocarse.
 */

const request = require('supertest');
const express = require('express');

const { sanitizeErrors, delataInterno, MENSAJE_GENERICO } = require('../../src/middleware/sanitizeErrors');

/** App que devuelve el cuerpo indicado, pasando por el saneador. */
function app(cuerpo, status = 500) {
  const a = express();
  a.use(sanitizeErrors);
  a.get('/r', (_req, res) => res.status(status).json(cuerpo));
  return a;
}

const previo = process.env.NODE_ENV;
beforeAll(() => { process.env.NODE_ENV = 'production'; });
afterAll(() => { process.env.NODE_ENV = previo; });

describe('sanitizeErrors: bloquea lo que delata infraestructura', () => {
  test('el CastError de Mongoose, que incluye el nombre del modelo', async () => {
    const res = await request(app({
      success: false,
      error: 'Cast to ObjectId failed for value "xxx" (type string) at path "_id" for model "OEA"'
    })).get('/r');

    expect(res.body.error).toBe(MENSAJE_GENERICO);
    expect(JSON.stringify(res.body)).not.toMatch(/OEA|ObjectId/);
  });

  test('los errores de conexion, que llevan host y puerto', async () => {
    const res = await request(app({
      success: false,
      error: 'connect ECONNREFUSED mongo:27017'
    })).get('/r');

    expect(res.body.error).toBe(MENSAJE_GENERICO);
  });

  test('las cadenas de conexion', async () => {
    const res = await request(app({
      success: false,
      error: 'failed to connect to mongodb://usuario:clave@mongo:27017/luci'
    })).get('/r');

    expect(JSON.stringify(res.body)).not.toMatch(/mongodb:\/\/|clave/);
  });

  test('las rutas absolutas del servidor', async () => {
    const res = await request(app({
      success: false,
      error: "ENOENT: no such file, open '/srv/homelab/luci/certs/strixai_fnmt.p12'"
    })).get('/r');

    expect(JSON.stringify(res.body)).not.toMatch(/srv|homelab|p12/);
  });

  test('las trazas de pila coladas en el mensaje', async () => {
    const res = await request(app({
      success: false,
      error: 'TypeError: x is not a function\n    at Object.<anonymous> (/app/src/x.js:1:1)'
    })).get('/r');

    expect(res.body.error).toBe(MENSAJE_GENERICO);
  });

  test('el duplicate key, que expone coleccion y campos', async () => {
    const res = await request(app({
      success: false,
      error: 'E11000 duplicate key error collection: luci.users index: email_1'
    })).get('/r');

    expect(JSON.stringify(res.body)).not.toMatch(/E11000|luci\.users/);
  });

  test('tambien saneo el campo message, no solo error', async () => {
    // Varios controllers usan { message } en vez de { error }.
    const res = await request(app({
      success: false,
      message: 'Cast to ObjectId failed for value "x" for model "Guarantee"'
    })).get('/r');

    expect(res.body.message).toBe(MENSAJE_GENERICO);
  });
});

describe('sanitizeErrors: NO toca los mensajes de negocio', () => {
  // Si saneara de mas, el usuario dejaria de ver por que fallo su operacion.
  test.each([
    'Credenciales invalidas',
    'Contrasena actual incorrecta',
    'Solicitud no encontrada',
    'Garantia no encontrada',
    'Saldo insuficiente en garantia. Disponible: 100, Requerido: 500',
    'Declaracion ya enviada. MRN: 26ES00280112345678',
    'Solo se pueden eliminar expedientes en estado borrador o cancelado',
    'El expediente debe tener MRN para procesar canal',
    'Token invalido o expirado',
    'Se requiere codigo TARIC',
    'Refund amount exceeds payment amount',
    'Can only refund completed payments'
  ])('deja pasar: %s', async (mensaje) => {
    const res = await request(app({ success: false, error: mensaje })).get('/r');

    expect(res.body.error).toBe(mensaje);
  });

  test('no altera las respuestas correctas', async () => {
    const res = await request(app({ success: true, data: { total: 25 } }, 200)).get('/r');

    expect(res.body).toEqual({ success: true, data: { total: 25 } });
  });

  test('no revienta con cuerpos sin los campos error/message', async () => {
    const res = await request(app({ success: true, items: [1, 2, 3] }, 200)).get('/r');

    expect(res.body.items).toEqual([1, 2, 3]);
  });
});

describe('sanitizeErrors: en desarrollo no estorba', () => {
  test('deja pasar el detalle interno para poder depurar', async () => {
    process.env.NODE_ENV = 'development';

    const res = await request(app({
      success: false,
      error: 'Cast to ObjectId failed for model "OEA"'
    })).get('/r');

    expect(res.body.error).toMatch(/Cast to ObjectId/);

    process.env.NODE_ENV = 'production';
  });
});

describe('delataInterno', () => {
  test('tolera valores que no son texto', () => {
    expect(delataInterno(null)).toBe(false);
    expect(delataInterno(undefined)).toBe(false);
    expect(delataInterno({ a: 1 })).toBe(false);
    expect(delataInterno('')).toBe(false);
  });
});
