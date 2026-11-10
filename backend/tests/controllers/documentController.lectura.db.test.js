/**
 * documentController — lectura de un documento con IA y aplicacion de los
 * datos leidos al expediente (extractDocument / applyExtraction).
 *
 * Mockeado solo lo externo: aiService.extractDocumentData (Bedrock). El modelo
 * Expedition es real (Mongo en memoria): `expedition.set('goods.0…')`, el hook
 * pre-save que recalcula `goodsSummary` y el guard de tenant se ejecutan de
 * verdad.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({ extractDocumentData: jest.fn(), validateDocument: jest.fn() }));
jest.mock('../../src/middleware/upload', () => ({ fileUtils: { fileExists: jest.fn(() => true), deleteFile: jest.fn() } }));

const ctrl = require('../../src/controllers/documentController');
const aiService = require('../../src/services/aiService');
const { Expedition } = require('../../src/models');
const { normalizarExtraccion } = require('../../src/services/documentos/extraccionDocumento');

usarBaseDeDatosEnMemoria();

const usuario = () => ({ _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId(), role: 'agent', name: 'Agente' });
function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const LECTURA_PACKING = () => ({
  ...normalizarExtraccion({
    legible: true, tipoDetectado: 'packing_list', confianza: 92, notas: ['La tabla detalla 1 bulto pero el total indica 12.'],
    transporte: { contenedores: ['MSCU1150584'], tipoCarga: 'LCL' },
    partidas: [{ bultos: 1, tipoBulto: 'CTN', pesoBrutoKg: 924.48, pesoNetoKg: 864 }],
    totales: { bultos: 12, pesoBrutoKg: 924.48, pesoNetoKg: 864 }
  }),
  leido: true,
  modelo: 'sonnet-5'
});

async function expedienteConDocumento(user, extra = {}) {
  const exp = await Expedition.create({
    tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
    operationType: 'import', transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'B12345678' },
    goods: [{ itemNumber: 1, description: 'Portatiles', quantity: 480, invoiceValue: 184800, taricCode: '8471300000', grossWeight: 1050, packages: { quantity: 90, type: 'CT' } }],
    documents: [{ type: 'packing_list', fileName: 'a.pdf', originalName: 'packing.pdf', filePath: '/tmp/a.pdf', mimeType: 'application/pdf', uploadedBy: user._id }],
    ...extra
  });
  return { exp, docId: exp.documents[0]._id };
}

beforeEach(() => {
  aiService.extractDocumentData.mockResolvedValue(LECTURA_PACKING());
});

describe('extractDocument', () => {
  test('guarda lo leido en el documento y devuelve la propuesta sin tocar el expediente', async () => {
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user);
    const res = crearRes();

    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.extraction).toMatchObject({ legible: true, leido: true, modelo: 'sonnet-5', confianza: 92 });
    expect(Object.fromEntries(res.body.data.proposal.map(c => [c.clave, [c.actual, c.nuevo]]))).toMatchObject({
      'goods.0.packages.quantity': [90, 12],
      'goods.0.grossWeight': [1050, 924.48],
      'goods.0.netWeight': [null, 864],
      'transport.loadType': [null, 'LCL'],
      'transport.containers': [null, 'MSCU1150584']
    });
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents[0].extractedData.totales.bultos).toBe(12);
    expect(guardado.documents[0].aiConfidence).toBe(92);
    // El expediente sigue como estaba: leer no aplica nada.
    expect(guardado.goods[0].packages.quantity).toBe(90);
    expect(guardado.goods[0].grossWeight).toBe(1050);
    expect(guardado.transport.loadType).toBeUndefined();
    expect(guardado.timeline.some(t => t.action === 'document_read')).toBe(true);
  });

  test('un documento que no se pudo leer se guarda como tal y no propone nada', async () => {
    aiService.extractDocumentData.mockResolvedValue({ ...normalizarExtraccion({ legible: false, notas: ['Formato no soportado'] }), leido: false });
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user);
    const res = crearRes();

    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.extraction).toMatchObject({ legible: false, leido: false, notas: ['Formato no soportado'] });
    expect(res.body.data.proposal).toEqual([]);
  });

  test('expediente de otro tenant o documento inexistente: 404 y la IA no se llama', async () => {
    const dueno = usuario();
    const { exp, docId } = await expedienteConDocumento(dueno);

    const ajeno = crearRes();
    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user: usuario() }, ajeno);
    const sinDoc = crearRes();
    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId: new mongoose.Types.ObjectId() }, user: dueno }, sinDoc);

    expect(ajeno.statusCode).toBe(404);
    expect(sinDoc.statusCode).toBe(404);
    expect(aiService.extractDocumentData).not.toHaveBeenCalled();
  });

  test('si la IA falla responde 500 y no deja el documento a medias', async () => {
    aiService.extractDocumentData.mockRejectedValue(new Error('Error en servicio de IA'));
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user);
    const res = crearRes();

    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, res);

    expect(res.statusCode).toBe(500);
    expect((await Expedition.findById(exp._id)).documents[0].extractedData).toBeUndefined();
  });
});

describe('getProposal', () => {
  test('devuelve la propuesta de un documento ya leido sin volver a llamar a la IA', async () => {
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user);
    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, crearRes());
    aiService.extractDocumentData.mockClear();
    const res = crearRes();

    await ctrl.getProposal({ params: { expeditionId: exp._id, docId }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.proposal.map(c => c.clave)).toContain('goods.0.packages.quantity');
    expect(aiService.extractDocumentData).not.toHaveBeenCalled();
  });

  test('un documento sin leer no tiene propuesta; de otro tenant, 404', async () => {
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user);

    const sinLeer = crearRes();
    await ctrl.getProposal({ params: { expeditionId: exp._id, docId }, user }, sinLeer);
    const ajeno = crearRes();
    await ctrl.getProposal({ params: { expeditionId: exp._id, docId }, user: usuario() }, ajeno);

    expect(sinLeer.body.data).toEqual({ extraction: null, proposal: [] });
    expect(ajeno.statusCode).toBe(404);
  });
});

describe('applyExtraction', () => {
  const leer = async (user, extra) => {
    const creado = await expedienteConDocumento(user, extra);
    await ctrl.extractDocument({ params: { expeditionId: creado.exp._id, docId: creado.docId }, user }, crearRes());
    return creado;
  };

  test('aplica solo lo marcado y los totales del expediente se recalculan', async () => {
    const user = usuario();
    const { exp, docId } = await leer(user);
    const res = crearRes();

    await ctrl.applyExtraction({
      params: { expeditionId: exp._id, docId }, user,
      body: { fields: ['goods.0.packages.quantity', 'goods.0.grossWeight', 'transport.containers'] }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.applied.map(c => c.clave)).toEqual(['goods.0.packages.quantity', 'goods.0.grossWeight', 'transport.containers']);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[0].packages.quantity).toBe(12);
    expect(guardado.goods[0].grossWeight).toBe(924.48);
    expect(guardado.goods[0].netWeight).toBeUndefined();
    expect(guardado.goods[0].taricCode).toBe('8471300000');
    expect(guardado.transport.containers.map(c => c.number)).toEqual(['MSCU1150584']);
    expect(guardado.transport.loadType).toBeUndefined();
    expect(guardado.goodsSummary).toMatchObject({ totalPackages: 12, totalGrossWeight: 924.48 });
    // Lo aplicado deja de proponerse; lo no marcado sigue disponible.
    expect(res.body.data.proposal.map(c => c.clave)).toEqual(expect.arrayContaining(['goods.0.netWeight', 'transport.loadType']));
    expect(res.body.data.proposal.map(c => c.clave)).not.toContain('goods.0.packages.quantity');
    expect(guardado.timeline.some(t => t.action === 'document_data_applied')).toBe(true);
  });

  test('una clave ajena a la propuesta no modifica el expediente', async () => {
    const user = usuario();
    const { exp, docId } = await leer(user);
    const res = crearRes();

    await ctrl.applyExtraction({ params: { expeditionId: exp._id, docId }, user, body: { fields: ['status', 'tenantId', 'client.nif', 'goods.0.invoiceValue'] } }, res);

    expect(res.statusCode).toBe(400);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('draft');
    expect(guardado.client.nif).toBe('B12345678');
    expect(guardado.goods[0].invoiceValue).toBe(184800);
  });

  test('sin campos, sin lectura previa o de otro tenant no aplica nada', async () => {
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user);

    const sinCampos = crearRes();
    await ctrl.applyExtraction({ params: { expeditionId: exp._id, docId }, user, body: { fields: [] } }, sinCampos);
    const sinLectura = crearRes();
    await ctrl.applyExtraction({ params: { expeditionId: exp._id, docId }, user, body: { fields: ['goods.0.grossWeight'] } }, sinLectura);
    const ajeno = crearRes();
    await ctrl.applyExtraction({ params: { expeditionId: exp._id, docId }, user: usuario(), body: { fields: ['goods.0.grossWeight'] } }, ajeno);

    expect(sinCampos.statusCode).toBe(400);
    expect(sinLectura.statusCode).toBe(400);
    expect(ajeno.statusCode).toBe(404);
    expect((await Expedition.findById(exp._id)).goods[0].grossWeight).toBe(1050);
  });

  test('con la declaracion presentada responde 409 y no cambia nada', async () => {
    const user = usuario();
    const { exp, docId } = await leer(user);
    await Expedition.updateOne({ _id: exp._id }, { $set: { status: 'declaration_submitted' } });
    const res = crearRes();

    await ctrl.applyExtraction({ params: { expeditionId: exp._id, docId }, user, body: { fields: ['goods.0.grossWeight'] } }, res);

    expect(res.statusCode).toBe(409);
    expect((await Expedition.findById(exp._id)).goods[0].grossWeight).toBe(1050);
  });
});
