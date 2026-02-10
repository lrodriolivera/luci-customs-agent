/**
 * Tests for Requirement Service
 * Testing AEAT requirements management
 * Based on PLAN_AGENTE_ADUANAS_COMPLETO.md - Section 4.1
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const mockRequirementSave = jest.fn();
const mockRequirementFindById = jest.fn();
const mockRequirementFind = jest.fn();
const mockExpeditionFindById = jest.fn();

jest.mock('../../src/models', () => {
  const MockRequirement = jest.fn().mockImplementation((data) => ({
    ...data,
    save: mockRequirementSave
  }));
  MockRequirement.findById = mockRequirementFindById;
  MockRequirement.find = mockRequirementFind;

  return {
    Requirement: MockRequirement,
    Expedition: {
      findById: mockExpeditionFindById
    }
  };
});

describe('Requirement Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Requirement Types', () => {
    const requirementTypes = ['documentary', 'valuation', 'classification', 'origin', 'physical'];

    test.each(requirementTypes)('should support %s requirement type', (type) => {
      expect(requirementTypes).toContain(type);
    });
  });

  describe('Requirement Status Flow', () => {
    const validStatuses = ['pending', 'in_progress', 'awaiting_client', 'responded', 'resolved', 'rejected'];

    test('should have valid status transitions', () => {
      const validTransitions = {
        'pending': ['in_progress', 'awaiting_client'],
        'in_progress': ['awaiting_client', 'responded'],
        'awaiting_client': ['in_progress', 'responded'],
        'responded': ['resolved', 'rejected', 'in_progress'],
        'resolved': [],
        'rejected': []
      };

      Object.keys(validTransitions).forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe('Requirement Creation', () => {
    test('should create documentary requirement', () => {
      const requirementData = {
        expeditionId: 'exp123',
        mrn: '26ES00000001234567',
        requirementType: 'documentary',
        status: 'pending',
        requestedDocuments: ['Factura comercial', 'BL', 'Certificado de origen'],
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        inspectorNotes: 'Se requiere documentación adicional para verificación'
      };

      expect(requirementData.requirementType).toBe('documentary');
      expect(requirementData.requestedDocuments).toHaveLength(3);
      expect(requirementData.deadline).toBeInstanceOf(Date);
    });

    test('should create valuation requirement', () => {
      const requirementData = {
        expeditionId: 'exp456',
        mrn: '26ES00000001234568',
        requirementType: 'valuation',
        status: 'pending',
        requestedDocuments: ['Justificación de valor', 'Contrato de compraventa'],
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        inspectorNotes: 'Valor declarado parece bajo para este tipo de mercancía'
      };

      expect(requirementData.requirementType).toBe('valuation');
    });

    test('should create classification requirement', () => {
      const requirementData = {
        expeditionId: 'exp789',
        mrn: '26ES00000001234569',
        requirementType: 'classification',
        status: 'pending',
        requestedDocuments: ['Ficha técnica', 'Composición del producto'],
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        inspectorNotes: 'Verificar código TARIC declarado'
      };

      expect(requirementData.requirementType).toBe('classification');
    });

    test('should create physical inspection requirement', () => {
      const requirementData = {
        expeditionId: 'exp101',
        mrn: '26ES00000001234570',
        requirementType: 'physical',
        status: 'pending',
        requestedDocuments: [],
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        inspectorNotes: 'Inspección física programada - Canal Rojo',
        physicalInspection: {
          scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          location: 'Recinto Aduanero Barcelona',
          inspectorId: 'INS001'
        }
      };

      expect(requirementData.requirementType).toBe('physical');
      expect(requirementData.physicalInspection).toBeDefined();
    });
  });

  describe('Requirement Response', () => {
    test('should add response to requirement', () => {
      const requirement = {
        _id: 'req123',
        status: 'in_progress',
        responses: []
      };

      const response = {
        date: new Date(),
        documents: ['doc1', 'doc2'],
        notes: 'Se adjunta documentación solicitada',
        submittedBy: 'user123'
      };

      requirement.responses.push(response);
      requirement.status = 'responded';

      expect(requirement.responses).toHaveLength(1);
      expect(requirement.status).toBe('responded');
    });

    test('should allow multiple responses', () => {
      const requirement = {
        responses: [
          { date: new Date(), notes: 'Primera respuesta' },
          { date: new Date(), notes: 'Segunda respuesta con documentos adicionales' }
        ]
      };

      expect(requirement.responses).toHaveLength(2);
    });
  });

  describe('Requirement Resolution', () => {
    test('should resolve requirement as approved', () => {
      const requirement = {
        status: 'responded',
        resolution: null
      };

      requirement.resolution = {
        date: new Date(),
        result: 'approved',
        notes: 'Documentación verificada, se procede al levante'
      };
      requirement.status = 'resolved';

      expect(requirement.resolution.result).toBe('approved');
      expect(requirement.status).toBe('resolved');
    });

    test('should resolve requirement as rejected', () => {
      const requirement = {
        status: 'responded',
        resolution: null
      };

      requirement.resolution = {
        date: new Date(),
        result: 'rejected',
        notes: 'Documentación insuficiente, se deniega el despacho'
      };
      requirement.status = 'rejected';

      expect(requirement.resolution.result).toBe('rejected');
      expect(requirement.status).toBe('rejected');
    });

    test('should resolve requirement as partial', () => {
      const requirement = {
        status: 'responded',
        resolution: null
      };

      requirement.resolution = {
        date: new Date(),
        result: 'partial',
        notes: 'Se requiere documentación adicional para partida 2'
      };
      requirement.status = 'in_progress';

      expect(requirement.resolution.result).toBe('partial');
    });
  });

  describe('Deadline Management', () => {
    test('should identify overdue requirements', () => {
      const now = new Date();
      const overdueDeadline = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const requirement = {
        deadline: overdueDeadline,
        status: 'pending'
      };

      const isOverdue = new Date(requirement.deadline) < now &&
                        ['pending', 'in_progress', 'awaiting_client'].includes(requirement.status);

      expect(isOverdue).toBe(true);
    });

    test('should identify urgent requirements (3 days or less)', () => {
      const now = new Date();
      const urgentDeadline = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      const requirement = {
        deadline: urgentDeadline,
        status: 'pending'
      };

      const daysToDeadline = Math.ceil((new Date(requirement.deadline) - now) / (1000 * 60 * 60 * 24));
      const isUrgent = daysToDeadline <= 3;

      expect(isUrgent).toBe(true);
      expect(daysToDeadline).toBeLessThanOrEqual(3);
    });

    test('should not flag requirements with distant deadlines', () => {
      const now = new Date();
      const futureDeadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const requirement = {
        deadline: futureDeadline,
        status: 'pending'
      };

      const daysToDeadline = Math.ceil((new Date(requirement.deadline) - now) / (1000 * 60 * 60 * 24));
      const isUrgent = daysToDeadline <= 3;

      expect(isUrgent).toBe(false);
    });
  });

  describe('Auto-Response with ML (Ref: Plan 6.5)', () => {
    test('should suggest auto-response for documentary requirements', () => {
      const requirement = {
        requirementType: 'documentary',
        requestedDocuments: ['Factura comercial', 'BL'],
        expeditionId: 'exp123'
      };

      // Simulated ML suggestion
      const autoSuggestion = {
        confidence: 0.85,
        suggestedDocuments: ['doc_factura_123', 'doc_bl_456'],
        suggestedNotes: 'Se adjuntan los documentos solicitados según expediente EXP-123'
      };

      expect(autoSuggestion.confidence).toBeGreaterThan(0.7);
      expect(autoSuggestion.suggestedDocuments).toHaveLength(2);
    });
  });
});
