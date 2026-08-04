/**
 * declarationController (complemento): handlers no cubiertos por
 * declarationController.db.test.js, contra Mongo real.
 *
 * El primer fichero cubre generateH1, getXML, updateDeclaration,
 * getDeclarationSummary y la puerta H7. Aqui se cubre el resto de la logica del
 * controller (la mayor carencia de ramas del backend):
 *   1. generateAES: solo exportaciones, persiste la declaracion AES en borrador.
 *   2. generateH1Direct: modo clasico (id de expediente existente + guard de
 *      tenant) y modo formulario (crea el expediente desde el body y mapea items
 *      -> goods, tributos A00/B00, modo de transporte).
 *   3. submitDeclaration (path ES): guardas (sin XML, ya enviada), envio H1
 *      aceptado -> submitted + canal, y rechazo AEAT -> 400 sin marcar submitted.
 *   4. submitH7: guardas (sin H7, ya enviado) y envio simulado con/sin IOSS
 *      (canal verde con levante / canal amarillo).
 *   5. getH7Stats: agrega SOLO las H7 del propio tenant (aislamiento).
 *   6. Endpoints IA (validate/detect/suggest/predict/full/get/apply-regime):
 *      guard de tenant, delegacion al aiService mockeado y persistencia de la
 *      prediccion/analisis/regimen en el expediente.
 *   7. cancelDeclaration: guard de tenant, exige MRN, envia anulacion a AEAT.
 *
 * Que se mockea y por que: los generadores AEAT (h1/aes/h7), el aiService
 * (Bedrock), aeatSubmitService (AEAT), channelService y emailService son
 * dependencias EXTERNAS al controller. El modelo Expedition NO se mockea: ahi
 * viven el guard de tenant y las validaciones que dan valor al test. BD en
 * memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// resetMocks:true borra las implementaciones de fabrica antes de cada test; los
// mocks se declaran vacios y se les da implementacion en beforeEach.
jest.mock('../../src/services/aiService', () => ({
  generateH1Declaration: jest.fn(),
  generateAESDeclaration: jest.fn(),
  validateDeclarationBeforeSubmit: jest.fn(),
  detectDeclarationErrors: jest.fn(),
  suggestRegimeAndPreference: jest.fn(),
  predictDeclarationChannel: jest.fn(),
  fullDeclarationAnalysis: jest.fn()
}));
jest.mock('../../src/services/forms/h1Generator', () => ({ generate: jest.fn() }));
jest.mock('../../src/services/forms/aesGenerator', () => ({ generate: jest.fn() }));
jest.mock('../../src/services/forms/h7Generator', () => ({ isEligibleForH7: jest.fn(), generate: jest.fn() }));
jest.mock('../../src/services/aeatService', () => ({}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitH1: jest.fn(), submitAES: jest.fn(), cancelH1: jest.fn()
}));
jest.mock('../../src/services/channelService', () => ({ processChannelAssignment: jest.fn() }));
jest.mock('../../src/services/emailService', () => ({
  sendDeclarationAccepted: jest.fn(), sendDeclarationRejected: jest.fn(), sendChannelAssigned: jest.fn()
}));

const { Expedition } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const aesGenerator = require('../../src/services/forms/aesGenerator');
const h1Generator = require('../../src/services/forms/h1Generator');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const channelService = require('../../src/services/channelService');
const emailService = require('../../src/services/emailService');
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

async function expedienteImportacion(user, extra = {}) {
  return Expedition.create({
    tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
    operationType: 'import', transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'B12345678' },
    goods: [{ itemNumber: 1, description: 'Cafe', quantity: 10, invoiceValue: 1000, taricCode: '0901210000' }],
    ...extra
  });
}

async function expedienteExportacion(user, extra = {}) {
  return Expedition.create({
    tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
    operationType: 'export', transportMode: 'air',
    client: { companyName: 'Exportadora SL', nif: 'B87654321' },
    goods: [{ itemNumber: 1, description: 'Aceite', quantity: 5, invoiceValue: 500, taricCode: '1509100000' }],
    ...extra
  });
}

beforeEach(() => {
  aiService.generateAESDeclaration.mockResolvedValue({ declarationType: 'EX', customsOffice: 'ES002801', warnings: [] });
  aesGenerator.generate.mockReturnValue({ lrn: 'LRN-AES-1', xml: '<AES>ok</AES>', data: { items: 1 } });
  h1Generator.generate.mockReturnValue({
    lrn: 'LRN-H1-1', xml: '<H1>ok</H1>',
    data: { declarationHeader: { customsOfficePresentation: 'ES002801' } }, summary: { total: 1 }
  });
  aeatSubmitService.submitH1.mockResolvedValue({ success: true, mrn: '26ES00028012345678H1', channel: 'green', code: '00', estado: 'Aceptada', csv: 'CSV1' });
  aeatSubmitService.submitAES.mockResolvedValue({ success: true, mrn: '26ES00028012345678AE', channel: 'green', code: '00' });
  aeatSubmitService.cancelH1.mockResolvedValue({ success: true });
  channelService.processChannelAssignment.mockResolvedValue({ actions: [], requirementId: null });
  emailService.sendDeclarationAccepted.mockResolvedValue();
  emailService.sendDeclarationRejected.mockResolvedValue();
  emailService.sendChannelAssigned.mockResolvedValue();
  aiService.validateDeclarationBeforeSubmit.mockResolvedValue({ valid: true, issues: [] });
  aiService.detectDeclarationErrors.mockResolvedValue({ errors: [] });
  aiService.suggestRegimeAndPreference.mockResolvedValue({ regime: '40', preference: '100' });
  aiService.predictDeclarationChannel.mockResolvedValue({ channel: 'green', probability: 0.9 });
  aiService.fullDeclarationAnalysis.mockResolvedValue({ overallReadiness: { score: 88, estimatedChannel: 'green' }, errors: { blockingErrors: 0 } });
});

describe('generateAES', () => {
  test('genera el AES y lo deja en borrador sobre una exportacion', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const res = crearRes();

    await ctrl.generateAES({ body: { expeditionId: exp._id, exportType: '10' }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.declaration.type).toBe('AES');
    expect(res.body.data.declaration.status).toBe('draft');
    expect(res.body.data.declaration.xmlContent).toBe('<AES>ok</AES>');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('declaration_draft');
    expect(guardado.declaration.lrn).toBe('LRN-AES-1');
  });

  test('rechaza el AES sobre una importacion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.generateAES({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/exportaciones/i);
    expect(aesGenerator.generate).not.toHaveBeenCalled();
  });

  test('un expediente de otro tenant da 404', async () => {
    const dueno = usuario();
    const exp = await expedienteExportacion(dueno);
    const res = crearRes();

    await ctrl.generateAES({ body: { expeditionId: exp._id }, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('generateH1Direct', () => {
  test('modo clasico: genera el H1 sobre un expediente existente', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.generateH1Direct({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.declaration.type).toBe('H1');
    expect(res.body.data.declaration.lrn).toBe('LRN-H1-1');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('ready_for_declaration');
    expect(guardado.declaration.xmlContent).toBe('<H1>ok</H1>');
  });

  test('modo clasico: expediente de otro tenant da 404', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno);
    const res = crearRes();

    await ctrl.generateH1Direct({ body: { expeditionId: exp._id }, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
  });

  test('modo clasico: rechaza si el expediente es una exportacion', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const res = crearRes();

    await ctrl.generateH1Direct({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/importaciones/i);
  });

  test('modo formulario: crea el expediente desde el body y mapea items/tributos', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.generateH1Direct({
      user,
      body: {
        borderTransportMode: '1', // maritime
        currency: 'EUR',
        customsOffice: 'ES002801',
        recipient: { name: 'Cliente SL', eori: 'ESB12345678', country: 'ES' },
        sender: { name: 'Proveedor Inc', country: 'CN' },
        items: [{ description: 'Widget', taricCode: '8471300000', itemPrice: '1000', grossWeight: '10', packageCount: '2', procedure: '4000', preference: '100' }],
        taxes: [{ classCode: 'A00', amount: '75' }, { classCode: 'B00', amount: '220' }],
        totalInvoiceAmount: '1000'
      }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditionId).toMatch(/^EXP-/);
    const guardado = await Expedition.findById(res.body.data._id);
    expect(guardado.transportMode).toBe('maritime');
    expect(guardado.goods).toHaveLength(1);
    expect(guardado.goods[0].taricCode).toBe('8471300000');
    expect(guardado.calculations.totalDuties).toBe(75);  // A00
    expect(guardado.calculations.totalVat).toBe(220);     // B00
    expect(guardado.declaration.type).toBe('H1');
    expect(guardado.tenantId.toString()).toBe(user.tenantId.toString());
  });
});

describe('submitDeclaration (path ES)', () => {
  test('envia el H1, lo marca submitted y asigna canal', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.mrn).toBe('26ES00028012345678H1');
    expect(res.body.data.channel).toBe('green');
    expect(aeatSubmitService.submitH1).toHaveBeenCalled();
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.status).toBe('submitted');
    expect(guardado.status).toBe('green_channel');
    expect(channelService.processChannelAssignment).toHaveBeenCalled();
  });

  test('sin XML generado devuelve 400 y no llama a AEAT', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { declaration: { type: 'H1', status: 'draft' } });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/genere el H1/i);
    expect(aeatSubmitService.submitH1).not.toHaveBeenCalled();
  });

  test('una declaracion ya enviada no se reenvia', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'submitted', xmlContent: '<H1/>', mrn: 'MRN-YA' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/ya enviada/i);
    expect(aeatSubmitService.submitH1).not.toHaveBeenCalled();
  });

  test('rechazo de AEAT devuelve 400 y no marca submitted', async () => {
    aeatSubmitService.submitH1.mockResolvedValue({ success: false, error: 'Error 4404', code: '4404' });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/4404/);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.status).toBe('draft'); // sin cambios
  });

  test('un expediente de otro tenant da 404', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(aeatSubmitService.submitH1).not.toHaveBeenCalled();
  });
});

describe('submitH7', () => {
  test('envia el H7 con IOSS: canal verde y levante automatico', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H7', status: 'draft', lrn: 'LRN-H7-1',
        h7Data: { iossData: { number: 'IM123' }, shipment: { intrinsicValue: 100 } }
      }
    });
    const res = crearRes();

    await ctrl.submitH7({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.channel).toBe('green');
    expect(res.body.data.levanteNumber).toMatch(/^LEV/);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.status).toBe('submitted');
    expect(guardado.status).toBe('green_channel');
  });

  test('envia el H7 sin IOSS con IVA a pagar: canal amarillo', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H7', status: 'draft', lrn: 'LRN-H7-2',
        h7Data: { shipment: { intrinsicValue: 100 } },
        vatCalculation: { totalToPay: 21 }
      }
    });
    const res = crearRes();

    await ctrl.submitH7({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.channel).toBe('yellow');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('yellow_channel');
  });

  test('sin declaracion H7 devuelve 400', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { declaration: { type: 'H1', status: 'draft' } });
    const res = crearRes();

    await ctrl.submitH7({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/H7/);
  });

  test('un H7 ya enviado no se reenvia', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', mrn: 'MRN-H7-YA' }
    });
    const res = crearRes();

    await ctrl.submitH7({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/ya enviado/i);
  });
});

describe('getH7Stats: aislamiento por tenant', () => {
  test('agrega solo las H7 del propio tenant', async () => {
    const user = usuario();
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', channel: 'green', h7Data: { iossData: { number: 'IM1' }, shipment: { intrinsicValue: 100 } } }
    });
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'draft', h7Data: { shipment: { intrinsicValue: 50 } } }
    });
    // H7 de OTRO tenant: no debe contar.
    await expedienteImportacion(usuario(), {
      declaration: { type: 'H7', status: 'submitted', channel: 'green', h7Data: { shipment: { intrinsicValue: 999 } } }
    });

    const res = crearRes();
    await ctrl.getH7Stats({ query: {}, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(2);           // solo las del tenant
    expect(res.body.data.withIOSS).toBe(1);
    expect(res.body.data.withoutIOSS).toBe(1);
    expect(res.body.data.byStatus.submitted).toBe(1);
    expect(res.body.data.byStatus.draft).toBe(1);
    expect(res.body.data.totalValue).toBe(150);    // 100 + 50, no 999
  });
});

describe('endpoints IA', () => {
  test('aiValidateDeclaration delega en aiService y responde su resultado', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiValidateDeclaration({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({ valid: true, issues: [] });
    expect(aiService.validateDeclarationBeforeSubmit).toHaveBeenCalled();
  });

  test('aiDetectErrors delega en aiService', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiDetectErrors({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200);
    expect(aiService.detectDeclarationErrors).toHaveBeenCalled();
  });

  test('aiSuggestRegime rechaza operaciones que no son importacion', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const res = crearRes();

    await ctrl.aiSuggestRegime({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/importaciones/i);
    expect(aiService.suggestRegimeAndPreference).not.toHaveBeenCalled();
  });

  test('aiSuggestRegime delega en aiService en una importacion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiSuggestRegime({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.regime).toBe('40');
  });

  test('aiPredictChannel guarda la prediccion en el expediente', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiPredictChannel({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.channelPrediction.channel).toBe('green');
    expect(guardado.aiAnalysis.channelPrediction.predictedAt).toBeInstanceOf(Date);
  });

  test('aiFullDeclarationAnalysis guarda analisis y anota el timeline', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.declarationAnalysis.overallReadiness.score).toBe(88);
    expect(guardado.timeline.some(t => t.action === 'ai_declaration_analysis')).toBe(true);
  });

  test('getAiDeclarationAnalysis devuelve el analisis persistido', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      aiAnalysis: { declarationAnalysis: { overallReadiness: { score: 70 } }, channelPrediction: { channel: 'orange' } }
    });
    const res = crearRes();

    await ctrl.getAiDeclarationAnalysis({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.hasAnalysis).toBe(true);
    expect(res.body.data.channelPrediction.channel).toBe('orange');
  });

  test('applyRegimeSuggestion actualiza regimen/preferencia y anota el timeline', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.applyRegimeSuggestion({
      params: { expeditionId: exp._id }, body: { regime: '42', preference: '300' }, user
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.regime).toBe('42');
    expect(res.body.data.preference).toBe('300');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.regime).toBe('42');
    expect(guardado.timeline.some(t => t.action === 'regime_updated')).toBe(true);
  });

  test('los endpoints IA rechazan un expediente de otro tenant con 404', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno);
    const res = crearRes();

    await ctrl.aiValidateDeclaration({ params: { expeditionId: exp._id }, body: {}, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(aiService.validateDeclarationBeforeSubmit).not.toHaveBeenCalled();
  });
});

describe('cancelDeclaration', () => {
  test('envia la anulacion a AEAT y marca el expediente cancelado', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      representative: { nif: 'B12345678' },
      declaration: { type: 'H1', status: 'submitted', mrn: '26ES0002801234H1', customsOffice: 'ES002801' }
    });
    const res = crearRes();

    await ctrl.cancelDeclaration({ params: { expeditionId: exp._id }, body: { reason: '1' }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(aeatSubmitService.cancelH1).toHaveBeenCalled();
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('cancelled');
    expect(guardado.timeline.some(t => t.action === 'declaration_cancelled')).toBe(true);
  });

  test('sin MRN devuelve 400 y no llama a AEAT', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { declaration: { type: 'H1', status: 'draft' } });
    const res = crearRes();

    await ctrl.cancelDeclaration({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/MRN/);
    expect(aeatSubmitService.cancelH1).not.toHaveBeenCalled();
  });

  test('un expediente de otro tenant da 404', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno, {
      declaration: { type: 'H1', status: 'submitted', mrn: 'MRN-X' }
    });
    const res = crearRes();

    await ctrl.cancelDeclaration({ params: { expeditionId: exp._id }, body: {}, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(aeatSubmitService.cancelH1).not.toHaveBeenCalled();
  });
});
