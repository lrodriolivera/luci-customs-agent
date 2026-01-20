/**
 * Tests for Deadline Service
 * Gestor de Plazos y Alertas
 */

const deadlineService = require('../../src/services/deadlineService');

describe('Deadline Service', () => {

  describe('Configuration', () => {
    test('should have deadline config for all types', () => {
      const types = deadlineService.getDeadlineTypes();

      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);

      // Check common deadline types exist
      const typeValues = types.map(t => t.value);
      expect(typeValues).toContain('requirement_response');
      expect(typeValues).toContain('guarantee_expiration');
      expect(typeValues).toContain('regime_ultimation');
      expect(typeValues).toContain('oea_renewal');
      expect(typeValues).toContain('transit_arrival');
    });

    test('should return config for known deadline type', () => {
      const config = deadlineService.getDeadlineConfig('requirement_response');

      expect(config).toBeDefined();
      expect(config.category).toBe('requirement');
      expect(config.defaultPriority).toBeDefined();
      expect(config.defaultImpact).toBeDefined();
      expect(config.defaultAlerts).toBeDefined();
      expect(Array.isArray(config.defaultAlerts)).toBe(true);
    });

    test('should return default config for unknown deadline type', () => {
      const config = deadlineService.getDeadlineConfig('unknown_type');

      expect(config).toBeDefined();
      expect(config.category).toBe('other');
    });

    test('should have categories defined', () => {
      const categories = deadlineService.getCategories();

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('requirement');
      expect(categories).toContain('guarantee');
      expect(categories).toContain('regime');
      expect(categories).toContain('oea');
      expect(categories).toContain('transit');
    });
  });

  describe('Deadline Type Configurations', () => {
    const criticalTypes = [
      'requirement_response',
      'guarantee_expiration',
      'regime_ultimation',
      'appeal_deadline'
    ];

    test.each(criticalTypes)('should have high/critical priority for %s', (type) => {
      const config = deadlineService.getDeadlineConfig(type);

      expect(['high', 'critical']).toContain(config.defaultPriority);
    });

    test.each(criticalTypes)('should have impact description for %s', (type) => {
      const config = deadlineService.getDeadlineConfig(type);

      expect(config.impactDescription).toBeDefined();
      expect(config.impactDescription.length).toBeGreaterThan(0);
    });

    test('should have multiple alert levels for guarantee_expiration', () => {
      const config = deadlineService.getDeadlineConfig('guarantee_expiration');

      expect(config.defaultAlerts.length).toBeGreaterThanOrEqual(3);

      // Should have early warning (30 days)
      const earlyWarning = config.defaultAlerts.find(a => a.daysBeforeDeadline >= 30);
      expect(earlyWarning).toBeDefined();
    });

    test('should have short alert window for transit_arrival', () => {
      const config = deadlineService.getDeadlineConfig('transit_arrival');

      // Transit alerts should be close to deadline
      const maxDays = Math.max(...config.defaultAlerts.map(a => a.daysBeforeDeadline));
      expect(maxDays).toBeLessThanOrEqual(7);
    });
  });

  describe('Service Information', () => {
    test('should return service info', () => {
      const info = deadlineService.getInfo();

      expect(info).toBeDefined();
      expect(info.service).toBe('Deadline Service');
      expect(info.version).toBeDefined();
      expect(info.deadlineTypes).toBeGreaterThan(0);
      expect(info.categories).toBeDefined();
      expect(Array.isArray(info.categories)).toBe(true);
      expect(info.alertLevels).toBeDefined();
    });
  });

  describe('Alert Message Generation', () => {
    const mockDeadline = {
      title: 'Test Deadline',
      dueDate: new Date()
    };

    test('should generate overdue message for negative days', () => {
      const message = deadlineService.generateAlertMessage(mockDeadline, -3);

      expect(message).toContain('VENCIDO');
      expect(message).toContain('3');
      expect(message).toContain(mockDeadline.title);
    });

    test('should generate critical message for today', () => {
      const message = deadlineService.generateAlertMessage(mockDeadline, 0);

      expect(message).toContain('URGENTE');
      expect(message).toContain('HOY');
    });

    test('should generate urgent message for tomorrow', () => {
      const message = deadlineService.generateAlertMessage(mockDeadline, 1);

      expect(message).toContain('URGENTE');
      expect(message).toContain('MAÑANA');
    });

    test('should generate reminder message for future dates', () => {
      const message = deadlineService.generateAlertMessage(mockDeadline, 5);

      expect(message).toContain('Recordatorio');
      expect(message).toContain('5 días');
    });
  });

  describe('Deadline Type Categories', () => {
    test('requirement types should have requirement category', () => {
      const types = ['requirement_response', 'paraduanero_response', 'appeal_deadline'];

      types.forEach(type => {
        const config = deadlineService.getDeadlineConfig(type);
        expect(config.category).toBe('requirement');
      });
    });

    test('guarantee types should have guarantee category', () => {
      const types = ['guarantee_expiration', 'guarantee_renewal'];

      types.forEach(type => {
        const config = deadlineService.getDeadlineConfig(type);
        expect(config.category).toBe('guarantee');
      });
    });

    test('regime types should have regime category', () => {
      const types = ['regime_ultimation', 'regime_account'];

      types.forEach(type => {
        const config = deadlineService.getDeadlineConfig(type);
        expect(config.category).toBe('regime');
      });
    });

    test('OEA types should have oea category', () => {
      const types = ['oea_renewal', 'oea_audit'];

      types.forEach(type => {
        const config = deadlineService.getDeadlineConfig(type);
        expect(config.category).toBe('oea');
      });
    });

    test('transit types should have transit category', () => {
      const types = ['transit_arrival', 'transit_discharge'];

      types.forEach(type => {
        const config = deadlineService.getDeadlineConfig(type);
        expect(config.category).toBe('transit');
      });
    });
  });

  describe('Alert Configuration', () => {
    test('all deadline types should have at least one alert configured', () => {
      const types = deadlineService.getDeadlineTypes();

      types.forEach(type => {
        const config = deadlineService.getDeadlineConfig(type.value);
        expect(config.defaultAlerts).toBeDefined();
        expect(config.defaultAlerts.length).toBeGreaterThan(0);
      });
    });

    test('alerts should have valid structure', () => {
      const config = deadlineService.getDeadlineConfig('requirement_response');

      config.defaultAlerts.forEach(alert => {
        expect(alert.daysBeforeDeadline).toBeDefined();
        expect(typeof alert.daysBeforeDeadline).toBe('number');
        expect(alert.alertType).toBeDefined();
        expect(['email', 'sms', 'system', 'portal', 'all']).toContain(alert.alertType);
      });
    });

    test('alerts should be ordered from earliest to latest', () => {
      const config = deadlineService.getDeadlineConfig('guarantee_expiration');

      for (let i = 1; i < config.defaultAlerts.length; i++) {
        expect(config.defaultAlerts[i - 1].daysBeforeDeadline)
          .toBeGreaterThanOrEqual(config.defaultAlerts[i].daysBeforeDeadline);
      }
    });
  });
});
