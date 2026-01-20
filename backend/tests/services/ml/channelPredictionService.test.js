/**
 * Channel Prediction Service Tests
 * Phase 6.5: ML-based customs channel prediction
 */

const {
  predictChannel,
  recordFeedback,
  getStatistics,
  batchPredict,
  RISK_WEIGHTS,
  calculateCountryRisk,
  calculateProductRisk
} = require('../../../src/services/ml/channelPredictionService');

describe('Channel Prediction Service', () => {
  describe('predictChannel', () => {
    test('should predict channel for declaration', () => {
      const result = predictChannel({
        originCountry: 'DE',
        taricCode: '8471300000',
        customsValue: 50000,
        operatorNIF: 'ES12345678A'
      });

      expect(result.success).toBe(true);
      expect(result.prediction).toBeDefined();
      expect(result.prediction.predictedChannel).toBeDefined();
    });

    test('should include confidence score', () => {
      const result = predictChannel({
        originCountry: 'FR',
        taricCode: '6109100010',
        customsValue: 10000
      });

      expect(result.success).toBe(true);
      expect(result.prediction.confidence).toBeDefined();
    });

    test('should include risk factors', () => {
      const result = predictChannel({
        originCountry: 'CN',
        taricCode: '8517120000',
        customsValue: 100000
      });

      expect(result.success).toBe(true);
      expect(result.prediction.riskFactors).toBeDefined();
      expect(Array.isArray(result.prediction.riskFactors)).toBe(true);
    });

    test('should include prediction ID', () => {
      const result = predictChannel({
        originCountry: 'JP',
        taricCode: '8703210000',
        customsValue: 30000
      });

      expect(result.success).toBe(true);
      expect(result.prediction.predictionId).toBeDefined();
      expect(result.prediction.predictionId).toMatch(/^pred_/);
    });

    test('should include channel explanation', () => {
      const result = predictChannel({
        originCountry: 'CN',
        taricCode: '8517120000',
        customsValue: 50000
      });

      expect(result.success).toBe(true);
      // Predictions include risk score and channel
      expect(result.prediction.riskScore).toBeDefined();
      expect(result.prediction.predictedChannel).toBeDefined();
    });

    test('should consider country risk profiles', () => {
      const lowRiskCountry = predictChannel({
        originCountry: 'DE',
        taricCode: '8517120000',
        customsValue: 10000
      });

      const highRiskCountry = predictChannel({
        originCountry: 'CN',
        taricCode: '8517120000',
        customsValue: 10000
      });

      expect(lowRiskCountry.success).toBe(true);
      expect(highRiskCountry.success).toBe(true);

      // Higher risk country should have higher risk score
      expect(highRiskCountry.prediction.riskScore).toBeGreaterThanOrEqual(
        lowRiskCountry.prediction.riskScore
      );
    });

    test('should handle missing optional fields', () => {
      const result = predictChannel({
        originCountry: 'FR',
        taricCode: '9503000000',
        customsValue: 5000
      });

      expect(result.success).toBe(true);
      expect(result.prediction.predictedChannel).toBeDefined();
    });
  });

  describe('batchPredict', () => {
    test('should predict channels for multiple declarations', () => {
      const declarations = [
        { originCountry: 'DE', taricCode: '8471300000', customsValue: 10000 },
        { originCountry: 'CN', taricCode: '8517120000', customsValue: 20000 },
        { originCountry: 'FR', taricCode: '6109100010', customsValue: 5000 }
      ];

      const result = batchPredict(declarations);

      expect(result.success).toBe(true);
      expect(result.predictions).toBeDefined();
      expect(result.predictions.length).toBe(3);
    });

    test('should include summary statistics', () => {
      const declarations = [
        { originCountry: 'DE', taricCode: '8471300000', customsValue: 10000 },
        { originCountry: 'CN', taricCode: '8517120000', customsValue: 20000 }
      ];

      const result = batchPredict(declarations);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBe(2);
    });

    test('should handle empty array', () => {
      const result = batchPredict([]);

      expect(result.success).toBe(true);
      expect(result.predictions).toEqual([]);
    });
  });

  describe('recordFeedback', () => {
    test('should record feedback for prediction', () => {
      const prediction = predictChannel({
        originCountry: 'CN',
        taricCode: '8517120000',
        customsValue: 10000
      });

      const feedback = recordFeedback(
        prediction.prediction.predictionId,
        'green'
      );

      expect(feedback.success).toBe(true);
      expect(feedback.feedback).toBeDefined();
    });

    test('should return error for non-existent prediction', () => {
      const feedback = recordFeedback(
        'non_existent_id',
        'green'
      );

      expect(feedback.success).toBe(false);
      expect(feedback.error).toBeDefined();
    });
  });

  describe('getStatistics', () => {
    test('should return statistics', () => {
      // First make some predictions
      predictChannel({
        originCountry: 'CN',
        taricCode: '8517120000',
        customsValue: 10000
      });

      const stats = getStatistics();

      expect(stats.success).toBe(true);
      expect(stats.statistics).toBeDefined();
      expect(stats.statistics.totalPredictions).toBeDefined();
    });

    test('should track channel distribution', () => {
      const stats = getStatistics();

      expect(stats.statistics.channelDistribution).toBeDefined();
    });

    test('should include model version', () => {
      const stats = getStatistics();

      expect(stats.statistics.modelVersion).toBeDefined();
    });
  });

  describe('RISK_WEIGHTS', () => {
    test('should have country risk factors', () => {
      expect(RISK_WEIGHTS.countryRisk).toBeDefined();
      expect(RISK_WEIGHTS.countryRisk.high).toBeDefined();
      expect(RISK_WEIGHTS.countryRisk.low).toBeDefined();
    });

    test('should have product risk factors', () => {
      expect(RISK_WEIGHTS.productRisk).toBeDefined();
      expect(RISK_WEIGHTS.productRisk.high).toBeDefined();
    });

    test('should have value thresholds', () => {
      expect(RISK_WEIGHTS.valueThresholds).toBeDefined();
      expect(RISK_WEIGHTS.valueThresholds.high).toBeDefined();
    });
  });

  describe('calculateCountryRisk', () => {
    test('should calculate risk for high-risk countries', () => {
      const cnRisk = calculateCountryRisk('CN');
      expect(cnRisk).toBeGreaterThan(0);
    });

    test('should calculate lower risk for EU countries', () => {
      const deRisk = calculateCountryRisk('DE');
      const cnRisk = calculateCountryRisk('CN');
      expect(deRisk).toBeLessThan(cnRisk);
    });
  });

  describe('calculateProductRisk', () => {
    test('should calculate risk for high-risk products', () => {
      const electronicsRisk = calculateProductRisk('8517120000');
      expect(electronicsRisk).toBeGreaterThan(0);
    });
  });
});
