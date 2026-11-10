/**
 * Documentos subidos en el alta antes de que exista el expediente
 * (services/documentos/borradoresDocumento) y su adjuntado al crearlo.
 *
 * Mockeado solo lo externo: la lectura con IA y el disco. DocumentDraft y
 * Expedition son reales (Mongo en memoria).
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({ extractDocumentData: jest.fn() }));
jest.mock('../../src/middleware/upload', () => ({ fileUtils: { fileExists: jest.fn(() => true), deleteFile: jest.fn() } }));

const aiService = require('../../src/services/aiService');
const { fileUtils } = require('../../src/middleware/upload');
const { DocumentDraft, Expedition } = require('../../src/models');
const { normalizarExtraccion } = require('../../src/services/documentos/extraccionDocumento');
const borradores = require('../../src/services/documentos/borradoresDocumento');
const expeditionController = require('../../src/controllers/expeditionController');
const { DOCUMENT_TYPES } = require('../../src/middleware/validators');

usarBaseDeDatosEnMemoria();

const usuario = () => ({ _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId(), role: 'agent', name: 'Agente', email: 'a@b.es' });
const archivo = (nombre = 'factura.pdf') => ({ filename: `uuid-${nombre}`, originalname: nombre, path: `/uploads/documents/uuid-${nombre}`, size: 1234, mimetype: 'application/pdf' });
const lectura = (extra = {}) => ({
  ...normalizarExtraccion({ legible: true, tipoDetectado: 'commercial_invoice', confianza: 90, factura: { moneda: 'USD', importeTotal: 184800 }, ...extra }),
  leido: true,
  modelo: 'sonnet-5'
});
function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const cuerpoAlta = (extra = {}) => ({
  operationType: 'import', transportMode: 'maritime',
  client: { companyName: 'Importadora SL', nif: 'B12345678', email: 'c@d.es' },
  goods: [{ description: 'Portatiles', invoiceValue: 184800, packages: { quantity: 12, type: 'CT' } }],
  incoterm: 'CIF',
  ...extra
});

beforeEach(() => {
  jest.clearAllMocks();
  aiService.extractDocumentData.mockResolvedValue(lectura());
});

describe('crearBorrador', () => {
  test('lee el documento y lo guarda a nombre del usuario, sin exponer rutas del servidor', async () => {
    const user = usuario();

    const { draft, extraction } = await borradores.crearBorrador({ user, file: archivo(), tipo: 'commercial_invoice' });

    expect(extraction.factura.importeTotal).toBe(184800);
    expect(draft).toEqual({ id: expect.any(String), type: 'commercial_invoice', originalName: 'factura.pdf', fileSize: 1234 });
    const guardado = await DocumentDraft.findById(draft.id);
    expect(String(guardado.userId)).toBe(String(user._id));
    expect(String(guardado.tenantId)).toBe(String(user.tenantId));
    expect(guardado.extractedData.leido).toBe(true);
  });

  test('si el agente no indica el tipo, toma el que detecta el lector', async () => {
    aiService.extractDocumentData.mockResolvedValue(lectura({ tipoDetectado: 'bill_of_lading' }));

    const { draft } = await borradores.crearBorrador({ user: usuario(), file: archivo('bl.pdf'), tipo: 'other' });

    expect(draft.type).toBe('bill_of_lading');
  });

  test('respeta el tipo que indica el agente aunque el lector detecte otro', async () => {
    aiService.extractDocumentData.mockResolvedValue(lectura({ tipoDetectado: 'packing_list' }));

    const { draft } = await borradores.crearBorrador({ user: usuario(), file: archivo(), tipo: 'commercial_invoice' });

    expect(draft.type).toBe('commercial_invoice');
  });

  test('un documento ilegible se guarda con su tipo y la lectura lo dice', async () => {
    aiService.extractDocumentData.mockResolvedValue({ ...normalizarExtraccion({ legible: false, notas: ['En blanco'] }), leido: true });

    const { draft, extraction } = await borradores.crearBorrador({ user: usuario(), file: archivo(), tipo: 'other' });

    expect(draft.type).toBe('other');
    expect(extraction.legible).toBe(false);
  });

  test('si la lectura lanza un error, el archivo no queda huerfano', async () => {
    aiService.extractDocumentData.mockRejectedValue(new Error('fallo'));

    await expect(borradores.crearBorrador({ user: usuario(), file: archivo(), tipo: 'other' })).rejects.toThrow('fallo');

    expect(fileUtils.deleteFile).toHaveBeenCalledWith('uuid-factura.pdf');
    expect(await DocumentDraft.countDocuments()).toBe(0);
  });

  test('al subir uno nuevo se borran los borradores de mas de 24 horas y sus archivos', async () => {
    const user = usuario();
    const viejo = await DocumentDraft.create({ userId: user._id, type: 'other', fileName: 'viejo.pdf' });
    await DocumentDraft.collection.updateOne({ _id: viejo._id }, { $set: { createdAt: new Date(Date.now() - 25 * 3600 * 1000) } });
    const reciente = await DocumentDraft.create({ userId: user._id, type: 'other', fileName: 'reciente.pdf' });

    await borradores.crearBorrador({ user, file: archivo(), tipo: 'other' });

    expect(await DocumentDraft.findById(viejo._id)).toBeNull();
    expect(await DocumentDraft.findById(reciente._id)).not.toBeNull();
    expect(fileUtils.deleteFile).toHaveBeenCalledWith('viejo.pdf');
    expect(fileUtils.deleteFile).not.toHaveBeenCalledWith('reciente.pdf');
  });
});

describe('eliminarBorrador', () => {
  test('borra el borrador propio y su archivo', async () => {
    const user = usuario();
    const { draft } = await borradores.crearBorrador({ user, file: archivo(), tipo: 'other' });

    expect(await borradores.eliminarBorrador(draft.id, user)).toBe(true);

    expect(await DocumentDraft.countDocuments()).toBe(0);
    expect(fileUtils.deleteFile).toHaveBeenCalledWith('uuid-factura.pdf');
  });

  test('no borra el borrador de otro usuario', async () => {
    const { draft } = await borradores.crearBorrador({ user: usuario(), file: archivo(), tipo: 'other' });

    expect(await borradores.eliminarBorrador(draft.id, usuario())).toBe(false);

    expect(await DocumentDraft.countDocuments()).toBe(1);
    expect(fileUtils.deleteFile).not.toHaveBeenCalled();
  });

  test('un identificador que no es valido no lanza', async () => {
    expect(await borradores.eliminarBorrador({ $ne: null }, usuario())).toBe(false);
  });
});

describe('alta de expediente con documentos del alta', () => {
  test('adjunta los documentos ya leidos, marca el checklist y borra los borradores', async () => {
    const user = usuario();
    const { draft } = await borradores.crearBorrador({ user, file: archivo(), tipo: 'commercial_invoice' });
    const res = crearRes();

    await expeditionController.create({ user, body: cuerpoAlta({ draftDocuments: [{ id: draft.id, type: 'commercial_invoice' }] }) }, res);

    expect(res.statusCode).toBe(201);
    const exp = await Expedition.findById(res.body.data._id);
    expect(exp.documents).toHaveLength(1);
    expect(exp.documents[0].originalName).toBe('factura.pdf');
    expect(exp.documents[0].extractedData.factura.importeTotal).toBe(184800);
    expect(exp.documents[0].aiConfidence).toBe(90);
    const item = exp.documentChecklist.find(i => i.documentType === 'commercial_invoice');
    expect(item.received).toBe(true);
    expect(String(item.documentId)).toBe(String(exp.documents[0]._id));
    expect(exp.timeline.some(e => e.action === 'document_uploaded')).toBe(true);
    expect(await DocumentDraft.countDocuments()).toBe(0);
    expect(fileUtils.deleteFile).not.toHaveBeenCalled();
    expect(aiService.extractDocumentData).toHaveBeenCalledTimes(1);
  });

  test('el agente puede corregir el tipo del documento al crear el expediente', async () => {
    const user = usuario();
    const { draft } = await borradores.crearBorrador({ user, file: archivo(), tipo: 'other' });
    const res = crearRes();

    await expeditionController.create({ user, body: cuerpoAlta({ draftDocuments: [{ id: draft.id, type: 'packing_list' }] }) }, res);

    expect((await Expedition.findById(res.body.data._id)).documents[0].type).toBe('packing_list');
  });

  test('no adjunta el borrador de otro usuario y lo deja intacto', async () => {
    const { draft } = await borradores.crearBorrador({ user: usuario(), file: archivo(), tipo: 'commercial_invoice' });
    const res = crearRes();

    await expeditionController.create({ user: usuario(), body: cuerpoAlta({ draftDocuments: [{ id: draft.id }] }) }, res);

    expect(res.statusCode).toBe(201);
    expect((await Expedition.findById(res.body.data._id)).documents).toHaveLength(0);
    expect(await DocumentDraft.countDocuments()).toBe(1);
  });

  test('un mismo borrador repetido se adjunta una sola vez', async () => {
    const user = usuario();
    const { draft } = await borradores.crearBorrador({ user, file: archivo(), tipo: 'commercial_invoice' });
    const res = crearRes();

    await expeditionController.create({ user, body: cuerpoAlta({ draftDocuments: [{ id: draft.id }, { id: draft.id }] }) }, res);

    expect((await Expedition.findById(res.body.data._id)).documents).toHaveLength(1);
  });

  test('sin documentos del alta, o con una lista mal formada, el expediente se crea igual', async () => {
    const user = usuario();
    for (const draftDocuments of [undefined, 'x', [null, { id: 'no-es-id' }, { id: { $ne: null } }]]) {
      const res = crearRes();
      await expeditionController.create({ user, body: cuerpoAlta({ draftDocuments }) }, res);
      expect(res.statusCode).toBe(201);
    }
  });

  test('adjuntarBorradores no admite mas de 10 documentos por alta', async () => {
    const user = usuario();
    const ids = [];
    for (let i = 0; i < 12; i++) {
      const b = await DocumentDraft.create({ userId: user._id, type: 'other', fileName: `f${i}.pdf` });
      ids.push({ id: String(b._id) });
    }
    const exp = new Expedition({ tenantId: user.tenantId, operationType: 'import', transportMode: 'maritime', client: { companyName: 'X', nif: 'B12345678' } });

    const adjuntados = await borradores.adjuntarBorradores(exp, ids, user, DOCUMENT_TYPES);

    expect(adjuntados).toHaveLength(10);
    expect(exp.documents).toHaveLength(10);
  });
});
