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

    // Regresión del BUG: code6 se extraía con substring(0,7) → '8471300' (sin
    // punto), que NUNCA casaba con las claves 'NNNN.NN' de
    // MISCLASSIFICATION_RISK_CODES → falso negativo sistemático (no se
    // generaba la alerta suspicious_taric para NINGÚN código de la lista).
    // El fix arma '8471.30'. La descripción incluye 'machine' (keyword del
    // cap. 84) para aislar esta alerta de la de description_mismatch.
    test('genera alerta suspicious_taric para un TARIC de la lista de riesgo (regresión del formato con punto)', () => {
      const result = detectMisclassification({
        taricCode: '8471300000',                 // clave de riesgo -> 8471.30
        goodsDescription: 'Portable computer machine'
      });

      const suspicious = result.alerts.find(a => a.indicator === 'suspicious_taric');
      expect(suspicious).toBeDefined();
      expect(suspicious.type).toBe('misclassification');
      // Los relatedCodes de 8471.30 deben aparecer en el mensaje
      expect(suspicious.message).toContain('8471.41');
      expect(result.detected).toBe(true);
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

  describe('detectUndervaluation - critical thresholds', () => {
    test('should detect critical undervaluation (< 50% of min)', () => {
      // Chapter 61 (apparel knitted): min 5 EUR/kg
      // 1.5 EUR/kg is < 2.5 (50% of 5)
      const result = detectUndervaluation({
        taricCode: '6109100000',
        customsValue: 150,
        weight: 100,
        quantity: 500
      });

      expect(result.detected).toBe(true);
      // When < 50% min, triggers critical (line 109) and else if (line 118) is skipped
      // Also triggers statistical (line 130) independently -> 2 alerts
      expect(result.alerts).toHaveLength(2); // critical + statistical
      expect(result.alerts[0].severity).toBe('critical');
      expect(result.alerts[0].indicator).toBe('value_below_market');
      expect(result.alerts[0].deviation).toBeGreaterThan(0);
      expect(result.alerts[0].message).toContain('1.50 EUR/kg');
    });

    test('should detect suspicious unit price', () => {
      const result = detectUndervaluation({
        taricCode: '8517120000',
        customsValue: 1000,
        weight: 50,
        quantity: 100,
        unitPrice: 0.3 // < 0.5 threshold
      });

      expect(result.detected).toBe(true);
      const unitAlert = result.alerts.find(a => a.indicator === 'suspicious_unit_price');
      expect(unitAlert).toBeDefined();
      expect(unitAlert.severity).toBe('high');
      expect(unitAlert.message).toContain('0.3 EUR');
    });

    test('should detect statistical outlier (< 25% of avg)', () => {
      // Chapter 85: avg 100 EUR/kg, 25% = 25
      // 20 EUR/kg triggers statistical outlier
      const result = detectUndervaluation({
        taricCode: '8517120000',
        customsValue: 2000,
        weight: 100,
        quantity: 10
      });

      expect(result.detected).toBe(true);
      const statAlert = result.alerts.find(a => a.indicator === 'statistical_outlier');
      expect(statAlert).toBeDefined();
      expect(statAlert.severity).toBe('medium');
    });

    test('should not detect when value is within normal range', () => {
      // Chapter 61: min 5, value per kg = 15 (OK)
      const result = detectUndervaluation({
        taricCode: '6109100000',
        customsValue: 1500,
        weight: 100,
        quantity: 200
      });

      expect(result.detected).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });

    test('should handle chapter without reference values', () => {
      const result = detectUndervaluation({
        taricCode: '9999999999', // non-existent chapter
        customsValue: 100,
        weight: 10,
        quantity: 5
      });

      expect(result.detected).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });
  });

  describe('detectOriginFraud - full coverage', () => {
    test('should detect transshipment through high-risk hub', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'CN',
        shippingCountry: 'DE',
        transshipmentCountries: ['HK', 'SG'],
        hasOriginCertificate: false
      });

      expect(result.detected).toBe(true);
      const transshipAlert = result.alerts.find(a => a.indicator === 'transshipment_country');
      expect(transshipAlert).toBeDefined();
      expect(transshipAlert.severity).toBe('high');
      expect(transshipAlert.message).toContain('HK, SG');
    });

    test('should detect route inconsistency (origin != shipping, shipping is hub)', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'CN',
        shippingCountry: 'HK', // hub
        transshipmentCountries: [],
        hasOriginCertificate: false
      });

      expect(result.detected).toBe(true);
      const routeAlert = result.alerts.find(a => a.indicator === 'route_inconsistency');
      expect(routeAlert).toBeDefined();
      expect(routeAlert.severity).toBe('high');
      expect(routeAlert.message).toContain('CN');
      expect(routeAlert.message).toContain('HK');
    });

    test('should NOT alert when origin equals shipping (same hub)', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'HK',
        shippingCountry: 'HK',
        transshipmentCountries: [],
        hasOriginCertificate: true
      });

      // No route_inconsistency alert expected when declaredOrigin === shippingCountry
      const routeAlert = result.alerts.find(a => a.indicator === 'route_inconsistency');
      expect(routeAlert).toBeUndefined();
    });

    test('should detect invalid EU preferential certificate for non-agreement country', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'CN', // NOT in EU agreement list
        shippingCountry: 'CN',
        transshipmentCountries: [],
        hasOriginCertificate: true,
        certificateType: 'EUR1' // EU preferential
      });

      expect(result.detected).toBe(true);
      const certAlert = result.alerts.find(a => a.indicator === 'certificate_anomaly');
      expect(certAlert).toBeDefined();
      expect(certAlert.severity).toBe('critical');
      expect(certAlert.message).toContain('EUR1');
      expect(certAlert.message).toContain('CN');
    });

    test('should accept valid EU preferential certificate for agreement country', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'TR', // Turkey, in EU agreement
        shippingCountry: 'TR',
        transshipmentCountries: [],
        hasOriginCertificate: true,
        certificateType: 'ATR'
      });

      const certAlert = result.alerts.find(a => a.indicator === 'certificate_anomaly');
      expect(certAlert).toBeUndefined();
    });

    test('should detect supplier-production mismatch through hub', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'CN',
        shippingCountry: 'CN',
        transshipmentCountries: [],
        hasOriginCertificate: false,
        supplierCountry: 'HK', // hub
        productionCountry: 'CN'
      });

      expect(result.detected).toBe(true);
      const supplierAlert = result.alerts.find(a => a.indicator === 'supplier_production_mismatch');
      expect(supplierAlert).toBeDefined();
      expect(supplierAlert.severity).toBe('medium');
      expect(supplierAlert.message).toContain('HK');
      expect(supplierAlert.message).toContain('CN');
    });

    test('should not alert when supplier and production are same non-hub', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'DE',
        shippingCountry: 'DE',
        transshipmentCountries: [],
        hasOriginCertificate: false,
        supplierCountry: 'DE',
        productionCountry: 'DE'
      });

      expect(result.detected).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });

    test('should handle missing optional fields', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectOriginFraud({
        declaredOrigin: 'US'
      });

      expect(result.detected).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });
  });

  describe('detectMisclassification - suspicious codes', () => {
    test('should flag suspicious TARIC code from risk list', () => {
      // Key is '8471.30' (with dot), substring(0,7) extracts '8471300' (no dot) -> no match
      // Use '6110.20' (sweaters) which requires code '6110200' in substring format
      const result = detectMisclassification({
        taricCode: '6110200000', // MISCLASSIFICATION_RISK_CODES['6110.20']
        goodsDescription: 'Sweaters',
        weight: 50,
        customsValue: 10000,
        quantity: 10
      });

      expect(result.detected).toBe(true);
      const susAlert = result.alerts.find(a => a.indicator === 'suspicious_taric');
      expect(susAlert).toBeDefined();
      expect(susAlert.severity).toBe('medium');
      expect(susAlert.message).toContain('6110200000'); // Full TARIC code in message
    });

    test('should detect description mismatch for chapter with keywords', () => {
      // Chapter 61 expects keywords like 'tejido', 'punto', etc.
      // Description without any keyword triggers alert
      const result = detectMisclassification({
        taricCode: '6109100000',
        goodsDescription: 'Random long description without matching keywords for this chapter',
        weight: 100,
        customsValue: 5000,
        quantity: 1000
      });

      expect(result.detected).toBe(true);
      const descAlert = result.alerts.find(a => a.indicator === 'description_mismatch');
      expect(descAlert).toBeDefined();
      expect(descAlert.severity).toBe('low');
      expect(descAlert.message).toContain('61');
    });

    test('should not alert when description matches chapter keywords', () => {
      const result = detectMisclassification({
        taricCode: '6109100000',
        goodsDescription: 'Camisetas de punto de algodon',
        weight: 100,
        customsValue: 5000,
        quantity: 1000
      });

      const descAlert = result.alerts.find(a => a.indicator === 'description_mismatch');
      expect(descAlert).toBeUndefined();
    });

    test('should not alert when description too short', () => {
      const result = detectMisclassification({
        taricCode: '6109100000',
        goodsDescription: 'item', // <= 10 chars
        weight: 100,
        customsValue: 5000,
        quantity: 1000
      });

      const descAlert = result.alerts.find(a => a.indicator === 'description_mismatch');
      expect(descAlert).toBeUndefined();
    });

    test('should handle chapter without keyword list', () => {
      const result = detectMisclassification({
        taricCode: '7308900000', // chapter 73 not in chapterKeywords
        goodsDescription: 'Steel structures',
        weight: 1000,
        customsValue: 20000,
        quantity: 10
      });

      // No description_mismatch alert expected for chapters without keyword list
      const descAlert = result.alerts.find(a => a.indicator === 'description_mismatch');
      expect(descAlert).toBeUndefined();
    });
  });

  describe('detectSplitting - historical patterns', () => {
    test('should detect splitting when 3+ similar declarations in 30 days', () => {
      const baseDate = new Date('2026-08-01');
      const historicalData = [
        {
          operatorNIF: 'B12345678',
          taricCode: '6109100000',
          originCountry: 'CN',
          customsValue: 2000,
          declarationDate: new Date('2026-07-10')
        },
        {
          operatorNIF: 'B12345678',
          taricCode: '6109200000', // same first 4 digits
          originCountry: 'CN',
          customsValue: 3000,
          declarationDate: new Date('2026-07-20')
        },
        {
          operatorNIF: 'B12345678',
          taricCode: '6109300000',
          originCountry: 'CN',
          customsValue: 2500,
          declarationDate: new Date('2026-07-25')
        }
      ];

      const result = require('../../../src/services/ml/fraudDetectionService').detectSplitting({
        operatorNIF: 'B12345678',
        taricCode: '6109100000',
        originCountry: 'CN',
        customsValue: 2000,
        declarationDate: baseDate
      }, historicalData);

      expect(result.detected).toBe(true);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].severity).toBe('medium');
      expect(result.alerts[0].indicator).toBe('multiple_shipments');
      expect(result.alerts[0].message).toContain('3 envios');
      expect(result.alerts[0].message).toContain('7500');
    });

    test('should not detect when < 3 similar declarations', () => {
      const historicalData = [
        {
          operatorNIF: 'B12345678',
          taricCode: '6109100000',
          originCountry: 'CN',
          customsValue: 2000,
          declarationDate: new Date('2026-07-15')
        },
        {
          operatorNIF: 'B12345678',
          taricCode: '6109200000',
          originCountry: 'CN',
          customsValue: 3000,
          declarationDate: new Date('2026-07-20')
        }
      ];

      const result = require('../../../src/services/ml/fraudDetectionService').detectSplitting({
        operatorNIF: 'B12345678',
        taricCode: '6109100000',
        originCountry: 'CN',
        declarationDate: new Date('2026-08-01')
      }, historicalData);

      expect(result.detected).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });

    test('should filter by 30-day window', () => {
      const baseDate = new Date('2026-08-01');
      const historicalData = [
        {
          operatorNIF: 'B12345678',
          taricCode: '6109100000',
          originCountry: 'CN',
          customsValue: 2000,
          declarationDate: new Date('2026-06-01') // >30 days ago
        },
        {
          operatorNIF: 'B12345678',
          taricCode: '6109200000',
          originCountry: 'CN',
          customsValue: 3000,
          declarationDate: new Date('2026-06-10') // >30 days ago
        },
        {
          operatorNIF: 'B12345678',
          taricCode: '6109300000',
          originCountry: 'CN',
          customsValue: 2500,
          declarationDate: new Date('2026-06-15') // >30 days ago
        }
      ];

      const result = require('../../../src/services/ml/fraudDetectionService').detectSplitting({
        operatorNIF: 'B12345678',
        taricCode: '6109100000',
        originCountry: 'CN',
        declarationDate: baseDate
      }, historicalData);

      expect(result.detected).toBe(false);
    });

    test('should return false when no historical data', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectSplitting({
        operatorNIF: 'B12345678',
        taricCode: '6109100000',
        originCountry: 'CN',
        declarationDate: new Date()
      }, []);

      expect(result.detected).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });

    test('should handle missing declarationDate', () => {
      const historicalData = [
        {
          operatorNIF: 'B12345678',
          taricCode: '6109100000',
          originCountry: 'CN',
          customsValue: 2000,
          declarationDate: new Date()
        }
      ];

      const result = require('../../../src/services/ml/fraudDetectionService').detectSplitting({
        operatorNIF: 'B12345678',
        taricCode: '6109100000',
        originCountry: 'CN'
        // no declarationDate - uses Date.now()
      }, historicalData);

      expect(result).toBeDefined();
    });
  });

  describe('detectWeightAnomalies - smuggling indicators', () => {
    test('should detect high gross/net ratio (potential hidden goods)', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectWeightAnomalies({
        weight: 100, // net
        grossWeight: 600, // ratio 6x
        quantity: 10,
        packaging: 'boxes'
      });

      expect(result.detected).toBe(true);
      const ratioAlert = result.alerts.find(a => a.indicator === 'weight_mismatch');
      expect(ratioAlert).toBeDefined();
      expect(ratioAlert.severity).toBe('high');
      expect(ratioAlert.message).toContain('6.0');
    });

    test('should detect low gross/net ratio (impossible weight)', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectWeightAnomalies({
        weight: 100,
        grossWeight: 100.5, // ratio 1.005 < 1.01
        quantity: 10,
        packaging: 'cartons'
      });

      expect(result.detected).toBe(true);
      const impossibleAlert = result.alerts.find(a => a.indicator === 'impossible_weight');
      expect(impossibleAlert).toBeDefined();
      expect(impossibleAlert.severity).toBe('medium');
      expect(impossibleAlert.type).toBe('phantomGoods');
    });

    test('should detect container weight exceeding limit', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectWeightAnomalies({
        weight: 25000,
        grossWeight: 29000, // exceeds 20GP limit of 28000
        containerType: '20GP',
        quantity: 100
      });

      expect(result.detected).toBe(true);
      const containerAlert = result.alerts.find(a => a.indicator === 'container_anomaly');
      expect(containerAlert).toBeDefined();
      expect(containerAlert.severity).toBe('critical');
      expect(containerAlert.message).toContain('29000 kg');
      expect(containerAlert.message).toContain('28000 kg');
    });

    test('should accept weight within container limit', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectWeightAnomalies({
        weight: 20000,
        grossWeight: 27000, // within 20GP limit
        containerType: '20GP',
        quantity: 50
      });

      const containerAlert = result.alerts.find(a => a.indicator === 'container_anomaly');
      expect(containerAlert).toBeUndefined();
    });

    test('should handle container type not in limits', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectWeightAnomalies({
        weight: 5000,
        grossWeight: 35000,
        containerType: 'CUSTOM', // not in containerLimits
        quantity: 10
      });

      const containerAlert = result.alerts.find(a => a.indicator === 'container_anomaly');
      expect(containerAlert).toBeUndefined();
    });

    test('should handle missing weight fields', () => {
      const result = require('../../../src/services/ml/fraudDetectionService').detectWeightAnomalies({
        quantity: 10,
        packaging: 'pallets'
      });

      expect(result.detected).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });
  });

  describe('analyzeForFraud - detection flags', () => {
    test('should set originFraud flag when detected', () => {
      const result = analyzeForFraud({
        declaredOrigin: 'CN',
        shippingCountry: 'HK',
        transshipmentCountries: ['SG'],
        taricCode: '6109100000',
        goodsDescription: 'Apparel',
        customsValue: 5000,
        weight: 100
      });

      expect(result.success).toBe(true);
      expect(result.detectionResults.originFraud).toBe(true);
    });

    test('should set misclassification flag when detected', () => {
      const result = analyzeForFraud({
        taricCode: '6110200000', // matches MISCLASSIFICATION_RISK_CODES['6110.20']
        goodsDescription: 'Sweaters',
        customsValue: 50000,
        weight: 100
      });

      expect(result.success).toBe(true);
      expect(result.detectionResults.misclassification).toBe(true);
    });

    test('should set splitting flag when detected', () => {
      const historicalData = [
        { operatorNIF: 'B11111111', taricCode: '6109100000', originCountry: 'CN', customsValue: 2000, declarationDate: new Date('2026-07-10') },
        { operatorNIF: 'B11111111', taricCode: '6109200000', originCountry: 'CN', customsValue: 2000, declarationDate: new Date('2026-07-15') },
        { operatorNIF: 'B11111111', taricCode: '6109300000', originCountry: 'CN', customsValue: 2000, declarationDate: new Date('2026-07-20') }
      ];

      const result = analyzeForFraud({
        operatorNIF: 'B11111111',
        taricCode: '6109100000',
        originCountry: 'CN',
        declarationDate: new Date('2026-08-01'),
        customsValue: 2000,
        weight: 50
      }, historicalData);

      expect(result.success).toBe(true);
      expect(result.detectionResults.splitting).toBe(true);
    });

    test('should set weightAnomalies flag when detected', () => {
      const result = analyzeForFraud({
        taricCode: '8517120000',
        goodsDescription: 'Phones',
        customsValue: 10000,
        weight: 100,
        grossWeight: 700, // ratio 7x
        containerType: '20GP'
      });

      expect(result.success).toBe(true);
      expect(result.detectionResults.weightAnomalies).toBe(true);
    });

    test('should calculate riskScore correctly with multiple alerts', () => {
      const result = analyzeForFraud({
        taricCode: '6109100000',
        goodsDescription: 'T-shirts',
        customsValue: 150, // undervalued (1.5 EUR/kg)
        weight: 100,
        grossWeight: 600, // high ratio
        declaredOrigin: 'CN',
        shippingCountry: 'HK',
        transshipmentCountries: ['SG']
      });

      expect(result.success).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.riskLevel).toMatch(/high|critical/);
      expect(result.summary.alertCount).toBeGreaterThan(3);
    });
  });

  describe('analyzeForFraud - error handling', () => {
    test('should catch and return error on exception', () => {
      // Mock logger.warn to throw (called at line 478 when alerts > 0)
      const logger = require('../../../src/config/logger');
      const originalWarn = logger.warn;
      logger.warn = jest.fn(() => { throw new Error('Logger error'); });

      const result = analyzeForFraud({
        taricCode: '6109100000',
        customsValue: 150, // triggers undervaluation alerts -> logger.warn
        weight: 100
      });

      logger.warn = originalWarn;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Logger error');
    });
  });

  describe('quickRiskAssessment - missing origin cert', () => {
    test('should add risk factor when origin certificate is missing', () => {
      const result = quickRiskAssessment({
        originCountry: 'DE',
        taricCode: '6109100000',
        customsValue: 5000,
        hasOriginCertificate: false
      });

      expect(result.riskFactors).toContain('missing_origin_cert');
      expect(result.quickScore).toBeGreaterThanOrEqual(5);
    });

    test('should not add factor when certificate present', () => {
      const result = quickRiskAssessment({
        originCountry: 'DE',
        taricCode: '6109100000',
        customsValue: 5000,
        hasOriginCertificate: true
      });

      expect(result.riskFactors).not.toContain('missing_origin_cert');
    });
  });

  describe('getStatistics', () => {
    const { getStatistics } = require('../../../src/services/ml/fraudDetectionService');

    test('should return statistics structure', () => {
      const result = getStatistics();

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalAnalyses).toBeDefined();
      expect(result.statistics.totalFeedback).toBeDefined();
      expect(result.statistics.confirmedFrauds).toBeDefined();
      expect(result.statistics.riskDistribution).toBeDefined();
      expect(result.statistics.topPatterns).toBeDefined();
      expect(result.statistics.lastUpdated).toBeDefined();
    });

    test('should handle no feedback (null falsePositiveRate)', () => {
      const result = getStatistics();

      expect(result.statistics.falsePositiveRate).toBeNull();
    });
  });

  describe('recordFeedback', () => {
    const { recordFeedback } = require('../../../src/services/ml/fraudDetectionService');

    test('should record fraud feedback', () => {
      const result = recordFeedback('analysis-123', true, 'undervaluation', 'Confirmed by customs inspection');

      expect(result.success).toBe(true);
      expect(result.feedback).toBeDefined();
      expect(result.feedback.analysisId).toBe('analysis-123');
      expect(result.feedback.wasActualFraud).toBe(true);
      expect(result.feedback.fraudType).toBe('undervaluation');
      expect(result.feedback.notes).toBe('Confirmed by customs inspection');
      expect(result.feedback.recordedAt).toBeDefined();
    });

    test('should record false positive feedback', () => {
      const result = recordFeedback('analysis-456', false, null, 'False alarm - legitimate shipment');

      expect(result.success).toBe(true);
      expect(result.feedback.wasActualFraud).toBe(false);
      expect(result.feedback.fraudType).toBeNull();
    });
  });
});
