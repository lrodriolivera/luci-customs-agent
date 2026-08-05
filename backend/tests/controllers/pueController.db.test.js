/**
 * pueController + pueService + modelo PUERequest, contra Mongo real en memoria.
 *
 * PUE es el control SOIVRE en el Punto Unico de Entrada (ROHS/COM/ECO/CAL): la
 * logica que decide que solicitud se crea, se actualiza, se cancela o pasa a
 * inspeccion. Se ejercita de verdad contra la BD efimera; el modelo PUERequest
 * NO se mockea (ahi vive el valor: enums, pre-save que genera la referencia,
 * ciclo de estados y el aislamiento por tenant/propiedad).
 *
 * Se mockean SOLO las dependencias externas: aiService (Bedrock), pueGenerator
 * (generacion XML, ya cubierta aparte) y aeatSubmitService (envio a AEAT, red).
 * Los helpers puros de pueService (catalogos, preValidate, checkTaric) ya estan
 * cubiertos en tests/services/pueService.test.js: aqui NO se repiten, se cubre
 * el ciclo de vida contra BD y los handlers del controller.
 *
 * BD en memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitPUE: jest.fn()
}));
jest.mock('../../src/services/forms/pueGenerator', () => ({
  generate: jest.fn(() => '<PUE><mock/></PUE>')
}));
jest.mock('../../src/services/aiService', () => ({
  determinePUEType: jest.fn(),
  analyzeGoodsForPUE: jest.fn(),
  predictInspectionOutcome: jest.fn(),
  suggestPUEDocuments: jest.fn(),
  generatePUERecommendations: jest.fn()
}));

const { PUERequest, Expedition } = require('../../src/models');
const User = require('../../src/models/User'); // para populate('createdBy')
const aiService = require('../../src/services/aiService');
const pueGenerator = require('../../src/services/forms/pueGenerator');
const ctrl = require('../../src/controllers/pueController');

usarBaseDeDatosEnMemoria();

// resetMocks:true borra las implementaciones de fabrica antes de cada test.
beforeEach(() => {
  pueGenerator.generate.mockReturnValue('<PUE><mock/></PUE>');
});

let contadorUsuarios = 0;

// Persiste un User real para que populate('createdBy') lo resuelva. Devuelve el
// objeto tal cual lo espera el controller (req.user), con _id/tenantId/role.
async function usuario({ tenant, role = 'agent' } = {}) {
  contadorUsuarios += 1;
  const tenantId = tenant || new mongoose.Types.ObjectId();
  const user = await User.create({
    name: `Operario ${contadorUsuarios}`,
    email: `op${contadorUsuarios}@ejemplo.es`,
    password: 'Password123!',
    role,
    tenantId
  });
  return { _id: user._id, tenantId, role, name: user.name, email: user.email };
}

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = () => res;
  res.send = (b) => { res.body = b; return res; };
  return res;
}

// Solicitud PUE valida minima. createdBy/tenantId se pasan aparte para ejercer
// el aislamiento. El pre-save genera `reference` solo.
async function crearSolicitud({ user, pueType = 'ROHS', status = 'draft', extra = {} } = {}) {
  const u = user || await usuario();
  return PUERequest.create({
    pueType,
    operator: { name: 'Importadora SL', role: 'importer', eori: 'ESB12345678' },
    goods: [{ sequenceNumber: 1, description: 'Aparato electrico', taricCode: '85171200' }],
    createdBy: u._id,
    tenantId: u.tenantId,
    status,
    ...extra
  });
}

describe('create', () => {
  test('crea la solicitud tomando el tenant del usuario (no del body) y devuelve 201', async () => {
    const user = await usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        pueType: 'ROHS',
        tenantId: new mongoose.Types.ObjectId(), // debe ignorarse
        operator: { name: 'Nueva SL', role: 'importer' },
        goods: [{ sequenceNumber: 1, description: 'TV', taricCode: '85287200' }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    const guardada = await PUERequest.findById(res.body.data._id);
    // el tenant es el del usuario, no el del body
    expect(String(guardada.tenantId)).toBe(String(user.tenantId));
    expect(guardada.createdBy.toString()).toBe(user._id.toString());
    // el pre-save genero la referencia
    expect(guardada.reference).toMatch(/^PUE-ROHS-/);
    expect(guardada.status).toBe('draft');
  });

  test('datos invalidos (sin operador ni mercancias) devuelven 400 sin crear nada', async () => {
    const user = await usuario();
    const res = crearRes();

    await ctrl.create({ body: { pueType: 'ROHS' }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(await PUERequest.countDocuments()).toBe(0);
  });

  test('un pueType inexistente se rechaza con 400', async () => {
    const user = await usuario();
    const res = crearRes();

    await ctrl.create({
      body: { pueType: 'XXX', operator: { name: 'X' }, goods: [{ taricCode: '85171200' }] },
      user
    }, res);

    expect(res.statusCode).toBe(400);
  });
});

describe('getById', () => {
  test('devuelve la solicitud del propio usuario', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.getById({ params: { id: sol._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data._id.toString()).toBe(sol._id.toString());
  });

  test('404 si la solicitud no existe', async () => {
    const res = crearRes();
    await ctrl.getById({ params: { id: new mongoose.Types.ObjectId() }, user: await usuario() }, res);
    expect(res.statusCode).toBe(404);
  });

  // Regresion de aislamiento: getById delegaba en un findById plano sin acotar
  // por tenant, de modo que cualquier usuario autenticado podia leer la
  // solicitud PUE de otro tenant conociendo su id (NIF/EORI del operador, datos
  // de mercancia). Corregido con ensureSameTenant. Ver SECURITY_AUDIT.md.
  test('404 al pedir por id una solicitud de OTRO tenant (no fuga entre tenants)', async () => {
    const dueno = await usuario();
    const sol = await crearSolicitud({ user: dueno });
    const res = crearRes();

    await ctrl.getById({ params: { id: sol._id }, user: await usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.data).toBeUndefined();
  });
});

describe('list: filtro por propiedad y por tenant del handler', () => {
  test('un operador solo ve sus propias solicitudes (filtro createdBy)', async () => {
    const op = await usuario();
    const otro = await usuario();
    await crearSolicitud({ user: op });
    await crearSolicitud({ user: otro });

    const res = crearRes();
    await ctrl.list({ user: op, query: {} }, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].createdBy._id.toString()).toBe(op._id.toString());
  });

  test('el admin ve todas y el filtro por pueType funciona', async () => {
    const admin = await usuario({ role: 'admin' });
    const op = await usuario();
    await crearSolicitud({ user: op, pueType: 'ROHS' });
    await crearSolicitud({ user: op, pueType: 'CAL', extra: { goods: [{ sequenceNumber: 1, description: 'Textil', taricCode: '62011100' }] } });

    const res = crearRes();
    await ctrl.list({ user: admin, query: { pueType: 'CAL' } }, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].pueType).toBe('CAL');
  });
});

describe('update', () => {
  test('actualiza campos permitidos de una solicitud en draft', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.update({
      params: { id: sol._id },
      body: { priority: 'urgent', declarationMRN: '25ES00280012345678' },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await PUERequest.findById(sol._id);
    expect(guardada.priority).toBe('urgent');
    expect(guardada.declarationMRN).toBe('25ES00280012345678');
  });

  test('no se puede actualizar una solicitud que ya no esta en draft/pending_documents (400)', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user, status: 'approved' });
    const res = crearRes();

    await ctrl.update({ params: { id: sol._id }, body: { priority: 'urgent' }, user }, res);

    expect(res.statusCode).toBe(400);
  });

  test('un usuario distinto del creador no puede actualizarla (guard de propiedad del servicio → 404)', async () => {
    const dueno = await usuario();
    const sol = await crearSolicitud({ user: dueno });
    const res = crearRes();

    await ctrl.update({ params: { id: sol._id }, body: { priority: 'urgent' }, user: await usuario() }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('cancel', () => {
  test('cancela una solicitud en draft y deja el motivo en el historial', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.cancel({ params: { id: sol._id }, body: { reason: 'Error en los datos' }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await PUERequest.findById(sol._id);
    expect(guardada.status).toBe('cancelled');
    expect(guardada.statusHistory.some(h => h.reason === 'Error en los datos')).toBe(true);
  });

  test('400 si no se da motivo', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.cancel({ params: { id: sol._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(400);
  });

  test('no se puede cancelar una solicitud ya aprobada (400)', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user, status: 'approved' });
    const res = crearRes();

    await ctrl.cancel({ params: { id: sol._id }, body: { reason: 'x' }, user }, res);

    expect(res.statusCode).toBe(400);
  });
});

describe('scheduleInspection / recordInspectionResult', () => {
  test('programa inspeccion y luego registra un resultado favorable', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user, status: 'pending_inspection' });

    const res1 = crearRes();
    await ctrl.scheduleInspection({
      params: { id: sol._id },
      body: { date: '2026-09-01', time: '10:00', location: 'Puerto de Valencia', type: 'documental', inspector: 'Inspector 1' },
      user
    }, res1);
    expect(res1.statusCode).toBe(200);

    let guardada = await PUERequest.findById(sol._id);
    expect(guardada.status).toBe('inspection_scheduled');
    expect(guardada.inspection.scheduled).toBe(true);
    expect(guardada.inspection.type).toBe('documental');

    const res2 = crearRes();
    await ctrl.recordInspectionResult({
      params: { id: sol._id },
      body: { result: 'favorable', notes: 'Todo correcto', reportNumber: 'RPT-1' },
      user
    }, res2);
    expect(res2.statusCode).toBe(200);

    guardada = await PUERequest.findById(sol._id);
    expect(guardada.inspection.result).toBe('favorable');
    expect(guardada.inspection.reportNumber).toBe('RPT-1');
  });
});

describe('issueCertificate', () => {
  test('emite certificado para una solicitud aprobada', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user, status: 'approved' });
    const res = crearRes();

    await ctrl.issueCertificate({
      params: { id: sol._id },
      body: { officer: 'Funcionario SOIVRE' },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await PUERequest.findById(sol._id);
    expect(guardada.issuedCertificate.number).toMatch(/^CERT-ROHS-/);
    expect(guardada.issuedCertificate.status).toBe('active');
  });

  test('no emite certificado si la solicitud no esta aprobada (400)', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user, status: 'draft' });
    const res = crearRes();

    await ctrl.issueCertificate({ params: { id: sol._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(400);
  });
});

describe('addDocument', () => {
  test('agrega un documento a la solicitud', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.addDocument({
      params: { id: sol._id },
      body: { type: 'CERTIFICATE_ROHS', name: 'Certificado ROHS', url: 'https://x/doc.pdf' },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await PUERequest.findById(sol._id);
    expect(guardada.attachedDocuments.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getByExpedition / getByDeclaration', () => {
  test('getByExpedition devuelve las solicitudes de una expedicion', async () => {
    const user = await usuario();
    const exp = await Expedition.create({
      tenantId: user.tenantId, createdBy: user._id, operationType: 'import',
      transportMode: 'maritime', client: { companyName: 'C', nif: 'B1' }, status: 'draft'
    });
    await crearSolicitud({ user, extra: { expedition: exp._id } });

    const res = crearRes();
    await ctrl.getByExpedition({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('getByDeclaration devuelve las solicitudes de un MRN', async () => {
    const user = await usuario();
    const mrn = '25ES00280099999999';
    await crearSolicitud({ user, extra: { declarationMRN: mrn } });

    const res = crearRes();
    await ctrl.getByDeclaration({ params: { mrn }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].declarationMRN).toBe(mrn);
  });
});

describe('linkToDeclaration: guard de tenant sobre el modelo real', () => {
  test('vincula un MRN a la solicitud del propio tenant', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.linkToDeclaration({
      params: { id: sol._id },
      body: { mrn: '25ES00280012345678' },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await PUERequest.findById(sol._id);
    expect(guardada.declarationMRN).toBe('25ES00280012345678');
  });

  test('400 si no se pasa MRN', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.linkToDeclaration({ params: { id: sol._id }, body: {}, user }, res);
    expect(res.statusCode).toBe(400);
  });

  test('404 al vincular sobre una solicitud de OTRO tenant', async () => {
    const dueno = await usuario();
    const sol = await crearSolicitud({ user: dueno });
    const res = crearRes();

    await ctrl.linkToDeclaration({
      params: { id: sol._id },
      body: { mrn: '25ES00280012345678' },
      user: await usuario() // otro tenant
    }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('getXML: genera y sirve el XML de la solicitud del propio tenant', () => {
  test('devuelve el XML generado (content-type xml)', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    const res = crearRes();

    await ctrl.getXML({ params: { id: sol._id }, query: {}, user }, res);

    expect(res.body).toBe('<PUE><mock/></PUE>');
    expect(pueGenerator.generate).toHaveBeenCalled();
  });

  test('404 sobre solicitud de otro tenant', async () => {
    const dueno = await usuario();
    const sol = await crearSolicitud({ user: dueno });
    const res = crearRes();

    await ctrl.getXML({ params: { id: sol._id }, query: {}, user: await usuario() }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('endpoints IA (delegadores con guard de tenant)', () => {
  test('aiFullAnalysis combina las 3 llamadas IA y calcula el overallScore', async () => {
    const user = await usuario();
    const sol = await crearSolicitud({ user });
    aiService.predictInspectionOutcome.mockResolvedValue({ predictions: { approved: 80 }, riskFactors: [] });
    aiService.suggestPUEDocuments.mockResolvedValue({ completenessScore: 90, requiredDocuments: [] });
    aiService.generatePUERecommendations.mockResolvedValue({ overallReadiness: 70, checklist: [] });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ params: { id: sol._id }, body: {}, user }, res);

    expect(res.statusCode).toBe(200);
    // 80*0.4 + 90*0.3 + 70*0.3 = 32 + 27 + 21 = 80
    expect(res.body.data.summary.overallScore).toBe(80);
    expect(res.body.data.summary.readyForSubmission).toBe(true);
  });

  test('aiFullAnalysis sobre solicitud de otro tenant → 404 sin llamar a la IA', async () => {
    const dueno = await usuario();
    const sol = await crearSolicitud({ user: dueno });
    const res = crearRes();

    await ctrl.aiFullAnalysis({ params: { id: sol._id }, body: {}, user: await usuario() }, res);

    expect(res.statusCode).toBe(404);
    expect(aiService.predictInspectionOutcome).not.toHaveBeenCalled();
  });

  test('aiDetermineType exige array de mercancias (400)', async () => {
    const res = crearRes();
    await ctrl.aiDetermineType({ body: {}, user: await usuario() }, res);
    expect(res.statusCode).toBe(400);
  });

  test('aiAnalyzeGoods exige descripcion (400)', async () => {
    const res = crearRes();
    await ctrl.aiAnalyzeGoods({ body: {}, user: await usuario() }, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('handlers puros de catalogos (contra el servicio real)', () => {
  test('getTypes devuelve los 4 tipos', async () => {
    const res = crearRes();
    await ctrl.getTypes({ query: {} }, res);
    expect(res.body.data).toHaveLength(4);
  });

  test('getRequiredDocuments 404 para tipo inexistente', async () => {
    const res = crearRes();
    await ctrl.getRequiredDocuments({ params: { type: 'XXX' } }, res);
    expect(res.statusCode).toBe(404);
  });

  test('checkTaric exige array (400)', async () => {
    const res = crearRes();
    await ctrl.checkTaric({ body: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  test('getRequiredControls exige array de goods (400)', async () => {
    const res = crearRes();
    await ctrl.getRequiredControls({ body: {} }, res);
    expect(res.statusCode).toBe(400);
  });
});
