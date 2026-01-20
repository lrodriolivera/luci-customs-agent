/**
 * Tests for Paraduanero Service
 * Testing non-customs controls (veterinary, phytosanitary, etc.)
 */

const paraduaneroService = require('../../src/services/paraduaneroService');

// Mock dependencies
jest.mock('../../src/config/logger');
jest.mock('../../src/models', () => ({
  Expedition: {
    findById: jest.fn(),
    save: jest.fn()
  },
  ParaduaneroControl: {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn()
  },
  Document: {}
}));

const { Expedition, ParaduaneroControl } = require('../../src/models');

describe('Paraduanero Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeExpedition', () => {
    test('should detect veterinary controls for live animals (Chapter 01)', async () => {
      const expedition = {
        expeditionId: 'EXP-001',
        goods: [{
          itemNumber: 1,
          description: 'Bovine animals',
          taricCode: '0102210000',
          originCountry: 'BR',
          quantity: 10,
          unit: 'NAR',
          grossWeight: 5000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      expect(controls).toBeDefined();
      expect(controls.length).toBeGreaterThan(0);
      expect(controls[0]).toMatchObject({
        controlType: 'MAPA',
        subType: 'veterinary',
        inspectionRequired: true
      });
      expect(controls[0].documents).toContainEqual(
        expect.objectContaining({
          code: 'C620',
          name: expect.stringContaining('Veterinario')
        })
      );
    });

    test('should detect phytosanitary controls for fresh fruits (Chapter 08)', async () => {
      const expedition = {
        expeditionId: 'EXP-002',
        goods: [{
          itemNumber: 1,
          description: 'Fresh oranges',
          taricCode: '0805100000',
          originCountry: 'BR',
          quantity: 1000,
          unit: 'KGM',
          grossWeight: 1000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      expect(controls.length).toBeGreaterThan(0);
      const phytoControl = controls.find(c => c.subType === 'phytosanitary');
      expect(phytoControl).toBeDefined();
      expect(phytoControl.documents).toContainEqual(
        expect.objectContaining({
          code: 'C633',
          name: expect.stringContaining('Fitosanitario')
        })
      );
    });

    test('should detect CITES controls for protected species', async () => {
      const expedition = {
        expeditionId: 'EXP-003',
        goods: [{
          itemNumber: 1,
          description: 'Exotic birds',
          taricCode: '0106390000',
          originCountry: 'BR',
          quantity: 5,
          unit: 'NAR',
          grossWeight: 10
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const citesControl = controls.find(c => c.subType && c.subType.includes('cites'));
      expect(citesControl).toBeDefined();
      expect(citesControl.priority).toBe('critical');
      expect(citesControl.documents).toContainEqual(
        expect.objectContaining({
          code: 'Y926',
          name: expect.stringContaining('CITES')
        })
      );
    });

    test('should detect pharmaceutical controls (AEMPS)', async () => {
      const expedition = {
        expeditionId: 'EXP-004',
        goods: [{
          itemNumber: 1,
          description: 'Medicaments',
          taricCode: '3004200000',
          originCountry: 'CN',
          quantity: 100,
          unit: 'NAR',
          grossWeight: 50
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const pharmaControl = controls.find(c => c.controlType === 'AEMPS');
      expect(pharmaControl).toBeDefined();
      expect(pharmaControl.subType).toBe('pharmaceuticals');
      expect(pharmaControl.inspectionRequired).toBe(true);
    });

    test('should detect textile controls (SOIVRE)', async () => {
      const expedition = {
        expeditionId: 'EXP-005',
        goods: [{
          itemNumber: 1,
          description: 'Cotton t-shirts',
          taricCode: '6109100000',
          originCountry: 'BD',
          quantity: 500,
          unit: 'NAR',
          grossWeight: 100
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const textileControl = controls.find(c => c.controlType === 'SOIVRE');
      expect(textileControl).toBeDefined();
      expect(textileControl.subType).toBe('textiles');
    });

    test('should not require controls for standard goods (Chapter 40)', async () => {
      const expedition = {
        expeditionId: 'EXP-006',
        goods: [{
          itemNumber: 1,
          description: 'Rubber tires',
          taricCode: '4011100000',
          originCountry: 'DE',
          quantity: 50,
          unit: 'NAR',
          grossWeight: 1000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      // Chapter 40 (rubber) has no mandatory controls
      expect(controls.length).toBe(0);
    });

    test('should handle expedition with multiple goods requiring different controls', async () => {
      const expedition = {
        expeditionId: 'EXP-007',
        goods: [
          {
            itemNumber: 1,
            description: 'Fresh apples',
            taricCode: '0808100000',
            originCountry: 'CL',
            quantity: 500,
            unit: 'KGM',
            grossWeight: 500
          },
          {
            itemNumber: 2,
            description: 'Canned meat',
            taricCode: '1602500000',
            originCountry: 'AR',
            quantity: 200,
            unit: 'KGM',
            grossWeight: 220
          }
        ]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      // Should detect both phytosanitary and sanitary controls
      expect(controls.length).toBeGreaterThan(0);
      const controlTypes = controls.map(c => c.subType);
      expect(controlTypes).toContain('phytosanitary');
      expect(controlTypes).toContain('food_safety');
    });

    test('should increase priority for high-risk origin countries', async () => {
      const expedition = {
        expeditionId: 'EXP-008',
        goods: [{
          itemNumber: 1,
          description: 'Fresh meat',
          taricCode: '0201100000',
          originCountry: 'CN', // High risk country for veterinary
          quantity: 1000,
          unit: 'KGM',
          grossWeight: 1000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const vetControl = controls.find(c => c.subType === 'veterinary');
      expect(vetControl).toBeDefined();
      expect(vetControl.priority).toBe('high');
      expect(vetControl.notes).toContain('alto riesgo');
    });
  });

  describe('createControlsForExpedition', () => {
    test('should create controls for expedition with required checks', async () => {
      const mockExpedition = {
        _id: 'exp123',
        expeditionId: 'EXP-001',
        goods: [{
          itemNumber: 1,
          description: 'Fresh vegetables',
          taricCode: '0701000000',
          originCountry: 'MA',
          quantity: 500,
          unit: 'KGM',
          grossWeight: 500
        }],
        timeline: [],
        save: jest.fn().mockResolvedValue(true)
      };

      Expedition.findById.mockResolvedValue(mockExpedition);
      ParaduaneroControl.findOne.mockResolvedValue(null);

      const user = { _id: 'user123', name: 'Test User' };

      // Since the service creates controls internally, we just verify the expedition was found
      await expect(
        paraduaneroService.createControlsForExpedition('exp123', user)
      ).resolves.toBeDefined();

      expect(Expedition.findById).toHaveBeenCalledWith('exp123');
    });

    test('should not create duplicate controls', async () => {
      const mockExpedition = {
        _id: 'exp123',
        expeditionId: 'EXP-001',
        goods: [{
          taricCode: '0701000000',
          originCountry: 'MA'
        }],
        timeline: [],
        save: jest.fn()
      };

      const existingControl = {
        _id: 'ctrl123',
        controlType: 'MAPA',
        subType: 'phytosanitary'
      };

      Expedition.findById.mockResolvedValue(mockExpedition);
      ParaduaneroControl.findOne.mockResolvedValue(existingControl);

      const user = { _id: 'user123', name: 'Test User' };
      const controls = await paraduaneroService.createControlsForExpedition('exp123', user);

      // Should not create new control if one exists
      expect(controls.length).toBe(0);
    });

    test('should throw error if expedition not found', async () => {
      Expedition.findById.mockResolvedValue(null);

      const user = { _id: 'user123' };

      await expect(
        paraduaneroService.createControlsForExpedition('nonexistent', user)
      ).rejects.toThrow('Expediente no encontrado');
    });
  });

  describe('getStats', () => {
    test('should calculate statistics for controls', async () => {
      const mockStats = [
        {
          _id: 'MAPA',
          total: 10,
          pending: 3,
          inProgress: 4,
          approved: 2,
          rejected: 1
        },
        {
          _id: 'SANIDAD',
          total: 5,
          pending: 1,
          inProgress: 2,
          approved: 2,
          rejected: 0
        }
      ];

      ParaduaneroControl.aggregate.mockResolvedValue(mockStats);

      const stats = await paraduaneroService.getStats();

      expect(ParaduaneroControl.aggregate).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    test('should filter statistics by date range', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      ParaduaneroControl.aggregate.mockResolvedValue([]);

      await paraduaneroService.getStats(filters);

      const aggregateCall = ParaduaneroControl.aggregate.mock.calls[0][0];
      expect(aggregateCall[0].$match.createdAt).toBeDefined();
    });
  });

  describe('TARIC Control Rules', () => {
    test('should apply correct controls for each chapter', async () => {
      const testCases = [
        { chapter: '01', expectedControl: 'MAPA', subType: 'veterinary' },
        { chapter: '07', expectedControl: 'MAPA', subType: 'phytosanitary' },
        { chapter: '30', expectedControl: 'AEMPS', subType: 'pharmaceuticals' },
        { chapter: '84', expectedControl: 'SOIVRE', subType: 'machinery' },
        { chapter: '95', expectedControl: 'SOIVRE', subType: 'toys' }
      ];

      for (const testCase of testCases) {
        const expedition = {
          expeditionId: `EXP-${testCase.chapter}`,
          goods: [{
            itemNumber: 1,
            description: `Test item for chapter ${testCase.chapter}`,
            taricCode: `${testCase.chapter}00000000`,
            originCountry: 'XX',
            quantity: 1,
            unit: 'NAR',
            grossWeight: 1
          }]
        };

        const controls = await paraduaneroService.analyzeExpedition(expedition);

        if (testCase.expectedControl) {
          expect(controls.length).toBeGreaterThan(0);
          expect(controls[0].controlType).toBe(testCase.expectedControl);
          expect(controls[0].subType).toBe(testCase.subType);
        }
      }
    });
  });
});
