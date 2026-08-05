/**
 * Tests de aeatRealController con MONGO REAL EN MEMORIA.
 *
 * Verifican que los 5 handlers submit (H1/H7/AES/NCTS/ICS2) ejercitan de verdad
 * el guard ensureSameTenant, persisten el timeline/status, y propagan errores de
 * AEAT sin ocultar la causa.
 *
 * BUG DETECTADO: declaration.status='submission_error' no está en el enum del
 * schema Expedition.js → ValidationError → el controller responde 500 en vez de
 * devolver el error real de AEAT. Documentado en test "no persiste un status
 * inválido cuando AEAT rechaza".
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { Expedition } = require('../../src/models');

// Mockear las fronteras de red/crypto
const mockCertService = {
  importCertificate: jest.fn(),
  listCertificates: jest.fn(),
  deleteCertificate: jest.fn(),
  verifyCertificateStatus: jest.fn(),
  validateCertificateForOperation: jest.fn(),
  analyzeCertificateWithLuci: jest.fn()
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

// NO mockear Expedition ni tenantGuard — usar los reales
const aeatRealController = require('../../src/controllers/aeatRealController');

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();
const USER_A = { _id: new mongoose.Types.ObjectId(), name: 'Alice', email: 'alice@strixai.es', tenantId: TENANT_A, role: 'user' };
const USER_ADMIN = { _id: new mongoose.Types.ObjectId(), name: 'Admin', email: 'admin@strixai.es', tenantId: TENANT_A, role: 'admin' };

function app(handler, metodo = 'post', ruta = '/r', user = USER_A) {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => {
    req.user = user;
    // ensureSameTenant espera req.tenantId como string o req.user.tenantId que convierte a string
    req.tenantId = String(user.tenantId);
    next();
  }, handler);
  return a;
}

/**
 * Helper: crea un Expedition VÁLIDO con los campos requeridos por el schema.
 */
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

describe('aeatRealController con Mongo real', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(() => {
    jest.clearAllMocks();
    // Defaults: validación OK, LUCI responde
    mockAeatRealService.validateBeforeSubmit.mockResolvedValue({ isValid: true });
    mockStatusMonitor.trackDeclaration.mockResolvedValue({ tracked: true });
    mockAiService.askLuci.mockResolvedValue('Todo listo para enviar');
  });

  // ============================================
  // VERIFICACIÓN DEL BUG submission_error (ARREGLADO)
  // ============================================
  describe('BUG ARREGLADO: status=submission_error añadido al enum', () => {
    test('persiste submission_error cuando AEAT rechaza y devuelve el error real (líneas 381/463/525/586/638)', async () => {
      const exp = await crearExpedicion();

      // AEAT rechaza la declaración
      mockAeatRealService.submitH1Declaration.mockResolvedValue({
        success: false,
        error: 'AEAT rechazó: código 4404',
        mrn: null
      });

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          useSandbox: true
        });

      // Tras añadir 'submission_error' al enum: el controller persiste el status
      // y devuelve HTTP 200 con success:true + result.success:false + error de AEAT
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true); // La petición se procesó
      expect(res.body.data.result.success).toBe(false); // AEAT rechazó
      expect(res.body.data.result.error).toContain('4404'); // Error visible

      const expActualizado = await Expedition.findById(exp._id);
      expect(expActualizado.declaration.status).toBe('submission_error');
      expect(expActualizado.timeline[0].description).toContain('Error enviando a AEAT');
      expect(expActualizado.timeline[0].description).toContain('4404');
    });
  });

  // ============================================
  // submitH1Declaration con Mongo real
  // ============================================
  describe('submitH1Declaration', () => {
    test('400 si falta expeditionId o certificateAlias', async () => {
      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({ expeditionId: 'abc123' }); // falta certificateAlias

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/certificado/i);
      expect(mockAeatRealService.validateBeforeSubmit).not.toHaveBeenCalled();
    });

    test('404 si el expediente es de otro tenant (ensureSameTenant)', async () => {
      const expOtroTenant = await crearExpedicion({ tenantId: TENANT_B });

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: expOtroTenant._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/no encontrado/i);
      expect(mockAeatRealService.validateBeforeSubmit).not.toHaveBeenCalled();
    });

    test('400 si el expediente no tiene xmlContent generado', async () => {
      const expSinXml = await crearExpedicion({
        declaration: { status: 'draft' } // sin xmlContent
      });

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: expSinXml._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/declaración generada/i);
    });

    test('400 si validateBeforeSubmit detecta errores', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.validateBeforeSubmit.mockResolvedValue({
        isValid: false,
        errors: ['Falta EORI del destinatario']
      });

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/validación pre-envío/i);
      expect(mockAeatRealService.submitH1Declaration).not.toHaveBeenCalled();
    });

    test('camino feliz: delega a aeatRealService, actualiza status/mrn/timeline y trackea', async () => {
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
          certificateAlias: 'FNMT-STRIX',
          useSandbox: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.result.mrn).toBe('26ES123456789012345');

      // Verificar que delegó correctamente
      expect(mockAeatRealService.submitH1Declaration).toHaveBeenCalledWith(
        '<H1>Test declaration</H1>',
        'FNMT-STRIX',
        { useSandbox: true }
      );

      // Verificar persistencia en Mongo
      const expActualizado = await Expedition.findById(exp._id);
      expect(expActualizado.declaration.status).toBe('submitted');
      expect(expActualizado.declaration.mrn).toBe('26ES123456789012345');
      expect(expActualizado.timeline).toHaveLength(1);
      expect(expActualizado.timeline[0].action).toBe('declaration_submitted_aeat');
      expect(expActualizado.timeline[0].description).toContain('26ES123456789012345');
      expect(expActualizado.timeline[0].performedBy).toBe('Alice');

      // Verificar que inició tracking
      expect(mockStatusMonitor.trackDeclaration).toHaveBeenCalledWith(
        '26ES123456789012345',
        expect.objectContaining({
          expeditionId: exp._id,
          declarationType: 'H1'
        })
      );
    });

    test('500 si aeatRealService lanza excepción', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH1Declaration.mockRejectedValue(
        new Error('Timeout conectando con AEAT')
      );

      const res = await request(app(aeatRealController.submitH1Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/timeout/i);
    });
  });

  // ============================================
  // submitH7Declaration
  // ============================================
  describe('submitH7Declaration', () => {
    test('400 si falta expeditionId', async () => {
      const res = await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(400);
      expect(mockAeatRealService.submitH7Declaration).not.toHaveBeenCalled();
    });

    test('404 si el expediente es de otro tenant', async () => {
      const expOtro = await crearExpedicion({ tenantId: TENANT_B });

      const res = await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({
          expeditionId: expOtro._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(404);
    });

    test('camino feliz: persiste status=submitted y timeline', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH7Declaration.mockResolvedValue({
        success: true,
        mrn: '26ES987654321098765',
        channel: 'yellow'
      });

      const res = await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          useSandbox: false
        });

      expect(res.status).toBe(200);
      expect(res.body.data.mrn).toBe('26ES987654321098765');

      const expActualizado = await Expedition.findById(exp._id);
      expect(expActualizado.declaration.status).toBe('submitted');
      expect(expActualizado.timeline[0].action).toBe('h7_submitted_aeat');
      expect(expActualizado.timeline[0].description).toContain('26ES987654321098765');
    });

    test('500 si el servicio lanza', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitH7Declaration.mockRejectedValue(
        new Error('Certificado expirado')
      );

      const res = await request(app(aeatRealController.submitH7Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Certificado expirado');
    });
  });

  // ============================================
  // submitAESDeclaration
  // ============================================
  describe('submitAESDeclaration', () => {
    test('400 sin certificateAlias', async () => {
      const res = await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({ expeditionId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(400);
    });

    test('404 si expediente de otro tenant', async () => {
      const expOtro = await crearExpedicion({ tenantId: TENANT_B });

      const res = await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({
          expeditionId: expOtro._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(404);
    });

    test('camino feliz: actualiza status y timeline', async () => {
      const exp = await crearExpedicion({ operationType: 'export' });

      mockAeatRealService.submitAESDeclaration.mockResolvedValue({
        success: true,
        mrn: '26ES111222333444555'
      });

      const res = await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.mrn).toBe('26ES111222333444555');

      const expActualizado = await Expedition.findById(exp._id);
      expect(expActualizado.declaration.status).toBe('submitted');
      expect(expActualizado.timeline[0].action).toBe('aes_submitted_aeat');
    });

    test('500 cuando el servicio lanza', async () => {
      const exp = await crearExpedicion({ operationType: 'export' });

      mockAeatRealService.submitAESDeclaration.mockRejectedValue(
        new Error('Red no disponible')
      );

      const res = await request(app(aeatRealController.submitAESDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Red no disponible');
    });
  });

  // ============================================
  // submitNCTSDeclaration
  // ============================================
  describe('submitNCTSDeclaration', () => {
    test('400 sin expeditionId o certificateAlias', async () => {
      const res = await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({ expeditionId: 'abc' });

      expect(res.status).toBe(400);
    });

    test('404 si expediente de otro tenant', async () => {
      const expOtro = await crearExpedicion({ tenantId: TENANT_B });

      const res = await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: expOtro._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(404);
    });

    test('camino feliz: usa messageType=CC015C por defecto', async () => {
      const exp = await crearExpedicion({ operationType: 'transit' });

      mockAeatRealService.submitNCTSDeclaration.mockResolvedValue({
        success: true,
        mrn: '26ES555666777888999'
      });

      const res = await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(200);
      expect(mockAeatRealService.submitNCTSDeclaration).toHaveBeenCalledWith(
        '<H1>Test declaration</H1>',
        'FNMT-STRIX',
        'CC015C',
        { useSandbox: true }
      );

      const expActualizado = await Expedition.findById(exp._id);
      expect(expActualizado.declaration.status).toBe('submitted');
      expect(expActualizado.declaration.mrn).toBe('26ES555666777888999');
    });

    test('500 cuando el servicio lanza', async () => {
      const exp = await crearExpedicion({ operationType: 'transit' });

      mockAeatRealService.submitNCTSDeclaration.mockRejectedValue(
        new Error('Servicio NCTS no disponible')
      );

      const res = await request(app(aeatRealController.submitNCTSDeclaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('NCTS no disponible');
    });
  });

  // ============================================
  // submitICS2Declaration
  // ============================================
  describe('submitICS2Declaration', () => {
    test('400 sin expeditionId', async () => {
      const res = await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(400);
    });

    test('404 si expediente de otro tenant', async () => {
      const expOtro = await crearExpedicion({ tenantId: TENANT_B });

      const res = await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({
          expeditionId: expOtro._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(404);
    });

    test('camino feliz: usa messageType=CC315C por defecto, NO guarda MRN (ICS2 no devuelve MRN)', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitICS2Declaration.mockResolvedValue({
        success: true,
        acknowledgement: 'ICS2-ACK-123'
      });

      const res = await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX',
          messageType: 'CC315C'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.acknowledgement).toBe('ICS2-ACK-123');

      const expActualizado = await Expedition.findById(exp._id);
      expect(expActualizado.declaration.status).toBe('submitted');
      // ICS2 no asigna MRN, así que mrn debería ser undefined o null
      expect(expActualizado.declaration.mrn).toBeUndefined();
    });

    test('500 cuando el servicio lanza', async () => {
      const exp = await crearExpedicion();

      mockAeatRealService.submitICS2Declaration.mockRejectedValue(
        new Error('Timeout ICS2')
      );

      const res = await request(app(aeatRealController.submitICS2Declaration))
        .post('/r')
        .send({
          expeditionId: exp._id.toString(),
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Timeout ICS2');
    });
  });

  // ============================================
  // getDeclarationStatus
  // ============================================
  describe('getDeclarationStatus', () => {
    test('400 si falta certificateAlias', async () => {
      const res = await request(app(aeatRealController.getDeclarationStatus, 'get', '/r/26ES123456789012345'))
        .get('/r/26ES123456789012345')
        .query({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/certificado/i);
      expect(mockAeatRealService.queryDeclarationStatus).not.toHaveBeenCalled();
    });

    test('camino feliz: delega a aeatRealService y analiza con LUCI', async () => {
      mockAeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true,
        data: { status: 'accepted', mrn: '26ES123456789012345' }
      });

      mockStatusMonitor._analyzeStatusWithLuci.mockResolvedValue({
        message: 'Declaración aceptada sin incidencias'
      });

      const res = await request(app(aeatRealController.getDeclarationStatus, 'get', '/r/:mrn'))
        .get('/r/26ES123456789012345')
        .query({ certificateAlias: 'FNMT-STRIX', declarationType: 'H1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.luciAnalysis.message).toContain('aceptada');

      expect(mockAeatRealService.queryDeclarationStatus).toHaveBeenCalledWith(
        '26ES123456789012345',
        'FNMT-STRIX',
        'H1'
      );
    });

    test('500 si el servicio lanza', async () => {
      mockAeatRealService.queryDeclarationStatus.mockRejectedValue(
        new Error('AEAT no responde')
      );

      const res = await request(app(aeatRealController.getDeclarationStatus, 'get', '/r/:mrn'))
        .get('/r/26ES123456789012345')
        .query({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('AEAT no responde');
    });
  });

  // ============================================
  // getInbox
  // ============================================
  describe('getInbox', () => {
    test('400 si falta certificateAlias', async () => {
      const res = await request(app(aeatRealController.getInbox, 'get', '/r'))
        .get('/r')
        .query({});

      expect(res.status).toBe(400);
      expect(mockAeatRealService.getInbox).not.toHaveBeenCalled();
    });

    test('camino feliz: pasa filtros opcionales', async () => {
      mockAeatRealService.getInbox.mockResolvedValue({
        messages: [{ id: 'msg1', type: 'IE328' }]
      });

      const res = await request(app(aeatRealController.getInbox, 'get', '/r'))
        .get('/r')
        .query({
          certificateAlias: 'FNMT-STRIX',
          messageType: 'IE328',
          fromDate: '2026-08-01',
          toDate: '2026-08-05'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.messages).toHaveLength(1);

      expect(mockAeatRealService.getInbox).toHaveBeenCalledWith(
        'FNMT-STRIX',
        {
          messageType: 'IE328',
          fromDate: new Date('2026-08-01'),
          toDate: new Date('2026-08-05')
        }
      );
    });

    test('500 si el servicio lanza', async () => {
      mockAeatRealService.getInbox.mockRejectedValue(new Error('Bandeja no accesible'));

      const res = await request(app(aeatRealController.getInbox, 'get', '/r'))
        .get('/r')
        .query({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Bandeja no accesible');
    });
  });

  // ============================================
  // trackDeclaration
  // ============================================
  describe('trackDeclaration', () => {
    test('400 sin mrn o declarationType', async () => {
      const res = await request(app(aeatRealController.trackDeclaration))
        .post('/r')
        .send({ mrn: '26ES123' });

      expect(res.status).toBe(400);
      expect(mockStatusMonitor.trackDeclaration).not.toHaveBeenCalled();
    });

    test('camino feliz: inicia tracking con userId', async () => {
      mockStatusMonitor.trackDeclaration.mockResolvedValue({ tracked: true });

      const res = await request(app(aeatRealController.trackDeclaration))
        .post('/r')
        .send({
          mrn: '26ES123456789012345',
          declarationType: 'H7',
          expeditionId: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(200);
      expect(res.body.data.tracked).toBe(true);

      expect(mockStatusMonitor.trackDeclaration).toHaveBeenCalledWith(
        '26ES123456789012345',
        expect.objectContaining({
          declarationType: 'H7',
          userId: USER_A._id
        })
      );
    });

    test('500 si el monitor lanza', async () => {
      mockStatusMonitor.trackDeclaration.mockRejectedValue(new Error('Monitor offline'));

      const res = await request(app(aeatRealController.trackDeclaration))
        .post('/r')
        .send({ mrn: '26ES123', declarationType: 'H1' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Monitor offline');
    });
  });

  // ============================================
  // refreshDeclarationStatus
  // ============================================
  describe('refreshDeclarationStatus', () => {
    test('400 sin certificateAlias', async () => {
      const res = await request(app(aeatRealController.refreshDeclarationStatus, 'post', '/r/:mrn/refresh'))
        .post('/r/26ES123/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(mockStatusMonitor.refreshDeclarationStatus).not.toHaveBeenCalled();
    });

    test('camino feliz: refresca y devuelve nuevo estado', async () => {
      mockStatusMonitor.refreshDeclarationStatus.mockResolvedValue({
        status: 'accepted',
        updatedAt: new Date()
      });

      const res = await request(app(aeatRealController.refreshDeclarationStatus, 'post', '/r/:mrn/refresh'))
        .post('/r/26ES999/refresh')
        .send({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('accepted');
    });

    test('500 si el monitor lanza', async () => {
      mockStatusMonitor.refreshDeclarationStatus.mockRejectedValue(
        new Error('Refresh failed')
      );

      const res = await request(app(aeatRealController.refreshDeclarationStatus, 'post', '/r/:mrn/refresh'))
        .post('/r/26ES999/refresh')
        .send({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Refresh failed');
    });
  });

  // ============================================
  // predictInspectionChannel
  // ============================================
  describe('predictInspectionChannel', () => {
    test('400 sin operationData', async () => {
      const res = await request(app(aeatRealController.predictInspectionChannel))
        .post('/r')
        .send({ goods: [] });

      expect(res.status).toBe(400);
      expect(mockStatusMonitor.predictInspectionChannel).not.toHaveBeenCalled();
    });

    test('camino feliz: predice canal con datos completos', async () => {
      mockStatusMonitor.predictInspectionChannel.mockResolvedValue({
        predictedChannel: 'green',
        confidence: 0.85
      });

      const res = await request(app(aeatRealController.predictInspectionChannel))
        .post('/r')
        .send({
          operationData: { declarationType: 'H1', value: 5000 },
          goods: [{ taricCode: '8471300000' }],
          transport: { mode: 'maritime' }
        });

      expect(res.status).toBe(200);
      expect(res.body.data.predictedChannel).toBe('green');
    });

    test('500 si el predictor lanza', async () => {
      mockStatusMonitor.predictInspectionChannel.mockRejectedValue(
        new Error('Modelo no disponible')
      );

      const res = await request(app(aeatRealController.predictInspectionChannel))
        .post('/r')
        .send({ operationData: { value: 1000 } });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Modelo no disponible');
    });
  });

  // ============================================
  // submitDigitalDocuments
  // ============================================
  describe('submitDigitalDocuments', () => {
    test('400 sin mrn, documents o certificateAlias', async () => {
      const res = await request(app(aeatRealController.submitDigitalDocuments))
        .post('/r')
        .send({ mrn: '26ES123', documents: [] });

      expect(res.status).toBe(400);
      expect(mockAeatRealService.submitDigitalDocuments).not.toHaveBeenCalled();
    });

    test('camino feliz: envía documentos digitales', async () => {
      mockAeatRealService.submitDigitalDocuments.mockResolvedValue({
        success: true,
        documentsSubmitted: 2
      });

      const res = await request(app(aeatRealController.submitDigitalDocuments))
        .post('/r')
        .send({
          mrn: '26ES123456789012345',
          documents: [{ type: 'invoice', data: 'base64...' }],
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.documentsSubmitted).toBe(2);
    });

    test('500 si el servicio lanza', async () => {
      mockAeatRealService.submitDigitalDocuments.mockRejectedValue(
        new Error('Documentos rechazados')
      );

      const res = await request(app(aeatRealController.submitDigitalDocuments))
        .post('/r')
        .send({
          mrn: '26ES123',
          documents: [{}],
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Documentos rechazados');
    });
  });

  // ============================================
  // testConnectivity
  // ============================================
  describe('testConnectivity', () => {
    test('400 sin certificateAlias', async () => {
      const res = await request(app(aeatRealController.testConnectivity))
        .post('/r')
        .send({});

      expect(res.status).toBe(400);
      expect(mockAeatRealService.testConnectivity).not.toHaveBeenCalled();
    });

    test('camino feliz: prueba conectividad con servicios por defecto', async () => {
      mockAeatRealService.testConnectivity.mockResolvedValue({
        H1_STATUS: { available: true },
        AES_STATUS: { available: true }
      });

      const res = await request(app(aeatRealController.testConnectivity))
        .post('/r')
        .send({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(200);
      expect(res.body.data.H1_STATUS.available).toBe(true);

      expect(mockAeatRealService.testConnectivity).toHaveBeenCalledWith(
        'FNMT-STRIX',
        { services: ['H1_STATUS', 'AES_STATUS'] }
      );
    });

    test('500 si el test lanza', async () => {
      mockAeatRealService.testConnectivity.mockRejectedValue(
        new Error('Red no alcanzable')
      );

      const res = await request(app(aeatRealController.testConnectivity))
        .post('/r')
        .send({ certificateAlias: 'FNMT-STRIX' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Red no alcanzable');
    });
  });

  // ============================================
  // setEnvironment (con guard de rol admin para 'production')
  // ============================================
  describe('setEnvironment', () => {
    test('400 si environment no es sandbox ni production', async () => {
      const res = await request(app(aeatRealController.setEnvironment))
        .post('/r')
        .send({ environment: 'staging' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/sandbox o production/i);
    });

    test('permite sandbox a usuario no-admin', async () => {
      const res = await request(app(aeatRealController.setEnvironment))
        .post('/r')
        .send({ environment: 'sandbox' });

      if (res.status !== 200) {
        console.error('Error en setEnvironment sandbox:', res.body);
      }

      expect(res.status).toBe(200);
      expect(res.body.data.environment).toBe('sandbox');
    });

    test('403 si usuario no-admin intenta production', async () => {
      const res = await request(app(aeatRealController.setEnvironment, 'post', '/r', USER_A))
        .post('/r')
        .send({ environment: 'production' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/administradores/i);
    });

    test('permite production a admin', async () => {
      const res = await request(app(aeatRealController.setEnvironment, 'post', '/r', USER_ADMIN))
        .post('/r')
        .send({ environment: 'production' });

      expect(res.status).toBe(200);
      expect(res.body.data.environment).toBe('production');
    });

    test('500 si BASE_URLS lanza al accederlo', async () => {
      // Forzar que acceder a BASE_URLS lance
      Object.defineProperty(mockAeatRealService, 'BASE_URLS', {
        get() {
          throw new Error('BASE_URLS corrupto');
        },
        configurable: true
      });

      const res = await request(app(aeatRealController.setEnvironment))
        .post('/r')
        .send({ environment: 'sandbox' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('BASE_URLS corrupto');

      // Restaurar
      Object.defineProperty(mockAeatRealService, 'BASE_URLS', {
        value: {
          SANDBOX: 'https://aeat.es/sandbox',
          PRODUCTION: 'https://aeat.es/production'
        },
        writable: true,
        configurable: true
      });
    });
  });

  // ============================================
  // getServiceStatus
  // ============================================
  describe('getServiceStatus', () => {
    test('camino feliz: devuelve info del servicio', async () => {
      mockAeatRealService.getInfo.mockReturnValue({
        environment: 'sandbox',
        baseUrl: 'https://aeat.es/sandbox',
        supportedDeclarations: ['H1', 'H7', 'AES'],
        sslStatus: { valid: true },
        simulationMode: false
      });

      mockCertService.listCertificates.mockResolvedValue({
        certificates: [{ alias: 'FNMT-STRIX' }]
      });

      mockStatusMonitor.listTrackedDeclarations = jest.fn().mockResolvedValue({ total: 5 });
      mockStatusMonitor.alerts = [{ id: 'a1' }];

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.status.environment).toBe('sandbox');
      expect(res.body.data.status.certificatesLoaded).toBe(1);
      expect(res.body.data.status.activeMonitoring).toBe(5);
      expect(res.body.data.status.activeAlerts).toBe(1);
      expect(res.body.data.luciAnalysis.message).toContain('operativo');
    });

    test('500 si getInfo lanza', async () => {
      mockAeatRealService.getInfo.mockImplementation(() => {
        throw new Error('Info no disponible');
      });

      const res = await request(app(aeatRealController.getServiceStatus, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Info no disponible');
    });
  });

  // ============================================
  // reloadSSLCertificate
  // ============================================
  describe('reloadSSLCertificate', () => {
    test('camino feliz: recarga certificado SSL', async () => {
      mockAeatRealService.reloadCertificate.mockReturnValue({
        success: true,
        message: 'Certificado recargado'
      });

      const res = await request(app(aeatRealController.reloadSSLCertificate))
        .post('/r')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('recargado');
    });

    test('500 si reloadCertificate lanza', async () => {
      mockAeatRealService.reloadCertificate.mockImplementation(() => {
        throw new Error('Archivo no encontrado');
      });

      const res = await request(app(aeatRealController.reloadSSLCertificate))
        .post('/r')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Archivo no encontrado');
    });
  });

  // ============================================
  // submitEMCSMovement
  // ============================================
  describe('submitEMCSMovement', () => {
    test('400 sin xmlContent o certificateAlias', async () => {
      const res = await request(app(aeatRealController.submitEMCSMovement))
        .post('/r')
        .send({ xmlContent: '<IE801/>' });

      expect(res.status).toBe(400);
      expect(mockAeatRealService.submitEMCSMovement).not.toHaveBeenCalled();
    });

    test('camino feliz: envía movimiento EMCS con messageType por defecto', async () => {
      mockAeatRealService.submitEMCSMovement.mockResolvedValue({
        success: true,
        arc: 'ARC26ES123456789'
      });

      const res = await request(app(aeatRealController.submitEMCSMovement))
        .post('/r')
        .send({
          xmlContent: '<IE801>...</IE801>',
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.arc).toBe('ARC26ES123456789');

      expect(mockAeatRealService.submitEMCSMovement).toHaveBeenCalledWith(
        '<IE801>...</IE801>',
        'FNMT-STRIX',
        'IE801',
        { useSandbox: true }
      );
    });

    test('500 si el servicio lanza', async () => {
      mockAeatRealService.submitEMCSMovement.mockRejectedValue(
        new Error('EMCS no disponible')
      );

      const res = await request(app(aeatRealController.submitEMCSMovement))
        .post('/r')
        .send({
          xmlContent: '<IE801/>',
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('EMCS no disponible');
    });
  });

  // ============================================
  // querySILICIE
  // ============================================
  describe('querySILICIE', () => {
    test('400 sin queryXml o certificateAlias', async () => {
      const res = await request(app(aeatRealController.querySILICIE))
        .post('/r')
        .send({ queryXml: '<query/>' });

      expect(res.status).toBe(400);
      expect(mockAeatRealService.querySILICIE).not.toHaveBeenCalled();
    });

    test('camino feliz: consulta SILICIE', async () => {
      mockAeatRealService.querySILICIE.mockResolvedValue({
        success: true,
        results: [{ product: 'Alcohol' }]
      });

      const res = await request(app(aeatRealController.querySILICIE))
        .post('/r')
        .send({
          queryXml: '<query>...</query>',
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(1);
    });

    test('500 si el servicio lanza', async () => {
      mockAeatRealService.querySILICIE.mockRejectedValue(
        new Error('SILICIE timeout')
      );

      const res = await request(app(aeatRealController.querySILICIE))
        .post('/r')
        .send({
          queryXml: '<query/>',
          certificateAlias: 'FNMT-STRIX'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('SILICIE timeout');
    });
  });
});
