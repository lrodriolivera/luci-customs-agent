/**
 * expeditionController: handlers no cubiertos por expeditionController.db.test.js
 * (checklist, envio de link de portal, listado con filtros, y los endpoints IA),
 * contra Mongo real. El modelo Expedition NO se mockea: la persistencia real es
 * justo donde vive el valor del test (aqui salio el bug de aiAnalysis).
 *
 * Se mockean SOLO las dependencias externas al controller: aiService (Bedrock),
 * emailService (correo) y documentChecklists (utilidad pura ya cubierta aparte).
 * El resultado de la IA se fija por test; lo que se comprueba es que el controller
 * lo PERSISTE y que getAiAnalysis lo recupera despues (no que la IA acierte).
 *
 * BD en memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/utils/documentChecklists', () => ({
  getChecklist: jest.fn(() => [
    { documentType: 'commercial_invoice', documentName: 'Factura', required: true, received: false },
    { documentType: 'packing_list', documentName: 'Packing', required: false, received: false }
  ])
}));
jest.mock('../../src/services/emailService', () => ({ sendPortalLink: jest.fn().mockResolvedValue(true) }));
jest.mock('../../src/services/aiService', () => ({
  suggestMissingDocuments: jest.fn(),
  analyzeExpeditionRisk: jest.fn(),
  suggestTaricClassification: jest.fn(),
  detectInconsistencies: jest.fn(),
  fullExpeditionAnalysis: jest.fn()
}));

const { Expedition, ChatMessage } = require('../../src/models');
// User debe estar registrado para el populate('assignedTo') de list.
require('../../src/models/User');
const documentChecklists = require('../../src/utils/documentChecklists');
const emailService = require('../../src/services/emailService');
const aiService = require('../../src/services/aiService');
const ctrl = require('../../src/controllers/expeditionController');

usarBaseDeDatosEnMemoria();

beforeAll(() => {
  jest.spyOn(ChatMessage, 'getUnreadCount').mockResolvedValue(0);
});

// resetMocks:true borra las implementaciones de fabrica antes de cada test:
// re-darlas en beforeEach.
beforeEach(() => {
  documentChecklists.getChecklist.mockReturnValue([
    { documentType: 'commercial_invoice', documentName: 'Factura', required: true, received: false },
    { documentType: 'packing_list', documentName: 'Packing', required: false, received: false }
  ]);
  emailService.sendPortalLink.mockResolvedValue(true);
});

function usuario({ tenant, role = 'operator' } = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: tenant || new mongoose.Types.ObjectId(),
    role,
    name: 'Operario',
    email: 'op@ejemplo.es'
  };
}

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function crearExpediente(user, extra = {}) {
  return Expedition.create({
    tenantId: user.tenantId,
    createdBy: user._id,
    assignedTo: user._id,
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B99999999', contact: { name: 'Ana', email: 'ana@cliente.es' } },
    status: 'draft',
    goods: [{ itemNumber: 1, description: 'Cafe', quantity: 10, invoiceValue: 1000 }],
    ...extra
  });
}

describe('getChecklist', () => {
  test('genera el checklist si el expediente no lo tiene y lo mapea al formato del frontend', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { documentChecklist: [] });
    const res = crearRes();

    await ctrl.getChecklist({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(documentChecklists.getChecklist).toHaveBeenCalled();
    expect(res.body.data.checklist).toHaveLength(2);
    const factura = res.body.data.checklist.find(c => c.documentType === 'commercial_invoice');
    expect(factura.name).toBe('Factura');
    expect(factura.required).toBe(true);
    expect(factura.uploaded).toBe(false);
    // se persistio el checklist generado
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documentChecklist).toHaveLength(2);
  });

  test('un expediente de otro tenant recibe 404', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno, { documentChecklist: [] });
    const res = crearRes();

    await ctrl.getChecklist({ params: { id: exp._id }, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('regenerateChecklist', () => {
  test('regenera manteniendo el estado de los documentos ya recibidos', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, {
      documentChecklist: [
        { documentType: 'commercial_invoice', documentName: 'Factura', required: true, received: true }
      ]
    });
    const res = crearRes();

    await ctrl.regenerateChecklist({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const factura = res.body.data.find(d => d.documentType === 'commercial_invoice');
    // la factura regenerada conserva received:true del estado previo
    expect(factura.received).toBe(true);
  });
});

describe('sendPortalLink', () => {
  test('falla con 400 si no hay email del cliente ni en el body ni en el contacto', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { client: { companyName: 'Sin email', nif: 'B1' } });
    const res = crearRes();

    await ctrl.sendPortalLink({ params: { id: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(400);
    expect(emailService.sendPortalLink).not.toHaveBeenCalled();
  });

  test('envia el link, registra la comunicacion y el evento de timeline', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    const res = crearRes();

    await ctrl.sendPortalLink({ params: { id: exp._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200);
    expect(emailService.sendPortalLink).toHaveBeenCalledWith(
      'ana@cliente.es', 'Cliente SL', expect.any(String), expect.any(String), 'import'
    );
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.communications.some(c => c.sentTo === 'ana@cliente.es')).toBe(true);
    expect(guardado.timeline.some(t => t.action === 'portal_link_sent')).toBe(true);
  });

  test('regenera el token del portal si estaba expirado', async () => {
    const user = usuario();
    const tokenViejo = 'token-expirado';
    const exp = await crearExpediente(user, {
      clientPortal: { token: tokenViejo, isActive: true, expiresAt: new Date('2020-01-01') }
    });
    const res = crearRes();

    await ctrl.sendPortalLink({ params: { id: exp._id }, body: { email: 'otro@cliente.es' }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.clientPortal.token).not.toBe(tokenViejo);
    expect(guardado.clientPortal.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('un expediente de otro tenant recibe 404', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno);
    const res = crearRes();

    await ctrl.sendPortalLink({ params: { id: exp._id }, body: {}, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(emailService.sendPortalLink).not.toHaveBeenCalled();
  });
});

describe('list: filtros, busqueda y aislamiento', () => {
  test('un operador solo ve sus propios expedientes del tenant', async () => {
    const tenant = new mongoose.Types.ObjectId();
    const op = usuario({ tenant });
    const otroOp = usuario({ tenant }); // mismo tenant, otro usuario
    await crearExpediente(op);
    await crearExpediente(otroOp); // no debe verlo el operador op

    const res = crearRes();
    await ctrl.list({ user: op, query: {} }, res);

    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.pagination.total).toBe(1);
  });

  test('el admin ve todos los del tenant y el filtro por status funciona', async () => {
    const tenant = new mongoose.Types.ObjectId();
    const admin = usuario({ tenant, role: 'admin' });
    const op = usuario({ tenant });
    await crearExpediente(op, { status: 'draft' });
    await crearExpediente(op, { status: 'pending_documents' });

    const res = crearRes();
    await ctrl.list({ user: admin, query: { status: 'draft' } }, res);

    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.expeditions[0].status).toBe('draft');
  });

  test('la busqueda por texto encuentra por razon social', async () => {
    const admin = usuario({ role: 'admin' });
    await crearExpediente(admin, { client: { companyName: 'ACME Imports', nif: 'B1' } });
    await crearExpediente(admin, { client: { companyName: 'Otra Cosa', nif: 'B2' } });

    const res = crearRes();
    await ctrl.list({ user: admin, query: { search: 'ACME' } }, res);

    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.expeditions[0].client.companyName).toBe('ACME Imports');
  });
});

describe('endpoints IA: el analisis se persiste y es recuperable (regresion aiAnalysis)', () => {
  test('aiSuggestDocuments persiste documentSuggestions y getAiAnalysis lo recupera', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.suggestMissingDocuments.mockResolvedValue({ missing: ['eur1'], confidence: 90 });

    const res = crearRes();
    await ctrl.aiSuggestDocuments({ params: { id: exp._id }, user }, res);
    expect(res.statusCode).toBe(200);

    // BUG#9: sin declarar documentSuggestions en el schema estricto, esto se
    // descartaba en silencio y getAiAnalysis nunca lo recuperaba.
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.documentSuggestions).toBeTruthy();
    expect(guardado.aiAnalysis.documentSuggestions.missing).toEqual(['eur1']);

    const res2 = crearRes();
    await ctrl.getAiAnalysis({ params: { id: exp._id }, user }, res2);
    expect(res2.body.data.hasAnalysis).toBe(true);
    expect(res2.body.data.analysis.documentSuggestions.missing).toEqual(['eur1']);
  });

  test('aiAnalyzeRisk persiste riskAnalysis y mapea riskFlags desde criticalIssues', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.analyzeExpeditionRisk.mockResolvedValue({
      overallRiskLevel: 'HIGH',
      criticalIssues: [{ type: 'valoracion', priority: 'IMMEDIATE', description: 'valor bajo' }]
    });

    const res = crearRes();
    await ctrl.aiAnalyzeRisk({ params: { id: exp._id }, user }, res);
    expect(res.statusCode).toBe(200);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.riskAnalysis.overallRiskLevel).toBe('HIGH');
    expect(guardado.aiAnalysis.riskFlags).toHaveLength(1);
    expect(guardado.aiAnalysis.riskFlags[0].severity).toBe('high');
    expect(guardado.aiAnalysis.lastAnalysisAt).toBeTruthy();
  });

  test('aiSuggestTaric exige mercancias (400 si no hay) y persiste las sugerencias', async () => {
    const user = usuario();
    const sinGoods = await crearExpediente(user, { goods: [] });
    const res = crearRes();
    await ctrl.aiSuggestTaric({ params: { id: sinGoods._id }, user }, res);
    expect(res.statusCode).toBe(400);

    const conGoods = await crearExpediente(user);
    aiService.suggestTaricClassification.mockResolvedValue({
      items: [{ itemIndex: 0, suggestions: [{ taricCode: '0901210000', confidence: 95, reasoning: 'cafe' }] }]
    });
    const res2 = crearRes();
    await ctrl.aiSuggestTaric({ params: { id: conGoods._id }, user }, res2);
    expect(res2.statusCode).toBe(200);
    const guardado = await Expedition.findById(conGoods._id);
    expect(guardado.aiAnalysis.classificationSuggestions[0].suggestedTaricCode).toBe('0901210000');
  });

  test('aiDetectInconsistencies persiste el resultado', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.detectInconsistencies.mockResolvedValue({ issues: ['peso no cuadra'], criticalIssues: 1 });

    const res = crearRes();
    await ctrl.aiDetectInconsistencies({ params: { id: exp._id }, user }, res);
    expect(res.statusCode).toBe(200);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.inconsistencies.issues).toEqual(['peso no cuadra']);
    expect(guardado.aiAnalysis.lastAnalysisAt).toBeTruthy();
  });

  test('aiFullAnalysis persiste fullAnalysis, ordena nextSteps y deja evento de timeline', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.fullExpeditionAnalysis.mockResolvedValue({
      overallReadiness: { score: 40 },
      documents: { missingRequired: ['eur1'] },
      classification: { items: [{ currentTaric: null }] },
      inconsistencies: { criticalIssues: 2 },
      risk: { overallRiskLevel: 'HIGH', recommendations: ['revisar valoracion'] }
    });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);
    expect(res.statusCode).toBe(200);
    // nextSteps ordenados por prioridad (los de prioridad 1 primero)
    expect(res.body.data.overallReadiness.nextSteps[0].priority).toBe(1);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.fullAnalysis.overallReadiness.score).toBe(40);
    expect(guardado.aiAnalysis.recommendations).toEqual(['revisar valoracion']);
    expect(guardado.timeline.some(t => t.action === 'ai_analysis')).toBe(true);
  });

  test('getAiAnalysis de un expediente de otro tenant devuelve 404', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno);
    const res = crearRes();
    await ctrl.getAiAnalysis({ params: { id: exp._id }, user: usuario() }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('applyTaricSuggestion', () => {
  test('aplica el codigo TARIC a la mercancia y lo deja en el timeline', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    const res = crearRes();

    await ctrl.applyTaricSuggestion({
      params: { id: exp._id, itemIndex: '0' },
      body: { taricCode: '0901210000', hsCode: '090121' },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[0].taricCode).toBe('0901210000');
    expect(guardado.goods[0].hsCode).toBe('090121');
    expect(guardado.timeline.some(t => t.action === 'taric_updated')).toBe(true);
  });

  test('un indice de mercancia fuera de rango devuelve 400', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    const res = crearRes();

    await ctrl.applyTaricSuggestion({
      params: { id: exp._id, itemIndex: '5' },
      body: { taricCode: '0901210000' },
      user
    }, res);

    expect(res.statusCode).toBe(400);
  });

  test('un expediente de otro tenant recibe 404', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno);
    const res = crearRes();

    await ctrl.applyTaricSuggestion({
      params: { id: exp._id, itemIndex: '0' },
      body: { taricCode: '0901210000' },
      user: usuario()
    }, res);

    expect(res.statusCode).toBe(404);
  });
});
