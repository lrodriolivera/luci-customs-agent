/**
 * Middleware comun que retira operadores de MongoDB de la peticion.
 *
 * Un body JSON como {"mrn": {"$ne": null}} llegaba tal cual a Expedition.findOne
 * y se ejecutaba como operador (hallazgo F1 del escaneo del 3/Nov/2026: lectura
 * de expedientes de otros tenants por POST /api/pue/lookup-mrn). No habia
 * ningun mongo-sanitize ni sanitizeFilter. sanitizeOperators borra de
 * req.body, req.query y req.params toda clave que empiece por '$' o contenga
 * '.', a cualquier profundidad.
 */

const { sanitizeOperators, limpiarOperadores } = require('../../src/middleware/sanitizeOperators');

jest.mock('../../src/config/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
const logger = require('../../src/config/logger');

describe('limpiarOperadores', () => {
  test('quita operadores en la raiz y anidados', () => {
    const limpio = limpiarOperadores({
      mrn: { $ne: null },
      claveZeta: 1,
      filtro: { estado: { $regex: '^a' }, ok: 'si' },
      $where: 'sleep(1000)'
    });
    expect(limpio).toEqual({ mrn: {}, claveZeta: 1, filtro: { estado: {}, ok: 'si' } });
  });

  test('quita claves con punto (rutas de Mongo) a cualquier profundidad', () => {
    expect(limpiarOperadores({ 'declaration.mrn': 'x', datos: { 'a.b': 1, c: 2 } }))
      .toEqual({ datos: { c: 2 } });
  });

  test('recorre arrays de objetos', () => {
    expect(limpiarOperadores({ items: [{ $gt: 1, n: 1 }, 'texto', 3] }))
      .toEqual({ items: [{ n: 1 }, 'texto', 3] });
  });

  test('deja intactos los valores normales, incluidos strings con $ o punto', () => {
    const datos = { precio: '$100', email: 'a.b@c.es', n: 2, activo: true, nada: null, lista: ['x.y'] };
    expect(limpiarOperadores(datos)).toEqual(datos);
  });

  test('no muta el objeto original', () => {
    const original = { a: { $ne: 1 } };
    limpiarOperadores(original);
    expect(original).toEqual({ a: { $ne: 1 } });
  });

  test('conserva Date y Buffer', () => {
    const fecha = new Date('2026-11-03T00:00:00Z');
    const buf = Buffer.from('x');
    const limpio = limpiarOperadores({ fecha, buf });
    expect(limpio.fecha).toBe(fecha);
    expect(limpio.buf).toBe(buf);
  });
});

describe('sanitizeOperators (middleware)', () => {
  function ejecutar(req) {
    const next = jest.fn();
    sanitizeOperators(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    return req;
  }

  test('limpia body, query y params', () => {
    const req = ejecutar({
      body: { mrn: { $ne: null } },
      query: { search: { $regex: '.*' }, page: '1' },
      params: { id: 'abc' },
      originalUrl: '/api/pue/lookup-mrn',
      method: 'POST'
    });
    expect(req.body).toEqual({ mrn: {} });
    expect(req.query).toEqual({ search: {}, page: '1' });
    expect(req.params).toEqual({ id: 'abc' });
  });

  test('avisa en el log cuando quita algo, sin el valor', () => {
    ejecutar({ body: { mrn: { $ne: 'secreto' } }, query: {}, params: {}, originalUrl: '/x', method: 'POST' });
    expect(logger.warn).toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secreto');
  });

  test('una peticion limpia pasa sin avisos', () => {
    logger.warn.mockClear();
    ejecutar({ body: { mrn: '26ES00085123456789' }, query: { page: '2' }, params: {}, originalUrl: '/x', method: 'POST' });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('tolera body o query ausentes', () => {
    expect(() => ejecutar({ originalUrl: '/x', method: 'GET' })).not.toThrow();
  });
});
