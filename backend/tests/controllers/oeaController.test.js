/**
 * Tests for OEA Controller
 * Operador Economico Autorizado
 */

const request = require('supertest');
const express = require('express');
const oeaController = require('../../src/controllers/oeaController');
const oeaService = require('../../src/services/oeaService');

// Mock the service
jest.mock('../../src/services/oeaService');

// Create test app
const app = express();
app.use(express.json());

// Define routes
app.post('/api/oea', oeaController.create);
app.get('/api/oea', oeaController.list);
app.get('/api/oea/stats', oeaController.getStats);
app.get('/api/oea/expiring', oeaController.getExpiring);
app.get('/api/oea/benefits', oeaController.getBenefitsCatalog);
app.get('/api/oea/simplifications', oeaController.getSimplifications);
app.get('/api/oea/mutual-recognition', oeaController.getMutualRecognition);
app.get('/api/oea/info', oeaController.getInfo);
app.get('/api/oea/eori/:eori', oeaController.getByEORI);
app.get('/api/oea/nif/:nif', oeaController.getByNIF);
app.get('/api/oea/:id', oeaController.getById);
app.put('/api/oea/:id', oeaController.update);
app.post('/api/oea/:id/submit', oeaController.submitForReview);
app.post('/api/oea/:id/approve', oeaController.approve);
app.post('/api/oea/:id/suspend', oeaController.suspend);
app.post('/api/oea/:id/revoke', oeaController.revoke);
app.post('/api/oea/:id/renewal/initiate', oeaController.initiateRenewal);
app.post('/api/oea/:id/renewal/complete', oeaController.completeRenewal);
app.post('/api/oea/:id/audits', oeaController.addAudit);
app.put('/api/oea/:id/requirements/:requirement', oeaController.updateRequirement);
app.post('/api/oea/:id/compliance', oeaController.addComplianceRecord);
app.post('/api/oea/:id/simplifications', oeaController.grantSimplification);
app.post('/api/oea/:id/guarantee-reduction', oeaController.calculateGuaranteeReduction);

describe('OEA Controller', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/oea', () => {
    test('should create OEA application successfully', async () => {
      const mockOEA = {
        _id: 'oea123',
        organization: {
          name: 'Test Company',
          nif: 'A12345678',
          eori: 'ESA12345678000'
        },
        certification: {
          type: 'OEAC',
          status: 'pending'
        }
      };

      oeaService.createApplication.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea')
        .send({
          organization: {
            name: 'Test Company',
            nif: 'A12345678',
            eori: 'ESA12345678000'
          },
          certification: { type: 'OEAC' }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.organization.name).toBe('Test Company');
      expect(oeaService.createApplication).toHaveBeenCalled();
    });

    test('should return 400 for missing organization', async () => {
      const response = await request(app)
        .post('/api/oea')
        .send({ certification: { type: 'OEAC' } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('organization');
    });

    test('should handle service errors', async () => {
      oeaService.createApplication.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/oea')
        .send({
          organization: {
            name: 'Test Company',
            nif: 'A12345678',
            eori: 'ESA12345678000'
          },
          certification: { type: 'OEAC' }
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/oea', () => {
    test('should list all OEA records', async () => {
      const mockOEAs = [
        { _id: 'oea1', organization: { name: 'Company 1' }, certification: { type: 'OEAC' } },
        { _id: 'oea2', organization: { name: 'Company 2' }, certification: { type: 'OEAS' } }
      ];

      oeaService.list.mockResolvedValue({ oeas: mockOEAs, total: 2 });

      const response = await request(app)
        .get('/api/oea');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.oeas).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    test('should filter by status', async () => {
      oeaService.list.mockResolvedValue({ oeas: [], total: 0 });

      await request(app)
        .get('/api/oea')
        .query({ status: 'approved' });

      expect(oeaService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
        expect.any(Object)
      );
    });
  });

  describe('GET /api/oea/stats', () => {
    test('should return statistics', async () => {
      const mockStats = {
        total: 10,
        byStatus: { approved: 5, pending: 3, suspended: 2 },
        byType: { OEAC: 4, OEAS: 3, OEAF: 3 }
      };

      oeaService.getStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/oea/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(10);
      expect(response.body.data.byStatus.approved).toBe(5);
    });
  });

  describe('GET /api/oea/expiring', () => {
    test('should return expiring certifications', async () => {
      const mockExpiring = [
        { _id: 'oea1', certification: { expirationDate: new Date() } }
      ];

      oeaService.findExpiring.mockResolvedValue(mockExpiring);

      const response = await request(app)
        .get('/api/oea/expiring')
        .query({ days: 90 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(oeaService.findExpiring).toHaveBeenCalledWith(90);
    });

    test('should default to 90 days', async () => {
      oeaService.findExpiring.mockResolvedValue([]);

      await request(app)
        .get('/api/oea/expiring');

      expect(oeaService.findExpiring).toHaveBeenCalledWith(90);
    });
  });

  describe('GET /api/oea/benefits', () => {
    test('should return benefits catalog', async () => {
      const mockBenefits = [
        { code: 'B001', name: 'Benefit 1', category: 'guarantee' }
      ];

      oeaService.getBenefitsCatalog.mockReturnValue(mockBenefits);

      const response = await request(app)
        .get('/api/oea/benefits');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].code).toBe('B001');
    });
  });

  describe('GET /api/oea/simplifications', () => {
    test('should return simplifications list', async () => {
      const mockSimplifications = [
        { code: 'SDE', name: 'Simplified Declaration Entry' }
      ];

      oeaService.getSimplificationsCatalog.mockReturnValue(mockSimplifications);

      const response = await request(app)
        .get('/api/oea/simplifications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].code).toBe('SDE');
    });
  });

  describe('GET /api/oea/mutual-recognition', () => {
    test('should return mutual recognition partners', async () => {
      const mockPartners = [
        { country: 'United States', countryCode: 'US', programName: 'C-TPAT' }
      ];

      oeaService.getMutualRecognitionPartners.mockReturnValue(mockPartners);

      const response = await request(app)
        .get('/api/oea/mutual-recognition');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].countryCode).toBe('US');
    });
  });

  describe('GET /api/oea/info', () => {
    test('should return system information', async () => {
      const response = await request(app)
        .get('/api/oea/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.module).toBe('LUCI OEA Module');
      expect(response.body.data.certificationTypes).toBeDefined();
      expect(response.body.data.certificationTypes.OEAC).toBeDefined();
    });
  });

  describe('GET /api/oea/:id', () => {
    test('should return OEA by ID', async () => {
      const mockOEA = {
        _id: 'oea123',
        organization: { name: 'Test Company' }
      };

      oeaService.getById.mockResolvedValue(mockOEA);

      const response = await request(app)
        .get('/api/oea/oea123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe('oea123');
    });

    test('should return 404 for non-existent OEA', async () => {
      oeaService.getById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/oea/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/oea/eori/:eori', () => {
    test('should return OEA by EORI', async () => {
      const mockOEA = {
        _id: 'oea123',
        organization: { eori: 'ESA12345678000' }
      };

      oeaService.getByEORI.mockResolvedValue(mockOEA);

      const response = await request(app)
        .get('/api/oea/eori/ESA12345678000');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // getByEORI(eori, userId): sin auth en este test, userId llega undefined.
      expect(oeaService.getByEORI).toHaveBeenCalledWith('ESA12345678000', undefined);
    });
  });

  describe('GET /api/oea/nif/:nif', () => {
    test('should return OEA by NIF', async () => {
      const mockOEA = {
        _id: 'oea123',
        organization: { nif: 'A12345678' }
      };

      oeaService.getByNIF.mockResolvedValue(mockOEA);

      const response = await request(app)
        .get('/api/oea/nif/A12345678');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // getByNIF(nif, userId): sin auth en este test, userId llega undefined.
      expect(oeaService.getByNIF).toHaveBeenCalledWith('A12345678', undefined);
    });
  });

  describe('POST /api/oea/:id/submit', () => {
    test('should submit for review', async () => {
      const mockOEA = {
        _id: 'oea123',
        certification: { status: 'under_review' }
      };

      oeaService.submitForReview.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea/oea123/submit');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.certification.status).toBe('under_review');
    });
  });

  describe('POST /api/oea/:id/approve', () => {
    test('should approve certification', async () => {
      const mockOEA = {
        _id: 'oea123',
        certification: { status: 'approved', number: 'ES/OEA/123' }
      };

      oeaService.approve.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea/oea123/approve')
        .send({
          approvedBy: 'Admin User',
          effectiveDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.certification.status).toBe('approved');
    });

    test('should return 400 for missing approvedBy', async () => {
      const response = await request(app)
        .post('/api/oea/oea123/approve')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('approvedBy');
    });
  });

  describe('POST /api/oea/:id/suspend', () => {
    test('should suspend certification', async () => {
      const mockOEA = {
        _id: 'oea123',
        certification: { status: 'suspended' }
      };

      oeaService.suspend.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea/oea123/suspend')
        .send({ reason: 'Compliance issues' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 400 for missing reason', async () => {
      const response = await request(app)
        .post('/api/oea/oea123/suspend')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('motivo');
    });
  });

  describe('POST /api/oea/:id/revoke', () => {
    test('should revoke certification', async () => {
      const mockOEA = {
        _id: 'oea123',
        certification: { status: 'revoked' }
      };

      oeaService.revoke.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea/oea123/revoke')
        .send({ reason: 'Serious violations' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/oea/:id/renewal/initiate', () => {
    test('should initiate renewal process', async () => {
      const mockOEA = {
        _id: 'oea123',
        certification: { status: 'renewal_pending' }
      };

      oeaService.initiateRenewal.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea/oea123/renewal/initiate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.certification.status).toBe('renewal_pending');
    });
  });

  describe('POST /api/oea/:id/audits', () => {
    test('should add audit record', async () => {
      const mockOEA = {
        _id: 'oea123',
        audits: [{ type: 'internal', result: 'passed' }]
      };

      oeaService.addAudit.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea/oea123/audits')
        .send({
          date: new Date().toISOString(),
          type: 'internal',
          result: 'passed',
          auditor: { name: 'Auditor Name' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 400 for missing audit date', async () => {
      const response = await request(app)
        .post('/api/oea/oea123/audits')
        .send({ type: 'internal' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/oea/:id/requirements/:requirement', () => {
    test('should update requirement status', async () => {
      const mockOEA = {
        _id: 'oea123',
        requirements: {
          customsCompliance: { status: 'met' }
        }
      };

      oeaService.updateRequirement.mockResolvedValue(mockOEA);

      const response = await request(app)
        .put('/api/oea/oea123/requirements/customsCompliance')
        .send({ status: 'met', notes: 'Verified' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 400 for invalid requirement', async () => {
      oeaService.updateRequirement.mockRejectedValue(new Error('Requisito no valido: invalidRequirement'));

      const response = await request(app)
        .put('/api/oea/oea123/requirements/invalidRequirement')
        .send({ status: 'met' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/oea/:id/simplifications', () => {
    test('should grant simplification', async () => {
      const mockOEA = {
        _id: 'oea123',
        simplifications: [{ code: 'SDE', active: true }]
      };

      oeaService.grantSimplification.mockResolvedValue(mockOEA);

      const response = await request(app)
        .post('/api/oea/oea123/simplifications')
        .send({ code: 'SDE' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 400 for missing code', async () => {
      const response = await request(app)
        .post('/api/oea/oea123/simplifications')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/oea/:id/guarantee-reduction', () => {
    test('should calculate guarantee reduction', async () => {
      const mockResult = {
        applicable: true,
        originalAmount: 10000,
        reducedAmount: 5000,
        reductionPercentage: 50
      };

      oeaService.calculateGuaranteeReduction.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/oea/oea123/guarantee-reduction')
        .send({ amount: 10000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reducedAmount).toBe(5000);
    });
  });
});
