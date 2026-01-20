/**
 * Tests for TRACES Service
 * Sistema de Control Sanitario/Veterinario UE
 */

const tracesService = require('../../src/services/integrations/tracesService');

describe('TRACES Service', () => {

  describe('Configuration', () => {
    test('should have CHED types defined', () => {
      const types = tracesService.getCHEDTypes();

      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBe(4);

      // Check all CHED types exist
      const typeCodes = types.map(t => t.code);
      expect(typeCodes).toContain('CHED-A');
      expect(typeCodes).toContain('CHED-P');
      expect(typeCodes).toContain('CHED-D');
      expect(typeCodes).toContain('CHED-PP');
    });

    test('should have border control posts defined', () => {
      const bcps = tracesService.getBorderControlPosts();

      expect(bcps).toBeDefined();
      expect(Array.isArray(bcps)).toBe(true);
      expect(bcps.length).toBeGreaterThan(0);

      // Check some Spanish BCPs exist
      const bcpCodes = bcps.map(b => b.code);
      expect(bcpCodes).toContain('ESBCN01'); // Barcelona Puerto
      expect(bcpCodes).toContain('ESMAD01'); // Madrid Barajas
    });

    test('should have laboratories defined', () => {
      const labs = tracesService.getAuthorizedLaboratories();

      expect(labs).toBeDefined();
      expect(Array.isArray(labs)).toBe(true);
      expect(labs.length).toBeGreaterThan(0);

      labs.forEach(lab => {
        expect(lab.code).toBeDefined();
        expect(lab.name).toBeDefined();
        expect(lab.type).toBeDefined();
      });
    });

    test('should have control decisions defined', () => {
      const decisions = tracesService.getControlDecisions();

      expect(decisions).toBeDefined();
      expect(decisions.ACCEPTABLE).toBeDefined();
      expect(decisions.ACCEPTABLE.canRelease).toBe(true);
      expect(decisions.NOT_ACCEPTABLE_REEXPORT).toBeDefined();
      expect(decisions.NOT_ACCEPTABLE_REEXPORT.canRelease).toBe(false);
    });

    test('should have CHED statuses defined', () => {
      const statuses = tracesService.getCHEDStatuses();

      expect(statuses).toBeDefined();
      expect(statuses.DRAFT).toBeDefined();
      expect(statuses.SUBMITTED).toBeDefined();
      expect(statuses.APPROVED).toBeDefined();
      expect(statuses.REJECTED).toBeDefined();
    });
  });

  describe('CHED Type Determination', () => {
    test('should determine CHED-A for live animals', () => {
      const result = tracesService.determineCHEDType({ taricCode: '0102290000' });

      expect(result).toBeDefined();
      expect(result.type).toBe('CHED_A');
      expect(result.code).toBe('CHED-A');
    });

    test('should determine CHED-P for animal products', () => {
      const result = tracesService.determineCHEDType({ taricCode: '0201100000' });

      expect(result).toBeDefined();
      expect(result.type).toBe('CHED_P');
      expect(result.code).toBe('CHED-P');
    });

    test('should determine CHED-PP for plants', () => {
      const result = tracesService.determineCHEDType({ taricCode: '0602100010' });

      expect(result).toBeDefined();
      expect(result.type).toBe('CHED_PP');
      expect(result.code).toBe('CHED-PP');
    });

    test('should return null for non-controlled products', () => {
      const result = tracesService.determineCHEDType({ taricCode: '8471300000' });

      expect(result).toBeNull();
    });
  });

  describe('Country Authorization', () => {
    test('should recognize authorized countries for animal products', () => {
      expect(tracesService.isCountryAuthorized('BR', 'animalProducts')).toBe(true);
      expect(tracesService.isCountryAuthorized('AU', 'animalProducts')).toBe(true);
      expect(tracesService.isCountryAuthorized('US', 'animalProducts')).toBe(true);
    });

    test('should recognize authorized countries for plants', () => {
      expect(tracesService.isCountryAuthorized('CO', 'plants')).toBe(true);
      expect(tracesService.isCountryAuthorized('EC', 'plants')).toBe(true);
      expect(tracesService.isCountryAuthorized('PE', 'plants')).toBe(true);
    });

    test('should return approved countries list', () => {
      const countries = tracesService.getApprovedCountries('animalProducts');

      expect(countries).toBeDefined();
      expect(Array.isArray(countries)).toBe(true);
      expect(countries.length).toBeGreaterThan(0);
      expect(countries).toContain('BR');
      expect(countries).toContain('AR');
    });
  });

  describe('Reference Generation', () => {
    test('should generate valid CHED reference', () => {
      const reference = tracesService.generateCHEDReference('CHED-P');

      expect(reference).toBeDefined();
      expect(reference).toMatch(/^CHED\.ES\.\d{4}\.CHEDP\.[A-F0-9]{8}$/);
    });

    test('should generate unique references', () => {
      const refs = new Set();
      for (let i = 0; i < 100; i++) {
        refs.add(tracesService.generateCHEDReference('CHED-P'));
      }
      expect(refs.size).toBe(100);
    });
  });

  describe('Simulation Mode', () => {
    test('should be in simulation mode by default', () => {
      const config = tracesService.getConfig();

      expect(config.simulationMode).toBe(true);
      expect(config.environment).toBe('simulation');
    });

    test('should return simulation response on connectivity test', async () => {
      const result = await tracesService.testConnectivity();

      expect(result.success).toBe(true);
      expect(result.environment).toBe('simulation');
    });
  });

  describe('CHED Creation (Simulation)', () => {
    test('should simulate CHED creation successfully', async () => {
      const result = await tracesService.createCHED({
        type: 'CHED_P',
        goods: { commodityCode: '0203291500', description: 'Carne de cerdo' },
        originCountry: 'BR',
        borderControlPost: 'ESBCN01'
      });

      expect(result.success).toBe(true);
      expect(result.reference).toBeDefined();
      expect(result.status).toBe('DRAFT');
    });

    test('should fail with invalid CHED type', async () => {
      await expect(tracesService.createCHED({
        type: 'INVALID_TYPE',
        goods: {}
      })).rejects.toThrow('Tipo de CHED no válido');
    });
  });

  describe('CHED Submission (Simulation)', () => {
    test('should simulate CHED submission', async () => {
      const result = await tracesService.submitCHED('CHED.ES.2024.CHEDP.ABCD1234');

      expect(result.success).toBeDefined();
      expect(result.reference).toBe('CHED.ES.2024.CHEDP.ABCD1234');
    });
  });

  describe('CHED Status Query (Simulation)', () => {
    test('should simulate status query', async () => {
      const result = await tracesService.getCHEDStatus('CHED.ES.2024.CHEDP.ABCD1234');

      expect(result.success).toBe(true);
      expect(result.reference).toBe('CHED.ES.2024.CHEDP.ABCD1234');
      expect(result.status).toBeDefined();
      expect(result.history).toBeDefined();
    });
  });

  describe('Border Control Posts', () => {
    test('should have port BCPs', () => {
      const bcps = tracesService.getBorderControlPosts();
      const ports = bcps.filter(b => b.type === 'PORT');

      expect(ports.length).toBeGreaterThan(0);
      ports.forEach(port => {
        expect(port.authorities).toBeDefined();
        expect(port.authorities.length).toBeGreaterThan(0);
      });
    });

    test('should have airport BCPs', () => {
      const bcps = tracesService.getBorderControlPosts();
      const airports = bcps.filter(b => b.type === 'AIRPORT');

      expect(airports.length).toBeGreaterThan(0);
    });

    test('should have road BCPs', () => {
      const bcps = tracesService.getBorderControlPosts();
      const roads = bcps.filter(b => b.type === 'ROAD');

      expect(roads.length).toBeGreaterThan(0);
    });
  });

  describe('Service Information', () => {
    test('should return service info', () => {
      const info = tracesService.getInfo();

      expect(info).toBeDefined();
      expect(info.service).toBe('TRACES Service');
      expect(info.version).toBeDefined();
      expect(info.chedTypes).toBe(4);
      expect(info.borderControlPosts).toBeGreaterThan(0);
      expect(info.laboratories).toBeGreaterThan(0);
    });
  });

  describe('CHED Type Characteristics', () => {
    test('CHED-A should be for animals', () => {
      const types = tracesService.getCHEDTypes();
      const chedA = types.find(t => t.code === 'CHED-A');

      expect(chedA).toBeDefined();
      expect(chedA.authority).toBe('Veterinary');
      expect(chedA.chapters).toContain('01');
    });

    test('CHED-P should be for animal products', () => {
      const types = tracesService.getCHEDTypes();
      const chedP = types.find(t => t.code === 'CHED-P');

      expect(chedP).toBeDefined();
      expect(chedP.authority).toBe('Veterinary');
      expect(chedP.chapters).toContain('02');
      expect(chedP.chapters).toContain('03');
    });

    test('CHED-PP should be for plants', () => {
      const types = tracesService.getCHEDTypes();
      const chedPP = types.find(t => t.code === 'CHED-PP');

      expect(chedPP).toBeDefined();
      expect(chedPP.authority).toBe('Phytosanitary');
      expect(chedPP.chapters).toContain('06');
    });

    test('CHED-D should be for food and feed', () => {
      const types = tracesService.getCHEDTypes();
      const chedD = types.find(t => t.code === 'CHED-D');

      expect(chedD).toBeDefined();
      expect(chedD.authority).toBe('Food Safety');
    });
  });
});
