/**
 * Tests for NCTS Service
 * Sistema de Transito Informatizado UE
 */

const nctsService = require('../../src/services/integrations/nctsService');

describe('NCTS Service', () => {

  describe('Configuration', () => {
    test('should have transit types defined', () => {
      const types = nctsService.getTransitTypes();

      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);

      // Check common transit types exist
      const typeCodes = types.map(t => t.code);
      expect(typeCodes).toContain('T1');
      expect(typeCodes).toContain('T2');
      expect(typeCodes).toContain('TIR');
      expect(typeCodes).toContain('ATA');
    });

    test('should have guarantee types defined', () => {
      const types = nctsService.getGuaranteeTypes();

      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);

      // Check some guarantee types
      const codes = types.map(t => t.code);
      expect(codes).toContain('0'); // Garantia global
      expect(codes).toContain('B'); // Carnet TIR
      expect(codes).toContain('H'); // Cuaderno ATA
    });

    test('should have transit states defined', () => {
      const states = nctsService.getTransitStates();

      expect(states).toBeDefined();
      expect(states.DRAFT).toBeDefined();
      expect(states.SUBMITTED).toBeDefined();
      expect(states.ACCEPTED).toBeDefined();
      expect(states.RELEASED).toBeDefined();
      expect(states.IN_TRANSIT).toBeDefined();
      expect(states.DISCHARGED).toBeDefined();
    });

    test('should have NCTS messages defined', () => {
      const messages = nctsService.getNCTSMessages();

      expect(messages).toBeDefined();
      expect(messages.IE015).toBeDefined();
      expect(messages.IE015.name).toBe('Declaration Data');
      expect(messages.IE028).toBeDefined();
      expect(messages.IE028.name).toBe('MRN Allocated');
      expect(messages.IE029).toBeDefined();
      expect(messages.IE029.name).toBe('Release for Transit');
    });

    test('should have seal types defined', () => {
      const types = nctsService.getSealTypes();

      expect(types).toBeDefined();
      expect(types['1']).toBeDefined();
      expect(types['1'].name).toContain('aduanero');
    });
  });

  describe('Transit Type Characteristics', () => {
    test('T1 should be external transit with guarantee', () => {
      const types = nctsService.getTransitTypes();
      const t1 = types.find(t => t.code === 'T1');

      expect(t1).toBeDefined();
      expect(t1.name).toContain('Externo');
      expect(t1.guaranteeRequired).toBe(true);
      expect(t1.customsStatus).toBe('T1');
    });

    test('T2 should be internal transit with guarantee', () => {
      const types = nctsService.getTransitTypes();
      const t2 = types.find(t => t.code === 'T2');

      expect(t2).toBeDefined();
      expect(t2.name).toContain('Interno');
      expect(t2.guaranteeRequired).toBe(true);
    });

    test('TIR should require carnet', () => {
      const types = nctsService.getTransitTypes();
      const tir = types.find(t => t.code === 'TIR');

      expect(tir).toBeDefined();
      expect(tir.carnetRequired).toBe(true);
    });

    test('ATA should not require guarantee but require carnet', () => {
      const types = nctsService.getTransitTypes();
      const ata = types.find(t => t.code === 'ATA');

      expect(ata).toBeDefined();
      expect(ata.guaranteeRequired).toBe(false);
      expect(ata.carnetRequired).toBe(true);
    });
  });

  describe('Transit Offices', () => {
    test('should have departure offices', () => {
      const offices = nctsService.getTransitOffices('departure');

      expect(offices).toBeDefined();
      expect(Array.isArray(offices)).toBe(true);
      expect(offices.length).toBeGreaterThan(0);

      // Check Spanish offices
      offices.forEach(office => {
        expect(office.code).toMatch(/^ES/);
        expect(office.type).toBe('departure');
      });
    });

    test('should have destination offices', () => {
      const offices = nctsService.getTransitOffices('destination');

      expect(offices).toBeDefined();
      expect(Array.isArray(offices)).toBe(true);
      expect(offices.length).toBeGreaterThan(0);

      // Check EU offices
      const countries = [...new Set(offices.map(o => o.country))];
      expect(countries.length).toBeGreaterThan(1);
    });

    test('should return all offices when no type specified', () => {
      const offices = nctsService.getTransitOffices();

      expect(offices).toBeDefined();
      expect(offices.departure).toBeDefined();
      expect(offices.destination).toBeDefined();
    });
  });

  describe('LRN Generation', () => {
    test('should generate valid LRN', () => {
      const lrn = nctsService.generateLRN();

      expect(lrn).toBeDefined();
      expect(lrn).toMatch(/^ES\d{8}[A-F0-9]{8}$/);
    });

    test('should generate unique LRNs', () => {
      const lrns = new Set();
      for (let i = 0; i < 100; i++) {
        lrns.add(nctsService.generateLRN());
      }
      expect(lrns.size).toBe(100);
    });
  });

  describe('Guarantee Calculation', () => {
    test('should calculate guarantee for T1 transit', () => {
      const goods = [
        { customsValue: 10000, quantity: 1, dutyRate: 5, vatRate: 21 }
      ];

      const result = nctsService.calculateGuaranteeAmount(goods, 'T1');

      expect(result).toBeDefined();
      expect(result.duties).toBeGreaterThan(0);
      expect(result.vat).toBeGreaterThan(0);
      expect(result.total).toBe(result.duties + result.vat);
      expect(result.guaranteeRequired).toBe(result.total);
      expect(result.currency).toBe('EUR');
    });

    test('should return zero guarantee for TIR', () => {
      const goods = [
        { customsValue: 10000, quantity: 1, dutyRate: 5, vatRate: 21 }
      ];

      const result = nctsService.calculateGuaranteeAmount(goods, 'TIR');

      expect(result.guaranteeRequired).toBe(0);
    });

    test('should return zero guarantee for ATA', () => {
      const goods = [
        { customsValue: 10000, quantity: 1, dutyRate: 5, vatRate: 21 }
      ];

      const result = nctsService.calculateGuaranteeAmount(goods, 'ATA');

      expect(result.guaranteeRequired).toBe(0);
    });

    test('should handle multiple goods', () => {
      const goods = [
        { customsValue: 5000, quantity: 2, dutyRate: 5, vatRate: 21 },
        { customsValue: 3000, quantity: 1, dutyRate: 10, vatRate: 21 }
      ];

      const result = nctsService.calculateGuaranteeAmount(goods, 'T1');

      expect(result.duties).toBeGreaterThan(0);
      expect(result.vat).toBeGreaterThan(0);
    });
  });

  describe('Simulation Mode', () => {
    test('should be in simulation mode by default', () => {
      const config = nctsService.getConfig();

      expect(config.simulationMode).toBe(true);
      expect(config.environment).toBe('simulation');
    });

    test('should return simulation response on connectivity test', async () => {
      const result = await nctsService.testConnectivity();

      expect(result.success).toBe(true);
      expect(result.environment).toBe('simulation');
    });
  });

  describe('Transit Declaration Creation (Simulation)', () => {
    test('should simulate declaration creation successfully', async () => {
      const result = await nctsService.createTransitDeclaration({
        transitType: 'T1',
        principal: { eori: 'ES12345678A', name: 'Test Company' },
        departureOffice: 'ES002801',
        destinationOffice: 'FR000001',
        goods: [{ commodityCode: '8471300000', description: 'Computers' }],
        guarantee: { type: '0', grn: 'GRN-ES-2024-001' }
      });

      expect(result.success).toBe(true);
      expect(result.lrn).toBeDefined();
      expect(result.mrn).toBeDefined();
      expect(result.mrn).toMatch(/^24ES/);
      expect(result.transitType).toBe('T1');
      expect(result.status).toBe('SUBMITTED');
    });

    test('should fail with invalid transit type', async () => {
      await expect(nctsService.createTransitDeclaration({
        transitType: 'INVALID',
        principal: {},
        departureOffice: 'ES002801',
        destinationOffice: 'FR000001',
        goods: []
      })).rejects.toThrow('Tipo de tránsito no válido');
    });
  });

  describe('Arrival Notification (Simulation)', () => {
    test('should simulate arrival notification', async () => {
      const result = await nctsService.notifyArrival({
        mrn: '24ESA1B2C3D4E5F6G7H8',
        arrivalOffice: 'FR000001',
        arrivalDate: new Date().toISOString()
      });

      expect(result.mrn).toBe('24ESA1B2C3D4E5F6G7H8');
      expect(result.status).toBeDefined();
    });
  });

  describe('Guarantee Query (Simulation)', () => {
    test('should simulate guarantee query', async () => {
      const result = await nctsService.queryGuarantee('GRN-ES-2024-001', 'ACCESS123');

      expect(result.success).toBe(true);
      expect(result.grn).toBe('GRN-ES-2024-001');
      expect(result.status).toBe('VALID');
      expect(result.totalAmount).toBeDefined();
      expect(result.availableAmount).toBeDefined();
    });
  });

  describe('Declaration Status Query (Simulation)', () => {
    test('should simulate status query', async () => {
      const result = await nctsService.getDeclarationStatus('24ESA1B2C3D4E5F6G7H8');

      expect(result.success).toBe(true);
      expect(result.mrn).toBe('24ESA1B2C3D4E5F6G7H8');
      expect(result.status).toBeDefined();
      expect(result.statusName).toBeDefined();
    });
  });

  describe('Transit Search (Simulation)', () => {
    test('should simulate transit search', async () => {
      const result = await nctsService.searchTransits({
        transitType: 'T1'
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.total).toBeDefined();
    });
  });

  describe('Service Information', () => {
    test('should return service info', () => {
      const info = nctsService.getInfo();

      expect(info).toBeDefined();
      expect(info.service).toBe('NCTS Service');
      expect(info.version).toBe('5.0.0');
      expect(info.transitTypes).toBeGreaterThan(0);
      expect(info.guaranteeTypes).toBeGreaterThan(0);
      expect(info.messages).toBeGreaterThan(0);
    });
  });

  describe('Guarantee Types', () => {
    test('comprehensive guarantee types should be marked', () => {
      const types = nctsService.getGuaranteeTypes();
      const global = types.find(t => t.code === '0');
      const reduced = types.find(t => t.code === '1');

      expect(global.comprehensive).toBe(true);
      expect(reduced.comprehensive).toBe(true);
    });

    test('individual guarantee types should not be comprehensive', () => {
      const types = nctsService.getGuaranteeTypes();
      const individual = types.find(t => t.code === '3');

      expect(individual.comprehensive).toBe(false);
    });
  });

  describe('Transit State Phases', () => {
    test('declaration states should have declaration phase', () => {
      const states = nctsService.getTransitStates();

      expect(states.DRAFT.phase).toBe('declaration');
      expect(states.SUBMITTED.phase).toBe('declaration');
      expect(states.ACCEPTED.phase).toBe('declaration');
    });

    test('movement states should have movement phase', () => {
      const states = nctsService.getTransitStates();

      expect(states.RELEASED.phase).toBe('movement');
      expect(states.IN_TRANSIT.phase).toBe('movement');
      expect(states.ARRIVED.phase).toBe('movement');
    });

    test('completion states should have completion phase', () => {
      const states = nctsService.getTransitStates();

      expect(states.WRITE_OFF.phase).toBe('completion');
      expect(states.DISCHARGED.phase).toBe('completion');
    });
  });
});
