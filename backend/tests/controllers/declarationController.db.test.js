/**
 * declarationController: generacion de declaraciones aduaneras contra Mongo real.
 *
 * Es el corazon regulatorio de LUCI: lo que se envia a la AEAT. Lo que se
 * prueba de verdad es la logica del controller, NO los generadores (h1/h7/aes)
 * ni la IA, que salen a Bedrock y estan cubiertos aparte:
 *   1. generateH1: sus cuatro puertas de validacion (solo import, documentos
 *      obligatorios validados, todos los items clasificados) antes de generar,
 *      y que al generar persista la declaracion en estado draft.
 *   2. getXML: descarga el XML; 404 si no hay declaracion.
 *   3. updateDeclaration: solo campos permitidos, regenera XML segun el tipo.
 *   4. getDeclarationSummary: los totales de derechos/IVA se suman de los goods.
 *   5. checkH7Eligibility y generateH7: la puerta de bajo valor (150 EUR).
 *   6. El guard de tenant en todas: expediente de otro tenant => 404.
 *
 * Los generadores se mockean porque son dependencias externas al controller;
 * el modelo Expedition NO, ahi viven las reglas que dan valor al test.
 * BD en memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// Generadores AEAT e IA: dependencias externas. Se mockean como funciones vacias
// y se les da implementacion en beforeEach porque jest.config tiene
// resetMocks:true, que borra la implementacion de fabrica antes de cada test.
jest.mock('../../src/services/aiService', () => ({
  generateH1Declaration: jest.fn(), generateAESDeclaration: jest.fn()
}));
jest.mock('../../src/services/forms/h1Generator', () => ({ generate: jest.fn() }));
jest.mock('../../src/services/forms/aesGenerator', () => ({ generate: jest.fn() }));
jest.mock('../../src/services/forms/h7Generator', () => ({ isEligibleForH7: jest.fn(), generate: jest.fn() }));
jest.mock('../../src/services/aeatService', () => ({}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({}));
jest.mock('../../src/services/channelService', () => ({}));

const { Expedition } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const h1Generator = require('../../src/services/forms/h1Generator');
const h7Generator = require('../../src/services/forms/h7Generator');
const ctrl = require('../../src/controllers/declarationController');

usarBaseDeDatosEnMemoria();

function usuario() {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(),
    role: 'operator', name: 'Operario', email: 'op@ejemplo.es'
  };
}

function crearRes() {
  const res = { statusCode: 200, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

/** Documento validado del tipo dado (subdocumento embebido en el expediente). */
function doc(type, status = 'validated') {
  return { type, status, fileName: `${type}.pdf`, uploadedBy: new mongoose.Types.ObjectId() };
}

/** Expediente de importacion completo, listo para generar H1. */
async function expedienteImportacion(user, extra = {}) {
  return Expedition.create({
    tenantId: user.tenantId,
    createdBy: user._id,
    assignedTo: user._id,
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'B12345678' },
    goods: [{ itemNumber: 1, description: 'Cafe', quantity: 10, invoiceValue: 1000, taricCode: '0901210000', dutyAmount: 75, vatAmount: 220 }],
    goodsSummary: { totalValue: 1000 },
    documents: [doc('commercial_invoice'), doc('packing_list'), doc('bill_of_lading')],
    ...extra
  });
}

// resetMocks:true borra las implementaciones antes de cada test; se restauran aqui.
beforeEach(() => {
  aiService.generateH1Declaration.mockResolvedValue({ declarationType: 'A', customsOffice: 'ES002801', warnings: [] });
  aiService.generateAESDeclaration.mockResolvedValue({ declarationType: 'EX', customsOffice: 'ES002801', warnings: [] });
  h1Generator.generate.mockReturnValue({ lrn: 'LRN-H1-1', xml: '<H1>ok</H1>', data: { items: 1 }, summary: { total: 1 } });
  h7Generator.generate.mockReturnValue({
    lrn: 'LRN-H7-1', xml: '<H7>ok</H7>', summary: {}, eligibility: { eligible: true },
    data: {
      declarationType: 'H7', h7Type: 'IOSS',
      declarationHeader: { customsOffice: 'ES002801' },
      shipment: { intrinsicValue: 100 }, iossData: null, vatCalculation: { vat: 21 }
    }
  });
});

describe('generateH1: validaciones antes de generar', () => {
  test('genera el H1 y lo deja en borrador cuando todo esta en regla', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.declaration.type).toBe('H1');
    expect(res.body.data.declaration.status).toBe('draft');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('declaration_draft');
    expect(guardado.declaration.xmlContent).toBe('<H1>ok</H1>');
  });

  test('rechaza el H1 sobre una exportacion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { operationType: 'export' });
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/importaciones/i);
    expect(h1Generator.generate).not.toHaveBeenCalled();
  });

  test('rechaza si faltan documentos obligatorios validados', async () => {
    const user = usuario();
    // Sin packing_list validado: la factura sola no basta.
    const exp = await expedienteImportacion(user, {
      documents: [doc('commercial_invoice'), doc('bill_of_lading')]
    });
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/documentos obligatorios/i);
  });

  test('rechaza si algun item no tiene codigo TARIC', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goods: [{ itemNumber: 1, description: 'Cafe', quantity: 10, invoiceValue: 1000 }] // sin taricCode
    });
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/TARIC/i);
  });

  test('un expediente de otro tenant da 404', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno);
    const intruso = usuario();
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user: intruso }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('getXML', () => {
  test('descarga el XML de la declaracion como attachment', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', xmlContent: '<H1>guardado</H1>' }
    });
    const res = crearRes();

    await ctrl.getXML({ params: { expeditionId: exp._id }, user }, res);

    expect(res.headers['Content-Type']).toBe('application/xml');
    expect(res.headers['Content-Disposition']).toMatch(/attachment/);
    expect(res.body).toBe('<H1>guardado</H1>');
  });

  test('404 si no hay declaracion generada', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.getXML({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('updateDeclaration', () => {
  test('actualiza campos permitidos y regenera el XML del H1', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', regime: '40', xmlContent: '<viejo/>' }
    });
    const res = crearRes();

    await ctrl.updateDeclaration({
      params: { expeditionId: exp._id }, body: { regime: '42' }, user
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.regime).toBe('42');
    expect(h1Generator.generate).toHaveBeenCalled();
    expect(res.body.data.xmlContent).toBe('<H1>ok</H1>'); // XML regenerado
  });

  test('404 si el expediente no tiene declaracion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.updateDeclaration({ params: { expeditionId: exp._id }, body: { regime: '42' }, user }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('getDeclarationSummary', () => {
  test('suma derechos e IVA de los goods', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', regime: '40' },
      goods: [
        { itemNumber: 1, description: 'A', quantity: 1, invoiceValue: 500, taricCode: 'x', dutyAmount: 50, vatAmount: 100 },
        { itemNumber: 2, description: 'B', quantity: 1, invoiceValue: 500, taricCode: 'y', dutyAmount: 25, vatAmount: 120 }
      ],
      goodsSummary: { totalValue: 1000 }
    });
    const res = crearRes();

    await ctrl.getDeclarationSummary({ params: { expeditionId: exp._id }, user }, res);

    expect(res.body.data.totals.totalDuties).toBe(75);
    expect(res.body.data.totals.totalVat).toBe(220);
    expect(res.body.data.totals.totalTaxes).toBe(295);
    expect(res.body.data.totals.items).toBe(2);
  });

  test('404 si no hay declaracion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.getDeclarationSummary({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('H7 (bajo valor)', () => {
  test('checkH7Eligibility devuelve el veredicto del generador y el limite de 150', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true, reason: null });
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.checkH7Eligibility({ params: { expeditionId: exp._id }, user }, res);

    expect(res.body.data.eligible).toBe(true);
    expect(res.body.data.valueLimit).toBe(150);
  });

  test('generateH7 rechaza un envio no elegible sin forceGenerate', async () => {
    // Sobre el limite de 150 EUR: sin forzar, no se genera.
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: false, reason: 'Valor supera 150 EUR' });
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/150/);
    expect(h7Generator.generate).not.toHaveBeenCalled();
  });

  test('generateH7 elegible persiste la declaracion en ready_for_declaration', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true, reason: null });
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.declaration.type).toBe('H7');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('ready_for_declaration');
  });

  test('generateH7 rechaza una exportacion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { operationType: 'export' });
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/importaciones/i);
  });
});
