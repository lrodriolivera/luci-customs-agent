/**
 * Tests for Certificate Service
 * Phase 6.1: Digital Certificate Management Tests
 */

// Mock logger first
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock aiService
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn().mockResolvedValue({
    summary: 'Certificate analysis complete',
    recommendations: ['Certificate is valid'],
    warnings: []
  })
}));

// Mock node-forge
jest.mock('node-forge', () => ({
  pki: {
    oids: {
      certBag: '1.2.840.113549.1.12.10.1.3',
      pkcs8ShroudedKeyBag: '1.2.840.113549.1.12.10.1.2'
    },
    certificateFromPem: jest.fn().mockReturnValue({
      serialNumber: 'ABC123',
      validity: {
        notBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        notAfter: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000)
      },
      subject: {
        getField: jest.fn().mockImplementation((field) => {
          const fields = { CN: { value: 'Test Company' }, O: { value: 'Test Org' }, serialNumber: { value: 'B12345678' } };
          return fields[field] || { value: '' };
        })
      },
      issuer: {
        getField: jest.fn().mockImplementation((field) => {
          const fields = { CN: { value: 'FNMT' }, O: { value: 'FNMT-RCM' } };
          return fields[field] || { value: '' };
        })
      },
      publicKey: { n: { bitLength: () => 2048 } },
      extensions: [],
      getExtension: jest.fn().mockReturnValue(null)
    }),
    privateKeyToPem: jest.fn().mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----'),
    certificateToPem: jest.fn().mockReturnValue('-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----')
  },
  pkcs12: {
    pkcs12FromAsn1: jest.fn().mockReturnValue({
      getBags: jest.fn().mockImplementation(({ bagType }) => {
        const mockCert = {
          serialNumber: 'ABC123',
          validity: { notBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), notAfter: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000) },
          subject: { getField: jest.fn().mockReturnValue({ value: 'Test' }) },
          issuer: { getField: jest.fn().mockReturnValue({ value: 'FNMT-RCM' }) },
          publicKey: { n: { bitLength: () => 2048 } },
          extensions: [],
          getExtension: jest.fn().mockReturnValue(null)
        };
        return { [bagType]: [{ cert: mockCert, key: {} }] };
      })
    })
  },
  asn1: { fromDer: jest.fn().mockReturnValue({}) },
  util: {
    decode64: jest.fn().mockReturnValue('decoded'),
    createBuffer: jest.fn().mockReturnValue({ getBytes: () => 'bytes' })
  },
  md: {
    sha256: { create: jest.fn().mockReturnValue({ update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue({ toHex: () => 'abc123' }) }) }
  }
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('mock-certificate')),
  unlinkSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([])
}));

const certificateService = require('../../../src/services/aeat/certificateService');

describe('Certificate Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    certificateService.certificates = new Map();
  });

  describe('Certificate Types', () => {
    test('should define FNMT certificate types', () => {
      expect(certificateService.CERTIFICATE_TYPES).toBeDefined();
      expect(certificateService.CERTIFICATE_TYPES.FNMT_PF).toBeDefined();
      expect(certificateService.CERTIFICATE_TYPES.FNMT_PJ).toBeDefined();
      expect(certificateService.CERTIFICATE_TYPES.FNMT_REP).toBeDefined();
    });

    test('should have correct properties for each type', () => {
      const pjType = certificateService.CERTIFICATE_TYPES.FNMT_PJ;
      expect(pjType).toHaveProperty('name');
      expect(pjType).toHaveProperty('issuer');
      expect(pjType).toHaveProperty('usages');
      expect(pjType).toHaveProperty('validFor');
    });
  });

  describe('Certificate Status', () => {
    test('should define certificate statuses', () => {
      expect(certificateService.CERTIFICATE_STATUS).toBeDefined();
      expect(certificateService.CERTIFICATE_STATUS.ACTIVE).toBe('active');
      expect(certificateService.CERTIFICATE_STATUS.EXPIRED).toBe('expired');
      expect(certificateService.CERTIFICATE_STATUS.REVOKED).toBe('revoked');
    });
  });

  describe('Alert Thresholds', () => {
    test('should define alert thresholds', () => {
      expect(certificateService.ALERT_THRESHOLDS).toBeDefined();
      expect(certificateService.ALERT_THRESHOLDS.CRITICAL).toBe(7);
      expect(certificateService.ALERT_THRESHOLDS.WARNING).toBe(30);
      expect(certificateService.ALERT_THRESHOLDS.INFO).toBe(60);
    });
  });

  describe('Service Methods', () => {
    test('should have importCertificate method', () => {
      expect(typeof certificateService.importCertificate).toBe('function');
    });

    test('should have listCertificates method', () => {
      expect(typeof certificateService.listCertificates).toBe('function');
    });

    test('should have getCertificateForSigning method', () => {
      expect(typeof certificateService.getCertificateForSigning).toBe('function');
    });

    test('should have validateCertificateForOperation method', () => {
      expect(typeof certificateService.validateCertificateForOperation).toBe('function');
    });

    test('should have deleteCertificate method', () => {
      expect(typeof certificateService.deleteCertificate).toBe('function');
    });

    test('should have verifyCertificateStatus method', () => {
      expect(typeof certificateService.verifyCertificateStatus).toBe('function');
    });

    test('should have getRenewalAlerts method', () => {
      expect(typeof certificateService.getRenewalAlerts).toBe('function');
    });
  });

  describe('List Certificates', () => {
    test('should return array of certificates', async () => {
      const certificates = await certificateService.listCertificates();
      // listCertificates returns an array (could be empty)
      expect(Array.isArray(certificates)).toBe(true);
    });

    test('should include certificate info in list', async () => {
      certificateService.certificates.set('test-id', {
        id: 'test-id',
        type: 'FNMT_PJ',
        subject: { CN: 'Test' },
        issuer: { CN: 'FNMT' },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'active',
        metadata: {}
      });

      const certificates = await certificateService.listCertificates();
      expect(certificates.length).toBeGreaterThanOrEqual(1);
      const testCert = certificates.find(c => c.id === 'test-id');
      expect(testCert).toBeDefined();
    });
  });

  describe('Certificate Validation', () => {
    test('should validate certificate for operation', async () => {
      certificateService.certificates.set('test-cert', {
        id: 'test-cert',
        type: 'FNMT_PJ',
        subject: { CN: 'Test Company', serialNumber: 'B12345678' },
        issuer: { CN: 'FNMT-RCM' },
        validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        validTo: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
        status: 'active',
        keyUsage: ['digitalSignature'],
        metadata: {}
      });

      const result = await certificateService.validateCertificateForOperation('test-cert', 'H1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('valid');
    });

    test('should fail validation for non-existent certificate', async () => {
      const result = await certificateService.validateCertificateForOperation('non-existent', 'H1');
      expect(result.valid).toBe(false);
    });
  });

  describe('Delete Certificate', () => {
    test('should delete an existing certificate', async () => {
      certificateService.certificates.set('to-delete', {
        id: 'to-delete',
        type: 'FNMT_PJ',
        status: 'active'
      });

      const result = await certificateService.deleteCertificate('to-delete');
      expect(result.success).toBe(true);
      expect(certificateService.certificates.has('to-delete')).toBe(false);
    });

    test('should fail to delete non-existent certificate', async () => {
      const result = await certificateService.deleteCertificate('non-existent');
      expect(result.success).toBe(false);
    });
  });

  describe('Renewal Alerts', () => {
    test('should return alerts for expiring certificates', async () => {
      certificateService.certificates.set('expiring-soon', {
        id: 'expiring-soon',
        type: 'FNMT_PJ',
        validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days
        status: 'active',
        subject: { CN: 'Test' }
      });

      const alerts = await certificateService.getRenewalAlerts();
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].level).toBe('warning');
    });
  });
});
