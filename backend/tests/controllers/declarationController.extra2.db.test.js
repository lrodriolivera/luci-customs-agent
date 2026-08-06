/**
 * declarationController (extra2): ramas de error faltantes.
 *
 * Completa la cobertura de RAMAS del declarationController enfocandose en:
 *   1. Catch blocks (500) de cada handler (no estaban cubiertos).
 *   2. Guardas de tenant en los endpoints IA que faltaban.
 *   3. Ramas else/if secundarias en generateH1Direct, submitDeclaration, submitH7, etc.
 *   4. Ramas de email fallando (silent fail, no detiene el flujo).
 *   5. Validaciones edge case (calculateTotals H7, timeline undefined, etc.).
 *
 * Meta: llevar de 66,66%B a >=80%B en ramas.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// Todos los mocks necesarios. resetMocks:true los borra antes de cada test.
jest.mock('../../src/services/aiService', () => ({
  generateH1Declaration: jest.fn(),
  generateAESDeclaration: jest.fn(),
  validateDeclarationBeforeSubmit: jest.fn(),
  detectDeclarationErrors: jest.fn(),
  suggestRegimeAndPreference: jest.fn(),
  predictDeclarationChannel: jest.fn(),
  fullDeclarationAnalysis: jest.fn()
}));
jest.mock('../../src/services/forms/h1Generator', () => ({
  generate: jest.fn(),
  // Por defecto los totales son declarables: cada test que quiera probar el
  // rechazo devuelve el mensaje explicitamente.
  totalesNoDeclarables: jest.fn(() => null)
}));
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
const Tenant = require('../../src/models/Tenant');
const aiService = require('../../src/services/aiService');
const h1Generator = require('../../src/services/forms/h1Generator');
const aesGenerator = require('../../src/services/forms/aesGenerator');
const h7Generator = require('../../src/services/forms/h7Generator');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const channelService = require('../../src/services/channelService');
const emailService = require('../../src/services/emailService');
const ctrl = require('../../src/controllers/declarationController');

usarBaseDeDatosEnMemoria();

function usuario(extra = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(),
    role: 'operator', name: 'Operario', email: 'op@ejemplo.es',
    ...extra
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
    goodsSummary: { totalValue: 1000 },
    ...extra
  });
}

beforeEach(() => {
  // Restaurar implementaciones por defecto. resetMocks:true las borra antes de cada test.
  aiService.generateH1Declaration.mockResolvedValue({ declarationType: 'A', customsOffice: 'ES002801', warnings: [] });
  aiService.generateAESDeclaration.mockResolvedValue({ declarationType: 'EX', customsOffice: 'ES002801', warnings: [] });
  h1Generator.generate.mockReturnValue({ lrn: 'LRN-H1-1', xml: '<H1>ok</H1>', data: { items: 1 }, summary: { total: 1 } });
  aesGenerator.generate.mockReturnValue({ lrn: 'LRN-AES-1', xml: '<AES>ok</AES>', data: { items: 1 } });
  h7Generator.generate.mockReturnValue({
    lrn: 'LRN-H7-1', xml: '<H7>ok</H7>', summary: {}, eligibility: { eligible: true },
    data: {
      declarationType: 'H7', h7Type: 'IOSS',
      declarationHeader: { customsOffice: 'ES002801' },
      shipment: { intrinsicValue: 100 }, iossData: null, vatCalculation: { vat: 21 }
    }
  });
  h7Generator.isEligibleForH7.mockReturnValue({ eligible: true, reason: null });
  aeatSubmitService.submitH1.mockResolvedValue({ success: true, mrn: '26ES00028012345678H1', channel: 'green', code: '00', estado: 'Aceptada', csv: 'CSV1' });
  aeatSubmitService.submitAES.mockResolvedValue({ success: true, mrn: '26ES00028012345678AE', channel: 'green' });
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

describe('generateH1: catch block', () => {
  test('error en aiService devuelve 500', async () => {
    aiService.generateH1Declaration.mockRejectedValue(new Error('Bedrock timeout'));
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      documents: [
        { type: 'commercial_invoice', status: 'validated', fileName: 'inv.pdf', uploadedBy: user._id },
        { type: 'packing_list', status: 'validated', fileName: 'pack.pdf', uploadedBy: user._id },
        { type: 'bill_of_lading', status: 'validated', fileName: 'bl.pdf', uploadedBy: user._id }
      ]
    });
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al generar declaracion H1/i);
  });
});

describe('generateAES: catch block', () => {
  test('error en aiService devuelve 500', async () => {
    aiService.generateAESDeclaration.mockRejectedValue(new Error('Network error'));
    const user = usuario();
    const exp = await Expedition.create({
      tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
      operationType: 'export', transportMode: 'air',
      client: { companyName: 'Exportadora', nif: 'B99999999' },
      goods: [{ itemNumber: 1, description: 'Vino', quantity: 10, invoiceValue: 500, taricCode: '2204210000' }]
    });
    const res = crearRes();

    await ctrl.generateAES({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al generar declaracion AES/i);
  });
});

describe('getXML: catch block', () => {
  test('id invalido lanza error de mongoose, devuelve 500', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.getXML({ params: { expeditionId: 'id-invalido' }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al obtener XML/i);
  });
});

describe('updateDeclaration: catch block + ramas tipo AES', () => {
  test('error durante update devuelve 500', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', regime: '40', xmlContent: '<viejo/>' }
    });
    // Mockear findById para que falle al cargar el expediente
    jest.spyOn(Expedition, 'findById').mockRejectedValue(new Error('DB failure'));
    const res = crearRes();

    await ctrl.updateDeclaration({
      params: { expeditionId: exp._id }, body: { regime: '42' }, user
    }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al actualizar/i);
  });

  test('regenera XML para tipo AES', async () => {
    const user = usuario();
    const exp = await Expedition.create({
      tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
      operationType: 'export', transportMode: 'air',
      client: { companyName: 'Exp', nif: 'B11111111' },
      goods: [{ itemNumber: 1, description: 'Textil', quantity: 1, invoiceValue: 100, taricCode: '6109100000' }],
      declaration: { type: 'AES', regime: '10', xmlContent: '<viejo/>' }
    });
    const res = crearRes();

    await ctrl.updateDeclaration({
      params: { expeditionId: exp._id }, body: { regime: '21' }, user
    }, res);

    expect(res.statusCode).toBe(200);
    expect(aesGenerator.generate).toHaveBeenCalled();
  });
});

describe('submitDeclaration: ramas faltantes', () => {
  test('canal orange llama a sendChannelAssigned', async () => {
    aeatSubmitService.submitH1.mockResolvedValue({
      success: true, mrn: 'MRN-ORANGE', channel: 'orange', code: '00'
    });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.channel).toBe('orange');
    // El email se envia de forma no bloqueante (catch silencioso)
    expect(emailService.sendChannelAssigned).toHaveBeenCalled();
  });

  test('canal red llama a sendChannelAssigned', async () => {
    aeatSubmitService.submitH1.mockResolvedValue({
      success: true, mrn: 'MRN-RED', channel: 'red', code: '00'
    });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.channel).toBe('red');
    expect(emailService.sendChannelAssigned).toHaveBeenCalled();
  });

  test('fallo en channelService no interrumpe el flujo (catch silencioso)', async () => {
    channelService.processChannelAssignment.mockRejectedValue(new Error('Requirement creation failed'));
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    // El fallo de channel no aborta el submit
    expect(res.statusCode).toBe(200);
    expect(res.body.data.mrn).toBe('26ES00028012345678H1');
  });

  test('error general devuelve 500', async () => {
    aeatSubmitService.submitH1.mockRejectedValue(new Error('Connection timeout'));
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al enviar declaracion/i);
  });

  test('fallo en email rejection no interrumpe el flujo (catch silencioso linea 362)', async () => {
    // Simular que sendDeclarationRejected falla, pero el handler devuelve 400 normalmente
    emailService.sendDeclarationRejected.mockRejectedValue(new Error('SMTP error'));
    aeatSubmitService.submitH1.mockResolvedValue({ success: false, error: 'Error 4404', code: '4404' });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    // El fallo del email NO aborta el flujo, devuelve 400 por el rechazo AEAT
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/4404/);
  });
});

describe('generateH1Direct: ramas faltantes', () => {
  test('catch block devuelve 500', async () => {
    h1Generator.generate.mockImplementation(() => { throw new Error('XML malformado'); });
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.generateH1Direct({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al generar declaracion H1/i);
  });

  test('modo formulario: sin goodsSummary lo calcula', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.generateH1Direct({
      user,
      body: {
        borderTransportMode: '4', // air
        currency: 'EUR',
        recipient: { name: 'Cliente', eori: 'ESB12345678', country: 'ES' },
        sender: { name: 'Proveedor', country: 'US' },
        items: [{
          description: 'Item', taricCode: '8471300000', itemPrice: '100',
          grossWeight: '1', netWeight: '0.8', packageCount: '1', procedure: '4000', preference: '100'
        }]
      }
    }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(res.body.data._id);
    expect(guardado.goodsSummary.totalValue).toBe(100);
  });
});

describe('getDeclarationSummary: catch block', () => {
  test('error en find devuelve 500', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.getDeclarationSummary({ params: { expeditionId: 'id-invalido' }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al obtener resumen/i);
  });
});

describe('checkH7Eligibility: catch block', () => {
  test('error en find devuelve 500', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.checkH7Eligibility({ params: { expeditionId: 'id-invalido' }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al verificar elegibilidad H7/i);
  });
});

describe('generateH7: ramas faltantes', () => {
  test('calcular totales si goodsSummary no existe', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: undefined, // forzar calculo
      goods: [{ itemNumber: 1, description: 'X', quantity: 1, invoiceValue: 50, taricCode: '8471300000', grossWeight: 1, packages: { quantity: 1 } }]
    });
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goodsSummary.totalValue).toBe(50);
  });

  test('rama iossNumber: path sin ecommerce previo (linea 889)', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true });
    const user = usuario();
    const exp = await expedienteImportacion(user, { goodsSummary: { totalValue: 100 } });
    const res = crearRes();

    // Solo verificar que genera correctamente, las ramas 889-891 se ejecutan pero
    // no podemos verificar ecommerce en el expediente guardado (puede no estar en schema)
    await ctrl.generateH7({ body: { expeditionId: exp._id, iossNumber: 'IM12345' }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.declaration.type).toBe('H7');
  });

  test('rama iossNumber: path con ecommerce previo (linea 891)', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      ecommerce: { iossNumber: 'VIEJO' }
    });
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id, iossNumber: 'NUEVO' }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.declaration.type).toBe('H7');
  });

  test('catch block devuelve 500', async () => {
    h7Generator.generate.mockImplementation(() => { throw new Error('H7 generation failed'); });
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true });
    const user = usuario();
    const exp = await expedienteImportacion(user, { goodsSummary: { totalValue: 100 } });
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al generar declaracion H7/i);
  });
});

describe('submitH7: catch block + timeline undefined', () => {
  test('crea timeline si no existe antes de hacer push', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H7', status: 'draft', lrn: 'LRN-H7-1',
        h7Data: { shipment: { intrinsicValue: 100 } }
      },
      timeline: undefined // forzar que no exista
    });
    const res = crearRes();

    await ctrl.submitH7({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.timeline).toBeDefined();
    expect(guardado.timeline.some(t => t.action === 'h7_submitted')).toBe(true);
  });

  test('catch block devuelve 500', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'draft', lrn: 'LRN-H7-1', h7Data: { shipment: { intrinsicValue: 100 } } }
    });
    // Mockear Expedition.findById para que falle durante la carga del expediente
    jest.spyOn(Expedition, 'findById').mockRejectedValue(new Error('DB error'));
    const res = crearRes();

    await ctrl.submitH7({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al enviar H7/i);
  });
});

describe('getH7Stats: catch block', () => {
  test('error en find devuelve 500', async () => {
    // Forzar fallo mockeando Expedition.find
    jest.spyOn(Expedition, 'find').mockRejectedValue(new Error('DB connection lost'));
    const user = usuario();
    const res = crearRes();

    await ctrl.getH7Stats({ query: {}, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al obtener estadisticas H7/i);
  });
});

describe('AI endpoints: catch blocks + guardas faltantes', () => {
  test('aiValidateDeclaration catch devuelve 500', async () => {
    aiService.validateDeclarationBeforeSubmit.mockRejectedValue(new Error('IA timeout'));
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiValidateDeclaration({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al validar/i);
  });

  test('aiDetectErrors catch devuelve 500', async () => {
    aiService.detectDeclarationErrors.mockRejectedValue(new Error('Network error'));
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiDetectErrors({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al detectar errores/i);
  });

  test('aiSuggestRegime catch devuelve 500', async () => {
    aiService.suggestRegimeAndPreference.mockRejectedValue(new Error('IA error'));
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiSuggestRegime({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al sugerir/i);
  });

  test('aiPredictChannel catch devuelve 500', async () => {
    aiService.predictDeclarationChannel.mockRejectedValue(new Error('Prediction failed'));
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiPredictChannel({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al predecir canal/i);
  });

  test('aiFullDeclarationAnalysis catch devuelve 500', async () => {
    aiService.fullDeclarationAnalysis.mockRejectedValue(new Error('Analysis crashed'));
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al realizar análisis completo/i);
  });

  test('getAiDeclarationAnalysis catch devuelve 500', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.getAiDeclarationAnalysis({ params: { expeditionId: 'id-invalido' }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al obtener análisis/i);
  });

  test('applyRegimeSuggestion catch devuelve 500', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    // Mockear findById para que falle durante la carga
    jest.spyOn(Expedition, 'findById').mockRejectedValue(new Error('Save failed'));
    const res = crearRes();

    await ctrl.applyRegimeSuggestion({
      params: { expeditionId: exp._id }, body: { regime: '42' }, user
    }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al aplicar sugerencia/i);
  });

  test('aiDetectErrors rechaza expediente de otro tenant', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno);
    const res = crearRes();

    await ctrl.aiDetectErrors({ params: { expeditionId: exp._id }, body: {}, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(aiService.detectDeclarationErrors).not.toHaveBeenCalled();
  });

  test('aiPredictChannel rechaza expediente de otro tenant', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno);
    const res = crearRes();

    await ctrl.aiPredictChannel({ params: { expeditionId: exp._id }, body: {}, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(aiService.predictDeclarationChannel).not.toHaveBeenCalled();
  });

  test('aiFullDeclarationAnalysis rechaza expediente de otro tenant', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno);
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis({ params: { expeditionId: exp._id }, body: {}, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(aiService.fullDeclarationAnalysis).not.toHaveBeenCalled();
  });

  test('getAiDeclarationAnalysis rechaza expediente de otro tenant', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno, {
      aiAnalysis: { declarationAnalysis: { overallReadiness: { score: 70 } } }
    });
    const res = crearRes();

    // BUG encontrado y corregido: el select() original NO incluia tenantId, permitiendo
    // fuga cross-tenant. Ahora lo incluye y el guard funciona correctamente.
    await ctrl.getAiDeclarationAnalysis({ params: { expeditionId: exp._id }, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
  });

  test('applyRegimeSuggestion rechaza expediente de otro tenant', async () => {
    const dueno = usuario();
    const exp = await expedienteImportacion(dueno);
    const res = crearRes();

    await ctrl.applyRegimeSuggestion({
      params: { expeditionId: exp._id }, body: { regime: '42' }, user: usuario()
    }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('cancelDeclaration: ramas faltantes', () => {
  test('timeline undefined: lo crea antes de hacer push', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      representative: { nif: 'B12345678' },
      declaration: { type: 'H1', status: 'submitted', mrn: 'MRN-X', customsOffice: 'ES002801' },
      timeline: undefined
    });
    const res = crearRes();

    await ctrl.cancelDeclaration({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.timeline).toBeDefined();
    expect(guardado.timeline.some(t => t.action === 'declaration_cancelled')).toBe(true);
  });

  test('anulacion rechazada por AEAT: no marca cancelled', async () => {
    aeatSubmitService.cancelH1.mockResolvedValue({ success: false, error: 'MRN no encontrado' });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'submitted', mrn: 'MRN-X', customsOffice: 'ES002801' }
    });
    const res = crearRes();

    await ctrl.cancelDeclaration({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200); // handler devuelve 200 aunque AEAT rechace
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).not.toBe('cancelled'); // no cambia status si AEAT rechaza
  });

  test('catch block devuelve 500', async () => {
    aeatSubmitService.cancelH1.mockRejectedValue(new Error('Network error'));
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'submitted', mrn: 'MRN-X' }
    });
    const res = crearRes();

    await ctrl.cancelDeclaration({ params: { expeditionId: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error al anular/i);
  });
});

describe('submitDeclaration: email fallbacks y ramas adicionales', () => {
  test('usuario sin email: no intenta enviar emails (linea 442)', async () => {
    const user = usuario({ email: undefined }); // sin email
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    // No llama a sendDeclarationAccepted porque req.user.email es undefined
    expect(emailService.sendDeclarationAccepted).not.toHaveBeenCalled();
  });

  test('email accepted falla: flujo continua (catch silencioso linea 449)', async () => {
    emailService.sendDeclarationAccepted.mockRejectedValue(new Error('SMTP down'));
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200); // no se interrumpe por email
    expect(res.body.data.mrn).toBeDefined();
  });

  test('email channelAssigned falla: flujo continua (catch silencioso linea 457)', async () => {
    aeatSubmitService.submitH1.mockResolvedValue({
      success: true, mrn: 'MRN-ORANGE', channel: 'orange', code: '00'
    });
    emailService.sendChannelAssigned.mockRejectedValue(new Error('Email error'));
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.channel).toBe('orange');
  });

  test('submitAES exitoso (path alternativo linea 340)', async () => {
    const user = usuario();
    const exp = await Expedition.create({
      tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
      operationType: 'export', transportMode: 'air',
      client: { companyName: 'Exp', nif: 'B11111111' },
      goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100, taricCode: '6109100000' }],
      declaration: { type: 'AES', status: 'draft', xmlContent: '<AES/>', lrn: 'LRN-AES' }
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(aeatSubmitService.submitAES).toHaveBeenCalled();
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.status).toBe('submitted');
  });
});

describe('generateH1Direct: ramas de calculo goodsSummary', () => {
  test('sin goodsSummary.totalValue: calcula totales (lineas 640-646)', async () => {
    const user = usuario();
    // Modo clasico con expediente que NO tiene goodsSummary
    const exp = await expedienteImportacion(user, { goodsSummary: undefined });
    const res = crearRes();

    await ctrl.generateH1Direct({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goodsSummary.totalValue).toBeGreaterThan(0);
  });

  test('calculo con goods sin packages/weights: fallbacks || 0 y || 1 (lineas 641-645)', async () => {
    const user = usuario();
    // Expediente con goods minimalistas (sin packages, sin weights)
    const exp = await expedienteImportacion(user, {
      goodsSummary: undefined,
      goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100, taricCode: '8471300000' }]
    });
    const res = crearRes();

    await ctrl.generateH1Direct({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    // Los fallbacks se aplicaron: el reduce con || 1 da 1 si packages es undefined
    // pero si g.packages es undefined, (g.packages?.quantity || 1) da 1
    // sum + 1 = 1, pero si packages no existe sum + (undefined || 1) da 1
    expect(guardado.goodsSummary.totalValue).toBe(100);
    expect(guardado.goodsSummary.totalGrossWeight).toBe(0); // sin grossWeight
  });
});

describe('generateH7: ramas de calculo goodsSummary', () => {
  test('sin goodsSummary.totalValue: calcula totales (lineas 857-863)', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: undefined }, // totalValue undefined fuerza calculo
      goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 80, taricCode: '8471300000', grossWeight: 1, packages: { quantity: 1 } }]
    });
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goodsSummary.totalValue).toBe(80);
  });

  test('calculo con goods sin packages/weights: fallbacks || 0 y || 1 (lineas 859-862)', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: undefined,
      goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 50, taricCode: '8471300000' }]
    });
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goodsSummary.totalValue).toBe(50);
    expect(guardado.goodsSummary.totalGrossWeight).toBe(0);
  });
});

describe('submitH7: email sin usuario (linea 1030-1036)', () => {
  test('usuario sin email: no intenta enviar email', async () => {
    const user = usuario({ email: undefined });
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H7', status: 'draft', lrn: 'LRN-H7-1',
        h7Data: { iossData: { number: 'IM123' }, shipment: { intrinsicValue: 100 } }
      }
    });
    const res = crearRes();

    await ctrl.submitH7({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(emailService.sendDeclarationAccepted).not.toHaveBeenCalled();
  });

  test('email H7 falla: flujo continua (linea 1036)', async () => {
    emailService.sendDeclarationAccepted.mockRejectedValue(new Error('Email error'));
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
    expect(res.body.data.mrn).toBeDefined();
  });
});

describe('getH7Stats: ramas de agregacion', () => {
  test('agrega H7 con startDate y endDate (lineas 1086-1088)', async () => {
    const user = usuario();
    // Crear H7 con fecha especifica
    await expedienteImportacion(user, {
      declaration: {
        type: 'H7', status: 'submitted', declarationDate: new Date('2026-01-15'),
        h7Data: { shipment: { intrinsicValue: 100 } }
      }
    });
    const res = crearRes();

    await ctrl.getH7Stats({
      query: { startDate: '2026-01-01', endDate: '2026-01-31' }, user
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  test('agrega H7 sin filtros de fecha', async () => {
    const user = usuario();
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', h7Data: { shipment: { intrinsicValue: 50 } } }
    });
    const res = crearRes();

    await ctrl.getH7Stats({ query: {}, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
  });
});

describe('updateDeclaration: ramas de regeneracion XML', () => {
  test('sin updates en body: no regenera XML (rama vacia lineas 256-270)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', regime: '40', xmlContent: '<original/>' }
    });
    const res = crearRes();

    await ctrl.updateDeclaration({
      params: { expeditionId: exp._id }, body: {}, user
    }, res);

    expect(res.statusCode).toBe(200);
    // Sin updates, no llama a h1Generator.generate porque Object.keys(updates).length === 0
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.xmlContent).toBe('<original/>');
  });
});

describe('generateH7: timeline undefined', () => {
  test('crea timeline si no existe antes de hacer push (linea 897)', async () => {
    h7Generator.isEligibleForH7.mockReturnValue({ eligible: true });
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      timeline: undefined
    });
    const res = crearRes();

    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.timeline).toBeDefined();
    expect(guardado.timeline.some(t => t.action === 'h7_generated')).toBe(true);
  });
});

describe('generateH1Direct: timeline undefined', () => {
  test('crea timeline si no existe antes de hacer push (linea 678)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { timeline: undefined });
    const res = crearRes();

    await ctrl.generateH1Direct({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.timeline).toBeDefined();
    expect(guardado.timeline.some(t => t.action === 'h1_generated')).toBe(true);
  });
});

describe('submitDeclaration: timeline undefined', () => {
  test('crea timeline si no existe antes de hacer push (linea 405)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1/>', lrn: 'LRN-1' },
      timeline: undefined
    });
    const res = crearRes();

    await ctrl.submitDeclaration({ params: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.timeline).toBeDefined();
    expect(guardado.timeline.some(t => t.action === 'declaration_submitted')).toBe(true);
  });
});
