/**
 * Lectura periódica de la bandeja de avisos AES: configuración
 * (AEAT_BANDEJA_ENABLED y el mismo intervalo que la consulta automática),
 * arranque (nunca en tests), candado entre réplicas y tolerancia a errores.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/candadoMongo', () => ({ adquirirCandado: jest.fn(), liberarCandado: jest.fn() }));
jest.mock('../../src/services/aesBandejaProceso', () => ({ procesarBandeja: jest.fn() }));
jest.mock('mongoose', () => ({ connection: { readyState: 1 } }));

const mongoose = require('mongoose');
const logger = require('../../src/config/logger');
const { adquirirCandado, liberarCandado } = require('../../src/services/candadoMongo');
const { procesarBandeja } = require('../../src/services/aesBandejaProceso');
const worker = require('../../src/workers/aesBandejaWorker');

beforeEach(() => {
  mongoose.connection.readyState = 1;
  worker.stop();
});
afterEach(() => worker.stop());

describe('configuración', () => {
  test('por defecto activada, cada 15 minutos (el intervalo de la consulta automática), 100 avisos por pasada', () => {
    expect(worker.configuracion({})).toEqual({ habilitado: true, intervaloMs: 15 * 60000, limite: 100 });
  });

  test('AEAT_BANDEJA_ENABLED=false la apaga; usa AEAT_POLLING_INTERVAL_MIN', () => {
    expect(worker.configuracion({ AEAT_BANDEJA_ENABLED: 'false', AEAT_POLLING_INTERVAL_MIN: '5' }))
      .toEqual({ habilitado: false, intervaloMs: 5 * 60000, limite: 100 });
    expect(worker.configuracion({ AEAT_POLLING_INTERVAL_MIN: 'x' }).intervaloMs).toBe(15 * 60000);
  });
});

describe('start', () => {
  test('en tests no arranca', () => {
    const espia = jest.spyOn(global, 'setInterval');
    expect(worker.start({ NODE_ENV: 'test' })).toBe(false);
    expect(espia).not.toHaveBeenCalled();
  });

  test('desactivada no arranca', () => {
    const espia = jest.spyOn(global, 'setInterval');
    expect(worker.start({ NODE_ENV: 'production', AEAT_BANDEJA_ENABLED: 'false' })).toBe(false);
    expect(espia).not.toHaveBeenCalled();
  });

  test('fuera de tests arranca una vez con el intervalo configurado', () => {
    const espia = jest.spyOn(global, 'setInterval');
    expect(worker.start({ NODE_ENV: 'production', AEAT_POLLING_INTERVAL_MIN: '7' })).toBe(true);
    expect(espia.mock.calls[0][1]).toBe(7 * 60000);
    expect(worker.activo()).toBe(true);
    expect(worker.start({ NODE_ENV: 'production' })).toBe(false);
  });
});

describe('pasada', () => {
  const CONFIG = { habilitado: true, intervaloMs: 15 * 60000, limite: 30 };

  test('con el candado propio lee la bandeja y registra el resumen sin MRN', async () => {
    adquirirCandado.mockResolvedValue(true);
    procesarBandeja.mockResolvedValue({ buzones: 1, leidos: 2, aplicados: 1, sinExpediente: 1, repetidos: 0, errores: 0, restantes: 0 });
    const r = await worker.pasada({ config: CONFIG });
    expect(r.aplicados).toBe(1);
    expect(procesarBandeja).toHaveBeenCalledWith({ limite: 30 });
    const [nombre, opciones] = adquirirCandado.mock.calls[0];
    expect(nombre).toBe('aes-bandeja');
    expect(opciones.duracionMs).toBeLessThan(CONFIG.intervaloMs);
    expect(logger.info.mock.calls.map((c) => c[0]).join(' ')).toMatch(/2 leídos.*1 aplicados/);
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/\d{2}ES[A-Z0-9]{14}/);
  });

  test('sin candado no lee', async () => {
    adquirirCandado.mockResolvedValue(false);
    expect(await worker.pasada({ config: CONFIG })).toEqual({ omitida: true });
    expect(procesarBandeja).not.toHaveBeenCalled();
  });

  test('sin Mongo no hace nada', async () => {
    mongoose.connection.readyState = 0;
    expect(await worker.pasada({ config: CONFIG })).toBeNull();
    expect(adquirirCandado).not.toHaveBeenCalled();
  });

  test('si falla suelta el candado y no propaga el error', async () => {
    adquirirCandado.mockResolvedValue(true);
    liberarCandado.mockResolvedValue(true);
    procesarBandeja.mockRejectedValue(new Error('Certificado AEAT no encontrado'));
    await expect(worker.pasada({ config: CONFIG })).resolves.toBeNull();
    expect(liberarCandado).toHaveBeenCalledWith('aes-bandeja');
    expect(logger.error).toHaveBeenCalled();
  });

  test('dos pasadas solapadas: la segunda no hace nada', async () => {
    adquirirCandado.mockResolvedValue(true);
    let soltar;
    procesarBandeja.mockReturnValue(new Promise((r) => { soltar = r; }));
    const primera = worker.pasada({ config: CONFIG });
    expect(await worker.pasada({ config: CONFIG })).toBeNull();
    soltar({ buzones: 0, leidos: 0, aplicados: 0, sinExpediente: 0, repetidos: 0, errores: 0, restantes: 0 });
    await primera;
    expect(procesarBandeja).toHaveBeenCalledTimes(1);
  });
});
