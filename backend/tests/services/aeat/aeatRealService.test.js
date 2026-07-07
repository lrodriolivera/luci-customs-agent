/**
 * Tests for AEAT Real Service
 * Phase 6.1: Real AEAT Integration Tests
 */

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock aiService
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn().mockResolvedValue({
    summary: 'Test LUCI analysis',
    recommendations: ['Test recommendation']
  })
}));

// Mock certificateService
jest.mock('../../../src/services/aeat/certificateService', () => ({
  getCertificateForSigning: jest.fn().mockResolvedValue({
    alias: 'test-cert',
    privateKey: 'mock-key',
    certificate: 'mock-cert',
    chain: []
  }),
  validateCertificateForOperation: jest.fn().mockResolvedValue({
    valid: true,
    certificate: { alias: 'test-cert' }
  })
}));

// Mock xadesSignatureService
jest.mock('../../../src/services/aeat/xadesSignatureService', () => ({
  signForAEAT: jest.fn().mockResolvedValue({
    success: true,
    signedXml: '<SignedXML>test</SignedXML>',
    signatureId: 'SIG-001',
    timestamp: new Date().toISOString()
  }),
  verifyAEATResponse: jest.fn().mockResolvedValue({
    valid: true
  })
}));

const aeatRealService = require('../../../src/services/aeat/aeatRealService');

describe('AEAT Real Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Configuration', () => {
    test('should have defined services', () => {
      expect(aeatRealService.SERVICES).toBeDefined();
    });

    test('should have environment configuration', () => {
      expect(aeatRealService.environment).toBeDefined();
      expect(aeatRealService.environment).toHaveProperty('name');
      expect(aeatRealService.environment).toHaveProperty('baseUrl');
    });

    test('should have HTTP configuration', () => {
      expect(aeatRealService.httpConfig).toBeDefined();
      expect(aeatRealService.httpConfig).toHaveProperty('timeout');
      expect(aeatRealService.httpConfig).toHaveProperty('maxRetries');
    });
  });

  describe('Service Methods Exist', () => {
    test('should have submitAESDeclaration method', () => {
      expect(typeof aeatRealService.submitAESDeclaration).toBe('function');
    });

    test('should have submitNCTSDeclaration method', () => {
      expect(typeof aeatRealService.submitNCTSDeclaration).toBe('function');
    });

    test('should have queryDeclarationStatus method', () => {
      expect(typeof aeatRealService.queryDeclarationStatus).toBe('function');
    });

    test('should have getInbox method', () => {
      expect(typeof aeatRealService.getInbox).toBe('function');
    });

    test('should have submitDigitalDocuments method', () => {
      expect(typeof aeatRealService.submitDigitalDocuments).toBe('function');
    });

    test('should have testConnectivity method', () => {
      expect(typeof aeatRealService.testConnectivity).toBe('function');
    });
  });

  describe('LUCI Validation', () => {
    test('should have pre-submit validation method', () => {
      expect(typeof aeatRealService._luciPreSubmitValidation).toBe('function');
    });

    test('should validate missing XML', async () => {
      const result = await aeatRealService._luciPreSubmitValidation(
        '',
        { code: 'H1_SUBMIT' },
        {}
      );
      expect(result.canSubmit).toBe(false);
    });

    test('should pass validation for valid XML with required fields', async () => {
      const validXml = `<?xml version="1.0"?>
        <ImportacionCompletaV1Ent>
          <C14Declarante><NIF>B12345678</NIF></C14Declarante>
          <Partida><NumeroPartida>1</NumeroPartida></Partida>
          <C42ValorFactura>10000</C42ValorFactura>
          <C3312CodigoPosicionTaric>8517120000</C3312CodigoPosicionTaric>
        </ImportacionCompletaV1Ent>`;

      const result = await aeatRealService._luciPreSubmitValidation(
        validXml,
        { code: 'H1_SUBMIT' },
        {}
      );
      expect(result.canSubmit).toBe(true);
    });
  });

  describe('Channel Analysis', () => {
    test('should get channel description', () => {
      const greenDesc = aeatRealService._getChannelDescription('green');
      const orangeDesc = aeatRealService._getChannelDescription('orange');
      const redDesc = aeatRealService._getChannelDescription('red');

      expect(greenDesc).toBeDefined();
      expect(greenDesc.toLowerCase()).toContain('verde');
      expect(orangeDesc.toLowerCase()).toContain('naranja');
      expect(redDesc.toLowerCase()).toContain('rojo');
    });

    test('should get channel actions', () => {
      const greenActions = aeatRealService._getChannelActions('green');
      const orangeActions = aeatRealService._getChannelActions('orange');
      const redActions = aeatRealService._getChannelActions('red');

      expect(Array.isArray(greenActions)).toBe(true);
      expect(Array.isArray(orangeActions)).toBe(true);
      expect(Array.isArray(redActions)).toBe(true);
    });
  });

  describe('Status Interpretation', () => {
    test('should interpret declaration status', () => {
      const released = aeatRealService._interpretStatus('RELEASED', 'H1');
      const pending = aeatRealService._interpretStatus('PENDING', 'H1');

      expect(released).toBeDefined();
      expect(pending).toBeDefined();
    });

    test('should provide status recommendations', () => {
      const recs = aeatRealService._getStatusRecommendations('RELEASED', 'H1');
      expect(Array.isArray(recs)).toBe(true);
    });
  });

  describe('Critical Fields', () => {
    test('should return critical fields for H1', () => {
      const fields = aeatRealService._getCriticalFields('H1_SUBMIT');
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });

    test('should return critical fields for AES', () => {
      const fields = aeatRealService._getCriticalFields('AES_SUBMIT');
      expect(Array.isArray(fields)).toBe(true);
    });
  });

  describe('SOAP Envelope Building', () => {
    test('should build SOAP envelope with correct structure', () => {
      const service = {
        code: 'TEST',
        operation: 'testOperation',
        soapAction: 'urn:test'
      };

      const envelope = aeatRealService._buildSOAPEnvelope(service, '<Content>test</Content>');

      expect(envelope).toContain('soapenv:Envelope');
      expect(envelope).toContain('soapenv:Body');
      expect(envelope).toContain('<Content>test</Content>');
    });
  });

  describe('Connectivity Test', () => {
    test('should return connectivity result object', async () => {
      const result = await aeatRealService.testConnectivity();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('connectivity');
    });
  });

  describe('Error Recovery', () => {
    test('should provide error recovery steps', () => {
      const steps = aeatRealService._getErrorRecoverySteps('INVALID_SIGNATURE');
      expect(Array.isArray(steps)).toBe(true);
    });

    test('should provide generic steps for unknown errors', () => {
      const steps = aeatRealService._getErrorRecoverySteps('UNKNOWN_ERROR_CODE');
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe('Response Processing', () => {
    test('should have submission response processor', () => {
      expect(typeof aeatRealService._processSubmissionResponse).toBe('function');
    });

    test('should have query response processor', () => {
      expect(typeof aeatRealService._processQueryResponse).toBe('function');
    });
  });

  describe('LUCI Analysis Methods', () => {
    test('should have response analysis method', () => {
      expect(typeof aeatRealService._luciResponseAnalysis).toBe('function');
    });

    test('should have status analysis method', () => {
      expect(typeof aeatRealService._luciStatusAnalysis).toBe('function');
    });

    test('should have inbox analysis method', () => {
      expect(typeof aeatRealService._luciInboxAnalysis).toBe('function');
    });

    test('should have error analysis method', () => {
      expect(typeof aeatRealService._luciSubmissionErrorAnalysis).toBe('function');
    });
  });
});
