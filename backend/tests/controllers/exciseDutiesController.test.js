/**
 * Tests for Excise Duties Controller
 */

const request = require('supertest');
const express = require('express');
const exciseDutiesController = require('../../src/controllers/exciseDutiesController');
const exciseDutiesService = require('../../src/services/exciseDutiesService');

// Mock the service
jest.mock('../../src/services/exciseDutiesService');

// Create test app
const app = express();
app.use(express.json());

// Define routes
app.post('/api/excise/detect', exciseDutiesController.detectExciseProduct);
app.post('/api/excise/calculate', exciseDutiesController.calculateExciseDuty);
app.post('/api/excise/calculate-total', exciseDutiesController.calculateTotalExciseDuties);
app.post('/api/excise/generate-document', exciseDutiesController.generateSILICIEDocument);
app.post('/api/excise/check-exemptions', exciseDutiesController.checkExemptions);
app.get('/api/excise/categories', exciseDutiesController.getCategories);
app.get('/api/excise/rates', exciseDutiesController.getRates);
app.get('/api/excise/exemptions', exciseDutiesController.getExemptions);
app.get('/api/excise/info', exciseDutiesController.getInfo);

describe('Excise Duties Controller', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/excise/detect', () => {
    test('should detect excise product successfully', async () => {
      const mockResult = {
        subject: true,
        category: 'ALCOHOL',
        categoryName: 'Bebidas Alcohólicas',
        description: 'Cerveza'
      };

      exciseDutiesService.detectExciseProduct.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/excise/detect')
        .send({ taricCode: '2203000010' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subject).toBe(true);
      expect(response.body.data.category).toBe('ALCOHOL');
      expect(exciseDutiesService.detectExciseProduct).toHaveBeenCalledWith('2203000010');
    });

    test('should return 400 if taricCode is missing', async () => {
      const response = await request(app)
        .post('/api/excise/detect')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('taricCode es obligatorio');
    });

    test('should handle service errors', async () => {
      exciseDutiesService.detectExciseProduct.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .post('/api/excise/detect')
        .send({ taricCode: '2203000010' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service error');
    });
  });

  describe('POST /api/excise/calculate', () => {
    test('should calculate excise duty successfully', async () => {
      const mockResult = {
        applicable: true,
        category: 'ALCOHOL',
        subcategory: 'BEER',
        amount: 5.5,
        rate: 0.11
      };

      exciseDutiesService.calculateExciseDuty.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/excise/calculate')
        .send({
          taricCode: '2203000010',
          description: 'Cerveza',
          quantity: 1000,
          alcoholContent: 5.0,
          unit: 'L'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(5.5);
      expect(exciseDutiesService.calculateExciseDuty).toHaveBeenCalledWith(
        expect.objectContaining({
          taricCode: '2203000010',
          quantity: 1000
        })
      );
    });

    test('should return 400 if taricCode is missing', async () => {
      const response = await request(app)
        .post('/api/excise/calculate')
        .send({ quantity: 1000 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('taricCode y quantity son obligatorios');
    });

    test('should return 400 if quantity is missing', async () => {
      const response = await request(app)
        .post('/api/excise/calculate')
        .send({ taricCode: '2203000010' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/excise/calculate-total', () => {
    test('should calculate total excise duties for multiple products', async () => {
      const mockResult = {
        total: 2005.5,
        byCategory: {
          ALCOHOL: { amount: 5.5 },
          TOBACCO: { amount: 2000 }
        },
        items: [
          { taricCode: '2203000010', excise: { applicable: true, amount: 5.5 } },
          { taricCode: '2402200000', excise: { applicable: true, amount: 2000 } }
        ]
      };

      exciseDutiesService.calculateTotalExciseDuties.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/excise/calculate-total')
        .send({
          goods: [
            { taricCode: '2203000010', description: 'Cerveza', quantity: 1000, alcoholContent: 5.0 },
            { taricCode: '2402200000', description: 'Cigarrillos', quantity: 10000, price: 5000 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(2005.5);
      expect(response.body.data.items).toHaveLength(2);
    });

    test('should return 400 if goods array is missing', async () => {
      const response = await request(app)
        .post('/api/excise/calculate-total')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('goods array es obligatorio');
    });

    test('should return 400 if goods array is empty', async () => {
      const response = await request(app)
        .post('/api/excise/calculate-total')
        .send({ goods: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if goods is not an array', async () => {
      const response = await request(app)
        .post('/api/excise/calculate-total')
        .send({ goods: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/excise/generate-document', () => {
    test('should generate SILICIE document successfully', async () => {
      const mockExciseDuties = {
        total: 5.5,
        byCategory: { ALCOHOL: { amount: 5.5 } },
        items: []
      };

      const mockDocument = {
        documentType: 'DUA-SILICIE',
        documentNumber: 'SILICIE-123',
        exciseDuties: mockExciseDuties,
        requirements: [],
        guarantees: []
      };

      exciseDutiesService.calculateTotalExciseDuties.mockReturnValue(mockExciseDuties);
      exciseDutiesService.generateSILICIEDocument.mockReturnValue(mockDocument);

      const response = await request(app)
        .post('/api/excise/generate-document')
        .send({
          operation: { type: 'import', originCountry: 'FR', destinationCountry: 'ES' },
          goods: [{ taricCode: '2203000010', quantity: 1000, alcoholContent: 5.0 }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documentType).toBe('DUA-SILICIE');
      expect(exciseDutiesService.calculateTotalExciseDuties).toHaveBeenCalled();
      expect(exciseDutiesService.generateSILICIEDocument).toHaveBeenCalled();
    });

    test('should return 400 if operation is missing', async () => {
      const response = await request(app)
        .post('/api/excise/generate-document')
        .send({ goods: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('operation y goods array son obligatorios');
    });

    test('should return 400 if goods is missing', async () => {
      const response = await request(app)
        .post('/api/excise/generate-document')
        .send({ operation: { type: 'import' } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/excise/check-exemptions', () => {
    test('should check exemptions successfully', async () => {
      const mockResult = {
        category: 'ALCOHOL',
        exempt: false,
        availableExemptions: ['Exportación', 'Uso médico'],
        potentialMatches: [],
        requiresDocumentation: true
      };

      exciseDutiesService.checkExemptions.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/excise/check-exemptions')
        .send({
          product: { taricCode: '2207100000', description: 'Alcohol etílico' },
          usage: 'medical use'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('ALCOHOL');
      expect(exciseDutiesService.checkExemptions).toHaveBeenCalled();
    });

    test('should return 400 if product is missing', async () => {
      const response = await request(app)
        .post('/api/excise/check-exemptions')
        .send({ usage: 'medical' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('product con taricCode es obligatorio');
    });

    test('should return 400 if product.taricCode is missing', async () => {
      const response = await request(app)
        .post('/api/excise/check-exemptions')
        .send({ product: { description: 'Test' }, usage: 'medical' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/excise/categories', () => {
    test('should return excise categories', async () => {
      const mockCategories = {
        ALCOHOL: { name: 'Bebidas Alcohólicas', taricRanges: ['2203-2208'], subcategories: ['BEER', 'WINE'] },
        TOBACCO: { name: 'Labores del Tabaco', taricRanges: ['2402-2403'], subcategories: ['CIGARETTES'] }
      };

      exciseDutiesService.EXCISE_CATEGORIES = mockCategories;

      const response = await request(app)
        .get('/api/excise/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data.categories.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/excise/rates', () => {
    test('should return excise rates', async () => {
      const mockRates = {
        ALCOHOL: { BEER: { standard: 0.11 } },
        TOBACCO: { CIGARETTES: { specific: 25.75 } }
      };

      exciseDutiesService.EXCISE_RATES = mockRates;

      const response = await request(app)
        .get('/api/excise/rates');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rates).toBeDefined();
      expect(response.body.data.currency).toBe('EUR');
    });
  });

  describe('GET /api/excise/exemptions', () => {
    test('should return exemptions list', async () => {
      const mockExemptions = {
        ALCOHOL: ['Exportación', 'Uso médico', 'Desnaturalización'],
        TOBACCO: ['Exportación']
      };

      exciseDutiesService.EXEMPTIONS = mockExemptions;

      const response = await request(app)
        .get('/api/excise/exemptions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exemptions).toBeDefined();
      expect(response.body.data.note).toBeDefined();
    });
  });

  describe('GET /api/excise/info', () => {
    test('should return SILICIE system information', async () => {
      const response = await request(app)
        .get('/api/excise/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.system).toBe('SILICIE');
      expect(response.body.data.fullName).toContain('Sistema de Información');
      expect(response.body.data.authority).toBe('Agencia Tributaria Española');
      expect(response.body.data.coverage).toBeDefined();
      expect(response.body.data.coverage.alcohol).toBeDefined();
      expect(response.body.data.coverage.tobacco).toBeDefined();
      expect(response.body.data.coverage.hydrocarbons).toBeDefined();
      expect(response.body.data.coverage.electricity).toBeDefined();
      expect(response.body.data.capabilities).toBeInstanceOf(Array);
    });
  });
});
