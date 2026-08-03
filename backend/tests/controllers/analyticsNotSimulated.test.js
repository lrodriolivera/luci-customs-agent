/**
 * Los endpoints de analytics no devuelven datos inventados.
 *
 * Antes, GET /api/analytics/dashboard construia su respuesta con
 * _generateMetricValue(min, max) en 171 sitios y la UI la presentaba como
 * analitica real: decia entre 150 y 300 declaraciones cuando en la base de
 * datos habia 35, y el numero cambiaba en cada recarga de la pagina.
 *
 * Ahora hay dos comportamientos, y ninguno es inventarse un numero:
 *
 *   calculable      -> 200 con la agregacion real y simulated: false
 *   no calculable   -> 501 con un motivo legible
 *
 * El 501 es deliberado, decision de Luis (3/Ago/2026): un 200 con ceros se lee
 * como "no se ha recaudado nada" y acaba en una reunion con un cliente.
 */

const realMetrics = require('../../src/services/analytics/realMetricsService');

jest.mock('../../src/services/analytics/realMetricsService', () => ({
  NO_DISPONIBLE: {
    SIN_PAGOS: 'No hay pagos registrados en el sistema: la recaudacion cobrada no se puede calcular',
    SIN_VALOR_MERCANCIA: 'Los expedientes no tienen valor de mercancia informado',
    SIN_HISTORICO: 'No hay suficiente historico para proyectar: se necesitan al menos 90 dias de datos',
    SIN_MODELO: 'No hay modelo entrenado: las predicciones requieren un historico del que aun no se dispone'
  },
  cuadroDeMando: jest.fn(),
  derechosLiquidados: jest.fn(),
  recaudacionCobrada: jest.fn(),
  valorMercancia: jest.fn()
}));

const controller = require('../../src/controllers/analyticsController');

const TENANT = '6a5769e0b11d798e7e783602';

/** Peticion autenticada. */
const req = (query = {}) => ({ query, body: {}, params: {}, user: { _id: 'u1', tenantId: TENANT } });

/** Respuesta que captura status y cuerpo. */
function res() {
  const r = { statusCode: 200 };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/analytics/dashboard', () => {
  test('sirve las agregaciones reales y las declara no simuladas', async () => {
    realMetrics.cuadroDeMando.mockResolvedValue({
      simulated: false,
      declaraciones: { total: 50, porTipo: { H7: 35, NCTS: 15 } }
    });

    const r = res();
    await controller.getDashboardMetrics(req(), r);

    expect(r.statusCode).toBe(200);
    expect(r.body.data.simulated).toBe(false);
    expect(r.body.data.declaraciones.total).toBe(50);
  });

  test('acota por el tenant del token', async () => {
    realMetrics.cuadroDeMando.mockResolvedValue({ simulated: false });

    await controller.getDashboardMetrics(req(), res());

    expect(realMetrics.cuadroDeMando).toHaveBeenCalledWith(TENANT, expect.any(Object));
  });

  test('el tenant NO sale de la query string', async () => {
    // Seria trivial pedir las metricas de otro cliente.
    realMetrics.cuadroDeMando.mockResolvedValue({ simulated: false });

    await controller.getDashboardMetrics(req({ tenantId: 'otro-tenant' }), res());

    expect(realMetrics.cuadroDeMando.mock.calls[0][0]).toBe(TENANT);
  });

  test('propaga el rango de fechas de la peticion', async () => {
    realMetrics.cuadroDeMando.mockResolvedValue({ simulated: false });

    await controller.getDashboardMetrics(req({ startDate: '2026-07-01', endDate: '2026-07-31' }), res());

    expect(realMetrics.cuadroDeMando.mock.calls[0][1])
      .toEqual({ desde: '2026-07-01', hasta: '2026-07-31' });
  });
});

describe('GET /api/analytics/financial', () => {
  test('sin pagos registrados responde 501, no un 200 con ceros', async () => {
    realMetrics.recaudacionCobrada.mockResolvedValue({
      disponible: false,
      motivo: realMetrics.NO_DISPONIBLE.SIN_PAGOS
    });
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 515.76 });
    realMetrics.valorMercancia.mockResolvedValue({ disponible: false, motivo: 'x' });

    const r = res();
    await controller.getFinancialAnalytics(req(), r);

    expect(r.statusCode).toBe(501);
    expect(r.body.code).toBe('NOT_IMPLEMENTED');
    expect(r.body.reason).toMatch(/pagos/i);
  });

  test('el motivo del 501 se entiende sin contexto', async () => {
    // Lo va a leer alguien mirando la respuesta cruda, sin el codigo delante.
    realMetrics.recaudacionCobrada.mockResolvedValue({
      disponible: false, motivo: realMetrics.NO_DISPONIBLE.SIN_PAGOS
    });
    realMetrics.derechosLiquidados.mockResolvedValue({});
    realMetrics.valorMercancia.mockResolvedValue({});

    const r = res();
    await controller.getFinancialAnalytics(req(), r);

    expect(r.body.reason.length).toBeGreaterThan(30);
    expect(r.body.reason).not.toMatch(/undefined|null|NaN/);
  });

  test('en cuanto haya pagos devuelve 200 con la cifra real', async () => {
    realMetrics.recaudacionCobrada.mockResolvedValue({ disponible: true, pagos: 3, total: 1234.57 });
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 515.76, declaraciones: 35 });
    realMetrics.valorMercancia.mockResolvedValue({ disponible: true, total: 2500 });

    const r = res();
    await controller.getFinancialAnalytics(req(), r);

    expect(r.statusCode).toBe(200);
    expect(r.body.data.simulated).toBe(false);
    expect(r.body.data.recaudacion.total).toBe(1234.57);
  });
});

describe('predicciones basadas en Math.random', () => {
  test.each([
    ['predictVolume', /historico/i],
    ['predictProcessingTime', /modelo|historico/i]
  ])('%s responde 501 en vez de simular', async (nombre, motivoEsperado) => {
    const r = res();
    await controller[nombre](req(), r);

    expect(r.statusCode).toBe(501);
    expect(r.body.code).toBe('NOT_IMPLEMENTED');
    expect(r.body.reason).toMatch(motivoEsperado);
  });

  test('el tiempo REAL de despacho sigue disponible en el cuadro de mando', async () => {
    // No se pierde la metrica: predictProcessingTime era una simulacion, pero
    // el tiempo medido de submittedAt a releasedAt es un dato y esta ahi.
    realMetrics.cuadroDeMando.mockResolvedValue({
      simulated: false,
      tiempos: { muestra: 8, mediaHoras: 323.9 }
    });

    const r = res();
    await controller.getDashboardMetrics(req(), r);

    expect(r.body.data.tiempos.mediaHoras).toBe(323.9);
  });
});

describe('el controlador no genera valores aleatorios', () => {
  test('getDashboardMetrics y getFinancialAnalytics no usan Math.random', () => {
    // Solo codigo: los comentarios explican por que se retiro Math.random y
    // por tanto lo nombran.
    const sinComentarios = (fn) => fn.toString()
      .split('\n')
      .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');

    const fuente = [
      controller.getDashboardMetrics,
      controller.getFinancialAnalytics,
      controller.predictVolume,
      controller.predictProcessingTime
    ].map(sinComentarios).join('\n');

    expect(fuente).not.toMatch(/Math\.random/);
  });
});
