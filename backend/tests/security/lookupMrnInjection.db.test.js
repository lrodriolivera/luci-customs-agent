/**
 * POST /api/pue/lookup-mrn no deja leer expedientes de otro tenant.
 *
 * Hallazgo F1 del escaneo del 3/Nov/2026: el MRN del body llegaba tal cual a
 * Expedition.findOne({ 'declaration.mrn': mrn }), sin filtro de tenant. Con
 * {"mrn": {"$ne": null}} se recibia el expediente de otro cliente (importador,
 * NIF, EORI, partidas) y con $regex se recorrian todos.
 *
 * Tres defensas, cada una con su test:
 *   1. el controller rechaza un mrn o claveZeta que no sea string/numero;
 *   2. la consulta se acota al tenant del usuario;
 *   3. app.js monta sanitizeOperators tras los parsers de body (comun a todas
 *      las rutas).
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { Expedition } = require('../../src/models');
const pueController = require('../../src/controllers/pueController');

usarBaseDeDatosEnMemoria();

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();
const MRN_B = '26ES00085100000001';

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const adminDeA = () => ({ _id: new mongoose.Types.ObjectId(), role: 'admin', tenantId: TENANT_A });

async function lookup(body, user = adminDeA()) {
  const res = crearRes();
  await pueController.lookupMRN({ body, user, query: {}, params: {} }, res);
  return res;
}

beforeEach(async () => {
  await Expedition.create({
    expeditionId: 'EXP-B-0001',
    tenantId: TENANT_B,
    transportMode: 'maritime',
    operationType: 'import',
    client: { nif: 'B99999999', companyName: 'Victima SL' },
    declaration: { mrn: MRN_B },
    goods: [{ itemNumber: 1, description: 'Secreto', taricCode: '95030070', quantity: 1, invoiceValue: 10 }]
  });
});

describe('validacion de tipos en lookup-mrn', () => {
  test.each([
    [{ $ne: null }],
    [{ $regex: '^26' }],
    [['26ES']],
    [42]
  ])('rechaza un mrn que no es string (%j) con 400 y sin datos', async (mrn) => {
    const res = await lookup({ mrn, claveZeta: 1 });
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('Victima');
  });

  test('rechaza una claveZeta que no es string ni numero', async () => {
    const res = await lookup({ mrn: MRN_B, claveZeta: { $gt: 0 } });
    expect(res.statusCode).toBe(400);
  });
});

describe('alcance por tenant en lookup-mrn', () => {
  test('el MRN de otro tenant no se encuentra', async () => {
    const res = await lookup({ mrn: MRN_B, claveZeta: '00001' });
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('Victima');
    expect(JSON.stringify(res.body)).not.toContain('B99999999');
  });

  test('el propio tenant si lo encuentra', async () => {
    const duenoB = { _id: new mongoose.Types.ObjectId(), role: 'agent', tenantId: TENANT_B };
    const res = await lookup({ mrn: MRN_B, claveZeta: '00001' }, duenoB);
    expect(res.body.success).toBe(true);
  });
});

describe('app.js monta sanitizeOperators', () => {
  test('va despues de express.json y express.urlencoded y antes de las rutas', () => {
    const app = fs.readFileSync(path.join(__dirname, '../../src/app.js'), 'utf8');
    const json = app.indexOf('app.use(express.json(');
    const urlencoded = app.indexOf('app.use(express.urlencoded(');
    const sanitize = app.indexOf('app.use(sanitizeOperators)');
    // Primer router de dominio montado (el limitador de /api va antes que los
    // parsers y no cuenta).
    const primeraRuta = app.indexOf("app.use('/api/auth', authRoutes)");
    expect(primeraRuta).toBeGreaterThan(-1);
    expect(sanitize).toBeGreaterThan(json);
    expect(sanitize).toBeGreaterThan(urlencoded);
    expect(sanitize).toBeLessThan(primeraRuta);
  });
});
