/**
 * Tests for Analytics Service
 * Phase 6.2: Analytics and Business Intelligence Tests
 */

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock aiService
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn().mockResolvedValue({
    summary: 'Analytics analysis complete',
    recommendations: ['Optimize operations'],
    warnings: []
  })
}));

// Las metricas en tiempo real salen de realMetricsService (BD): aqui se simula
const mockRealMetrics = { expedientesActivos: jest.fn(), volumenDeclaraciones: jest.fn() };
jest.mock('../../../src/services/analytics/realMetricsService', () => mockRealMetrics);

const analyticsService = require('../../../src/services/analytics/analyticsService');

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    test('should define TIME_PERIODS', () => {
      expect(analyticsService.TIME_PERIODS).toBeDefined();
      expect(analyticsService.TIME_PERIODS.TODAY).toBe('today');
      expect(analyticsService.TIME_PERIODS.LAST_30_DAYS).toBe('last_30_days');
      expect(analyticsService.TIME_PERIODS.THIS_MONTH).toBe('this_month');
    });

    test('should define METRIC_CATEGORIES', () => {
      expect(analyticsService.METRIC_CATEGORIES).toBeDefined();
      expect(analyticsService.METRIC_CATEGORIES.OPERATIONS).toBe('operations');
      expect(analyticsService.METRIC_CATEGORIES.FINANCIAL).toBe('financial');
    });

    test('should define CHANNELS', () => {
      expect(analyticsService.CHANNELS).toBeDefined();
      expect(analyticsService.CHANNELS.GREEN).toBe('green');
      expect(analyticsService.CHANNELS.RED).toBe('red');
    });
  });

  describe('getDateRange', () => {
    test('should return correct range for today', () => {
      const range = analyticsService.getDateRange('today');

      expect(range).toHaveProperty('start');
      expect(range).toHaveProperty('end');
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
    });

    test('should return correct range for last_7_days', () => {
      const range = analyticsService.getDateRange('last_7_days');
      const daysDiff = Math.ceil((range.end - range.start) / (24 * 60 * 60 * 1000));

      expect(daysDiff).toBeGreaterThanOrEqual(7);
    });

    test('should return correct range for this_month', () => {
      const range = analyticsService.getDateRange('this_month');

      expect(range.start.getDate()).toBe(1);
    });

    test('should handle custom range', () => {
      const customStart = '2024-01-01';
      const customEnd = '2024-01-31';
      const range = analyticsService.getDateRange('custom', customStart, customEnd);

      expect(range.start.toISOString().split('T')[0]).toBe(customStart);
    });
  });

  describe('getRealTimeMetrics', () => {
    beforeEach(() => {
      mockRealMetrics.expedientesActivos.mockResolvedValue(3);
      mockRealMetrics.volumenDeclaraciones.mockResolvedValue({ total: 10, pendientes: 2 });
    });

    test('should return real-time metrics', async () => {
      const metrics = await analyticsService.getRealTimeMetrics('t1');

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.activeDeclarations).toBe(3);
      expect(metrics.pendingSubmissions).toBe(2);
      expect(metrics).toHaveProperty('aeatStatus');
    });

    test('should not include invented queue status', async () => {
      const metrics = await analyticsService.getRealTimeMetrics('t1');

      expect(metrics.queueStatus).toBeUndefined();
    });
  });

  describe('recordEvent', () => {
    test('should record analytics event', () => {
      const event = analyticsService.recordEvent('declarations', 'submitted', { declarationId: '123' });

      expect(event).toBeDefined();
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('category', 'declarations');
      expect(event).toHaveProperty('eventType', 'submitted');
      expect(event).toHaveProperty('timestamp');
    });
  });
});
