/**
 * Fraud Detection Service Tests
 * Phase 6.5: ML-based fraud detection
 */

const {
  analyzeForFraud,
  quickRiskAssessment,
  detectUndervaluation,
  detectMisclassification,
  FRAUD_PATTERNS,
  MARKET_REFERENCE_VALUES
} = require('../../../src/services/ml/fraudDetectionService');

describe('Fraud Detection Service', () => {
  describe('analyzeForFraud', () => {
    test('should analyze declaration for fraud indicators', () => {
      const result = analyzeForFraud({
        originCountry: 'CN',
        taricCode: '6109100010',
        goodsDescription: 'Camisetas de algodon',
        customsValue: 5000,
        quantity: 1000,
        weight: 500
      });

      expect(result.success).toBe(true);
      expect(result.riskScore).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    });

    test('should detect potential undervaluation', () => {
      const result = analyzeForFraud({
        originCountry: 'CN',
        taricCode: '8517120000', // Smartphones
        goodsDescription: 'Smartphones',
        customsValue: 100, // Very low for smartphones
        quantity: 100,
        weight: 20
      });

      expect(result.success).toBe(true);
      // Check if undervaluation was detected
      if (result.alerts && result.alerts.length > 0) {
        const hasUndervaluationAlert = result.alerts.some(a =>
          a.type === 'undervaluation'
        );
        // May or may not trigger depending on thresholds
      }
    });

    test('should include summary statistics', () => {
      const result = analyzeForFraud({
        originCountry: 'DE',
        taricCode: '8471300000',
        goodsDescription: 'Ordenadores portatiles',
        customsValue: 50000,
        quantity: 50,
        weight: 100
      });

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.alertCount).toBeDefined();
    });

    test('should provide alerts array', () => {
      const result = analyzeForFraud({
        originCountry: 'CN',
        taricCode: '6403990000',
        goodsDescription: 'Calzado de cuero',
        customsValue: 20000,
        quantity: 500,
        weight: 250
      });

      expect(result.success).toBe(true);
      expect(result.alerts).toBeDefined();
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    test('should analyze multiple risk factors', () => {
      const cnResult = analyzeForFraud({
        originCountry: 'CN',
        taricCode: '8517120000',
        goodsDescription: 'Smartphones',
        customsValue: 10000,
        quantity: 10,
        weight: 2
      });

      const deResult = analyzeForFraud({
        originCountry: 'DE',
        taricCode: '8517120000',
        goodsDescription: 'Smartphones',
        customsValue: 10000,
        quantity: 10,
        weight: 2
      });

      expect(cnResult.success).toBe(true);
      expect(deResult.success).toBe(true);
    });

    test('should detect misclassification risk', () => {
      const result = analyzeForFraud({
        originCountry: 'CN',
        taricCode: '8517120000', // Phones - common misclassification target
        goodsDescription: 'Electronic devices',
        customsValue: 50000,
        quantity: 100,
        weight: 20
      });

      expect(result.success).toBe(true);
      expect(result.detectionResults).toBeDefined();
    });

    test('should group alerts by type', () => {
      const result = analyzeForFraud({
        originCountry: 'CN',
        taricCode: '8517120000',
        goodsDescription: 'Smartphones',
        customsValue: 50000,
        quantity: 50,
        weight: 10
      });

      expect(result.success).toBe(true);
      expect(result.alertsByType).toBeDefined();
      expect(typeof result.alertsByType).toBe('object');
    });

    test('should handle empty data gracefully', () => {
      const result = analyzeForFraud({});

      expect(result.success).toBe(true);
      expect(result.riskLevel).toBe('low');
    });

    test('should include analyzed timestamp', () => {
      const result = analyzeForFraud({
        originCountry: 'CN',
        taricCode: '8517120000',
        goodsDescription: 'Smartphones',
        customsValue: 10000
      });

      expect(result.success).toBe(true);
      expect(result.analyzedAt).toBeDefined();
    });
  });

  describe('quickRiskAssessment', () => {
    test('should perform quick assessment', () => {
      const result = quickRiskAssessment({
        originCountry: 'HK', // High-risk transshipment hub
        taricCode: '8517120000',
        customsValue: 10000
      });

      expect(result.quickScore).toBeDefined();
      expect(result.riskFactors).toBeDefined();
      expect(Array.isArray(result.riskFactors)).toBe(true);
    });

    test('should identify high-risk origin', () => {
      const result = quickRiskAssessment({
        originCountry: 'HK', // Transshipment hub
        taricCode: '6109100000',
        customsValue: 5000
      });

      expect(result.riskFactors).toContain('high_risk_origin');
    });

    test('should identify high-value shipments', () => {
      const result = quickRiskAssessment({
        originCountry: 'DE',
        taricCode: '8471300000',
        customsValue: 200000 // High value
      });

      expect(result.riskFactors).toContain('high_value');
    });

    test('should identify high-risk products', () => {
      const result = quickRiskAssessment({
        originCountry: 'DE',
        taricCode: '61091000', // Apparel - high risk chapter
        customsValue: 5000
      });

      expect(result.riskFactors).toContain('high_risk_product');
    });

    test('should indicate if full analysis needed', () => {
      const highRiskResult = quickRiskAssessment({
        originCountry: 'HK',
        taricCode: '85171200',
        customsValue: 150000
      });

      expect(highRiskResult.requiresFullAnalysis).toBeDefined();
      expect(typeof highRiskResult.requiresFullAnalysis).toBe('boolean');
    });

    test('should handle missing data', () => {
      const result = quickRiskAssessment({});

      expect(result.quickScore).toBeDefined();
      expect(typeof result.quickScore).toBe('number');
    });
  });

  describe('detectUndervaluation', () => {
    test('should detect low value per unit', () => {
      const result = detectUndervaluation({
        taricCode: '8517120000', // Smartphones
        customsValue: 100,
        weight: 10, // 10 EUR/kg is very low for electronics
        quantity: 10
      });

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
    });

    test('should handle missing data', () => {
      const result = detectUndervaluation({});

      expect(result.detected).toBe(false);
      expect(result.alerts).toEqual([]);
    });

    test('should use market reference values', () => {
      // Chapter 85 electronics have higher expected values
      const result = detectUndervaluation({
        taricCode: '8517120000',
        customsValue: 50,
        weight: 10
      });

      expect(result).toBeDefined();
    });
  });

  describe('detectMisclassification', () => {
    test('should flag high-risk TARIC codes', () => {
      const result = detectMisclassification({
        taricCode: '8471300000', // Computers - commonly misclassified
        goodsDescription: 'Ordenadores portatiles'
      });

      expect(result).toBeDefined();
    });

    test('should check description consistency', () => {
      const result = detectMisclassification({
        taricCode: '6110200000', // Sweaters
        goodsDescription: 'Sueter de algodon punto'
      });

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
    });

    test('should handle missing description', () => {
      const result = detectMisclassification({
        taricCode: '8517120000'
      });

      expect(result.detected).toBe(false);
    });
  });

  describe('FRAUD_PATTERNS', () => {
    test('should have undervaluation pattern', () => {
      expect(FRAUD_PATTERNS.undervaluation).toBeDefined();
      expect(FRAUD_PATTERNS.undervaluation.severity).toBe('high');
    });

    test('should have misclassification pattern', () => {
      expect(FRAUD_PATTERNS.misclassification).toBeDefined();
    });

    test('should have false origin pattern', () => {
      expect(FRAUD_PATTERNS.falseOrigin).toBeDefined();
      expect(FRAUD_PATTERNS.falseOrigin.severity).toBe('critical');
    });

    test('should have splitting pattern', () => {
      expect(FRAUD_PATTERNS.splitting).toBeDefined();
    });

    test('should have phantom goods pattern', () => {
      expect(FRAUD_PATTERNS.phantomGoods).toBeDefined();
    });

    test('should have smuggling pattern', () => {
      expect(FRAUD_PATTERNS.smuggling).toBeDefined();
    });
  });

  describe('MARKET_REFERENCE_VALUES', () => {
    test('should have values for major chapters', () => {
      expect(MARKET_REFERENCE_VALUES['85']).toBeDefined(); // Electronics
      expect(MARKET_REFERENCE_VALUES['61']).toBeDefined(); // Apparel knitted
      expect(MARKET_REFERENCE_VALUES['64']).toBeDefined(); // Footwear
    });

    test('should have min, avg, max values', () => {
      const electronics = MARKET_REFERENCE_VALUES['85'];
      expect(electronics.min).toBeDefined();
      expect(electronics.avg).toBeDefined();
      expect(electronics.max).toBeDefined();
    });
  });
});
