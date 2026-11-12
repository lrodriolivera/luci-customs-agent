/**
 * Enganche de las publicaciones diarias en el worker: se leen y, salvo que se
 * desactive, se aplican los cambios de derecho; un fallo no se propaga.
 */
const mockRegistrar = jest.fn();
const mockAplicar = jest.fn();
jest.mock('../../src/services/taric/diario/sincronizacionDiaria', () => ({
  registrarPublicacionesNuevas: (...a) => mockRegistrar(...a),
  aplicarPendientes: (...a) => mockAplicar(...a)
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
  delete process.env.TARIC_DIARIO_APLICAR;
});
afterAll(() => {
  if (previo === undefined) delete process.env.TARIC_DIARIO_APLICAR; else process.env.TARIC_DIARIO_APLICAR = previo;
});

describe('publicaciones diarias en el worker', () => {
  test('lee las publicaciones nuevas y aplica los cambios de derecho', async () => {
    const r = await worker.leerPublicacionesDiarias(new Date('2026-11-12T03:05:00Z'));

    expect(r).toEqual({ leidas: 1, aplicado: { aplicados: 1, yaEnCatalogo: 0 } });
    expect(mockAplicar).toHaveBeenCalledTimes(1);
  });

  test('con TARIC_DIARIO_APLICAR=false solo lee', async () => {
    process.env.TARIC_DIARIO_APLICAR = 'false';

    const r = await worker.leerPublicacionesDiarias();

    expect(r).toEqual({ leidas: 1, aplicado: null });
    expect(mockAplicar).not.toHaveBeenCalled();
  });

  test('un fallo al leer no se propaga ni aplica nada', async () => {
    mockRegistrar.mockRejectedValue(new Error('portal caído'));

    expect(await worker.leerPublicacionesDiarias()).toBeNull();
    expect(mockAplicar).not.toHaveBeenCalled();
  });
});
