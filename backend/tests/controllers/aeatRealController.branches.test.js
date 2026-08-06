/**
 * Tests EXCLUSIVOS para ramas sin cubrir de aeatRealController.js
 *
 * OBJETIVO: Subir cobertura de ramas de 75.91%B a ≥88%B.
 * Estas pruebas se enfocan en ramas no ejercitadas por los tests existentes
 * (.test.js y .db.test.js).
 *
 * Cobertura actual: 75.91%B (59 ramas sin cubrir de 245)
 * Meta: ≥88%B
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { Expedition } = require('../../src/models');

// Mocks
const mockCertService = {
  importCertificate: jest.fn(),
  listCertificates: jest.fn(),
  deleteCertificate: jest.fn(),
  verifyCertificateStatus: jest.fn(),
  validateCertificateForOperation: jest.fn(),
  analyzeCertificateWithLuci: jest.fn(),
  getCertificateForSigning: jest.fn()
};

const mockXadesService = {
  signForAEAT: jest.fn(),
  verifyAEATResponse: jest.fn()
};

const mockAeatRealService = {
  validateBeforeSubmit: jest.fn(),
  submitH1Declaration: jest.fn(),
  submitH7Declaration: jest.fn(),
  submitAESDeclaration: jest.fn(),
  submitNCTSDeclaration: jest.fn(),
  submitICS2Declaration: jest.fn(),
  queryDeclarationStatus: jest.fn(),
  getInbox: jest.fn(),
  submitDigitalDocuments: jest.fn(),
  testConnectivity: jest.fn(),
  reloadCertificate: jest.fn(),
  getInfo: jest.fn(),
  submitEMCSMovement: jest.fn(),
  querySILICIE: jest.fn(),
  SERVICES: { H1_STATUS: {}, AES_STATUS: {} },
  BASE_URLS: {
    SANDBOX: 'https://aeat.es/sandbox',
    PRODUCTION: 'https://aeat.es/production'
  },
  currentEnvironment: 'sandbox'
};

const mockStatusMonitor = {
  trackDeclaration: jest.fn(),
  listTrackedDeclarations: jest.fn(),
  refreshDeclarationStatus: jest.fn(),
  getActiveAlerts: jest.fn(),
  acknowledgeAlert: jest.fn(),
  predictInspectionChannel: jest.fn(),
  _analyzeStatusWithLuci: jest.fn(),
  alerts: []
};

const mockAiService = {
  askLuci: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../src/services/aeat', () => ({
  certificateService: mockCertService,
  xadesSignatureService: mockXadesService,
  aeatRealService: mockAeatRealService,
  aeatStatusMonitorService: mockStatusMonitor
}), { virtual: false });

jest.mock('../../src/services/aiService', () => mockAiService, { virtual: false });
jest.mock('../../src/config/logger', () => mockLogger, { virtual: false });

const aeatRealController = require('../../src/controllers/aeatRealController');

const TENANT_A = new mongoose.Types.ObjectId();
const USER_A = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Alice',
  email: 'alice@strixai.es',
  tenantId: TENANT_A,
  role: 'user'
};

function app(handler, metodo = 'post', ruta = '/r', user = USER_A) {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => {
    req.user = user;
    req.tenantId = String(user.tenantId);
    next();
  }, handler);
  return a;
}

async function crearExpedicion(overrides = {}) {
  const base = {
    tenantId: TENANT_A,
    operationType: 'import',
    transportMode: 'maritime',
    client: {
      companyName: 'Importadora SA',
      nif: 'B12345678'
    },
    goods: [{
      itemNumber: 1,
      description: 'Laptop computers',
      quantity: 10,
      invoiceValue: 5000
    }],
    declaration: {
      xmlContent: '<H1>Test declaration</H1>',
      status: 'draft'
    },
    ...overrides
  };
  const exp = new Expedition(base);
  await exp.save();
  return exp;
}

describe('aeatRealController - ramas sin cubrir', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAeatRealService.validateBeforeSubmit.mockResolvedValue({ isValid: true });
    mockStatusMonitor.trackDeclaration.mockResolvedValue({ tracked: true });
    mockAiService.askLuci.mockResolvedValue('Análisis OK');
  });

  // ============================================
  // RAMAS: listCertificates - subject/issuer como objeto vs string
  // Líneas 110, 113-114
  // ============================================
  describe('listCertificates - normalización de subject/issuer', () => {
    test('normaliza issuer cuando es objeto (línea 113)', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'c1',
            metadata: { alias: 'CERT-1' },
            type: 'FNMT_PJ',
            subject: { CN: 'STRIX AI', O: 'STRIX' },
            // issuer como objeto
            issuer: { CN: 'FNMT', O: 'Fábrica Nacional' },
            validFrom: '2025-01-01',
            validTo: '2027-01-01',
            daysToExpiry: 300,
            status: 'active'
          }
        ]
      });

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data[0].issuer).toBe('FNMT'); // CN toma precedencia
      expect(res.body.data[0].issuerDetails).toEqual({ CN: 'FNMT', O: 'Fábrica Nacional' });
    });

    test('normaliza issuer cuando CN falta pero O existe', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'c2',
            metadata: { alias: 'CERT-2' },
            type: 'FNMT_PJ',
            subject: { O: 'STRIX AI SL' }, // sin CN
            issuer: { O: 'Fábrica Nacional' }, // sin CN
            validFrom: '2025-01-01',
            validTo: '2027-01-01',
            daysToExpiry: 300,
            status: 'active'
          }
        ]
      });

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 110: subject sin CN → cae a O
      expect(res.body.data[0].subject).toBe('STRIX AI SL');
      // Línea 113: issuer sin CN → cae a O
      expect(res.body.data[0].issuer).toBe('Fábrica Nacional');
    });

    test('normaliza subject/issuer cuando son strings', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'c3',
            metadata: { alias: 'CERT-3' },
            type: 'FNMT_PF',
            subject: 'Jenifer Romero', // string
            issuer: 'FNMT Root', // string
            validFrom: '2025-01-01',
            validTo: '2027-01-01',
            daysToExpiry: 300,
            status: 'active'
          }
        ]
      });

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 110 rama else: subject ya es string
      expect(res.body.data[0].subject).toBe('Jenifer Romero');
      // Línea 113 rama else: issuer ya es string
      expect(res.body.data[0].issuer).toBe('FNMT Root');
      // Debe envolverlos en objeto para issuerDetails
      expect(res.body.data[0].subjectDetails).toEqual({ CN: 'Jenifer Romero' });
      expect(res.body.data[0].issuerDetails).toEqual({ CN: 'FNMT Root' });
    });

    test('maneja subject/issuer vacíos con fallback N/A', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'c4',
            metadata: { alias: 'CERT-4' },
            type: 'TEST',
            subject: {}, // objeto vacío
            issuer: {}, // objeto vacío
            validFrom: '2025-01-01',
            validTo: '2027-01-01',
            daysToExpiry: 300,
            status: 'active'
          }
        ]
      });

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Líneas 110 y 113: cuando objeto sin CN ni O → 'N/A'
      expect(res.body.data[0].subject).toBe('N/A');
      expect(res.body.data[0].issuer).toBe('N/A');
    });
  });

  // ============================================
  // RAMAS: getCertificateInfo - certificado no encontrado
  // Línea 147-152
  // ============================================
  describe('getCertificateInfo', () => {
    test('404 cuando el alias no existe', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          { id: 'c1', metadata: { alias: 'CERT-1' }, type: 'FNMT_PJ' }
        ]
      });

      const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
        .get('/r/CERT-INEXISTENTE');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/no encontrado/i);
      expect(mockCertService.analyzeCertificateWithLuci).not.toHaveBeenCalled();
    });

    test('200 cuando el alias existe', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'c1',
            metadata: { alias: 'CERT-OK' },
            type: 'FNMT_PJ',
            subject: { CN: 'STRIX' },
            validFrom: '2025-01-01',
            validTo: '2027-01-01'
          }
        ]
      });

      mockCertService.analyzeCertificateWithLuci.mockResolvedValue({
        status: 'valid',
        message: 'Certificado válido'
      });

      const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
        .get('/r/CERT-OK');

      expect(res.status).toBe(200);
      expect(res.body.data.certificate.type).toBe('FNMT_PJ');
      expect(res.body.data.analysis.status).toBe('valid');
    });
  });

  // ============================================
  // RAMAS: submitH1Declaration - sin mrn en result (no trackea)
  // Líneas 403-409
  // ============================================
  describe('submitH1Declaration - tracking condicional', () => {
    test('NO trackea cuando result.success=true pero sin mrn', async () => {
      const exp = await crearExpedicion();

      // AEAT acepta pero no devuelve MRN (escenario anómalo pero posible)
      mockAeatRealService.submitH1Declaration.mockResolvedValue({
        success: true,
        mrn: null, // sin MRN
        channel: 'green'
      });

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Línea 403: if (result.success && result.mrn) → false
      expect(mockStatusMonitor.trackDeclaration).not.toHaveBeenCalled();
    });

    test('SÍ trackea cuando result.success=true Y tiene mrn', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH1Declaration.mockResolvedValue({
        success: true,
        mrn: '26ES123456789012345',
        channel: 'green'
      });

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(200);
      expect(mockStatusMonitor.trackDeclaration).toHaveBeenCalledWith(
        '26ES123456789012345',
        expect.objectContaining({ declarationType: 'H1' })
      );
    });
  });

  // ============================================
  // RAMAS: submitH7/AES/NCTS - tracking condicional (líneas análogas)
  // ============================================
  describe('submitH7Declaration - tracking condicional', () => {
    test('NO trackea cuando success=true pero sin mrn', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH7Declaration.mockResolvedValue({
        success: true,
        mrn: null
      });

      await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(mockStatusMonitor.trackDeclaration).not.toHaveBeenCalled();
    });

    test('usa description de error cuando result.success=false (líneas 469-471)', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH7Declaration.mockResolvedValue({
        success: false,
        error: 'AEAT rechazó: código 2214',
        mrn: null
      });

      await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      // Líneas 463, 469-471: cuando result.success=false
      expect(expActualizado.declaration.status).toBe('submission_error');
      expect(expActualizado.timeline[0].description).toContain('Error enviando H7');
      expect(expActualizado.timeline[0].description).toContain('código 2214');
    });
  });

  describe('submitAESDeclaration - tracking condicional', () => {
    test('NO trackea cuando success=true pero sin mrn', async () => {
      const exp = await crearExpedicion({ operationType: 'export' });

      mockAeatRealService.submitAESDeclaration.mockResolvedValue({
        success: true,
        mrn: null
      });

      await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(mockStatusMonitor.trackDeclaration).not.toHaveBeenCalled();
    });

    test('usa description de error cuando result.success=false (líneas 531-533)', async () => {
      const exp = await crearExpedicion({ operationType: 'export' });

      mockAeatRealService.submitAESDeclaration.mockResolvedValue({
        success: false,
        error: 'AEAT rechazó: valor no permitido',
        mrn: null
      });

      await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      // Líneas 525, 531-533: cuando result.success=false
      expect(expActualizado.declaration.status).toBe('submission_error');
      expect(expActualizado.timeline[0].description).toContain('Error enviando AES');
      expect(expActualizado.timeline[0].description).toContain('valor no permitido');
    });
  });

  describe('submitNCTSDeclaration - tracking condicional', () => {
    test('NO trackea cuando success=true pero sin mrn', async () => {
      const exp = await crearExpedicion({ operationType: 'transit' });

      mockAeatRealService.submitNCTSDeclaration.mockResolvedValue({
        success: true,
        mrn: null
      });

      await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(mockStatusMonitor.trackDeclaration).not.toHaveBeenCalled();
    });

    test('persiste submission_error cuando result.success=false (línea 586)', async () => {
      const exp = await crearExpedicion({ operationType: 'transit' });

      mockAeatRealService.submitNCTSDeclaration.mockResolvedValue({
        success: false,
        error: 'NCTS rechazó',
        mrn: null
      });

      await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      // Línea 586: result.success ? 'submitted' : 'submission_error'
      expect(expActualizado.declaration.status).toBe('submission_error');
    });
  });

  // ============================================
  // RAMAS: submitICS2Declaration - rama success=false
  // Línea 638
  // ============================================
  describe('submitICS2Declaration - rama success=false', () => {
    test('persiste submission_error cuando result.success=false (línea 638)', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitICS2Declaration.mockResolvedValue({
        success: false,
        error: 'ICS2 rechazado'
      });

      await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      // Línea 638: result.success ? 'submitted' : 'submission_error'
      expect(expActualizado.declaration.status).toBe('submission_error');
    });
  });

  // ============================================
  // RAMAS: getDeclarationStatus - branch cuando result.success=false
  // Líneas 684-689
  // ============================================
  describe('getDeclarationStatus', () => {
    test('NO analiza con LUCI cuando result.success=false', async () => {
      mockAeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: false,
        error: 'MRN no encontrado en AEAT'
      });

      const res = await request(app(aeatRealController.getDeclarationStatus, 'get', '/r/:mrn'))
        .get('/r/26ES999999999999999')
        .query({ certificateAlias: 'FNMT-STRIX', declarationType: 'H1' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(false);

      // Línea 684: if (result.success) → false, no se llama a _analyzeStatusWithLuci
      expect(mockStatusMonitor._analyzeStatusWithLuci).not.toHaveBeenCalled();
    });

    test('SÍ analiza con LUCI cuando result.success=true', async () => {
      mockAeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true,
        data: { status: 'accepted', mrn: '26ES123' }
      });

      mockStatusMonitor._analyzeStatusWithLuci.mockResolvedValue({
        message: 'Todo OK'
      });

      const res = await request(app(aeatRealController.getDeclarationStatus, 'get', '/r/:mrn'))
        .get('/r/26ES123')
        .query({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(200);
      expect(mockStatusMonitor._analyzeStatusWithLuci).toHaveBeenCalled();
      expect(res.body.data.luciAnalysis.message).toBe('Todo OK');
    });
  });

  // ============================================
  // RAMAS: getInbox - fromDate/toDate opcionales
  // Líneas 723-724
  // ============================================
  describe('getInbox - parámetros de fecha opcionales', () => {
    test('pasa fromDate y toDate como Date cuando están presentes', async () => {
      mockAeatRealService.getInbox.mockResolvedValue({ messages: [] });

      await request(app(aeatRealController.getInbox, 'get', '/r'))
        .get('/r')
        .query({
          certificateAlias: 'FNMT-STRIX',
          fromDate: '2026-08-01',
          toDate: '2026-08-06'
        });

      const [alias, options] = mockAeatRealService.getInbox.mock.calls[0];
      expect(alias).toBe('FNMT-STRIX');
      expect(options.fromDate).toBeInstanceOf(Date);
      expect(options.toDate).toBeInstanceOf(Date);
      expect(options.fromDate.toISOString()).toContain('2026-08-01');
      expect(options.toDate.toISOString()).toContain('2026-08-06');
    });

    test('pasa undefined cuando fromDate/toDate NO están presentes', async () => {
      mockAeatRealService.getInbox.mockResolvedValue({ messages: [] });

      await request(app(aeatRealController.getInbox, 'get', '/r'))
        .get('/r')
        .query({ certificateAlias: 'FNMT-STRIX' });

      const [, options] = mockAeatRealService.getInbox.mock.calls[0];
      expect(options.fromDate).toBeUndefined();
      expect(options.toDate).toBeUndefined();
    });
  });

  // ============================================
  // RAMAS: getActiveAlerts - unacknowledgedOnly
  // Línea 848
  // ============================================
  describe('getActiveAlerts', () => {
    test('pasa unacknowledgedOnly=true cuando query es "true"', async () => {
      mockStatusMonitor.getActiveAlerts.mockResolvedValue([]);

      await request(app(aeatRealController.getActiveAlerts, 'get', '/r'))
        .get('/r')
        .query({ unacknowledgedOnly: 'true' });

      expect(mockStatusMonitor.getActiveAlerts).toHaveBeenCalledWith({
        severity: undefined,
        unacknowledgedOnly: true
      });
    });

    test('pasa unacknowledgedOnly=false cuando query NO es "true"', async () => {
      mockStatusMonitor.getActiveAlerts.mockResolvedValue([]);

      await request(app(aeatRealController.getActiveAlerts, 'get', '/r'))
        .get('/r')
        .query({ unacknowledgedOnly: 'false' });

      expect(mockStatusMonitor.getActiveAlerts).toHaveBeenCalledWith({
        severity: undefined,
        unacknowledgedOnly: false
      });
    });
  });

  // ============================================
  // RAMAS: predictInspectionChannel - goods/transport opcionales
  // Líneas 906-907
  // ============================================
  describe('predictInspectionChannel', () => {
    test('pasa goods y transport vacíos cuando no están en body', async () => {
      mockStatusMonitor.predictInspectionChannel.mockResolvedValue({
        predictedChannel: 'yellow',
        confidence: 0.5
      });

      await request(app(aeatRealController.predictInspectionChannel))
        .post('/r')
        .send({
          operationData: { declarationType: 'H1', value: 10000 }
          // sin goods ni transport
        });

      expect(mockStatusMonitor.predictInspectionChannel).toHaveBeenCalledWith({
        operationData: expect.any(Object),
        goods: [], // línea 906
        transport: {} // línea 907
      });
    });

    test('usa goods y transport del body cuando están presentes', async () => {
      mockStatusMonitor.predictInspectionChannel.mockResolvedValue({
        predictedChannel: 'green',
        confidence: 0.9
      });

      await request(app(aeatRealController.predictInspectionChannel))
        .post('/r')
        .send({
          operationData: { value: 1000 },
          goods: [{ taricCode: '8471300000' }],
          transport: { mode: 'air' }
        });

      expect(mockStatusMonitor.predictInspectionChannel).toHaveBeenCalledWith({
        operationData: expect.any(Object),
        goods: [{ taricCode: '8471300000' }],
        transport: { mode: 'air' }
      });
    });
  });

  // ============================================
  // RAMAS: testConnectivity - services por defecto
  // Línea 983
  // ============================================
  describe('testConnectivity', () => {
    test('usa services por defecto cuando no se pasa en body', async () => {
      mockAeatRealService.testConnectivity.mockResolvedValue({
        H1_STATUS: { available: true },
        AES_STATUS: { available: true }
      });

      await request(app(aeatRealController.testConnectivity))
        .post('/r')
        .send({ certificateAlias: 'FNMT-STRIX' });

      // Línea 983: services: services || ['H1_STATUS', 'AES_STATUS']
      expect(mockAeatRealService.testConnectivity).toHaveBeenCalledWith(
        'FNMT-STRIX',
        { services: ['H1_STATUS', 'AES_STATUS'] }
      );
    });

    test('usa services del body cuando está presente', async () => {
      mockAeatRealService.testConnectivity.mockResolvedValue({
        NCTS_STATUS: { available: false }
      });

      await request(app(aeatRealController.testConnectivity))
        .post('/r')
        .send({
          certificateAlias: 'FNMT-STRIX',
          services: ['NCTS_STATUS']
        });

      expect(mockAeatRealService.testConnectivity).toHaveBeenCalledWith(
        'FNMT-STRIX',
        { services: ['NCTS_STATUS'] }
      );
    });
  });

  // ============================================
  // RAMAS: getServiceStatus - fallbacks cuando métodos no existen
  // Líneas 1044-1046
  // ============================================
  describe('getServiceStatus - robustez con métodos inexistentes', () => {
    test('maneja cuando listTrackedDeclarations no es función', async () => {
      mockAeatRealService.getInfo.mockReturnValue({
        environment: 'sandbox',
        baseUrl: 'https://aeat.es/sandbox',
        supportedDeclarations: ['H1'],
        sslStatus: { valid: true },
        simulationMode: true
      });

      mockCertService.listCertificates.mockResolvedValue({ certificates: [] });

      // Simular que listTrackedDeclarations NO existe
      const originalFn = mockStatusMonitor.listTrackedDeclarations;
      delete mockStatusMonitor.listTrackedDeclarations;

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 1045: ((await aeatStatusMonitorService.listTrackedDeclarations?.()) || {}).total || 0
      expect(res.body.data.status.activeMonitoring).toBe(0);

      // Restaurar
      mockStatusMonitor.listTrackedDeclarations = originalFn;
    });

    test('maneja cuando listTrackedDeclarations devuelve sin total', async () => {
      mockAeatRealService.getInfo.mockReturnValue({
        environment: 'sandbox',
        baseUrl: 'https://aeat.es/sandbox',
        supportedDeclarations: ['H1'],
        sslStatus: { valid: true },
        simulationMode: false
      });

      mockCertService.listCertificates.mockResolvedValue({ certificates: [] });

      // listTrackedDeclarations existe pero devuelve objeto sin total
      mockStatusMonitor.listTrackedDeclarations = jest.fn().mockResolvedValue({});

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.status.activeMonitoring).toBe(0);
    });

    test('usa 0 para activeAlerts cuando alerts no existe', async () => {
      mockAeatRealService.getInfo.mockReturnValue({
        environment: 'sandbox',
        baseUrl: 'https://aeat.es/sandbox',
        supportedDeclarations: [],
        sslStatus: { valid: false },
        simulationMode: true
      });

      mockCertService.listCertificates.mockResolvedValue({ certificates: [] });
      mockStatusMonitor.listTrackedDeclarations = jest.fn().mockResolvedValue({ total: 0 });

      // Eliminar alerts
      const originalAlerts = mockStatusMonitor.alerts;
      delete mockStatusMonitor.alerts;

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 1046: aeatStatusMonitorService.alerts?.length || 0
      expect(res.body.data.status.activeAlerts).toBe(0);

      // Restaurar
      mockStatusMonitor.alerts = originalAlerts;
    });
  });

  // ============================================
  // RAMAS: submitEMCSMovement - messageType por defecto
  // Línea 1140
  // ============================================
  describe('submitEMCSMovement', () => {
    test('usa messageType por defecto IE801 cuando no se pasa', async () => {
      mockAeatRealService.submitEMCSMovement.mockResolvedValue({
        success: true,
        arc: 'ARC123'
      });

      await request(app(aeatRealController.submitEMCSMovement))
        .post('/r')
        .send({
          xmlContent: '<IE801>...</IE801>',
          certificateAlias: 'FNMT-STRIX'
        });

      // Línea 1140: messageType || 'IE801'
      expect(mockAeatRealService.submitEMCSMovement).toHaveBeenCalledWith(
        '<IE801>...</IE801>',
        'FNMT-STRIX',
        'IE801',
        { useSandbox: true }
      );
    });

    test('respeta messageType cuando se pasa en body', async () => {
      mockAeatRealService.submitEMCSMovement.mockResolvedValue({
        success: true,
        arc: 'ARC456'
      });

      await request(app(aeatRealController.submitEMCSMovement))
        .post('/r')
        .send({
          xmlContent: '<IE802>...</IE802>',
          certificateAlias: 'FNMT-STRIX',
          messageType: 'IE802'
        });

      expect(mockAeatRealService.submitEMCSMovement).toHaveBeenCalledWith(
        '<IE802>...</IE802>',
        'FNMT-STRIX',
        'IE802',
        { useSandbox: true }
      );
    });
  });

  // ============================================
  // RAMAS: validateCertificateForOperation - operationType sin declarationType
  // Línea 242
  // ============================================
  describe('validateCertificateForOperation', () => {
    test('pasa declarationType undefined cuando no está en body', async () => {
      mockCertService.validateCertificateForOperation.mockResolvedValue({
        valid: true,
        message: 'Certificado válido para operación'
      });

      await request(app(aeatRealController.validateCertificateForOperation))
        .post('/r')
        .send({
          certificateAlias: 'FNMT-STRIX',
          operationType: 'H1_SUBMIT'
          // sin declarationType
        });

      expect(mockCertService.validateCertificateForOperation).toHaveBeenCalledWith(
        'FNMT-STRIX',
        'H1_SUBMIT',
        undefined // línea 242
      );
    });

    test('pasa declarationType cuando está presente', async () => {
      mockCertService.validateCertificateForOperation.mockResolvedValue({
        valid: true
      });

      await request(app(aeatRealController.validateCertificateForOperation))
        .post('/r')
        .send({
          certificateAlias: 'FNMT-STRIX',
          operationType: 'H7_SUBMIT',
          declarationType: 'H7'
        });

      expect(mockCertService.validateCertificateForOperation).toHaveBeenCalledWith(
        'FNMT-STRIX',
        'H7_SUBMIT',
        'H7'
      );
    });
  });

  // ============================================
  // RAMAS: signDocument - serviceType por defecto
  // Línea 281
  // ============================================
  describe('signDocument', () => {
    test('usa serviceType por defecto H1_SUBMIT cuando no se pasa', async () => {
      mockXadesService.signForAEAT.mockResolvedValue({
        signedXml: '<SignedH1>...</SignedH1>',
        signature: 'SIGNATURE_DATA'
      });

      await request(app(aeatRealController.signDocument))
        .post('/r')
        .send({
          xmlContent: '<H1>...</H1>',
          certificateAlias: 'FNMT-STRIX'
        });

      // Línea 281: serviceType || 'H1_SUBMIT'
      expect(mockXadesService.signForAEAT).toHaveBeenCalledWith(
        '<H1>...</H1>',
        'FNMT-STRIX',
        'H1_SUBMIT'
      );
    });

    test('respeta serviceType cuando se pasa', async () => {
      mockXadesService.signForAEAT.mockResolvedValue({
        signedXml: '<SignedH7>...</SignedH7>'
      });

      await request(app(aeatRealController.signDocument))
        .post('/r')
        .send({
          xmlContent: '<H7>...</H7>',
          certificateAlias: 'FNMT-STRIX',
          serviceType: 'H7_SUBMIT'
        });

      expect(mockXadesService.signForAEAT).toHaveBeenCalledWith(
        '<H7>...</H7>',
        'FNMT-STRIX',
        'H7_SUBMIT'
      );
    });
  });

  // ============================================
  // RAMAS: getDeclarationStatus - declarationType por defecto
  // Línea 680
  // ============================================
  describe('getDeclarationStatus - declarationType por defecto', () => {
    test('usa H1 como declarationType por defecto cuando no se pasa', async () => {
      mockAeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true,
        data: { status: 'accepted' }
      });

      mockStatusMonitor._analyzeStatusWithLuci.mockResolvedValue({
        message: 'OK'
      });

      await request(app(aeatRealController.getDeclarationStatus, 'get', '/r/:mrn'))
        .get('/r/26ES123')
        .query({ certificateAlias: 'FNMT-STRIX' });

      // Línea 680: declarationType || 'H1'
      expect(mockAeatRealService.queryDeclarationStatus).toHaveBeenCalledWith(
        '26ES123',
        'FNMT-STRIX',
        'H1'
      );
    });
  });

  // ============================================
  // RAMAS: importCertificate - rama de subject.CN en análisis LUCI
  // Líneas 57, 69, 84
  // ============================================
  describe('importCertificate - subject.CN opcionales', () => {
    test('usa N/A cuando result.subject es undefined (línea 57)', async () => {
      mockCertService.importCertificate.mockResolvedValue({
        alias: 'CERT-NO-SUBJECT',
        type: 'FNMT_PJ',
        // sin subject
        validFrom: '2025-01-01',
        validTo: '2027-01-01',
        daysUntilExpiry: 300
      });

      // aiService.askLuci como función (para ejercitar línea 53)
      mockAiService.askLuci.mockResolvedValue('Análisis del certificado');

      const res = await request(app(aeatRealController.importCertificate))
        .post('/r')
        .send({
          certificateBase64: Buffer.from('test').toString('base64'),
          password: 'secret123'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.luciAnalysis).toBe('Análisis del certificado');

      // Verificar que askLuci fue llamado con el prompt que incluye 'N/A'
      const promptArg = mockAiService.askLuci.mock.calls[0][0];
      expect(promptArg).toContain('Titular: N/A');
    });

    test('usa req.user?.email cuando existe (línea 69)', async () => {
      mockCertService.importCertificate.mockResolvedValue({
        alias: 'CERT-OK',
        type: 'FNMT_PJ',
        subject: { CN: 'Test Subject' },
        validFrom: '2025-01-01',
        validTo: '2027-01-01',
        daysUntilExpiry: 300
      });

      const res = await request(app(aeatRealController.importCertificate))
        .post('/r')
        .send({
          certificateBase64: Buffer.from('test').toString('base64'),
          password: 'secret123'
        });

      expect(res.status).toBe(200);
      // Verificar que logger.info fue llamado con el email del usuario
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Certificado importado: CERT-OK',
        { user: 'alice@strixai.es' }
      );
    });

    test('maneja req.user undefined en logger (línea 69)', async () => {
      mockCertService.importCertificate.mockResolvedValue({
        alias: 'CERT-OK',
        type: 'FNMT_PJ',
        subject: { CN: 'Test' },
        validFrom: '2025-01-01',
        validTo: '2027-01-01',
        daysUntilExpiry: 300
      });

      // Usuario sin email
      const userSinEmail = { _id: 'u1', tenantId: TENANT_A };

      const res = await request(app(aeatRealController.importCertificate, 'post', '/r', userSinEmail))
        .post('/r')
        .send({
          certificateBase64: Buffer.from('test').toString('base64'),
          password: 'secret123'
        });

      expect(res.status).toBe(200);
      // Línea 69: req.user?.email → undefined
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Certificado importado: CERT-OK',
        { user: undefined }
      );
    });
  });

  // ============================================
  // RAMAS: listCertificates - certificates undefined
  // Línea 100
  // ============================================
  describe('listCertificates - manejo de certificates undefined', () => {
    test('maneja cuando result.certificates es undefined', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        // sin certificates
      });

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 100: result.certificates || [] → []
      expect(res.body.data).toEqual([]);
    });

    test('usa c.id cuando metadata existe pero alias es falsy (línea 107)', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'cert-fallback-id',
            metadata: { alias: null }, // metadata existe pero alias es null
            type: 'FNMT_PJ',
            subject: { CN: 'Test' },
            issuer: 'FNMT',
            validFrom: '2025-01-01',
            validTo: '2027-01-01',
            daysToExpiry: 300,
            status: 'active'
          }
        ]
      });

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 107: c.metadata?.alias || c.id → debe usar c.id cuando alias es null
      expect(res.body.data[0].alias).toBe('cert-fallback-id');
    });

    test('usa c.subject cuando es string falsy (línea 110)', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'cert-no-subject',
            type: 'FNMT_PJ',
            subject: '', // string vacío
            issuer: 'FNMT',
            validFrom: '2025-01-01',
            validTo: '2027-01-01',
            daysToExpiry: 300,
            status: 'active'
          }
        ]
      });

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 110 rama else: c.subject || 'N/A' → '' || 'N/A' = 'N/A'
      expect(res.body.data[0].subject).toBe('N/A');
    });
  });

  // ============================================
  // RAMAS: getCertificateInfo - find sin metadata.alias
  // Línea 145
  // ============================================
  describe('getCertificateInfo - búsqueda con id cuando falta metadata.alias', () => {
    test('encuentra certificado por id cuando metadata.alias no existe', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        certificates: [
          {
            id: 'cert-id-123',
            // sin metadata.alias
            type: 'FNMT_PJ',
            subject: { CN: 'STRIX' },
            validFrom: '2025-01-01',
            validTo: '2027-01-01'
          }
        ]
      });

      mockCertService.analyzeCertificateWithLuci.mockResolvedValue({
        status: 'valid'
      });

      const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
        .get('/r/cert-id-123');

      expect(res.status).toBe(200);
      // Línea 145: (c.metadata?.alias || c.id) === alias
      expect(res.body.data.certificate.id).toBe('cert-id-123');
    });
  });

  // ============================================
  // RAMAS: submitNCTSDeclaration - messageType explícito
  // Línea 582
  // ============================================
  describe('submitNCTSDeclaration - messageType explícito', () => {
    test('respeta messageType cuando se pasa en body', async () => {
      const exp = await crearExpedicion({ operationType: 'transit' });

      mockAeatRealService.submitNCTSDeclaration.mockResolvedValue({
        success: true,
        mrn: '26ES777777777777777'
      });

      await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          messageType: 'CC013C' // explícito
        });

      // Línea 582: messageType || 'CC015C'
      expect(mockAeatRealService.submitNCTSDeclaration).toHaveBeenCalledWith(
        '<H1>Test declaration</H1>',
        'FNMT-STRIX',
        'CC013C', // usa el explícito
        { useSandbox: true }
      );
    });
  });

  // ============================================
  // RAMAS: submitICS2Declaration - messageType explícito
  // Línea 634
  // ============================================
  describe('submitICS2Declaration - messageType explícito', () => {
    test('respeta messageType cuando se pasa', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitICS2Declaration.mockResolvedValue({
        success: true,
        acknowledgement: 'ICS2-ACK-999'
      });

      await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          messageType: 'CC316C' // explícito
        });

      // Línea 634: messageType || 'CC315C'
      expect(mockAeatRealService.submitICS2Declaration).toHaveBeenCalledWith(
        '<H1>Test declaration</H1>',
        'FNMT-STRIX',
        'CC316C', // usa el explícito
        { useSandbox: true }
      );
    });
  });

  // ============================================
  // RAMAS: trackDeclaration - metadata adicional
  // Línea 764
  // ============================================
  describe('trackDeclaration - metadata adicional', () => {
    test('propaga metadata adicional al monitor', async () => {
      mockStatusMonitor.trackDeclaration.mockResolvedValue({ tracked: true });

      await request(app(aeatRealController.trackDeclaration))
        .post('/r')
        .send({
          mrn: '26ES123456789012345',
          declarationType: 'H1',
          expeditionId: new mongoose.Types.ObjectId().toString(),
          metadata: {
            custom: 'value',
            priority: 'high'
          }
        });

      // Línea 764: ...metadata
      expect(mockStatusMonitor.trackDeclaration).toHaveBeenCalledWith(
        '26ES123456789012345',
        expect.objectContaining({
          declarationType: 'H1',
          userId: USER_A._id,
          custom: 'value',
          priority: 'high'
        })
      );
    });
  });

  // ============================================
  // RAMAS: getActiveAlerts - severity opcional
  // Línea 847
  // ============================================
  describe('getActiveAlerts - severity opcional', () => {
    test('pasa severity cuando está en query', async () => {
      mockStatusMonitor.getActiveAlerts.mockResolvedValue([]);

      await request(app(aeatRealController.getActiveAlerts, 'get', '/r'))
        .get('/r')
        .query({ severity: 'critical' });

      expect(mockStatusMonitor.getActiveAlerts).toHaveBeenCalledWith({
        severity: 'critical',
        unacknowledgedOnly: false
      });
    });
  });

  // ============================================
  // RAMAS: getServiceStatus - simulationMode branches
  // Líneas 1056-1058
  // ============================================
  describe('getServiceStatus - recomendaciones según simulationMode', () => {
    test('recomienda conexión real cuando simulationMode=false', async () => {
      mockAeatRealService.getInfo.mockReturnValue({
        environment: 'production',
        baseUrl: 'https://aeat.es/production',
        supportedDeclarations: ['H1', 'H7'],
        sslStatus: { valid: true },
        simulationMode: false // conexión real
      });

      mockCertService.listCertificates.mockResolvedValue({ certificates: [] });
      mockStatusMonitor.listTrackedDeclarations = jest.fn().mockResolvedValue({ total: 0 });

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 1058: mensaje cuando NO está en simulación
      expect(res.body.data.luciAnalysis.recommendations[0]).toContain('listo para envío');
    });

    test('recomienda solicitar IP cuando simulationMode=true', async () => {
      mockAeatRealService.getInfo.mockReturnValue({
        environment: 'sandbox',
        baseUrl: 'https://aeat.es/sandbox',
        supportedDeclarations: ['H1'],
        sslStatus: { valid: true },
        simulationMode: true // simulación
      });

      mockCertService.listCertificates.mockResolvedValue({ certificates: [] });
      mockStatusMonitor.listTrackedDeclarations = jest.fn().mockResolvedValue({ total: 0 });

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      // Línea 1057: mensaje cuando está en simulación
      expect(res.body.data.luciAnalysis.recommendations[0]).toContain('modo simulación');
      expect(res.body.data.luciAnalysis.recommendations[0]).toContain('solicite autorización de IP');
    });
  });

  // ============================================
  // RAMAS: deleteCertificate - req.user?.email
  // Línea 208
  // ============================================
  describe('deleteCertificate', () => {
    test('loguea email del usuario cuando existe', async () => {
      mockCertService.deleteCertificate.mockResolvedValue();

      await request(app(aeatRealController.deleteCertificate, 'delete', '/r/:alias'))
        .delete('/r/CERT-TO-DELETE');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Certificado eliminado: CERT-TO-DELETE',
        { user: 'alice@strixai.es' }
      );
    });

    test('maneja usuario sin email', async () => {
      mockCertService.deleteCertificate.mockResolvedValue();

      const userSinEmail = { _id: 'u2', tenantId: TENANT_A };

      await request(app(aeatRealController.deleteCertificate, 'delete', '/r/:alias', userSinEmail))
        .delete('/r/CERT-X');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Certificado eliminado: CERT-X',
        { user: undefined }
      );
    });
  });

  // ============================================
  // RAMAS: reloadSSLCertificate - req.user?.email
  // Línea 1010
  // ============================================
  describe('reloadSSLCertificate', () => {
    test('loguea email del usuario cuando existe', async () => {
      mockAeatRealService.reloadCertificate.mockReturnValue({
        success: true,
        message: 'Certificado SSL recargado'
      });

      await request(app(aeatRealController.reloadSSLCertificate))
        .post('/r');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'SSL Certificate reload requested',
        expect.objectContaining({
          success: true,
          user: 'alice@strixai.es'
        })
      );
    });
  });

  // ============================================
  // RAMAS: setEnvironment - req.user?.email
  // Línea 1098
  // ============================================
  describe('setEnvironment', () => {
    test('loguea email del usuario cuando cambia entorno', async () => {
      await request(app(aeatRealController.setEnvironment))
        .post('/r')
        .send({ environment: 'sandbox' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Entorno AEAT cambiado a: sandbox',
        { user: 'alice@strixai.es' }
      );
    });
  });

  // ============================================
  // RAMAS: submitH1Declaration - timeline con req.user
  // Líneas 391-392
  // ============================================
  describe('submitH1Declaration - timeline con datos del usuario', () => {
    test('usa req.user._id y req.user.name cuando existen', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH1Declaration.mockResolvedValue({
        success: true,
        mrn: '26ES123456789012345',
        channel: 'green'
      });

      await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      // Líneas 391-392: userId: req.user?._id, performedBy: req.user?.name || 'Sistema'
      expect(expActualizado.timeline[0].userId).toEqual(USER_A._id);
      expect(expActualizado.timeline[0].performedBy).toBe('Alice');
    });

    test('usa "Sistema" cuando req.user.name es undefined', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH1Declaration.mockResolvedValue({
        success: true,
        mrn: '26ES123456789012345',
        channel: 'green'
      });

      const userSinNombre = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        tenantId: TENANT_A
      };

      await request(app(aeatRealController.submitH1Declaration, 'post', '/r', userSinNombre))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      // Línea 392: req.user?.name || 'Sistema'
      expect(expActualizado.timeline[0].performedBy).toBe('Sistema');
    });
  });

  // ============================================
  // RAMAS: submitH7Declaration - performedBy con fallback
  // Línea 473
  // ============================================
  describe('submitH7Declaration - performedBy con fallback', () => {
    test('usa "Sistema" cuando req.user.name es undefined', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH7Declaration.mockResolvedValue({
        success: true,
        mrn: '26ES987654321098765'
      });

      const userSinNombre = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        tenantId: TENANT_A
      };

      await request(app(aeatRealController.submitH7Declaration, 'post', '/r', userSinNombre))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      expect(expActualizado.timeline[0].performedBy).toBe('Sistema');
    });
  });

  // ============================================
  // RAMAS: submitAESDeclaration - performedBy con fallback
  // Línea 535
  // ============================================
  describe('submitAESDeclaration - performedBy con fallback', () => {
    test('usa "Sistema" cuando req.user.name es undefined', async () => {
      const exp = await crearExpedicion({ operationType: 'export' });

      mockAeatRealService.submitAESDeclaration.mockResolvedValue({
        success: true,
        mrn: '26ES111222333444555'
      });

      const userSinNombre = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        tenantId: TENANT_A
      };

      await request(app(aeatRealController.submitAESDeclaration, 'post', '/r', userSinNombre))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      const expActualizado = await Expedition.findById(exp._id);

      expect(expActualizado.timeline[0].performedBy).toBe('Sistema');
    });
  });

  // ============================================
  // RAMAS: trackDeclaration - userId opcional
  // Línea 763
  // ============================================
  describe('trackDeclaration - userId opcional', () => {
    test('pasa req.user._id al monitor cuando existe', async () => {
      mockStatusMonitor.trackDeclaration.mockResolvedValue({ tracked: true });

      await request(app(aeatRealController.trackDeclaration))
        .post('/r')
        .send({
          mrn: '26ES123',
          declarationType: 'H1'
        });

      expect(mockStatusMonitor.trackDeclaration).toHaveBeenCalledWith(
        '26ES123',
        expect.objectContaining({
          userId: USER_A._id
        })
      );
    });

    test('pasa undefined cuando req.user es undefined', async () => {
      mockStatusMonitor.trackDeclaration.mockResolvedValue({ tracked: true });

      const appSinUsuario = express();
      appSinUsuario.use(express.json());
      appSinUsuario.post('/r', aeatRealController.trackDeclaration);

      await request(appSinUsuario)
        .post('/r')
        .send({
          mrn: '26ES123',
          declarationType: 'H1'
        });

      expect(mockStatusMonitor.trackDeclaration).toHaveBeenCalledWith(
        '26ES123',
        expect.objectContaining({
          userId: undefined
        })
      );
    });
  });

  // ============================================
  // RAMAS: getCertificateInfo - result.certificates || []
  // Línea 144
  // ============================================
  describe('getCertificateInfo - manejo de certificates undefined', () => {
    test('maneja cuando result.certificates es undefined', async () => {
      mockCertService.listCertificates.mockResolvedValue({
        // sin certificates
      });

      const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
        .get('/r/CERT-X');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/no encontrado/i);
    });
  });

  // ============================================
  // RAMAS: Todos los catch con error.message || 'fallback'
  // Líneas 84, 130, 169, 219, 254, 293, 324, 432, 496, etc.
  // ============================================
  describe('Bloques catch - error sin message', () => {
    test('importCertificate - error sin message (línea 84)', async () => {
      // Simular error sin propiedad message
      const errorSinMessage = new Error();
      delete errorSinMessage.message;

      mockCertService.importCertificate.mockRejectedValue(errorSinMessage);

      const res = await request(app(aeatRealController.importCertificate))
        .post('/r')
        .send({
          certificateBase64: Buffer.from('test').toString('base64'),
          password: 'secret'
        });

      expect(res.status).toBe(500);
      // Línea 84: error.message || 'Error importando certificado'
      expect(res.body.error).toBe('Error importando certificado');
    });

    test('listCertificates - error sin message (línea 130)', async () => {
      const errorSinMessage = {};
      mockCertService.listCertificates.mockRejectedValue(errorSinMessage);

      const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error listando certificados');
    });

    test('getCertificateInfo - error sin message (línea 169)', async () => {
      mockCertService.listCertificates.mockRejectedValue({});

      const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
        .get('/r/CERT-X');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error obteniendo certificado');
    });

    test('verifyCertificate - error sin message (línea 193)', async () => {
      mockCertService.verifyCertificateStatus.mockRejectedValue({});

      const res = await request(app(aeatRealController.verifyCertificate, 'get', '/r/:alias/verify'))
        .get('/r/CERT-X/verify');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error verificando certificado');
    });

    test('deleteCertificate - error sin message (línea 219)', async () => {
      mockCertService.deleteCertificate.mockRejectedValue({});

      const res = await request(app(aeatRealController.deleteCertificate, 'delete', '/r/:alias'))
        .delete('/r/CERT-X');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error eliminando certificado');
    });

    test('validateCertificateForOperation - error sin message (línea 254)', async () => {
      mockCertService.validateCertificateForOperation.mockRejectedValue({});

      const res = await request(app(aeatRealController.validateCertificateForOperation))
        .post('/r')
        .send({
          certificateAlias: 'CERT-X',
          operationType: 'H1_SUBMIT'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error validando certificado');
    });

    test('signDocument - error sin message (línea 293)', async () => {
      mockXadesService.signForAEAT.mockRejectedValue({});

      const res = await request(app(aeatRealController.signDocument))
        .post('/r')
        .send({
          xmlContent: '<H1>...</H1>',
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error firmando documento');
    });

    test('verifySignature - error sin message (línea 324)', async () => {
      mockXadesService.verifyAEATResponse.mockRejectedValue({});

      const res = await request(app(aeatRealController.verifySignature))
        .post('/r')
        .send({ signedXml: '<Signed>...</Signed>' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error verificando firma');
    });

    test('submitH1Declaration - error sin message (línea 432)', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH1Declaration.mockRejectedValue({});

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error enviando declaración a AEAT');
    });

    test('submitH7Declaration - error sin message (línea 496)', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH7Declaration.mockRejectedValue({});

      const res = await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error enviando H7');
    });

    test('submitAESDeclaration - error sin message (línea 556)', async () => {
      const exp = await crearExpedicion({ operationType: 'export' });

      mockAeatRealService.submitAESDeclaration.mockRejectedValue({});

      const res = await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error enviando AES');
    });

    test('submitNCTSDeclaration - error sin message (línea 608)', async () => {
      const exp = await crearExpedicion({ operationType: 'transit' });

      mockAeatRealService.submitNCTSDeclaration.mockRejectedValue({});

      const res = await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error enviando NCTS');
    });

    test('submitICS2Declaration - error sin message (línea 652)', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitICS2Declaration.mockRejectedValue({});

      const res = await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error enviando ICS2');
    });

    test('getDeclarationStatus - error sin message (línea 701)', async () => {
      mockAeatRealService.queryDeclarationStatus.mockRejectedValue({});

      const res = await request(app(aeatRealController.getDeclarationStatus, 'get', '/r/:mrn'))
        .get('/r/26ES123')
        .query({ certificateAlias: 'CERT-X' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error consultando estado');
    });

    test('getInbox - error sin message (línea 736)', async () => {
      mockAeatRealService.getInbox.mockRejectedValue({});

      const res = await request(app(aeatRealController.getInbox, 'get', '/r'))
        .get('/r')
        .query({ certificateAlias: 'CERT-X' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error obteniendo bandeja');
    });

    test('trackDeclaration - error sin message (línea 776)', async () => {
      mockStatusMonitor.trackDeclaration.mockRejectedValue({});

      const res = await request(app(aeatRealController.trackDeclaration))
        .post('/r')
        .send({ mrn: '26ES123', declarationType: 'H1' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error iniciando tracking');
    });

    test('getTrackedDeclarations - error sin message (línea 798)', async () => {
      mockStatusMonitor.listTrackedDeclarations.mockRejectedValue({});

      const res = await request(app(aeatRealController.getTrackedDeclarations, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error obteniendo declaraciones');
    });

    test('refreshDeclarationStatus - error sin message (línea 833)', async () => {
      mockStatusMonitor.refreshDeclarationStatus.mockRejectedValue({});

      const res = await request(app(aeatRealController.refreshDeclarationStatus, 'post', '/r/:mrn/refresh'))
        .post('/r/26ES123/refresh')
        .send({ certificateAlias: 'CERT-X' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error refrescando estado');
    });

    test('getActiveAlerts - error sin message (línea 859)', async () => {
      mockStatusMonitor.getActiveAlerts.mockRejectedValue({});

      const res = await request(app(aeatRealController.getActiveAlerts, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error obteniendo alertas');
    });

    test('acknowledgeAlert - error sin message (línea 884)', async () => {
      mockStatusMonitor.acknowledgeAlert.mockImplementation(() => {
        throw {};
      });

      const res = await request(app(aeatRealController.acknowledgeAlert, 'post', '/r/:alertId/acknowledge'))
        .post('/r/alert123/acknowledge');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error confirmando alerta');
    });

    test('predictInspectionChannel - error sin message (línea 919)', async () => {
      mockStatusMonitor.predictInspectionChannel.mockRejectedValue({});

      const res = await request(app(aeatRealController.predictInspectionChannel))
        .post('/r')
        .send({ operationData: { value: 1000 } });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error prediciendo canal');
    });

    test('submitDigitalDocuments - error sin message (línea 958)', async () => {
      mockAeatRealService.submitDigitalDocuments.mockRejectedValue({});

      const res = await request(app(aeatRealController.submitDigitalDocuments))
        .post('/r')
        .send({
          mrn: '26ES123',
          documents: [{}],
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error enviando documentos');
    });

    test('testConnectivity - error sin message (línea 995)', async () => {
      mockAeatRealService.testConnectivity.mockRejectedValue({});

      const res = await request(app(aeatRealController.testConnectivity))
        .post('/r')
        .send({ certificateAlias: 'CERT-X' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error probando conectividad');
    });

    test('reloadSSLCertificate - error sin message (línea 1023)', async () => {
      mockAeatRealService.reloadCertificate.mockImplementation(() => {
        throw {};
      });

      const res = await request(app(aeatRealController.reloadSSLCertificate))
        .post('/r');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error reloading certificate');
    });

    test('getServiceStatus - error sin message (línea 1067)', async () => {
      mockAeatRealService.getInfo.mockImplementation(() => {
        throw {};
      });

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error obteniendo estado');
    });

    test('setEnvironment - error sin message (línea 1113)', async () => {
      // Forzar error en currentEnvironment
      Object.defineProperty(mockAeatRealService, 'currentEnvironment', {
        set() {
          throw {};
        },
        configurable: true
      });

      const res = await request(app(aeatRealController.setEnvironment))
        .post('/r')
        .send({ environment: 'sandbox' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error cambiando entorno');

      // Restaurar
      Object.defineProperty(mockAeatRealService, 'currentEnvironment', {
        value: 'sandbox',
        writable: true,
        configurable: true
      });
    });

    test('submitEMCSMovement - error sin message (línea 1153)', async () => {
      mockAeatRealService.submitEMCSMovement.mockRejectedValue({});

      const res = await request(app(aeatRealController.submitEMCSMovement))
        .post('/r')
        .send({
          xmlContent: '<IE801/>',
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error enviando EMCS');
    });

    test('querySILICIE - error sin message (línea 1184)', async () => {
      mockAeatRealService.querySILICIE.mockRejectedValue({});

      const res = await request(app(aeatRealController.querySILICIE))
        .post('/r')
        .send({
          queryXml: '<query/>',
          certificateAlias: 'CERT-X'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error consultando SILICIE');
    });
  });

  // ============================================
  // RAMAS: submitH1Declaration - useSandbox false explícito
  // Línea 377
  // ============================================
  describe('submitH1Declaration - useSandbox explícito', () => {
    test('respeta useSandbox=false cuando se pasa explícitamente', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH1Declaration.mockResolvedValue({
        success: true,
        mrn: '26ES123456789012345',
        channel: 'green'
      });

      await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          useSandbox: false // explícito
        });

      // Línea 377: useSandbox: useSandbox !== false
      // Si useSandbox es false → useSandbox: false
      expect(mockAeatRealService.submitH1Declaration).toHaveBeenCalledWith(
        '<H1>Test declaration</H1>',
        'FNMT-STRIX',
        { useSandbox: false }
      );
    });
  });

  // ============================================
  // RAMAS: Otros handlers - useSandbox false explícito
  // ============================================
  describe('submitH7Declaration - useSandbox explícito', () => {
    test('respeta useSandbox=false', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH7Declaration.mockResolvedValue({
        success: true,
        mrn: '26ES987'
      });

      await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          useSandbox: false
        });

      expect(mockAeatRealService.submitH7Declaration).toHaveBeenCalledWith(
        expect.any(String),
        'FNMT-STRIX',
        { useSandbox: false }
      );
    });
  });

  describe('submitAESDeclaration - useSandbox explícito', () => {
    test('respeta useSandbox=false', async () => {
      const exp = await crearExpedicion({ operationType: 'export' });

      mockAeatRealService.submitAESDeclaration.mockResolvedValue({
        success: true,
        mrn: '26ES111'
      });

      await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          useSandbox: false
        });

      expect(mockAeatRealService.submitAESDeclaration).toHaveBeenCalledWith(
        expect.any(String),
        'FNMT-STRIX',
        { useSandbox: false }
      );
    });
  });

  describe('submitNCTSDeclaration - useSandbox explícito', () => {
    test('respeta useSandbox=false', async () => {
      const exp = await crearExpedicion({ operationType: 'transit' });

      mockAeatRealService.submitNCTSDeclaration.mockResolvedValue({
        success: true,
        mrn: '26ES555'
      });

      await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          useSandbox: false
        });

      expect(mockAeatRealService.submitNCTSDeclaration).toHaveBeenCalledWith(
        expect.any(String),
        'FNMT-STRIX',
        'CC015C',
        { useSandbox: false }
      );
    });
  });

  describe('submitICS2Declaration - useSandbox explícito', () => {
    test('respeta useSandbox=false', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitICS2Declaration.mockResolvedValue({
        success: true
      });

      await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          useSandbox: false
        });

      expect(mockAeatRealService.submitICS2Declaration).toHaveBeenCalledWith(
        expect.any(String),
        'FNMT-STRIX',
        'CC315C',
        { useSandbox: false }
      );
    });
  });

  describe('submitEMCSMovement - useSandbox explícito', () => {
    test('respeta useSandbox=false', async () => {
      mockAeatRealService.submitEMCSMovement.mockResolvedValue({
        success: true,
        arc: 'ARC123'
      });

      await request(app(aeatRealController.submitEMCSMovement))
        .post('/r')
        .send({
          xmlContent: '<IE801>...</IE801>',
          certificateAlias: 'FNMT-STRIX',
          useSandbox: false
        });

      expect(mockAeatRealService.submitEMCSMovement).toHaveBeenCalledWith(
        '<IE801>...</IE801>',
        'FNMT-STRIX',
        'IE801',
        { useSandbox: false }
      );
    });
  });
});
