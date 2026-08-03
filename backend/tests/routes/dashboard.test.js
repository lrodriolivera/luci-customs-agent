/**
 * Tests for Dashboard Routes
 * Testing alerts and statistics endpoints
 * Based on PLAN_AGENTE_ADUANAS_COMPLETO.md
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const mockRequirementFind = jest.fn();
const mockExpeditionFind = jest.fn();
const mockGuaranteeFind = jest.fn();
const mockSpecialRegimeFind = jest.fn();
const mockParaduaneroControlFind = jest.fn();
const mockExpeditionAggregate = jest.fn();
const mockRequirementAggregate = jest.fn();
const mockGuaranteeAggregate = jest.fn();

jest.mock('../../src/models', () => ({
  Requirement: {
    find: mockRequirementFind,
    aggregate: mockRequirementAggregate
  },
  Expedition: {
    find: mockExpeditionFind,
    aggregate: mockExpeditionAggregate
  },
  Guarantee: {
    find: mockGuaranteeFind,
    aggregate: mockGuaranteeAggregate
  },
  SpecialRegime: {
    find: mockSpecialRegimeFind
  },
  ParaduaneroControl: {
    find: mockParaduaneroControlFind
  }
}));

// El router exige auth desde que se cerro /api/dashboard, que respondia sin
// token (ver commit de rutas admin/analytics/dashboard/integrations/ml). Aqui
// se sustituye por un middleware que inyecta un usuario, para seguir probando
// la logica del dashboard y no la autenticacion.
jest.mock('../../src/middleware/auth', () => ({
  auth: (req, _res, next) => {
    req.user = { _id: 'u1', role: 'admin', tenantId: 't1' };
    req.tenantId = 't1';
    next();
  },
  authenticate: (req, _res, next) => next(),
  requireRole: () => (req, _res, next) => next()
}));

const request = require('supertest');
const express = require('express');
const dashboardRoutes = require('../../src/routes/dashboard');

const app = express();
app.use(express.json());
app.use('/api/dashboard', dashboardRoutes);

describe('Dashboard Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/dashboard/alerts', () => {
    test('should return empty alerts when no issues', async () => {
      // Mock all queries to return empty arrays
      mockRequirementFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockExpeditionFind.mockResolvedValue([]);
      mockGuaranteeFind.mockResolvedValue([]);
      mockSpecialRegimeFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockParaduaneroControlFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      const response = await request(app)
        .get('/api/dashboard/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toEqual([]);
      expect(response.body.data.stats.total).toBe(0);
    });

    test('should return urgent requirement alerts', async () => {
      const urgentReq = {
        _id: 'req123',
        requirementNumber: 'REQ-2026-001',
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        createdAt: new Date(),
        expeditionId: {
          _id: 'exp123',
          expeditionId: 'EXP-001',
          client: { companyName: 'Test Company' }
        }
      };

      mockRequirementFind
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([urgentReq])
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([])
        });
      mockExpeditionFind.mockResolvedValue([]);
      mockGuaranteeFind.mockResolvedValue([]);
      mockSpecialRegimeFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockParaduaneroControlFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      const response = await request(app)
        .get('/api/dashboard/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts.length).toBeGreaterThan(0);
      expect(response.body.data.alerts[0].type).toBe('requirement_deadline');
    });

    test('should return overdue requirement alerts as critical', async () => {
      const overdueReq = {
        _id: 'req456',
        requirementNumber: 'REQ-2026-002',
        deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        createdAt: new Date(),
        expeditionId: {
          _id: 'exp456',
          expedientId: 'EXP-002',
          client: { companyName: 'Another Company' }
        }
      };

      mockRequirementFind
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([])
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([overdueReq])
        });
      mockExpeditionFind.mockResolvedValue([]);
      mockGuaranteeFind.mockResolvedValue([]);
      mockSpecialRegimeFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockParaduaneroControlFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      const response = await request(app)
        .get('/api/dashboard/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      const overdueAlert = response.body.data.alerts.find(a => a.type === 'requirement_overdue');
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert.severity).toBe('critical');
    });

    test('should return red channel alerts as critical', async () => {
      const redChannelExp = {
        _id: 'exp789',
        expeditionId: 'EXP-003',
        status: 'red_channel',
        declaration: {
          channel: 'red',
          channelAssignedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
        },
        client: { companyName: 'Red Channel Co' }
      };

      mockRequirementFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockExpeditionFind.mockResolvedValue([redChannelExp]);
      mockGuaranteeFind.mockResolvedValue([]);
      mockSpecialRegimeFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockParaduaneroControlFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      const response = await request(app)
        .get('/api/dashboard/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      const redChannelAlert = response.body.data.alerts.find(a => a.type === 'red_channel_pending');
      expect(redChannelAlert).toBeDefined();
      expect(redChannelAlert.severity).toBe('critical');
    });

    test('should return low balance guarantee alerts', async () => {
      const lowBalanceGuarantee = {
        _id: 'guar123',
        guaranteeNumber: 'GUAR-001',
        amount: 10000,
        balance: { available: 500 }, // 5% available
        updatedAt: new Date()
      };

      mockRequirementFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockExpeditionFind.mockResolvedValue([]);
      mockGuaranteeFind
        .mockResolvedValueOnce([lowBalanceGuarantee])
        .mockResolvedValueOnce([]);
      mockSpecialRegimeFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockParaduaneroControlFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      const response = await request(app)
        .get('/api/dashboard/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      const guaranteeAlert = response.body.data.alerts.find(a => a.type === 'guarantee_low_balance');
      expect(guaranteeAlert).toBeDefined();
      expect(guaranteeAlert.severity).toBe('critical');
    });

    test('should sort alerts by severity (critical first)', async () => {
      const criticalReq = {
        _id: 'req1',
        requirementNumber: 'REQ-CRIT',
        deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        expeditionId: { _id: 'exp1' }
      };
      const warningReq = {
        _id: 'req2',
        requirementNumber: 'REQ-WARN',
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        expeditionId: { _id: 'exp2' }
      };

      mockRequirementFind
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([warningReq])
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([criticalReq])
        });
      mockExpeditionFind.mockResolvedValue([]);
      mockGuaranteeFind.mockResolvedValue([]);
      mockSpecialRegimeFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      mockParaduaneroControlFind.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      const response = await request(app)
        .get('/api/dashboard/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts[0].severity).toBe('critical');
    });
  });

  describe('GET /api/dashboard/stats', () => {
    test('should return consolidated statistics', async () => {
      mockExpeditionAggregate.mockResolvedValue([{
        total: [{ count: 100 }],
        byStatus: [
          { _id: 'green_channel', count: 80 },
          { _id: 'orange_channel', count: 15 },
          { _id: 'red_channel', count: 5 }
        ],
        byChannel: [
          { _id: 'green', count: 80 },
          { _id: 'orange', count: 15 },
          { _id: 'red', count: 5 }
        ],
        thisMonth: [{ count: 25 }],
        pendingDocs: [{ count: 3 }]
      }]);

      mockRequirementAggregate.mockResolvedValue([{
        total: [{ count: 50 }],
        pending: [{ count: 10 }],
        resolved: [{ count: 35 }],
        overdue: [{ count: 5 }]
      }]);

      mockGuaranteeAggregate.mockResolvedValue([{
        active: [{ count: 5 }],
        totalAmount: [{ total: 500000, available: 350000 }]
      }]);

      const response = await request(app)
        .get('/api/dashboard/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expeditions.total).toBe(100);
      expect(response.body.data.expeditions.thisMonth).toBe(25);
      expect(response.body.data.requirements.total).toBe(50);
      expect(response.body.data.requirements.overdue).toBe(5);
      expect(response.body.data.guarantees.active).toBe(5);
    });

    test('should handle empty database', async () => {
      mockExpeditionAggregate.mockResolvedValue([{
        total: [],
        byStatus: [],
        byChannel: [],
        thisMonth: [],
        pendingDocs: []
      }]);

      mockRequirementAggregate.mockResolvedValue([{
        total: [],
        pending: [],
        resolved: [],
        overdue: []
      }]);

      mockGuaranteeAggregate.mockResolvedValue([{
        active: [],
        totalAmount: []
      }]);

      const response = await request(app)
        .get('/api/dashboard/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expeditions.total).toBe(0);
      expect(response.body.data.requirements.total).toBe(0);
      expect(response.body.data.guarantees.active).toBe(0);
    });
  });
});
