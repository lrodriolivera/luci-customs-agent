/**
 * kpiDatos.datosParaKPIs: traduce las metricas reales del tenant (realMetricsService)
 * al objeto `data` que consume kpiService.calculateKPI. Solo rellena los KPI que
 * tienen fuente; el resto no aparece (y kpiService los marca "sin datos").
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mockMetricas = {
  volumenDeclaraciones: jest.fn(),
  repartoPorCanal: jest.fn(),
  derechosLiquidados: jest.fn(),
  tiemposDeDespacho: jest.fn(),
  expedientesActivos: jest.fn()
};
jest.mock('../../../src/services/analytics/realMetricsService', () => mockMetricas);

const { datosParaKPIs } = require('../../../src/services/analytics/kpiDatos');

const volumen = (extra = {}) => ({
  total: 60, porTipo: { H7: 50, NCTS: 10 }, porEstado: { accepted: 30, rejected: 5 },
  aceptadas: 30, pendientes: 12, ...extra
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMetricas.volumenDeclaraciones.mockResolvedValue(volumen());
  mockMetricas.repartoPorCanal.mockResolvedValue({
    canales: { green: 15, orange: 3, red: 2, yellow: 0 }, conCanalAsignado: 20, porcentajes: {}
  });
  mockMetricas.derechosLiquidados.mockResolvedValue({ declaraciones: 50, total: 12345.67 });
  mockMetricas.tiemposDeDespacho.mockResolvedValue({ muestra: 8, mediaHoras: 4.5 });
  mockMetricas.expedientesActivos.mockResolvedValue(7);
});

describe('datosParaKPIs: mapeo de métricas reales a KPIs', () => {
  test('rellena los seis KPI con fuente', async () => {
    const d = await datosParaKPIs('64f000000000000000000001', { dias: 30 });
    expect(d).toEqual({
      totalDeclarations: 60,
      days: 30,
      greenChannel: 75,            // 15 de 20 con canal
      avgProcessingTime: 4.5,
      activeExpeditions: 7,        // expedientes no terminales, NO volumen.pendientes (12)
      totalDuties: 12345.67,
      rejectionRate: 10            // 5 rechazadas de 50 H7 (no de 60 con tránsitos)
    });
  });

  test('activeExpeditions sale de expedientesActivos y sin rango de fechas', async () => {
    await datosParaKPIs('64f000000000000000000001', { dias: 7 });
    expect(mockMetricas.expedientesActivos).toHaveBeenCalledTimes(1);
    expect(mockMetricas.expedientesActivos.mock.calls[0]).toEqual(['64f000000000000000000001']);
  });

  test('un cero real de expedientes activos sigue siendo 0 (no null)', async () => {
    mockMetricas.expedientesActivos.mockResolvedValue(0);
    expect((await datosParaKPIs('t')).activeExpeditions).toBe(0);
  });

  test('rejectionRate divide entre las H7, no entre el total con tránsitos', async () => {
    mockMetricas.volumenDeclaraciones.mockResolvedValue(volumen({
      total: 100, porTipo: { H7: 20, NCTS: 80 }, porEstado: { rejected: 4 }
    }));
    expect((await datosParaKPIs('t')).rejectionRate).toBe(20);   // 4/20, no 4/100
  });

  test('rejectionRate es null si no hay H7 aunque haya tránsitos', async () => {
    mockMetricas.volumenDeclaraciones.mockResolvedValue(volumen({
      total: 10, porTipo: { H7: 0, NCTS: 10 }, porEstado: {}
    }));
    expect((await datosParaKPIs('t')).rejectionRate).toBeNull();
  });

  test('declarations_per_day usa total y días (por defecto 30)', async () => {
    const d = await datosParaKPIs('64f000000000000000000001');
    expect(d.days).toBe(30);
    expect(d.totalDeclarations / d.days).toBe(2);
  });

  test('pide a realMetrics el rango de los últimos N días para ese tenant', async () => {
    const antes = Date.now();
    await datosParaKPIs('64f000000000000000000001', { dias: 7 });
    const [tenant, rango] = mockMetricas.volumenDeclaraciones.mock.calls[0];
    expect(tenant).toBe('64f000000000000000000001');
    expect(rango.hasta.getTime()).toBeGreaterThanOrEqual(antes);
    expect(Math.round((rango.hasta - rango.desde) / 86400000)).toBe(7);
    for (const f of [mockMetricas.repartoPorCanal, mockMetricas.derechosLiquidados, mockMetricas.tiemposDeDespacho]) {
      expect(f.mock.calls[0][1]).toEqual(rango);
    }
  });

  test('sin canal asignado: greenChannel es null (no 0)', async () => {
    mockMetricas.repartoPorCanal.mockResolvedValue({ canales: { green: 0, orange: 0, red: 0, yellow: 0 }, conCanalAsignado: 0 });
    expect((await datosParaKPIs('t')).greenChannel).toBeNull();
  });

  test('sin muestra de despacho: avgProcessingTime es null (no 0)', async () => {
    mockMetricas.tiemposDeDespacho.mockResolvedValue({ muestra: 0, mediaHoras: null });
    expect((await datosParaKPIs('t')).avgProcessingTime).toBeNull();
  });

  test('sin declaraciones: rejectionRate es null y el resto son ceros reales', async () => {
    mockMetricas.volumenDeclaraciones.mockResolvedValue(volumen({ total: 0, porTipo: { H7: 0, NCTS: 0 }, porEstado: {}, pendientes: 0 }));
    mockMetricas.expedientesActivos.mockResolvedValue(0);
    const d = await datosParaKPIs('t');
    expect(d.rejectionRate).toBeNull();
    expect(d.totalDeclarations).toBe(0);
    expect(d.activeExpeditions).toBe(0);
  });

  test('nunca devuelve claves de los KPI sin fuente', async () => {
    const d = await datosParaKPIs('t');
    for (const k of ['savings', 'guaranteeUtilization', 'errorRate', 'onTimeRate', 'complianceScore',
      'documentCompleteness', 'luciAccuracy', 'automationRate', 'firstTimeResolution', 'aeatConnectivity']) {
      expect(d).not.toHaveProperty(k);
    }
  });
});

describe('datosParaKPIs: ámbito', () => {
  test('super admin de plataforma (undefined) agrega todos los tenants', async () => {
    const d = await datosParaKPIs(undefined, { dias: 30 });
    expect(mockMetricas.volumenDeclaraciones.mock.calls[0][0]).toBeUndefined();
    expect(d.totalDeclarations).toBe(60);
  });

  test('sin tenant (null): todo vacío y no se consulta nada', async () => {
    const d = await datosParaKPIs(null, { dias: 30 });
    expect(d).toEqual({});
    for (const f of Object.values(mockMetricas)) expect(f).not.toHaveBeenCalled();
  });

  test.each([[0], [-5], ['x'], [null], [366], [2.5]])('días inválidos (%j) usan 30', async (dias) => {
    const d = await datosParaKPIs('t', { dias });
    expect(d.days).toBe(30);
  });
});
