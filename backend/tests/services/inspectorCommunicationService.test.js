/**
 * Tests for Inspector Communication Service
 * Comunicacion con Inspectores - Alegaciones y Recursos
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const inspectorCommunicationService = require('../../src/services/inspectorCommunicationService');
const InspectorCommunication = require('../../src/models/InspectorCommunication');
const Deadline = require('../../src/models/Deadline');
const deadlineService = require('../../src/services/deadlineService');

// Mock solo deadlineService (frontera) y logger
jest.mock('../../src/services/deadlineService');
jest.mock('../../src/config/logger');

// Stubs de modelos relacionados para evitar errores de populate
const UserSchema = new mongoose.Schema({
  name: String,
  email: String
});

const ExpeditionSchema = new mongoose.Schema({
  reference: String,
  clientName: String
});

const RequirementSchema = new mongoose.Schema({
  requirementNumber: String
});

// Registrar modelos stub solo si no existen
if (!mongoose.models.User) {
  mongoose.model('User', UserSchema);
}
if (!mongoose.models.Expedition) {
  mongoose.model('Expedition', ExpeditionSchema);
}
if (!mongoose.models.Requirement) {
  mongoose.model('Requirement', RequirementSchema);
}

describe('Inspector Communication Service', () => {
  usarBaseDeDatosEnMemoria();

  describe('Configuration', () => {
    test('should have communication types defined', () => {
      const types = inspectorCommunicationService.getCommunicationTypes();

      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);

      // Check common types exist
      const typeValues = types.map(t => t.value);
      expect(typeValues).toContain('requirement_response');
      expect(typeValues).toContain('allegation');
      expect(typeValues).toContain('administrative_appeal');
      expect(typeValues).toContain('economic_appeal');
      expect(typeValues).toContain('judicial_appeal');
    });

    test('should have authorities defined', () => {
      const authorities = inspectorCommunicationService.getAuthorities();

      expect(authorities).toBeDefined();
      expect(Array.isArray(authorities)).toBe(true);
      expect(authorities.length).toBeGreaterThan(0);

      // Check common authorities exist (uses 'code' field)
      const authorityCodes = authorities.map(a => a.code);
      expect(authorityCodes).toContain('AEAT');
      expect(authorityCodes).toContain('SOIVRE');
      expect(authorityCodes).toContain('MAPA');
      expect(authorityCodes).toContain('SANIDAD');
    });

    test('should have templates defined', () => {
      const templates = inspectorCommunicationService.getTemplates();

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      // Check template structure
      templates.forEach(template => {
        expect(template.type).toBeDefined();
        expect(template.subject).toBeDefined();
        expect(template.opening).toBeDefined();
        expect(template.closing).toBeDefined();
      });
    });
  });

  describe('Communication Type Configuration', () => {
    test('should return config for requirement_response', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('requirement_response');

      expect(config).toBeDefined();
      expect(config.description).toContain('Respuesta');
      expect(config.legalBasis).toBeDefined();
      expect(config.defaultDeadlineDays).toBeDefined();
      expect(config.defaultDeadlineDays).toBeGreaterThan(0);
    });

    test('should return config for allegation', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('allegation');

      expect(config).toBeDefined();
      expect(config.description).toContain('Alegacion');
      expect(config.legalBasis).toBeDefined();
    });

    test('should return config for administrative_appeal', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('administrative_appeal');

      expect(config).toBeDefined();
      expect(config.description).toContain('Recurso');
      expect(config.legalBasis).toBeDefined();
      expect(config.defaultDeadlineDays).toBeDefined();
    });

    test('should return config for economic_appeal', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('economic_appeal');

      expect(config).toBeDefined();
      expect(config.description).toContain('Reclamación');
      expect(config.legalBasis).toBeDefined();
    });

    test('should return null for unknown type', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('unknown');

      expect(config).toBeNull();
    });
  });

  describe('Authority Configuration', () => {
    test('AEAT should have proper configuration', () => {
      const authorities = inspectorCommunicationService.getAuthorities();
      const aeat = authorities.find(a => a.code === 'AEAT');

      expect(aeat).toBeDefined();
      expect(aeat.name).toContain('Tributaria');
      expect(aeat.offices).toBeDefined();
      expect(Array.isArray(aeat.offices)).toBe(true);
    });

    test('paraduanero authorities should be defined', () => {
      const authorities = inspectorCommunicationService.getAuthorities();
      const paraduaneros = ['SOIVRE', 'MAPA', 'SANIDAD', 'MITERD'];

      paraduaneros.forEach(code => {
        const authority = authorities.find(a => a.code === code);
        expect(authority).toBeDefined();
        expect(authority.name).toBeDefined();
      });
    });

    test('economic administrative tribunals should be defined', () => {
      const authorities = inspectorCommunicationService.getAuthorities();
      const tribunals = ['TEAR', 'TEAC'];

      tribunals.forEach(code => {
        const authority = authorities.find(a => a.code === code);
        expect(authority).toBeDefined();
        expect(authority.name).toContain('Tribunal');
      });
    });
  });

  describe('Templates', () => {
    test('should have templates for allegation', () => {
      const templates = inspectorCommunicationService.getTemplates();
      const allegationTemplate = templates.find(t => t.type === 'allegation');

      expect(allegationTemplate).toBeDefined();
      expect(allegationTemplate.subject).toBeDefined();
    });

    test('should have templates for appeals', () => {
      const templates = inspectorCommunicationService.getTemplates();
      const appealTemplates = templates.filter(t =>
        t.type === 'administrative_appeal' || t.type === 'economic_appeal'
      );

      expect(appealTemplates.length).toBeGreaterThan(0);
    });

    test('templates should have subject and opening/closing', () => {
      const templates = inspectorCommunicationService.getTemplates();

      templates.forEach(template => {
        expect(template.subject).toBeDefined();
        expect(template.opening).toBeDefined();
        expect(template.closing).toBeDefined();
      });
    });
  });

  describe('Deadline Calculation', () => {
    test('should calculate deadline for requirement response', () => {
      const notificationDate = new Date('2024-03-01');
      // Note: method signature is (notificationDate, communicationType)
      const deadline = inspectorCommunicationService.calculateAppealDeadline(
        notificationDate,
        'requirement_response'
      );

      expect(deadline).toBeDefined();
      expect(deadline instanceof Date).toBe(true);
      expect(deadline > notificationDate).toBe(true);
    });

    test('should calculate deadline for administrative appeal (30 days)', () => {
      const notificationDate = new Date('2024-03-01');
      const deadline = inspectorCommunicationService.calculateAppealDeadline(
        notificationDate,
        'administrative_appeal'
      );

      expect(deadline).toBeDefined();
      expect(deadline instanceof Date).toBe(true);
      // Administrative appeal is 30 days
      const diffDays = Math.round((deadline - notificationDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(30);
    });

    test('should calculate deadline for economic appeal (30 days)', () => {
      const notificationDate = new Date('2024-03-01');
      const deadline = inspectorCommunicationService.calculateAppealDeadline(
        notificationDate,
        'economic_appeal'
      );

      expect(deadline).toBeDefined();
      expect(deadline > notificationDate).toBe(true);
    });

    test('should return null for types without deadline', () => {
      const notificationDate = new Date('2024-03-01');
      const deadline = inspectorCommunicationService.calculateAppealDeadline(
        notificationDate,
        'information_request' // This type has defaultDeadlineDays: null
      );

      expect(deadline).toBeNull();
    });

    test('should adjust deadline if falls on weekend', () => {
      // Friday March 8, 2024 + 10 days = Monday March 18 (should skip weekend)
      const notificationDate = new Date('2024-03-08');
      const deadline = inspectorCommunicationService.calculateAppealDeadline(
        notificationDate,
        'requirement_response' // 10 days
      );

      expect(deadline).toBeDefined();
      // Should not fall on Saturday (6) or Sunday (0)
      expect(deadline.getDay()).not.toBe(0);
      expect(deadline.getDay()).not.toBe(6);
    });

    test('debe retornar null para tipo inexistente', () => {
      const notificationDate = new Date('2024-03-01');
      const deadline = inspectorCommunicationService.calculateAppealDeadline(
        notificationDate,
        'nonexistent_type'
      );

      expect(deadline).toBeNull();
    });
  });

  describe('Draft Generation', () => {
    test('should generate draft for requirement response', () => {
      const draft = inspectorCommunicationService.generateDraft('requirement_response', {
        requirementNumber: 'REQ-2024-001'
      });

      expect(draft).toBeDefined();
      expect(draft.subject).toContain('REQ-2024-001');
      expect(draft.content).toBeDefined();
      expect(draft.template).toBe('requirement_response');
    });

    test('should generate draft for allegation', () => {
      const draft = inspectorCommunicationService.generateDraft('allegation', {
        expedientNumber: 'EXP-2024-001'
      });

      expect(draft).toBeDefined();
      expect(draft.subject).toContain('Alegaciones');
      expect(draft.content).toContain('ALEGACIONES');
    });

    test('should generate draft for administrative appeal', () => {
      const draft = inspectorCommunicationService.generateDraft('administrative_appeal', {
        resolutionNumber: 'RES-2024-001'
      });

      expect(draft).toBeDefined();
      expect(draft.subject).toContain('Recurso de Reposición');
      expect(draft.content).toContain('RECURSO DE REPOSICIÓN');
    });

    test('should return empty content for unknown template', () => {
      const draft = inspectorCommunicationService.generateDraft('unknown_type', {});

      expect(draft).toBeDefined();
      expect(draft.content).toBe('');
    });

    test('debe usar subject de data si template no existe', () => {
      const draft = inspectorCommunicationService.generateDraft('nonexistent', {
        subject: 'Custom subject'
      });

      expect(draft.subject).toBe('Custom subject');
      expect(draft.content).toBe('');
    });

    test('debe manejar valores undefined en reemplazo de variables', () => {
      const draft = inspectorCommunicationService.generateDraft('requirement_response', {
        requirementNumber: undefined,
        otherField: null
      });

      expect(draft.subject).toBeDefined();
      // Los valores undefined/null se reemplazan por cadena vacía
      expect(draft.subject).not.toContain('undefined');
      expect(draft.subject).not.toContain('null');
    });
  });

  describe('Service Information', () => {
    test('should return service info', () => {
      const info = inspectorCommunicationService.getInfo();

      expect(info).toBeDefined();
      expect(info.service).toBe('Inspector Communication Service');
      expect(info.version).toBeDefined();
      expect(info.communicationTypes).toBeGreaterThan(0);
      expect(info.authorities).toBeGreaterThan(0);
      expect(info.templates).toBeGreaterThan(0);
    });
  });

  describe('Legal Basis', () => {
    test('requirement response should reference LGT', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('requirement_response');

      expect(config.legalBasis).toBeDefined();
      expect(config.legalBasis).toMatch(/LGT|Ley General Tributaria/i);
    });

    test('administrative appeal should reference LGT articles', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('administrative_appeal');

      expect(config.legalBasis).toBeDefined();
      expect(config.legalBasis).toMatch(/LGT|Art\./i);
    });

    test('economic appeal should reference LGT', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('economic_appeal');

      expect(config.legalBasis).toBeDefined();
      expect(config.legalBasis).toMatch(/LGT/i);
    });

    test('judicial appeal should reference LJCA', () => {
      const config = inspectorCommunicationService.getCommunicationTypeConfig('judicial_appeal');

      expect(config.legalBasis).toBeDefined();
      expect(config.legalBasis).toMatch(/LJCA|29\/1998|contencioso/i);
    });
  });

  describe('Communication Categories', () => {
    test('responses should have response category', () => {
      const responseTypes = ['requirement_response', 'clarification', 'notification_response'];

      responseTypes.forEach(type => {
        const config = inspectorCommunicationService.getCommunicationTypeConfig(type);
        expect(config.category).toBe('response');
      });
    });

    test('appeals should have appeal category', () => {
      const appealTypes = ['allegation', 'administrative_appeal', 'economic_appeal', 'judicial_appeal'];

      appealTypes.forEach(type => {
        const config = inspectorCommunicationService.getCommunicationTypeConfig(type);
        expect(config.category).toBe('appeal');
      });
    });

    test('requests should have request category', () => {
      const requestTypes = ['information_request', 'voluntary_rectification', 'prior_consultation'];

      requestTypes.forEach(type => {
        const config = inspectorCommunicationService.getCommunicationTypeConfig(type);
        expect(config.category).toBe('request');
      });
    });
  });

  describe('Appeal Hierarchy', () => {
    test('allegation should have shorter deadline than appeals', () => {
      const allegationConfig = inspectorCommunicationService.getCommunicationTypeConfig('allegation');
      const adminAppealConfig = inspectorCommunicationService.getCommunicationTypeConfig('administrative_appeal');

      expect(allegationConfig.defaultDeadlineDays).toBeLessThan(adminAppealConfig.defaultDeadlineDays);
    });

    test('judicial appeal should have longest deadline', () => {
      const judicialConfig = inspectorCommunicationService.getCommunicationTypeConfig('judicial_appeal');
      const economicConfig = inspectorCommunicationService.getCommunicationTypeConfig('economic_appeal');

      expect(judicialConfig.defaultDeadlineDays).toBeGreaterThan(economicConfig.defaultDeadlineDays);
    });
  });

  describe('Within Deadline Check', () => {
    test('should return true if within deadline', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

      const result = inspectorCommunicationService.isWithinDeadline(
        recentDate,
        'administrative_appeal' // 30 days
      );

      expect(result).toBe(true);
    });

    test('should return false if past deadline', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60); // 60 days ago

      const result = inspectorCommunicationService.isWithinDeadline(
        oldDate,
        'administrative_appeal' // 30 days
      );

      expect(result).toBe(false);
    });

    test('should return true if no deadline defined', () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() - 1); // 1 year ago

      const result = inspectorCommunicationService.isWithinDeadline(
        date,
        'information_request' // No deadline
      );

      expect(result).toBe(true);
    });
  });

  // ==============================================================
  // TESTS CON MONGO REAL - CREACIÓN Y GESTIÓN DE COMUNICACIONES
  // ==============================================================

  describe('Creación de comunicaciones (Mongo real)', () => {
    let userId;
    let expeditionId;
    let requirementId;

    beforeEach(() => {
      userId = new mongoose.Types.ObjectId();
      expeditionId = new mongoose.Types.ObjectId();
      requirementId = new mongoose.Types.ObjectId();

      // Mock deadlineService.create para que no falle
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    });

    test('debe crear comunicación básica con datos mínimos', async () => {
      const data = {
        communicationType: 'requirement_response',
        subject: 'Respuesta a requerimiento REQ-001',
        authority: {
          type: 'AEAT',
          name: 'Aduana de Barcelona'
        }
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm).toBeDefined();
      expect(comm.communicationType).toBe('requirement_response');
      expect(comm.subject).toBe('Respuesta a requerimiento REQ-001');
      expect(comm.createdBy).toEqual(userId);
      expect(comm.communicationNumber).toMatch(/^COM-REQ-\d{4}-\d{5}$/);
      expect(comm.category).toBe('response'); // Auto-asignado por config
      expect(comm.status).toBe('draft');
    });

    test('debe crear comunicación con deadline automático según tipo', async () => {
      const data = {
        communicationType: 'administrative_appeal',
        subject: 'Recurso de reposición',
        authority: { type: 'AEAT' }
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm.deadlines.submissionDeadline).toBeDefined();
      expect(comm.deadlines.submissionDeadline instanceof Date).toBe(true);

      // Administrative appeal tiene 30 días
      const now = new Date();
      const diffDays = Math.ceil((comm.deadlines.submissionDeadline - now) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);

      // Debe haber llamado a deadlineService.create
      expect(deadlineService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deadlineType: 'appeal_deadline',
          category: 'requirement'
        }),
        userId
      );
    });

    test('debe respetar deadline manual si se proporciona', async () => {
      const manualDeadline = new Date('2026-12-31');
      const data = {
        communicationType: 'clarification',
        subject: 'Aclaración',
        authority: { type: 'SOIVRE' },
        deadlines: {
          submissionDeadline: manualDeadline
        }
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm.deadlines.submissionDeadline).toEqual(manualDeadline);
    });

    test('debe incluir legal basis del tipo de comunicación', async () => {
      const data = {
        communicationType: 'allegation',
        subject: 'Alegaciones',
        authority: { type: 'AEAT' }
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm.legalBasis).toBeDefined();
      expect(comm.legalBasis.length).toBeGreaterThan(0);
      expect(comm.legalBasis[0].law).toMatch(/LGT/);
    });

    test('debe crear comunicación sin userId (jobs automáticos)', async () => {
      const data = {
        communicationType: 'information_request',
        subject: 'Solicitud automática',
        authority: { type: 'MAPA' }
      };

      const comm = await inspectorCommunicationService.create(data, null);

      expect(comm).toBeDefined();
      // Mongoose devuelve null para campos no establecidos, no undefined
      expect(comm.createdBy).toBeNull();
    });

    test('debe fallar si falta subject (required)', async () => {
      const data = {
        communicationType: 'allegation',
        authority: { type: 'AEAT' }
        // Falta subject
      };

      await expect(inspectorCommunicationService.create(data, userId)).rejects.toThrow();
    });

    test('debe fallar si falta authority.type (required)', async () => {
      const data = {
        communicationType: 'allegation',
        subject: 'Test',
        authority: {}
        // Falta authority.type
      };

      await expect(inspectorCommunicationService.create(data, userId)).rejects.toThrow();
    });

    test('debe usar category proporcionada en data en vez de la del tipo', async () => {
      const data = {
        communicationType: 'requirement_response',
        subject: 'Test category override',
        authority: { type: 'AEAT' },
        category: 'other' // Override explícito
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm.category).toBe('other');
    });

    test('debe usar legalBasis proporcionada en data', async () => {
      const customLegalBasis = [
        { law: 'Ley Custom 1/2026', description: 'Custom legal basis' }
      ];

      const data = {
        communicationType: 'allegation',
        subject: 'Test legal basis override',
        authority: { type: 'AEAT' },
        legalBasis: customLegalBasis
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm.legalBasis.length).toBe(1);
      expect(comm.legalBasis[0].law).toBe('Ley Custom 1/2026');
      expect(comm.legalBasis[0].description).toBe('Custom legal basis');
    });

    test('debe crear comunicación sin deadline si tipo no tiene defaultDeadlineDays', async () => {
      const data = {
        communicationType: 'information_request', // Este tipo tiene defaultDeadlineDays: null
        subject: 'Solicitud sin deadline',
        authority: { type: 'AEAT' }
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm.deadlines.submissionDeadline).toBeUndefined();
      // No debe haber llamado a deadlineService.create
      expect(deadlineService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          deadlineType: 'appeal_deadline'
        }),
        userId
      );
    });

    test('debe manejar tipo de comunicación sin configuración (unknown type)', async () => {
      // Necesito un tipo que devuelva null en getCommunicationTypeConfig
      // Los tipos válidos tienen config, así que esto forzará el fallback 'other'
      const data = {
        communicationType: 'other',
        subject: 'Comunicación tipo other',
        authority: { type: 'AEAT' }
      };

      const comm = await inspectorCommunicationService.create(data, userId);

      expect(comm.category).toBe('other'); // Fallback final
      expect(comm.legalBasis).toEqual([]); // Sin legalBasis porque typeConfig es null
    });

    test('debe crear deadline con fallback "Comunicación" si typeConfig es null', async () => {
      const manualDeadline = new Date('2027-01-15');
      const data = {
        communicationType: 'other', // Sin config
        subject: 'Test deadline sin config',
        authority: { type: 'AEAT' },
        deadlines: {
          submissionDeadline: manualDeadline
        }
      };

      await inspectorCommunicationService.create(data, userId);

      // Verificar que se llamó a deadlineService.create con fallback
      expect(deadlineService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Comunicación')
        }),
        userId
      );
    });

    test('debe incluir referencias en el deadline creado', async () => {
      const expeditionId = new mongoose.Types.ObjectId();
      const requirementId = new mongoose.Types.ObjectId();

      const data = {
        communicationType: 'administrative_appeal',
        subject: 'Con referencias',
        authority: { type: 'AEAT' },
        references: {
          expeditionId,
          requirementId
        }
      };

      await inspectorCommunicationService.create(data, userId);

      expect(deadlineService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          references: {
            expeditionId,
            requirementId
          }
        }),
        userId
      );
    });

    test('debe manejar error al crear comunicación', async () => {
      // Forzar error con datos inválidos
      const data = {
        communicationType: 'allegation',
        // Falta subject (required)
        authority: { type: 'AEAT' }
      };

      await expect(
        inspectorCommunicationService.create(data, userId)
      ).rejects.toThrow();
    });

    test('debe propagar error de deadlineService.create', async () => {
      // Mock para que deadlineService.create falle
      deadlineService.create.mockRejectedValueOnce(new Error('Deadline service error'));

      const data = {
        communicationType: 'administrative_appeal', // Tiene deadline automático
        subject: 'Test error deadline',
        authority: { type: 'AEAT' }
      };

      await expect(
        inspectorCommunicationService.create(data, userId)
      ).rejects.toThrow('Deadline service error');
    });
  });

  describe('createRequirementResponse', () => {
    let userId;
    let requirement;

    beforeEach(() => {
      userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      requirement = {
        _id: new mongoose.Types.ObjectId(),
        expeditionId: new mongoose.Types.ObjectId(),
        requirementNumber: 'REQ-2026-001',
        mrn: '26ES123456789012345',
        issuingAuthority: 'AEAT',
        customsOffice: {
          code: '0001',
          name: 'Aduana de Barcelona'
        },
        inspector: {
          name: 'Juan Pérez',
          email: 'juan.perez@aeat.es'
        },
        deadline: new Date('2026-09-01'),
        client: {
          name: 'Test Client SL',
          nif: 'B12345678'
        },
        assignedTo: new mongoose.Types.ObjectId()
      };
    });

    test('debe crear respuesta a requerimiento con todos los datos heredados', async () => {
      const responseData = {
        description: 'Se adjunta la documentación solicitada'
      };

      const comm = await inspectorCommunicationService.createRequirementResponse(
        requirement,
        responseData,
        userId
      );

      expect(comm).toBeDefined();
      expect(comm.communicationType).toBe('requirement_response');
      expect(comm.subject).toContain('REQ-2026-001');
      expect(comm.references.expeditionId).toEqual(requirement.expeditionId);
      expect(comm.references.requirementId).toEqual(requirement._id);
      expect(comm.externalReferences.mrn).toBe('26ES123456789012345');
      expect(comm.externalReferences.requirementNumber).toBe('REQ-2026-001');
      expect(comm.authority.type).toBe('AEAT');
      expect(comm.authority.office).toBe('0001');
      expect(comm.inspector.name).toBe('Juan Pérez');
      expect(comm.deadlines.submissionDeadline).toEqual(requirement.deadline);
      expect(comm.client.name).toBe('Test Client SL');
    });

    test('debe crear respuesta sin userId', async () => {
      const comm = await inspectorCommunicationService.createRequirementResponse(
        requirement,
        {},
        null
      );

      expect(comm).toBeDefined();
      expect(comm.createdBy).toBeNull();
    });

    test('debe usar AEAT por defecto si issuingAuthority no está definido', async () => {
      const minimalRequirement = {
        _id: new mongoose.Types.ObjectId(),
        expeditionId: new mongoose.Types.ObjectId(),
        requirementNumber: 'REQ-MIN-001',
        mrn: '26ES999999999999999'
        // Sin issuingAuthority, customsOffice, inspector, client, etc.
      };

      const comm = await inspectorCommunicationService.createRequirementResponse(
        minimalRequirement,
        {},
        userId
      );

      expect(comm.authority.type).toBe('AEAT');
      expect(comm.client).toEqual({});
    });

    test('debe manejar requirement sin customsOffice', async () => {
      const reqWithoutOffice = {
        ...requirement,
        customsOffice: undefined
      };
      delete reqWithoutOffice.customsOffice;

      const comm = await inspectorCommunicationService.createRequirementResponse(
        reqWithoutOffice,
        {},
        userId
      );

      expect(comm.authority.office).toBeUndefined();
      expect(comm.authority.name).toBeUndefined();
    });

    test('debe manejar requirement sin client', async () => {
      const reqWithoutClient = {
        ...requirement,
        client: undefined
      };
      delete reqWithoutClient.client;

      const comm = await inspectorCommunicationService.createRequirementResponse(
        reqWithoutClient,
        {},
        userId
      );

      expect(comm.client).toEqual({});
    });
  });

  describe('createAllegation', () => {
    let userId;

    beforeEach(() => {
      userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    });

    test('debe crear alegación correctamente', async () => {
      const data = {
        subject: 'Alegaciones al acta de infracción',
        description: 'Se formulan alegaciones',
        authority: { type: 'AEAT' },
        externalReferences: {
          actaNumber: 'ACTA-001'
        }
      };

      const comm = await inspectorCommunicationService.createAllegation(data, userId);

      expect(comm).toBeDefined();
      expect(comm.communicationType).toBe('allegation');
      expect(comm.category).toBe('appeal');
      expect(comm.subject).toBe('Alegaciones al acta de infracción');
    });

    test('debe crear alegación sin userId', async () => {
      const data = {
        subject: 'Alegación automática',
        authority: { type: 'AEAT' }
      };

      const comm = await inspectorCommunicationService.createAllegation(data, null);

      expect(comm).toBeDefined();
      expect(comm.createdBy).toBeNull();
    });
  });

  describe('createAdministrativeAppeal', () => {
    let userId;

    beforeEach(() => {
      userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    });

    test('debe crear recurso administrativo correctamente', async () => {
      const data = {
        subject: 'Recurso de reposición',
        description: 'Se interpone recurso',
        authority: { type: 'AEAT' },
        externalReferences: {
          resolutionNumber: 'RES-2026-001'
        }
      };

      const comm = await inspectorCommunicationService.createAdministrativeAppeal(data, userId);

      expect(comm).toBeDefined();
      expect(comm.communicationType).toBe('administrative_appeal');
      expect(comm.category).toBe('appeal');
    });

    test('debe crear recurso administrativo sin userId', async () => {
      const data = {
        subject: 'Recurso automático',
        authority: { type: 'AEAT' }
      };

      const comm = await inspectorCommunicationService.createAdministrativeAppeal(data, null);

      expect(comm).toBeDefined();
      expect(comm.createdBy).toBeNull();
    });
  });

  describe('createEconomicAppeal', () => {
    let userId;

    beforeEach(() => {
      userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    });

    test('debe crear recurso económico ante TEAR por defecto', async () => {
      const data = {
        subject: 'Reclamación económico-administrativa',
        description: 'Se formula reclamación',
        externalReferences: {
          resolutionNumber: 'RES-2026-002'
        }
      };

      const comm = await inspectorCommunicationService.createEconomicAppeal(data, userId);

      expect(comm).toBeDefined();
      expect(comm.communicationType).toBe('economic_appeal');
      expect(comm.authority.type).toBe('TEAR');
    });

    test('debe crear recurso económico ante TEAC si toTEAC es true', async () => {
      const data = {
        subject: 'Reclamación ante TEAC',
        description: 'Reclamación central',
        toTEAC: true
      };

      const comm = await inspectorCommunicationService.createEconomicAppeal(data, userId);

      expect(comm).toBeDefined();
      expect(comm.authority.type).toBe('TEAC');
    });

    test('debe crear recurso económico ante TEAR si toTEAC es false', async () => {
      const data = {
        subject: 'Reclamación regional',
        toTEAC: false
      };

      const comm = await inspectorCommunicationService.createEconomicAppeal(data, userId);

      expect(comm.authority.type).toBe('TEAR');
    });

    test('debe crear recurso económico sin userId', async () => {
      const data = {
        subject: 'Recurso automático',
        toTEAC: false
      };

      const comm = await inspectorCommunicationService.createEconomicAppeal(data, null);

      expect(comm).toBeDefined();
      expect(comm.createdBy).toBeNull();
    });
  });

  describe('Consulta de comunicaciones (getById, getByNumber, list)', () => {
    let userId;
    let comm1, comm2, comm3;

    beforeEach(async () => {
      userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      // Crear 3 comunicaciones de prueba
      comm1 = await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Comunicación 1',
        authority: { type: 'AEAT' }
      }, userId);

      comm2 = await inspectorCommunicationService.create({
        communicationType: 'allegation',
        subject: 'Comunicación 2',
        authority: { type: 'SOIVRE' },
        status: 'sent'
      }, userId);

      comm3 = await inspectorCommunicationService.create({
        communicationType: 'administrative_appeal',
        subject: 'Comunicación 3',
        authority: { type: 'MAPA' },
        assignedTo: userId
      }, userId);
    });

    test('getById debe recuperar comunicación por ID', async () => {
      const comm = await inspectorCommunicationService.getById(comm1._id);

      expect(comm).toBeDefined();
      expect(comm._id).toEqual(comm1._id);
      expect(comm.subject).toBe('Comunicación 1');
    });

    test('getById debe retornar null si no existe', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const comm = await inspectorCommunicationService.getById(fakeId);

      expect(comm).toBeNull();
    });

    test('getByNumber debe recuperar comunicación por número', async () => {
      const comm = await inspectorCommunicationService.getByNumber(comm2.communicationNumber);

      expect(comm).toBeDefined();
      expect(comm._id).toEqual(comm2._id);
      expect(comm.subject).toBe('Comunicación 2');
    });

    test('getByNumber debe retornar null si no existe', async () => {
      const comm = await inspectorCommunicationService.getByNumber('COM-XXX-9999-99999');

      expect(comm).toBeNull();
    });

    test('list debe retornar todas las comunicaciones activas', async () => {
      const result = await inspectorCommunicationService.list({}, {});

      expect(result.communications).toBeDefined();
      expect(result.communications.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    test('list debe filtrar por communicationType', async () => {
      const result = await inspectorCommunicationService.list(
        { communicationType: 'allegation' },
        {}
      );

      expect(result.communications.length).toBe(1);
      expect(result.communications[0].communicationType).toBe('allegation');
    });

    test('list debe filtrar por status', async () => {
      const result = await inspectorCommunicationService.list(
        { status: 'sent' },
        {}
      );

      expect(result.communications.length).toBe(1);
      expect(result.communications[0].status).toBe('sent');
    });

    test('list debe paginar correctamente', async () => {
      const result = await inspectorCommunicationService.list(
        {},
        { page: 1, limit: 2 }
      );

      expect(result.communications.length).toBe(2);
      expect(result.total).toBe(3);
      expect(result.pages).toBe(2);
    });

    test('list debe ordenar por campo especificado', async () => {
      const result = await inspectorCommunicationService.list(
        {},
        { sortBy: 'subject', sortOrder: 'asc' }
      );

      expect(result.communications[0].subject).toBe('Comunicación 1');
      expect(result.communications[2].subject).toBe('Comunicación 3');
    });

    test('list debe usar defaults si options está vacío', async () => {
      const result = await inspectorCommunicationService.list({}, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      // Debe ordenar por createdAt desc por defecto
      expect(result.communications).toBeDefined();
    });

    test('list debe calcular páginas correctamente', async () => {
      const result = await inspectorCommunicationService.list({}, { limit: 2 });

      expect(result.pages).toBe(2); // 3 comunicaciones / 2 por página = 2 páginas
    });

    test('list debe funcionar sin argumentos (todos defaults)', async () => {
      const result = await inspectorCommunicationService.list();

      expect(result.communications).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('getPending', () => {
    let user1, user2;

    beforeEach(async () => {
      user1 = new mongoose.Types.ObjectId();
      user2 = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      // Crear comunicaciones en diferentes estados
      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Pendiente 1',
        authority: { type: 'AEAT' },
        assignedTo: user1
      }, user1);

      await inspectorCommunicationService.create({
        communicationType: 'allegation',
        subject: 'Pendiente 2',
        authority: { type: 'AEAT' },
        status: 'pending_review',
        assignedTo: user1
      }, user1);

      await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'Resuelta',
        authority: { type: 'AEAT' },
        status: 'resolved',
        assignedTo: user1
      }, user1);

      await inspectorCommunicationService.create({
        communicationType: 'information_request',
        subject: 'Pendiente otro usuario',
        authority: { type: 'MAPA' },
        assignedTo: user2
      }, user2);
    });

    test('debe retornar comunicaciones pendientes de un usuario', async () => {
      const pending = await inspectorCommunicationService.getPending(user1);

      expect(pending.length).toBe(2);
      // No verifica el every porque populate podría no devolver el ObjectId completo
      expect(pending.some(c => c.status === 'resolved')).toBe(false);
    });

    test('debe retornar todas las pendientes sin filtro de usuario', async () => {
      const pending = await inspectorCommunicationService.getPending(null);

      expect(pending.length).toBe(3);
    });
  });

  describe('getAppeals', () => {
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      await inspectorCommunicationService.create({
        communicationType: 'allegation',
        subject: 'Alegación 1',
        authority: { type: 'AEAT' }
      }, userId);

      await inspectorCommunicationService.create({
        communicationType: 'administrative_appeal',
        subject: 'Recurso 1',
        authority: { type: 'AEAT' },
        status: 'sent'
      }, userId);

      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'No es recurso',
        authority: { type: 'AEAT' }
      }, userId);
    });

    test('debe retornar solo alegaciones y recursos', async () => {
      const appeals = await inspectorCommunicationService.getAppeals();

      expect(appeals.length).toBe(2);
      expect(appeals.every(a => ['allegation', 'administrative_appeal', 'economic_appeal', 'judicial_appeal'].includes(a.communicationType))).toBe(true);
    });

    test('debe filtrar por status', async () => {
      const appeals = await inspectorCommunicationService.getAppeals('sent');

      expect(appeals.length).toBe(1);
      expect(appeals[0].status).toBe('sent');
    });

    test('debe retornar todos los appeals sin filtro de status', async () => {
      const appeals = await inspectorCommunicationService.getAppeals(null);

      expect(appeals.length).toBe(2);
    });
  });

  describe('getOverdue', () => {
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      // Comunicación vencida
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Vencida',
        authority: { type: 'AEAT' },
        deadlines: { submissionDeadline: pastDate }
      }, userId);

      // Comunicación futura
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      await inspectorCommunicationService.create({
        communicationType: 'allegation',
        subject: 'En plazo',
        authority: { type: 'AEAT' },
        deadlines: { submissionDeadline: futureDate }
      }, userId);

      // Comunicación vencida pero ya enviada (no cuenta)
      await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'Vencida pero enviada',
        authority: { type: 'AEAT' },
        status: 'sent',
        deadlines: { submissionDeadline: pastDate }
      }, userId);
    });

    test('debe retornar solo comunicaciones vencidas no enviadas', async () => {
      const overdue = await inspectorCommunicationService.getOverdue();

      expect(overdue.length).toBe(1);
      expect(overdue[0].subject).toBe('Vencida');
    });
  });

  describe('Ownership guard (_loadOwnedComm)', () => {
    let owner, otherUser;
    let comm;

    beforeEach(async () => {
      owner = new mongoose.Types.ObjectId();
      otherUser = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      comm = await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Comunicación con owner',
        authority: { type: 'AEAT' }
      }, owner);
    });

    test('addMessage debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.addMessage(
          comm._id,
          {
            direction: 'outgoing',
            messageType: 'initial',
            content: 'Test'
          },
          otherUser
        )
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('addMessage debe funcionar si userId es el creador', async () => {
      const updated = await inspectorCommunicationService.addMessage(
        comm._id,
        {
          direction: 'outgoing',
          messageType: 'initial',
          content: 'Mensaje válido'
        },
        owner
      );

      expect(updated.messages.length).toBe(1);
      expect(updated.messages[0].content).toBe('Mensaje válido');
    });

    test('addMessage debe funcionar sin userId (jobs)', async () => {
      const updated = await inspectorCommunicationService.addMessage(
        comm._id,
        {
          direction: 'incoming',
          messageType: 'response',
          content: 'Respuesta automática'
        },
        null
      );

      expect(updated.messages.length).toBe(1);
    });

    test('addArgument debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.addArgument(
          comm._id,
          {
            title: 'Argumento 1',
            content: 'Contenido'
          },
          otherUser
        )
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('submit debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.submit(comm._id, otherUser)
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('markDelivered debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.markDelivered(comm._id, 'CONF-001', otherUser)
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('receiveResponse debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.receiveResponse(
          comm._id,
          { content: 'Respuesta' },
          otherUser
        )
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('resolve debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.resolve(
          comm._id,
          { status: 'favorable' },
          otherUser
        )
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('archive debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.archive(comm._id, otherUser)
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('updateStatus debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.updateStatus(comm._id, 'pending_review', '', otherUser)
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('approve debe fallar si userId no es el creador', async () => {
      await expect(
        inspectorCommunicationService.approve(comm._id, otherUser)
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('todos los métodos deben fallar si la comunicación no existe', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        inspectorCommunicationService.addMessage(fakeId, {
          direction: 'outgoing',
          messageType: 'initial',
          content: 'Test'
        }, owner)
      ).rejects.toThrow('Comunicación no encontrada');
    });

    test('comunicación sin createdBy permite acceso a cualquier userId', async () => {
      // Crear comunicación legacy sin createdBy
      const legacyComm = new InspectorCommunication({
        communicationType: 'requirement_response',
        subject: 'Legacy sin owner',
        authority: { type: 'AEAT' },
        category: 'response'
      });
      await legacyComm.save();

      // Cualquier usuario puede acceder
      const updated = await inspectorCommunicationService.addMessage(
        legacyComm._id,
        {
          direction: 'outgoing',
          messageType: 'initial',
          content: 'Mensaje a legacy'
        },
        otherUser
      );

      expect(updated.messages.length).toBe(1);
    });
  });

  describe('Métodos de cambio de estado', () => {
    let userId;
    let comm;

    beforeEach(async () => {
      userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      comm = await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Test',
        authority: { type: 'AEAT' }
      }, userId);
    });

    test('addMessage debe añadir mensaje y actualizar timeline', async () => {
      const updated = await inspectorCommunicationService.addMessage(
        comm._id,
        {
          direction: 'outgoing',
          messageType: 'initial',
          subject: 'Asunto del mensaje',
          content: 'Contenido del mensaje'
        },
        userId
      );

      expect(updated.messages.length).toBe(1);
      expect(updated.messages[0].content).toBe('Contenido del mensaje');
      expect(updated.messages[0].createdBy).toEqual(userId);
      expect(updated.timeline.length).toBeGreaterThan(0);
      expect(updated.timeline[updated.timeline.length - 1].action).toBe('message_sent');
    });

    test('addMessage con dirección incoming debe registrar message_received', async () => {
      const updated = await inspectorCommunicationService.addMessage(
        comm._id,
        {
          direction: 'incoming',
          messageType: 'response',
          content: 'Respuesta de la autoridad'
        },
        userId
      );

      expect(updated.timeline[updated.timeline.length - 1].action).toBe('message_received');
    });

    test('addArgument debe añadir argumento con orden correcto', async () => {
      const updated1 = await inspectorCommunicationService.addArgument(
        comm._id,
        {
          title: 'Primer argumento',
          content: 'Contenido del primer argumento'
        },
        userId
      );

      expect(updated1.arguments.length).toBe(1);
      expect(updated1.arguments[0].order).toBe(1);

      const updated2 = await inspectorCommunicationService.addArgument(
        comm._id,
        {
          title: 'Segundo argumento',
          content: 'Contenido del segundo argumento'
        },
        userId
      );

      expect(updated2.arguments.length).toBe(2);
      expect(updated2.arguments[1].order).toBe(2);
    });

    test('submit debe cambiar estado a sent solo si está en draft o approved', async () => {
      const updated = await inspectorCommunicationService.submit(comm._id, userId);

      expect(updated.status).toBe('sent');
      expect(updated.dates.sentAt).toBeDefined();
      expect(updated.timeline[updated.timeline.length - 1].action).toBe('submitted');
    });

    test('submit debe fallar si no está en draft o approved', async () => {
      comm.status = 'resolved';
      await comm.save();

      await expect(
        inspectorCommunicationService.submit(comm._id, userId)
      ).rejects.toThrow('debe estar aprobada o en borrador');
    });

    test('markDelivered debe cambiar estado a delivered y registrar confirmación', async () => {
      // Primero enviar
      await inspectorCommunicationService.submit(comm._id, userId);

      // Añadir un mensaje outgoing para que tenga algo que confirmar
      await inspectorCommunicationService.addMessage(
        comm._id,
        {
          direction: 'outgoing',
          messageType: 'initial',
          content: 'Mensaje enviado'
        },
        userId
      );

      const updated = await inspectorCommunicationService.markDelivered(
        comm._id,
        'CONF-12345',
        userId
      );

      expect(updated.status).toBe('delivered');
      expect(updated.dates.receivedAt).toBeDefined();

      const lastOutgoing = [...updated.messages].reverse().find(m => m.direction === 'outgoing');
      expect(lastOutgoing.deliveryConfirmation.confirmed).toBe(true);
      expect(lastOutgoing.deliveryConfirmation.confirmationNumber).toBe('CONF-12345');
    });

    test('receiveResponse debe añadir mensaje incoming y cambiar estado', async () => {
      const updated = await inspectorCommunicationService.receiveResponse(
        comm._id,
        {
          content: 'Respuesta de la autoridad',
          subject: 'RE: Comunicación'
        },
        userId
      );

      expect(updated.status).toBe('responded');
      expect(updated.dates.respondedAt).toBeDefined();
      expect(updated.messages.length).toBe(1);
      expect(updated.messages[0].direction).toBe('incoming');
      expect(updated.messages[0].messageType).toBe('response');
    });

    test('resolve debe resolver comunicación y completar deadline asociado', async () => {
      // Crear un deadline asociado
      const deadline = new Deadline({
        deadlineType: 'appeal_deadline',
        category: 'requirement',
        title: `Test: ${comm.communicationNumber}`,
        dueDate: new Date('2026-12-31'),
        references: {
          requirementId: comm.references.requirementId
        },
        status: 'pending'
      });
      await deadline.save();

      const updated = await inspectorCommunicationService.resolve(
        comm._id,
        {
          status: 'favorable',
          summary: 'Resolución favorable'
        },
        userId
      );

      expect(updated.status).toBe('resolved');
      expect(updated.dates.resolvedAt).toBeDefined();
      expect(updated.resolution.status).toBe('favorable');
      expect(updated.resolution.date).toBeDefined();

      // Verificar que el deadline se completó
      const deadlineUpdated = await Deadline.findById(deadline._id);
      expect(deadlineUpdated.status).toBe('completed');
    });

    test('resolve debe funcionar sin deadline asociado', async () => {
      const updated = await inspectorCommunicationService.resolve(
        comm._id,
        {
          status: 'unfavorable',
          summary: 'Desestimado'
        },
        userId
      );

      expect(updated.status).toBe('resolved');
      expect(updated.resolution.status).toBe('unfavorable');
    });

    test('archive debe archivar comunicación', async () => {
      const updated = await inspectorCommunicationService.archive(comm._id, userId);

      expect(updated.status).toBe('archived');
      expect(updated.dates.archivedAt).toBeDefined();
      expect(updated.active).toBe(false);
    });

    test('updateStatus debe actualizar estado y timeline con notes', async () => {
      const updated = await inspectorCommunicationService.updateStatus(
        comm._id,
        'pending_review',
        'Revisión pendiente por supervisor',
        userId
      );

      expect(updated.status).toBe('pending_review');
      expect(updated.timeline[updated.timeline.length - 1].action).toBe('status_updated');
      expect(updated.timeline[updated.timeline.length - 1].description).toContain('Revisión pendiente');
    });

    test('updateStatus debe actualizar estado sin notes', async () => {
      const updated = await inspectorCommunicationService.updateStatus(
        comm._id,
        'in_process',
        '',
        userId
      );

      expect(updated.status).toBe('in_process');
      const lastEntry = updated.timeline[updated.timeline.length - 1];
      expect(lastEntry.description).toBe('Estado actualizado a: in_process');
      expect(lastEntry.description).not.toContain(' - ');
    });

    test('updateStatus debe funcionar con parámetros por defecto', async () => {
      const updated = await inspectorCommunicationService.updateStatus(
        comm._id,
        'awaiting_response'
      );

      expect(updated.status).toBe('awaiting_response');
    });

    test('approve debe aprobar comunicación', async () => {
      const updated = await inspectorCommunicationService.approve(comm._id, userId);

      expect(updated.status).toBe('approved');
      expect(updated.approvedBy).toEqual(userId);
      expect(updated.timeline[updated.timeline.length - 1].action).toBe('approved');
    });

    test('approve debe funcionar sin userId (default null)', async () => {
      const updated = await inspectorCommunicationService.approve(comm._id);

      expect(updated.status).toBe('approved');
      expect(updated.approvedBy).toBeNull();
    });

    test('submit debe funcionar sin userId', async () => {
      const newComm = await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'Test submit sin user',
        authority: { type: 'AEAT' }
      }, userId);

      const updated = await inspectorCommunicationService.submit(newComm._id);

      expect(updated.status).toBe('sent');
    });

    test('markDelivered debe funcionar sin userId', async () => {
      const newComm = await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'Test delivery sin user',
        authority: { type: 'AEAT' }
      }, userId);

      await inspectorCommunicationService.submit(newComm._id, userId);

      const updated = await inspectorCommunicationService.markDelivered(
        newComm._id,
        'AUTO-CONF-123'
      );

      expect(updated.status).toBe('delivered');
    });

    test('receiveResponse debe funcionar sin userId', async () => {
      const updated = await inspectorCommunicationService.receiveResponse(
        comm._id,
        { content: 'Respuesta automática' }
      );

      expect(updated.status).toBe('responded');
    });

    test('resolve debe funcionar sin userId', async () => {
      const newComm = await inspectorCommunicationService.create({
        communicationType: 'inspection_coordination',
        subject: 'Test resolve sin user',
        authority: { type: 'AEAT' }
      }, userId);

      const updated = await inspectorCommunicationService.resolve(
        newComm._id,
        { status: 'favorable' }
      );

      expect(updated.status).toBe('resolved');
    });

    test('archive debe funcionar sin userId', async () => {
      const newComm = await inspectorCommunicationService.create({
        communicationType: 'prior_consultation',
        subject: 'Test archive sin user',
        authority: { type: 'AEAT' }
      }, userId);

      const updated = await inspectorCommunicationService.archive(newComm._id);

      expect(updated.status).toBe('archived');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      // Crear datos variados
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 5);

      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Resp 1',
        authority: { type: 'AEAT' },
        deadlines: { submissionDeadline: pastDeadline }
      }, userId);

      await inspectorCommunicationService.create({
        communicationType: 'allegation',
        subject: 'Aleg 1',
        authority: { type: 'SOIVRE' },
        status: 'awaiting_response'
      }, userId);

      await inspectorCommunicationService.create({
        communicationType: 'administrative_appeal',
        subject: 'Appeal 1',
        authority: { type: 'AEAT' },
        status: 'sent'
      }, userId);
    });

    test('debe retornar estadísticas completas', async () => {
      const stats = await inspectorCommunicationService.getStats();

      expect(stats).toBeDefined();
      expect(stats.byType).toBeDefined();
      expect(stats.byStatus).toBeDefined();
      expect(stats.byCategory).toBeDefined();
      expect(stats.byAuthority).toBeDefined();
      expect(stats.overdue).toBe(1);
      expect(stats.pendingResponse).toBe(1);
      expect(stats.total).toBe(3);
    });

    test('debe filtrar stats por assignedTo', async () => {
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'User1',
        authority: { type: 'MAPA' },
        assignedTo: user1
      }, user1);

      await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'User2',
        authority: { type: 'MAPA' },
        assignedTo: user2
      }, user2);

      const stats = await inspectorCommunicationService.getStats({ assignedTo: user1 });

      expect(stats.total).toBe(1);
    });
  });

  describe('getDashboard', () => {
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 5);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);

      // Pendiente
      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Pendiente',
        authority: { type: 'AEAT' }
      }, userId);

      // Vencida
      await inspectorCommunicationService.create({
        communicationType: 'allegation',
        subject: 'Vencida',
        authority: { type: 'AEAT' },
        deadlines: { submissionDeadline: pastDeadline }
      }, userId);

      // Resuelta recientemente
      const resolved = await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'Resuelta',
        authority: { type: 'AEAT' }
      }, userId);
      await inspectorCommunicationService.resolve(
        resolved._id,
        { status: 'favorable' },
        userId
      );
    });

    test('debe retornar dashboard completo', async () => {
      const dashboard = await inspectorCommunicationService.getDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.stats).toBeDefined();
      expect(dashboard.pending).toBeDefined();
      expect(dashboard.overdue).toBeDefined();
      expect(dashboard.recentResolved).toBeDefined();
      expect(dashboard.summary).toBeDefined();
      expect(dashboard.summary.overdue).toBe(1);
    });

    test('debe filtrar dashboard por usuario', async () => {
      const user1 = new mongoose.Types.ObjectId();

      await inspectorCommunicationService.create({
        communicationType: 'inspection_coordination',
        subject: 'User1 comm',
        authority: { type: 'AEAT' },
        assignedTo: user1
      }, user1);

      const dashboard = await inspectorCommunicationService.getDashboard(user1);

      expect(dashboard.stats.total).toBe(1);
    });

    test('debe manejar stats vacíos en summary', async () => {
      // Crear una suite vacía limpiando todo
      await InspectorCommunication.deleteMany({});

      const dashboard = await inspectorCommunicationService.getDashboard();

      expect(dashboard.stats.total).toBe(0);
      expect(dashboard.summary.overdue).toBe(0);
      expect(dashboard.summary.pendingResponse).toBe(0);
      expect(dashboard.summary.totalAppeals).toBe(0);
    });

    // Regresión del BUG de precedencia de operadores en totalPending:
    // 'a || 0 + b || 0 + ...' se evaluaba como 'a || (0+b) || ...' → primer
    // operando truthy en vez de la SUMA. Con >=2 estados con conteo, el valor
    // buggy (conteo de 'draft') difiere de la suma real. El fix añade paréntesis.
    test('totalPending suma TODOS los estados pendientes, no solo el primero', async () => {
      await InspectorCommunication.deleteMany({});
      const userId = new mongoose.Types.ObjectId();

      // 2 en draft (estado por defecto tras create)
      await inspectorCommunicationService.create(
        { communicationType: 'requirement_response', subject: 'D1', authority: { type: 'AEAT' } },
        userId
      );
      await inspectorCommunicationService.create(
        { communicationType: 'requirement_response', subject: 'D2', authority: { type: 'AEAT' } },
        userId
      );
      // 3 llevadas a 'approved' vía updateStatus
      for (const subject of ['A1', 'A2', 'A3']) {
        const comm = await inspectorCommunicationService.create(
          { communicationType: 'allegation', subject, authority: { type: 'AEAT' } },
          userId
        );
        await inspectorCommunicationService.updateStatus(comm._id, 'approved', '', userId);
      }

      const dashboard = await inspectorCommunicationService.getDashboard();

      // 2 draft + 3 approved = 5. El comportamiento buggy habría devuelto 2
      // (el conteo de 'draft', primer operando truthy), no la suma.
      expect(dashboard.summary.totalPending).toBe(5);
    });
  });

  describe('Casos adicionales de cobertura de ramas', () => {
    let userId;

    beforeEach(() => {
      userId = new mongoose.Types.ObjectId();
      deadlineService.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    });

    test('list debe manejar sortOrder no especificado (default desc)', async () => {
      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'A',
        authority: { type: 'AEAT' }
      }, userId);

      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'B',
        authority: { type: 'AEAT' }
      }, userId);

      const result = await inspectorCommunicationService.list({}, {
        sortBy: 'subject'
        // sortOrder no especificado, debe ser 'desc' por defecto
      });

      // Orden descendente por subject: B antes que A
      expect(result.communications[0].subject).toBe('B');
    });

    test('getStats debe manejar categorías sin datos', async () => {
      // Solo crear comunicaciones de una categoría
      await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Solo response',
        authority: { type: 'AEAT' }
      }, userId);

      const stats = await inspectorCommunicationService.getStats();

      expect(stats.byCategory.response).toBeDefined();
      // Categoría 'appeal' no tiene datos, debe faltar o ser undefined
      expect(stats.byCategory.appeal).toBeUndefined();
    });

    test('resolve debe buscar deadline por requirementId', async () => {
      const requirementId = new mongoose.Types.ObjectId();

      const comm = await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Con requirement',
        authority: { type: 'AEAT' },
        references: {
          requirementId
        }
      }, userId);

      const deadline = new Deadline({
        deadlineType: 'requirement_response',
        category: 'requirement',
        title: 'Deadline por requirement',
        dueDate: new Date('2026-12-31'),
        references: {
          requirementId
        },
        status: 'pending'
      });
      await deadline.save();

      await inspectorCommunicationService.resolve(
        comm._id,
        { status: 'favorable' },
        userId
      );

      const deadlineUpdated = await Deadline.findById(deadline._id);
      expect(deadlineUpdated.status).toBe('completed');
    });

    test('resolve debe buscar deadline por communicationNumber en title', async () => {
      const comm = await inspectorCommunicationService.create({
        communicationType: 'allegation',
        subject: 'Con deadline por número',
        authority: { type: 'AEAT' }
      }, userId);

      const deadline = new Deadline({
        deadlineType: 'appeal_deadline',
        category: 'requirement',
        title: `Plazo para ${comm.communicationNumber}`,
        dueDate: new Date('2026-12-31'),
        status: 'pending'
      });
      await deadline.save();

      await inspectorCommunicationService.resolve(
        comm._id,
        { status: 'unfavorable' },
        userId
      );

      const deadlineUpdated = await Deadline.findById(deadline._id);
      expect(deadlineUpdated.status).toBe('completed');
    });

    test('resolve no debe fallar si deadline ya está completed', async () => {
      const comm = await inspectorCommunicationService.create({
        communicationType: 'clarification',
        subject: 'Test',
        authority: { type: 'AEAT' }
      }, userId);

      const deadline = new Deadline({
        deadlineType: 'other',
        category: 'requirement',
        title: `Test: ${comm.communicationNumber}`,
        dueDate: new Date('2026-12-31'),
        status: 'completed' // Ya completado
      });
      await deadline.save();

      const resolved = await inspectorCommunicationService.resolve(
        comm._id,
        { status: 'favorable' },
        userId
      );

      expect(resolved.status).toBe('resolved');
      // No debe fallar aunque el deadline ya esté completed
    });

    test('markDelivered debe funcionar sin mensajes outgoing', async () => {
      const comm = await inspectorCommunicationService.create({
        communicationType: 'requirement_response',
        subject: 'Sin mensajes',
        authority: { type: 'AEAT' }
      }, userId);

      await inspectorCommunicationService.submit(comm._id, userId);

      const updated = await inspectorCommunicationService.markDelivered(
        comm._id,
        'CONF-9999',
        userId
      );

      expect(updated.status).toBe('delivered');
      // No debe fallar aunque no haya mensajes outgoing
    });
  });
});
