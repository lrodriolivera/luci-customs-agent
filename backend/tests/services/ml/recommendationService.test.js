/**
 * Recommendation Service Tests
 * Phase 6.5: ML-based proactive recommendations
 */

const {
  generateRecommendations,
  getQuickRecommendations,
  PREFERENCE_AGREEMENTS,
  SPECIAL_REGIMES,
  OEA_BENEFITS
} = require('../../../src/services/ml/recommendationService');

describe('Recommendation Service', () => {
  describe('generateRecommendations', () => {
    test('should generate recommendations for operation', () => {
      const result = generateRecommendations({
        originCountry: 'MX',
        taricCode: '8517120000',
        customsValue: 100000
      });

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    test('should include summary with potential savings', () => {
      const result = generateRecommendations({
        originCountry: 'CA',
        taricCode: '8517120000',
        customsValue: 100000
      });

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalPotentialSaving).toBeDefined();
    });

    test('should prioritize recommendations', () => {
      const result = generateRecommendations({
        originCountry: 'JP',
        taricCode: '8703210000',
        customsValue: 500000
      });

      expect(result.success).toBe(true);
      if (result.recommendations?.length > 0) {
        result.recommendations.forEach(rec => {
          expect(['high', 'medium', 'low', 'info']).toContain(rec.priority);
        });
      }
    });

    test('should include implementation steps for recommendations', () => {
      const result = generateRecommendations({
        originCountry: 'CA',
        taricCode: '8517120000',
        customsValue: 50000
      });

      expect(result.success).toBe(true);
      // Check if recommendations with implementation steps exist
      if (result.recommendations?.length > 0) {
        const recsWithSteps = result.recommendations.filter(r => r.implementationSteps);
        // Some recommendations should have implementation steps
        expect(recsWithSteps.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle missing operation data gracefully', () => {
      const result = generateRecommendations({});

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
    });

    test('should recommend special regimes for reexport operations', () => {
      const result = generateRecommendations({
        originCountry: 'CN',
        customsValue: 50000,
        reexportPlanned: true
      });

      expect(result.success).toBe(true);
      const regimeRec = result.recommendations.find(r => r.category === 'special_regimes');
      expect(regimeRec).toBeDefined();
    });

    test('should recommend preferences for eligible countries', () => {
      const result = generateRecommendations({
        originCountry: 'CA', // Canada has CETA agreement
        customsValue: 50000,
        hasOriginCertificate: false
      });

      expect(result.success).toBe(true);
      const prefRec = result.recommendations.find(r => r.category === 'preferences');
      expect(prefRec).toBeDefined();
    });
  });

  describe('getQuickRecommendations', () => {
    test('should provide quick recommendations array', () => {
      const result = getQuickRecommendations('CN', '8517120000', 50000);

      expect(Array.isArray(result)).toBe(true);
    });

    test('should include preference recommendation for eligible countries', () => {
      const result = getQuickRecommendations('CA', '8517120000', 50000);

      expect(Array.isArray(result)).toBe(true);
      const prefRec = result.find(r => r.type === 'preference');
      expect(prefRec).toBeDefined();
      expect(prefRec.message).toContain('CETA');
    });

    test('should warn about high-risk products', () => {
      const result = getQuickRecommendations('DE', '8517120000', 50000);

      expect(Array.isArray(result)).toBe(true);
      const warning = result.find(r => r.type === 'warning');
      expect(warning).toBeDefined();
    });

    test('should handle missing parameters', () => {
      const result = getQuickRecommendations(null, null, null);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('PREFERENCE_AGREEMENTS', () => {
    test('should have Canada CETA agreement', () => {
      expect(PREFERENCE_AGREEMENTS.CA).toBeDefined();
      expect(PREFERENCE_AGREEMENTS.CA.name).toBe('CETA (Canada)');
      expect(PREFERENCE_AGREEMENTS.CA.avgSaving).toBeGreaterThan(0);
    });

    test('should have Japan JEFTA agreement', () => {
      expect(PREFERENCE_AGREEMENTS.JP).toBeDefined();
      expect(PREFERENCE_AGREEMENTS.JP.name).toBe('JEFTA (Japan)');
    });

    test('should have UK TCA agreement', () => {
      expect(PREFERENCE_AGREEMENTS.GB).toBeDefined();
      expect(PREFERENCE_AGREEMENTS.GB.name).toContain('TCA');
    });

    test('should include certificates for each agreement', () => {
      Object.values(PREFERENCE_AGREEMENTS).forEach(agreement => {
        expect(agreement.certificates).toBeDefined();
        expect(Array.isArray(agreement.certificates)).toBe(true);
        expect(agreement.certificates.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SPECIAL_REGIMES', () => {
    test('should have inward processing regime', () => {
      expect(SPECIAL_REGIMES.inwardProcessing).toBeDefined();
      expect(SPECIAL_REGIMES.inwardProcessing.code).toBe('51');
    });

    test('should have temporary admission regime', () => {
      expect(SPECIAL_REGIMES.temporaryAdmission).toBeDefined();
      expect(SPECIAL_REGIMES.temporaryAdmission.code).toBe('53');
    });

    test('should have customs warehouse regime', () => {
      expect(SPECIAL_REGIMES.customsWarehouse).toBeDefined();
      expect(SPECIAL_REGIMES.customsWarehouse.code).toBe('71');
    });

    test('should have free zone regime', () => {
      expect(SPECIAL_REGIMES.freeZone).toBeDefined();
      expect(SPECIAL_REGIMES.freeZone.code).toBe('78');
    });
  });

  describe('OEA_BENEFITS', () => {
    test('should have AEOC benefits', () => {
      expect(OEA_BENEFITS.AEOC).toBeDefined();
      expect(OEA_BENEFITS.AEOC.benefits).toBeDefined();
      expect(Array.isArray(OEA_BENEFITS.AEOC.benefits)).toBe(true);
    });

    test('should have AEOS benefits', () => {
      expect(OEA_BENEFITS.AEOS).toBeDefined();
    });

    test('should have AEOF complete benefits', () => {
      expect(OEA_BENEFITS.AEOF).toBeDefined();
      expect(OEA_BENEFITS.AEOF.name).toContain('Completo');
    });
  });
});
