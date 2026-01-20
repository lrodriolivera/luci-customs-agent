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
