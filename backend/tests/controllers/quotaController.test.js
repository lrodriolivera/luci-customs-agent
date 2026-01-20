/**
 * Tests for Quota Controller
 */

const request = require('supertest');
const express = require('express');
const quotaController = require('../../src/controllers/quotaController');
const quotaService = require('../../src/services/quotaService');

// Mock the service
jest.mock('../../src/services/quotaService');

// Create test app
const app = express();
app.use(express.json());

// Define routes - specific paths must come before parameterized paths
app.post('/api/quotas/check-availability', quotaController.checkAvailability);
app.post('/api/quotas/reserve', quotaController.reserveQuota);
app.post('/api/quotas/calculate-savings', quotaController.calculateSavings);
app.post('/api/quotas/report', quotaController.generateReport);
app.get('/api/quotas/by-agreement/:agreementCode', quotaController.getByAgreement);
app.get('/api/quotas/critical', quotaController.getCritical);
app.get('/api/quotas/list', quotaController.listAll);
app.get('/api/quotas/info', quotaController.getInfo); // Specific path before :orderNumber
app.get('/api/quotas/:orderNumber', quotaController.getByOrderNumber);

describe('Quota Controller', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/quotas/check-availability', () => {
    test('should check quota availability successfully', async () => {
      const mockResult = {
        found: true,
        count: 2,
        quotas: [
          {
            quotaId: 'Q090001',
            orderNumber: '090001',
            description: 'Carne de vacuno',
            available: true,
            volume: { requested: 10000, available: 12550000, total: 45000000 }
          }
        ]
      };

      quotaService.checkQuotaAvailability.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/quotas/check-availability')
        .send({
          taricCode: '02011000',
          originCountry: 'AR',
          quantity: 10000,
          unit: 'kg'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.found).toBe(true);
      expect(response.body.data.quotas).toBeInstanceOf(Array);
      expect(quotaService.checkQuotaAvailability).toHaveBeenCalledWith('02011000', 'AR', 10000, 'kg');
    });

    test('should use default unit if not provided', async () => {
      quotaService.checkQuotaAvailability.mockReturnValue({ found: false, count: 0, quotas: [] });

      await request(app)
        .post('/api/quotas/check-availability')
        .send({
          taricCode: '02011000',
          originCountry: 'AR',
          quantity: 10000
        });

      expect(quotaService.checkQuotaAvailability).toHaveBeenCalledWith('02011000', 'AR', 10000, 'kg');
    });

    test('should return 400 if taricCode is missing', async () => {
      const response = await request(app)
        .post('/api/quotas/check-availability')
        .send({
          originCountry: 'AR',
          quantity: 10000
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('taricCode, originCountry y quantity son obligatorios');
    });

    test('should return 400 if originCountry is missing', async () => {
      const response = await request(app)
        .post('/api/quotas/check-availability')
        .send({
          taricCode: '02011000',
          quantity: 10000
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if quantity is missing', async () => {
      const response = await request(app)
        .post('/api/quotas/check-availability')
        .send({
          taricCode: '02011000',
          originCountry: 'AR'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle service errors', async () => {
      quotaService.checkQuotaAvailability.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .post('/api/quotas/check-availability')
        .send({
          taricCode: '02011000',
          originCountry: 'AR',
          quantity: 10000
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service error');
    });
  });

  describe('POST /api/quotas/reserve', () => {
    test('should reserve quota successfully', async () => {
      const mockResult = {
        success: true,
        reservationId: 'RES-Q090001-123',
        quotaId: 'Q090001',
        quantity: 5000,
        instructions: ['Declarar número de orden en casilla 47 del DUA']
      };

      quotaService.reserveQuota.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/quotas/reserve')
        .send({
          quotaId: 'Q090001',
          quantity: 5000,
          operation: { type: 'import', originCountry: 'AR' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reservationId).toBeDefined();
      expect(quotaService.reserveQuota).toHaveBeenCalledWith('Q090001', 5000, expect.any(Object));
    });

    test('should use empty operation object if not provided', async () => {
      quotaService.reserveQuota.mockReturnValue({ success: true });

      await request(app)
        .post('/api/quotas/reserve')
        .send({
          quotaId: 'Q090001',
          quantity: 5000
        });

      expect(quotaService.reserveQuota).toHaveBeenCalledWith('Q090001', 5000, {});
    });

    test('should return 400 if quota reservation fails', async () => {
      const mockResult = {
        success: false,
        error: 'Cantidad solicitada excede disponibilidad',
        available: 1000,
        requested: 5000
      };

      quotaService.reserveQuota.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/quotas/reserve')
        .send({
          quotaId: 'Q090001',
          quantity: 5000
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('excede disponibilidad');
      expect(response.body.details).toBeDefined();
    });

    test('should return 400 if quotaId is missing', async () => {
      const response = await request(app)
        .post('/api/quotas/reserve')
        .send({
          quantity: 5000
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('quotaId y quantity son obligatorios');
    });

    test('should return 400 if quantity is missing', async () => {
      const response = await request(app)
        .post('/api/quotas/reserve')
        .send({
          quotaId: 'Q090001'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/quotas/calculate-savings', () => {
    test('should calculate quota savings successfully', async () => {
      const mockResult = {
        applicable: true,
        dutyWithoutQuota: 945,
        dutyWithQuota: 40,
        savings: 905,
        savingsPercent: 95.77,
        quota: {
          quotaId: 'Q090001',
          orderNumber: '090001',
          description: 'Carne de vacuno'
        }
      };

      quotaService.calculateQuotaSavings.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/quotas/calculate-savings')
        .send({
          taricCode: '02011000',
          originCountry: 'AR',
          quantity: 10000,
          customsValue: 50000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.applicable).toBe(true);
      expect(response.body.data.savings).toBe(905);
      expect(quotaService.calculateQuotaSavings).toHaveBeenCalledWith('02011000', 'AR', 10000, 50000);
    });

    test('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/quotas/calculate-savings')
        .send({
          taricCode: '02011000',
          originCountry: 'AR'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('taricCode, originCountry, quantity y customsValue son obligatorios');
    });
  });

  describe('GET /api/quotas/by-agreement/:agreementCode', () => {
    test('should return quotas by agreement', async () => {
      const mockResult = {
        agreement: 'CETA',
        count: 5,
        quotas: [
          { quotaId: 'Q094100', orderNumber: '094100', description: 'Carne de cerdo - CETA' }
        ]
      };

      quotaService.getQuotasByAgreement.mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/quotas/by-agreement/CETA');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agreement).toBe('CETA');
      expect(response.body.data.quotas).toBeInstanceOf(Array);
      expect(quotaService.getQuotasByAgreement).toHaveBeenCalledWith('CETA');
    });

    test('should handle non-existent agreement', async () => {
      const mockResult = {
        agreement: 'NON_EXISTENT',
        count: 0,
        quotas: []
      };

      quotaService.getQuotasByAgreement.mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/quotas/by-agreement/NON_EXISTENT');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(0);
    });
  });

  describe('GET /api/quotas/critical', () => {
    test('should return critical quotas', async () => {
      const mockCritical = [
        {
          quotaId: 'Q090002',
          orderNumber: '090002',
          utilizationPercent: 97.5,
          available: 250000,
          estimatedExhaustion: 'Crítico: 15 días'
        }
      ];

      quotaService.getCriticalQuotas.mockReturnValue(mockCritical);

      const response = await request(app)
        .get('/api/quotas/critical');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.quotas).toBeInstanceOf(Array);
      expect(response.body.data.quotas[0].utilizationPercent).toBeGreaterThan(90);
    });

    test('should return empty array if no critical quotas', async () => {
      quotaService.getCriticalQuotas.mockReturnValue([]);

      const response = await request(app)
        .get('/api/quotas/critical');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(0);
      expect(response.body.data.quotas).toHaveLength(0);
    });
  });

  describe('POST /api/quotas/report', () => {
    test('should generate quota report without filters', async () => {
      const mockReport = {
        generatedAt: new Date().toISOString(),
        filters: {},
        summary: {
          total: 10,
          available: 6,
          critical: 2,
          exhausted: 2,
          byType: { autonomous: 5, fta: 5 }
        },
        quotas: []
      };

      quotaService.generateQuotaReport.mockReturnValue(mockReport);

      const response = await request(app)
        .post('/api/quotas/report')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(quotaService.generateQuotaReport).toHaveBeenCalledWith({});
    });

    test('should generate quota report with filters', async () => {
      const mockReport = {
        generatedAt: new Date().toISOString(),
        filters: { type: 'fta', agreement: 'CETA' },
        summary: { total: 3 },
        quotas: []
      };

      quotaService.generateQuotaReport.mockReturnValue(mockReport);

      const response = await request(app)
        .post('/api/quotas/report')
        .send({
          type: 'fta',
          agreement: 'CETA'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.type).toBe('fta');
      expect(quotaService.generateQuotaReport).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'fta', agreement: 'CETA' })
      );
    });
  });

  describe('GET /api/quotas/list', () => {
    test('should list all active quotas', async () => {
      const mockQuotas = {
        Q090001: {
          orderNumber: '090001',
          type: 'autonomous',
          description: 'Carne de vacuno',
          originCountries: ['US', 'AR'],
          volume: { total: 45000000, used: 32450000, available: 12550000, unit: 'kg' },
          duty: { inQuota: 0.08, outQuota: 0.189 },
          period: { start: '2025-01-01', end: '2026-12-31' }
        }
      };

      quotaService.ACTIVE_QUOTAS = mockQuotas;

      const response = await request(app)
        .get('/api/quotas/list');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(response.body.data.quotas).toBeInstanceOf(Array);
      expect(response.body.data.quotas[0].quotaId).toBeDefined();
      expect(response.body.data.quotas[0].status).toBeDefined();
    });
  });

  describe('GET /api/quotas/:orderNumber', () => {
    test('should get quota by order number', async () => {
      const mockQuotas = {
        Q090001: {
          orderNumber: '090001',
          type: 'autonomous',
          agreement: 'N/A',
          description: 'Carne de vacuno',
          taricCodes: ['02011000'],
          originCountries: ['US', 'AR'],
          volume: { total: 45000000, used: 32450000, available: 12550000, unit: 'kg' },
          duty: { inQuota: 0.08, outQuota: 0.189 },
          period: { start: '2025-01-01', end: '2026-12-31' },
          allocationMethod: 'fcfs',
          requiresCertificate: 'N/A'
        }
      };

      quotaService.ACTIVE_QUOTAS = mockQuotas;

      const response = await request(app)
        .get('/api/quotas/090001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.orderNumber).toBe('090001');
      expect(response.body.data.quotaId).toBe('Q090001');
      expect(response.body.data.volume.utilizationPercent).toBeDefined();
      expect(response.body.data.status).toBeDefined();
    });

    test('should return 404 if quota not found', async () => {
      quotaService.ACTIVE_QUOTAS = {};

      const response = await request(app)
        .get('/api/quotas/999999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('no encontrado');
    });
  });

  describe('GET /api/quotas/info', () => {
    test('should return quota system information', async () => {
      quotaService.ACTIVE_QUOTAS = { Q1: {}, Q2: {} };

      const response = await request(app)
        .get('/api/quotas/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.system).toBe('Tariff Rate Quotas (TRQ)');
      expect(response.body.data.description).toBeDefined();
      expect(response.body.data.capabilities).toBeInstanceOf(Array);
      expect(response.body.data.allocationMethods).toBeDefined();
      expect(response.body.data.quotaTypes).toBeDefined();
      expect(response.body.data.coverage).toBeDefined();
      expect(response.body.data.coverage.activeQuotas).toBe(2);
    });
  });
});
