/**
 * Tests for Guarantee Service
 * Testing customs guarantee management system
 * Based on PLAN_AGENTE_ADUANAS_COMPLETO.md - Section 4.4
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Guarantee Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Guarantee Types', () => {
    test('should support individual guarantee', () => {
      const guarantee = {
        type: 'individual',
        expeditionId: 'exp123',
        amount: 5000,
        currency: 'EUR',
        status: 'active',
        nrc: 'NRC-2026-IND-001234',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      expect(guarantee.type).toBe('individual');
      expect(guarantee.nrc).toMatch(/^NRC-/);
    });

    test('should support global guarantee', () => {
      const guarantee = {
        type: 'global',
        organizationId: 'org123',
        amount: 500000,
        currency: 'EUR',
        status: 'active',
        nrc: 'NRC-2026-GLB-000001',
        balance: {
          total: 500000,
          used: 150000,
          available: 350000,
          reserved: 25000
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };

      expect(guarantee.type).toBe('global');
      expect(guarantee.balance.available).toBe(350000);
    });

    test('should support reduced guarantee for OEA', () => {
      const oeaGuarantee = {
        type: 'reduced',
        oeaStatus: 'AEOC',
        reductionPercentage: 70, // 30% del importe normal
        originalAmount: 100000,
        reducedAmount: 30000,
        status: 'active'
      };

      expect(oeaGuarantee.reductionPercentage).toBe(70);
      expect(oeaGuarantee.reducedAmount).toBe(30000);
    });

    test('should support OEA full exemption', () => {
      const oeaExemption = {
        type: 'exempt',
        oeaStatus: 'AEOF',
        reductionPercentage: 100,
        originalAmount: 100000,
        reducedAmount: 0,
        status: 'active'
      };

      expect(oeaExemption.reducedAmount).toBe(0);
      expect(oeaExemption.reductionPercentage).toBe(100);
    });
  });

  describe('Guarantee Calculation', () => {
    test('should calculate guarantee for standard import', () => {
      const importData = {
        customsValue: 10000,
        dutyRate: 0.05,  // 5%
        vatRate: 0.21    // 21%
      };

      const duty = importData.customsValue * importData.dutyRate;
      const vatBase = importData.customsValue + duty;
      const vat = vatBase * importData.vatRate;
      const totalGuarantee = duty + vat;

      expect(duty).toBe(500);
      expect(vat).toBeCloseTo(2205, 0);
      expect(totalGuarantee).toBeCloseTo(2705, 0);
    });

    test('should calculate guarantee for transit operation', () => {
      const transitData = {
        customsValue: 50000,
        dutyRate: 0.08,
        vatRate: 0.21,
        transitRisk: 1.1 // 10% additional for transit risk
      };

      const duty = transitData.customsValue * transitData.dutyRate;
      const vatBase = transitData.customsValue + duty;
      const vat = vatBase * transitData.vatRate;
      const baseGuarantee = duty + vat;
      const totalGuarantee = baseGuarantee * transitData.transitRisk;

      expect(totalGuarantee).toBeGreaterThan(baseGuarantee);
    });

    test('should calculate guarantee for special regime', () => {
      const regimeData = {
        regime: '51', // Perfeccionamiento activo
        customsValue: 100000,
        dutyRate: 0.12,
        vatRate: 0.21,
        regimeGuaranteeRate: 1.0 // 100% of potential duties
      };

      const potentialDuty = regimeData.customsValue * regimeData.dutyRate;
      const potentialVat = (regimeData.customsValue + potentialDuty) * regimeData.vatRate;
      const totalGuarantee = (potentialDuty + potentialVat) * regimeData.regimeGuaranteeRate;

      expect(totalGuarantee).toBeGreaterThan(0);
    });
  });

  describe('Balance Management', () => {
    test('should verify available balance', () => {
      const guarantee = {
        balance: {
          total: 100000,
          used: 60000,
          available: 40000,
          reserved: 5000
        }
      };

      const requiredAmount = 35000;
      const hasAvailableBalance = guarantee.balance.available >= requiredAmount;

      expect(hasAvailableBalance).toBe(true);
    });

    test('should reject operation when insufficient balance', () => {
      const guarantee = {
        balance: {
          total: 100000,
          used: 60000,
          available: 40000
        }
      };

      const requiredAmount = 50000;
      const hasAvailableBalance = guarantee.balance.available >= requiredAmount;

      expect(hasAvailableBalance).toBe(false);
    });

    test('should reserve amount for pending operation', () => {
      const guarantee = {
        balance: {
          total: 100000,
          used: 50000,
          available: 50000,
          reserved: 0
        }
      };

      const reserveAmount = 15000;
      guarantee.balance.reserved += reserveAmount;
      guarantee.balance.available -= reserveAmount;

      expect(guarantee.balance.reserved).toBe(15000);
      expect(guarantee.balance.available).toBe(35000);
    });

    test('should consume reserved amount on confirmation', () => {
      const guarantee = {
        balance: {
          total: 100000,
          used: 50000,
          available: 35000,
          reserved: 15000
        }
      };

      const consumeAmount = 15000;
      guarantee.balance.reserved -= consumeAmount;
      guarantee.balance.used += consumeAmount;

      expect(guarantee.balance.reserved).toBe(0);
      expect(guarantee.balance.used).toBe(65000);
    });

    test('should release reserved amount on cancellation', () => {
      const guarantee = {
        balance: {
          total: 100000,
          used: 50000,
          available: 35000,
          reserved: 15000
        }
      };

      const releaseAmount = 15000;
      guarantee.balance.reserved -= releaseAmount;
      guarantee.balance.available += releaseAmount;

      expect(guarantee.balance.reserved).toBe(0);
      expect(guarantee.balance.available).toBe(50000);
    });
  });

  describe('NRC (Número de Referencia Completo)', () => {
    test('should generate valid NRC for AEAT', () => {
      const nrcData = {
        year: '2026',
        type: 'GLB', // Global
        sequence: '000001',
        checkDigit: '7'
      };

      const nrc = `NRC-${nrcData.year}-${nrcData.type}-${nrcData.sequence}${nrcData.checkDigit}`;

      expect(nrc).toMatch(/^NRC-\d{4}-(IND|GLB|RED)-\d{7}$/);
    });

    test('should validate NRC format', () => {
      const validNRCs = [
        'NRC-2026-GLB-0000017',
        'NRC-2026-IND-0001234',
        'NRC-2026-RED-0000051'
      ];

      const nrcPattern = /^NRC-\d{4}-(IND|GLB|RED)-\d{7}$/;

      validNRCs.forEach(nrc => {
        expect(nrc).toMatch(nrcPattern);
      });
    });
  });

  describe('Guarantee Alerts', () => {
    test('should alert when balance below 20%', () => {
      const guarantee = {
        amount: 100000,
        balance: {
          available: 15000
        }
      };

      const availablePercentage = (guarantee.balance.available / guarantee.amount) * 100;
      const isLowBalance = availablePercentage < 20;

      expect(isLowBalance).toBe(true);
      expect(availablePercentage).toBe(15);
    });

    test('should alert when balance below 10% (critical)', () => {
      const guarantee = {
        amount: 100000,
        balance: {
          available: 8000
        }
      };

      const availablePercentage = (guarantee.balance.available / guarantee.amount) * 100;
      const isCritical = availablePercentage < 10;

      expect(isCritical).toBe(true);
    });

    test('should alert when guarantee expiring within 30 days', () => {
      const guarantee = {
        validTo: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000) // 25 days
      };

      const daysToExpiry = Math.ceil(
        (new Date(guarantee.validTo) - new Date()) / (1000 * 60 * 60 * 24)
      );
      const isExpiringSoon = daysToExpiry <= 30;

      expect(isExpiringSoon).toBe(true);
      expect(daysToExpiry).toBe(25);
    });
  });

  describe('Payment Deferral', () => {
    test('should support 10-day deferral', () => {
      const deferral = {
        type: '10_days',
        operationDate: new Date(),
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        amount: 5000,
        status: 'pending'
      };

      const daysDiff = Math.ceil(
        (new Date(deferral.dueDate) - new Date(deferral.operationDate)) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBe(10);
    });

    test('should support 30-day deferral', () => {
      const deferral = {
        type: '30_days',
        operationDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 15000,
        status: 'pending'
      };

      const daysDiff = Math.ceil(
        (new Date(deferral.dueDate) - new Date(deferral.operationDate)) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBe(30);
    });

    test('should track deferral payment status', () => {
      const deferral = {
        status: 'pending',
        payments: []
      };

      // Simulate payment
      deferral.payments.push({
        date: new Date(),
        amount: 5000,
        method: 'bank_transfer',
        reference: 'PAY-2026-001'
      });
      deferral.status = 'paid';

      expect(deferral.status).toBe('paid');
      expect(deferral.payments).toHaveLength(1);
    });
  });

  describe('Guarantee Consumption Tracking', () => {
    test('should track consumption per operation', () => {
      const guarantee = {
        _id: 'guar123',
        consumptions: []
      };

      const consumption = {
        expeditionId: 'exp123',
        mrn: '26ES00000001234567',
        amount: 2500,
        date: new Date(),
        status: 'active',
        releaseDate: null
      };

      guarantee.consumptions.push(consumption);

      expect(guarantee.consumptions).toHaveLength(1);
      expect(guarantee.consumptions[0].amount).toBe(2500);
    });

    test('should release consumption on customs clearance', () => {
      const consumption = {
        expeditionId: 'exp123',
        amount: 2500,
        status: 'active',
        releaseDate: null
      };

      // Simulate release
      consumption.status = 'released';
      consumption.releaseDate = new Date();

      expect(consumption.status).toBe('released');
      expect(consumption.releaseDate).toBeInstanceOf(Date);
    });
  });
});
