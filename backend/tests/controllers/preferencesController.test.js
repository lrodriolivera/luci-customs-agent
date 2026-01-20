/**
 * Tests for Preferences Controller
 */

const request = require('supertest');
const express = require('express');
const preferencesController = require('../../src/controllers/preferencesController');
const preferencesService = require('../../src/services/preferencesService');

// Mock the service
jest.mock('../../src/services/preferencesService');

// Create test app
const app = express();
app.use(express.json());

// Define routes
app.post('/api/preferences/eligibility', preferencesController.checkEligibility);
app.get('/api/preferences/agreements', preferencesController.listAgreements);
app.get('/api/preferences/agreements/:key', preferencesController.getAgreement);
app.get('/api/preferences/country/:code', preferencesController.getByCountry);
app.post('/api/preferences/validate-certificate', preferencesController.validateCertificate);
app.post('/api/preferences/optimize', preferencesController.getRecommendations);
app.get('/api/preferences/origin-rules/:chapter', preferencesController.getOriginRules);
app.get('/api/preferences/info', preferencesController.getInfo);

describe('Preferences Controller', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/preferences/eligibility', () => {
    test('should check eligibility successfully', async () => {
      const mockResult = {
        eligible: true,
        agreements: [{ name: 'CETA', type: 'FTA', certificate: 'EUR.1' }],
        recommended: { name: 'CETA', certificate: 'EUR.1', savings: 1500 },
        savings: 1500,
        requirements: [{ type: 'certificate', name: 'EUR.1' }],
        warnings: []
      };

      preferencesService.checkEligibility.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/preferences/eligibility')
        .send({
          originCountry: 'CA',
          goods: [{ taricCode: '8517120000', customsValue: 50000 }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligible).toBe(true);
      expect(response.body.data.savings).toBe(1500);
      expect(preferencesService.checkEligibility).toHaveBeenCalledWith(
        expect.objectContaining({
          originCountry: 'CA'
        })
      );
    });

    test('should return 400 if originCountry is missing', async () => {
      const response = await request(app)
        .post('/api/preferences/eligibility')
        .send({ goods: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('originCountry es obligatorio');
    });

    test('should handle service errors', async () => {
      preferencesService.checkEligibility.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/preferences/eligibility')
        .send({ originCountry: 'CA' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service error');
    });
  });

  describe('GET /api/preferences/agreements', () => {
    test('should list all agreements', async () => {
      const mockAgreements = [
        { key: 'CETA', name: 'EU-Canada', type: 'FTA', certificate: 'EUR.1' },
        { key: 'JEFTA', name: 'EU-Japan', type: 'FTA', certificate: 'EUR.1' },
        { key: 'GSP', name: 'GSP', type: 'GSP', certificate: 'Form A' }
      ];

      preferencesService.getAllAgreements.mockReturnValue(mockAgreements);

      const response = await request(app)
        .get('/api/preferences/agreements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.agreements).toHaveLength(3);
      expect(preferencesService.getAllAgreements).toHaveBeenCalled();
    });

    test('should handle service errors', async () => {
      preferencesService.getAllAgreements.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/preferences/agreements');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/preferences/agreements/:key', () => {
    test('should return specific agreement info', async () => {
      const mockAgreement = {
        key: 'CETA',
        name: 'EU-Canada Comprehensive Economic and Trade Agreement',
        type: 'FTA',
        countries: ['CA'],
        certificate: 'EUR.1',
        originRules: { tolerance: 0.10, regionalValueContent: 0.50 }
      };

      preferencesService.getAgreementInfo.mockReturnValue(mockAgreement);

      const response = await request(app)
        .get('/api/preferences/agreements/CETA');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toContain('Canada');
      expect(response.body.data.type).toBe('FTA');
      expect(preferencesService.getAgreementInfo).toHaveBeenCalledWith('CETA');
    });

    test('should return 404 for non-existent agreement', async () => {
      preferencesService.getAgreementInfo.mockReturnValue(null);

      const response = await request(app)
        .get('/api/preferences/agreements/INVALID');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('no encontrado');
    });
  });

  describe('GET /api/preferences/country/:code', () => {
    test('should return agreements for specific country', async () => {
      const mockAgreements = [
        {
          key: 'CETA',
          name: 'EU-Canada',
          type: 'FTA',
          certificate: 'EUR.1',
          preferentialRate: 0,
          originRules: { tolerance: 0.10 }
        }
      ];

      preferencesService.findApplicableAgreements.mockReturnValue(mockAgreements);

      const response = await request(app)
        .get('/api/preferences/country/CA');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.country).toBe('CA');
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.agreements).toHaveLength(1);
      expect(preferencesService.findApplicableAgreements).toHaveBeenCalledWith('CA');
    });

    test('should return 400 for invalid country code', async () => {
      const response = await request(app)
        .get('/api/preferences/country/INVALID');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Codigo de pais ISO-2 invalido');
    });

    test('should handle lowercase country code', async () => {
      const mockAgreements = [];
      preferencesService.findApplicableAgreements.mockReturnValue(mockAgreements);

      const response = await request(app)
        .get('/api/preferences/country/ca');

      expect(response.status).toBe(200);
      expect(response.body.data.country).toBe('CA');
      expect(preferencesService.findApplicableAgreements).toHaveBeenCalledWith('CA');
    });
  });

  describe('POST /api/preferences/validate-certificate', () => {
    test('should validate certificate successfully', async () => {
      const mockResult = {
        valid: true,
        issues: [],
        warnings: []
      };

      preferencesService.validateCertificate.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/preferences/validate-certificate')
        .send({
          type: 'EUR.1',
          certificateNumber: 'ES123456',
          issuedDate: '2024-01-15',
          exporterName: 'Test Exporter',
          consigneeName: 'Test Importer',
          originCountry: 'CA'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(preferencesService.validateCertificate).toHaveBeenCalled();
    });

    test('should return validation issues for invalid certificate', async () => {
      const mockResult = {
        valid: false,
        issues: [
          { field: 'issuedDate', message: 'Certificate expired' }
        ],
        warnings: []
      };

      preferencesService.validateCertificate.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/preferences/validate-certificate')
        .send({
          type: 'EUR.1',
          issuedDate: '2022-01-15',
          exporterName: 'Test Exporter',
          consigneeName: 'Test Importer',
          originCountry: 'CA'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.issues.length).toBeGreaterThan(0);
    });

    test('should return 400 if type is missing', async () => {
      const response = await request(app)
        .post('/api/preferences/validate-certificate')
        .send({ issuedDate: '2024-01-15' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('type e issuedDate son obligatorios');
    });

    test('should return 400 if issuedDate is missing', async () => {
      const response = await request(app)
        .post('/api/preferences/validate-certificate')
        .send({ type: 'EUR.1' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/preferences/optimize', () => {
    test('should return optimization recommendations', async () => {
      const mockRecommendations = [
        {
          type: 'preference',
          priority: 'high',
          savings: 1500,
          action: 'Apply CETA agreement',
          requirements: ['EUR.1 certificate']
        },
        {
          type: 'documentation',
          priority: 'low',
          description: 'Value below 6000 EUR',
          action: 'Use invoice declaration'
        }
      ];

      preferencesService.generateOptimizationRecommendations.mockResolvedValue(mockRecommendations);

      const response = await request(app)
        .post('/api/preferences/optimize')
        .send({
          originCountry: 'CA',
          goods: [{ taricCode: '8517120000', customsValue: 5000 }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.potentialSavings).toBe(1500);
    });

    test('should return 400 if originCountry is missing', async () => {
      const response = await request(app)
        .post('/api/preferences/optimize')
        .send({ goods: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('originCountry es obligatorio');
    });
  });

  describe('GET /api/preferences/origin-rules/:chapter', () => {
    test('should return origin rules for chapter', async () => {
      const mockRule = {
        rule: 'RVC',
        description: 'RVC 45% minimum',
        valueAdded: 0.45
      };

      preferencesService.getOriginRule.mockReturnValue(mockRule);

      const response = await request(app)
        .get('/api/preferences/origin-rules/84');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.chapter).toBe('84');
      expect(response.body.data.rule).toBe('RVC');
      expect(response.body.data.valueAdded).toBe(0.45);
      expect(preferencesService.getOriginRule).toHaveBeenCalledWith('84');
    });

    test('should return 400 for invalid chapter', async () => {
      const response = await request(app)
        .get('/api/preferences/origin-rules/8');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Capitulo TARIC invalido');
    });
  });

  describe('GET /api/preferences/info', () => {
    test('should return system information', async () => {
      const response = await request(app)
        .get('/api/preferences/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.system).toBe('LUCI Preferential Tariffs Module');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.coverage).toBeDefined();
      expect(response.body.data.coverage.fta).toBeInstanceOf(Array);
      expect(response.body.data.coverage.gsp).toBeInstanceOf(Array);
      expect(response.body.data.certificates).toBeInstanceOf(Array);
      expect(response.body.data.capabilities).toBeInstanceOf(Array);
    });
  });
});
