/**
 * Tests for VUA Service
 * Ventanilla Unica Aduanera
 */

const vuaService = require('../../src/services/integrations/vuaService');

describe('VUA Service', () => {

  describe('Configuration', () => {
    test('should have services defined', () => {
      const services = vuaService.getAvailableServices();

      expect(services).toBeDefined();
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);

      // Check common services exist
      const serviceCodes = services.map(s => s.code);
      expect(serviceCodes).toContain('DUA_IMP');
      expect(serviceCodes).toContain('DUA_EXP');
      expect(serviceCodes).toContain('SOIVRE');
      expect(serviceCodes).toContain('SANIT');
    });

    test('should have authorities defined', () => {
      const authorities = vuaService.getAvailableAuthorities();

      expect(authorities).toBeDefined();
      expect(Array.isArray(authorities)).toBe(true);
      expect(authorities.length).toBeGreaterThan(0);

      // Check common authorities exist
      const authorityCodes = authorities.map(a => a.code);
      expect(authorityCodes).toContain('AEAT');
      expect(authorityCodes).toContain('SOIVRE');
      expect(authorityCodes).toContain('MAPA');
      expect(authorityCodes).toContain('SANIDAD');
    });

    test('should have response codes defined', () => {
      const codes = vuaService.getResponseCodes();

      expect(codes).toBeDefined();
      expect(codes['0000']).toBeDefined();
      expect(codes['0000'].status).toBe('success');
      expect(codes['2001']).toBeDefined();
      expect(codes['2001'].status).toBe('error');
    });

    test('should have processing states defined', () => {
      const states = vuaService.getProcessingStates();

      expect(states).toBeDefined();
      expect(states.DRAFT).toBeDefined();
      expect(states.SUBMITTED).toBeDefined();
      expect(states.ACCEPTED).toBeDefined();
      expect(states.REJECTED).toBeDefined();
      expect(states.RELEASED).toBeDefined();
    });
  });

  describe('Service Configuration', () => {
    test('DUA_IMP should be configured with AEAT authority', () => {
      const services = vuaService.getAvailableServices();
      const duaImport = services.find(s => s.code === 'DUA_IMP');

      expect(duaImport).toBeDefined();
      expect(duaImport.authorities).toContain('AEAT');
    });

    test('SOIVRE service should be configured with SOIVRE authority', () => {
      const services = vuaService.getAvailableServices();
      const soivre = services.find(s => s.code === 'SOIVRE');

      expect(soivre).toBeDefined();
      expect(soivre.authorities).toContain('SOIVRE');
    });

    test('VETER service should be configured with MAPA authority', () => {
      const services = vuaService.getAvailableServices();
      const veterinario = services.find(s => s.code === 'VETER');

      expect(veterinario).toBeDefined();
      expect(veterinario.authorities).toContain('MAPA');
    });
  });

  describe('Reference Generation', () => {
    test('should generate valid VUA reference', () => {
      const reference = vuaService.generateVUAReference('DUA_IMP');

      expect(reference).toBeDefined();
      expect(reference).toMatch(/^VUA\d{4}DUA_IMP[A-F0-9]{8}$/);
    });

    test('should generate unique references', () => {
      const refs = new Set();
      for (let i = 0; i < 100; i++) {
        refs.add(vuaService.generateVUAReference('TEST'));
      }
      expect(refs.size).toBe(100);
    });
  });

  describe('Required Controls', () => {
    test('should identify veterinary controls for animal products', async () => {
      const controls = await vuaService.getRequiredControls({
        goods: [{ taricCode: '0201100000', description: 'Carne de bovino' }]
      });

      expect(controls.success).toBe(true);
      expect(controls.controls.length).toBeGreaterThan(0);
      expect(controls.controls.some(c => c.controlType === 'VETERINARIO')).toBe(true);
    });

    test('should identify phytosanitary controls for plant products', async () => {
      const controls = await vuaService.getRequiredControls({
        goods: [{ taricCode: '0709939000', description: 'Pimientos frescos' }]
      });

      expect(controls.success).toBe(true);
      expect(controls.controls.some(c => c.controlType === 'FITOSANITARIO')).toBe(true);
    });

    test('should identify SOIVRE controls for textiles', async () => {
      const controls = await vuaService.getRequiredControls({
        goods: [{ taricCode: '6104430000', description: 'Vestidos de fibras sinteticas' }]
      });

      expect(controls.success).toBe(true);
      expect(controls.controls.some(c => c.controlType === 'SOIVRE')).toBe(true);
    });

    test('should identify SILICIE controls for alcohol', async () => {
      const controls = await vuaService.getRequiredControls({
        goods: [{ taricCode: '2208301100', description: 'Whisky' }]
      });

      expect(controls.success).toBe(true);
      expect(controls.controls.some(c => c.controlType === 'SILICIE')).toBe(true);
    });
  });

  describe('Simulation Mode', () => {
    test('should be in simulation mode by default', () => {
      const config = vuaService.getConfig();

      expect(config.simulationMode).toBe(true);
      expect(config.environment).toBe('simulation');
    });

    test('should return simulation response on connectivity test', async () => {
      const result = await vuaService.testConnectivity();

      expect(result.success).toBe(true);
      expect(result.environment).toBe('simulation');
      expect(result.message).toContain('simulación');
    });
  });

  describe('Document Submission (Simulation)', () => {
    test('should simulate document submission successfully', async () => {
      const result = await vuaService.submitDocument({
        serviceType: 'DUA_IMPORT',
        operatorNIF: 'B12345678',
        operatorName: 'Test Company',
        customsOffice: 'ES002801',
        content: { test: true }
      });

      expect(result.success).toBe(true);
      expect(result.vuaReference).toBeDefined();
      expect(result.vuaReference).toMatch(/^VUA/);
    });

    test('should fail submission without operator NIF', async () => {
      const result = await vuaService.submitDocument({
        serviceType: 'DUA_IMPORT',
        customsOffice: 'ES002801',
        content: { test: true }
      });

      expect(result.success).toBe(false);
      expect(result.responseCode).toBe('2001');
    });
  });

  describe('Status Query (Simulation)', () => {
    test('should simulate status query', async () => {
      const result = await vuaService.queryStatus('VUA2024TESTABCD1234');

      expect(result.success).toBe(true);
      expect(result.vuaReference).toBe('VUA2024TESTABCD1234');
      expect(result.status).toBeDefined();
      expect(result.history).toBeDefined();
      expect(Array.isArray(result.history)).toBe(true);
    });
  });

  describe('Service Information', () => {
    test('should return service info', () => {
      const info = vuaService.getInfo();

      expect(info).toBeDefined();
      expect(info.service).toBe('VUA Service');
      expect(info.version).toBeDefined();
      expect(info.services).toBeGreaterThan(0);
      expect(info.authorities).toBeGreaterThan(0);
    });
  });

  describe('Authority Configuration', () => {
    test('AEAT authority should have services defined', () => {
      const authorities = vuaService.getAvailableAuthorities();
      const aeat = authorities.find(a => a.code === 'AEAT');

      expect(aeat).toBeDefined();
      expect(aeat.services).toBeDefined();
      expect(aeat.services.length).toBeGreaterThan(0);
    });

    test('MAPA authority should handle veterinary and phytosanitary', () => {
      const authorities = vuaService.getAvailableAuthorities();
      const mapa = authorities.find(a => a.code === 'MAPA');

      expect(mapa).toBeDefined();
      expect(mapa.services).toContain('FITO');
      expect(mapa.services).toContain('VETER');
    });
  });
});
