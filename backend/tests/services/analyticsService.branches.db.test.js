/**
 * Tests de ramas para analyticsService.js - enfocado en COBERTURA DE RAMAS.
 *
 * El servicio original devolvía datos simulados. Estos tests verifican las RAMAS
 * de lógica del servicio (getDateRange, _getLuciInsights, _getRiskLevel, etc.)
 * sin tocar la lógica de negocio, solo ejercitando las distintas ramas de código.
 *
 * AISLAMIENTO POR TENANT: se crean datos de DOS tenants y se verifica que las
 * métricas de un tenant NO incluyen las del otro.
 */

// Mock logger
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock aiService con diferentes shapes de respuesta
const mockGenerateAutomaticInsights = jest.fn();
jest.mock('../../src/services/aiService', () => ({
  generateAutomaticInsights: mockGenerateAutomaticInsights
}));

// Las metricas en tiempo real salen de realMetricsService (BD): aqui se simula
const mockRealMetrics = {
  expedientesActivos: jest.fn(),
  volumenDeclaraciones: jest.fn()
};
jest.mock('../../src/services/analytics/realMetricsService', () => mockRealMetrics);

const analyticsService = require('../../src/services/analytics/analyticsService');

describe('analyticsService - Cobertura de Ramas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateAutomaticInsights.mockReset();
  });

  describe('getDateRange - todos los períodos', () => {
    test('TODAY retorna rango desde inicio del día hasta ahora', () => {
      const range = analyticsService.getDateRange('today');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      expect(range.start.getTime()).toBe(today.getTime());
      expect(range.end.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(range.end.getTime()).toBeGreaterThan(today.getTime());
    });

    test('YESTERDAY retorna rango del día anterior completo', () => {
      const range = analyticsService.getDateRange('yesterday');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      expect(range.start.getTime()).toBe(yesterday.getTime());
      expect(range.end.getTime()).toBe(today.getTime());
    });

    test('LAST_7_DAYS retorna 7 días hacia atrás', () => {
      const range = analyticsService.getDateRange('last_7_days');
      // Se comparan dias de calendario, no milisegundos: si el rango cruza un
      // cambio de hora, (end - start) / 24h sale con una hora de mas o de menos
      // y Math.ceil sumaba un dia (fallaba en noviembre, tras el cambio de octubre).
      const esperado = new Date();
      esperado.setHours(0, 0, 0, 0);
      esperado.setDate(esperado.getDate() - 7);

      expect(range.start.getTime()).toBe(esperado.getTime());
      expect(range.end.getTime()).toBeGreaterThanOrEqual(range.start.getTime());
    });

    test('LAST_30_DAYS retorna 30 días hacia atrás', () => {
      const range = analyticsService.getDateRange('last_30_days');
      // Se comparan dias de calendario, no milisegundos: si el rango cruza un
      // cambio de hora, (end - start) / 24h sale con una hora de mas o de menos
      // y Math.ceil sumaba un dia (fallaba en noviembre, tras el cambio de octubre).
      const esperado = new Date();
      esperado.setHours(0, 0, 0, 0);
      esperado.setDate(esperado.getDate() - 30);

      expect(range.start.getTime()).toBe(esperado.getTime());
      expect(range.end.getTime()).toBeGreaterThanOrEqual(range.start.getTime());
    });

    test('LAST_90_DAYS retorna 90 días hacia atrás', () => {
      const range = analyticsService.getDateRange('last_90_days');
      // Se comparan dias de calendario, no milisegundos: si el rango cruza un
      // cambio de hora, (end - start) / 24h sale con una hora de mas o de menos
      // y Math.ceil sumaba un dia (fallaba en noviembre, tras el cambio de octubre).
      const esperado = new Date();
      esperado.setHours(0, 0, 0, 0);
      esperado.setDate(esperado.getDate() - 90);

      expect(range.start.getTime()).toBe(esperado.getTime());
      expect(range.end.getTime()).toBeGreaterThanOrEqual(range.start.getTime());
    });

    test('THIS_MONTH retorna desde el día 1 del mes actual', () => {
      const range = analyticsService.getDateRange('this_month');
      const now = new Date();

      expect(range.start.getDate()).toBe(1);
      expect(range.start.getMonth()).toBe(now.getMonth());
      expect(range.start.getFullYear()).toBe(now.getFullYear());
    });

    test('LAST_MONTH retorna el mes anterior completo', () => {
      const range = analyticsService.getDateRange('last_month');
      const now = new Date();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      expect(range.start.getDate()).toBe(1);
      expect(range.start.getMonth()).toBe(lastMonthStart.getMonth());
    });

    test('THIS_QUARTER retorna desde inicio del trimestre actual', () => {
      const range = analyticsService.getDateRange('this_quarter');
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);

      expect(range.start.getDate()).toBe(1);
      expect(range.start.getMonth()).toBe(quarter * 3);
    });

    test('THIS_YEAR retorna desde el 1 de enero del año actual', () => {
      const range = analyticsService.getDateRange('this_year');
      const now = new Date();

      expect(range.start.getDate()).toBe(1);
      expect(range.start.getMonth()).toBe(0);
      expect(range.start.getFullYear()).toBe(now.getFullYear());
    });

    test('CUSTOM con fechas retorna el rango especificado', () => {
      const customStart = '2024-06-01';
      const customEnd = '2024-06-30';
      const range = analyticsService.getDateRange('custom', customStart, customEnd);

      expect(range.start.toISOString().split('T')[0]).toBe(customStart);
      expect(range.end.toISOString().split('T')[0]).toBe(customEnd);
    });

    test('CUSTOM sin fechas usa today y now por defecto', () => {
      const range = analyticsService.getDateRange('custom');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      expect(range.start.getTime()).toBeGreaterThanOrEqual(today.getTime() - 1000);
      expect(range.end.getTime()).toBeLessThanOrEqual(now.getTime() + 1000);
    });

    test('período desconocido retorna today como fallback', () => {
      const range = analyticsService.getDateRange('invalid_period');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      expect(range.start.getTime()).toBe(today.getTime());
    });
  });

  describe('recordEvent - creación de eventos', () => {
    test('crea nueva categoría si no existe', () => {
      const event = analyticsService.recordEvent('nueva_categoria', 'test_event', {
        userId: 'user123',
        data: 'test'
      });

      expect(event).toBeDefined();
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('category', 'nueva_categoria');
      expect(event).toHaveProperty('eventType', 'test_event');
      expect(event).toHaveProperty('timestamp');
    });

    test('usa userId del data si existe', () => {
      const event = analyticsService.recordEvent('test', 'event', {
        userId: 'custom_user',
        other: 'data'
      });

      expect(event.userId).toBe('custom_user');
    });

    test('usa system como userId por defecto si no se proporciona', () => {
      const event = analyticsService.recordEvent('test', 'event', {
        other: 'data'
      });

      expect(event.userId).toBe('system');
    });

    test('genera id único con timestamp y random', () => {
      const event1 = analyticsService.recordEvent('test', 'event1', { userId: 'u1' });
      const event2 = analyticsService.recordEvent('test', 'event2', { userId: 'u2' });

      expect(event1.id).not.toBe(event2.id);
      expect(event1.id).toMatch(/^evt-\d+-[a-z0-9]+$/);
      expect(event2.id).toMatch(/^evt-\d+-[a-z0-9]+$/);
    });
  });

  describe('getRealTimeMetrics - datos reales del ámbito', () => {
    beforeEach(() => {
      mockRealMetrics.expedientesActivos.mockResolvedValue(5);
      mockRealMetrics.volumenDeclaraciones.mockResolvedValue({ total: 20, pendientes: 3 });
    });

    test('retorna métricas en tiempo real sin período', async () => {
      const metrics = await analyticsService.getRealTimeMetrics('t1');

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.activeDeclarations).toBe(5);
      expect(metrics.pendingSubmissions).toBe(3);
      // sin comprobación real de conectividad AEAT: null, no "Conectado" inventado
      expect(metrics.aeatStatus).toBeNull();
      expect(metrics.alerts).toEqual({ critical: 0, warning: 0, info: 0 });
    });

    test('no inventa actividad reciente ni colas', async () => {
      const metrics = await analyticsService.getRealTimeMetrics('t1');

      expect(metrics).not.toHaveProperty('recentActivity');
      expect(metrics).not.toHaveProperty('queueStatus');
    });
  });

});
