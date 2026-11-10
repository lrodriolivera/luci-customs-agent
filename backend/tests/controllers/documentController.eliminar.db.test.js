/**
 * documentController.deleteDocument — el agente elimina un documento subido
 * por error (UAT 10/Nov/2026). Expedition real (Mongo en memoria); mockeado
 * solo el disco.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({ extractDocumentData: jest.fn(), validateDocument: jest.fn() }));
jest.mock('../../src/middleware/upload', () => ({ fileUtils: { fileExists: jest.fn(() => true), deleteFile: jest.fn() } }));

const ctrl = require('../../src/controllers/documentController');
const { fileUtils } = require('../../src/middleware/upload');
const { Expedition } = require('../../src/models');

usarBaseDeDatosEnMemoria();

const usuario = () => ({ _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId(), role: 'agent', name: 'Agente' });
function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
async function expedienteConDocumentos(user, extra = {}) {
  const exp = await Expedition.create({
    tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
    operationType: 'import', transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'B12345678' },
    goods: [{ itemNumber: 1, description: 'Portatiles', quantity: 1, invoiceValue: 100 }],
    documents: [
      { type: 'commercial_invoice', fileName: 'a.pdf', originalName: 'factura.pdf', filePath: '/tmp/a.pdf', uploadedBy: user._id },
      { type: 'packing_list', fileName: 'b.pdf', originalName: 'packing.pdf', filePath: '/tmp/b.pdf', uploadedBy: user._id }
    ],
    ...extra
  });
  exp.documentChecklist = [
    { documentType: 'commercial_invoice', received: true, validated: true, documentId: exp.documents[0]._id },
    { documentType: 'packing_list', received: true, documentId: exp.documents[1]._id }
  ];
  await exp.save();
  return exp;
}
const pedir = (user, exp, docId) => ({ user, params: { expeditionId: String(exp._id), docId: String(docId) } });

beforeEach(() => jest.clearAllMocks());

describe('deleteDocument', () => {
  test('elimina el documento, libera su linea del checklist y devuelve el expediente', async () => {
    const user = usuario();
    const exp = await expedienteConDocumentos(user);
    const res = crearRes();

    await ctrl.deleteDocument(pedir(user, exp, exp.documents[0]._id), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expedition.documents.map(d => d.originalName)).toEqual(['packing.pdf']);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents).toHaveLength(1);
    const factura = guardado.documentChecklist.find(i => i.documentType === 'commercial_invoice');
    expect(factura.received).toBe(false);
    expect(factura.validated).toBe(false);
    expect(factura.documentId).toBeNull();
    expect(guardado.documentChecklist.find(i => i.documentType === 'packing_list').received).toBe(true);
    expect(fileUtils.deleteFile).toHaveBeenCalledWith('a.pdf');
    const evento = guardado.timeline.find(e => e.action === 'document_deleted');
    expect(evento.description).toContain('factura.pdf');
  });

  test('con la declaracion presentada responde 409 y no borra nada', async () => {
    const user = usuario();
    const exp = await expedienteConDocumentos(user, { status: 'declaration_submitted' });
    const res = crearRes();

    await ctrl.deleteDocument(pedir(user, exp, exp.documents[0]._id), res);

    expect(res.statusCode).toBe(409);
    expect((await Expedition.findById(exp._id)).documents).toHaveLength(2);
    expect(fileUtils.deleteFile).not.toHaveBeenCalled();
  });

  test('un expediente de otro tenant o un documento inexistente dan 404 y no borran', async () => {
    const user = usuario();
    const exp = await expedienteConDocumentos(user);

    const ajeno = crearRes();
    await ctrl.deleteDocument(pedir(usuario(), exp, exp.documents[0]._id), ajeno);
    const inexistente = crearRes();
    await ctrl.deleteDocument(pedir(user, exp, new mongoose.Types.ObjectId()), inexistente);

    expect(ajeno.statusCode).toBe(404);
    expect(inexistente.statusCode).toBe(404);
    expect(fileUtils.deleteFile).not.toHaveBeenCalled();
  });

  test('si el expediente no se puede guardar, el archivo no se borra del disco', async () => {
    const user = usuario();
    const exp = await expedienteConDocumentos(user);
    const guardar = jest.spyOn(Expedition.prototype, 'save').mockRejectedValueOnce(new Error('sin conexion'));
    const res = crearRes();

    await ctrl.deleteDocument(pedir(user, exp, exp.documents[0]._id), res);

    guardar.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(fileUtils.deleteFile).not.toHaveBeenCalled();
    expect((await Expedition.findById(exp._id)).documents).toHaveLength(2);
  });
});
