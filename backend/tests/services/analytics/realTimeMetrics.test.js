/**
 * getRealTimeMetrics: datos reales del ámbito, nunca inventados. Sin fuente, null.
 *  activeDeclarations <- realMetricsService.expedientesActivos
 *  pendingSubmissions <- volumenDeclaraciones(...).pendientes (últimos 30 días)
 *  alerts             <- kpiService.getActiveAlerts agrupadas por severidad
 *  aeatStatus         <- null (no hay comprobación real de conectividad)
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/aiService', () => ({ analyzeWithLuci: jest.fn(), analyzeKPIDeviations: jest.fn() }));

const mockMetricas = { expedientesActivos: jest.fn(), volumenDeclaraciones: jest.fn() };
jest.mock('../../../src/services/analytics/realMetricsService', () => mockMetricas);

const fs = require('fs');
const path = require('path');
const analyticsService = require('../../../src/services/analytics/analyticsService');
const kpiService = require('../../../src/services/analytics/kpiService');

const A = 'tenant-a';
const B = 'tenant-b';

beforeEach(() => {
  jest.clearAllMocks();
  mockMetricas.expedientesActivos.mockResolvedValue(7);
  mockMetricas.volumenDeclaraciones.mockResolvedValue({ total: 40, pendientes: 4 });
  for (const a of kpiService.getActiveAlerts({}, undefined).alerts) kpiService.dismissAlert(a.id, undefined);
});

describe('getRealTimeMetrics: datos reales', () => {
  test('activeDeclarations y pendingSubmissions salen de realMetrics del ámbito', async () => {
    const m = await analyticsService.getRealTimeMetrics(A);
    expect(m.activeDeclarations).toBe(7);
    expect(m.pendingSubmissions).toBe(4);
    expect(mockMetricas.expedientesActivos).toHaveBeenCalledWith(A);
    const [tenant, rango] = mockMetricas.volumenDeclaraciones.mock.calls[0];
    expect(tenant).toBe(A);
    expect(Math.round((rango.hasta - rango.desde) / 86400000)).toBe(30);
  });

  test('devuelve la misma cifra en cada llamada (no es aleatorio)', async () => {
    const a = await analyticsService.getRealTimeMetrics(A);
    const b = await analyticsService.getRealTimeMetrics(A);
    expect([b.activeDeclarations, b.pendingSubmissions]).toEqual([a.activeDeclarations, a.pendingSubmissions]);
  });

  test('un cero real sigue siendo 0', async () => {
    mockMetricas.expedientesActivos.mockResolvedValue(0);
    mockMetricas.volumenDeclaraciones.mockResolvedValue({ total: 0, pendientes: 0 });
    const m = await analyticsService.getRealTimeMetrics(A);
    expect(m.activeDeclarations).toBe(0);
    expect(m.pendingSubmissions).toBe(0);
  });

  test('plataforma (undefined) agrega: se pasa undefined a realMetrics', async () => {
    await analyticsService.getRealTimeMetrics(undefined);
    expect(mockMetricas.expedientesActivos).toHaveBeenCalledWith(undefined);
    expect(mockMetricas.volumenDeclaraciones.mock.calls[0][0]).toBeUndefined();
  });

  test('sin tenant (null) no ve nada: ceros y no se consulta realMetrics', async () => {
    const m = await analyticsService.getRealTimeMetrics(null);
    expect(m.activeDeclarations).toBe(0);
    expect(m.pendingSubmissions).toBe(0);
    expect(m.alerts).toEqual({ critical: 0, warning: 0, info: 0 });
    expect(mockMetricas.expedientesActivos).not.toHaveBeenCalled();
    expect(mockMetricas.volumenDeclaraciones).not.toHaveBeenCalled();
  });
});

describe('getRealTimeMetrics: alertas del ámbito', () => {
  test('agrupa por severidad las alertas activas del tenant (y no las de otro)', async () => {
    await kpiService.calculateKPI('error_rate', { errorRate: 9 }, A);          // crítica
    await kpiService.calculateKPI('rejection_rate', { rejectionRate: 4 }, A);  // aviso
    await kpiService.calculateKPI('error_rate', { errorRate: 9 }, B);          // otro tenant

    const a = await analyticsService.getRealTimeMetrics(A);
    expect(a.alerts).toEqual({ critical: 1, warning: 1, info: 0 });
    const plataforma = await analyticsService.getRealTimeMetrics(undefined);
    expect(plataforma.alerts.critical).toBe(2);
  });

  test('sin alertas: ceros reales', async () => {
    expect((await analyticsService.getRealTimeMetrics(A)).alerts).toEqual({ critical: 0, warning: 0, info: 0 });
  });
});

describe('getRealTimeMetrics: lo que no tiene fuente no se inventa', () => {
  test('la conectividad AEAT es null (no "Conectado" con una latencia inventada)', async () => {
    expect((await analyticsService.getRealTimeMetrics(A)).aeatStatus).toBeNull();
  });

  test('no devuelve actividad reciente ni colas inventadas', async () => {
    const m = await analyticsService.getRealTimeMetrics(A);
    expect(m).not.toHaveProperty('recentActivity');
    expect(m).not.toHaveProperty('queueStatus');
  });

  test('si falla una fuente, la métrica afectada es null y el resto sigue', async () => {
    mockMetricas.expedientesActivos.mockRejectedValue(new Error('db'));
    const m = await analyticsService.getRealTimeMetrics(A);
    expect(m.activeDeclarations).toBeNull();
    expect(m.pendingSubmissions).toBe(4);
  });
});

describe('vigilancia: getRealTimeMetrics no genera datos', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../../../src/services/analytics/analyticsService.js'), 'utf8');
  const inicio = fuente.indexOf('async function getRealTimeMetrics');
  const cuerpo = fuente.slice(inicio, fuente.indexOf('\n}\n', inicio));

  test('existe y es async', () => {
    expect(inicio).toBeGreaterThan(-1);
  });

  test('su cuerpo no usa _generateMetricValue ni Math.random', () => {
    expect(cuerpo).not.toMatch(/_generateMetricValue|Math\.random/);
  });
});
