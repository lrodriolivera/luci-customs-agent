/**
 * Tests for H7 Service
 * Testing e-commerce declarations for low-value shipments
 */

// Mock logger before importing
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock models
jest.mock('../../src/models', () => ({
  H7Declaration: jest.fn(),
  Expedition: {
    findById: jest.fn()
  }
}));

const h7Service = require('../../src/services/h7Service');
const { H7Declaration, Expedition } = require('../../src/models');

describe('H7 Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkH7Eligibility', () => {
    test('should accept valid B2C shipment under 150 EUR', () => {
      const data = {
        operationType: 'B2C',
        items: [
          {
            description: 'T-shirt',
            taricCode: '6109100000',
            quantity: 2,
            totalValue: 30
          }
        ],
        sender: {
          address: { country: 'CN' }
        }
      };

      const result = h7Service.checkH7Eligibility(data);

      expect(result.eligible).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.calculatedValue).toBe(30);
    });

    test('should reject shipment exceeding 150 EUR', () => {
      const data = {
        items: [{
          totalValue: 200
        }]
      };

      const result = h7Service.checkH7Eligibility(data);

      expect(result.eligible).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALUE_EXCEEDED'
        })
      );
      expect(result.suggestion).toContain('H1');
    });

    test('should reject B2B shipment over 22 EUR', () => {
      const data = {
        operationType: 'B2B_LOW_VALUE',
        items: [{
          totalValue: 50
        }]
      };

      const result = h7Service.checkH7Eligibility(data);

      expect(result.eligible).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'B2B_LIMIT_EXCEEDED'
        })
      );
    });

    test('should reject tobacco products', () => {
      const data = {
        items: [{
          description: 'Cigarettes',
          taricCode: '2402200000',
          totalValue: 50
        }],
        sender: { address: { country: 'CN' } }
      };

      const result = h7Service.checkH7Eligibility(data);

      expect(result.eligible).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'RESTRICTED_GOODS'
        })
      );
    });

    test('should reject alcohol products', () => {
      const data = {
        items: [{
          description: 'Wine',
          taricCode: '2204210000',
          totalValue: 30
        }],
        sender: { address: { country: 'FR' } }
      };

      const result = h7Service.checkH7Eligibility(data);

      expect(result.eligible).toBe(false);
      const restrictedError = result.errors.find(e => e.code === 'RESTRICTED_GOODS');
      expect(restrictedError).toBeDefined();
      expect(restrictedError.message).toContain('Vino');
    });

    test('should reject weapons', () => {
      const data = {
        items: [{
          description: 'Firearm parts',
          taricCode: '9302000000',
          totalValue: 100
        }],
        sender: { address: { country: 'US' } }
      };

      const result = h7Service.checkH7Eligibility(data);

      expect(result.eligible).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'RESTRICTED_GOODS'
        })
      );
    });

    test('should reject shipments from sanctioned countries', () => {
      const data = {
        items: [{
          totalValue: 50
        }],
        sender: {
          address: { country: 'KP' } // North Korea
        }
      };

      const result = h7Service.checkH7Eligibility(data);

      expect(result.eligible).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SANCTIONED_COUNTRY'
        })
      );
    });

    test('should accept pharmaceuticals below value threshold if not restricted', () => {
      const data = {
        items: [{
          description: 'Vitamins',
          taricCode: '2106909200', // Dietary supplements, not medicines
          totalValue: 25
        }],
        sender: { address: { country: 'US' } }
      };

      const result = h7Service.checkH7Eligibility(data);

      // Should be eligible (not a restricted pharma code)
      expect(result.eligible).toBe(true);
    });
  });

  describe('calculateValues', () => {
    test('should calculate intrinsic value from items', () => {
      const data = {
        items: [
          { quantity: 2, unitValue: 15, totalValue: 30, netWeight: 0.5 },
          { quantity: 1, unitValue: 25, totalValue: 25, netWeight: 0.3 }
        ],
        totals: {
          shippingCost: 5,
          insuranceCost: 2
        },
        carrier: { code: 'DHL' }
      };

      const result = h7Service.calculateValues(data);

      expect(result.totals.intrinsicValue).toBe(55); // 30 + 25
      expect(result.totals.customsValue).toBe(62); // 55 + 5 + 2
      expect(result.totals.netWeight).toBe(0.8); // 0.5 + 0.3
    });

    test('should apply standard VAT rate (21%) by default', () => {
      const data = {
        items: [{
          taricCode: '9999000000', // Generic code
          totalValue: 100,
          netWeight: 1
        }],
        carrier: { code: 'DHL' }
      };

      const result = h7Service.calculateValues(data);

      expect(result.duties.vat.rate).toBe(21);
    });

    test('should apply reduced VAT rate (10%) for food', () => {
      const data = {
        items: [{
          taricCode: '0201100000', // Meat
          totalValue: 50,
          netWeight: 1
        }],
        carrier: { code: 'CORREOS' }
      };

      const result = h7Service.calculateValues(data);

      expect(result.duties.vat.rate).toBe(10);
    });

    test('should apply super-reduced VAT rate (4%) for basic foods', () => {
      const data = {
        items: [{
          taricCode: '0401200000', // Milk
          totalValue: 20,
          netWeight: 1
        }],
        carrier: { code: 'OTHER' }
      };

      const result = h7Service.calculateValues(data);

      expect(result.duties.vat.rate).toBe(4);
    });

    test('should apply correct handling fees by carrier', () => {
      // Test CORREOS
      const correosData = {
        items: [{ totalValue: 50, netWeight: 1 }],
        carrier: { code: 'CORREOS' },
        totals: {}
      };
      const correosResult = h7Service.calculateValues(correosData);
      expect(correosResult.duties.handlingFee).toBe(3.00);

      // Test DHL
      const dhlData = {
        items: [{ totalValue: 50, netWeight: 1 }],
        carrier: { code: 'DHL' },
        totals: {}
      };
      const dhlResult = h7Service.calculateValues(dhlData);
      expect(dhlResult.duties.handlingFee).toBe(0);

      // Test GLS
      const glsData = {
        items: [{ totalValue: 50, netWeight: 1 }],
        carrier: { code: 'GLS' },
        totals: {}
      };
      const glsResult = h7Service.calculateValues(glsData);
      expect(glsResult.duties.handlingFee).toBe(2.50);

      // Test default/UNKNOWN
      const unknownData = {
        items: [{ totalValue: 50, netWeight: 1 }],
        carrier: { code: 'UNKNOWN' },
        totals: {}
      };
      const unknownResult = h7Service.calculateValues(unknownData);
      expect(unknownResult.duties.handlingFee).toBe(2.00);
    });

    test('should detect VAT prepayment via IOSS', () => {
      const data = {
        items: [{ totalValue: 50, netWeight: 1 }],
        iossNumber: 'IM2760000001', // Valid IOSS format
        carrier: { code: 'DHL' }
      };

      const result = h7Service.calculateValues(data);

      expect(result.vatPrepaid).toBe(true);
      expect(result.duties.vat.prepaid).toBe(true);
    });

    test('should not mark VAT as prepaid if IOSS invalid', () => {
      const data = {
        items: [{ totalValue: 50, netWeight: 1 }],
        iossNumber: 'INVALID123',
        carrier: { code: 'DHL' }
      };

      const result = h7Service.calculateValues(data);

      expect(result.vatPrepaid).toBe(false);
      expect(result.duties.vat.prepaid).toBe(false);
    });
  });

  describe('validateIOSS', () => {
    test('should accept valid IOSS format', async () => {
      const result = await h7Service.validateIOSS('IM2760000001');

      expect(result.valid).toBe(true);
    });

    test('should reject invalid IOSS format', async () => {
      const result = await h7Service.validateIOSS('INVALID');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Formato invalido');
    });

    test('should recognize known IOSS platforms', async () => {
      const result = await h7Service.validateIOSS('IM2760000001'); // Amazon

      expect(result.valid).toBe(true);
      expect(result.platform).toContain('Amazon');
      expect(result.country).toBe('LU');
    });

    test('should accept unknown IOSS numbers with valid format', async () => {
      const result = await h7Service.validateIOSS('IM9999999999');

      expect(result.valid).toBe(true);
      expect(result.source).toBe('format_validation');
      expect(result.warning).toBeDefined();
    });

    test('should reject empty IOSS number', async () => {
      const result = await h7Service.validateIOSS('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no proporcionado');
    });
  });

  describe('createDeclaration', () => {
    test('should create valid H7 declaration', async () => {
      const data = {
        trackingNumber: 'TEST123456',
        operationType: 'B2C',
        carrier: { code: 'DHL', name: 'DHL Express' },
        sender: {
          name: 'China Seller',
          address: { country: 'CN' }
        },
        recipient: {
          name: 'Spanish Customer',
          taxId: '12345678Z',
          address: {
            street: 'Calle Test 1',
            city: 'Madrid',
            postalCode: '28001',
            country: 'ES'
          }
        },
        items: [{
          description: 'Phone case',
          taricCode: '3926909790',
          quantity: 1,
          unitValue: 10,
          totalValue: 10,
          netWeight: 0.1,
          countryOfOrigin: 'CN'
        }],
        totals: {
          intrinsicValue: 10,
          grossWeight: 0.15,
          packages: 1
        }
      };

      const mockDeclaration = {
        reference: 'H7-2024-001',
        status: 'draft',
        calculateDuties: jest.fn(),
        validateH7Eligibility: jest.fn().mockReturnValue({ eligible: true }),
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock H7Declaration constructor
      H7Declaration.mockImplementation(() => mockDeclaration);

      const result = await h7Service.createDeclaration(data, 'user123');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockDeclaration.calculateDuties).toHaveBeenCalled();
    });

    test('should reject ineligible declaration', async () => {
      const data = {
        items: [{
          totalValue: 200 // Exceeds limit
        }]
      };

      const result = await h7Service.createDeclaration(data, 'user123');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('submitToAEAT', () => {
    // Mock H7Declaration.findById for these tests
    beforeEach(() => {
      H7Declaration.findById = jest.fn();
    });

    test('should submit valid H7 declaration', async () => {
      const mockDeclaration = {
        _id: 'h7-123',
        reference: 'H7-2024-001',
        status: 'draft',
        totals: { customsValue: 50 },
        vatPrepaid: false,
        duties: { totalDue: 10.50 },
        validateH7Eligibility: jest.fn().mockReturnValue({ eligible: true }),
        calculateDuties: jest.fn(),
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      H7Declaration.findById.mockResolvedValue(mockDeclaration);

      const result = await h7Service.submitToAEAT('h7-123', 'user123');

      expect(result.success).toBe(true);
      expect(result.data.mrn).toBeDefined();
      expect(mockDeclaration.status).toBe('released'); // Auto-release for low value
      expect(mockDeclaration.save).toHaveBeenCalled();
    });

    test('should auto-release low-value shipments', async () => {
      const mockDeclaration = {
        status: 'draft',
        totals: { customsValue: 15 }, // Below 22 EUR
        vatPrepaid: false,
        duties: { totalDue: 3.15 },
        validateH7Eligibility: jest.fn().mockReturnValue({ eligible: true }),
        calculateDuties: jest.fn(),
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      H7Declaration.findById.mockResolvedValue(mockDeclaration);

      await h7Service.submitToAEAT('h7-123', 'user123');

      expect(mockDeclaration.status).toBe('released');
    });

    test('should auto-release IOSS prepaid shipments', async () => {
      const mockDeclaration = {
        status: 'draft',
        totals: { customsValue: 100 },
        vatPrepaid: true, // VAT already paid via IOSS
        duties: { totalDue: 0 },
        validateH7Eligibility: jest.fn().mockReturnValue({ eligible: true }),
        calculateDuties: jest.fn(),
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      H7Declaration.findById.mockResolvedValue(mockDeclaration);

      await h7Service.submitToAEAT('h7-123', 'user123');

      expect(mockDeclaration.status).toBe('released');
    });

    test('should not submit already submitted declaration', async () => {
      const mockDeclaration = {
        status: 'submitted'
      };

      H7Declaration.findById.mockResolvedValue(mockDeclaration);

      await expect(
        h7Service.submitToAEAT('h7-123', 'user123')
      ).rejects.toThrow('No se puede enviar declaracion en estado submitted');
    });
  });

  describe('detectValueFraud', () => {
    beforeEach(() => {
      H7Declaration.countDocuments = jest.fn();
    });

    test('should flag suspiciously low values', async () => {
      const declaration = {
        items: [{
          description: 'Smartphone',
          taricCode: '8517120000',
          unitValue: 5, // Way too low
          netWeight: 0.2
        }],
        sender: { name: 'Test Seller' },
        recipient: { taxId: '12345678Z' }
      };

      H7Declaration.countDocuments.mockResolvedValue(0);

      const result = await h7Service.detectValueFraud(declaration);

      expect(result.flagged).toBe(true);
      expect(result.flags).toContainEqual(
        expect.objectContaining({
          type: 'LOW_VALUE',
          severity: 'medium'
        })
      );
    });

    test('should flag frequent sender near limit', async () => {
      const declaration = {
        items: [{ unitValue: 145 }],
        sender: { name: 'Frequent Seller' },
        recipient: { taxId: '12345678Z' }
      };

      // Mock 6 recent shipments near limit
      H7Declaration.countDocuments
        .mockResolvedValueOnce(6) // Sender history
        .mockResolvedValueOnce(0); // Recipient history

      const result = await h7Service.detectValueFraud(declaration);

      expect(result.flagged).toBe(true);
      expect(result.flags).toContainEqual(
        expect.objectContaining({
          type: 'FREQUENT_SENDER',
          severity: 'high'
        })
      );
    });

    test('should flag splitting (multiple shipments to same recipient)', async () => {
      const declaration = {
        items: [{ unitValue: 100 }],
        sender: { name: 'Test Seller' },
        recipient: { taxId: '12345678Z' }
      };

      H7Declaration.countDocuments
        .mockResolvedValueOnce(0) // Sender history
        .mockResolvedValueOnce(3); // Recipient has 3 shipments in 24h

      const result = await h7Service.detectValueFraud(declaration);

      expect(result.flagged).toBe(true);
      expect(result.flags).toContainEqual(
        expect.objectContaining({
          type: 'SPLITTING',
          severity: 'high'
        })
      );
    });

    test('should calculate risk score based on flags', async () => {
      const declaration = {
        items: [{ unitValue: 1, taricCode: '8517120000' }],
        sender: { name: 'Test' },
        recipient: { taxId: '12345678Z' }
      };

      H7Declaration.countDocuments.mockResolvedValue(0);

      const result = await h7Service.detectValueFraud(declaration);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('processBatch', () => {
    test('should process multiple declarations', async () => {
      const declarations = [
        {
          trackingNumber: 'TRACK001',
          operationType: 'B2C',
          items: [{ totalValue: 50, netWeight: 0.5 }],
          sender: { address: { country: 'CN' } },
          carrier: { code: 'DHL' }
        },
        {
          trackingNumber: 'TRACK002',
          operationType: 'B2C',
          items: [{ totalValue: 30, netWeight: 0.3 }],
          sender: { address: { country: 'CN' } },
          carrier: { code: 'UPS' }
        }
      ];

      // Mock successful creation
      const mockDeclaration = {
        reference: 'H7-BATCH-001',
        calculateDuties: jest.fn(),
        validateH7Eligibility: jest.fn().mockReturnValue({ eligible: true }),
        save: jest.fn().mockResolvedValue(true)
      };

      const result = await h7Service.processBatch(declarations, 'user123');

      expect(result).toMatchObject({
        batchId: expect.stringContaining('BATCH-'),
        total: 2,
        successful: expect.any(Number),
        failed: expect.any(Number)
      });
      expect(result.declarations).toHaveLength(2);
    });

    test('should handle mix of successful and failed declarations', async () => {
      const declarations = [
        {
          trackingNumber: 'GOOD',
          items: [{ totalValue: 50, netWeight: 0.5 }],
          sender: { address: { country: 'CN' } },
          carrier: { code: 'DHL' }
        },
        {
          trackingNumber: 'BAD',
          items: [{ totalValue: 200, netWeight: 0.5 }], // Exceeds limit
          sender: { address: { country: 'CN' } },
          carrier: { code: 'DHL' }
        }
      ];

      const result = await h7Service.processBatch(declarations, 'user123');

      expect(result.total).toBe(2);
      expect(result.failed).toBeGreaterThan(0);
    });
  });

  describe('parseCSVBatch', () => {
    test('should parse CSV data into H7 declarations', () => {
      const csvData = `tracking,carrier,sender_name,recipient_name,recipient_nif,description,taric,valor,peso
TRACK001,DHL,China Shop,Juan Perez,12345678Z,Phone case,3926909790,15,0.2
TRACK002,UPS,China Shop,Maria Lopez,87654321X,T-shirt,6109100000,25,0.3`;

      const declarations = h7Service.parseCSVBatch(csvData);

      expect(declarations).toHaveLength(2);
      expect(declarations[0].trackingNumber).toBe('TRACK001');
      expect(declarations[0].carrier.code).toBe('DHL');
      expect(declarations[0].items[0].totalValue).toBe(15);
      expect(declarations[1].trackingNumber).toBe('TRACK002');
    });

    test('should handle CSV with missing optional fields', () => {
      const csvData = `tracking,valor
TRACK001,50
TRACK002,30`;

      const declarations = h7Service.parseCSVBatch(csvData);

      expect(declarations).toHaveLength(2);
      expect(declarations[0].trackingNumber).toBe('TRACK001');
      expect(declarations[0].items[0].totalValue).toBe(50);
    });

    test('should throw error for empty CSV', () => {
      expect(() => {
        h7Service.parseCSVBatch('');
      }).toThrow('CSV vacio o sin datos');
    });
  });

  describe('createFromExpedition', () => {
    test('should convert expedition to H7 declaration', async () => {
      const mockExpedition = {
        _id: 'exp123',
        reference: 'EXP-001',
        goods: [{
          description: 'Electronics',
          taricCode: '8517120000',
          quantity: 1,
          value: 80,
          weight: 0.5
        }],
        origin: { country: 'CN' },
        importer: {
          name: 'Spanish Customer',
          taxId: '12345678Z',
          address: 'Calle Test 1'
        },
        transport: { carrier: 'DHL' },
        totals: {
          grossWeight: 0.6,
          netWeight: 0.5,
          packages: 1
        }
      };

      Expedition.findById.mockResolvedValue(mockExpedition);

      const mockH7 = {
        calculateDuties: jest.fn(),
        validateH7Eligibility: jest.fn().mockReturnValue({ eligible: true }),
        save: jest.fn().mockResolvedValue(true)
      };

      H7Declaration.mockImplementation(() => mockH7);

      const result = await h7Service.createFromExpedition('exp123', 'user123');

      expect(Expedition.findById).toHaveBeenCalledWith('exp123');
      expect(result.success).toBe(true);
    });

    test('should reject expedition exceeding value limit', async () => {
      const mockExpedition = {
        goods: [{ value: 200 }]
      };

      Expedition.findById.mockResolvedValue(mockExpedition);

      const result = await h7Service.createFromExpedition('exp123', 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('excede limite H7');
    });
  });
});
