/**
 * queueService — cola BullMQ para trabajos async, con fallback inline sin Redis.
 *
 * Fronteras externas: `bullmq` (Queue/Worker) y `cacheService.getRedisClient`
 * (Redis). Ambas se mockean — no hay Redis ni BullMQ reales en el test. Se
 * ejercita lo PROPIO del servicio: getConnection (null si no hay client), la
 * memoización de colas/workers en los Map internos, el fallback inline de
 * enqueue cuando no hay cola, la creación de Worker y su callback (éxito y
 * error) y closeAll. El módulo mantiene Map singletons entre tests → limpiamos
 * con jest.isolateModules para un estado fresco por bloque.
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

// `bullmq` NO está instalado (el módulo lo envuelve en try/catch). Lo declaramos
// como módulo VIRTUAL para poder mockear sus clases Queue/Worker.
jest.mock('bullmq', () => ({ Queue: jest.fn(), Worker: jest.fn() }), { virtual: true });
jest.mock('../../src/services/cacheService');

const { Queue, Worker } = require('bullmq');
const cacheService = require('../../src/services/cacheService');

/** Carga el módulo con estado FRESCO (Maps internos vacíos). */
function cargarModuloFresco() {
  let mod;
  jest.isolateModules(() => {
    mod = require('../../src/services/queueService');
  });
  return mod;
}

beforeEach(() => {
  // Queue/Worker son clases mock: devolvemos instancias con los métodos usados.
  Queue.mockImplementation(function (name) {
    this.name = name;
    this.add = jest.fn().mockResolvedValue({ id: 'job1', name });
    this.close = jest.fn().mockResolvedValue();
  });
  Worker.mockImplementation(function (name, processor, opts) {
    this.name = name;
    this._processor = processor; // guardamos el handler para invocarlo
    this._opts = opts;
    this.on = jest.fn();
    this.close = jest.fn().mockResolvedValue();
  });
});

// ==================== sin Redis (getRedisClient → null) ====================
describe('sin Redis', () => {
  beforeEach(() => {
    cacheService.getRedisClient.mockReturnValue(null);
  });

  test('enqueue cae a ejecución inline', async () => {
    const q = cargarModuloFresco();
    const r = await q.enqueue('classify', { foo: 1 });
    expect(r.inline).toBe(true);
    expect(r.data).toEqual({ foo: 1 });
    expect(Queue).not.toHaveBeenCalled();
  });

  test('getQueue devuelve null', () => {
    const q = cargarModuloFresco();
    expect(q.getQueue('x')).toBeNull();
  });

  test('registerWorker devuelve null (sin redis)', () => {
    const q = cargarModuloFresco();
    expect(q.registerWorker('x', async () => {})).toBeNull();
    expect(Worker).not.toHaveBeenCalled();
  });
});

// ==================== con Redis ====================
describe('con Redis', () => {
  beforeEach(() => {
    cacheService.getRedisClient.mockReturnValue({ fake: 'client' });
  });

  test('getQueue crea la cola y la memoiza', () => {
    const q = cargarModuloFresco();
    const q1 = q.getQueue('classify');
    const q2 = q.getQueue('classify');
    expect(q1).toBe(q2); // memoizada
    expect(Queue).toHaveBeenCalledTimes(1);
    expect(q1.name).toBe('classify');
  });

  test('enqueue añade un job a la cola', async () => {
    const q = cargarModuloFresco();
    const r = await q.enqueue('classify', { d: 1 }, { attempts: 5 });
    expect(r.inline).toBe(false);
    expect(r.id).toBe('job1');
    expect(r.name).toBe('classify');
  });

  test('registerWorker crea el worker, lo memoiza y engancha "failed"', () => {
    const q = cargarModuloFresco();
    const handler = jest.fn().mockResolvedValue('done');
    const w1 = q.registerWorker('classify', handler, { concurrency: 4 });
    const w2 = q.registerWorker('classify', handler);
    expect(w1).toBe(w2); // memoizado
    expect(Worker).toHaveBeenCalledTimes(1);
    expect(w1._opts.concurrency).toBe(4);
    expect(w1.on).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  test('el processor del worker ejecuta el handler y devuelve su resultado', async () => {
    const q = cargarModuloFresco();
    const handler = jest.fn().mockResolvedValue('RES');
    const w = q.registerWorker('classify', handler);
    const out = await w._processor({ data: { x: 1 }, id: 'j9' });
    expect(handler).toHaveBeenCalledWith({ x: 1 }, expect.objectContaining({ id: 'j9' }));
    expect(out).toBe('RES');
  });

  test('el processor relanza si el handler falla', async () => {
    const q = cargarModuloFresco();
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const w = q.registerWorker('classify', handler);
    await expect(w._processor({ data: {}, id: 'j10' })).rejects.toThrow('boom');
  });

  test('el listener "failed" no lanza aunque job sea undefined', () => {
    const q = cargarModuloFresco();
    const w = q.registerWorker('classify', jest.fn());
    const failedCb = w.on.mock.calls.find(c => c[0] === 'failed')[1];
    expect(() => failedCb(undefined, new Error('x'))).not.toThrow();
  });

  test('closeAll cierra colas y workers registrados', async () => {
    const q = cargarModuloFresco();
    const queue = q.getQueue('classify');
    const worker = q.registerWorker('classify', jest.fn());
    await q.closeAll();
    expect(queue.close).toHaveBeenCalled();
    expect(worker.close).toHaveBeenCalled();
  });
});
