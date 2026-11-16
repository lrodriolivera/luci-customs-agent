/**
 * Candado simple en Mongo para tareas periódicas con varias réplicas: solo una
 * réplica lo obtiene mientras no caduca, aunque lo pidan a la vez.
 */
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { adquirirCandado, liberarCandado } = require('../../src/services/candadoMongo');
const JobLock = require('../../src/models/JobLock');

describe('candadoMongo', () => {
  usarBaseDeDatosEnMemoria();
  beforeAll(() => JobLock.init());

  const T0 = new Date('2026-11-16T10:00:00Z');

  test('el primero lo obtiene y el segundo no mientras no caduque', async () => {
    expect(await adquirirCandado('tarea', { duracionMs: 60000, ahora: T0, dueno: 'a' })).toBe(true);
    expect(await adquirirCandado('tarea', { duracionMs: 60000, ahora: new Date(T0.getTime() + 30000), dueno: 'b' })).toBe(false);
    const doc = await JobLock.findById('tarea').lean();
    expect(doc.dueno).toBe('a');
  });

  test('caducado, otro lo puede tomar', async () => {
    await adquirirCandado('tarea', { duracionMs: 60000, ahora: T0, dueno: 'a' });
    expect(await adquirirCandado('tarea', { duracionMs: 60000, ahora: new Date(T0.getTime() + 60001), dueno: 'b' })).toBe(true);
    expect((await JobLock.findById('tarea').lean()).dueno).toBe('b');
  });

  test('peticiones simultáneas: solo una gana', async () => {
    const resultados = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((dueno) => adquirirCandado('carrera', { duracionMs: 60000, ahora: T0, dueno }))
    );
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  test('candados de nombres distintos no se pisan', async () => {
    expect(await adquirirCandado('uno', { duracionMs: 60000, ahora: T0 })).toBe(true);
    expect(await adquirirCandado('dos', { duracionMs: 60000, ahora: T0 })).toBe(true);
  });

  test('liberar: solo el dueño lo suelta; después otro lo puede tomar', async () => {
    await adquirirCandado('tarea', { duracionMs: 60000, ahora: T0, dueno: 'a' });
    expect(await liberarCandado('tarea', { dueno: 'b' })).toBe(false);
    expect(await adquirirCandado('tarea', { duracionMs: 60000, ahora: T0, dueno: 'b' })).toBe(false);
    expect(await liberarCandado('tarea', { dueno: 'a' })).toBe(true);
    expect(await adquirirCandado('tarea', { duracionMs: 60000, ahora: T0, dueno: 'b' })).toBe(true);
  });

  test('una duración no válida es un error de programación', async () => {
    await expect(adquirirCandado('x', { duracionMs: 0 })).rejects.toThrow('duración');
  });
});
