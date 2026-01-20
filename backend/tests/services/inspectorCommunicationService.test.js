/**
 * Tests for Inspector Communication Service
 * Comunicacion con Inspectores - Alegaciones y Recursos
 */

const inspectorCommunicationService = require('../../src/services/inspectorCommunicationService');

describe('Inspector Communication Service', () => {

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
});
