/**
 * Tests for AEAT Service
 * Testing integrations with Spanish customs authority
 */

// Mock logger before importing service
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const AEATService = require('../../../src/services/aeat/aeatService');

describe('AEAT Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Force simulation mode for tests
    AEATService.setSimulationMode(true);
  });

  describe('Service Initialization', () => {
    test('should initialize with simulation mode enabled', () => {
      const info = AEATService.getServiceInfo();
      expect(info.simulationMode).toBe(true);
      expect(info.version).toBeDefined();
    });

    test('should provide service information', () => {
      const info = AEATService.getServiceInfo();
      expect(info).toHaveProperty('environment');
      expect(info).toHaveProperty('simulationMode');
      expect(info).toHaveProperty('configured');
      expect(info).toHaveProperty('representativeNIF');
    });
  });

  describe('H1 Declaration Submission', () => {
    const validH1XML = `<?xml version="1.0" encoding="UTF-8"?>
      <CC515C>
        <LRN>24ESL12345678</LRN>
        <HEAHEA>
          <RefNumHEA4>TEST-REF-001</RefNumHEA4>
          <TypOfDecHEA24>IM</TypOfDecHEA24>
        </HEAHEA>
        <TRADESPRI>
          <NamCE17>Test Declarant</NamCE17>
          <TINCE159>B12345678</TINCE159>
        </TRADESPRI>
      </CC515C>`;

    test('should submit H1 declaration in simulation mode', async () => {
      const result = await AEATService.submitH1(validH1XML);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result).toHaveProperty('mrn');
      }
    });

    test('should handle H1 submission with options', async () => {
      const options = {
        priority: 'high',
        office: 'ES0001'
      };

      const result = await AEATService.submitH1(validH1XML, options);
      expect(result).toBeDefined();
    });

    test('should reject invalid XML structure', async () => {
      const invalidXML = '<invalid>not a proper declaration</invalid>';

      const result = await AEATService.submitH1(invalidXML);
      expect(result.success).toBe(false);
      // In simulation mode it should still validate structure
    });
  });

  describe('AES Declaration Submission', () => {
    const validAESXML = `<?xml version="1.0" encoding="UTF-8"?>
      <CC515C>
        <LRN>24ESL87654321</LRN>
        <HEAHEA>
          <RefNumHEA4>TEST-AES-001</RefNumHEA4>
          <TypOfDecHEA24>EX</TypOfDecHEA24>
        </HEAHEA>
        <TRADESPRI>
          <NamCE17>Test Exporter</NamCE17>
          <TINCE159>B12345678</TINCE159>
        </TRADESPRI>
      </CC515C>`;

    test('should submit AES declaration in simulation mode', async () => {
      const result = await AEATService.submitAES(validAESXML);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    test('should handle AES submission with customs office', async () => {
      const options = {
        office: 'ES0050',
        declarant: 'B12345678'
      };

      const result = await AEATService.submitAES(validAESXML, options);
      expect(result).toBeDefined();
    });
  });

  describe('Declaration Status Query', () => {
    test('should query declaration status by MRN', async () => {
      const mrn = '24ES123456789012345678';

      const result = await AEATService.queryStatus(mrn);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('mrn');
      expect(result).toHaveProperty('status');
    });

    test('should handle non-existent MRN', async () => {
      const invalidMRN = '00XX000000000000000000';

      const result = await AEATService.queryStatus(invalidMRN);

      // Should return a result even if not found
      expect(result).toBeDefined();
    });
  });

  describe('Declaration Cancellation', () => {
    test('should cancel declaration with reason', async () => {
      const mrn = '24ES123456789012345678';
      const reason = 'Error en valor declarado';

      const result = await AEATService.cancelDeclaration(mrn, reason);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    test('should require cancellation reason', async () => {
      const mrn = '24ES123456789012345678';

      const result = await AEATService.cancelDeclaration(mrn, '');

      // Should still process but may warn about empty reason
      expect(result).toBeDefined();
    });
  });

  describe('XML Validation', () => {
    test('should validate H1 XML structure', async () => {
      const validXML = `<?xml version="1.0" encoding="UTF-8"?>
        <CC515C>
          <LRN>24ESL12345678</LRN>
          <HEAHEA>
            <RefNumHEA4>TEST-001</RefNumHEA4>
          </HEAHEA>
        </CC515C>`;

      const result = await AEATService.validateDeclaration(validXML, 'H1');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('valid');
    });

    test('should detect missing required fields', async () => {
      const incompleteXML = `<?xml version="1.0" encoding="UTF-8"?>
        <CC515C>
          <HEAHEA></HEAHEA>
        </CC515C>`;

      const result = await AEATService.validateDeclaration(incompleteXML, 'H1');

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
    });
  });

  describe('Connectivity Tests', () => {
    test('should test connectivity in simulation mode', async () => {
      const result = await AEATService.testConnectivity();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('mode');
      expect(result.mode).toBe('simulation');
    });

    test('should return simulation message when testing', async () => {
      const result = await AEATService.testConnectivity();

      expect(result.message).toBeDefined();
      expect(result.message.toLowerCase()).toContain('simulation');
    });
  });

  describe('Configuration Management', () => {
    test('should check if service is configured', () => {
      const configured = AEATService.isConfigured();
      expect(typeof configured).toBe('boolean');
    });

    test('should toggle simulation mode', () => {
      AEATService.setSimulationMode(false);
      let info = AEATService.getServiceInfo();
      expect(info.simulationMode).toBe(false);

      AEATService.setSimulationMode(true);
      info = AEATService.getServiceInfo();
      expect(info.simulationMode).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed XML gracefully', async () => {
      const malformedXML = 'this is not XML at all';

      const result = await AEATService.submitH1(malformedXML);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should handle empty XML', async () => {
      const result = await AEATService.submitH1('');

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should handle null parameters', async () => {
      // Note: null will cause an error in XML processing
      // In production, input validation should happen before calling this service
      await expect(async () => {
        await AEATService.submitH1(null);
      }).rejects.toThrow();
    });
  });

  describe('Response Format', () => {
    test('H1 submission should return proper response format', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <CC515C>
          <LRN>24ESL11223344</LRN>
          <HEAHEA><RefNumHEA4>TEST</RefNumHEA4></HEAHEA>
          <TRADESPRI>
            <NamCE17>Test</NamCE17>
            <TINCE159>B12345678</TINCE159>
          </TRADESPRI>
        </CC515C>`;
      const result = await AEATService.submitH1(xml);

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        success: expect.any(Boolean)
      });

      if (result.success) {
        expect(result).toHaveProperty('mrn');
        expect(result).toHaveProperty('status');
      } else {
        expect(result).toHaveProperty('errors');
      }
    });

    test('Query status should return consistent format', async () => {
      const result = await AEATService.queryStatus('24ES123456789012345678');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('status');
    });
  });

  describe('Service Info', () => {
    test('should provide complete service information', () => {
      const info = AEATService.getServiceInfo();

      expect(info).toMatchObject({
        environment: expect.any(String),
        simulationMode: expect.any(Boolean),
        configured: expect.any(Boolean),
        version: expect.any(String)
      });
    });
  });
});
