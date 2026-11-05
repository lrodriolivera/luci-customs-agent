/**
 * F2 (escaneo 5/Nov/2026): documents[].url de una declaracion ENS se guardaba
 * sin validar y el detalle la pintaba en un href. Un usuario del tenant fijaba
 * "javascript:..." y se ejecutaba al pulsar el administrador.
 *
 * Se acepta http(s) o una ruta relativa del propio sitio ("/ruta"); el resto
 * (javascript:, data:, vbscript:, //otro-host, esquemas ofuscados) -> 400.
 * Mongo real en memoria; controllers reales.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  analyzeENSData: jest.fn(), validateENSBeforeSubmit: jest.fn(), predictENSRejection: jest.fn()
}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitENS: jest.fn(), submitENSAmendment: jest.fn()
}));

const ensController = require('../../src/controllers/ensController');
const ensService = require('../../src/services/ensService');
const { ENSDeclaration } = require('../../src/models');
const User = require('../../src/models/User');

usarBaseDeDatosEnMemoria();

const URLS_PELIGROSAS = [
  'javascript:alert(document.cookie)',
  'JaVaScRiPt:alert(1)',
  '  javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  '//evil.example/x.pdf',
  '/\\evil.example/x.pdf',
  'ftp://host/x'
];
const URLS_VALIDAS = ['https://strixai.ai/docs/a.pdf', 'http://example.com/a.pdf', '/uploads/a.pdf'];

function mockRes() {
  const res = { statusCode: 200, headersSent: false };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.headersSent = true; return res; };
  return res;
}
const mockReq = ({ user, params = {}, body = {} }) => ({
  user, tenantId: String(user.tenantId), params, body, query: {}
});

const datosENS = (extra = {}) => ({
  transportMode: 'SEA',
  entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: new Date(Date.now() + 48 * 3600e3) },
  carrier: { eori: 'ESB12345678', name: 'Naviera SL' },
  transportMeans: { identification: 'IMO9999999', identificationType: 'VESSEL_IMO', modeAtBorder: '1' },
  consignment: { referenceNumber: 'MBL-001', referenceType: 'MBL', grossMass: 1000, numberOfPackages: 10, goodsDescription: 'x', countryOfDispatch: 'CN' },
  goods: [{ sequenceNumber: 1, description: 'Camisetas', commodityCode: '610910', grossMass: 500, numberOfPackages: 10 }],
  ...extra
});

let usuario;
let ens;
beforeEach(async () => {
  usuario = await User.create({
    name: 'Admin', email: `a-${Date.now()}-${Math.round(performance.now())}@a.es`,
    password: 'secret123', role: 'admin', tenantId: new mongoose.Types.ObjectId()
  });
  const r = await ensService.createDeclaration(datosENS(), usuario._id);
  ens = await ENSDeclaration.findById(r.data._id);
});

const documentosGuardados = async () => (await ENSDeclaration.findById(ens._id)).documents;

describe('F2 — addDocument', () => {
  test.each(URLS_PELIGROSAS)('url %j -> 400 y no se guarda', async (url) => {
    const res = mockRes();
    await ensController.addDocument(mockReq({
      user: usuario, params: { id: String(ens._id) }, body: { type: 'CMR', name: 'x.pdf', url }
    }), res);
    expect(res.statusCode).toBe(400);
    expect(await documentosGuardados()).toHaveLength(0);
  });

  test.each(URLS_VALIDAS)('url %j se acepta', async (url) => {
    const res = mockRes();
    await ensController.addDocument(mockReq({
      user: usuario, params: { id: String(ens._id) }, body: { type: 'CMR', name: 'x.pdf', url }
    }), res);
    expect(res.statusCode).toBe(200);
    expect((await documentosGuardados())[0].url).toBe(url);
  });

  test('sin url (documento sin enlace) se acepta', async () => {
    const res = mockRes();
    await ensController.addDocument(mockReq({
      user: usuario, params: { id: String(ens._id) }, body: { type: 'CMR', name: 'x.pdf' }
    }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('F2 — update (PUT /api/ens/:id)', () => {
  test.each(URLS_PELIGROSAS)('documents[].url %j -> 400 y no se guarda', async (url) => {
    const res = mockRes();
    await ensController.update(mockReq({
      user: usuario, params: { id: String(ens._id) },
      body: { documents: [{ type: 'CMR', name: 'x.pdf', url }] }
    }), res);
    expect(res.statusCode).toBe(400);
    expect(await documentosGuardados()).toHaveLength(0);
  });

  test('documents con url valida se actualiza', async () => {
    const res = mockRes();
    await ensController.update(mockReq({
      user: usuario, params: { id: String(ens._id) },
      body: { documents: [{ type: 'CMR', name: 'x.pdf', url: 'https://strixai.ai/a.pdf' }] }
    }), res);
    expect(res.statusCode).toBe(200);
    expect(await documentosGuardados()).toHaveLength(1);
  });
});

describe('F2 — el modelo tambien lo rechaza (defensa en profundidad)', () => {
  test('save() con url peligrosa lanza ValidationError', async () => {
    const d = await ENSDeclaration.findById(ens._id);
    d.documents.push({ type: 'CMR', name: 'x', url: 'javascript:alert(1)' });
    await expect(d.save()).rejects.toThrow(/url/i);
  });
});
