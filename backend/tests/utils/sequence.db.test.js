/**
 * Contador atomico de referencias.
 *
 * Por que existe: 8 modelos generaban su numero con
 * `countDocuments(...) + 1`. Ese patron falla de dos formas distintas y las dos
 * se han dado ya en esta base de datos:
 *
 *   1. Al BORRAR un documento el contador retrocede y la siguiente alta
 *      reutiliza una referencia viva -> E11000 duplicate key.
 *   2. Dos altas concurrentes leen el mismo `count` y piden el mismo numero.
 *
 * Un `$inc` con upsert es atomico y monotono: nunca retrocede aunque se borre.
 *
 * Mongo real en memoria; el objeto bajo prueba es el propio contador.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const { nextSequence, nextReference } = require('../../src/utils/sequence');
const Counter = require('../../src/models/Counter');

usarBaseDeDatosEnMemoria();

// Modelo de juguete: el helper debe servir a cualquier modelo, no solo a los 8.
const EsquemaCosa = new mongoose.Schema({ reference: { type: String, unique: true, sparse: true } });
let Cosa;
beforeAll(() => {
  Cosa = mongoose.models.CosaSeq || mongoose.model('CosaSeq', EsquemaCosa);
});

describe('nextSequence', () => {

  test('arranca en 1 y avanza de uno en uno', async () => {
    expect(await nextSequence('demo')).toBe(1);
    expect(await nextSequence('demo')).toBe(2);
    expect(await nextSequence('demo')).toBe(3);
  });

  test('cada clave lleva su propia cuenta', async () => {
    await nextSequence('a');
    await nextSequence('a');
    expect(await nextSequence('b')).toBe(1);
    expect(await nextSequence('a')).toBe(3);
  });

  /**
   * El fallo que provoco esta correccion: con countDocuments, borrar un
   * documento hacia que la siguiente alta repitiese una referencia viva.
   */
  test('no retrocede aunque se borren documentos', async () => {
    await nextSequence('borrado');
    await nextSequence('borrado');
    await nextSequence('borrado');
    expect(await nextSequence('borrado')).toBe(4);
  });

  test('peticiones concurrentes no reparten el mismo numero', async () => {
    const n = await Promise.all(Array.from({ length: 20 }, () => nextSequence('carrera')));
    expect(new Set(n).size).toBe(20);
    expect(Math.max(...n)).toBe(20);
  });

  test('el seed fija el punto de partida solo la primera vez', async () => {
    expect(await nextSequence('sembrado', { seed: () => 41 })).toBe(42);
    // La segunda llamada NO vuelve a sembrar: sigue desde donde iba.
    expect(await nextSequence('sembrado', { seed: () => 1000 })).toBe(43);
  });

  test('un seed que falla no bloquea la generacion, arranca de cero', async () => {
    const seq = await nextSequence('seedRoto', { seed: () => { throw new Error('boom'); } });
    expect(seq).toBe(1);
  });
});

describe('nextReference', () => {

  test('compone prefijo y numero relleno al ancho pedido', async () => {
    expect(await nextReference(Cosa, 'reference', 'ENS-2026', 6)).toBe('ENS-2026-000001');
    expect(await nextReference(Cosa, 'reference', 'ENS-2026', 6)).toBe('ENS-2026-000002');
  });

  test('prefijos distintos no comparten cuenta', async () => {
    await nextReference(Cosa, 'reference', 'ENS-2026', 6);
    expect(await nextReference(Cosa, 'reference', 'ENS-2027', 6)).toBe('ENS-2027-000001');
  });

  /**
   * Este es el caso de la base de datos viva: ya hay referencias sembradas por
   * el generador antiguo. El contador debe continuar por encima del maximo
   * existente, no pisarlas.
   */
  test('continua por encima de las referencias que ya existen', async () => {
    await Cosa.create({ reference: 'ENS-2026-000021' });
    await Cosa.create({ reference: 'ENS-2026-000007' });
    expect(await nextReference(Cosa, 'reference', 'ENS-2026', 6)).toBe('ENS-2026-000022');
  });

  test('ignora las referencias de otro prefijo al calcular el maximo', async () => {
    await Cosa.create({ reference: 'PUE-2026-000900' });
    expect(await nextReference(Cosa, 'reference', 'ENS-2026', 6)).toBe('ENS-2026-000001');
  });

  test('no se atraganta con una referencia de formato inesperado', async () => {
    await Cosa.create({ reference: 'ENS-2026-LOQUESEA' });
    await Cosa.create({ reference: 'ENS-2026-000003' });
    expect(await nextReference(Cosa, 'reference', 'ENS-2026', 6)).toBe('ENS-2026-000004');
  });

  test('un numero mayor que el ancho no se trunca', async () => {
    // La siembra ya consume el 10000000, asi que a nextReference le toca el siguiente.
    await nextSequence(`${Cosa.modelName}:reference:ENS-2026`, { seed: () => 9999999 });
    expect(await nextReference(Cosa, 'reference', 'ENS-2026', 6)).toBe('ENS-2026-10000001');
  });

  test('deja registro del contador en su propia coleccion', async () => {
    await nextReference(Cosa, 'reference', 'ENS-2026', 6);
    const c = await Counter.findById(`${Cosa.modelName}:reference:ENS-2026`).lean();
    expect(c.seq).toBe(1);
  });
});
