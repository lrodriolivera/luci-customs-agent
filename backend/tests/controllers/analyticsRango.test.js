/**
 * El rango de /dashboard, /declarations y /financial sale de la query:
 * startDate+endDate, o `period` (el selector del frontend), o 30 dias.
 */
jest.mock('../../src/services/analytics/realMetricsService', () => ({
  NO_DISPONIBLE: { SIN_PAGOS: 'sin pagos' },
  cuadroDeMando: jest.fn(),
  expedientesActivos: jest.fn(),
  volumenDeclaraciones: jest.fn(),
  repartoPorCanal: jest.fn(),
  derechosLiquidados: jest.fn(),
  recaudacionCobrada: jest.fn(),
  valorMercancia: jest.fn()
}));
jest.mock('../../src/services/aiService', () => ({}));

const realMetrics = require('../../src/services/analytics/realMetricsService');
const ctrl = require('../../src/controllers/analyticsController');

const AHORA = new Date('2026-11-09T12:00:00Z');
const T = '6a5769e0b11d798e7e783602';

const req = (query = {}, user = { id: 'u', tenantId: T }) => ({ query, body: {}, params: {}, user });
const res = () => {
  const r = { statusCode: 200 };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const cuadro = {
  simulated: false, generadoEn: AHORA.toISOString(),
  declaraciones: { total: 10, porTipo: { H7: 10 }, porEstado: {} },
  derechos: { total: 100 }, tiempos: { muestra: 0, mediaHoras: null },
  cumplimiento: { inspecciones: 0 }, recaudacion: { disponible: false }
};

beforeEach(() => {
  jest.useFakeTimers({
    now: AHORA,
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'clearImmediate', 'queueMicrotask']
  });
  realMetrics.cuadroDeMando.mockResolvedValue(cuadro);
  realMetrics.expedientesActivos.mockResolvedValue(1);
  realMetrics.volumenDeclaraciones.mockResolvedValue({ total: 3, porTipo: {}, porEstado: {} });
  realMetrics.repartoPorCanal.mockResolvedValue({ conCanalAsignado: 0 });
  realMetrics.derechosLiquidados.mockResolvedValue({ total: 1 });
  realMetrics.recaudacionCobrada.mockResolvedValue({ disponible: true, total: 5 });
  realMetrics.valorMercancia.mockResolvedValue({ disponible: false });
});
afterEach(() => jest.useRealTimers());

const hoy0 = () => new Date(AHORA.getFullYear(), AHORA.getMonth(), AHORA.getDate());
// dias de calendario (getDateRange usa setDate; restar ms falla en cambios de hora)
const dias = (n) => { const d = hoy0(); d.setDate(d.getDate() - n); return d; };

describe('GET /dashboard: period -> rango y tendencia del periodo anterior', () => {
  test.each([
    ['last_7_days', () => dias(7), () => AHORA],
    ['last_30_days', () => dias(30), () => AHORA],
    ['last_90_days', () => dias(90), () => AHORA],
    ['yesterday', () => dias(1), () => hoy0()],
    ['today', () => hoy0(), () => AHORA],
    ['this_month', () => new Date(AHORA.getFullYear(), AHORA.getMonth(), 1), () => AHORA],
    ['last_month', () => new Date(AHORA.getFullYear(), AHORA.getMonth() - 1, 1), () => new Date(AHORA.getFullYear(), AHORA.getMonth(), 0)],
    ['this_year', () => new Date(AHORA.getFullYear(), 0, 1), () => AHORA]
  ])('%s', async (period, desde, hasta) => {
    const r = res();
    await ctrl.getDashboardMetrics(req({ period }), r);
    expect(r.statusCode).toBe(200);

    // cuadroDeMando (7 agregaciones) solo se pide para el periodo actual: el
    // anterior solo necesita los dos totales de la tendencia (volumenDeclaraciones
    // + derechosLiquidados), no el cuadro completo. Ver cuadroParaPanel.panelDelAmbito.
    const [actual] = realMetrics.cuadroDeMando.mock.calls.map((c) => c[1]);
    expect(realMetrics.cuadroDeMando).toHaveBeenCalledTimes(1);
    expect(actual.desde).toEqual(desde());
    expect(actual.hasta).toEqual(hasta());

    const anterior = realMetrics.volumenDeclaraciones.mock.calls[0][1];
    // periodo anterior: inmediatamente antes y de la misma longitud
    expect(anterior.hasta).toEqual(actual.desde);
    expect(anterior.hasta - anterior.desde).toBe(actual.hasta - actual.desde);
    // derechosLiquidados se pide para el mismo rango anterior
    expect(realMetrics.derechosLiquidados.mock.calls[0][1]).toEqual(anterior);
  });

  test('startDate + endDate validos mandan sobre period', async () => {
    await ctrl.getDashboardMetrics(req({ startDate: '2026-10-01', endDate: '2026-10-31', period: 'last_7_days' }), res());
    const [actual] = realMetrics.cuadroDeMando.mock.calls.map((c) => c[1]);
    expect(actual.desde).toEqual(new Date('2026-10-01'));
    expect(actual.hasta).toEqual(new Date('2026-10-31'));
  });

  test('sin nada: ultimos 30 dias', async () => {
    await ctrl.getDashboardMetrics(req({}), res());
    const [actual] = realMetrics.cuadroDeMando.mock.calls.map((c) => c[1]);
    expect(actual.desde).toEqual(dias(30));
  });
});

describe('fechas y periodos invalidos -> 400, no 500', () => {
  test.each([
    ['fecha invalida', { startDate: 'no-es-fecha', endDate: '2026-10-31' }],
    ['fin invalido', { startDate: '2026-10-01', endDate: 'x' }],
    ['solo startDate', { startDate: '2026-10-01' }],
    ['solo endDate', { endDate: '2026-10-31' }],
    ['inicio posterior al fin', { startDate: '2026-11-01', endDate: '2026-10-01' }],
    ['period desconocido', { period: 'x; drop' }],
    ['period custom sin fechas', { period: 'custom' }]
  ])('%s', async (_n, query) => {
    for (const h of ['getDashboardMetrics', 'getDeclarationAnalytics', 'getFinancialAnalytics']) {
      const r = res();
      await ctrl[h](req(query), r);
      expect(r.statusCode).toBe(400);
      expect(r.body.success).toBe(false);
      expect(r.body.error).toEqual(expect.any(String));
    }
    expect(realMetrics.cuadroDeMando).not.toHaveBeenCalled();
    expect(realMetrics.volumenDeclaraciones).not.toHaveBeenCalled();
    expect(realMetrics.derechosLiquidados).not.toHaveBeenCalled();
  });
});

describe('/declarations y /financial usan el mismo rango', () => {
  test('/declarations: period last_7_days', async () => {
    await ctrl.getDeclarationAnalytics(req({ period: 'last_7_days' }), res());
    expect(realMetrics.volumenDeclaraciones.mock.calls[0][1].desde).toEqual(dias(7));
    expect(realMetrics.repartoPorCanal.mock.calls[0][1].desde).toEqual(dias(7));
  });

  test('/financial: period last_90_days y fechas explicitas', async () => {
    await ctrl.getFinancialAnalytics(req({ period: 'last_90_days' }), res());
    expect(realMetrics.derechosLiquidados.mock.calls[0][1].desde).toEqual(dias(90));
    expect(realMetrics.recaudacionCobrada.mock.calls[0][1].desde).toEqual(dias(90));
    expect(realMetrics.valorMercancia.mock.calls[0][1].desde).toEqual(dias(90));

    await ctrl.getFinancialAnalytics(req({ startDate: '2026-10-01', endDate: '2026-10-31' }), res());
    expect(realMetrics.derechosLiquidados.mock.calls[1][1].desde).toEqual(new Date('2026-10-01'));
  });
});

describe('/financial: ambito del usuario', () => {
  test('usa ambitoTenant: tenant como string, undefined para super admin', async () => {
    await ctrl.getFinancialAnalytics(req({}), res());
    expect(realMetrics.derechosLiquidados.mock.calls[0][0]).toBe(T);
    await ctrl.getFinancialAnalytics(req({}, { id: 'root', role: 'super_admin' }), res());
    expect(realMetrics.derechosLiquidados.mock.calls[1][0]).toBeUndefined();
  });

  test('sin tenant (null) no consulta realMetrics y responde 501 sin pagos', async () => {
    const r = res();
    await ctrl.getFinancialAnalytics(req({}, { id: 'u', role: 'user' }), r);
    expect(realMetrics.derechosLiquidados).not.toHaveBeenCalled();
    expect(realMetrics.recaudacionCobrada).not.toHaveBeenCalled();
    expect(realMetrics.valorMercancia).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(501);
    expect(r.body.reason).toBe('sin pagos');
  });
});
