/**
 * config/logger — el registro del backend.
 *
 * Hasta el 10/Nov/2026 no se escribia NINGUNA linea, ni en produccion ni en
 * desarrollo: el formato que oculta secretos devolvia una copia del registro
 * sin los Symbol internos de winston (nivel y mensaje), y sin ellos ningun
 * transporte lo acepta. Los ficheros de log estaban a 0 bytes.
 */
const { Writable } = require('stream');
const winston = require('winston');
const logger = require('../../src/config/logger');

let lineas;
let transporte;
const registros = () => lineas.map(l => JSON.parse(l));
const esperar = () => new Promise(r => setImmediate(r));

beforeEach(() => {
  lineas = [];
  transporte = new winston.transports.Stream({
    stream: new Writable({ write(chunk, _enc, cb) { lineas.push(String(chunk)); cb(); } })
  });
  logger.add(transporte);
  logger.silent = false;
});
afterEach(() => {
  logger.remove(transporte);
  logger.silent = true;
});

describe('logger', () => {
  test('escribe la linea con nivel, mensaje, fecha y servicio', async () => {
    logger.info('Expediente creado', { expeditionId: 'EXP-1' });
    await esperar();

    expect(registros()).toEqual([expect.objectContaining({
      level: 'info', message: 'Expediente creado', expeditionId: 'EXP-1',
      service: 'luci-customs', timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2} /)
    })]);
  });

  test('oculta contraseñas, tokens y claves a cualquier profundidad', async () => {
    logger.warn('login', { password: 'secreta', usuario: { token: 'abc', nombre: 'Ana' }, headers: { Authorization: 'Bearer x', 'X-Api-Key': 'k' } });
    await esperar();

    const [r] = registros();
    expect(r.password).toBe('[REDACTED]');
    expect(r.usuario).toEqual({ token: '[REDACTED]', nombre: 'Ana' });
    expect(r.headers).toEqual({ Authorization: '[REDACTED]', 'X-Api-Key': '[REDACTED]' });
    expect(JSON.stringify(r)).not.toMatch(/secreta|Bearer x/);
  });

  test('un error conserva su mensaje y su traza', async () => {
    logger.error('Error creando expediente:', new Error('sin conexion'));
    await esperar();

    const [r] = registros();
    expect(r.level).toBe('error');
    expect(r.message).toContain('Error creando expediente:');
    expect(r.message).toContain('sin conexion');
    expect(r.stack).toMatch(/Error: sin conexion/);
  });

  test('un error dentro de los metadatos no se queda en {}', async () => {
    logger.error('fallo', { causa: new Error('interno'), cuando: new Date('2026-11-10T00:00:00Z') });
    await esperar();

    const [r] = registros();
    expect(r.causa).toMatchObject({ message: 'interno' });
    expect(r.cuando).toBe('2026-11-10T00:00:00.000Z');
  });

  test('respeta el nivel: debug no se escribe con el nivel info por defecto', async () => {
    logger.debug('detalle');
    logger.info('visible');
    await esperar();

    expect(registros().map(r => r.message)).toEqual(['visible']);
  });

  test('recorta los textos enormes', async () => {
    logger.info('grande', { cuerpo: 'x'.repeat(10000) });
    await esperar();
    expect(registros()[0].cuerpo.length).toBeLessThan(4200);
  });

  test('un objeto enorme o con referencias circulares no rompe ni frena el registro', async () => {
    const circular = { nombre: 'a' };
    circular.yo = circular;
    const enorme = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`k${i}`, i]));

    logger.info('raro', { circular, enorme, lista: Array.from({ length: 5000 }, (_, i) => i) });
    await esperar();

    const [r] = registros();
    expect(Object.keys(r.enorme).length).toBeLessThanOrEqual(100);
    expect(r.lista.length).toBeLessThanOrEqual(101);
    expect(r.circular.nombre).toBe('a');
  });

  test('un documento con toJSON se registra por sus datos', async () => {
    const doc = { $__: { interno: true }, toJSON: () => ({ expeditionId: 'EXP-1', token: 'abc' }) };
    logger.info('doc', { doc });
    await esperar();
    expect(registros()[0].doc).toEqual({ expeditionId: 'EXP-1', token: '[REDACTED]' });
  });

  test('el registro de una peticion lleva usuario, tenant y ruta', async () => {
    logger.forRequest({ id: 'r1', user: { _id: 'u1' }, tenantId: 't1', method: 'GET', originalUrl: '/api/x' }).info('hecho');
    await esperar();
    expect(registros()[0]).toMatchObject({ requestId: 'r1', userId: 'u1', tenantId: 't1', method: 'GET', url: '/api/x' });
  });
});

describe('rotacion de los ficheros de registro', () => {
  // docker-compose monta ./data/logs:/app/logs y usa el driver json-file con
  // tope (max-size/max-file): sin rotacion propia del fichero, combined.log y
  // error.log crecen sin limite dentro del volumen aunque los contenedores de
  // docker ya roten su salida de consola.
  const path = require('path');

  test('construye los transportes de fichero con maxsize, maxFiles y tailable', () => {
    const transportes = logger.crearTransportesFichero('/tmp/registros-prueba');
    const porNombre = Object.fromEntries(transportes.map(t => [path.basename(t.filename), t]));

    expect(porNombre['error.log']).toMatchObject({ level: 'error', maxsize: 10 * 1024 * 1024, maxFiles: 5, tailable: true });
    expect(porNombre['combined.log']).toMatchObject({ maxsize: 10 * 1024 * 1024, maxFiles: 10, tailable: true });
  });

  test('los ficheros se crean dentro del directorio recibido (LOG_DIR)', () => {
    const transportes = logger.crearTransportesFichero('/tmp/registros-prueba');
    for (const t of transportes) {
      expect(t.dirname).toBe('/tmp/registros-prueba');
    }
  });

  test('usa LOG_DIR si esta definida; si no, la ruta historica backend/logs', () => {
    expect(logger.logDir).toBe(process.env.LOG_DIR || path.join(__dirname, '../../logs'));
  });
});

describe('sanitizarUrl', () => {
  test('oculta el token del portal del cliente, que va en la ruta', () => {
    expect(logger.sanitizarUrl('/api/portal/9f8e7d6c5b4a39281706f5e4d3c2b1a0/documents'))
      .toBe('/api/portal/[REDACTED]/documents');
    expect(logger.sanitizarUrl('/api/portal/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b?lang=es')).toBe('/api/portal/[REDACTED]?lang=es');
    // Las rutas del portal sin token no se tocan.
    expect(logger.sanitizarUrl('/api/portal/api-keys')).toBe('/api/portal/api-keys');
  });

  test('oculta tokens y claves que van en la consulta', () => {
    expect(logger.sanitizarUrl('/api/x?token=abc&page=2&apiKey=zzz')).toBe('/api/x?token=[REDACTED]&page=2&apiKey=[REDACTED]');
  });

  test('deja igual una ruta normal', () => {
    expect(logger.sanitizarUrl('/api/expeditions/6af395e85c2293a00762c665?page=1')).toBe('/api/expeditions/6af395e85c2293a00762c665?page=1');
    expect(logger.sanitizarUrl(undefined)).toBe('');
  });
});
