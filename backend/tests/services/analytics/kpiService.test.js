/**
 * Tests for KPI Service
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
    summary: 'KPI analysis complete',
    recommendations: ['Focus on efficiency'],
    warnings: []
  })
}));

const kpiService = require('../../../src/services/analytics/kpiService');

describe('KPI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    test('should define KPI_CATEGORIES', () => {
      expect(kpiService.KPI_CATEGORIES).toBeDefined();
      expect(kpiService.KPI_CATEGORIES.OPERATIONAL).toBe('operational');
      expect(kpiService.KPI_CATEGORIES.FINANCIAL).toBe('financial');
      expect(kpiService.KPI_CATEGORIES.COMPLIANCE).toBe('compliance');
    });

    test('should define ALERT_SEVERITY', () => {
      expect(kpiService.ALERT_SEVERITY).toBeDefined();
      expect(kpiService.ALERT_SEVERITY.CRITICAL).toBe('critical');
      expect(kpiService.ALERT_SEVERITY.WARNING).toBe('warning');
      expect(kpiService.ALERT_SEVERITY.INFO).toBe('info');
    });

    test('should define KPI_DEFINITIONS', () => {
      expect(kpiService.KPI_DEFINITIONS).toBeDefined();
      expect(Object.keys(kpiService.KPI_DEFINITIONS).length).toBeGreaterThan(0);
    });
  });

  describe('getKPIDefinitions', () => {
    test('should return all KPI definitions', () => {
      const definitions = kpiService.getKPIDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBeGreaterThan(0);
    });

    test('should include required properties in each definition', () => {
      const definitions = kpiService.getKPIDefinitions();

      definitions.forEach(def => {
        expect(def).toHaveProperty('id');
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('category');
        expect(def).toHaveProperty('unit');
        expect(def).toHaveProperty('thresholds');
      });
    });
  });

  describe('getKPIsByCategory', () => {
    test('should return KPIs for operational category', () => {
      const kpis = kpiService.getKPIsByCategory('operational');

      expect(Array.isArray(kpis)).toBe(true);
      kpis.forEach(kpi => {
        expect(kpi.category).toBe('operational');
      });
    });

    test('should return KPIs for financial category', () => {
      const kpis = kpiService.getKPIsByCategory('financial');

      expect(Array.isArray(kpis)).toBe(true);
      kpis.forEach(kpi => {
        expect(kpi.category).toBe('financial');
      });
    });
  });

  describe('calculateKPI', () => {
    test('should calculate declarations_per_day KPI', async () => {
      const result = await kpiService.calculateKPI('declarations_per_day');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.kpiId).toBe('declarations_per_day');
      expect(result.data.value).toBeDefined();
    });

    test('should return error for unknown KPI', async () => {
      const result = await kpiService.calculateKPI('unknown_kpi');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should include status in result', async () => {
      const result = await kpiService.calculateKPI('green_channel_rate');

      expect(result.data.status).toBeDefined();
      expect(['good', 'ok', 'warning', 'critical']).toContain(result.data.status);
    });

    test('should include trend in result', async () => {
      const result = await kpiService.calculateKPI('error_rate');

      expect(result.data.trend).toBeDefined();
      expect(result.data.trend).toHaveProperty('direction');
    });

    test('should include target in result', async () => {
      const result = await kpiService.calculateKPI('compliance_score');

      expect(result.data.target).toBeDefined();
    });
  });

  describe('getAllKPIs', () => {
    test('should return all KPIs with values', async () => {
      const result = await kpiService.getAllKPIs();

      expect(result.success).toBe(true);
      expect(result.data.all).toBeDefined();
      expect(Array.isArray(result.data.all)).toBe(true);
    });

    test('should group KPIs by category', async () => {
      const result = await kpiService.getAllKPIs();

      expect(result.data.byCategory).toBeDefined();
      expect(result.data.byCategory.operational).toBeDefined();
      expect(result.data.byCategory.financial).toBeDefined();
    });

    test('should include summary', async () => {
      const result = await kpiService.getAllKPIs();

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary).toHaveProperty('total');
      expect(result.data.summary).toHaveProperty('good');
    });
  });

  describe('getKPIHistory', () => {
    test('should return KPI history', () => {
      const result = kpiService.getKPIHistory('declarations_per_day');

      expect(result.success).toBe(true);
      expect(result.kpiId).toBe('declarations_per_day');
      expect(result.definition).toBeDefined();
      expect(result.history).toBeDefined();
    });

    test('should include statistics', () => {
      const result = kpiService.getKPIHistory('declarations_per_day');

      expect(result.statistics).toBeDefined();
      expect(result.statistics).toHaveProperty('min');
      expect(result.statistics).toHaveProperty('max');
      expect(result.statistics).toHaveProperty('avg');
    });
  });

  describe('setKPITarget', () => {
    test('should set custom target', () => {
      const result = kpiService.setKPITarget('declarations_per_day', 20);

      expect(result.success).toBe(true);
      expect(result.kpiId).toBe('declarations_per_day');
      expect(result.newTarget).toBe(20);
    });

    test('should return error for unknown KPI', () => {
      const result = kpiService.setKPITarget('unknown_kpi', 10);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getActiveAlerts', () => {
    test('should return active alerts', () => {
      const result = kpiService.getActiveAlerts();

      expect(result.success).toBe(true);
      expect(result.alerts).toBeDefined();
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    test('should include alert counts', () => {
      const result = kpiService.getActiveAlerts();

      expect(result.counts).toBeDefined();
      expect(result.counts).toHaveProperty('total');
      expect(result.counts).toHaveProperty('critical');
      expect(result.counts).toHaveProperty('warning');
    });

    test('should filter by severity', () => {
      const result = kpiService.getActiveAlerts({ severity: 'critical' });

      result.alerts.forEach(alert => {
        expect(alert.severity).toBe('critical');
      });
    });
  });

  describe('acknowledgeAlert', () => {
    test('should return error for non-existent alert', () => {
      const result = kpiService.acknowledgeAlert('non-existent-id', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Alert not found');
    });
  });

  describe('dismissAlert', () => {
    test('should return error for non-existent alert', () => {
      const result = kpiService.dismissAlert('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Alert not found');
    });
  });

  describe('getKPIDashboard', () => {
    test('should return KPI dashboard data', async () => {
      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include health score', async () => {
      const result = await kpiService.getKPIDashboard();

      expect(result.data.healthScore).toBeDefined();
      expect(typeof result.data.healthScore).toBe('number');
    });

    test('should include KPIs data', async () => {
      const result = await kpiService.getKPIDashboard();

      expect(result.data.kpis).toBeDefined();
    });

    test('should include alerts', async () => {
      const result = await kpiService.getKPIDashboard();

      expect(result.data.alerts).toBeDefined();
    });

    test('should include trends', async () => {
      const result = await kpiService.getKPIDashboard();

      expect(result.data.trends).toBeDefined();
    });
  });

  describe('compareKPIs', () => {
    test('should compare KPIs between periods', async () => {
      const result = await kpiService.compareKPIs('this_month', 'last_month');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include period information', async () => {
      const result = await kpiService.compareKPIs('this_month', 'last_month');

      expect(result.data.period1).toBe('this_month');
      expect(result.data.period2).toBe('last_month');
    });

    test('should include KPI comparison data', async () => {
      const result = await kpiService.compareKPIs('this_month', 'last_month');

      expect(result.data.kpis).toBeDefined();
      expect(Object.keys(result.data.kpis).length).toBeGreaterThan(0);
    });

    test('should include change percentage for each KPI', async () => {
      const result = await kpiService.compareKPIs('this_month', 'last_month');

      Object.values(result.data.kpis).forEach(kpi => {
        expect(kpi).toHaveProperty('change');
        expect(kpi).toHaveProperty('improved');
      });
    });
  });
});
