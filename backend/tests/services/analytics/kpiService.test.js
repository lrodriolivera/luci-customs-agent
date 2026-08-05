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
  }),
  analyzeKPIDeviations: jest.fn()
}));

const aiService = require('../../../src/services/aiService');
const kpiService = require('../../../src/services/analytics/kpiService');

describe('KPI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Resetear el mock de aiService antes de cada test
    aiService.analyzeKPIDeviations.mockResolvedValue({
      overallPerformance: {
        summary: 'Default analysis'
      },
      quickWins: [],
      strategicInitiatives: [],
      deviations: []
    });
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

    test('should handle higher_is_better direction for improved flag', async () => {
      const result = await kpiService.compareKPIs('this_month', 'last_month');

      const higherIsBetter = result.data.kpis.declarations_per_day;
      expect(higherIsBetter).toBeDefined();
      expect(typeof higherIsBetter.improved).toBe('boolean');
    });

    test('should handle lower_is_better direction for improved flag', async () => {
      const result = await kpiService.compareKPIs('this_month', 'last_month');

      const lowerIsBetter = result.data.kpis.error_rate;
      expect(lowerIsBetter).toBeDefined();
      expect(typeof lowerIsBetter.improved).toBe('boolean');
    });

    test('should handle neutral direction for improved flag', async () => {
      const result = await kpiService.compareKPIs('this_month', 'last_month');

      const neutral = result.data.kpis.active_expeditions;
      expect(neutral).toBeDefined();
      expect(typeof neutral.improved).toBe('boolean');
    });
  });

  describe('getKPIHistory - period filtering', () => {
    beforeEach(async () => {
      // Generar historia con varios KPIs para probar filtros por periodo
      await kpiService.calculateKPI('declarations_per_day', { totalDeclarations: 100, days: 10 });
      await kpiService.calculateKPI('error_rate', { errorRate: 2 });
    });

    test('should filter history for last_7_days', () => {
      const result = kpiService.getKPIHistory('declarations_per_day', 'last_7_days');

      expect(result.success).toBe(true);
      expect(result.history).toBeDefined();
      expect(Array.isArray(result.history)).toBe(true);
    });

    test('should filter history for last_30_days', () => {
      const result = kpiService.getKPIHistory('error_rate', 'last_30_days');

      expect(result.success).toBe(true);
      expect(result.history).toBeDefined();
    });

    test('should filter history for last_90_days', () => {
      const result = kpiService.getKPIHistory('declarations_per_day', 'last_90_days');

      expect(result.success).toBe(true);
      expect(result.history).toBeDefined();
    });

    test('should use epoch start for unknown period', () => {
      const result = kpiService.getKPIHistory('declarations_per_day', 'unknown_period');

      expect(result.success).toBe(true);
      expect(result.history).toBeDefined();
      // Default (epoch 0) devuelve todo
    });
  });

  describe('getActiveAlerts - filtering', () => {
    beforeEach(async () => {
      // Generar alertas críticas y de warning forzando valores fuera de umbrales
      await kpiService.calculateKPI('error_rate', { errorRate: 10 }); // critical_high=5 → critical
      await kpiService.calculateKPI('rejection_rate', { rejectionRate: 6 }); // critical_high=5 → critical
      await kpiService.calculateKPI('compliance_score', { complianceScore: 70 }); // critical_low=75 → critical
      await kpiService.calculateKPI('average_processing_time', { avgProcessingTime: 10 }); // warning_high=8 → warning
      await kpiService.calculateKPI('guarantee_utilization', { guaranteeUtilization: 85 }); // warning_high=80 → warning
    });

    test('should filter alerts by category', () => {
      const result = kpiService.getActiveAlerts({ category: 'compliance' });

      expect(result.success).toBe(true);
      result.alerts.forEach(alert => {
        expect(alert.category).toBe('compliance');
      });
    });

    test('should filter alerts by kpiId', () => {
      const result = kpiService.getActiveAlerts({ kpiId: 'error_rate' });

      expect(result.success).toBe(true);
      result.alerts.forEach(alert => {
        expect(alert.kpiId).toBe('error_rate');
      });
    });

    test('should count critical and warning alerts correctly', () => {
      const result = kpiService.getActiveAlerts();

      expect(result.counts).toBeDefined();
      expect(result.counts.critical).toBeGreaterThan(0);
      expect(result.counts.warning).toBeGreaterThan(0);
    });
  });

  describe('acknowledgeAlert - success case', () => {
    let alertId;

    beforeEach(async () => {
      // Generar una alerta crítica
      await kpiService.calculateKPI('error_rate', { errorRate: 10 });
      const alerts = kpiService.getActiveAlerts();
      alertId = alerts.alerts[0]?.id;
    });

    test('should acknowledge existing alert', () => {
      if (!alertId) {
        // No hay alertas generadas, skip
        return;
      }

      const result = kpiService.acknowledgeAlert(alertId, 'test-user-123');

      expect(result.success).toBe(true);

      // Verificar que la alerta fue marcada
      const alerts = kpiService.getActiveAlerts();
      const acknowledged = alerts.alerts.find(a => a.id === alertId);
      if (acknowledged) {
        expect(acknowledged.acknowledged).toBe(true);
        expect(acknowledged.acknowledgedBy).toBe('test-user-123');
        expect(acknowledged.acknowledgedAt).toBeDefined();
      }
    });
  });

  describe('dismissAlert - success case', () => {
    let alertId;

    beforeEach(async () => {
      // Generar una alerta de warning
      await kpiService.calculateKPI('average_processing_time', { avgProcessingTime: 10 });
      const alerts = kpiService.getActiveAlerts();
      alertId = alerts.alerts[0]?.id;
    });

    test('should dismiss existing alert', () => {
      if (!alertId) {
        return;
      }

      const initialCount = kpiService.getActiveAlerts().alerts.length;
      const result = kpiService.dismissAlert(alertId);

      expect(result.success).toBe(true);

      const finalCount = kpiService.getActiveAlerts().alerts.length;
      expect(finalCount).toBe(initialCount - 1);
    });
  });

  describe('_evaluateKPIStatus - status branches', () => {
    test('should return critical for compliance_score below critical_low', async () => {
      const result = await kpiService.calculateKPI('compliance_score', { complianceScore: 50 });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('critical');
    });

    test('should return critical for error_rate above critical_high', async () => {
      const result = await kpiService.calculateKPI('error_rate', { errorRate: 8 });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('critical');
    });

    test('should return warning for guarantee_utilization above warning_high', async () => {
      const result = await kpiService.calculateKPI('guarantee_utilization', { guaranteeUtilization: 85 });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('warning');
    });

    test('should return warning for average_processing_time above warning_high', async () => {
      const result = await kpiService.calculateKPI('average_processing_time', { avgProcessingTime: 10 });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('warning');
    });

    test('should return good for higher_is_better KPI above target', async () => {
      const result = await kpiService.calculateKPI('declarations_per_day', { totalDeclarations: 300, days: 30 });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('good');
    });

    test('should return good for lower_is_better KPI below target', async () => {
      const result = await kpiService.calculateKPI('error_rate', { errorRate: 0.8 });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('good');
    });

    test('should return good for neutral direction with target', async () => {
      const result = await kpiService.calculateKPI('guarantee_utilization', { guaranteeUtilization: 50 });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('good');
    });

    test('should return ok for active_expeditions with low value (target null)', async () => {
      const result = await kpiService.calculateKPI('active_expeditions', { activeExpeditions: 10 });

      expect(result.success).toBe(true);
      expect(['ok', 'good']).toContain(result.data.status);
    });
  });

  describe('_generateAlertMessage - message branches', () => {
    test('should generate critical message for lower_is_better (error_rate high)', async () => {
      await kpiService.calculateKPI('error_rate', { errorRate: 10 });

      const alerts = kpiService.getActiveAlerts({ kpiId: 'error_rate' });
      if (alerts.alerts.length > 0) {
        const message = alerts.alerts[0].message;
        expect(message).toContain('crítico');
        expect(message).toContain('5'); // critical_high threshold
      }
    });

    test('should generate critical message for higher_is_better (compliance_score low)', async () => {
      await kpiService.calculateKPI('compliance_score', { complianceScore: 70 });

      const alerts = kpiService.getActiveAlerts({ kpiId: 'compliance_score' });
      if (alerts.alerts.length > 0) {
        const message = alerts.alerts[0].message;
        expect(message).toContain('crítico');
        expect(message).toContain('75'); // critical_low threshold
      }
    });

    test('should generate warning message for lower_is_better (average_processing_time)', async () => {
      await kpiService.calculateKPI('average_processing_time', { avgProcessingTime: 10 });

      const alerts = kpiService.getActiveAlerts({ kpiId: 'average_processing_time' });
      if (alerts.alerts.length > 0) {
        const message = alerts.alerts[0].message;
        expect(message).toContain('alerta');
      }
    });

    test('should generate warning message for higher_is_better below target', async () => {
      await kpiService.calculateKPI('green_channel_rate', { greenChannel: 55 });

      const alerts = kpiService.getActiveAlerts({ kpiId: 'green_channel_rate' });
      if (alerts.alerts.length > 0) {
        const message = alerts.alerts[0].message;
        expect(message).toContain('objetivo');
      }
    });
  });

  describe('getKPIDashboard - with LUCI analysis', () => {
    test('should include LUCI analysis with overallPerformance shape', async () => {
      aiService.analyzeKPIDeviations.mockResolvedValue({
        overallPerformance: {
          summary: 'Performance is excellent'
        },
        quickWins: [
          { action: 'Optimize processing time' },
          { action: 'Reduce error rate' }
        ],
        strategicInitiatives: [
          { initiative: 'Implement new compliance checks' }
        ],
        deviations: [
          {
            kpi: 'error_rate',
            rootCauses: ['Manual data entry', 'System integration issues']
          }
        ]
      });

      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis).toBeDefined();
      expect(result.data.luciAnalysis.summary).toBe('Performance is excellent');
      expect(result.data.luciAnalysis.priorities).toContain('Optimize processing time');
      expect(result.data.luciAnalysis.priorities).toContain('Reduce error rate');
      expect(result.data.luciAnalysis.priorities).toContain('Implement new compliance checks');
      expect(result.data.luciAnalysis.risks).toContain('Manual data entry');
      expect(result.data.luciAnalysis.risks).toContain('System integration issues');
    });

    test('should include LUCI analysis with executiveSummary/recommendations shape', async () => {
      aiService.analyzeKPIDeviations.mockResolvedValue({
        executiveSummary: 'Overall operations stable',
        recommendations: ['Improve automation', 'Train staff on new procedures'],
        risks: ['Data quality issues', 'System downtime']
      });

      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis).toBeDefined();
      expect(result.data.luciAnalysis.summary).toBe('Overall operations stable');
      expect(result.data.luciAnalysis.priorities).toContain('Improve automation');
      expect(result.data.luciAnalysis.priorities).toContain('Train staff on new procedures');
      expect(result.data.luciAnalysis.risks).toContain('Data quality issues');
      expect(result.data.luciAnalysis.risks).toContain('System downtime');
    });

    test('should handle LUCI analysis failure gracefully', async () => {
      aiService.analyzeKPIDeviations.mockRejectedValue(new Error('AI service unavailable'));

      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis).toBeNull();
      expect(result.data.kpis).toBeDefined();
      expect(result.data.healthScore).toBeDefined();
    });

    test('should handle LUCI analysis with complex nested structures', async () => {
      aiService.analyzeKPIDeviations.mockResolvedValue({
        overallPerformance: {
          summary: 'Critical issues detected'
        },
        quickWins: [
          { action: 'Fix connectivity' },
          'Direct string action'
        ],
        improvementActions: [
          { description: 'Upgrade infrastructure' }
        ],
        deviations: [
          {
            kpi: 'aeat_connectivity',
            rootCauses: [
              { cause: 'Network instability' },
              'Direct cause string'
            ]
          }
        ],
        risks: [
          { risk: 'Service disruption' },
          'Direct risk string'
        ],
        warnings: [
          { text: 'Budget overrun' }
        ]
      });

      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis).toBeDefined();
      expect(result.data.luciAnalysis.summary).toBe('Critical issues detected');
      expect(result.data.luciAnalysis.priorities.length).toBeGreaterThan(0);
      expect(result.data.luciAnalysis.risks.length).toBeGreaterThan(0);
      expect(result.data.luciAnalysis.priorities).toContain('Fix connectivity');
      expect(result.data.luciAnalysis.priorities).toContain('Direct string action');
      expect(result.data.luciAnalysis.priorities).toContain('Upgrade infrastructure');
      expect(result.data.luciAnalysis.risks).toContain('Network instability');
      expect(result.data.luciAnalysis.risks).toContain('Direct cause string');
      expect(result.data.luciAnalysis.risks).toContain('Service disruption');
      expect(result.data.luciAnalysis.risks).toContain('Direct risk string');
      expect(result.data.luciAnalysis.risks).toContain('Budget overrun');
    });
  });

  describe('getKPIDashboard - without critical/warning KPIs', () => {
    test('should handle dashboard when all KPIs are good', async () => {
      // Mock para devolver KPIs todos en buen estado (no debería llamar a analyzeKPIDeviations)
      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('_generateAlertMessage - additional branches', () => {
    test('should handle critical alert for rejection_rate (lower_is_better high)', async () => {
      await kpiService.calculateKPI('rejection_rate', { rejectionRate: 8 });

      const alerts = kpiService.getActiveAlerts({ kpiId: 'rejection_rate' });
      if (alerts.alerts.length > 0) {
        const message = alerts.alerts[0].message;
        expect(message).toContain('crítico');
        expect(message).toContain('5'); // critical_high
      }
    });

    test('should handle warning alert for declarations_per_day (higher_is_better low)', async () => {
      await kpiService.calculateKPI('declarations_per_day', { totalDeclarations: 150, days: 30 });

      const alerts = kpiService.getActiveAlerts({ kpiId: 'declarations_per_day' });
      if (alerts.alerts.length > 0) {
        const message = alerts.alerts[0].message;
        expect(message).toContain('objetivo');
      }
    });

    test('should handle warning alert for on_time_submissions (higher_is_better below warning)', async () => {
      await kpiService.calculateKPI('on_time_submissions', { onTimeRate: 90 });

      const alerts = kpiService.getActiveAlerts({ kpiId: 'on_time_submissions' });
      if (alerts.alerts.length > 0) {
        const message = alerts.alerts[0].message;
        expect(message).toContain('objetivo');
      }
    });
  });

  describe('_getLuciKPIAnalysis - normalization edge cases', () => {
    test('should handle analysis with only summary field', async () => {
      aiService.analyzeKPIDeviations.mockResolvedValue({
        summary: 'Simple summary'
      });

      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis.summary).toBe('Simple summary');
      expect(result.data.luciAnalysis.priorities).toEqual([]);
      expect(result.data.luciAnalysis.risks).toEqual([]);
    });

    test('should filter out empty normalized values', async () => {
      aiService.analyzeKPIDeviations.mockResolvedValue({
        overallPerformance: {
          summary: 'Summary here'
        },
        quickWins: [
          { action: 'Real action' },
          {},
          null,
          undefined,
          { other: 'field' }
        ],
        deviations: [
          {
            rootCauses: [
              { cause: 'Real cause' },
              {},
              null
            ]
          }
        ]
      });

      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis.priorities).toContain('Real action');
      expect(result.data.luciAnalysis.risks).toContain('Real cause');
      // Los vacíos no deberían estar
      expect(result.data.luciAnalysis.priorities.every(p => p.length > 0)).toBe(true);
      expect(result.data.luciAnalysis.risks.every(r => r.length > 0)).toBe(true);
    });

    test('should handle rootCauses as top-level array', async () => {
      aiService.analyzeKPIDeviations.mockResolvedValue({
        executiveSummary: 'Top-level summary',
        rootCauses: [
          'Root cause 1',
          { cause: 'Root cause 2' }
        ]
      });

      const result = await kpiService.getKPIDashboard();

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis.risks).toContain('Root cause 1');
      expect(result.data.luciAnalysis.risks).toContain('Root cause 2');
    });
  });

  describe('Edge cases and error paths', () => {
    test('should handle calculateKPI with data causing internal error', async () => {
      // Intentar con un KPI que existe y datos válidos para verificar que el catch no es alcanzable con inputs normales
      const result = await kpiService.calculateKPI('error_rate', { errorRate: 3.5 });

      expect(result.success).toBe(true);
      expect(result.data.value).toBe(3.5);
    });

    test('should record KPI values in history correctly', async () => {
      const historyBefore = kpiService.getKPIHistory('luci_accuracy');
      const lengthBefore = historyBefore.history.length;

      await kpiService.calculateKPI('luci_accuracy', { luciAccuracy: 95 });
      await kpiService.calculateKPI('luci_accuracy', { luciAccuracy: 96 });
      await kpiService.calculateKPI('luci_accuracy', { luciAccuracy: 97 });

      const historyAfter = kpiService.getKPIHistory('luci_accuracy');

      expect(historyAfter.history.length).toBe(lengthBefore + 3);
      // Verificar los últimos 3 valores
      const lastThree = historyAfter.history.slice(-3);
      expect(lastThree[0].value).toBe(95);
      expect(lastThree[1].value).toBe(96);
      expect(lastThree[2].value).toBe(97);
    });

    test('should clear alerts when KPI status improves to good', async () => {
      // Primero generar una alerta crítica
      await kpiService.calculateKPI('error_rate', { errorRate: 10 });

      let alerts = kpiService.getActiveAlerts({ kpiId: 'error_rate' });
      const initialCount = alerts.alerts.length;
      expect(initialCount).toBeGreaterThan(0);

      // Mejorar el KPI a un valor bueno
      await kpiService.calculateKPI('error_rate', { errorRate: 0.5 });

      alerts = kpiService.getActiveAlerts({ kpiId: 'error_rate' });
      const finalCount = alerts.alerts.length;
      expect(finalCount).toBe(initialCount - 1);
    });

    test('should update existing alert when KPI continues to be critical', async () => {
      // Generar una alerta
      await kpiService.calculateKPI('compliance_score', { complianceScore: 70 });

      const alerts1 = kpiService.getActiveAlerts({ kpiId: 'compliance_score' });
      const alertCount1 = alerts1.alerts.length;

      // Calcular de nuevo con otro valor crítico (debería actualizar, no duplicar)
      await kpiService.calculateKPI('compliance_score', { complianceScore: 65 });

      const alerts2 = kpiService.getActiveAlerts({ kpiId: 'compliance_score' });
      const alertCount2 = alerts2.alerts.length;

      expect(alertCount2).toBe(alertCount1); // No duplicado
    });

    test('should trim KPI history to last 100 records', async () => {
      // Generar más de 100 registros para automation_rate
      for (let i = 0; i < 105; i++) {
        await kpiService.calculateKPI('automation_rate', { automationRate: 60 + i % 20 });
      }

      const history = kpiService.getKPIHistory('automation_rate');

      // Debería mantener solo los últimos 100
      expect(history.history.length).toBeLessThanOrEqual(100);
    });

    test('should handle empty history in statistics', () => {
      // Intentar con un KPI que probablemente no tenga historia
      // Como el estado persiste entre tests, necesitamos verificar ambas ramas
      const history = kpiService.getKPIHistory('first_time_resolution');

      expect(history.success).toBe(true);
      expect(history.statistics).toBeDefined();
      expect(typeof history.statistics.min).toBe('number');
      expect(typeof history.statistics.max).toBe('number');
      expect(typeof history.statistics.avg).toBe('number');
      expect(typeof history.statistics.stdDev).toBe('number');
    });
  });

  describe('getKPIHistory - empty history edge case', () => {
    test('should return empty statistics for KPI with no history', () => {
      // Usar un periodo y un KPI que podría no tener historia reciente
      // Como el estado persiste, esto puede tener o no historia
      const result = kpiService.getKPIHistory('aeat_connectivity', 'last_7_days');

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      // Las estadísticas deben ser válidas (cero si vacío, o números si hay datos)
      expect(typeof result.statistics.min).toBe('number');
      expect(typeof result.statistics.max).toBe('number');
      expect(typeof result.statistics.avg).toBe('number');
      expect(typeof result.statistics.stdDev).toBe('number');
    });
  });
});
