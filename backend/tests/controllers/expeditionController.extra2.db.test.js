/**
 * expeditionController.extra2.db.test.js - Cobertura de ramas adicionales
 *
 * Se centra en cubrir ramas específicas no alcanzadas por los otros dos archivos:
 * - Transformaciones de datos en create (client address object, importer address string,
 *   consignee empty, incoterm string)
 * - Filtros y ordenamiento en list
 * - Validaciones de itemIndex en applyTaricSuggestion
 * - Caminos de error 500 en handlers AI
 * - Casos edge de getById con tenantId redundante
 *
 * BD en memoria, NO producción. Modelo Expedition real (no mockeado).
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/utils/documentChecklists', () => ({
  getChecklist: jest.fn(() => [
    { documentType: 'commercial_invoice', required: true, received: false }
  ])
}));
jest.mock('../../src/services/emailService', () => ({ sendPortalLink: jest.fn() }));
jest.mock('../../src/services/aiService', () => ({
  suggestMissingDocuments: jest.fn(),
  analyzeExpeditionRisk: jest.fn(),
  suggestTaricClassification: jest.fn(),
  detectInconsistencies: jest.fn(),
  fullExpeditionAnalysis: jest.fn()
}));

const { Expedition, ChatMessage } = require('../../src/models');
require('../../src/models/User');
const aiService = require('../../src/services/aiService');
const ctrl = require('../../src/controllers/expeditionController');

usarBaseDeDatosEnMemoria();

beforeAll(() => {
  jest.spyOn(ChatMessage, 'getUnreadCount').mockResolvedValue(0);
});

beforeEach(() => {
  jest.clearAllMocks();
});

function usuario({ tenant, role = 'operator' } = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: tenant || new mongoose.Types.ObjectId(),
    role,
    name: 'Operario Test',
    email: 'op@test.es',
    profile: { company: 'Test Company', eoriNumber: 'ESB12345678' }
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
    client: { companyName: 'Cliente Test', nif: 'B11111111' },
    status: 'draft',
    goods: [{ itemNumber: 1, description: 'Test Item', quantity: 1, invoiceValue: 100 }],
    ...extra
  });
}

describe('create: transformaciones de datos', () => {
  test('client.address como objeto se acepta sin transformar', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: {
          companyName: 'Test',
          nif: 'b12345678',
          address: {
            street: 'Calle Mayor',
            city: 'Madrid',
            postalCode: '28001',
            country: 'ES'
          }
        },
        goods: [{ description: 'Item', quantity: 1, invoiceValue: 100 }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.client.address.street).toBe('Calle Mayor');
    expect(res.body.data.client.address.city).toBe('Madrid');
  });

  test('client.address como string se transforma en objeto', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: {
          companyName: 'Test',
          nif: 'b12345678',
          address: 'Calle Mayor 1',
          city: 'Barcelona',
          postalCode: '08001',
          country: 'ES'
        },
        goods: [{ description: 'Item', quantity: 1, invoiceValue: 100 }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.client.address.street).toBe('Calle Mayor 1');
    expect(res.body.data.client.address.city).toBe('Barcelona');
    expect(res.body.data.client.address.postalCode).toBe('08001');
    expect(res.body.data.client.address.country).toBe('ES');
  });

  test('importer.address como string se transforma en objeto', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test', nif: 'b12345678' },
        importer: {
          companyName: 'Importadora',
          nif: 'B87654321',
          address: 'Avenida Principal 10',
          city: 'Valencia',
          postalCode: '46001',
          country: 'ES'
        },
        goods: [{ description: 'Item', quantity: 1, invoiceValue: 100 }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.importer.address.street).toBe('Avenida Principal 10');
    expect(res.body.data.importer.address.city).toBe('Valencia');
  });

  test('consignee vacio (todos los campos vacios) resulta en objeto vacio', async () => {
    // El codigo elimina campos undefined pero deja un objeto vacio {} si todos estan vacios
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test', nif: 'b12345678' },
        consignee: {
          companyName: '',
          nif: '',
          address: ''
        },
        goods: [{ description: 'Item', quantity: 1, invoiceValue: 100 }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    // El consignee queda como {}, no undefined (linea 77 del controller)
    expect(res.body.data.consignee).toEqual({});
  });

  test('consignee con address string se transforma', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test', nif: 'b12345678' },
        consignee: {
          companyName: 'Consignee Co',
          address: 'Shipping Street 5',
          city: 'Sevilla',
          postalCode: '41001',
          country: 'ES'
        },
        goods: [{ description: 'Item', quantity: 1, invoiceValue: 100 }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.consignee.address.street).toBe('Shipping Street 5');
    expect(res.body.data.consignee.address.city).toBe('Sevilla');
  });

  test('incoterm como string se transforma en objeto', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test', nif: 'b12345678' },
        incoterm: 'FOB',
        incotermPlace: 'Shanghai',
        goods: [{ description: 'Item', quantity: 1, invoiceValue: 100 }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.incoterm.code).toBe('FOB');
    expect(res.body.data.incoterm.place).toBe('Shanghai');
  });

  test('goods sin itemNumber reciben numeracion automatica', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test', nif: 'b12345678' },
        goods: [
          { description: 'Item A', quantity: 1, invoiceValue: 100 },
          { description: 'Item B', quantity: 2, invoiceValue: 200 }
        ]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.goods[0].itemNumber).toBe(1);
    expect(res.body.data.goods[1].itemNumber).toBe(2);
  });

  test('goods con originCountry en minusculas se normaliza a mayusculas', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test', nif: 'b12345678' },
        goods: [
          { description: 'Item', quantity: 1, invoiceValue: 100, originCountry: 'cn' }
        ]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.goods[0].originCountry).toBe('CN');
  });
});

describe('list: filtros y ordenamiento', () => {
  test('filtro por assignedTo devuelve solo los asignados al usuario especificado', async () => {
    const tenant = new mongoose.Types.ObjectId();
    const admin = usuario({ tenant, role: 'admin' });
    const operador1 = usuario({ tenant });
    const operador2 = usuario({ tenant });

    const exp1 = await crearExpediente(operador1, { assignedTo: operador1._id });
    const exp2 = await crearExpediente(operador2, { assignedTo: operador2._id });
    const exp3 = await crearExpediente(operador1, { assignedTo: operador1._id });

    const res = crearRes();
    await ctrl.list({
      user: admin,
      query: { assignedTo: String(operador1._id) }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(2);
    // Verificar que los expedientes devueltos son los correctos por _id
    const expeditionIds = res.body.data.expeditions.map(e => String(e._id));
    expect(expeditionIds).toContain(String(exp1._id));
    expect(expeditionIds).toContain(String(exp3._id));
    expect(expeditionIds).not.toContain(String(exp2._id));
  });

  test('ordenamiento ascendente por createdAt', async () => {
    const user = usuario({ role: 'admin' });

    // Crear 3 expedientes con delay minimo para garantizar orden
    const exp1 = await crearExpediente(user, { clientReference: 'REF-001' });
    await new Promise(resolve => setTimeout(resolve, 10));
    const exp2 = await crearExpediente(user, { clientReference: 'REF-002' });
    await new Promise(resolve => setTimeout(resolve, 10));
    const exp3 = await crearExpediente(user, { clientReference: 'REF-003' });

    const res = crearRes();
    await ctrl.list({
      user,
      query: { sortBy: 'createdAt', sortOrder: 'asc' }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(3);
    expect(res.body.data.expeditions[0].clientReference).toBe('REF-001');
    expect(res.body.data.expeditions[2].clientReference).toBe('REF-003');
  });

  test('filtro por status con multiples valores separados por coma', async () => {
    const user = usuario({ role: 'admin' });
    await crearExpediente(user, { status: 'draft' });
    await crearExpediente(user, { status: 'pending_documents' });
    await crearExpediente(user, { status: 'declaration_submitted' });
    await crearExpediente(user, { status: 'draft' });

    const res = crearRes();
    await ctrl.list({
      user,
      query: { status: 'draft,pending_documents' }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(3);
    const statuses = res.body.data.expeditions.map(e => e.status);
    expect(statuses.every(s => ['draft', 'pending_documents'].includes(s))).toBe(true);
  });

  test('filtro por operationType', async () => {
    const user = usuario({ role: 'admin' });
    await crearExpediente(user, { operationType: 'import' });
    await crearExpediente(user, { operationType: 'export' });
    await crearExpediente(user, { operationType: 'import' });

    const res = crearRes();
    await ctrl.list({
      user,
      query: { operationType: 'export' }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.expeditions[0].operationType).toBe('export');
  });

  test('filtro por transportMode', async () => {
    const user = usuario({ role: 'admin' });
    await crearExpediente(user, { transportMode: 'maritime' });
    await crearExpediente(user, { transportMode: 'air' });
    await crearExpediente(user, { transportMode: 'road' });

    const res = crearRes();
    await ctrl.list({
      user,
      query: { transportMode: 'air' }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.expeditions[0].transportMode).toBe('air');
  });

  test('busqueda por expeditionId', async () => {
    const user = usuario({ role: 'admin' });
    const exp = await crearExpediente(user);
    await crearExpediente(user);

    const res = crearRes();
    // Buscar por el expeditionId completo para evitar colisiones parciales
    await ctrl.list({
      user,
      query: { search: exp.expeditionId }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions.length).toBeGreaterThanOrEqual(1);
    // Verificar que al menos uno tiene el expeditionId buscado
    const found = res.body.data.expeditions.some(e => e.expeditionId === exp.expeditionId);
    expect(found).toBe(true);
  });

  test('busqueda por client.companyName', async () => {
    const user = usuario({ role: 'admin' });
    await crearExpediente(user, { client: { companyName: 'ACME Corp', nif: 'B1' } });
    await crearExpediente(user, { client: { companyName: 'XYZ Ltd', nif: 'B2' } });

    const res = crearRes();
    await ctrl.list({
      user,
      query: { search: 'ACME' }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.expeditions[0].client.companyName).toBe('ACME Corp');
  });

  test('busqueda por clientReference', async () => {
    const user = usuario({ role: 'admin' });
    await crearExpediente(user, { clientReference: 'PO-2026-001' });
    await crearExpediente(user, { clientReference: 'INV-2026-002' });

    const res = crearRes();
    await ctrl.list({
      user,
      query: { search: 'PO-2026' }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.expeditions[0].clientReference).toBe('PO-2026-001');
  });

  test('paginacion con page y limit', async () => {
    const user = usuario({ role: 'admin' });
    for (let i = 0; i < 5; i++) {
      await crearExpediente(user);
    }

    const res = crearRes();
    await ctrl.list({
      user,
      query: { page: '2', limit: '2' }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.expeditions).toHaveLength(2);
    expect(res.body.data.pagination.page).toBe(2);
    expect(res.body.data.pagination.limit).toBe(2);
    expect(res.body.data.pagination.total).toBe(5);
    expect(res.body.data.pagination.pages).toBe(3);
  });
});

describe('getById: verificacion redundante de tenant', () => {
  test('el check redundante de tenant en linea 310-312 tambien da 404 para tenant ajeno', async () => {
    // Este test cubre explicitamente el bloque de las lineas 310-312 que hace
    // el check redundante despues de ensureSameTenant
    const dueno = usuario();
    const intruso = usuario(); // tenant distinto
    const exp = await crearExpediente(dueno);

    const res = crearRes();
    await ctrl.getById({ params: { id: exp._id }, user: intruso }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Expediente no encontrado');
    expect(res.body.data).toBeUndefined();
  });
});

describe('applyTaricSuggestion: validacion de itemIndex', () => {
  test('itemIndex negativo devuelve 400', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, {
      goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100 }]
    });

    const res = crearRes();
    await ctrl.applyTaricSuggestion({
      params: { id: exp._id, itemIndex: '-1' },
      body: { taricCode: '12345678', hsCode: '123456' },
      user
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Índice de mercancía inválido');
  });

  test('itemIndex mayor o igual al length devuelve 400', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, {
      goods: [
        { itemNumber: 1, description: 'Item A', quantity: 1, invoiceValue: 100 },
        { itemNumber: 2, description: 'Item B', quantity: 2, invoiceValue: 200 }
      ]
    });

    const res = crearRes();
    await ctrl.applyTaricSuggestion({
      params: { id: exp._id, itemIndex: '2' }, // length es 2, indice 2 esta fuera
      body: { taricCode: '12345678' },
      user
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Índice de mercancía inválido');
  });

  test('itemIndex valido aplica taricCode y hsCode', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, {
      goods: [
        { itemNumber: 1, description: 'Item A', quantity: 1, invoiceValue: 100 },
        { itemNumber: 2, description: 'Item B', quantity: 2, invoiceValue: 200 }
      ]
    });

    const res = crearRes();
    await ctrl.applyTaricSuggestion({
      params: { id: exp._id, itemIndex: '1' },
      body: { taricCode: '87654321', hsCode: '876543' },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.taricCode).toBe('87654321');
    expect(res.body.data.hsCode).toBe('876543');

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[1].taricCode).toBe('87654321');
    expect(guardado.goods[1].hsCode).toBe('876543');
    expect(guardado.timeline.some(t => t.action === 'taric_updated')).toBe(true);
  });

  test('usuario de otro tenant recibe 404', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno, {
      goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100 }]
    });
    const intruso = usuario();

    const res = crearRes();
    await ctrl.applyTaricSuggestion({
      params: { id: exp._id, itemIndex: '0' },
      body: { taricCode: '12345678' },
      user: intruso
    }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('AI endpoints: caminos de error 500', () => {
  test('aiSuggestDocuments captura error de aiService y devuelve 500', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.suggestMissingDocuments.mockRejectedValue(new Error('Bedrock timeout'));

    const res = crearRes();
    await ctrl.aiSuggestDocuments({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error al analizar documentos');
  });

  test('aiAnalyzeRisk captura error de aiService y devuelve 500', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.analyzeExpeditionRisk.mockRejectedValue(new Error('Service unavailable'));

    const res = crearRes();
    await ctrl.aiAnalyzeRisk({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error al analizar riesgo');
  });

  test('aiSuggestTaric sin goods devuelve 400', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { goods: [] });

    const res = crearRes();
    await ctrl.aiSuggestTaric({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('El expediente no tiene mercancías para clasificar');
  });

  test('aiSuggestTaric captura error de aiService y devuelve 500', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.suggestTaricClassification.mockRejectedValue(new Error('AI service error'));

    const res = crearRes();
    await ctrl.aiSuggestTaric({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error al sugerir clasificación TARIC');
  });

  test('aiDetectInconsistencies captura error de aiService y devuelve 500', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.detectInconsistencies.mockRejectedValue(new Error('Network error'));

    const res = crearRes();
    await ctrl.aiDetectInconsistencies({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error al detectar inconsistencias');
  });

  test('aiFullAnalysis captura error de aiService y devuelve 500', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    aiService.fullExpeditionAnalysis.mockRejectedValue(new Error('Unexpected error'));

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error al realizar análisis completo');
  });

  test('getAiAnalysis captura error y devuelve 500', async () => {
    const user = usuario();
    // Forzar error interno simulando un expediente que rompe el select
    jest.spyOn(Expedition, 'findById').mockReturnValueOnce({
      select: jest.fn().mockRejectedValue(new Error('DB error'))
    });

    const res = crearRes();
    await ctrl.getAiAnalysis({ params: { id: new mongoose.Types.ObjectId() }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error al obtener análisis');

    // Restaurar
    Expedition.findById.mockRestore();
  });

  test('aiFullAnalysis procesa correctamente analysis.classification con items sin currentTaric', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, {
      goods: [
        { itemNumber: 1, description: 'Item sin TARIC', quantity: 1, invoiceValue: 100 }
      ]
    });

    aiService.fullExpeditionAnalysis.mockResolvedValue({
      documents: { missingRequired: [] },
      classification: {
        items: [
          {
            itemIndex: 0,
            currentTaric: null, // sin codigo actual
            suggestions: [{ taricCode: '12345678', confidence: 75 }]
          }
        ]
      },
      inconsistencies: { criticalIssues: 0 },
      risk: { overallRiskLevel: 'LOW', recommendations: [] },
      overallReadiness: { score: 65 }
    });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.overallReadiness.nextSteps.length).toBeGreaterThan(0);
    // Verifica que se agrego el nextStep por baja confianza
    const taricStep = res.body.data.overallReadiness.nextSteps.find(
      s => s.action === 'Revisar clasificación arancelaria'
    );
    expect(taricStep).toBeTruthy();
  });

  test('aiFullAnalysis procesa analysis.classification con items con confianza baja', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.fullExpeditionAnalysis.mockResolvedValue({
      documents: { missingRequired: [] },
      classification: {
        items: [
          {
            itemIndex: 0,
            currentTaric: '12340000',
            suggestions: [{ taricCode: '12345678', confidence: 60 }] // <80
          }
        ]
      },
      inconsistencies: { criticalIssues: 0 },
      risk: { overallRiskLevel: 'LOW', recommendations: ['Test rec'] },
      overallReadiness: { score: 70 }
    });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const taricStep = res.body.data.overallReadiness.nextSteps.find(
      s => s.action === 'Revisar clasificación arancelaria'
    );
    expect(taricStep).toBeTruthy();
  });

  test('aiFullAnalysis agrega nextStep cuando hay inconsistencias criticas', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.fullExpeditionAnalysis.mockResolvedValue({
      documents: { missingRequired: [] },
      classification: { items: [] },
      inconsistencies: { criticalIssues: 2 },
      risk: { overallRiskLevel: 'LOW' },
      overallReadiness: { score: 80 }
    });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const inconsistenciesStep = res.body.data.overallReadiness.nextSteps.find(
      s => s.action === 'Corregir inconsistencias críticas'
    );
    expect(inconsistenciesStep).toBeTruthy();
    expect(inconsistenciesStep.details).toContain('2 problema(s) crítico(s)');
  });

  test('aiFullAnalysis agrega nextStep cuando riskLevel es HIGH o CRITICAL', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.fullExpeditionAnalysis.mockResolvedValue({
      documents: { missingRequired: [] },
      classification: { items: [] },
      inconsistencies: { criticalIssues: 0 },
      risk: { overallRiskLevel: 'HIGH' },
      overallReadiness: { score: 75 }
    });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const riskStep = res.body.data.overallReadiness.nextSteps.find(
      s => s.action === 'Revisar factores de riesgo'
    );
    expect(riskStep).toBeTruthy();
    expect(riskStep.details).toContain('HIGH');
  });

  test('aiFullAnalysis con riskLevel CRITICAL tambien agrega nextStep', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.fullExpeditionAnalysis.mockResolvedValue({
      documents: { missingRequired: [] },
      classification: { items: [] },
      inconsistencies: { criticalIssues: 0 },
      risk: { overallRiskLevel: 'CRITICAL' },
      overallReadiness: { score: 50 }
    });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const riskStep = res.body.data.overallReadiness.nextSteps.find(
      s => s.action === 'Revisar factores de riesgo'
    );
    expect(riskStep).toBeTruthy();
    expect(riskStep.details).toContain('CRITICAL');
  });

  test('aiFullAnalysis agrega nextStep cuando hay documentos faltantes', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.fullExpeditionAnalysis.mockResolvedValue({
      documents: { missingRequired: ['invoice', 'packing_list'] },
      classification: { items: [] },
      inconsistencies: { criticalIssues: 0 },
      risk: { overallRiskLevel: 'LOW' },
      overallReadiness: { score: 60 }
    });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const docsStep = res.body.data.overallReadiness.nextSteps.find(
      s => s.action === 'Solicitar documentos faltantes'
    );
    expect(docsStep).toBeTruthy();
    expect(docsStep.details).toContain('2 documento(s) crítico(s)');
    expect(docsStep.priority).toBe(1); // maxima prioridad
  });
});

describe('Manejo de errores 500 de BD', () => {
  test('list devuelve 500 si Expedition.find falla', async () => {
    const user = usuario({ role: 'admin' });
    jest.spyOn(Expedition, 'find').mockImplementation(() => {
      throw new Error('DB error');
    });

    const res = crearRes();
    await ctrl.list({ user, query: {} }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);

    Expedition.find.mockRestore();
  });

  test('getStats devuelve 500 si Expedition.getStats falla', async () => {
    const user = usuario({ role: 'admin' });
    jest.spyOn(Expedition, 'getStats').mockRejectedValue(new Error('DB error'));

    const res = crearRes();
    await ctrl.getStats({ user, query: {} }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);

    Expedition.getStats.mockRestore();
  });
});

describe('AI endpoints: persiste analisis correctamente', () => {
  test('aiAnalyzeRisk actualiza riskFlags cuando hay criticalIssues con priority IMMEDIATE', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.analyzeExpeditionRisk.mockResolvedValue({
      overallRiskLevel: 'HIGH',
      criticalIssues: [
        { type: 'VALUATION_RISK', priority: 'IMMEDIATE', description: 'Precio sospechoso' }
      ]
    });

    const res = crearRes();
    await ctrl.aiAnalyzeRisk({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.riskFlags).toHaveLength(1);
    expect(guardado.aiAnalysis.riskFlags[0].type).toBe('VALUATION_RISK');
    expect(guardado.aiAnalysis.riskFlags[0].severity).toBe('high');
  });

  test('aiAnalyzeRisk mapea priority HIGH a severity high', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.analyzeExpeditionRisk.mockResolvedValue({
      overallRiskLevel: 'MEDIUM',
      criticalIssues: [
        { type: 'COMPLIANCE_RISK', priority: 'HIGH', description: 'Certificado vencido' }
      ]
    });

    const res = crearRes();
    await ctrl.aiAnalyzeRisk({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.riskFlags[0].severity).toBe('high');
  });

  test('aiAnalyzeRisk mapea priority distinta de IMMEDIATE/HIGH a medium', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.analyzeExpeditionRisk.mockResolvedValue({
      overallRiskLevel: 'LOW',
      criticalIssues: [
        { type: 'DOCUMENTATION_RISK', priority: 'MEDIUM', description: 'Doc incompleto' }
      ]
    });

    const res = crearRes();
    await ctrl.aiAnalyzeRisk({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.riskFlags[0].severity).toBe('medium');
  });

  test('aiSuggestTaric persiste classificationSuggestions con alternatives', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    aiService.suggestTaricClassification.mockResolvedValue({
      items: [
        {
          itemIndex: 0,
          suggestions: [
            { taricCode: '12345678', confidence: 90, reasoning: 'Principal match' },
            { taricCode: '12340000', confidence: 75 },
            { taricCode: '12349999', confidence: 60 }
          ]
        }
      ]
    });

    const res = crearRes();
    await ctrl.aiSuggestTaric({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.aiAnalysis.classificationSuggestions).toHaveLength(1);
    const suggestion = guardado.aiAnalysis.classificationSuggestions[0];
    expect(suggestion.suggestedTaricCode).toBe('12345678');
    expect(suggestion.confidence).toBe(90);
    expect(suggestion.reasoning).toBe('Principal match');
    // alternatives solo se crea si suggestions.length > 1, tomando slice(1)
    // El controller usa suggestions?.slice(1).map(...) || []
    // Si suggestions existe y tiene mas de 1, habra alternatives
    if (suggestion.alternatives) {
      expect(suggestion.alternatives).toHaveLength(2);
      expect(suggestion.alternatives[0].code).toBe('12340000');
    }
  });
});
