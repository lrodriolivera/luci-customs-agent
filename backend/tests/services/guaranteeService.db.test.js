/**
 * guaranteeService: el ciclo de vida de una garantia contra Mongo real.
 *
 * Los metodos async del servicio (crear, activar, consumir, liberar) no se
 * pueden probar con el modelo mockeado sin probar el mock: el saldo lo lleva el
 * propio documento con sus metodos de instancia consume()/release(). Aqui se
 * ejercitan contra una BD en memoria efimera -- NO produccion.
 *
 * El foco esta en dos cosas que, si fallan, cuestan dinero o abren un agujero:
 *   1. El saldo: consumir y liberar tienen que cuadrar euro a euro, y no se
 *      puede consumir mas de lo disponible.
 *   2. El guard de propiedad: las escrituras cargan la garantia con
 *      _loadOwnedGuarantee, que exige que el owner coincida. Con el id de una
 *      garantia ajena la operacion debe fallar como si no existiera.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const guaranteeService = require('../../src/services/guaranteeService');

usarBaseDeDatosEnMemoria();

const HOY = Date.now();

/** Datos minimos validos de una garantia; el owner se pasa aparte. */
function datosGarantia(extra = {}) {
  return {
    reference: 'GAR-2026-0001',
    name: 'Aval BBVA para transito',
    type: 'bank_guarantee',
    totalAmount: 10000,
    currency: 'EUR',
    validFrom: new Date(HOY - 86400000),
    validUntil: new Date(HOY + 30 * 86400000),
    ...extra
  };
}

/** Contador para dar una referencia unica a cada garantia (indice unico). */
let seq = 0;

/** Crea, activa y devuelve una garantia lista para consumir. */
async function garantiaActiva(owner) {
  const { data } = await guaranteeService.createGuarantee(
    datosGarantia({ reference: `GAR-ACT-${++seq}` }), owner
  );
  await guaranteeService.activateGuarantee(
    data._id, 'GRN123', { authNumber: 'A1', customsOffice: 'ES002801' }, owner
  );
  return data._id;
}

describe('createGuarantee', () => {
  test('nace en borrador con el saldo intacto', async () => {
    const owner = new mongoose.Types.ObjectId();

    const r = await guaranteeService.createGuarantee(datosGarantia(), owner);

    expect(r.success).toBe(true);
    expect(r.data.status).toBe('draft');
    expect(r.data.availableAmount).toBe(10000);
    expect(r.data.consumedAmount).toBe(0);
    expect(String(r.data.owner)).toBe(String(owner));
  });

  test('rechaza una garantia que ya nace caducada', async () => {
    // Sin sentido operativo y peligroso: una garantia expirada no cubre nada.
    const owner = new mongoose.Types.ObjectId();

    await expect(guaranteeService.createGuarantee(
      datosGarantia({ validUntil: new Date(HOY - 1000) }), owner
    )).rejects.toThrow(/futura/i);
  });

  test('rechaza fin anterior al inicio', async () => {
    const owner = new mongoose.Types.ObjectId();

    await expect(guaranteeService.createGuarantee(
      datosGarantia({ validFrom: new Date(HOY + 10 * 86400000), validUntil: new Date(HOY + 86400000) }),
      owner
    )).rejects.toThrow(/posterior/i);
  });
});

describe('activateGuarantee', () => {
  test('una garantia vigente pasa a activa y guarda el GRN', async () => {
    const owner = new mongoose.Types.ObjectId();
    const { data } = await guaranteeService.createGuarantee(datosGarantia(), owner);

    const r = await guaranteeService.activateGuarantee(
      data._id, 'GRN-2026-999', { authNumber: 'AUTH1', customsOffice: 'ES002801' }, owner
    );

    expect(r.data.status).toBe('active');
    expect(r.data.grn).toBe('GRN-2026-999');
    expect(r.data.aeatAuthorization.authNumber).toBe('AUTH1');
  });

  test('no se puede activar la garantia de otro operador', async () => {
    // El id es valido, pero el owner no coincide: mismo error que si no
    // existiera, para no revelar que el id pertenece a otra cuenta.
    const owner = new mongoose.Types.ObjectId();
    const { data } = await guaranteeService.createGuarantee(datosGarantia(), owner);

    await expect(guaranteeService.activateGuarantee(
      data._id, 'GRN', { authNumber: 'X' }, new mongoose.Types.ObjectId()
    )).rejects.toThrow(/no encontrada/i);
  });
});

describe('consumeGuarantee y releaseGuarantee: el saldo cuadra', () => {
  test('consumir descuenta del disponible', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);

    const r = await guaranteeService.consumeGuarantee(id, 3000, 'EXP-1', 'transito', owner);

    expect(r.data.consumedAmount).toBe(3000);
    expect(r.data.availableAmount).toBe(7000);
  });

  test('liberar devuelve al disponible', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    await guaranteeService.consumeGuarantee(id, 3000, 'EXP-1', 'transito', owner);

    const r = await guaranteeService.releaseGuarantee(id, 1000, 'EXP-1', 'fin transito', owner);

    // 3000 consumidos - 1000 liberados = 2000 consumidos, 8000 disponibles.
    expect(r.data.consumedAmount).toBe(2000);
    expect(r.data.availableAmount).toBe(8000);
  });

  test('no se puede consumir mas de lo disponible', async () => {
    // Sobreconsumir dejaria la garantia en negativo y cubriria operaciones sin
    // respaldo real ante la AEAT.
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);

    await expect(guaranteeService.consumeGuarantee(id, 999999, 'EXP-1', 'x', owner))
      .rejects.toThrow(/excede/i);
  });

  test('no se puede consumir la garantia de otro operador', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);

    await expect(guaranteeService.consumeGuarantee(id, 100, 'x', 'y', new mongoose.Types.ObjectId()))
      .rejects.toThrow(/no encontrada/i);
  });
});

describe('lecturas por propietario', () => {
  test('getActiveGuarantees solo devuelve las del owner', async () => {
    const ana = new mongoose.Types.ObjectId();
    const bruno = new mongoose.Types.ObjectId();
    await garantiaActiva(ana);
    await garantiaActiva(bruno);

    const deAna = await guaranteeService.getActiveGuarantees(ana);

    expect(Array.isArray(deAna)).toBe(true);
    expect(deAna.every(g => String(g.owner) === String(ana))).toBe(true);
    expect(deAna.length).toBe(1);
  });
});
