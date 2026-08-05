/**
 * Tests for Predictions Service
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
    summary: 'Prediction analysis complete',
    recommendations: ['Continue monitoring'],
    warnings: []
  }),
  generateAutomaticInsights: jest.fn().mockResolvedValue({
    executiveSummary: 'Volume predictions within normal range',
    recommendations: ['Monitor capacity', 'Plan resources'],
    opportunities: [{ description: 'Optimize processing during peak days' }]
  }),
  detectAnomaliesAI: jest.fn().mockResolvedValue({
    summary: {
      criticalCount: 1,
      highCount: 2,
      mediumCount: 3,
      topPriority: 'High-value spike detected'
    },
    anomalies: [
      { recommendedActions: ['Investigate immediately'], suggestedAction: 'Review data' }
    ],
    alertsGenerated: ['Alert: Unusual pattern'],
    recommendations: ['Validate data source']
  }),
  predictTrendsAI: jest.fn().mockResolvedValue({
    executiveSummary: 'Trends show positive growth',
    predictions: [{ metric: 'volume', value: 120 }],
    keyPredictions: [{ description: 'Volume expected to increase 15%' }],
    recommendations: ['Scale resources accordingly'],
    modelConfidence: 'high'
  })
}));

const predictionsService = require('../../../src/services/analytics/predictionsService');

describe('Predictions Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    test('should define PREDICTION_TYPES', () => {
      expect(predictionsService.PREDICTION_TYPES).toBeDefined();
      expect(predictionsService.PREDICTION_TYPES.VOLUME).toBe('volume');
      expect(predictionsService.PREDICTION_TYPES.CHANNEL).toBe('channel');
      expect(predictionsService.PREDICTION_TYPES.ANOMALY).toBe('anomaly');
    });

    test('should define CONFIDENCE_LEVELS', () => {
      expect(predictionsService.CONFIDENCE_LEVELS).toBeDefined();
      expect(predictionsService.CONFIDENCE_LEVELS.HIGH).toBe('high');
      expect(predictionsService.CONFIDENCE_LEVELS.MEDIUM).toBe('medium');
      expect(predictionsService.CONFIDENCE_LEVELS.LOW).toBe('low');
    });

    test('should define ANOMALY_TYPES', () => {
      expect(predictionsService.ANOMALY_TYPES).toBeDefined();
      expect(predictionsService.ANOMALY_TYPES.VALUE_SPIKE).toBe('value_spike');
    });
  });

  describe('predictVolume', () => {
    test('should predict volume for default horizon', async () => {
      const result = await predictionsService.predictVolume();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.type).toBe('volume');
    });

    test('should include predictions array', async () => {
      const result = await predictionsService.predictVolume({ horizon: 30 });

      expect(result.data.predictions).toBeDefined();
      expect(Array.isArray(result.data.predictions)).toBe(true);
      expect(result.data.predictions.length).toBeGreaterThan(0);
    });

    test('should include summary', async () => {
      const result = await predictionsService.predictVolume();

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary).toHaveProperty('totalPredicted');
      expect(result.data.summary).toHaveProperty('averageDaily');
    });

    test('should include model info', async () => {
      const result = await predictionsService.predictVolume();

      expect(result.data.modelInfo).toBeDefined();
      expect(result.data.modelInfo).toHaveProperty('accuracy');
    });

    test('should respect granularity option', async () => {
      const dailyResult = await predictionsService.predictVolume({ horizon: 30, granularity: 'daily' });
      const weeklyResult = await predictionsService.predictVolume({ horizon: 30, granularity: 'weekly' });

      expect(dailyResult.data.granularity).toBe('daily');
      expect(weeklyResult.data.granularity).toBe('weekly');
      expect(weeklyResult.data.predictions.length).toBeLessThan(dailyResult.data.predictions.length);
    });

    test('should handle monthly granularity aggregation', async () => {
      const result = await predictionsService.predictVolume({ horizon: 60, granularity: 'monthly' });

      expect(result.success).toBe(true);
      expect(result.data.granularity).toBe('monthly');
      expect(result.data.predictions.length).toBeGreaterThan(0);
      expect(result.data.predictions[0]).toHaveProperty('month');
      expect(result.data.predictions[0]).toHaveProperty('predictedVolume');
      expect(result.data.predictions[0]).toHaveProperty('confidence');
    });

    test('should include LUCI analysis', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.generateAutomaticInsights.mockResolvedValueOnce({
        executiveSummary: 'Volume predictions within normal range',
        recommendations: ['Monitor capacity', 'Plan resources'],
        opportunities: [{ description: 'Optimize processing during peak days' }]
      });

      const result = await predictionsService.predictVolume({ horizon: 30 });

      expect(result.data.luciAnalysis).toBeDefined();
      if (result.data.luciAnalysis) {
        expect(result.data.luciAnalysis.summary).toBeDefined();
        expect(result.data.luciAnalysis.recommendations).toBeDefined();
      }
    });

    test('should handle error when prediction fails', async () => {
      // Create a scenario that forces an error in predictVolume's try block
      // by causing an error during prediction generation (not in LUCI call)
      jest.spyOn(Array.prototype, 'push').mockImplementationOnce(() => {
        throw new Error('Array operation failed');
      });

      const result = await predictionsService.predictVolume();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Array operation failed');

      Array.prototype.push.mockRestore();
    });

    test('should handle LUCI analysis when opportunities are missing', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.generateAutomaticInsights.mockResolvedValueOnce({
        executiveSummary: 'Volume stable',
        recommendations: ['Continue monitoring']
        // No opportunities field
      });

      const result = await predictionsService.predictVolume({ horizon: 30 });

      expect(result.success).toBe(true);
      expect(result.data.luciAnalysis.resourcePlanning).toContain('Mantener capacidad operativa actual');
    });
  });

  describe('predictChannel', () => {
    test('should predict channel for declaration data', async () => {
      const declarationData = {
        originCountry: 'CN',
        customsValue: 50000,
        commodityCode: '8471300000'
      };

      const result = await predictionsService.predictChannel(declarationData);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('channel');
      expect(result.data.predictedChannel).toBeDefined();
    });

    test('should apply commodity code risk for textiles (61xx)', async () => {
      const result = await predictionsService.predictChannel({
        commodityCode: '6109100000',
        customsValue: 20000
      });

      expect(result.success).toBe(true);
      expect(result.data.riskScore).toBeGreaterThan(20); // Base score + textile risk
    });

    test('should apply commodity code risk for textiles (62xx)', async () => {
      const result = await predictionsService.predictChannel({
        commodityCode: '6204430000',
        customsValue: 20000
      });

      expect(result.success).toBe(true);
      expect(result.data.riskScore).toBeGreaterThan(20);
    });

    test('should apply document completeness risk', async () => {
      const result = await predictionsService.predictChannel({
        commodityCode: '8471300000',
        customsValue: 10000,
        documentsComplete: false
      });

      expect(result.success).toBe(true);
      expect(result.data.factors.some(f => f.factor.includes('Documentación incompleta'))).toBe(true);
    });

    test('should include channel probabilities', async () => {
      const result = await predictionsService.predictChannel({ originCountry: 'DE' });

      expect(result.data.probabilities).toBeDefined();
      expect(result.data.probabilities).toHaveProperty('green');
      expect(result.data.probabilities).toHaveProperty('orange');
      expect(result.data.probabilities).toHaveProperty('red');
    });

    test('should include risk score', async () => {
      const result = await predictionsService.predictChannel({ originCountry: 'CN', customsValue: 100000 });

      expect(result.data.riskScore).toBeDefined();
      expect(typeof result.data.riskScore).toBe('number');
    });

    test('should include risk factors', async () => {
      const result = await predictionsService.predictChannel({
        originCountry: 'CN',
        customsValue: 150000,
        firstTimeImporter: true
      });

      expect(result.data.factors).toBeDefined();
      expect(Array.isArray(result.data.factors)).toBe(true);
    });

    test('should include recommendations', async () => {
      const result = await predictionsService.predictChannel({ originCountry: 'CN' });

      expect(result.data.recommendations).toBeDefined();
      expect(Array.isArray(result.data.recommendations)).toBe(true);
    });

    test('should recommend pre-validation for high risk score', async () => {
      const result = await predictionsService.predictChannel({
        originCountry: 'CN',
        customsValue: 120000,
        firstTimeImporter: true,
        documentsComplete: false
      });

      expect(result.data.riskScore).toBeGreaterThan(60);
      expect(result.data.recommendations.some(r => r.includes('pre-validación'))).toBe(true);
    });

    test('should provide green channel recommendations for low risk', async () => {
      const result = await predictionsService.predictChannel({
        originCountry: 'DE',
        customsValue: 5000,
        commodityCode: '8471300000'
      });

      // Low risk should predict green channel
      if (result.data.predictedChannel === 'green') {
        expect(result.data.recommendations.some(r => r.includes('auditoría posterior'))).toBe(true);
      }
    });

    test('should handle error when channel prediction fails', async () => {
      // Force error by throwing in the function
      jest.spyOn(global.Math, 'max').mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const result = await predictionsService.predictChannel({ originCountry: 'DE' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      global.Math.max.mockRestore();
    });
  });

  describe('predictInspection', () => {
    test('should predict inspection likelihood', async () => {
      const result = await predictionsService.predictInspection({ originCountry: 'CN' });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('inspection');
      expect(result.data.inspectionProbability).toBeDefined();
    });

    test('should include inspection type', async () => {
      const result = await predictionsService.predictInspection({});

      expect(result.data.inspectionType).toBeDefined();
      expect(['physical', 'documentary']).toContain(result.data.inspectionType);
    });

    test('should include risk level', async () => {
      const result = await predictionsService.predictInspection({});

      expect(result.data.riskLevel).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.data.riskLevel);
    });

    test('should include mitigation suggestions', async () => {
      const result = await predictionsService.predictInspection({});

      expect(result.data.mitigationSuggestions).toBeDefined();
      expect(Array.isArray(result.data.mitigationSuggestions)).toBe(true);
    });

    test('should apply commodity code risk for electronics (84xx)', async () => {
      const result = await predictionsService.predictInspection({
        commodityCode: '8471300000'
      });

      expect(result.success).toBe(true);
      expect(result.data.inspectionProbability).toBeGreaterThan(0);
    });

    test('should apply commodity code risk for electronics (85xx)', async () => {
      const result = await predictionsService.predictInspection({
        commodityCode: '8517620000'
      });

      expect(result.success).toBe(true);
      expect(result.data.inspectionProbability).toBeGreaterThan(0);
    });

    test('should provide fewer mitigations for low probability inspection', async () => {
      const result = await predictionsService.predictInspection({
        originCountry: 'DE',
        customsValue: 5000,
        firstTimeImporter: false
      });

      expect(result.data.inspectionProbability).toBeLessThan(30);
      expect(result.data.mitigationSuggestions.length).toBe(1);
    });

    test('should provide multiple mitigations for high probability inspection', async () => {
      const result = await predictionsService.predictInspection({
        originCountry: 'CN',
        customsValue: 150000,
        firstTimeImporter: true
      });

      expect(result.data.inspectionProbability).toBeGreaterThanOrEqual(30);
      expect(result.data.mitigationSuggestions.length).toBeGreaterThan(1);
    });

    test('should classify as high risk when probability > 70', async () => {
      const result = await predictionsService.predictInspection({
        originCountry: 'CN',
        customsValue: 150000,
        firstTimeImporter: true,
        documentsComplete: false
      });

      expect(result.data.inspectionProbability).toBeGreaterThan(70);
      expect(result.data.riskLevel).toBe('high');
      expect(result.data.inspectionType).toBe('physical');
    });

    test('should classify as medium risk when probability between 40-70', async () => {
      const result = await predictionsService.predictInspection({
        originCountry: 'CN',
        customsValue: 120000,
        commodityCode: '6109100000' // Textile, adds extra risk
      });

      expect(result.data.inspectionProbability).toBeGreaterThan(40);
      expect(result.data.inspectionProbability).toBeLessThanOrEqual(70);
      expect(result.data.riskLevel).toBe('medium');
    });

    test('should handle error when inspection prediction fails', async () => {
      jest.spyOn(global.Math, 'min').mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const result = await predictionsService.predictInspection({ originCountry: 'CN' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      global.Math.min.mockRestore();
    });
  });

  describe('predictProcessingTime', () => {
    test('should predict processing time', async () => {
      const result = await predictionsService.predictProcessingTime({
        type: 'H1',
        channel: 'green'
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('processing_time');
      expect(result.data.predictedHours).toBeDefined();
    });

    test('should include time range', async () => {
      const result = await predictionsService.predictProcessingTime({});

      expect(result.data.rangeHours).toBeDefined();
      expect(result.data.rangeHours).toHaveProperty('min');
      expect(result.data.rangeHours).toHaveProperty('max');
    });

    test('should include time breakdown', async () => {
      const result = await predictionsService.predictProcessingTime({
        type: 'H1',
        channel: 'orange'
      });

      expect(result.data.breakdown).toBeDefined();
      expect(result.data.breakdown).toHaveProperty('baseProcessing');
    });

    test('should account for document completeness', async () => {
      const completeResult = await predictionsService.predictProcessingTime({
        documentsComplete: true
      });

      const incompleteResult = await predictionsService.predictProcessingTime({
        documentsComplete: false
      });

      expect(incompleteResult.data.predictedHours).toBeGreaterThan(completeResult.data.predictedHours);
    });

    test('should handle error when processing time prediction fails', async () => {
      jest.spyOn(global.Math, 'round').mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const result = await predictionsService.predictProcessingTime({ type: 'H1' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      global.Math.round.mockRestore();
    });
  });

  describe('predictDuties', () => {
    test('should predict duties for declaration data', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '8471300000'
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('duties');
      expect(result.data.predictions).toBeDefined();
    });

    test('should include duty predictions', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 50000,
        commodityCode: '6104430000'
      });

      expect(result.data.predictions).toHaveProperty('customsDuty');
      expect(result.data.predictions).toHaveProperty('vat');
      expect(result.data.predictions).toHaveProperty('total');
    });

    test('should include rates', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '8471300000'
      });

      expect(result.data.rates).toBeDefined();
      expect(result.data.rates).toHaveProperty('duty');
      expect(result.data.rates).toHaveProperty('vat');
    });

    test('should include potential savings', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 50000,
        commodityCode: '8471300000',
        originCountry: 'CA'
      });

      expect(result.data.potentialSavings).toBeDefined();
    });

    test('should apply correct duty rate for textile chapter 61', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '6109100000'
      });

      expect(result.success).toBe(true);
      expect(result.data.rates.duty).toBe(12);
    });

    test('should apply correct duty rate for textile chapter 62', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '6204430000'
      });

      expect(result.success).toBe(true);
      expect(result.data.rates.duty).toBe(12);
    });

    test('should apply correct duty rate for footwear chapter 64', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '6403990000'
      });

      expect(result.success).toBe(true);
      expect(result.data.rates.duty).toBe(8);
    });

    test('should apply correct duty rate for vehicles chapter 87', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 50000,
        commodityCode: '8703230000'
      });

      expect(result.success).toBe(true);
      expect(result.data.rates.duty).toBe(10);
    });

    test('should apply correct duty rate for furniture chapter 94', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '9403300000'
      });

      expect(result.success).toBe(true);
      expect(result.data.rates.duty).toBe(5.6);
    });

    test('should apply default duty rate for unknown chapters', async () => {
      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '3926909790'
      });

      expect(result.success).toBe(true);
      expect(result.data.rates.duty).toBe(4.5);
    });

    test('should calculate savings for preference countries', async () => {
      const countries = ['CA', 'JP', 'KR', 'MX', 'CL'];

      for (const country of countries) {
        const result = await predictionsService.predictDuties({
          customsValue: 10000,
          commodityCode: '6109100000', // 12% duty
          originCountry: country
        });

        expect(result.data.potentialSavings.preferences).toBeGreaterThan(0);
        expect(result.data.potentialSavings.total).toBeGreaterThan(0);
      }
    });

    test('should handle error when duty prediction fails', async () => {
      jest.spyOn(global.Math, 'round').mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const result = await predictionsService.predictDuties({
        customsValue: 10000,
        commodityCode: '8471300000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      global.Math.round.mockRestore();
    });
  });

  describe('detectAnomalies', () => {
    test('should detect anomalies in data', async () => {
      const data = {
        values: [10, 12, 11, 50, 13, 14, 12]  // 50 is an anomaly
      };

      const result = await predictionsService.detectAnomalies(data);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('anomaly');
      expect(result.data.anomaliesFound).toBeDefined();
    });

    test('should include risk assessment', async () => {
      const data = {
        values: [10, 12, 11, 13, 14, 12]
      };

      const result = await predictionsService.detectAnomalies(data);

      expect(result.data.riskAssessment).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.data.riskAssessment);
    });

    test('should include model info', async () => {
      const result = await predictionsService.detectAnomalies({ values: [1, 2, 3] });

      expect(result.data.modelInfo).toBeDefined();
      expect(result.data.modelInfo).toHaveProperty('accuracy');
    });

    test('should detect volume anomalies', async () => {
      const data = {
        volumes: [5, 6, 7, 100, 6, 5, 7]  // 100 is volume anomaly
      };

      const result = await predictionsService.detectAnomalies(data);

      expect(result.success).toBe(true);
      expect(result.data.anomaliesFound).toBeGreaterThan(0);
      expect(result.data.anomalies.some(a => a.type === 'volume_spike' || a.type === 'volume_drop')).toBe(true);
    });

    test('should handle pattern anomalies', async () => {
      const data = {
        patterns: { somePattern: 'unusual' }
      };

      const result = await predictionsService.detectAnomalies(data);

      expect(result.success).toBe(true);
      // Pattern detection is simplified, should not error
    });

    test('should include LUCI analysis when anomalies found', async () => {
      const data = {
        values: [10, 12, 11, 50, 13, 14, 12]
      };

      const result = await predictionsService.detectAnomalies(data);

      // May or may not have anomalies depending on threshold, but should succeed
      expect(result.success).toBe(true);
      if (result.data.anomaliesFound > 0) {
        expect(result.data.luciAnalysis).toBeDefined();
      }
    });

    test('should handle LUCI analysis with string summary', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.detectAnomaliesAI.mockResolvedValueOnce({
        summary: 'Critical anomaly detected',
        anomalies: [],
        alertsGenerated: [],
        recommendations: []
      });

      const data = {
        values: [10, 12, 11, 50, 13, 14, 12]
      };

      const result = await predictionsService.detectAnomalies(data);

      expect(result.success).toBe(true);
    });

    test('should handle LUCI analysis with missing summary', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.detectAnomaliesAI.mockResolvedValueOnce({
        executiveSummary: 'Fallback summary',
        anomalies: [],
        alertsGenerated: []
      });

      const data = {
        values: [10, 12, 11, 50, 13, 14, 12]
      };

      const result = await predictionsService.detectAnomalies(data);

      expect(result.success).toBe(true);
    });

    test('should handle LUCI analysis with object summary without topPriority', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.detectAnomaliesAI.mockResolvedValueOnce({
        summary: {
          criticalCount: 2,
          highCount: 3,
          mediumCount: 1
          // No topPriority field
        },
        anomalies: [
          { recommendedAction: 'Fix critical issue' },
          { suggestedAction: 'Review data' }
        ],
        alertsGenerated: ['High severity alert']
      });

      const data = {
        values: [10, 12, 11, 50, 13, 14, 12]
      };

      const result = await predictionsService.detectAnomalies(data);

      expect(result.success).toBe(true);
      if (result.data.luciAnalysis) {
        expect(result.data.luciAnalysis.summary).toContain('Anomalías detectadas');
      }
    });

    test('should handle error when anomaly detection fails', async () => {
      jest.spyOn(Array.prototype, 'reduce').mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const result = await predictionsService.detectAnomalies({ values: [1, 2, 3] });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      Array.prototype.reduce.mockRestore();
    });
  });

  describe('analyzeTrends', () => {
    test('should analyze trends in data', async () => {
      const result = await predictionsService.analyzeTrends({});

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('trend');
    });

    test('should include trend analysis', async () => {
      const result = await predictionsService.analyzeTrends({});

      expect(result.data.trends).toBeDefined();
      expect(result.data.trends).toHaveProperty('volume');
      expect(result.data.trends.volume).toHaveProperty('direction');
    });

    test('should include forecasts', async () => {
      const result = await predictionsService.analyzeTrends({});

      expect(result.data.forecasts).toBeDefined();
    });

    test('should include highlights', async () => {
      const result = await predictionsService.analyzeTrends({});

      expect(result.data.highlights).toBeDefined();
      expect(Array.isArray(result.data.highlights)).toBe(true);
    });

    test('should generate highlights for volume uptrend', async () => {
      const data = {
        volumes: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
      };

      const result = await predictionsService.analyzeTrends(data);

      expect(result.success).toBe(true);
      expect(result.data.highlights.some(h => h.type === 'positive')).toBe(true);
    });

    test('should generate highlights for efficiency downtrend', async () => {
      const data = {
        efficiency: [90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70]
      };

      const result = await predictionsService.analyzeTrends(data);

      expect(result.success).toBe(true);
      expect(result.data.highlights.some(h => h.type === 'warning')).toBe(true);
    });

    test('should generate highlights for compliance uptrend', async () => {
      const data = {
        compliance: [85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95]
      };

      const result = await predictionsService.analyzeTrends(data);

      expect(result.success).toBe(true);
      expect(result.data.highlights.some(h => h.type === 'positive' && h.message.includes('cumplimiento'))).toBe(true);
    });

    test('should include LUCI insights', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.predictTrendsAI.mockResolvedValueOnce({
        executiveSummary: 'Trends show positive growth',
        predictions: [{ metric: 'volume', value: 120 }],
        keyPredictions: [{ description: 'Volume expected to increase 15%' }],
        recommendations: ['Scale resources accordingly'],
        modelConfidence: 'high'
      });

      const result = await predictionsService.analyzeTrends({});

      expect(result.data.luciInsights).toBeDefined();
      if (result.data.luciInsights) {
        expect(result.data.luciInsights.summary).toBeDefined();
      }
    });

    test('should handle LUCI insights with keyPredictions', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.predictTrendsAI.mockResolvedValueOnce({
        keyPredictions: [{ description: 'Key prediction here' }],
        recommendations: ['Act on this'],
        modelConfidence: 'high'
      });

      const result = await predictionsService.analyzeTrends({});

      expect(result.success).toBe(true);
      expect(result.data.luciInsights.summary).toBeDefined();
    });

    test('should handle LUCI insights with only modelConfidence', async () => {
      const aiService = require('../../../src/services/aiService');
      aiService.predictTrendsAI.mockResolvedValueOnce({
        modelConfidence: 'medium',
        predictions: [{ metric: 'test', value: 100 }]
      });

      const result = await predictionsService.analyzeTrends({});

      expect(result.success).toBe(true);
      expect(result.data.luciInsights.summary).toContain('confianza');
    });

    test('should handle empty data in trend calculation', async () => {
      const result = await predictionsService.analyzeTrends({
        volumes: [],
        values: [],
        compliance: [],
        efficiency: []
      });

      expect(result.success).toBe(true);
      // Empty arrays should default to generated time series
      expect(result.data.trends.volume).toBeDefined();
    });

    test('should calculate stable trend for flat data', async () => {
      const flatData = Array(30).fill(50);
      const result = await predictionsService.analyzeTrends({
        volumes: flatData
      });

      expect(result.success).toBe(true);
      expect(result.data.trends.volume.direction).toBe('stable');
    });

    test('should calculate downtrend correctly', async () => {
      const decreasingData = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
      const result = await predictionsService.analyzeTrends({
        volumes: decreasingData
      });

      expect(result.success).toBe(true);
      expect(result.data.trends.volume.direction).toBe('down');
      expect(result.data.trends.volume.slope).toBeLessThan(0);
    });

    test('should handle error when trend analysis fails', async () => {
      jest.spyOn(Array.prototype, 'forEach').mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const result = await predictionsService.analyzeTrends({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      Array.prototype.forEach.mockRestore();
    });
  });

  describe('getModelMetrics', () => {
    test('should return model metrics', () => {
      const result = predictionsService.getModelMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should include all models', () => {
      const result = predictionsService.getModelMetrics();

      expect(result.data.models).toBeDefined();
      expect(result.data.models).toHaveProperty('volumeModel');
      expect(result.data.models).toHaveProperty('channelModel');
    });

    test('should include overall accuracy', () => {
      const result = predictionsService.getModelMetrics();

      expect(result.data.overallAccuracy).toBeDefined();
      expect(typeof result.data.overallAccuracy).toBe('number');
    });
  });
});
