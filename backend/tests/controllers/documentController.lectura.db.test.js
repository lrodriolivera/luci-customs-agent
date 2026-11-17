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

// UAT 16/Nov/2026, EXP-2026-74AEEBBC: el expediente se creo sin documentos y
// despues se subieron factura, packing list y BL en el detalle. Las lecturas
// salieron bien pero «Datos para presentar el H1» quedo vacio.
describe('extractDocument rellena los huecos del H1', () => {
  const LECTURA_FACTURA = () => ({
    ...normalizarExtraccion({
      legible: true, tipoDetectado: 'commercial_invoice', confianza: 90,
      exportador: { nombre: 'Shanghai Hongtai Ltd', direccion: 'No. 88 Pudong Road', ciudad: 'Shanghai', codigoPostal: '200120', pais: 'CN' },
      factura: { numero: 'INV-H1-01-2026-8198800', moneda: 'USD', importeTotal: 184800, incoterm: 'FOB' }
    }),
    leido: true
  });
  const LECTURA_BL = () => ({
    ...normalizarExtraccion({
      legible: true, tipoDetectado: 'bill_of_lading', confianza: 85,
      transporte: { numeroDocumento: 'MEDU8198800', contenedores: [], precintos: ['MSCU1150584400', 'SL264686400'], indicacionesCarga: ['40HC'] }
    }),
    leido: true
  });
  const conTipo = (user, type) => ({
    documents: [{ type, fileName: 'a.pdf', originalName: `${type}.pdf`, filePath: '/tmp/a.pdf', mimeType: 'application/pdf', uploadedBy: user._id }]
  });

  test('la factura rellena el numero de factura y el CP, direccion y pais del exportador vacios, sin pisar lo escrito', async () => {
    aiService.extractDocumentData.mockResolvedValue(LECTURA_FACTURA());
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user, {
      ...conTipo(user, 'commercial_invoice'),
      exporter: { companyName: 'Nombre escrito por la agente', city: 'Ciudad escrita por la agente' }
    });
    const res = crearRes();

    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.autoApplied.map(c => c.clave).sort()).toEqual(
      ['exporter.address', 'exporter.country', 'exporter.postalCode', 'invoiceNumber']
    );
    expect(res.body.data.expedition).toBeDefined();
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.invoiceNumber).toBe('INV-H1-01-2026-8198800');
    expect(guardado.exporter).toMatchObject({
      postalCode: '200120', address: 'No. 88 Pudong Road', country: 'CN',
      // Lo que la agente ya escribio no se toca: queda como propuesta.
      companyName: 'Nombre escrito por la agente', city: 'Ciudad escrita por la agente'
    });
    expect(res.body.data.proposal.map(c => c.clave)).toEqual(expect.arrayContaining(['exporter.companyName', 'exporter.city']));
    expect(res.body.data.proposal.map(c => c.clave)).not.toContain('invoiceNumber');
    // Las partidas no se tocan solas.
    expect(guardado.goods[0].invoiceValue).toBe(184800);
    const evento = guardado.timeline.find(t => t.action === 'document_data_applied');
    expect(evento.description).toContain('commercial_invoice.pdf');
    expect(evento.metadata).toMatchObject({ automatic: true });
  });

  test('un numero de factura ya escrito por la agente no se cambia', async () => {
    aiService.extractDocumentData.mockResolvedValue(LECTURA_FACTURA());
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user, { ...conTipo(user, 'commercial_invoice'), invoiceNumber: 'F-AGENTE-1' });
    const res = crearRes();

    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, res);

    expect((await Expedition.findById(exp._id)).invoiceNumber).toBe('F-AGENTE-1');
    expect(res.body.data.autoApplied.map(c => c.clave)).not.toContain('invoiceNumber');
    expect(res.body.data.proposal.find(c => c.clave === 'invoiceNumber')).toMatchObject({ actual: 'F-AGENTE-1', nuevo: 'INV-H1-01-2026-8198800' });
  });

  // El BL de esta lectura no dice FCL ni LCL: el tipo de carga no se rellena
  // (lo confirma la agente con operaciones; Patricia, 17/11/2026).
  test('el BL rellena el contenedor vacío; sin FCL/LCL escrito no rellena el tipo de carga', async () => {
    aiService.extractDocumentData.mockResolvedValue(LECTURA_BL());
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user, conTipo(user, 'bill_of_lading'));
    const res = crearRes();

    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, res);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.transport.loadType).toBeUndefined();
    expect(guardado.transport.containers.map(c => c.number)).toEqual(['MSCU1150584']);
    // El numero del BL no es un dato del H1: sigue como propuesta.
    expect(guardado.transport.documentNumber).toBeUndefined();
    expect(res.body.data.proposal.map(c => c.clave)).toContain('transport.documentNumber');
  });

  test('un BL que dice CY/CY rellena el tipo de carga FCL', async () => {
    aiService.extractDocumentData.mockResolvedValue({
      ...normalizarExtraccion({ legible: true, tipoDetectado: 'bill_of_lading', confianza: 85, transporte: { contenedores: ['MSCU1150584'], indicacionesCarga: ['CY/CY'] } }),
      leido: true
    });
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user, conTipo(user, 'bill_of_lading'));
    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, crearRes());
    expect((await Expedition.findById(exp._id)).transport.loadType).toBe('FCL');
  });

  test('con la declaracion presentada no se rellena nada', async () => {
    aiService.extractDocumentData.mockResolvedValue(LECTURA_FACTURA());
    const user = usuario();
    const { exp, docId } = await expedienteConDocumento(user, { ...conTipo(user, 'commercial_invoice'), status: 'declaration_submitted' });
    const res = crearRes();

    await ctrl.extractDocument({ params: { expeditionId: exp._id, docId }, user }, res);

    expect(res.body.data.autoApplied).toEqual([]);
    expect(res.body.data.expedition).toBeUndefined();
    expect((await Expedition.findById(exp._id)).invoiceNumber).toBeUndefined();
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
  // La lectura se guarda sin pasar por extractDocument: aqui se prueba solo
  // el aplicar (extractDocument ya rellena solo los huecos del H1).
  const leer = async (user, extra) => {
    const creado = await expedienteConDocumento(user, extra);
    const { leido, modelo, ...datos } = await aiService.extractDocumentData();
    await Expedition.updateOne(
      { _id: creado.exp._id, 'documents._id': creado.docId },
      { $set: { 'documents.$.extractedData': { ...datos, leido, modelo: modelo || null, leidoEn: new Date() } } }
    );
    aiService.extractDocumentData.mockClear();
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

  test('los datos del exportador se guardan en los campos reales del expediente', async () => {
    // Fallo visto en produccion el 10/Nov/2026: la ciudad se escribia en
    // `exporter.address.city`, que no existe (la direccion del exportador es
    // un texto). Mongoose lo descartaba y aun asi se anunciaba como aplicada.
    aiService.extractDocumentData.mockResolvedValue({
      ...normalizarExtraccion({ legible: true, confianza: 90, exportador: { nombre: 'Shanghai Hongtai Ltd', ciudad: 'Shanghai', pais: 'CN' } }),
      leido: true
    });
    const user = usuario();
    const { exp, docId } = await leer(user, { exporter: { companyName: 'Otro nombre', country: 'CN' } });
    const res = crearRes();

    await ctrl.applyExtraction({ params: { expeditionId: exp._id, docId }, user, body: { fields: ['exporter.city', 'exporter.companyName'] } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.applied.map(c => c.clave)).toEqual(['exporter.companyName', 'exporter.city']);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.exporter.city).toBe('Shanghai');
    expect(guardado.exporter.companyName).toBe('Shanghai Hongtai Ltd');
    // Una vez aplicada deja de proponerse.
    expect(res.body.data.proposal.map(c => c.clave)).not.toContain('exporter.city');
  });

  test('todas las claves que puede proponer existen en el esquema del expediente', async () => {
    // Guardia: un campo mal mapeado se descartaria en silencio al guardar.
    const lecturaCompleta = normalizarExtraccion({
      legible: true, confianza: 90,
      exportador: { nombre: 'X Ltd', ciudad: 'Shanghai', pais: 'CN' },
      factura: { moneda: 'USD', incoterm: 'FOB', lugarIncoterm: 'Shanghai' },
      transporte: { numeroDocumento: 'BL-1', medio: 'MSC OSCAR', puertoCarga: 'Shanghai', puertoDescarga: 'Valencia', contenedores: ['MSCU1150584'], tipoCarga: 'LCL' },
      partidas: [{ codigoMercancia: '8471300000', paisOrigen: 'VN', bultos: 7, tipoBulto: 'PLT', pesoBrutoKg: 70, pesoNetoKg: 60, importe: 999 }],
      totales: { bultos: 7, pesoBrutoKg: 70, pesoNetoKg: 60 }
    });
    aiService.extractDocumentData.mockResolvedValue({ ...lecturaCompleta, leido: true });
    const user = usuario();
    const { exp, docId } = await leer(user, {
      goods: [{ itemNumber: 1, description: 'Portatiles', quantity: 1, invoiceValue: 1 }],
      documents: [{ type: 'bill_of_lading', fileName: 'a.pdf', originalName: 'bl.pdf', filePath: '/tmp/a.pdf', mimeType: 'application/pdf', uploadedBy: user._id }]
    });
    const propuesta = (await (async () => { const r = crearRes(); await ctrl.getProposal({ params: { expeditionId: exp._id, docId }, user }, r); return r.body.data.proposal; })());
    const res = crearRes();

    await ctrl.applyExtraction({ params: { expeditionId: exp._id, docId }, user, body: { fields: propuesta.map(c => c.clave) } }, res);

    expect(propuesta.length).toBeGreaterThanOrEqual(18);
    expect(res.body.data.applied.map(c => c.clave).sort()).toEqual(propuesta.map(c => c.clave).sort());
    // Todo quedo escrito: no queda nada por proponer.
    expect(res.body.data.proposal).toEqual([]);
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
