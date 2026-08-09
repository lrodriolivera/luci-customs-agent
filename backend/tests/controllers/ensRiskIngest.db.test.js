/**
 * ensController.ingestRiskMessage — el LLAMANTE que le faltaba a
 * ensService.processRiskResponse().
 *
 * Por que existe: el CC328A solo acusa el registro de la ENS; el circuito
 * (ACK/HOLD/DNL) llega despues en un mensaje aparte. `processRiskResponse` era el
 * unico camino legitimo para escribir `riskAssessment` y no tenia ni un punto de
 * invocacion, asi que el circuito se quedaba en PENDING indefinidamente mientras
 * un bloque [DEMO] se inventaba un ACK (corregido en da7241d).
 *
 * Se descarto el polling con evidencia, no por criterio: ConsultaImportacionV2 con
 * un MRN de ENS devuelve CodigoRespuesta 9 / CodigoError 6020 "No existe
 * importación con la referencia solicitada" en PRE — es el canal de H1 de
 * importacion. Por eso la via es ingerir el mensaje que AEAT deposita.
 *
 * Mongo real en memoria; no se mockea nada del codigo bajo prueba.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const ensController = require('../../src/controllers/ensController');
const ensService = require('../../src/services/ensService');
const { ENSDeclaration } = require('../../src/models');
const User = require('../../src/models/User');

usarBaseDeDatosEnMemoria();

const enHoras = (h) => new Date(Date.now() + h * 60 * 60 * 1000);

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}

const mockReq = ({ user, body = {}, params = {} } = {}) => ({
  user, params, body,
  tenantId: user?.tenantId ? String(user.tenantId) : undefined
});

function datosENS(overrides = {}) {
  return {
    transportMode: 'RAIL',
    entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: enHoras(48) },
    carrier: { eori: 'ESB12345678', name: 'Ferroviaria SL' },
    transportMeans: { identification: 'TREN-001', identificationType: 'TRAIN_NUMBER', modeAtBorder: '2' },
    consignment: {
      referenceNumber: 'CIM-001', referenceType: 'MBL', grossMass: 1000,
      numberOfPackages: 10, goodsDescription: 'Mercancia general', countryOfDispatch: 'CN'
    },
    goods: [{ sequenceNumber: 1, description: 'Camisetas', commodityCode: '610910', grossMass: 500, numberOfPackages: 10 }],
    ...overrides
  };
}

const MRN = '26ES009999Z0000750';

const sobre = (cuerpo) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>${cuerpo}</soapenv:Body></soapenv:Envelope>`;

const mensajeDNL = (mrn = MRN) => sobre(
  `<ie:CC351A xmlns:ie="x"><HEAHEA><DocNumHEA5>${mrn}</DocNumHEA5><RisAnaResHEA1>DNL</RisAnaResHEA1><RisAnaMotHEA2>Verificacion previa a la carga</RisAnaMotHEA2></HEAHEA></ie:CC351A>`
);

const mensajeControl = (mrn = MRN) => sobre(
  `<ie:CC324A xmlns:ie="x"><HEAHEA><DocNumHEA5>${mrn}</DocNumHEA5><RisAnaResHEA1>HOLD</RisAnaResHEA1></HEAHEA>` +
  `<CONDEC><ConCodCONDEC1>A20</ConCodCONDEC1><ConDesCONDEC2>Control documental</ConDesCONDEC2><ConLimDatCONDEC3>20260815</ConLimDatCONDEC3></CONDEC></ie:CC324A>`
);

let admin, operador;

beforeEach(async () => {
  const t = new mongoose.Types.ObjectId();
  admin = await User.create({
    name: 'Admin', email: `admin-${Date.now()}-${Math.round(performance.now())}@a.es`,
    password: 'secret123', role: 'admin', tenantId: t
  });
  operador = await User.create({
    name: 'Op', email: `op-${Date.now()}-${Math.round(performance.now())}@a.es`,
    password: 'secret123', role: 'agent', tenantId: t
  });
});

async function sembrarAceptada(user = operador, mrn = MRN) {
  const r = await ensService.createDeclaration(datosENS(), user._id);
  const doc = await ENSDeclaration.findById(r.data._id);
  doc.status = 'accepted';
  doc.mrn = mrn;
  await doc.save();
  return doc;
}

describe('ingestRiskMessage', () => {

  test('un CC351A pone la declaracion en dnl y registra el motivo', async () => {
    const doc = await sembrarAceptada();
    const res = mockRes();
    await ensController.ingestRiskMessage(mockReq({ user: admin, body: { xml: mensajeDNL() } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const actualizada = await ENSDeclaration.findById(doc._id);
    expect(actualizada.riskAssessment.status).toBe('DNL');
    expect(actualizada.riskAssessment.doNotLoadList).toBe(true);
    expect(actualizada.riskAssessment.dnlReason).toMatch(/Verificacion previa/i);
    expect(actualizada.riskAssessment.assessedAt).toBeInstanceOf(Date);
    expect(actualizada.status).toBe('dnl');
  });

  test('un CC324A deja el riesgo en HOLD con su decision de control y plazo', async () => {
    const doc = await sembrarAceptada();
    const res = mockRes();
    await ensController.ingestRiskMessage(mockReq({ user: admin, body: { xml: mensajeControl() } }), res);

    expect(res.body.success).toBe(true);
    const actualizada = await ENSDeclaration.findById(doc._id);
    expect(actualizada.riskAssessment.status).toBe('HOLD');
    expect(actualizada.riskAssessment.doNotLoadList).toBe(false);
    expect(actualizada.riskAssessment.controlDecisions).toHaveLength(1);
    expect(actualizada.riskAssessment.controlDecisions[0].code).toBe('A20');
    expect(actualizada.riskAssessment.controlDecisions[0].deadline.toISOString().substring(0, 10)).toBe('2026-08-15');
  });

  /**
   * El nucleo del bug de da7241d, ahora blindado en la puerta de entrada: si el
   * acuse de registro pelado pudiera ingerirse como analisis, volveriamos a
   * fabricar el veredicto.
   */
  test('un CC328A pelado (acuse de registro) se RECHAZA y no toca el riesgo', async () => {
    const doc = await sembrarAceptada();
    const res = mockRes();
    await ensController.ingestRiskMessage(mockReq({
      user: admin,
      body: { xml: sobre(`<ie:CC328A xmlns:ie="x"><HEAHEA><DocNumHEA5>${MRN}</DocNumHEA5></HEAHEA></ie:CC328A>`) }
    }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/acuse de registro/i);

    const actualizada = await ENSDeclaration.findById(doc._id);
    expect(actualizada.riskAssessment.status).toBe('PENDING');
    expect(actualizada.riskAssessment.assessedAt).toBeUndefined();
  });

  test('un MRN que no existe en la base responde 404 sin crear nada', async () => {
    await sembrarAceptada();
    const res = mockRes();
    await ensController.ingestRiskMessage(mockReq({
      user: admin, body: { xml: mensajeDNL('26ESNOEXISTE000001') }
    }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(await ENSDeclaration.countDocuments()).toBe(1);
  });

  test('sin xml en el cuerpo responde 400', async () => {
    const res = mockRes();
    await ensController.ingestRiskMessage(mockReq({ user: admin, body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/xml/i);
  });

  test('un mensaje de tipo no reconocido responde 422', async () => {
    await sembrarAceptada();
    const res = mockRes();
    await ensController.ingestRiskMessage(mockReq({
      user: admin, body: { xml: sobre('<ie:CC999Z xmlns:ie="x"><HEAHEA/></ie:CC999Z>') }
    }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
  });

  /**
   * Es un mensaje de la aduana sobre la deuda y la carga de un tercero: no puede
   * quedar al alcance de cualquier operador.
   */
  test('un operador sin rol admin no puede inyectar un veredicto de riesgo', async () => {
    const doc = await sembrarAceptada();
    const res = mockRes();
    await ensController.ingestRiskMessage(mockReq({ user: operador, body: { xml: mensajeDNL() } }), res);

    expect(res.statusCode).toBe(403);
    const actualizada = await ENSDeclaration.findById(doc._id);
    expect(actualizada.riskAssessment.status).toBe('PENDING');
  });

  test('deja rastro del mensaje en el historial de estado', async () => {
    const doc = await sembrarAceptada();
    await ensController.ingestRiskMessage(mockReq({ user: admin, body: { xml: mensajeDNL() } }), mockRes());

    const actualizada = await ENSDeclaration.findById(doc._id);
    const entrada = actualizada.statusHistory.find(h => /risk assessment/i.test(h.reason || ''));
    expect(entrada).toBeDefined();
    expect(entrada.aeatCode).toBe('CC351A');
  });

  test('es idempotente en el estado final si AEAT repite el mismo mensaje', async () => {
    const doc = await sembrarAceptada();
    await ensController.ingestRiskMessage(mockReq({ user: admin, body: { xml: mensajeDNL() } }), mockRes());
    const res2 = mockRes();
    await ensController.ingestRiskMessage(mockReq({ user: admin, body: { xml: mensajeDNL() } }), res2);

    expect(res2.body.success).toBe(true);
    const actualizada = await ENSDeclaration.findById(doc._id);
    expect(actualizada.riskAssessment.status).toBe('DNL');
    expect(actualizada.status).toBe('dnl');
  });
});
