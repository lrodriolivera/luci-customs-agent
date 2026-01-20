/**
 * Tests for Inspection Service
 * Coordinacion de Inspecciones
 */

const inspectionService = require('../../src/services/inspectionService');

describe('Inspection Service', () => {

  describe('Configuration', () => {
    test('should have inspection types defined', () => {
      const types = inspectionService.getInspectionTypes();

      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);

      // Check common inspection types exist
      const typeValues = types.map(t => t.value);
      expect(typeValues).toContain('physical');
      expect(typeValues).toContain('documentary');
      expect(typeValues).toContain('scanner');
      expect(typeValues).toContain('soivre');
      expect(typeValues).toContain('mapa');
      expect(typeValues).toContain('sanidad');
    });

    test('should have inspection results defined', () => {
      const results = inspectionService.getInspectionResults();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check common results exist
      const resultValues = results.map(r => r.value);
      expect(resultValues).toContain('approved');
      expect(resultValues).toContain('rejected');
      expect(resultValues).toContain('partial');
    });

    test('should have locations defined', () => {
      const locations = inspectionService.getLocations();

      expect(locations).toBeDefined();
      expect(locations.ports).toBeDefined();
      expect(locations.airports).toBeDefined();
      expect(locations.customs_offices).toBeDefined();
      expect(Array.isArray(locations.ports)).toBe(true);
      expect(Array.isArray(locations.airports)).toBe(true);
    });
  });

  describe('Inspection Type Configuration', () => {
    test('should return config for physical inspection', () => {
      const config = inspectionService.getInspectionTypeConfig('physical');

      expect(config).toBeDefined();
      expect(config.name).toBe('Inspección Física');
      expect(config.authority).toBe('AEAT');
      expect(config.channel).toBe('red');
      expect(config.estimatedDuration).toBeGreaterThan(0);
      expect(config.requirements).toBeDefined();
      expect(Array.isArray(config.requirements)).toBe(true);
    });

    test('should return config for documentary inspection', () => {
      const config = inspectionService.getInspectionTypeConfig('documentary');

      expect(config).toBeDefined();
      expect(config.name).toBe('Revisión Documental');
      expect(config.channel).toBe('orange');
    });

    test('should return config for SOIVRE inspection', () => {
      const config = inspectionService.getInspectionTypeConfig('soivre');

      expect(config).toBeDefined();
      expect(config.authority).toBe('SOIVRE');
    });

    test('should return config for MAPA inspection', () => {
      const config = inspectionService.getInspectionTypeConfig('mapa');

      expect(config).toBeDefined();
      expect(config.authority).toBe('MAPA');
    });

    test('should return null for unknown inspection type', () => {
      const config = inspectionService.getInspectionTypeConfig('unknown');

      expect(config).toBeNull();
    });
  });

  describe('Locations', () => {
    test('should include major Spanish ports', () => {
      const locations = inspectionService.getLocations();
      const portCodes = locations.ports.map(p => p.code);

      expect(portCodes).toContain('ESBCN'); // Barcelona
      expect(portCodes).toContain('ESVLC'); // Valencia
      expect(portCodes).toContain('ESALG'); // Algeciras
    });

    test('should include major Spanish airports', () => {
      const locations = inspectionService.getLocations();
      const airportCodes = locations.airports.map(a => a.code);

      expect(airportCodes).toContain('LEMD'); // Madrid
      expect(airportCodes).toContain('LEBL'); // Barcelona
    });

    test('location entries should have required fields', () => {
      const locations = inspectionService.getLocations();

      [...locations.ports, ...locations.airports, ...locations.customs_offices].forEach(loc => {
        expect(loc.code).toBeDefined();
        expect(loc.name).toBeDefined();
        expect(loc.city).toBeDefined();
        expect(loc.type).toBeDefined();
      });
    });
  });

  describe('Inspection Checklist', () => {
    test('should return checklist for physical inspection', () => {
      const checklist = inspectionService.getInspectionChecklist('physical');

      expect(checklist).toBeDefined();
      expect(checklist.requirements).toBeDefined();
      expect(checklist.generalItems).toBeDefined();
      expect(checklist.specificItems).toBeDefined();
      expect(Array.isArray(checklist.generalItems)).toBe(true);
    });

    test('should return checklist for scanner inspection', () => {
      const checklist = inspectionService.getInspectionChecklist('scanner');

      expect(checklist).toBeDefined();
      expect(checklist.specificItems.length).toBeGreaterThan(0);
    });

    test('should return checklist for SOIVRE inspection', () => {
      const checklist = inspectionService.getInspectionChecklist('soivre');

      expect(checklist).toBeDefined();
      expect(checklist.specificItems.some(item =>
        item.toLowerCase().includes('técnica') || item.toLowerCase().includes('muestra')
      )).toBe(true);
    });

    test('should return checklist for MAPA inspection', () => {
      const checklist = inspectionService.getInspectionChecklist('mapa');

      expect(checklist).toBeDefined();
      expect(checklist.specificItems.some(item =>
        item.toLowerCase().includes('sanitario') || item.toLowerCase().includes('veterinario')
      )).toBe(true);
    });

    test('general items should include common requirements', () => {
      const checklist = inspectionService.getInspectionChecklist('physical');

      expect(checklist.generalItems.some(item =>
        item.toLowerCase().includes('inspector')
      )).toBe(true);
      expect(checklist.generalItems.some(item =>
        item.toLowerCase().includes('documentación')
      )).toBe(true);
    });
  });

  describe('Inspection Results Configuration', () => {
    test('approved result should have levante action', () => {
      const results = inspectionService.getInspectionResults();
      const approved = results.find(r => r.value === 'approved');

      expect(approved).toBeDefined();
      expect(approved.actions).toContain('levante');
    });

    test('rejected result should have retention action', () => {
      const results = inspectionService.getInspectionResults();
      const rejected = results.find(r => r.value === 'rejected');

      expect(rejected).toBeDefined();
      expect(rejected.actions).toContain('retention');
    });

    test('pending_analysis should have laboratory action', () => {
      const results = inspectionService.getInspectionResults();
      const pending = results.find(r => r.value === 'pending_analysis');

      expect(pending).toBeDefined();
      expect(pending.actions).toContain('laboratory_analysis');
    });

    test('all results should have next steps', () => {
      const results = inspectionService.getInspectionResults();

      results.forEach(result => {
        expect(result.nextSteps).toBeDefined();
        expect(result.nextSteps.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Service Information', () => {
    test('should return service info', () => {
      const info = inspectionService.getInfo();

      expect(info).toBeDefined();
      expect(info.service).toBe('Inspection Service');
      expect(info.version).toBeDefined();
      expect(info.inspectionTypes).toBeGreaterThan(0);
      expect(info.locations).toBeDefined();
      expect(info.locations.ports).toBeGreaterThan(0);
      expect(info.locations.airports).toBeGreaterThan(0);
    });
  });

  describe('Authority Types', () => {
    test('AEAT inspections should have AEAT authority', () => {
      const aeatTypes = ['physical', 'documentary', 'scanner'];

      aeatTypes.forEach(type => {
        const config = inspectionService.getInspectionTypeConfig(type);
        expect(config.authority).toBe('AEAT');
      });
    });

    test('paraduanero inspections should have specific authorities', () => {
      const paraduaneroTypes = {
        'soivre': 'SOIVRE',
        'mapa': 'MAPA',
        'sanidad': 'SANIDAD',
        'miterd': 'MITERD'
      };

      Object.entries(paraduaneroTypes).forEach(([type, authority]) => {
        const config = inspectionService.getInspectionTypeConfig(type);
        expect(config.authority).toBe(authority);
      });
    });
  });

  describe('Estimated Duration', () => {
    test('physical inspection should have longest duration', () => {
      const physical = inspectionService.getInspectionTypeConfig('physical');
      const documentary = inspectionService.getInspectionTypeConfig('documentary');

      expect(physical.estimatedDuration).toBeGreaterThan(documentary.estimatedDuration);
    });

    test('combined inspection should have longest duration', () => {
      const combined = inspectionService.getInspectionTypeConfig('combined');
      const physical = inspectionService.getInspectionTypeConfig('physical');

      expect(combined.estimatedDuration).toBeGreaterThanOrEqual(physical.estimatedDuration);
    });

    test('all inspection types should have duration defined', () => {
      const types = inspectionService.getInspectionTypes();

      types.forEach(type => {
        const config = inspectionService.getInspectionTypeConfig(type.value);
        if (config) {
          expect(config.estimatedDuration).toBeDefined();
          expect(config.estimatedDuration).toBeGreaterThan(0);
        }
      });
    });
  });
});
