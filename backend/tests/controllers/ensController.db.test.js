/**
 * ensController — controlador de Declaraciones Sumarias de Entrada (ENS/ICS2),
 * la seguridad pre-arribo que exige la UE. Es logica de negocio critica (plazos
 * AEAT, tenant-scoping, riesgo), justo lo que el mandato manda cubrir antes que
 * utilidades.
 *
 * FRONTERAS mockeadas SOLO las externas:
 *  - aiService (Bedrock): analyzeENSData / validateENSBeforeSubmit /
 *    predictENSRejection.
 *  - aeatSubmitService (red a AEAT): submitENS / submitENSAmendment. Enviar de
 *    verdad presentaria una ENS real -> el mandato lo prohibe.
 * El modelo ENSDeclaration y Expedition NO se mockean: Mongo real en memoria,
 * de modo que los save(), hooks, calculateTotals y los guards de tenant se
 * ejecutan de verdad. El propio ensController y ensService NO se mockean.
 *
 * jest.config tiene resetMocks:true -> los fakes se reinstalan en beforeEach.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  analyzeENSData: jest.fn(),
  validateENSBeforeSubmit: jest.fn(),
  predictENSRejection: jest.fn()
}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitENS: jest.fn(),
  submitENSAmendment: jest.fn()
}));

const ensController = require('../../src/controllers/ensController');
const aiService = require('../../src/services/aiService');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const { ENSDeclaration, Expedition } = require('../../src/models');
const User = require('../../src/models/User');

usarBaseDeDatosEnMemoria();

const enHoras = (h) => new Date(Date.now() + h * 60 * 60 * 1000);

// req/res falsos minimos.
function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.headersSent = false;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; res.headersSent = true; return res; });
  res.type = jest.fn(() => res);
  res.send = jest.fn((b) => { res.body = b; res.headersSent = true; return res; });
  return res;
}

function mockReq({ user, params = {}, body = {}, query = {} } = {}) {
  return {
    user,
    tenantId: user?.tenantId ? String(user.tenantId) : undefined,
    params,
    body,
    query
  };
}

// Datos validos de una ENS (pasan create/validate del service).
function datosENS(overrides = {}) {
  return {
    transportMode: 'SEA',
    entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: enHoras(48) },
    carrier: { eori: 'ESB12345678', name: 'Naviera SL' },
    transportMeans: { identification: 'IMO9999999', identificationType: 'VESSEL_IMO', modeAtBorder: '1' },
    consignment: {
      referenceNumber: 'MBL-001', referenceType: 'MBL', grossMass: 1000,
      numberOfPackages: 10, goodsDescription: 'Mercancia general', countryOfDispatch: 'CN'
    },
    goods: [{ sequenceNumber: 1, description: 'Camisetas', commodityCode: '610910', grossMass: 500, numberOfPackages: 10 }],
    ...overrides
  };
}

let TENANT_A, TENANT_B, adminUser, operadorUser, operadorUser2, otroTenantUser;

beforeEach(async () => {
  TENANT_A = new mongoose.Types.ObjectId();
  TENANT_B = new mongoose.Types.ObjectId();

  // Usuarios reales: createDeclaration lee user.tenantId por id.
  adminUser = await User.create({
    name: 'Admin A', email: `admin-${Date.now()}-${Math.round(performance.now())}@a.es`,
    password: 'secret123', role: 'admin', tenantId: TENANT_A
  });
  operadorUser = await User.create({
    name: 'Op A', email: `op-${Date.now()}-${Math.round(performance.now())}@a.es`,
    password: 'secret123', role: 'agent', tenantId: TENANT_A
  });
  operadorUser2 = await User.create({
    name: 'Op A2', email: `op2-${Date.now()}-${Math.round(performance.now())}@a.es`,
    password: 'secret123', role: 'agent', tenantId: TENANT_A
  });
  otroTenantUser = await User.create({
    name: 'Op B', email: `op-${Date.now()}-${Math.round(performance.now())}@b.es`,
    password: 'secret123', role: 'agent', tenantId: TENANT_B
  });
});

// Siembra una ENS via service (createdBy + tenantId reales).
const ensService = require('../../src/services/ensService');
async function sembrarENS(user, overrides = {}) {
  const r = await ensService.createDeclaration(datosENS(overrides), user._id);
  return ENSDeclaration.findById(r.data._id);
}

// ==================== list ====================

describe('list', () => {
  test('operador ve solo lo suyo; admin ve todo el tenant', async () => {
    await sembrarENS(operadorUser);
    await sembrarENS(operadorUser2);

    const resOp = mockRes();
    await ensController.list(mockReq({ user: operadorUser }), resOp);
    expect(resOp.body.success).toBe(true);
    expect(resOp.body.data).toHaveLength(1);

    const resAdmin = mockRes();
    await ensController.list(mockReq({ user: adminUser }), resAdmin);
    expect(resAdmin.body.data.length).toBeGreaterThanOrEqual(2);
    expect(resAdmin.body.pagination.total).toBeGreaterThanOrEqual(2);
  });

  test('filtra por status, transportMode y busqueda; pagina', async () => {
    const d = await sembrarENS(operadorUser);

    const res = mockRes();
    await ensController.list(mockReq({
      user: operadorUser,
      query: { status: 'draft', transportMode: 'SEA', search: d.reference, page: 1, limit: 1 }
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('filtra por rango de fechas y entryOffice', async () => {
    await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.list(mockReq({
      user: operadorUser,
      query: {
        entryOffice: 'ES002801',
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString()
      }
    }), res);
    expect(res.body.success).toBe(true);
  });

  test('error de BD -> 500', async () => {
    const spy = jest.spyOn(ENSDeclaration, 'find').mockImplementation(() => { throw new Error('boom'); });
    const res = mockRes();
    await ensController.list(mockReq({ user: operadorUser }), res);
    expect(res.statusCode).toBe(500);
    spy.mockRestore();
  });
});

// ==================== getStats ====================

describe('getStats', () => {
  test('admin agrega sin createdBy; operador acota por createdBy', async () => {
    await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.getStats(mockReq({ user: adminUser }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const res2 = mockRes();
    await ensController.getStats(mockReq({ user: operadorUser }), res2);
    expect(res2.body.success).toBe(true);
  });
});

// ==================== create ====================

describe('create', () => {
  test('crea una ENS valida -> 201', async () => {
    const res = mockRes();
    await ensController.create(mockReq({ user: operadorUser, body: datosENS() }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();
  });

  test('datos invalidos -> 400 con errores', async () => {
    const res = mockRes();
    await ensController.create(mockReq({
      user: operadorUser, body: datosENS({ transportMode: undefined })
    }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });
});

// ==================== get ====================

describe('get', () => {
  test('operador obtiene la suya', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.get(mockReq({ user: operadorUser, params: { id: d._id.toString() } }), res);
    expect(res.body.success).toBe(true);
    expect(String(res.body.data._id)).toBe(String(d._id));
  });

  test('otro operador del mismo tenant NO ve la ajena (query por createdBy) -> 404', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.get(mockReq({ user: operadorUser2, params: { id: d._id.toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('admin ve cualquiera del tenant', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.get(mockReq({ user: adminUser, params: { id: d._id.toString() } }), res);
    expect(res.body.success).toBe(true);
  });
});

// ==================== update ====================

describe('update', () => {
  test('actualiza campos permitidos en draft', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.update(mockReq({
      user: operadorUser, params: { id: d._id.toString() },
      body: { carrier: { eori: 'ESB99999999', name: 'Otra Naviera' } }
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.carrier.name).toBe('Otra Naviera');
  });

  test('no editable fuera de draft -> 400', async () => {
    const d = await sembrarENS(operadorUser);
    d.status = 'submitted';
    await d.save();
    const res = mockRes();
    await ensController.update(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { carrier: { name: 'X' } }
    }), res);
    expect(res.statusCode).toBe(400);
  });

  test('inexistente -> 404', async () => {
    const res = mockRes();
    await ensController.update(mockReq({
      user: operadorUser, params: { id: new mongoose.Types.ObjectId().toString() }, body: {}
    }), res);
    expect(res.statusCode).toBe(404);
  });
});

// ==================== validate ====================

describe('validate', () => {
  test('delega en ensService.validateDeclaration', async () => {
    const res = mockRes();
    await ensController.validate(mockReq({ user: operadorUser, body: datosENS() }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

// ==================== submit ====================

describe('submit', () => {
  test('envio aceptado por AEAT -> declaracion aceptada', async () => {
    const d = await sembrarENS(operadorUser);
    aeatSubmitService.submitENS.mockResolvedValue({
      success: true, accepted: true, mrn: '25ES0028011234567X', xml: '<xml/>'
    });
    const res = mockRes();
    await ensController.submit(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { certificateAlias: 'strix' }
    }), res);
    expect(res.body.success).toBe(true);
    const tras = await ENSDeclaration.findById(d._id);
    expect(tras.status).toBe('accepted');
  });

  test('rechazo AEAT -> 400 y sigue en draft', async () => {
    const d = await sembrarENS(operadorUser);
    aeatSubmitService.submitENS.mockResolvedValue({
      success: false, accepted: false, error: 'Rechazada', errors: [{ code: 'X' }]
    });
    const res = mockRes();
    await ensController.submit(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: {}
    }), res);
    expect(res.statusCode).toBe(400);
    const tras = await ENSDeclaration.findById(d._id);
    expect(tras.status).toBe('draft');
  });
});

// ==================== cancel ====================

describe('cancel', () => {
  test('anula una ENS en draft', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.cancel(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { reason: 'error de datos' }
    }), res);
    expect(res.body.success).toBe(true);
    const tras = await ENSDeclaration.findById(d._id);
    expect(tras.status).toBe('cancelled');
  });
});

// ==================== notifyArrival ====================

describe('notifyArrival', () => {
  test('notifica llegada sobre una ENS aceptada', async () => {
    const d = await sembrarENS(operadorUser);
    d.status = 'accepted';
    d.mrn = '25ES0028011234567X';
    await d.save();
    const res = mockRes();
    await ensController.notifyArrival(mockReq({
      user: operadorUser, params: { id: d._id.toString() },
      body: { actualArrival: new Date().toISOString() }
    }), res);
    expect(res.body.success).toBe(true);
  });
});

// ==================== processBatch ====================

describe('processBatch', () => {
  test('sin array -> 400', async () => {
    const res = mockRes();
    await ensController.processBatch(mockReq({ user: operadorUser, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('mas de 100 -> 400', async () => {
    const res = mockRes();
    await ensController.processBatch(mockReq({
      user: operadorUser, body: { declarations: new Array(101).fill(datosENS()) }
    }), res);
    expect(res.statusCode).toBe(400);
  });

  test('lote valido se procesa', async () => {
    const res = mockRes();
    await ensController.processBatch(mockReq({
      user: operadorUser, body: { declarations: [datosENS(), datosENS()] }
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(2);
  });
});

// ==================== busquedas ====================

describe('searchByContainer / searchByBOL', () => {
  test('busca por contenedor', async () => {
    const res = mockRes();
    await ensController.searchByContainer(mockReq({
      user: operadorUser, params: { container: 'MSCU1234567' }
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  test('busca por B/L', async () => {
    const res = mockRes();
    await ensController.searchByBOL(mockReq({
      user: operadorUser, params: { bol: 'MBL-001' }
    }), res);
    expect(res.body.success).toBe(true);
  });
});

// ==================== catalogos puros ====================

describe('getEntryOffices / getDeadlines', () => {
  test('devuelve aduanas de entrada (filtrado por modo)', async () => {
    const res = mockRes();
    await ensController.getEntryOffices(mockReq({ user: operadorUser, query: { transportMode: 'SEA' } }), res);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('devuelve plazos de presentacion', async () => {
    const res = mockRes();
    await ensController.getDeadlines(mockReq({ user: operadorUser }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

// ==================== addDocument ====================

describe('addDocument', () => {
  test('agrega documento a la ENS', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.addDocument(mockReq({
      user: operadorUser, params: { id: d._id.toString() },
      body: { type: 'INVOICE', documentNumber: 'FAC-1', name: 'Factura', url: 'http://x/f.pdf' }
    }), res);
    expect(res.body.success).toBe(true);
    const tras = await ENSDeclaration.findById(d._id);
    expect(tras.documents.length).toBeGreaterThanOrEqual(1);
  });

  test('inexistente -> 404', async () => {
    const res = mockRes();
    await ensController.addDocument(mockReq({
      user: operadorUser, params: { id: new mongoose.Types.ObjectId().toString() }, body: {}
    }), res);
    expect(res.statusCode).toBe(404);
  });
});

// ==================== getXML ====================

describe('getXML', () => {
  test('XML no disponible aun -> 404', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.getXML(mockReq({ user: operadorUser, params: { id: d._id.toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('devuelve el XML si esta generado', async () => {
    const d = await sembrarENS(operadorUser);
    d.generatedXML = '<ENS/>';
    await d.save();
    const res = mockRes();
    await ensController.getXML(mockReq({ user: operadorUser, params: { id: d._id.toString() } }), res);
    expect(res.send).toHaveBeenCalledWith('<ENS/>');
    expect(res.type).toHaveBeenCalledWith('application/xml');
  });
});

// ==================== endpoints IA ====================

describe('aiAnalyzeExpedition', () => {
  async function crearExpediente(tenantId) {
    return Expedition.create({
      tenantId, operationType: 'import', transportMode: 'maritime',
      client: { companyName: 'ACME', nif: 'B12345678' }
    });
  }

  test('sin expeditionId -> 400', async () => {
    const res = mockRes();
    await ensController.aiAnalyzeExpedition(mockReq({ user: operadorUser, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('expediente de otro tenant -> 404 (guard)', async () => {
    const exp = await crearExpediente(TENANT_B);
    const res = mockRes();
    await ensController.aiAnalyzeExpedition(mockReq({
      user: operadorUser, body: { expeditionId: exp._id.toString() }
    }), res);
    expect(res.statusCode).toBe(404);
    expect(aiService.analyzeENSData).not.toHaveBeenCalled();
  });

  test('expediente propio -> delega en IA', async () => {
    const exp = await crearExpediente(TENANT_A);
    aiService.analyzeENSData.mockResolvedValue({ suggested: true });
    const res = mockRes();
    await ensController.aiAnalyzeExpedition(mockReq({
      user: operadorUser, body: { expeditionId: exp._id.toString() }
    }), res);
    expect(res.body.success).toBe(true);
    expect(aiService.analyzeENSData).toHaveBeenCalled();
  });
});

describe('aiValidate', () => {
  test('sin ensData -> 400', async () => {
    const res = mockRes();
    await ensController.aiValidate(mockReq({ user: operadorUser, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('con ensData -> delega en IA', async () => {
    aiService.validateENSBeforeSubmit.mockResolvedValue({ overallScore: 90, suggestions: [] });
    const res = mockRes();
    await ensController.aiValidate(mockReq({ user: operadorUser, body: { ensData: datosENS() } }), res);
    expect(res.body.success).toBe(true);
    expect(aiService.validateENSBeforeSubmit).toHaveBeenCalled();
  });
});

describe('aiPredictRejection', () => {
  test('sin ensId ni ensData -> 400', async () => {
    const res = mockRes();
    await ensController.aiPredictRejection(mockReq({ user: operadorUser, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('con ensData directo -> predice y agrega historico del carrier', async () => {
    aiService.predictENSRejection.mockResolvedValue({ rejectionProbability: 10, recommendations: [] });
    const res = mockRes();
    await ensController.aiPredictRejection(mockReq({
      user: operadorUser,
      body: { ensData: { carrier: { eori: 'ESB12345678' } } }
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.historicalData).toBeDefined();
    expect(aiService.predictENSRejection).toHaveBeenCalled();
  });

  test('con ensId de otro tenant -> 404 (guard)', async () => {
    const d = await sembrarENS(otroTenantUser);
    const res = mockRes();
    await ensController.aiPredictRejection(mockReq({
      user: operadorUser, body: { ensId: d._id.toString() }
    }), res);
    expect(res.statusCode).toBe(404);
  });
});

describe('aiGetSuggestions', () => {
  test('combina validacion y prediccion de la ENS propia', async () => {
    const d = await sembrarENS(operadorUser);
    aiService.validateENSBeforeSubmit.mockResolvedValue({ overallScore: 80, suggestions: ['a'] });
    aiService.predictENSRejection.mockResolvedValue({ rejectionProbability: 20, recommendations: ['b'] });
    const res = mockRes();
    await ensController.aiGetSuggestions(mockReq({
      user: operadorUser, params: { id: d._id.toString() }
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.combinedRecommendations).toEqual(expect.arrayContaining(['a', 'b']));
    expect(res.body.data.overallReadiness).toBe(80); // round((80 + 80)/2)
  });

  test('ENS de otro tenant -> 404 (guard)', async () => {
    const d = await sembrarENS(otroTenantUser);
    const res = mockRes();
    await ensController.aiGetSuggestions(mockReq({
      user: operadorUser, params: { id: d._id.toString() }
    }), res);
    expect(res.statusCode).toBe(404);
  });
});

// ==================== amend (IE313 via aeatSubmitService) ====================
// exports.amend implementa la rectificacion via IE313 (aeatSubmitService).
// Nota historica: hubo un segundo exports.amend duplicado (delegaba en
// ensService.amendDeclaration) que este sobrescribia al cargar el modulo; era
// codigo muerto y se elimino (fix 6/Ago, ver SECURITY_AUDIT.md).

describe('amend (IE313)', () => {
  test('sin MRN -> 400', async () => {
    const d = await sembrarENS(operadorUser); // draft, sin MRN
    const res = mockRes();
    await ensController.amend(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { reason: 'x' }
    }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/MRN/i);
  });

  test('con MRN y AEAT ok -> marca amended', async () => {
    const d = await sembrarENS(operadorUser);
    d.mrn = '25ES0028011234567X';
    await d.save();
    aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y' });
    const res = mockRes();
    await ensController.amend(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { reason: 'correccion' }
    }), res);
    expect(res.body.success).toBe(true);
    const tras = await ENSDeclaration.findById(d._id);
    expect(tras.status).toBe('amended');
    // amendmentMRN/amendedAt NO estaban declarados en el schema (subdoc estricto
    // los descartaba) -> la referencia AEAT de la enmienda se perdia. Fix en el modelo.
    expect(tras.amendmentMRN).toBe('25ES0028019999999Y');
    expect(tras.amendedAt).toBeInstanceOf(Date);
  });

  test('ENS de otro tenant -> 404 (guard)', async () => {
    const d = await sembrarENS(otroTenantUser);
    d.mrn = '25ES0028011234567X';
    await d.save();
    const res = mockRes();
    await ensController.amend(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: {}
    }), res);
    expect(res.statusCode).toBe(404);
  });
});
