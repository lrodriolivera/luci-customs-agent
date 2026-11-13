/**
 * Enganche de las publicaciones diarias en el worker: se leen y, salvo que se
 * desactive, se aplican los cambios de derecho; un fallo no se propaga.
 */
const mockRegistrar = jest.fn();
const mockAplicar = jest.fn();
const mockReleer = jest.fn();
const mockAltas = jest.fn();
jest.mock('../../src/services/taric/diario/sincronizacionDiaria', () => ({
  registrarPublicacionesNuevas: (...a) => mockRegistrar(...a),
  aplicarPendientes: (...a) => mockAplicar(...a)
}));
jest.mock('../../src/services/taric/diario/altasDiarias', () => ({
  releerPublicacionesIncompletas: (...a) => mockReleer(...a),
  aplicarAltas: (...a) => mockAltas(...a)
}));
jest.mock('../../src/models/TaricCode', () => ({}));
jest.mock('../../src/models/TaricDailyPublication', () => ({}));

const worker = require('../../src/workers/taricSyncWorker');
const previo = process.env.TARIC_DIARIO_APLICAR;

beforeEach(() => {
  mockRegistrar.mockReset();
  mockAplicar.mockReset();
  mockRegistrar.mockResolvedValue({ nuevas: [{ nombre: 'TARIC_20261111_1925' }] });
  mockAplicar.mockResolvedValue({ aplicados: 1, yaEnCatalogo: 0 });
  mockReleer.mockReset();
  mockAltas.mockReset();
  mockReleer.mockResolvedValue({ releidas: [], fallidas: [] });
  mockAltas.mockResolvedValue({ altas: 2, yaEnCatalogo: 0, codigos: ['3908100010', '3908100090'], padres: ['3908100000'] });
  delete process.env.TARIC_DIARIO_APLICAR;
});
afterAll(() => {
  if (previo === undefined) delete process.env.TARIC_DIARIO_APLICAR; else process.env.TARIC_DIARIO_APLICAR = previo;
});

describe('publicaciones diarias en el worker', () => {
  test('lee las publicaciones nuevas y aplica los cambios de derecho', async () => {
    const r = await worker.leerPublicacionesDiarias(new Date('2026-11-12T03:05:00Z'));

    expect(r).toEqual({
      leidas: 1, aplicado: { aplicados: 1, yaEnCatalogo: 0 },
      altas: { altas: 2, yaEnCatalogo: 0, codigos: ['3908100010', '3908100090'], padres: ['3908100000'] }
    });
    expect(mockAplicar).toHaveBeenCalledTimes(1);
    // Los derechos se aplican antes que las altas, que heredan de sus padres.
    expect(mockAplicar.mock.invocationCallOrder[0]).toBeLessThan(mockAltas.mock.invocationCallOrder[0]);
    expect(mockReleer).toHaveBeenCalledTimes(1);
  });

  test('un fallo en las altas no deshace lo leído ni lo aplicado', async () => {
    mockAltas.mockRejectedValue(new Error('CIRCABC caído'));

    const r = await worker.leerPublicacionesDiarias();

    expect(r).toEqual({ leidas: 1, aplicado: { aplicados: 1, yaEnCatalogo: 0 }, altas: null });
  });

  test('con TARIC_DIARIO_APLICAR=false solo lee', async () => {
    process.env.TARIC_DIARIO_APLICAR = 'false';

    const r = await worker.leerPublicacionesDiarias();

    expect(r).toEqual({ leidas: 1, aplicado: null, altas: null });
    expect(mockAplicar).not.toHaveBeenCalled();
    expect(mockAltas).not.toHaveBeenCalled();
  });

  test('un fallo al leer no se propaga ni aplica nada', async () => {
    mockRegistrar.mockRejectedValue(new Error('portal caído'));

    expect(await worker.leerPublicacionesDiarias()).toBeNull();
    expect(mockAplicar).not.toHaveBeenCalled();
  });
});
