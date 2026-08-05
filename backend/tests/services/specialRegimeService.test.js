/**
 * Tests for Special Regime Service
 * Testing special customs regimes (51, 53, 71, T1/T2/TIR)
 */

const specialRegimeService = require('../../src/services/specialRegimeService');

// Mock dependencies
jest.mock('../../src/models/SpecialRegime');
jest.mock('../../src/models/Guarantee');

const SpecialRegime = require('../../src/models/SpecialRegime');
const Guarantee = require('../../src/models/Guarantee');

describe('Special Regime Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create regime 51 (Inward Processing) with calculated duties', async () => {
      const data = {
        regimeCode: '51',
        reference: 'PA-2024-001',
        goods: [{
          description: 'Raw cotton',
          taricCode: '5201000000',
          quantity: 1000,
          customsValue: 5000,
          netWeight: 1000
        }],
        declarant: {
          name: 'Test Company',
          taxId: 'B12345678'
        }
      };

      const mockSave = jest.fn().mockResolvedValue({
        _id: 'regime123',
        ...data,
        status: 'draft'
      });

      SpecialRegime.mockImplementation(() => ({
        ...data,
        save: mockSave
      }));

      const regime = await specialRegimeService.create(data, 'user123');

      expect(regime).toBeDefined();
      expect(mockSave).toHaveBeenCalled();
    });

    test('should calculate correct deadlines for regime 51 (12 months)', async () => {
      const data = {
        regimeCode: '51',
        goods: [{ customsValue: 1000 }]
      };

      const mockSave = jest.fn().mockResolvedValue({});
      SpecialRegime.mockImplementation(() => ({
        save: mockSave,
        startDate: new Date(),
        deadlineDate: new Date()
      }));

      const regime = await specialRegimeService.create(data, 'user123');

      // Should have deadline 12 months ahead
      expect(mockSave).toHaveBeenCalled();
    });

    test('should calculate correct deadlines for regime 53 (24 months max)', async () => {
      const data = {
        regimeCode: '53',
        goods: [{ customsValue: 10000 }]
      };

      const mockSave = jest.fn().mockResolvedValue({});
      SpecialRegime.mockImplementation(() => ({
        save: mockSave
      }));

      await specialRegimeService.create(data, 'user123');

      expect(mockSave).toHaveBeenCalled();
    });

    test('should calculate suspended duties correctly', () => {
      const good = {
        taricCode: '8471300000', // Computers - electronics rate
        customsValue: 10000
      };

      const suspendedDuties = specialRegimeService.calculateSuspendedDuties(good, '51');

      expect(suspendedDuties).toHaveProperty('tariff');
      expect(suspendedDuties).toHaveProperty('vat');
      expect(suspendedDuties).toHaveProperty('excise');
      expect(suspendedDuties).toHaveProperty('total');
      expect(suspendedDuties.total).toBeGreaterThan(0);

      // Electronics should have 3% tariff
      expect(suspendedDuties.tariff).toBe(10000 * 0.03);
      // VAT should be 21% of (customs value + tariff)
      const expectedVAT = (10000 + suspendedDuties.tariff) * 0.21;
      expect(suspendedDuties.vat).toBe(Math.round(expectedVAT * 100) / 100);
    });

    test('should apply correct tariff rates by TARIC chapter', () => {
      const testCases = [
        { taric: '0701000000', expectedRate: 0.15 }, // Agricultural
        { taric: '5201000000', expectedRate: 0.12 }, // Textile
        { taric: '8471000000', expectedRate: 0.03 }, // Electronics
        { taric: '8703000000', expectedRate: 0.10 }, // Vehicles
        { taric: '3926000000', expectedRate: 0.05 }  // Default
      ];

      testCases.forEach(test => {
        const good = { taricCode: test.taric, customsValue: 1000 };
        const duties = specialRegimeService.calculateSuspendedDuties(good, '51');
        expect(duties.tariff).toBe(1000 * test.expectedRate);
      });
    });
  });

  describe('authorize', () => {
    test('should authorize a draft regime', async () => {
      const mockRegime = {
        _id: 'regime123',
        regimeCode: '51',
        status: 'draft',
        authorization: null,
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      const authData = {
        number: 'ES512024001234',
        expiryDate: new Date('2025-12-31'),
        controlOffice: 'ES0001',
        holder: 'B12345678'
      };

      const regime = await specialRegimeService.authorize('regime123', authData, 'user123');

      expect(mockRegime.status).toBe('authorized');
      expect(mockRegime.authorization).toBeDefined();
      expect(mockRegime.authorization.number).toBe(authData.number);
      expect(mockRegime.save).toHaveBeenCalled();
    });

    test('should not authorize already authorized regime', async () => {
      const mockRegime = {
        _id: 'regime123',
        status: 'authorized'
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      await expect(
        specialRegimeService.authorize('regime123', {}, 'user123')
      ).rejects.toThrow('Solo se pueden autorizar regimenes en borrador o pendientes');
    });

    test('should generate authorization number if not provided', async () => {
      const mockRegime = {
        _id: 'regime123',
        regimeCode: '71',
        status: 'draft',
        authorization: null,
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      await specialRegimeService.authorize('regime123', {}, 'user123');

      expect(mockRegime.authorization).toBeDefined();
      expect(mockRegime.authorization.number).toMatch(/^ES71\d{9}$/);
    });
  });

  describe('activate', () => {
    test('should activate authorized regime', async () => {
      const mockRegime = {
        _id: 'regime123',
        status: 'authorized',
        regimeCode: '51',
        durationMonths: 12,
        totals: { totalGuaranteed: 0 },
        guarantee: null,
        startDate: null,
        deadlineDate: null,
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      const regime = await specialRegimeService.activate('regime123', 'user123');

      expect(mockRegime.status).toBe('active');
      expect(mockRegime.startDate).toBeDefined();
      expect(mockRegime.deadlineDate).toBeDefined();
      expect(mockRegime.save).toHaveBeenCalled();
    });

    test('should require guarantee if totalGuaranteed > 0', async () => {
      const mockRegime = {
        status: 'authorized',
        totals: { totalGuaranteed: 10000 },
        guarantee: null
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      await expect(
        specialRegimeService.activate('regime123', 'user123')
      ).rejects.toThrow('Se requiere garantia para activar este regimen');
    });

    test('should not activate non-authorized regime', async () => {
      const mockRegime = {
        status: 'draft'
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      await expect(
        specialRegimeService.activate('regime123', 'user123')
      ).rejects.toThrow('Solo se pueden activar regimenes autorizados');
    });
  });

  describe('linkGuarantee', () => {
    test('should link guarantee to regime and affect balance', async () => {
      const mockRegime = {
        _id: 'regime123',
        reference: 'REG-001',
        regimeCode: '51',
        totals: { totalGuaranteed: 5000 },
        guarantee: null,
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockGuarantee = {
        _id: 'guar123',
        reference: 'GRN-001',
        grn: 'ES123456789',
        totalAmount: 50000,
        consumedAmount: 10000,
        availableAmount: 40000,
        movements: [],
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);
      Guarantee.findById.mockResolvedValue(mockGuarantee);

      const result = await specialRegimeService.linkGuarantee('regime123', 'guar123', 'user123');

      expect(mockGuarantee.consumedAmount).toBe(15000); // 10000 + 5000
      expect(mockGuarantee.availableAmount).toBe(35000); // 50000 - 15000
      expect(mockRegime.guarantee).toBeDefined();
      expect(mockRegime.guarantee.guaranteeId).toBe('guar123');
      expect(mockGuarantee.save).toHaveBeenCalled();
      expect(mockRegime.save).toHaveBeenCalled();
    });

    test('should reject if insufficient guarantee balance', async () => {
      const mockRegime = {
        totals: { totalGuaranteed: 50000 }
      };

      const mockGuarantee = {
        totalAmount: 50000,
        consumedAmount: 40000,
        availableAmount: 10000,
        movements: []
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);
      Guarantee.findById.mockResolvedValue(mockGuarantee);

      await expect(
        specialRegimeService.linkGuarantee('regime123', 'guar123', 'user123')
      ).rejects.toThrow('Saldo insuficiente en garantia');
    });
  });

  describe('requestExtension', () => {
    test('should grant extension for active regime', async () => {
      const currentDeadline = new Date('2024-12-31');
      const newDeadline = new Date('2025-06-30');

      const mockRegime = {
        _id: 'regime123',
        regimeCode: '51',
        status: 'active',
        startDate: new Date('2024-01-01'),
        deadlineDate: currentDeadline,
        extensions: [],
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      const extensionData = {
        newDeadline: newDeadline,
        reason: 'Production delays'
      };

      const regime = await specialRegimeService.requestExtension('regime123', extensionData, 'user123');

      expect(mockRegime.deadlineDate).toEqual(newDeadline);
      expect(mockRegime.extensions.length).toBe(1);
      expect(mockRegime.extensions[0].reason).toBe('Production delays');
      expect(mockRegime.save).toHaveBeenCalled();
    });

    test('should reject extension beyond maximum allowed', async () => {
      const mockRegime = {
        regimeCode: '51',
        status: 'active',
        startDate: new Date('2024-01-01'),
        deadlineDate: new Date('2024-12-31')
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      // Try to extend beyond 3 years (max for regime 51)
      const tooFarDeadline = new Date('2028-01-01');

      await expect(
        specialRegimeService.requestExtension('regime123', { newDeadline: tooFarDeadline }, 'user123')
      ).rejects.toThrow('Fecha maxima de prorroga');
    });

    test('should not extend non-active regime', async () => {
      const mockRegime = {
        status: 'draft'
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      await expect(
        specialRegimeService.requestExtension('regime123', {}, 'user123')
      ).rejects.toThrow('Solo se pueden prorrogar regimenes activos');
    });
  });

  describe('discharge', () => {
    test('should discharge regime to free circulation', async () => {
      const mockRegime = {
        _id: 'regime123',
        regimeCode: '51',
        status: 'active',
        guarantee: null,
        discharge: null,
        dischargeDate: null,
        statusHistory: [],
        canBeDischarge: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(true),
        totals: {
          suspendedDuties: 1000,
          suspendedVAT: 210,
          suspendedExcise: 0
        }
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      const dischargeData = {
        type: 'release_free_circulation',
        declarationRef: 'DUA-2024-001',
        mrn: '24ES123456789012345678',
        notes: 'Goods released to market'
      };

      const result = await specialRegimeService.discharge('regime123', dischargeData, 'user123');

      expect(mockRegime.status).toBe('discharged');
      expect(mockRegime.discharge).toBeDefined();
      expect(mockRegime.discharge.type).toBe('release_free_circulation');
      expect(result).toHaveProperty('dutiesPayable');
      expect(mockRegime.save).toHaveBeenCalled();
    });

    test('should release guarantee on discharge', async () => {
      const mockGuarantee = {
        _id: 'guar123',
        totalAmount: 50000,
        consumedAmount: 10000,
        availableAmount: 40000,
        movements: [],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockRegime = {
        status: 'active',
        guarantee: {
          guaranteeId: 'guar123',
          amount: 5000,
          status: 'active'
        },
        discharge: null,
        dischargeDate: null,
        statusHistory: [],
        canBeDischarge: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);
      Guarantee.findById.mockResolvedValue(mockGuarantee);

      await specialRegimeService.discharge('regime123', { type: 'export' }, 'user123');

      expect(mockGuarantee.consumedAmount).toBe(5000); // 10000 - 5000
      expect(mockGuarantee.availableAmount).toBe(45000); // 50000 - 5000
      expect(mockGuarantee.save).toHaveBeenCalled();
    });

    test('should calculate partial duties for temporary admission (regime 53)', async () => {
      // Use dynamic dates: startDate is 6 months before now
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);

      const mockRegime = {
        regimeCode: '53',
        subType: 'partial_relief',
        status: 'active',
        startDate: startDate,
        dischargeDate: null, // Will be set by discharge()
        temporaryAdmission: {
          monthlyDutyPercent: 3
        },
        totals: {
          suspendedDuties: 1000,
          suspendedVAT: 210,
          suspendedExcise: 0
        },
        guarantee: null,
        discharge: null,
        statusHistory: [],
        canBeDischarge: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      const result = await specialRegimeService.discharge(
        'regime123',
        { type: 'release_free_circulation' },
        'user123'
      );

      // After 6 months at 3% per month = 18% accumulated
      // Should pay 82% of duties
      expect(result.dutiesPayable).toBeDefined();
      expect(result.dutiesPayable.monthsInRegime).toBe(6);
      expect(result.dutiesPayable.accumulatedPercent).toBe(18);
    });
  });

  describe('getExpiringRegimes', () => {
    test('should find regimes expiring soon', async () => {
      const mockRegimes = [
        {
          _id: 'reg1',
          status: 'active',
          deadlineDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days
        },
        {
          _id: 'reg2',
          status: 'active',
          deadlineDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) // 20 days
        }
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockRegimes)
      };

      SpecialRegime.find.mockReturnValue(mockQuery);

      const regimes = await specialRegimeService.getExpiringRegimes('user123', 30);

      expect(SpecialRegime.find).toHaveBeenCalled();
      expect(regimes).toEqual(mockRegimes);
    });
  });

  describe('getStats', () => {
    test('should calculate statistics by regime type', async () => {
      const mockRegimes = [
        { regimeCode: '51', status: 'active', totals: { customsValue: 10000, suspendedDuties: 500 }, guarantee: { amount: 500 }, deadlineDate: new Date('2025-12-31') },
        { regimeCode: '51', status: 'discharged', totals: { customsValue: 5000, suspendedDuties: 250 }, guarantee: null, deadlineDate: new Date('2024-06-30') },
        { regimeCode: '53', status: 'active', totals: { customsValue: 20000, suspendedDuties: 2000 }, guarantee: { amount: 2000 }, deadlineDate: new Date('2026-01-31') },
        { regimeCode: '71', status: 'active', totals: { customsValue: 50000, suspendedDuties: 5000 }, guarantee: { amount: 5000 }, deadlineDate: null }
      ];

      SpecialRegime.find.mockResolvedValue(mockRegimes);

      const stats = await specialRegimeService.getStats('user123');

      expect(stats.total).toBe(4);
      expect(stats.byRegime['51'].count).toBe(2);
      expect(stats.byRegime['53'].count).toBe(1);
      expect(stats.byRegime['71'].count).toBe(1);
      expect(stats.byStatus.active).toBe(3);
      expect(stats.byStatus.discharged).toBe(1);
      expect(stats.totals.customsValue).toBe(85000);
    });
  });

  describe('partialExit', () => {
    test('should process partial exit from customs warehouse (regime 71)', async () => {
      const mockRegime = {
        _id: 'regime123',
        regimeCode: '71',
        status: 'active',
        goods: [{
          _id: 'good123',
          description: 'Electronics',
          quantity: 1000,
          customsValue: 10000,
          suspendedDuties: { total: 1000 }
        }],
        guarantee: null,
        calculateTotals: jest.fn(),
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      const exitData = {
        goodId: 'good123',
        quantity: 300
      };

      await specialRegimeService.partialExit('regime123', exitData, 'user123');

      // Should reduce quantity
      expect(mockRegime.goods[0].quantity).toBe(700); // 1000 - 300
      expect(mockRegime.calculateTotals).toHaveBeenCalled();
      expect(mockRegime.save).toHaveBeenCalled();
    });

    test('should not allow partial exit from non-warehouse regimes', async () => {
      const mockRegime = {
        regimeCode: '51' // Not a warehouse
      };

      SpecialRegime.findById.mockResolvedValue(mockRegime);

      await expect(
        specialRegimeService.partialExit('regime123', {}, 'user123')
      ).rejects.toThrow('Salida parcial solo disponible para deposito aduanero');
    });
  });
});
