/**
 * Consulta automática periódica del estado de las declaraciones en la AEAT:
 * configuración por variables de entorno, arranque (nunca en tests), candado
 * entre réplicas y tolerancia a errores.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/candadoMongo', () => ({ adquirirCandado: jest.fn(), liberarCandado: jest.fn() }));
jest.mock('../../src/services/aeat/aeatStatusMonitorService', () => ({ pollOnce: jest.fn(), trackedDeclarations: { client: {} } }));
jest.mock('mongoose', () => ({ connection: { readyState: 1 } }));

const mongoose = require('mongoose');
const logger = require('../../src/config/logger');
const { adquirirCandado, liberarCandado } = require('../../src/services/candadoMongo');
const monitor = require('../../src/services/aeat/aeatStatusMonitorService');
const worker = require('../../src/workers/aeatStatusPollingWorker');

beforeEach(() => {
  jest.clearAllMocks();
  mongoose.connection.readyState = 1;
  worker.stop();
});
afterEach(() => {
  worker.stop();
  jest.restoreAllMocks();
});

describe('configuración', () => {
  test('por defecto: activada, cada 15 minutos, 50 consultas por pasada', () => {
    expect(worker.configuracion({})).toEqual({ habilitado: true, intervaloMs: 15 * 60000, limite: 50 });
  });

  test('lee AEAT_POLLING_ENABLED, AEAT_POLLING_INTERVAL_MIN y AEAT_POLLING_MAX_PER_PASS', () => {
    expect(worker.configuracion({ AEAT_POLLING_ENABLED: 'false', AEAT_POLLING_INTERVAL_MIN: '5', AEAT_POLLING_MAX_PER_PASS: '10' }))
      .toEqual({ habilitado: false, intervaloMs: 5 * 60000, limite: 10 });
  });

  test('valores no válidos vuelven al valor por defecto', () => {
    expect(worker.configuracion({ AEAT_POLLING_INTERVAL_MIN: 'abc', AEAT_POLLING_MAX_PER_PASS: '-3' }))
      .toMatchObject({ intervaloMs: 15 * 60000, limite: 50 });
    expect(worker.configuracion({ AEAT_POLLING_INTERVAL_MIN: '0' }).intervaloMs).toBe(15 * 60000);
  });
});

describe('start', () => {
  test('en tests (NODE_ENV=test) no arranca', () => {
    const espia = jest.spyOn(global, 'setInterval');
    expect(worker.start({ NODE_ENV: 'test' })).toBe(false);
    expect(espia).not.toHaveBeenCalled();
  });

  test('con AEAT_POLLING_ENABLED=false no arranca', () => {
    const espia = jest.spyOn(global, 'setInterval');
    expect(worker.start({ NODE_ENV: 'production', AEAT_POLLING_ENABLED: 'false' })).toBe(false);
    expect(espia).not.toHaveBeenCalled();
  });

  test('fuera de tests arranca un temporizador con el intervalo configurado, una sola vez', () => {
    const espia = jest.spyOn(global, 'setInterval');
    expect(worker.start({ NODE_ENV: 'production', AEAT_POLLING_INTERVAL_MIN: '7' })).toBe(true);
    expect(espia).toHaveBeenCalledTimes(1);
    expect(espia.mock.calls[0][1]).toBe(7 * 60000);
    expect(worker.start({ NODE_ENV: 'production' })).toBe(false);
    expect(espia).toHaveBeenCalledTimes(1);
  });

  test('sin Redis avisa: con varias réplicas cada una tiene su propio seguimiento en memoria', () => {
    monitor.trackedDeclarations.client = null;
    try {
      worker.start({ NODE_ENV: 'production' });
      expect(logger.warn.mock.calls.map((c) => c[0]).join(' ')).toMatch(/Redis/);
    } finally {
      monitor.trackedDeclarations.client = {};
    }
  });
});

describe('pasada', () => {
  const CONFIG = { habilitado: true, intervaloMs: 15 * 60000, limite: 20 };

  test('con el candado: consulta con el límite y registra el resumen sin MRN', async () => {
    adquirirCandado.mockResolvedValue(true);
    monitor.pollOnce.mockResolvedValue({ consultadas: 3, conError: 1, restantes: 0, omitidas: 2 });

    const r = await worker.pasada({ config: CONFIG });

    expect(r).toEqual({ consultadas: 3, conError: 1, restantes: 0, omitidas: 2 });
    expect(monitor.pollOnce).toHaveBeenCalledWith({ limite: 20 });
    const [nombre, opciones] = adquirirCandado.mock.calls[0];
    expect(nombre).toBe('aeat-status-polling');
    // El candado dura algo menos que el intervalo: una pasada por intervalo entre todas las réplicas.
    expect(opciones.duracionMs).toBeLessThan(CONFIG.intervaloMs);
    expect(opciones.duracionMs).toBeGreaterThan(CONFIG.intervaloMs / 2);
    const linea = logger.info.mock.calls.map((c) => c[0]).find((m) => /pasada/i.test(m));
    expect(linea).toMatch(/3 consultadas.*1 con error/);
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/\d{2}ES[A-Z0-9]{14}/);
  });

  test('sin candado (otra réplica ya hizo la pasada): no consulta', async () => {
    adquirirCandado.mockResolvedValue(false);
    const r = await worker.pasada({ config: CONFIG });
    expect(r).toEqual({ omitida: true });
    expect(monitor.pollOnce).not.toHaveBeenCalled();
  });

  test('sin conexión a Mongo no hace nada', async () => {
    mongoose.connection.readyState = 0;
    expect(await worker.pasada({ config: CONFIG })).toBeNull();
    expect(adquirirCandado).not.toHaveBeenCalled();
  });

  test('si la pasada falla tras tomar el candado, lo suelta para que otra réplica reintente', async () => {
    adquirirCandado.mockResolvedValue(true);
    liberarCandado.mockResolvedValue(true);
    monitor.pollOnce.mockRejectedValue(new Error('Redis caído'));
    await worker.pasada({ config: CONFIG });
    expect(liberarCandado).toHaveBeenCalledWith('aeat-status-polling');

    liberarCandado.mockRejectedValue(new Error('Mongo caído'));
    await expect(worker.pasada({ config: CONFIG })).resolves.toBeNull();
  });

  test('sin candado no suelta nada', async () => {
    adquirirCandado.mockRejectedValue(new Error('Mongo caído'));
    await worker.pasada({ config: CONFIG });
    expect(liberarCandado).not.toHaveBeenCalled();
  });

  test('un error (AEAT, Redis, Mongo) se registra y no se propaga', async () => {
    adquirirCandado.mockResolvedValue(true);
    monitor.pollOnce.mockRejectedValue(new Error('Redis caído'));
    await expect(worker.pasada({ config: CONFIG })).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();

    adquirirCandado.mockRejectedValue(new Error('Mongo caído'));
    await expect(worker.pasada({ config: CONFIG })).resolves.toBeNull();
  });

  test('dos pasadas solapadas en el mismo proceso: la segunda no hace nada', async () => {
    adquirirCandado.mockResolvedValue(true);
    let soltar;
    monitor.pollOnce.mockReturnValue(new Promise((r) => { soltar = r; }));
    const primera = worker.pasada({ config: CONFIG });
    expect(await worker.pasada({ config: CONFIG })).toBeNull();
    soltar({ consultadas: 0, conError: 0, restantes: 0, omitidas: 0 });
    await primera;
    expect(monitor.pollOnce).toHaveBeenCalledTimes(1);
  });
});
