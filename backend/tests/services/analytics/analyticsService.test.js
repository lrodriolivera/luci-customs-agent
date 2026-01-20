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

  describe('getDashboardMetrics', () => {
    test('should return dashboard metrics', async () => {
      const result = await analyticsService.getDashboardMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include period information', async () => {
      const result = await analyticsService.getDashboardMetrics('last_30_days');

      expect(result.data.period).toBeDefined();
      expect(result.data.period.name).toBe('last_30_days');
    });

    test('should include operations metrics', async () => {
      const result = await analyticsService.getDashboardMetrics();

      expect(result.data.operations).toBeDefined();
      expect(result.data.operations).toHaveProperty('totalDeclarations');
      expect(result.data.operations).toHaveProperty('declarationsByType');
    });

    test('should include channel distribution', async () => {
      const result = await analyticsService.getDashboardMetrics();

      expect(result.data.channels).toBeDefined();
      expect(result.data.channels).toHaveProperty('green');
      expect(result.data.channels).toHaveProperty('orange');
      expect(result.data.channels).toHaveProperty('red');
    });

    test('should include financial metrics', async () => {
      const result = await analyticsService.getDashboardMetrics();

      expect(result.data.financial).toBeDefined();
      expect(result.data.financial).toHaveProperty('totalDutiesCalculated');
    });

    test('should include compliance metrics', async () => {
      const result = await analyticsService.getDashboardMetrics();

      expect(result.data.compliance).toBeDefined();
      expect(result.data.compliance).toHaveProperty('errorRate');
    });

    test('should include trends', async () => {
      const result = await analyticsService.getDashboardMetrics();

      expect(result.data.trends).toBeDefined();
    });

    test('should include LUCI insights when requested', async () => {
      const result = await analyticsService.getDashboardMetrics('last_30_days', { includeInsights: true });

      expect(result.data.luciInsights).toBeDefined();
    });
  });

  describe('getDeclarationAnalytics', () => {
    test('should return declaration analytics', async () => {
      const result = await analyticsService.getDeclarationAnalytics();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include summary', async () => {
      const result = await analyticsService.getDeclarationAnalytics();

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary).toHaveProperty('total');
      expect(result.data.summary).toHaveProperty('submitted');
    });

    test('should include byType breakdown', async () => {
      const result = await analyticsService.getDeclarationAnalytics();

      expect(result.data.byType).toBeDefined();
      expect(result.data.byType).toHaveProperty('H1');
      expect(result.data.byType).toHaveProperty('H7');
    });

    test('should include byChannel breakdown', async () => {
      const result = await analyticsService.getDeclarationAnalytics();

      expect(result.data.byChannel).toBeDefined();
    });

    test('should include topOrigins', async () => {
      const result = await analyticsService.getDeclarationAnalytics();

      expect(result.data.topOrigins).toBeDefined();
      expect(Array.isArray(result.data.topOrigins)).toBe(true);
    });

    test('should include topCommodities', async () => {
      const result = await analyticsService.getDeclarationAnalytics();

      expect(result.data.topCommodities).toBeDefined();
      expect(Array.isArray(result.data.topCommodities)).toBe(true);
    });
  });

  describe('getFinancialAnalytics', () => {
    test('should return financial analytics', async () => {
      const result = await analyticsService.getFinancialAnalytics();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include financial summary', async () => {
      const result = await analyticsService.getFinancialAnalytics();

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary).toHaveProperty('totalCustomsValue');
      expect(result.data.summary).toHaveProperty('totalDuties');
      expect(result.data.summary).toHaveProperty('totalVAT');
    });

    test('should include savings information', async () => {
      const result = await analyticsService.getFinancialAnalytics();

      expect(result.data.savings).toBeDefined();
      expect(result.data.savings).toHaveProperty('fromPreferences');
    });

    test('should include guarantees information', async () => {
      const result = await analyticsService.getFinancialAnalytics();

      expect(result.data.guarantees).toBeDefined();
      expect(result.data.guarantees).toHaveProperty('totalActive');
      expect(result.data.guarantees).toHaveProperty('utilizationRate');
    });

    test('should include projections', async () => {
      const result = await analyticsService.getFinancialAnalytics();

      expect(result.data.projections).toBeDefined();
      expect(result.data.projections).toHaveProperty('nextMonth');
    });
  });

  describe('getComplianceAnalytics', () => {
    test('should return compliance analytics', async () => {
      const result = await analyticsService.getComplianceAnalytics();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include compliance summary', async () => {
      const result = await analyticsService.getComplianceAnalytics();

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary).toHaveProperty('overallScore');
      expect(result.data.summary).toHaveProperty('riskLevel');
    });

    test('should include errors breakdown', async () => {
      const result = await analyticsService.getComplianceAnalytics();

      expect(result.data.errors).toBeDefined();
      expect(result.data.errors).toHaveProperty('total');
      expect(result.data.errors).toHaveProperty('byCategory');
    });

    test('should include inspections data', async () => {
      const result = await analyticsService.getComplianceAnalytics();

      expect(result.data.inspections).toBeDefined();
      expect(result.data.inspections).toHaveProperty('total');
    });

    test('should include OEA status', async () => {
      const result = await analyticsService.getComplianceAnalytics();

      expect(result.data.oeaStatus).toBeDefined();
    });
  });

  describe('getPerformanceAnalytics', () => {
    test('should return performance analytics', async () => {
      const result = await analyticsService.getPerformanceAnalytics();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include system metrics', async () => {
      const result = await analyticsService.getPerformanceAnalytics();

      expect(result.data.system).toBeDefined();
      expect(result.data.system).toHaveProperty('uptime');
      expect(result.data.system).toHaveProperty('responseTime');
    });

    test('should include AEAT connectivity', async () => {
      const result = await analyticsService.getPerformanceAnalytics();

      expect(result.data.aeatConnectivity).toBeDefined();
      expect(result.data.aeatConnectivity).toHaveProperty('availability');
    });

    test('should include LUCI performance', async () => {
      const result = await analyticsService.getPerformanceAnalytics();

      expect(result.data.luciPerformance).toBeDefined();
      expect(result.data.luciPerformance).toHaveProperty('accuracy');
    });
  });

  describe('getRealTimeMetrics', () => {
    test('should return real-time metrics', () => {
      const metrics = analyticsService.getRealTimeMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('activeDeclarations');
      expect(metrics).toHaveProperty('aeatStatus');
    });

    test('should include queue status', () => {
      const metrics = analyticsService.getRealTimeMetrics();

      expect(metrics.queueStatus).toBeDefined();
    });
  });

  describe('getComparisonReport', () => {
    test('should return comparison between periods', async () => {
      const result = await analyticsService.getComparisonReport('this_month', 'last_month');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include period information', async () => {
      const result = await analyticsService.getComparisonReport('this_month', 'last_month');

      expect(result.data.periods).toBeDefined();
      expect(result.data.periods.current).toBeDefined();
      expect(result.data.periods.previous).toBeDefined();
    });

    test('should include changes', async () => {
      const result = await analyticsService.getComparisonReport('this_month', 'last_month');

      expect(result.data.changes).toBeDefined();
    });

    test('should include highlights', async () => {
      const result = await analyticsService.getComparisonReport('this_month', 'last_month');

      expect(result.data.highlights).toBeDefined();
      expect(Array.isArray(result.data.highlights)).toBe(true);
    });
  });

  describe('queryAnalytics', () => {
    test('should execute custom query', async () => {
      const query = {
        metrics: ['declarations', 'value'],
        period: 'last_30_days'
      };

      const result = await analyticsService.queryAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should return aggregations', async () => {
      const query = {
        metrics: ['declarations'],
        period: 'last_30_days'
      };

      const result = await analyticsService.queryAnalytics(query);

      expect(result.data.aggregations).toBeDefined();
      expect(result.data.aggregations.declarations).toBeDefined();
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
