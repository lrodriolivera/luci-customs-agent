/**
 * Tests de los handlers INLINE de src/routes/declarations.js.
 *
 * Este router no lo cubria ningun test propio (0%L / 0%B). Ademas de delegar en
 * declarationController, tiene mucha logica inline: batch-submit-nl, corrections,
 * los 5 endpoints PDF (con ensureSameTenant), submit-v2/validate-v2 multi-pais,
 * CVB y el monitor NL. Aqui se ejercita ESA logica inline con Mongo real
 * (Expedition) y supertest, mockeando solo fronteras (PDF, factory de aduanas,
 * servicios NL, middleware auth/validators).
 *
 * Los modelos H7Declaration/ENSDeclaration tienen decenas de campos required; en
 * los dos endpoints PDF que los usan insertamos el doc directamente en la
 * coleccion (saltando la validacion de Mongoose) porque el handler solo hace
 * findById(...).lean() + ensureSameTenant + pdfGenerator: no ejercita el schema.
 */

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// --- Fronteras mockeadas ---
jest.mock('../../src/services/pdfGenerator', () => ({
  generateH1PDF: jest.fn().mockResolvedValue(Buffer.from('PDF-H1')),
  generateAESPDF: jest.fn().mockResolvedValue(Buffer.from('PDF-AES')),
  generateH7PDF: jest.fn().mockResolvedValue(Buffer.from('PDF-H7')),
  generateENSPDF: jest.fn().mockResolvedValue(Buffer.from('PDF-ENS')),
  generateExpeditionSummaryPDF: jest.fn().mockResolvedValue(Buffer.from('PDF-SUM'))
}));

const mockSubmitBatchDECO = jest.fn();
const mockSubmitDeclaration = jest.fn();
const mockValidateDeclaration = jest.fn();
jest.mock('../../src/services/customs', () => ({
  CustomsServiceFactory: {
    getSupportedCountries: jest.fn(() => [{ code: 'ES', name: 'España' }, { code: 'NL', name: 'Netherlands' }]),
    getServiceForTenant: jest.fn(() => ({
      submitBatchDECO: mockSubmitBatchDECO,
      submitDeclaration: mockSubmitDeclaration,
      validateDeclaration: mockValidateDeclaration
    }))
  },
  NetherlandsCustomsService: jest.fn().mockImplementation(() => ({}))
}));

const mockGetPending = jest.fn();
const mockSubmitCorrection = jest.fn();
jest.mock('../../src/services/customs/netherlands/nlCorrectionWorkflow', () => ({
  getPendingCorrections: mockGetPending,
  submitCorrection: mockSubmitCorrection
}));

const mockRequestRelease = jest.fn();
const mockCheckStatus = jest.fn();
jest.mock('../../src/services/customs/netherlands/cvbService', () =>
  jest.fn().mockImplementation(() => ({
    requestRelease: mockRequestRelease,
    checkReleaseStatus: mockCheckStatus
  }))
);

const mockGetHealth = jest.fn();
const mockGetStats = jest.fn();
jest.mock('../../src/services/customs/netherlands/nlStatusMonitor', () =>
  jest.fn().mockImplementation(() => ({
    getSystemHealth: mockGetHealth,
    getStats: mockGetStats
  }))
);

// declarationController: sus handlers se prueban en sus propias suites; aqui solo
// nos importa que el router los enrute, asi que los reemplazamos por un eco.
jest.mock('../../src/controllers/declarationController', () => {
  const passthrough = (req, res) => res.json({ success: true, delegated: true });
  return new Proxy({}, { get: () => passthrough });
});

// Validators: passthrough (se prueban aparte).
jest.mock('../../src/middleware/validators', () => ({
  declarationValidators: new Proxy({}, { get: () => (req, res, next) => next() })
}));

// auth: inyecta lo que el handler necesita segun el usuario de cabecera de test.
let mockContexto;
jest.mock('../../src/middleware/auth', () => ({
  auth: (req, res, next) => {
    if (mockContexto) {
      req.user = mockContexto.user;
      req.tenantId = mockContexto.tenantId;
      req.tenant = mockContexto.tenant;
    }
    next();
  },
  requirePermission: () => (req, res, next) => {
    if (mockContexto?.sinPermiso) {
      return res.status(403).json({ success: false, error: 'Sin permiso' });
    }
    next();
  }
}));

const { Expedition } = require('../../src/models');
const pdfGenerator = require('../../src/services/pdfGenerator');

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

function contexto(tenantId = TENANT_A, extra = {}) {
  return {
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin', tenantId },
    tenantId: String(tenantId),
    tenant: { customsConfig: { country: 'ES' }, ...extra.tenant },
    ...extra
  };
}

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => next());
  app.use('/api/declarations', require('../../src/routes/declarations'));
  return app;
}

let app;

async function crearExpediente(tenantId = TENANT_A, extra = {}) {
  return Expedition.create({
    tenantId,
    createdBy: new mongoose.Types.ObjectId(),
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B12345678' },
    goods: [{ itemNumber: 1, description: 'Cafe', quantity: 10, invoiceValue: 1000, taricCode: '0901210000' }],
    ...extra
  });
}

describe('routes/declarations.js - handlers inline', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(() => {
    mockContexto = contexto();
    app = crearApp();
    // resetMocks:true borra tambien las implementaciones de los factory/constructor
    // mocks definidos arriba, no solo las de los jest.fn de datos. Re-instalarlas.
    const { CustomsServiceFactory } = require('../../src/services/customs');
    CustomsServiceFactory.getSupportedCountries.mockReturnValue([
      { code: 'ES', name: 'España' }, { code: 'NL', name: 'Netherlands' }
    ]);
    CustomsServiceFactory.getServiceForTenant.mockReturnValue({
      submitBatchDECO: mockSubmitBatchDECO,
      submitDeclaration: mockSubmitDeclaration,
      validateDeclaration: mockValidateDeclaration
    });
    const CVBService = require('../../src/services/customs/netherlands/cvbService');
    CVBService.mockImplementation(() => ({ requestRelease: mockRequestRelease, checkReleaseStatus: mockCheckStatus }));
    const NLStatusMonitor = require('../../src/services/customs/netherlands/nlStatusMonitor');
    NLStatusMonitor.mockImplementation(() => ({ getSystemHealth: mockGetHealth, getStats: mockGetStats }));
    mockSubmitBatchDECO.mockResolvedValue({ success: true, results: [] });
    mockSubmitDeclaration.mockResolvedValue({ success: true, mrn: 'MRN123', channel: 'green', code: '0000', csv: 'CSV1' });
    mockValidateDeclaration.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    mockGetPending.mockResolvedValue([]);
    mockSubmitCorrection.mockResolvedValue({ success: true });
    mockRequestRelease.mockResolvedValue({ success: true, releaseId: 'REL1', status: 'pending' });
    mockCheckStatus.mockResolvedValue({ success: true, status: 'released' });
    mockGetHealth.mockResolvedValue({ deco: 'up', dms: 'up' });
    mockGetStats.mockReturnValue({ total: 0 });
  });

  describe('GET /supported-countries', () => {
    test('devuelve la lista de paises del factory', async () => {
      const res = await request(app).get('/api/declarations/supported-countries');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NL' })]));
    });
  });

  describe('POST /batch-submit-nl', () => {
    test('400 si falta expeditionIds', async () => {
      const res = await request(app).post('/api/declarations/batch-submit-nl').send({});
      expect(res.status).toBe(400);
    });

    test('400 si expeditionIds no es array', async () => {
      const res = await request(app).post('/api/declarations/batch-submit-nl').send({ expeditionIds: 'x' });
      expect(res.status).toBe(400);
    });

    test('400 si supera el maximo de 5000', async () => {
      const res = await request(app).post('/api/declarations/batch-submit-nl')
        .send({ expeditionIds: new Array(5001).fill('a') });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/5.?000/);
    });

    test('procesa el batch y actualiza los expedientes aceptados', async () => {
      const exp = await crearExpediente(TENANT_A, { expeditionId: 'EXP-NL-1' });
      mockSubmitBatchDECO.mockResolvedValue({
        success: true,
        results: [{ success: true, mrn: 'NLMRN1', expeditionId: 'EXP-NL-1', simulated: true }]
      });
      const res = await request(app).post('/api/declarations/batch-submit-nl')
        .send({ expeditionIds: [String(exp._id)] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const actualizado = await Expedition.findOne({ expeditionId: 'EXP-NL-1' });
      expect(actualizado.declaration.mrn).toBe('NLMRN1');
      expect(actualizado.declaration.status).toBe('accepted');
    });

    test('500 si el servicio batch lanza', async () => {
      mockSubmitBatchDECO.mockRejectedValue(new Error('boom'));
      const res = await request(app).post('/api/declarations/batch-submit-nl')
        .send({ expeditionIds: [String(new mongoose.Types.ObjectId())] });
      expect(res.status).toBe(500);
    });

    test('solo recoge expedientes del propio tenant', async () => {
      const propio = await crearExpediente(TENANT_A);
      const ajeno = await crearExpediente(TENANT_B);
      await request(app).post('/api/declarations/batch-submit-nl')
        .send({ expeditionIds: [String(propio._id), String(ajeno._id)] });
      // el servicio recibe solo el del tenant A
      const enviados = mockSubmitBatchDECO.mock.calls[0][0];
      expect(enviados).toHaveLength(1);
      expect(String(enviados[0]._id)).toBe(String(propio._id));
    });
  });

  describe('GET /corrections/pending', () => {
    test('devuelve las correcciones pendientes', async () => {
      mockGetPending.mockResolvedValue([{ id: 'c1' }]);
      const res = await request(app).get('/api/declarations/corrections/pending');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 'c1' }]);
    });

    test('500 si el workflow lanza', async () => {
      mockGetPending.mockRejectedValue(new Error('x'));
      const res = await request(app).get('/api/declarations/corrections/pending');
      expect(res.status).toBe(500);
    });
  });

  describe('PDF: /:expeditionId/pdf (H1/AES) con tenant guard', () => {
    test('el dueño recibe el PDF H1 (import)', async () => {
      const exp = await crearExpediente(TENANT_A, { expeditionId: 'PDF1', operationType: 'import' });
      const res = await request(app).get(`/api/declarations/${exp._id}/pdf`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(pdfGenerator.generateH1PDF).toHaveBeenCalled();
    });

    test('genera AES cuando operationType es export', async () => {
      const exp = await crearExpediente(TENANT_A, { expeditionId: 'PDF2', operationType: 'export' });
      const res = await request(app).get(`/api/declarations/${exp._id}/pdf`);
      expect(res.status).toBe(200);
      expect(pdfGenerator.generateAESPDF).toHaveBeenCalled();
    });

    test('modo borrador (preview=true) pasa draft:true', async () => {
      const exp = await crearExpediente(TENANT_A, { expeditionId: 'PDF3' });
      await request(app).get(`/api/declarations/${exp._id}/pdf?preview=true`);
      expect(pdfGenerator.generateH1PDF).toHaveBeenCalledWith(expect.anything(), { draft: true });
    });

    test('un usuario de OTRO tenant recibe 404 y NO se genera PDF (discriminante)', async () => {
      const exp = await crearExpediente(TENANT_A, { expeditionId: 'PDF4' });
      mockContexto = contexto(TENANT_B); // intruso
      const res = await request(app).get(`/api/declarations/${exp._id}/pdf`);
      expect(res.status).toBe(404);
      expect(pdfGenerator.generateH1PDF).not.toHaveBeenCalled();
      expect(pdfGenerator.generateAESPDF).not.toHaveBeenCalled();
    });

    test('500 si el generador de PDF lanza', async () => {
      const exp = await crearExpediente(TENANT_A);
      pdfGenerator.generateH1PDF.mockRejectedValueOnce(new Error('pdf fail'));
      const res = await request(app).get(`/api/declarations/${exp._id}/pdf`);
      expect(res.status).toBe(500);
    });
  });

  describe('PDF: /h7/:id/pdf y /ens/:id/pdf', () => {
    // Insertamos H7/ENS directamente en la coleccion para saltar la validacion
    // del schema (el handler solo hace findById().lean()).
    async function insertarDoc(nombreColeccion, tenantId, extra = {}) {
      const col = mongoose.connection.collection(nombreColeccion);
      const _id = new mongoose.Types.ObjectId();
      await col.insertOne({ _id, tenantId, ...extra });
      return _id;
    }

    test('H7 PDF: el dueño lo recibe', async () => {
      const id = await insertarDoc('h7declarations', TENANT_A, { declarationNumber: 'H7-1' });
      const res = await request(app).get(`/api/declarations/h7/${id}/pdf`);
      expect(res.status).toBe(200);
      expect(pdfGenerator.generateH7PDF).toHaveBeenCalled();
    });

    test('H7 PDF: otro tenant recibe 404 (discriminante)', async () => {
      const id = await insertarDoc('h7declarations', TENANT_A, { declarationNumber: 'H7-2' });
      mockContexto = contexto(TENANT_B);
      const res = await request(app).get(`/api/declarations/h7/${id}/pdf`);
      expect(res.status).toBe(404);
      expect(pdfGenerator.generateH7PDF).not.toHaveBeenCalled();
    });

    test('ENS PDF: el dueño lo recibe', async () => {
      const id = await insertarDoc('ensdeclarations', TENANT_A, { lrn: 'LRN-1' });
      const res = await request(app).get(`/api/declarations/ens/${id}/pdf`);
      expect(res.status).toBe(200);
      expect(pdfGenerator.generateENSPDF).toHaveBeenCalled();
    });

    test('ENS PDF: otro tenant recibe 404 (discriminante)', async () => {
      const id = await insertarDoc('ensdeclarations', TENANT_A, { lrn: 'LRN-2' });
      mockContexto = contexto(TENANT_B);
      const res = await request(app).get(`/api/declarations/ens/${id}/pdf`);
      expect(res.status).toBe(404);
      expect(pdfGenerator.generateENSPDF).not.toHaveBeenCalled();
    });
  });

  describe('GET /:expeditionId/summary-pdf', () => {
    test('el dueño recibe el resumen', async () => {
      const exp = await crearExpediente(TENANT_A, { expeditionId: 'SUM1' });
      const res = await request(app).get(`/api/declarations/${exp._id}/summary-pdf`);
      expect(res.status).toBe(200);
      expect(pdfGenerator.generateExpeditionSummaryPDF).toHaveBeenCalled();
    });

    test('otro tenant recibe 404', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockContexto = contexto(TENANT_B);
      const res = await request(app).get(`/api/declarations/${exp._id}/summary-pdf`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /:expeditionId/submit-v2 (multi-pais)', () => {
    test('404 si el expediente no es del tenant', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockContexto = contexto(TENANT_B);
      const res = await request(app).post(`/api/declarations/${exp._id}/submit-v2`).send({});
      expect(res.status).toBe(404);
    });

    test('400 si la declaracion ya esta aceptada', async () => {
      const exp = await crearExpediente(TENANT_A, { declaration: { type: 'H1', status: 'accepted' } });
      const res = await request(app).post(`/api/declarations/${exp._id}/submit-v2`).send({});
      expect(res.status).toBe(400);
    });

    test('envia y persiste el MRN cuando el servicio responde OK (ES/AEAT)', async () => {
      const exp = await crearExpediente(TENANT_A, { declaration: { type: 'H1', status: 'draft' } });
      const res = await request(app).post(`/api/declarations/${exp._id}/submit-v2`).send({});
      expect(res.status).toBe(200);
      expect(res.body.data.system).toBe('AEAT');
      const actualizado = await Expedition.findById(exp._id);
      expect(actualizado.declaration.mrn).toBe('MRN123');
      expect(actualizado.declaration.status).toBe('accepted');
    });

    test('system=DMS 4.0 para NL con declaracion H1', async () => {
      const exp = await crearExpediente(TENANT_A, { declaration: { type: 'H1', status: 'draft' } });
      mockContexto = contexto(TENANT_A, { tenant: { customsConfig: { country: 'NL' } } });
      const res = await request(app).post(`/api/declarations/${exp._id}/submit-v2`).send({});
      expect(res.status).toBe(200);
      expect(res.body.data.system).toBe('DMS 4.0');
    });

    test('system=DECO para NL con declaracion H7', async () => {
      const exp = await crearExpediente(TENANT_A, { declaration: { type: 'H7', status: 'draft' } });
      mockContexto = contexto(TENANT_A, { tenant: { customsConfig: { country: 'NL' } } });
      const res = await request(app).post(`/api/declarations/${exp._id}/submit-v2`).send({});
      expect(res.body.data.system).toBe('DECO');
    });

    test('403 si no tiene permiso canApproveDeclarations', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockContexto = { ...contexto(TENANT_A), sinPermiso: true };
      const res = await request(app).post(`/api/declarations/${exp._id}/submit-v2`).send({});
      expect(res.status).toBe(403);
    });

    test('500 si el servicio de aduanas lanza', async () => {
      const exp = await crearExpediente(TENANT_A, { declaration: { type: 'H1', status: 'draft' } });
      mockSubmitDeclaration.mockRejectedValue(new Error('down'));
      const res = await request(app).post(`/api/declarations/${exp._id}/submit-v2`).send({});
      expect(res.status).toBe(500);
    });
  });

  describe('POST /:expeditionId/validate-v2', () => {
    test('404 si no es del tenant', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockContexto = contexto(TENANT_B);
      const res = await request(app).post(`/api/declarations/${exp._id}/validate-v2`).send({});
      expect(res.status).toBe(404);
    });

    test('valida y usa declarationType del body cuando no hay declaracion', async () => {
      const exp = await crearExpediente(TENANT_A);
      const res = await request(app).post(`/api/declarations/${exp._id}/validate-v2`).send({ declarationType: 'H7' });
      expect(res.status).toBe(200);
      expect(res.body.data.declarationType).toBe('H7');
      expect(res.body.data.system).toBe('AEAT');
    });

    test('500 si la validacion lanza', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockValidateDeclaration.mockRejectedValue(new Error('v fail'));
      const res = await request(app).post(`/api/declarations/${exp._id}/validate-v2`).send({});
      expect(res.status).toBe(500);
    });
  });

  describe('CVB: cvb-request / cvb-status', () => {
    test('cvb-request 404 si no es del tenant', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockContexto = contexto(TENANT_B);
      const res = await request(app).post(`/api/declarations/${exp._id}/cvb-request`).send({});
      expect(res.status).toBe(404);
    });

    test('cvb-request persiste releaseId al tener exito', async () => {
      const exp = await crearExpediente(TENANT_A);
      const res = await request(app).post(`/api/declarations/${exp._id}/cvb-request`)
        .send({ containerNumber: 'CONT1' });
      expect(res.status).toBe(200);
      const actualizado = await Expedition.findById(exp._id);
      expect(actualizado.cvbReleaseId).toBe('REL1');
      expect(actualizado.cvbStatus).toBe('pending');
    });

    test('cvb-status 400 si no hay releaseId previo', async () => {
      const exp = await crearExpediente(TENANT_A);
      const res = await request(app).get(`/api/declarations/${exp._id}/cvb-status`);
      expect(res.status).toBe(400);
    });

    test('cvb-status devuelve y actualiza el estado', async () => {
      const exp = await crearExpediente(TENANT_A, { cvbReleaseId: 'REL9' });
      const res = await request(app).get(`/api/declarations/${exp._id}/cvb-status`);
      expect(res.status).toBe(200);
      const actualizado = await Expedition.findById(exp._id);
      expect(actualizado.cvbStatus).toBe('released');
    });

    test('cvb-status 500 si el servicio lanza', async () => {
      const exp = await crearExpediente(TENANT_A, { cvbReleaseId: 'REL9' });
      mockCheckStatus.mockRejectedValue(new Error('cvb down'));
      const res = await request(app).get(`/api/declarations/${exp._id}/cvb-status`);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /:expeditionId/corrections/:correctionId/submit', () => {
    test('404 si no es del tenant', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockContexto = contexto(TENANT_B);
      const res = await request(app).post(`/api/declarations/${exp._id}/corrections/c1/submit`)
        .send({ correctedData: { x: 1 } });
      expect(res.status).toBe(404);
    });

    test('400 si falta correctedData', async () => {
      const exp = await crearExpediente(TENANT_A);
      const res = await request(app).post(`/api/declarations/${exp._id}/corrections/c1/submit`).send({});
      expect(res.status).toBe(400);
    });

    test('envia la correccion con exito', async () => {
      const exp = await crearExpediente(TENANT_A);
      const res = await request(app).post(`/api/declarations/${exp._id}/corrections/c1/submit`)
        .send({ correctedData: { campo: 'valor' } });
      expect(res.status).toBe(200);
      expect(mockSubmitCorrection).toHaveBeenCalledWith(expect.anything(), 'c1', { campo: 'valor' });
    });

    test('500 si el workflow lanza', async () => {
      const exp = await crearExpediente(TENANT_A);
      mockSubmitCorrection.mockRejectedValue(new Error('corr fail'));
      const res = await request(app).post(`/api/declarations/${exp._id}/corrections/c1/submit`)
        .send({ correctedData: { x: 1 } });
      expect(res.status).toBe(500);
    });
  });

  describe('NL monitor', () => {
    test('health devuelve el estado del sistema', async () => {
      const res = await request(app).get('/api/declarations/nl/monitor/health');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ deco: 'up', dms: 'up' });
    });

    test('health 500 si el monitor lanza', async () => {
      mockGetHealth.mockRejectedValue(new Error('mon fail'));
      const res = await request(app).get('/api/declarations/nl/monitor/health');
      expect(res.status).toBe(500);
    });

    test('stats devuelve las estadisticas', async () => {
      const res = await request(app).get('/api/declarations/nl/monitor/stats');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ total: 0 });
    });

    test('stats 500 si lanza', async () => {
      mockGetStats.mockImplementation(() => { throw new Error('stats fail'); });
      const res = await request(app).get('/api/declarations/nl/monitor/stats');
      expect(res.status).toBe(500);
    });
  });

  describe('rutas delegadas al controller', () => {
    test('h1/generate delega en el controller', async () => {
      const res = await request(app).post('/api/declarations/h1/generate').send({});
      expect(res.status).toBe(200);
      expect(res.body.delegated).toBe(true);
    });

    test('summary delega en el controller', async () => {
      const res = await request(app).get(`/api/declarations/${new mongoose.Types.ObjectId()}/summary`);
      expect(res.body.delegated).toBe(true);
    });
  });
});
