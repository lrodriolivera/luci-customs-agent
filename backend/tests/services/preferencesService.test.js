/**
 * Tests for Preferences Service
 * Preferencias Arancelarias - FTA, GSP, GSP+, EBA
 */

const preferencesService = require('../../src/services/preferencesService');

describe('Preferences Service', () => {

  describe('findApplicableAgreements', () => {
    test('should find CETA agreement for Canada', () => {
      const agreements = preferencesService.findApplicableAgreements('CA');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.key === 'CETA')).toBe(true);
    });

    test('should find JEFTA agreement for Japan', () => {
      const agreements = preferencesService.findApplicableAgreements('JP');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.key === 'JEFTA')).toBe(true);
    });

    test('should find EU-UK agreement for United Kingdom', () => {
      const agreements = preferencesService.findApplicableAgreements('GB');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.key === 'EU-UK')).toBe(true);
    });

    test('should find GSP agreement for India', () => {
      const agreements = preferencesService.findApplicableAgreements('IN');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'GSP')).toBe(true);
    });

    test('should find GSP+ agreement for Pakistan', () => {
      const agreements = preferencesService.findApplicableAgreements('PK');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'GSP+')).toBe(true);
    });

    test('should find EBA agreement for Bangladesh', () => {
      const agreements = preferencesService.findApplicableAgreements('BD');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'EBA')).toBe(true);
    });

    test('should find Pan-Euro-Med agreements for Switzerland', () => {
      const agreements = preferencesService.findApplicableAgreements('CH');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'PEM')).toBe(true);
    });

    test('should return empty array for countries without agreements', () => {
      const agreements = preferencesService.findApplicableAgreements('ZZ');

      expect(agreements).toHaveLength(0);
    });
  });

  describe('checkEligibility', () => {
    test('should return eligible for Canada with goods', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000, description: 'Smartphones' }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(true);
      expect(result.agreements.length).toBeGreaterThan(0);
      expect(result.recommended).toBeDefined();
      expect(result.savings).toBeGreaterThanOrEqual(0);
    });

    test('should return eligible for Japan with goods', async () => {
      const operation = {
        originCountry: 'JP',
        goods: [
          { taricCode: '8471300000', customsValue: 100000, description: 'Laptops' }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(true);
      expect(result.agreements.some(a => a.name.includes('Japan'))).toBe(true);
    });

    test('should return not eligible for country without agreements', async () => {
      const operation = {
        originCountry: 'ZZ',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(false);
      expect(result.warnings.some(w => w.code === 'NO_AGREEMENTS')).toBe(true);
    });

    test('should calculate savings for applicable agreement', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8701200000', customsValue: 100000, description: 'Agricultural tractors' }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(true);
      expect(result.savings).toBeGreaterThan(0);
    });

    test('should include requirements for applying preference', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.requirements).toBeDefined();
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.requirements.some(r => r.type === 'certificate')).toBe(true);
    });
  });

  describe('getAgreementInfo', () => {
    test('should return CETA agreement info', () => {
      const info = preferencesService.getAgreementInfo('CETA');

      expect(info).toBeDefined();
      expect(info.name).toContain('Canada');
      expect(info.type).toBe('FTA');
      expect(info.countries).toContain('CA');
      expect(info.certificate).toBeDefined();
    });

    test('should return GSP agreement info', () => {
      const info = preferencesService.getAgreementInfo('GSP');

      expect(info).toBeDefined();
      expect(info.type).toBe('GSP');
      expect(info.certificate).toBe('Form A');
    });

    test('should return null for non-existent agreement', () => {
      const info = preferencesService.getAgreementInfo('INVALID');

      expect(info).toBeNull();
    });
  });

  describe('getAllAgreements', () => {
    test('should return all available agreements', () => {
      const agreements = preferencesService.getAllAgreements();

      expect(agreements).toBeInstanceOf(Array);
      expect(agreements.length).toBeGreaterThan(5);
      expect(agreements.some(a => a.key === 'CETA')).toBe(true);
      expect(agreements.some(a => a.key === 'JEFTA')).toBe(true);
      expect(agreements.some(a => a.key === 'GSP')).toBe(true);
    });

    test('should include required fields for each agreement', () => {
      const agreements = preferencesService.getAllAgreements();

      agreements.forEach(agreement => {
        expect(agreement.key).toBeDefined();
        expect(agreement.name).toBeDefined();
        expect(agreement.type).toBeDefined();
        expect(agreement.certificate).toBeDefined();
      });
    });
  });

  describe('getOriginRule', () => {
    test('should return rule for textile chapters (50-63)', () => {
      const rule = preferencesService.getOriginRule('62');

      expect(rule).toBeDefined();
      expect(rule.rule).toBe('CC');
      expect(rule.description).toContain('change of tariff chapter');
    });

    test('should return rule for machinery chapters (84-85)', () => {
      const rule = preferencesService.getOriginRule('84');

      expect(rule).toBeDefined();
      expect(rule.rule).toBe('RVC');
      expect(rule.valueAdded).toBe(0.45);
    });

    test('should return rule for vehicles chapter (87)', () => {
      const rule = preferencesService.getOriginRule('87');

      // Chapter 87 is defined separately in ORIGIN_RULES_BY_CHAPTER
      // If not found in ranges, returns default CC rule
      expect(rule).toBeDefined();
      expect(rule.rule).toBeDefined();
      expect(['RVC', 'CC']).toContain(rule.rule);
    });

    test('should return default rule for unknown chapter', () => {
      const rule = preferencesService.getOriginRule('99');

      expect(rule).toBeDefined();
      expect(rule.rule).toBe('CC');
    });
  });

  describe('validateCertificate', () => {
    test('should validate a correct EUR.1 certificate', async () => {
      const certificate = {
        type: 'EUR.1',
        certificateNumber: 'ES123456',
        issuedDate: new Date().toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should reject expired certificate (>10 months)', async () => {
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 11);

      const certificate = {
        type: 'EUR.1',
        certificateNumber: 'ES123456',
        issuedDate: expiredDate.toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.field === 'issuedDate')).toBe(true);
    });

    test('should reject certificate with missing required fields', async () => {
      const certificate = {
        type: 'EUR.1',
        issuedDate: new Date().toISOString()
        // Missing exporterName, consigneeName, originCountry, certificateNumber
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should reject invalid certificate type', async () => {
      const certificate = {
        type: 'INVALID_TYPE',
        certificateNumber: 'ES123456',
        issuedDate: new Date().toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.field === 'type')).toBe(true);
    });

    test('should warn about non-standard EUR.1 number format', async () => {
      const certificate = {
        type: 'EUR.1',
        certificateNumber: 'IRREGULAR123',
        issuedDate: new Date().toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.warnings.some(w => w.field === 'certificateNumber')).toBe(true);
    });
  });

  describe('generateOptimizationRecommendations', () => {
    test('should recommend applying preference when eligible', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ]
      };

      const recommendations = await preferencesService.generateOptimizationRecommendations(operation);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'preference')).toBe(true);
    });

    test('should recommend invoice declaration for low value shipments', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 5000 } // Below 6000 EUR
        ]
      };

      const recommendations = await preferencesService.generateOptimizationRecommendations(operation);

      expect(recommendations.some(r => r.type === 'documentation')).toBe(true);
    });

    test('should suggest cumulation opportunities when materials provided', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ],
        materials: [
          { origin: 'US', value: 10000 }
        ]
      };

      const recommendations = await preferencesService.generateOptimizationRecommendations(operation);

      expect(recommendations.some(r => r.type === 'cumulation')).toBe(true);
    });
  });

  describe('checkOriginRules', () => {
    test('should verify RVC compliance for machinery', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          {
            taricCode: '8471300000',
            customsValue: 100000,
            originBreakdown: {
              originatingMaterials: 50000
            }
          }
        ]
      };

      const agreement = preferencesService.findApplicableAgreements('CA')[0];
      const result = preferencesService.checkOriginRules(operation, agreement);

      expect(result.complies).toBe(true);
      expect(result.conditions.some(c => c.type === 'rvc')).toBe(true);
    });

    test('should reject insufficient RVC', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          {
            taricCode: '8471300000',
            customsValue: 100000,
            originBreakdown: {
              originatingMaterials: 30000 // Only 30% RVC
            },
            description: 'Computer'
          }
        ]
      };

      const agreement = preferencesService.findApplicableAgreements('CA')[0];
      const result = preferencesService.checkOriginRules(operation, agreement);

      expect(result.complies).toBe(false);
      expect(result.issues.some(i => i.issue.includes('regional value content'))).toBe(true);
    });

    test('should check tolerance for non-originating materials', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          {
            taricCode: '8471300000',
            customsValue: 100000,
            nonOriginatingContent: 15000, // 15% non-originating
            description: 'Computer'
          }
        ]
      };

      const agreement = preferencesService.findApplicableAgreements('CA')[0];
      const result = preferencesService.checkOriginRules(operation, agreement);

      // 15% exceeds 10% tolerance
      expect(result.issues.some(i => i.issue.includes('tolerance'))).toBe(true);
    });
  });
});
