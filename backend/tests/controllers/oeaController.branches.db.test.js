/**
 * OEA Controller - Tests de cobertura de ramas
 *
 * OBJETIVO: Subir cobertura de ramas sin tocar logica de negocio
 * SCOPE: Probar todas las validaciones, formatos de respuesta, manejo de errores
 *
 * AISLAMIENTO: Las OEA usan createdBy para ownership (ver _loadOwnedOEA en service)
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const oeaController = require('../../src/controllers/oeaController');
const OEA = require('../../src/models/OEA');
const User = require('../../src/models/User');
const oeaService = require('../../src/services/oeaService');

// Configurar base de datos en memoria
usarBaseDeDatosEnMemoria();

// Crear app de prueba
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Middleware que inyecta req.user (simulando auth)
  app.use((req, res, next) => {
    if (req.headers['x-user-id']) {
      req.user = {
        _id: req.headers['x-user-id'],
        id: req.headers['x-user-id']
      };
    }
    next();
  });

  // Rutas
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
  app.post('/api/oea/:id/audit', oeaController.addAudit);
  app.put('/api/oea/:id/requirements/:requirementKey', oeaController.updateRequirement);
  app.post('/api/oea/:id/compliance', oeaController.addComplianceRecord);
  app.post('/api/oea/:id/simplifications/:code', oeaController.grantSimplification);
  app.post('/api/oea/:id/calculate-guarantee', oeaController.calculateGuaranteeReduction);
  app.post('/api/oea/:id/alerts/:alertId/acknowledge', oeaController.acknowledgeAlert);
  app.post('/api/oea/:id/alerts/:alertId/resolve', oeaController.resolveAlert);

  return app;
}

describe('OEA Controller - Branch Coverage', () => {
  let app;
  let userA;
  let userB;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await OEA.deleteMany({});
    await User.deleteMany({});

    // Crear usuarios de test
    userA = await User.create({
      email: 'usera@test.com',
      password: 'Test1234!',
      name: 'User A',
      role: 'admin'
    });

    userB = await User.create({
      email: 'userb@test.com',
      password: 'Test1234!',
      name: 'User B',
      role: 'agent'
    });
  });

  describe('POST /api/oea - create', () => {
    test('should validate missing organization.nif', async () => {
      const response = await request(app)
        .post('/api/oea')
        .set('x-user-id', userA._id.toString())
        .send({
          organization: {
            name: 'Test Company',
            eori: 'ESA12345678'
          },
          certification: { type: 'OEAC' }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('organization.nif');
    });

    test('should validate missing organization.eori', async () => {
      const response = await request(app)
        .post('/api/oea')
        .set('x-user-id', userA._id.toString())
        .send({
          organization: {
            name: 'Test Company',
            nif: 'B22477020'
          },
          certification: { type: 'OEAC' }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('organization.eori');
    });

    test('should validate missing certification.type', async () => {
      const response = await request(app)
        .post('/api/oea')
        .set('x-user-id', userA._id.toString())
        .send({
          organization: {
            name: 'Test Company',
            nif: 'B22477020',
            eori: 'ESB22477020'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('certification.type');
    });

    test('should validate invalid certification type', async () => {
      const response = await request(app)
        .post('/api/oea')
        .set('x-user-id', userA._id.toString())
        .send({
          organization: {
            name: 'Test Company',
            nif: 'B22477020',
            eori: 'ESB22477020'
          },
          certification: { type: 'INVALID' }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('invalido');
      expect(response.body.error).toContain('OEAC');
      expect(response.body.error).toContain('OEAS');
      expect(response.body.error).toContain('OEAF');
    });

    test('should return 409 for duplicate application', async () => {
      const data = {
        organization: {
          name: 'Test Company',
          nif: 'B22477020',
          eori: 'ESB22477020'
        },
        certification: { type: 'OEAC' }
      };

      // Primera creación exitosa
      await request(app)
        .post('/api/oea')
        .set('x-user-id', userA._id.toString())
        .send(data);

      // Segunda creación debería fallar
      const response = await request(app)
        .post('/api/oea')
        .set('x-user-id', userA._id.toString())
        .send(data);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ya tiene');
    });

    test('should default userId to system when no user', async () => {
      // Mock service para este test específico
      const mockOEA = {
        _id: new mongoose.Types.ObjectId(),
        organization: {
          name: 'Test Company',
          nif: 'B22477020',
          eori: 'ESB22477020'
        },
        certification: { type: 'OEAC', status: 'pending' }
      };

      jest.spyOn(oeaService, 'createApplication').mockResolvedValueOnce(mockOEA);

      const response = await request(app)
        .post('/api/oea')
        .send({
          organization: {
            name: 'Test Company',
            nif: 'B22477020',
            eori: 'ESB22477020'
          },
          certification: { type: 'OEAC' }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(oeaService.createApplication).toHaveBeenCalledWith(
        expect.any(Object),
        'system' // userId default
      );

      jest.restoreAllMocks();
    });
  });

  describe('GET /api/oea - list', () => {
    test('should handle result with oeas format', async () => {
      await OEA.create({
        organization: {
          name: 'Company 1',
          nif: 'A11111111',
          eori: 'ESA11111111'
        },
        certification: { type: 'OEAC', status: 'pending' },
        createdBy: userA._id
      });

      const response = await request(app)
        .get('/api/oea')
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.oeas).toBeDefined();
      expect(response.body.data.total).toBeDefined();
    });

    test('should handle result with data format (alternate)', async () => {
      const response = await request(app)
        .get('/api/oea')
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/oea')
        .query({ page: 2, limit: 10 })
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(200);
    });

    test('should handle error in list', async () => {
      // Forzar error con ObjectId inválido en query
      jest.spyOn(oeaService, 'list').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/oea')
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('GET /api/oea/expiring', () => {
    test('should handle null return from findExpiring', async () => {
      jest.spyOn(oeaService, 'findExpiring').mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/oea/expiring');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);

      jest.restoreAllMocks();
    });

    test('should parse days parameter', async () => {
      const response = await request(app)
        .get('/api/oea/expiring')
        .query({ days: '60' });

      expect(response.status).toBe(200);
    });

    test('should handle error in getExpiring', async () => {
      jest.spyOn(oeaService, 'findExpiring').mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .get('/api/oea/expiring');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('GET /api/oea/simplifications', () => {
    test('should get simplifications without type parameter', async () => {
      const response = await request(app)
        .get('/api/oea/simplifications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should get simplifications with type parameter', async () => {
      const response = await request(app)
        .get('/api/oea/simplifications')
        .query({ type: 'OEAC' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle error in getSimplifications', async () => {
      jest.spyOn(oeaService, 'getSimplificationsCatalog').mockImplementationOnce(() => {
        throw new Error('Catalog error');
      });

      const response = await request(app)
        .get('/api/oea/simplifications');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('GET /api/oea/:id - getById', () => {
    test('should return 404 when OEA not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/oea/${fakeId}`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('no encontrada');
    });

    test('should handle error in getById', async () => {
      jest.spyOn(oeaService, 'getById').mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .get('/api/oea/invalid-id')
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('GET /api/oea/eori/:eori - getByEORI', () => {
    test('should return 404 when EORI not found', async () => {
      const response = await request(app)
        .get('/api/oea/eori/ESA99999999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('EORI');
    });

    test('should handle error in getByEORI', async () => {
      jest.spyOn(oeaService, 'getByEORI').mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .get('/api/oea/eori/ESA12345678');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('GET /api/oea/nif/:nif - getByNIF', () => {
    test('should return 404 when NIF not found', async () => {
      const response = await request(app)
        .get('/api/oea/nif/B99999999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('NIF');
    });

    test('should handle error in getByNIF', async () => {
      jest.spyOn(oeaService, 'getByNIF').mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .get('/api/oea/nif/A12345678');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('PUT /api/oea/:id - update', () => {
    test('should return 404 when updating non-existent OEA', async () => {
      jest.spyOn(oeaService, 'update').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/oea/${fakeId}`)
        .set('x-user-id', userA._id.toString())
        .send({ organization: { name: 'Updated Name' } });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 500 for other errors', async () => {
      jest.spyOn(oeaService, 'update').mockRejectedValueOnce(new Error('DB error'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/oea/${fakeId}`)
        .set('x-user-id', userA._id.toString())
        .send({ organization: { name: 'Updated Name' } });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should default userId to system when no user', async () => {
      const mockOEA = {
        _id: new mongoose.Types.ObjectId(),
        organization: {
          name: 'Updated Name',
          nif: 'B22477020',
          eori: 'ESB22477020'
        },
        certification: { type: 'OEAC', status: 'pending' }
      };

      jest.spyOn(oeaService, 'update').mockResolvedValueOnce(mockOEA);

      const response = await request(app)
        .put(`/api/oea/${mockOEA._id}`)
        .send({ organization: { name: 'Updated Name' } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(oeaService.update).toHaveBeenCalledWith(
        mockOEA._id.toString(),
        expect.any(Object),
        'system' // userId default
      );

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/submit - submitForReview', () => {
    test('should return 404 when submitting non-existent OEA', async () => {
      jest.spyOn(oeaService, 'submitForReview').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/submit`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 400 for other errors', async () => {
      jest.spyOn(oeaService, 'submitForReview').mockRejectedValueOnce(new Error('Invalid state'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/submit`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/approve - approve', () => {
    test('should validate missing approvedBy', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/approve`)
        .set('x-user-id', userA._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('approvedBy');
    });

    test('should return 404 when approving non-existent OEA', async () => {
      jest.spyOn(oeaService, 'approve').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/approve`)
        .set('x-user-id', userA._id.toString())
        .send({ approvedBy: 'Admin' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 400 for validation errors', async () => {
      jest.spyOn(oeaService, 'approve').mockRejectedValueOnce(new Error('Estado invalido'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/approve`)
        .set('x-user-id', userA._id.toString())
        .send({ approvedBy: 'Admin' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should include certification type and number in success message', async () => {
      const mockOEA = {
        _id: new mongoose.Types.ObjectId(),
        certification: {
          type: 'OEAC',
          number: 'ES/OEA/123/2026'
        }
      };

      jest.spyOn(oeaService, 'approve').mockResolvedValueOnce(mockOEA);

      const response = await request(app)
        .post(`/api/oea/${mockOEA._id}/approve`)
        .set('x-user-id', userA._id.toString())
        .send({ approvedBy: 'Admin' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('OEAC');
      expect(response.body.message).toContain('ES/OEA/123/2026');

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/suspend - suspend', () => {
    test('should validate missing reason', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/suspend`)
        .set('x-user-id', userA._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('motivo');
    });

    test('should return 404 when suspending non-existent OEA', async () => {
      jest.spyOn(oeaService, 'suspend').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/suspend`)
        .set('x-user-id', userA._id.toString())
        .send({ reason: 'Compliance issues' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 400 for other errors', async () => {
      jest.spyOn(oeaService, 'suspend').mockRejectedValueOnce(new Error('Invalid state'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/suspend`)
        .set('x-user-id', userA._id.toString())
        .send({ reason: 'Compliance issues' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/revoke - revoke', () => {
    test('should validate missing reason', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/revoke`)
        .set('x-user-id', userA._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('motivo');
    });

    test('should handle error in revoke', async () => {
      jest.spyOn(oeaService, 'revoke').mockRejectedValueOnce(new Error('DB error'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/revoke`)
        .set('x-user-id', userA._id.toString())
        .send({ reason: 'Serious violations' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/renewal/initiate - initiateRenewal', () => {
    test('should return 404 when initiating renewal for non-existent OEA', async () => {
      jest.spyOn(oeaService, 'initiateRenewal').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/renewal/initiate`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 400 for validation errors', async () => {
      jest.spyOn(oeaService, 'initiateRenewal').mockRejectedValueOnce(new Error('Invalid state'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/renewal/initiate`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/renewal/complete - completeRenewal', () => {
    test('should complete renewal successfully', async () => {
      const mockOEA = {
        _id: new mongoose.Types.ObjectId(),
        certification: { status: 'approved' }
      };

      jest.spyOn(oeaService, 'completeRenewal').mockResolvedValueOnce(mockOEA);

      const response = await request(app)
        .post(`/api/oea/${mockOEA._id}/renewal/complete`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Renovacion completada');

      jest.restoreAllMocks();
    });

    test('should return 404 when completing renewal for non-existent OEA', async () => {
      jest.spyOn(oeaService, 'completeRenewal').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/renewal/complete`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 400 for validation errors', async () => {
      jest.spyOn(oeaService, 'completeRenewal').mockRejectedValueOnce(new Error('Invalid state'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/renewal/complete`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/audit - addAudit', () => {
    test('should validate missing type', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/audit`)
        .set('x-user-id', userA._id.toString())
        .send({ result: 'passed' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('type');
      expect(response.body.error).toContain('result');
    });

    test('should validate missing result', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/audit`)
        .set('x-user-id', userA._id.toString())
        .send({ type: 'internal' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('type');
      expect(response.body.error).toContain('result');
    });

    test('should return 404 when adding audit to non-existent OEA', async () => {
      jest.spyOn(oeaService, 'addAudit').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/audit`)
        .set('x-user-id', userA._id.toString())
        .send({ type: 'internal', result: 'passed' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 500 for other errors', async () => {
      jest.spyOn(oeaService, 'addAudit').mockRejectedValueOnce(new Error('DB error'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/audit`)
        .set('x-user-id', userA._id.toString())
        .send({ type: 'internal', result: 'passed' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('PUT /api/oea/:id/requirements/:requirementKey - updateRequirement', () => {
    test('should validate invalid status', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/oea/${fakeId}/requirements/customsCompliance`)
        .set('x-user-id', userA._id.toString())
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('invalido');
      expect(response.body.error).toContain('met');
      expect(response.body.error).toContain('partial');
      expect(response.body.error).toContain('not_met');
      expect(response.body.error).toContain('not_applicable');
    });

    test('should return 404 when updating requirement of non-existent OEA', async () => {
      jest.spyOn(oeaService, 'updateRequirement').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/oea/${fakeId}/requirements/customsCompliance`)
        .set('x-user-id', userA._id.toString())
        .send({ status: 'met' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 400 for validation errors', async () => {
      jest.spyOn(oeaService, 'updateRequirement').mockRejectedValueOnce(new Error('Invalid requirement'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/oea/${fakeId}/requirements/invalidRequirement`)
        .set('x-user-id', userA._id.toString())
        .send({ status: 'met' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/compliance - addComplianceRecord', () => {
    test('should add compliance record successfully', async () => {
      const mockOEA = {
        _id: new mongoose.Types.ObjectId(),
        compliance: [{ period: { year: 2026, quarter: 1 } }]
      };

      jest.spyOn(oeaService, 'addComplianceRecord').mockResolvedValueOnce(mockOEA);

      const response = await request(app)
        .post(`/api/oea/${mockOEA._id}/compliance`)
        .set('x-user-id', userA._id.toString())
        .send({ period: { year: 2026, quarter: 1 } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cumplimiento agregado');

      jest.restoreAllMocks();
    });

    test('should validate missing period.year', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/compliance`)
        .set('x-user-id', userA._id.toString())
        .send({ period: { quarter: 1 } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('period.year');
      expect(response.body.error).toContain('period.quarter');
    });

    test('should validate missing period.quarter', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/compliance`)
        .set('x-user-id', userA._id.toString())
        .send({ period: { year: 2026 } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('period.year');
      expect(response.body.error).toContain('period.quarter');
    });

    test('should return 404 when adding compliance to non-existent OEA', async () => {
      jest.spyOn(oeaService, 'addComplianceRecord').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/compliance`)
        .set('x-user-id', userA._id.toString())
        .send({ period: { year: 2026, quarter: 1 } });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 500 for other errors', async () => {
      jest.spyOn(oeaService, 'addComplianceRecord').mockRejectedValueOnce(new Error('DB error'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/compliance`)
        .set('x-user-id', userA._id.toString())
        .send({ period: { year: 2026, quarter: 1 } });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/simplifications/:code - grantSimplification', () => {
    test('should validate missing code', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/simplifications/SDE`)
        .set('x-user-id', userA._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('code');
    });

    test('should return 404 when granting simplification to non-existent OEA', async () => {
      jest.spyOn(oeaService, 'grantSimplification').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/simplifications/SDE`)
        .set('x-user-id', userA._id.toString())
        .send({ code: 'SDE' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 400 for validation errors', async () => {
      jest.spyOn(oeaService, 'grantSimplification').mockRejectedValueOnce(new Error('Invalid code'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/simplifications/INVALID`)
        .set('x-user-id', userA._id.toString())
        .send({ code: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should include code in success message', async () => {
      const mockOEA = {
        _id: new mongoose.Types.ObjectId()
      };

      jest.spyOn(oeaService, 'grantSimplification').mockResolvedValueOnce(mockOEA);

      const response = await request(app)
        .post(`/api/oea/${mockOEA._id}/simplifications/SDE`)
        .set('x-user-id', userA._id.toString())
        .send({ code: 'SDE' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('SDE');

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/calculate-guarantee - calculateGuaranteeReduction', () => {
    test('should validate missing amount', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/calculate-guarantee`)
        .set('x-user-id', userA._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('amount');
    });

    test('should validate amount less than or equal to 0', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/calculate-guarantee`)
        .set('x-user-id', userA._id.toString())
        .send({ amount: 0 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('mayor que 0');
    });

    test('should validate negative amount', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/calculate-guarantee`)
        .set('x-user-id', userA._id.toString())
        .send({ amount: -100 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('mayor que 0');
    });

    test('should handle error in calculateGuaranteeReduction', async () => {
      jest.spyOn(oeaService, 'calculateGuaranteeReduction').mockRejectedValueOnce(new Error('Calculation error'));

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/calculate-guarantee`)
        .set('x-user-id', userA._id.toString())
        .send({ amount: 10000 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/alerts/:alertId/acknowledge - acknowledgeAlert', () => {
    test('should acknowledge alert successfully', async () => {
      const mockOEA = {
        _id: new mongoose.Types.ObjectId()
      };

      jest.spyOn(oeaService, 'acknowledgeAlert').mockResolvedValueOnce(mockOEA);

      const alertId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${mockOEA._id}/alerts/${alertId}/acknowledge`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('confirmada');

      jest.restoreAllMocks();
    });

    test('should return 404 when acknowledging alert of non-existent OEA', async () => {
      jest.spyOn(oeaService, 'acknowledgeAlert').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const alertId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/alerts/${alertId}/acknowledge`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 500 for other errors', async () => {
      jest.spyOn(oeaService, 'acknowledgeAlert').mockRejectedValueOnce(new Error('DB error'));

      const fakeId = new mongoose.Types.ObjectId();
      const alertId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/alerts/${alertId}/acknowledge`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('POST /api/oea/:id/alerts/:alertId/resolve - resolveAlert', () => {
    test('should resolve alert successfully', async () => {
      const mockOEA = {
        _id: new mongoose.Types.ObjectId()
      };

      jest.spyOn(oeaService, 'resolveAlert').mockResolvedValueOnce(mockOEA);

      const alertId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${mockOEA._id}/alerts/${alertId}/resolve`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resuelta');

      jest.restoreAllMocks();
    });

    test('should return 404 when resolving alert of non-existent OEA', async () => {
      jest.spyOn(oeaService, 'resolveAlert').mockRejectedValueOnce(new Error('Certificacion no encontrada'));

      const fakeId = new mongoose.Types.ObjectId();
      const alertId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/alerts/${alertId}/resolve`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should return 500 for other errors', async () => {
      jest.spyOn(oeaService, 'resolveAlert').mockRejectedValueOnce(new Error('DB error'));

      const fakeId = new mongoose.Types.ObjectId();
      const alertId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/oea/${fakeId}/alerts/${alertId}/resolve`)
        .set('x-user-id', userA._id.toString());

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('GET /api/oea/info - getInfo', () => {
    test('should return complete system information', async () => {
      const response = await request(app)
        .get('/api/oea/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.module).toBe('LUCI OEA Module');
      expect(response.body.data.version).toBeDefined();
      expect(response.body.data.certificationTypes).toBeDefined();
      expect(response.body.data.certificationTypes.OEAC).toBeDefined();
      expect(response.body.data.certificationTypes.OEAS).toBeDefined();
      expect(response.body.data.certificationTypes.OEAF).toBeDefined();
      expect(response.body.data.requirements).toBeDefined();
      expect(response.body.data.validityPeriod).toBeDefined();
      expect(response.body.data.authority).toBeDefined();
      expect(response.body.data.legislation).toBeDefined();
    });

  });

  describe('Error handling for catalog endpoints', () => {
    test('should handle error in getStats', async () => {
      jest.spyOn(oeaService, 'getStats').mockRejectedValueOnce(new Error('Stats error'));

      const response = await request(app)
        .get('/api/oea/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should handle error in getBenefitsCatalog', async () => {
      jest.spyOn(oeaService, 'getBenefitsCatalog').mockImplementationOnce(() => {
        throw new Error('Catalog error');
      });

      const response = await request(app)
        .get('/api/oea/benefits');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });

    test('should handle error in getMutualRecognition', async () => {
      jest.spyOn(oeaService, 'getMutualRecognitionPartners').mockImplementationOnce(() => {
        throw new Error('Recognition error');
      });

      const response = await request(app)
        .get('/api/oea/mutual-recognition');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('Tenant isolation - ownership checks', () => {
    test('should prevent user B from accessing user A OEA by ID', async () => {
      // getById(id, userId) filtra por createdBy: si el userId no es el dueño,
      // devuelve null → 404. Evita revelar la existencia y filtrar NIF/EORI (RGPD).
      const oeaA = await OEA.create({
        organization: {
          name: 'Company A',
          nif: 'A11111111',
          eori: 'ESA11111111'
        },
        certification: { type: 'OEAC', status: 'approved' },
        createdBy: userA._id
      });

      const response = await request(app)
        .get(`/api/oea/${oeaA._id}`)
        .set('x-user-id', userB._id.toString());

      // 404 (no encontrada) para no revelar que existe ni exponer datos cross-tenant.
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should prevent user B from accessing user A OEA by EORI', async () => {
      // BUG: Similar al anterior - getByEORI no filtra por ownership
      const oeaA = await OEA.create({
        organization: {
          name: 'Company A',
          nif: 'A11111111',
          eori: 'ESA11111111'
        },
        certification: { type: 'OEAC', status: 'approved' },
        createdBy: userA._id
      });

      const response = await request(app)
        .get(`/api/oea/eori/${oeaA.organization.eori}`)
        .set('x-user-id', userB._id.toString());

      // getByEORI(eori, userId) filtra por createdBy → 404 para otro tenant.
      expect(response.status).toBe(404);
    });

    test('should prevent user B from accessing user A OEA by NIF', async () => {
      // BUG: Similar - getByNIF no filtra por ownership
      const oeaA = await OEA.create({
        organization: {
          name: 'Company A',
          nif: 'A11111111',
          eori: 'ESA11111111'
        },
        certification: { type: 'OEAC', status: 'approved' },
        createdBy: userA._id
      });

      const response = await request(app)
        .get(`/api/oea/nif/${oeaA.organization.nif}`)
        .set('x-user-id', userB._id.toString());

      // getByNIF(nif, userId) filtra por createdBy → 404 (el NIF es dato RGPD).
      expect(response.status).toBe(404);
    });

    test('should filter list endpoint by user ownership', async () => {
      await OEA.create({
        organization: {
          name: 'Company A',
          nif: 'A11111111',
          eori: 'ESA11111111'
        },
        certification: { type: 'OEAC', status: 'approved' },
        createdBy: userA._id
      });

      await OEA.create({
        organization: {
          name: 'Company B',
          nif: 'B22222222',
          eori: 'ESB22222222'
        },
        certification: { type: 'OEAS', status: 'approved' },
        createdBy: userB._id
      });

      const response = await request(app)
        .get('/api/oea')
        .set('x-user-id', userB._id.toString());

      expect(response.status).toBe(200);
      // El list pasa userId al service, que lo usa para filtrar
      // Verificamos que solo ve sus propias OEAs
      const oeas = response.body.data.oeas || response.body.data.data;
      expect(oeas.length).toBe(1);
      expect(oeas[0].organization.nif).toBe('B22222222');
    });
  });
});
