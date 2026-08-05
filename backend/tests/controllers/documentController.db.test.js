/**
 * documentController — gestion de documentos de un expediente (subida, descarga,
 * validacion IA, borrado). Logica de negocio con tenant-scoping en los 6
 * handlers, justo lo que el mandato manda cubrir.
 *
 * FRONTERAS mockeadas SOLO las externas:
 *  - aiService.validateDocument (Bedrock).
 *  - fileUtils (sistema de archivos: fileExists/deleteFile) — no tocar disco.
 * El modelo Expedition NO se mockea: Mongo real en memoria, de modo que los
 * subdocumentos documents.id(), documentChecklist, timeline, save() y el guard
 * de tenant se ejecutan de verdad. El propio documentController NO se mockea.
 *
 * jest.config tiene resetMocks:true -> los fakes se reinstalan en beforeEach.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  validateDocument: jest.fn()
}));
jest.mock('../../src/middleware/upload', () => ({
  fileUtils: {
    fileExists: jest.fn(() => true),
    deleteFile: jest.fn()
  }
}));

const documentController = require('../../src/controllers/documentController');
const aiService = require('../../src/services/aiService');
const { fileUtils } = require('../../src/middleware/upload');
const { Expedition } = require('../../src/models');
const User = require('../../src/models/User');

usarBaseDeDatosEnMemoria();

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.downloaded = undefined;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.download = jest.fn((path, name) => { res.downloaded = { path, name }; return res; });
  return res;
}
function mockReq({ user, params = {}, body = {}, file } = {}) {
  return {
    user,
    tenantId: user?.tenantId ? String(user.tenantId) : undefined,
    params, body, file
  };
}
const fakeFile = () => ({
  filename: 'stored-123.pdf', originalname: 'factura.pdf',
  path: '/tmp/stored-123.pdf', size: 2048, mimetype: 'application/pdf'
});

let TENANT_A;
let TENANT_B;
let adminA;
let otroTenantUser;

beforeEach(async () => {
  TENANT_A = new mongoose.Types.ObjectId();
  TENANT_B = new mongoose.Types.ObjectId();
  const uniq = `${Date.now()}-${Math.round(performance.now())}`;
  adminA = await User.create({
    name: 'Admin A', email: `a-${uniq}@a.es`, password: 'secret123', role: 'admin', tenantId: TENANT_A
  });
  otroTenantUser = await User.create({
    name: 'Otro', email: `o-${uniq}@b.es`, password: 'secret123', role: 'agent', tenantId: TENANT_B
  });

  fileUtils.fileExists.mockReturnValue(true);
  aiService.validateDocument.mockResolvedValue({
    isValid: true, notes: 'OK', confidence: 92, extractedData: { total: 500 }
  });
});

// Crea un expediente con N documentos ya adjuntos (status configurable).
async function sembrarExp(tenantId, { docs = [], checklist = [] } = {}) {
  return Expedition.create({
    tenantId, operationType: 'import', transportMode: 'maritime',
    client: { companyName: 'C', nif: 'B12345678' }, createdBy: adminA._id,
    documents: docs, documentChecklist: checklist
  });
}
const docFixture = (over = {}) => ({
  type: 'commercial_invoice', fileName: 'f.pdf', originalName: 'f.pdf',
  filePath: '/tmp/f.pdf', status: 'pending', ...over
});

describe('upload', () => {
  test('400 si no hay archivo', async () => {
    const exp = await sembrarExp(TENANT_A);
    const res = mockRes();
    await documentController.upload(
      mockReq({ user: adminA, body: { expeditionId: exp._id.toString(), documentType: 'commercial_invoice' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('404 si el expediente es de otro tenant', async () => {
    const exp = await sembrarExp(TENANT_B);
    const res = mockRes();
    await documentController.upload(
      mockReq({ user: adminA, file: fakeFile(),
        body: { expeditionId: exp._id.toString(), documentType: 'commercial_invoice' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('adjunta el documento, marca el checklist y guarda', async () => {
    const exp = await sembrarExp(TENANT_A, {
      checklist: [{ documentType: 'commercial_invoice', required: true, received: false }]
    });
    const res = mockRes();
    await documentController.upload(
      mockReq({ user: adminA, file: fakeFile(),
        body: { expeditionId: exp._id.toString(), documentType: 'commercial_invoice' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.document.originalName).toBe('factura.pdf');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents).toHaveLength(1);
    expect(guardado.documentChecklist[0].received).toBe(true);
    expect(guardado.timeline.some(t => t.action === 'document_uploaded')).toBe(true);
  });
});

describe('getDocument', () => {
  test('404 cross-tenant', async () => {
    const exp = await sembrarExp(TENANT_B, { docs: [docFixture()] });
    const res = mockRes();
    await documentController.getDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: exp.documents[0]._id.toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('404 si el documento no existe en el expediente', async () => {
    const exp = await sembrarExp(TENANT_A);
    const res = mockRes();
    await documentController.getDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: new mongoose.Types.ObjectId().toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('404 si el archivo fisico no existe', async () => {
    fileUtils.fileExists.mockReturnValue(false);
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture()] });
    const res = mockRes();
    await documentController.getDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: exp.documents[0]._id.toString() } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/servidor/);
  });

  test('descarga el archivo cuando existe', async () => {
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture({ filePath: '/tmp/x.pdf', originalName: 'x.pdf' })] });
    const res = mockRes();
    await documentController.getDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: exp.documents[0]._id.toString() } }), res);
    expect(res.downloaded).toEqual({ path: '/tmp/x.pdf', name: 'x.pdf' });
  });
});

describe('validateDocument', () => {
  test('404 cross-tenant', async () => {
    const exp = await sembrarExp(TENANT_B, { docs: [docFixture()] });
    const res = mockRes();
    await documentController.validateDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: exp.documents[0]._id.toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('404 si el documento no existe', async () => {
    const exp = await sembrarExp(TENANT_A);
    const res = mockRes();
    await documentController.validateDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: new mongoose.Types.ObjectId().toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('valida OK: marca validated, guarda notas y confianza', async () => {
    const exp = await sembrarExp(TENANT_A, {
      docs: [docFixture()],
      checklist: []
    });
    const docId = exp.documents[0]._id.toString();
    const res = mockRes();
    await documentController.validateDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId } }), res);

    expect(res.body.success).toBe(true);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents[0].status).toBe('validated');
    expect(guardado.documents[0].aiConfidence).toBe(92);
    expect(guardado.timeline.some(t => t.action === 'document_validated')).toBe(true);
  });

  test('invalido: marca needs_revision', async () => {
    aiService.validateDocument.mockResolvedValue({ isValid: false, notes: 'Falta sello', confidence: 40 });
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture()] });
    const docId = exp.documents[0]._id.toString();
    const res = mockRes();
    await documentController.validateDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId } }), res);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents[0].status).toBe('needs_revision');
  });

  test('con autoFillSuggestions guarda extractedData en aiAnalysis', async () => {
    aiService.validateDocument.mockResolvedValue({
      isValid: true, notes: 'OK', confidence: 88,
      extractedData: { total: 1000 }, autoFillSuggestions: { total: 1000 }
    });
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture()] });
    const docId = exp.documents[0]._id.toString();
    const res = mockRes();
    await documentController.validateDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId } }), res);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.documentValidation.commercial_invoice).toEqual({ total: 1000 });
    expect(guardado.aiAnalysis.lastAnalysisAt).toBeInstanceOf(Date);
  });

  test('500 si aiService lanza', async () => {
    aiService.validateDocument.mockRejectedValue(new Error('bedrock down'));
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture()] });
    const docId = exp.documents[0]._id.toString();
    const res = mockRes();
    await documentController.validateDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getExtractedData', () => {
  test('404 si no hay datos extraidos', async () => {
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture()] });
    const res = mockRes();
    await documentController.getExtractedData(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: exp.documents[0]._id.toString() } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/datos extraidos/);
  });

  test('devuelve los datos extraidos', async () => {
    const exp = await sembrarExp(TENANT_A, {
      docs: [docFixture({ extractedData: { total: 777 }, aiConfidence: 90, validatedAt: new Date() })]
    });
    const res = mockRes();
    await documentController.getExtractedData(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: exp.documents[0]._id.toString() } }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.extractedData).toEqual({ total: 777 });
    expect(res.body.data.confidence).toBe(90);
  });
});

describe('deleteDocument', () => {
  test('404 cross-tenant', async () => {
    const exp = await sembrarExp(TENANT_B, { docs: [docFixture()] });
    const res = mockRes();
    await documentController.deleteDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId: exp.documents[0]._id.toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('elimina el documento, borra el archivo y actualiza checklist', async () => {
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture()] });
    const docId = exp.documents[0]._id.toString();
    // Vincular el checklist al documento por su id.
    exp.documentChecklist.push({ documentType: 'commercial_invoice', required: true, received: true, documentId: exp.documents[0]._id });
    await exp.save();

    const res = mockRes();
    await documentController.deleteDocument(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString(), docId } }), res);

    expect(res.body.success).toBe(true);
    expect(fileUtils.deleteFile).toHaveBeenCalledWith('f.pdf');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents).toHaveLength(0);
    expect(guardado.documentChecklist[0].received).toBe(false);
  });
});

describe('validateAll', () => {
  test('400 si no hay documentos pendientes', async () => {
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture({ status: 'validated' })] });
    const res = mockRes();
    await documentController.validateAll(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('valida los pendientes y deja el expediente validado si el requerido pasa', async () => {
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture(), docFixture({ type: 'packing_list', fileName: 'p.pdf' })] });
    // Marcar ambos como requeridos y vinculados en el checklist.
    exp.documentChecklist.push(
      { documentType: 'commercial_invoice', required: true, documentId: exp.documents[0]._id },
      { documentType: 'packing_list', required: true, documentId: exp.documents[1]._id }
    );
    await exp.save();

    const res = mockRes();
    await documentController.validateAll(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toHaveLength(2);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('documents_validated');
  });

  test('un fallo de IA en un doc lo marca needs_revision y deja el expediente incompleto', async () => {
    aiService.validateDocument
      .mockResolvedValueOnce({ isValid: true, notes: 'OK', confidence: 90 })
      .mockRejectedValueOnce(new Error('IA cayo'));
    const exp = await sembrarExp(TENANT_A, { docs: [docFixture(), docFixture({ type: 'packing_list', fileName: 'p.pdf' })] });
    exp.documentChecklist.push(
      { documentType: 'commercial_invoice', required: true, documentId: exp.documents[0]._id },
      { documentType: 'packing_list', required: true, documentId: exp.documents[1]._id }
    );
    await exp.save();

    const res = mockRes();
    await documentController.validateAll(
      mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } }), res);

    expect(res.body.success).toBe(true);
    const conError = res.body.data.results.find(r => r.error);
    expect(conError.error).toBe('IA cayo');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('documents_incomplete');
  });
});
