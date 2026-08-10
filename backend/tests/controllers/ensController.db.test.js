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

  // El filtro Desde/Hasta de la UI se lee junto a la unica fecha que muestra la tabla,
  // "Llegada Prevista", pero filtraba por createdAt: buscar noviembre/2026 descartaba
  // las llegadas de noviembre y devolvia las creadas hoy. Se filtra por la llegada.
  test('el rango de fechas filtra por la llegada prevista, no por createdAt', async () => {
    const enRango = await sembrarENS(operadorUser, {
      entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: new Date('2026-11-15T10:00:00Z') }
    });
    await sembrarENS(operadorUser, {
      entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: new Date('2026-12-20T10:00:00Z') }
    });

    const res = mockRes();
    await ensController.list(mockReq({
      user: operadorUser,
      query: { startDate: '2026-11-01', endDate: '2026-11-30' }
    }), res);

    expect(res.body.data.map(d => d.reference)).toEqual([enRango.reference]);
  });

  // new Date('2026-11-30') es medianoche: con $lte se perdia todo el dia 30.
  test('el dia final del rango entra completo', async () => {
    const ultimoDia = await sembrarENS(operadorUser, {
      entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: new Date('2026-11-30T23:30:00Z') }
    });

    const res = mockRes();
    await ensController.list(mockReq({
      user: operadorUser,
      query: { startDate: '2026-11-01', endDate: '2026-11-30' }
    }), res);

    expect(res.body.data.map(d => d.reference)).toContain(ultimoDia.reference);
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
  // Solo RAIL va por el canal legacy AEAT (aeatSubmitService); SEA/AIR/ROAD se
  // enrutan a ICS2 — ese camino se cubre en tests/services/ensService.test.js.
  const sembrarRAIL = () => sembrarENS(operadorUser, {
    transportMode: 'RAIL',
    transportMeans: { identification: 'TREN-9001', identificationType: 'TRAIN_NUMBER', modeAtBorder: '2' }
  });

  test('envio aceptado por AEAT -> declaracion aceptada', async () => {
    const d = await sembrarRAIL();
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
    const d = await sembrarRAIL();
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

  // El envio es REAL contra AEAT (PRE o produccion segun AEAT_ENVIRONMENT) y devuelve
  // un MRN autentico: rotular el mensaje como [DEMO] hace creer al usuario que se ha
  // simulado. Mismo engano ya corregido en el envio de H1 (f0af0ab).
  test('el mensaje de exito no dice DEMO: el envio a AEAT es real', async () => {
    const d = await sembrarRAIL();
    aeatSubmitService.submitENS.mockResolvedValue({
      success: true, accepted: true, mrn: '25ES0028011234567X', xml: '<xml/>'
    });
    const res = mockRes();
    await ensController.submit(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: {}
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.message).not.toMatch(/DEMO|simula/i);
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

  /**
   * Un `type` fuera del enum hacia estallar el save() y el catch generico
   * respondia 500 "Error al agregar documento": el usuario no podia saber que el
   * tipo era el problema ni cuales se admiten (el enum de este `documents` son
   * etiquetas de fichero adjunto: CMR/BL/AWB/INVOICE/..., no los codigos UCC del
   * `documents` por partida). Un dato de entrada invalido es 400, no 500.
   */
  test('tipo de documento fuera del enum -> 400 nombrando el tipo y los validos', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.addDocument(mockReq({
      user: operadorUser, params: { id: d._id.toString() },
      body: { type: 'N935', documentNumber: 'FAC-1', name: 'Factura' }
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('N935');
    expect(res.body.error).toContain('INVOICE');
    const tras = await ENSDeclaration.findById(d._id);
    expect(tras.documents.length).toBe(0);
  });

  test('sin tipo -> 400 (no se guarda un adjunto sin clasificar)', async () => {
    const d = await sembrarENS(operadorUser);
    const res = mockRes();
    await ensController.addDocument(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { documentNumber: 'FAC-1' }
    }), res);
    expect(res.statusCode).toBe(400);
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

  /**
   * Las 8 ENS presentadas antes del fix de submitToAEAT tienen en `generatedXML`
   * la nota de log 'Enviado via aeatSubmitService' (29 bytes), no un XML: el
   * endpoint la servia con Content-Type application/xml y el usuario se
   * descargaba un ENS_xxx.xml con una frase dentro, creyendo tener la prueba de
   * lo declarado. Ese XML no se guardo y no se puede recuperar; hay que decirlo,
   * no entregar la nota disfrazada de declaracion.
   */
  test('no sirve como XML una nota de log que no es XML', async () => {
    const d = await sembrarENS(operadorUser);
    d.generatedXML = 'Enviado via aeatSubmitService';
    await d.save();
    const res = mockRes();

    await ensController.getXML(mockReq({ user: operadorUser, params: { id: d._id.toString() } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.send).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/no se conserv|no disponible/i);
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

  /**
   * Comprobado contra AEAT PRE (8/Ago/2026): la rectificacion se rechazo con
   * CD917B y el endpoint respondio HTTP 200 con `success: true`. El envoltorio
   * afirmaba exito sobre un rechazo de la aduana; solo mirando dentro de `data`
   * aparecia `success: false`. Ningun cliente que compruebe el envoltorio (la UI
   * lo hace, api.js devuelve response.data) podia detectar el fallo.
   */
  /**
   * El controlador leia `declaration.goodsItems`, campo que el esquema no tiene
   * (las partidas viven en `goods`). Siempre resolvia a [] y la rectificacion
   * viajaba a AEAT sin partidas y con TotGroMasHEA307=0 / TotNumOfPacHEA306=0:
   * una rectificacion que declara peso bruto y bultos cero. Confirmado en el
   * requestXML del envio real a PRE del 8/Ago/2026.
   *
   * Segundo desajuste en el mismo mapeo: el esquema nombra los campos
   * `grossMass` y `kindOfPackages`, y el controlador leia `grossWeight` y
   * `packageType`; aun leyendo el array correcto, el peso habria salido a 0.
   */
  test('rectifica con las partidas de la ENS (`goods`), no con una lista vacia', async () => {
    const d = await sembrarENS(operadorUser);
    d.mrn = '25ES0028011234567X';
    d.goods = [{
      sequenceNumber: 1,
      description: 'Componentes electronicos',
      commodityCode: '85437000',
      grossMass: 850,
      numberOfPackages: 12,
      kindOfPackages: 'PK'
    }];
    await d.save();
    aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y' });
    const res = mockRes();
    await ensController.amend(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { reason: 'correccion peso' }
    }), res);

    expect(res.body.success).toBe(true);
    const enviado = aeatSubmitService.submitENSAmendment.mock.calls.at(-1)[0];
    expect(enviado.goodsItems).toHaveLength(1);
    expect(enviado.goodsItems[0]).toMatchObject({
      sequenceNumber: 1, grossWeight: 850, numberOfPackages: 12, commodityCode: '85437000', packageType: 'PK'
    });
  });

  test('AEAT rechaza la rectificacion -> 400 y NO se marca amended', async () => {
    const d = await sembrarENS(operadorUser);
    d.mrn = '25ES0028011234567X';
    await d.save();
    aeatSubmitService.submitENSAmendment.mockResolvedValue({
      success: false, code: 'CD917B', error: 'CC313A: Invalid NameSpace', rawResponse: '<CD917B/>'
    });
    const res = mockRes();
    await ensController.amend(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: { reason: 'correccion' }
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid NameSpace/);
    const tras = await ENSDeclaration.findById(d._id);
    expect(tras.status).not.toBe('amended');
  });

  // Un CD917B (error de formato XML) no trae DescripcionError: el motivo esta en
  // XMLERR805. Sin mensaje, el usuario recibia un 400 vacio.
  test('rechazo sin texto de error -> mensaje con el codigo AEAT, nunca vacio', async () => {
    const d = await sembrarENS(operadorUser);
    d.mrn = '25ES0028011234567X';
    await d.save();
    aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: false, code: 'CD917B', error: null });
    const res = mockRes();
    await ensController.amend(mockReq({
      user: operadorUser, params: { id: d._id.toString() }, body: {}
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(res.body.error).toContain('CD917B');
  });

  /**
   * Verificado contra AEAT PRE (10/Ago/2026). `req.body.changes` se ignoraba por
   * completo: LUCI presentaba a la aduana los datos SIN rectificar, AEAT aceptaba
   * una "rectificacion" identica a la original (de hecho la rechazaba con "The data
   * of the ENS declaration is identical to the previous presentation") y la ENS
   * quedaba marcada 'amended' con el peso y los bultos viejos. Es decir, se
   * acreditaba una rectificacion que nunca se pidio a la aduana.
   */
  describe('aplicacion de los cambios pedidos', () => {
    async function ensConPartida() {
      const d = await sembrarENS(operadorUser);
      d.mrn = '25ES0028011234567X';
      d.goods = [{
        sequenceNumber: 1,
        description: 'Componentes electronicos',
        commodityCode: '85437000',
        grossMass: 850,
        numberOfPackages: 12,
        kindOfPackages: 'PK'
      }];
      await d.save();
      return d;
    }

    test('los cambios pedidos son los que se declaran a la aduana', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y' });
      const res = mockRes();
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        body: {
          reason: 'Correccion de peso tras pesaje',
          changes: { goods: [{ sequenceNumber: 1, description: 'Componentes electronicos', commodityCode: '85437000', grossMass: 910, numberOfPackages: 14, kindOfPackages: 'PK' }] }
        }
      }), res);

      expect(res.body.success).toBe(true);
      const enviado = aeatSubmitService.submitENSAmendment.mock.calls.at(-1)[0];
      expect(enviado.goodsItems[0]).toMatchObject({ grossWeight: 910, numberOfPackages: 14 });
      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.goods[0].grossMass).toBe(910);
      expect(tras.goods[0].numberOfPackages).toBe(14);
    });

    // Los totales de la expedicion son la suma de las partidas y es lo que declara
    // el CC313A (TotGroMasHEA307/TotNumOfPacHEA306). Sin recalcularlos, la ficha
    // mostraba el peso ANTERIOR mientras a la aduana ya se le habia declarado el nuevo.
    test('recalcula los totales de la expedicion desde las partidas rectificadas', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y' });
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        body: { changes: { goods: [{ sequenceNumber: 1, description: 'X', commodityCode: '85437000', grossMass: 910, numberOfPackages: 14, kindOfPackages: 'PK' }] } }
      }), mockRes());

      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.consignment.grossMass).toBe(910);
      expect(tras.consignment.numberOfPackages).toBe(14);
    });

    // Un subdocumento se fusiona: rectificar el peso no debe borrar el resto de la
    // expedicion (la referencia del B/L, el pais de destino...).
    test('rectificar un campo de la expedicion no borra los demas', async () => {
      const d = await ensConPartida();
      const destinoOriginal = d.consignment.countryOfDestination;
      aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y' });
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        body: { changes: { consignment: { referenceNumber: 'BL-NUEVO-123' } } }
      }), mockRes());

      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.consignment.referenceNumber).toBe('BL-NUEVO-123');
      expect(tras.consignment.countryOfDestination).toBe(destinoOriginal);
    });

    // El MRN identifica la sumaria que se rectifica: no es rectificable via IE313.
    test('un campo no rectificable se rechaza SIN llamar a la aduana', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockClear();
      const res = mockRes();
      await ensController.amend(mockReq({
        user: operadorUser, params: { id: d._id.toString() }, body: { changes: { mrn: 'FALSO', status: 'accepted' } }
      }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/no rectificables/i);
      expect(res.body.error).toMatch(/mrn/);
      expect(aeatSubmitService.submitENSAmendment).not.toHaveBeenCalled();
    });

    /**
     * Mongoose NO lanza cuando no puede castear: descarta el valor en silencio
     * (comprobado con el modelo real — `goods: 'texto'` deja el array en [] y
     * `grossMass: 'mucho'` deja la partida sin peso, sin error alguno). Si no se
     * compara lo aplicado con lo pedido, se presenta a la aduana una rectificacion
     * DISTINTA de la pedida y se acredita como si fuera la pedida.
     */
    test('un peso no numerico se descarta en silencio -> 400, nada llega a la aduana', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockClear();
      const res = mockRes();
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        body: { changes: { goods: [{ sequenceNumber: 1, description: 'X', commodityCode: '85437000', grossMass: 'mil quinientos', numberOfPackages: 12, kindOfPackages: 'PK' }] } }
      }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/no se han podido aplicar/i);
      expect(res.body.error).toMatch(/grossMass/);
      expect(aeatSubmitService.submitENSAmendment).not.toHaveBeenCalled();
      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.goods[0].grossMass).toBe(850);
    });

    // El caso mas grave: `goods` con un valor que no es una lista de partidas deja
    // el array VACIO, y la rectificacion habria viajado sin partidas y con totales a 0.
    test('unas partidas que Mongoose no puede castear -> 400, no una ENS sin partidas', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockClear();
      const res = mockRes();
      await ensController.amend(mockReq({
        user: operadorUser, params: { id: d._id.toString() }, body: { changes: { goods: 'una caja de tornillos' } }
      }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/no se han podido aplicar/i);
      expect(aeatSubmitService.submitENSAmendment).not.toHaveBeenCalled();
      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.goods).toHaveLength(1);
    });

    // Pedir el peso como texto numerico es legitimo (viene de un formulario): lo que
    // importa es que el valor casteado sea el pedido.
    test('un peso enviado como texto numerico se acepta', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y' });
      const res = mockRes();
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        body: { changes: { goods: [{ sequenceNumber: 1, description: 'X', commodityCode: '85437000', grossMass: '910', numberOfPackages: '14', kindOfPackages: 'PK' }] } }
      }), res);

      expect(res.body.success).toBe(true);
      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.goods[0].grossMass).toBe(910);
    });

    // Una rectificacion que deja la ENS invalida no se presenta.
    test('si los cambios dejan la ENS invalida no se envia nada a la aduana', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockClear();
      const res = mockRes();
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        // La aduana de entrada es obligatoria y su codigo tiene formato: vaciarlo
        // deja la ENS impresentable.
        body: { changes: { entryOffice: { code: '' } } }
      }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/invalida/i);
      expect(aeatSubmitService.submitENSAmendment).not.toHaveBeenCalled();
    });

    // Si la aduana no acepta, lo declarado sigue siendo lo anterior: persistir los
    // cambios dejaria la BD diciendo una cosa y AEAT otra.
    test('rechazo de AEAT -> los cambios NO se persisten', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockResolvedValue({
        success: false, code: 'CC305A', error: 'ITI.ITI: R879'
      });
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        body: { changes: { goods: [{ sequenceNumber: 1, description: 'X', commodityCode: '85437000', grossMass: 910, numberOfPackages: 14, kindOfPackages: 'PK' }] } }
      }), mockRes());

      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.goods[0].grossMass).toBe(850);
      expect(tras.goods[0].numberOfPackages).toBe(12);
      expect(tras.amendments).toHaveLength(0);
    });

    /**
     * El CC304A y su CSV son el justificante de lo presentado; sin el historial solo
     * quedaba una fecha, sin forma de saber QUE se rectifico ni de acreditarlo. El
     * array `amendments` tampoco existia en el esquema: el modo estricto lo descartaba
     * en silencio. Verificado contra PRE: CC304A + CSV 6JVUKW5XMGC28W3A.
     */
    test('la rectificacion aceptada se acredita con el codigo AEAT, el CSV y el XML', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockResolvedValue({
        success: true, mrn: '25ES0028019999999Y', code: 'CC304A',
        csv: '6JVUKW5XMGC28W3A', requestXML: '<CC313A/>'
      });
      await ensController.amend(mockReq({
        user: operadorUser,
        params: { id: d._id.toString() },
        body: { reason: 'Correccion de peso tras pesaje', changes: { goods: [{ sequenceNumber: 1, description: 'X', commodityCode: '85437000', grossMass: 910, numberOfPackages: 14, kindOfPackages: 'PK' }] } }
      }), mockRes());

      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.amendments).toHaveLength(1);
      expect(tras.amendments[0]).toMatchObject({
        reason: 'Correccion de peso tras pesaje',
        aeatCode: 'CC304A',
        csv: '6JVUKW5XMGC28W3A',
        requestXML: '<CC313A/>'
      });
      expect(tras.amendments[0].changes.goods[0].grossMass).toBe(910);
      expect(tras.amendments[0].submittedAt).toBeInstanceOf(Date);
    });

    // Cada rectificacion se acumula: la segunda no puede pisar la primera, o se
    // pierde la constancia de lo presentado en aquella.
    test('varias rectificaciones se acumulan en el historial', async () => {
      const d = await ensConPartida();
      aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y', code: 'CC304A', csv: 'AAA' });
      const pedir = (peso) => ensController.amend(mockReq({
        user: operadorUser, params: { id: d._id.toString() },
        body: { reason: `peso ${peso}`, changes: { goods: [{ sequenceNumber: 1, description: 'X', commodityCode: '85437000', grossMass: peso, numberOfPackages: 12, kindOfPackages: 'PK' }] } }
      }), mockRes());

      await pedir(910);
      await pedir(925);

      const tras = await ENSDeclaration.findById(d._id);
      expect(tras.amendments).toHaveLength(2);
      expect(tras.amendments.map(a => a.reason)).toEqual(['peso 910', 'peso 925']);
    });

    // El motivo es metadato de LUCI: el CC313A no tiene campo para el. Lo que se
    // declara en AmdPlaHEA598 es el LUGAR de la rectificacion (an..35), y meter ahi
    // el texto del usuario hacia que AEAT rechazase por longitud.
    test('a la aduana se le declara el lugar de rectificacion, no el motivo', async () => {
      const d = await ensConPartida();
      d.entryOffice.code = 'ES009999';
      await d.save();
      aeatSubmitService.submitENSAmendment.mockResolvedValue({ success: true, mrn: '25ES0028019999999Y' });
      await ensController.amend(mockReq({
        user: operadorUser, params: { id: d._id.toString() },
        body: { reason: 'Correccion de peso bruto tras pesaje en origen' }
      }), mockRes());

      const enviado = aeatSubmitService.submitENSAmendment.mock.calls.at(-1)[0];
      expect(enviado.amendmentPlace).toBe('ES');
      expect(enviado.amendmentReason).toBeUndefined();
    });
  });
});
