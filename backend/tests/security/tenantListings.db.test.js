/**
 * Los listados de PUE, plazos, inspecciones, comunicaciones al inspector y chat
 * solo devuelven datos del tenant del usuario.
 *
 * Hallazgos F7, F9-F13 y F15-F17 del escaneo del 3/Nov/2026: calendarios,
 * pendientes, vencidos, urgentes y listados devolvian los de TODOS los clientes
 * a cualquier usuario autenticado (el registro publico da un admin de tenant).
 *
 * En cada caso hay un documento del tenant A y otro del tenant B, y un usuario
 * de A pide el listado: solo debe salir el suyo. Mongo real en memoria; se
 * llama a los controllers y al router de chat de verdad.
 */

const express = require('express');
const http = require('http');
const request = require('supertest');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

let mockUsuario;
jest.mock('../../src/middleware/auth', () => ({
  auth: (req, res, next) => { req.user = mockUsuario; next(); },
  requireAuth: (req, res, next) => { req.user = mockUsuario; next(); },
  requirePermission: () => (req, res, next) => next()
}));

const { Deadline, Inspection, InspectorCommunication, PUERequest, ChatMessage, Expedition } = require('../../src/models');
const deadlineController = require('../../src/controllers/deadlineController');
const inspectionController = require('../../src/controllers/inspectionController');
const commController = require('../../src/controllers/inspectorCommunicationController');
const pueController = require('../../src/controllers/pueController');

usarBaseDeDatosEnMemoria();

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();
const enDias = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/** Admin del tenant A: el rol que da el registro publico. */
function adminDeA() {
  return { _id: new mongoose.Types.ObjectId(), id: 'adminA', role: 'admin', tenantId: TENANT_A };
}

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

/** Llama al handler y devuelve la lista de documentos de la respuesta. */
async function listar(handler, query = {}) {
  const res = crearRes();
  await handler({ user: adminDeA(), query, params: {}, body: {} }, res);
  expect(res.statusCode).toBe(200);
  return res.body.data;
}

async function expedicion(tenantId) {
  return Expedition.create({
    expeditionId: 'EXP-' + new mongoose.Types.ObjectId().toString().slice(-6),
    tenantId,
    transportMode: 'maritime',
    operationType: 'import',
    client: { nif: 'B12345678', companyName: 'ACME' },
    goods: [{ itemNumber: 1, description: 'x', taricCode: '95030070', quantity: 1, invoiceValue: 10 }]
  });
}

const tenantsDe = (docs) => docs.map((d) => String(d.tenantId));

describe('plazos (F12, F15)', () => {
  beforeEach(async () => {
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await Deadline.create({ deadlineType: 'other', category: 'other', title: `Vencido ${tenantId}`, dueDate: enDias(-2), tenantId });
      await Deadline.create({ deadlineType: 'other', category: 'other', title: `Urgente ${tenantId}`, dueDate: enDias(1), tenantId });
    }
  });

  test('vencidos, urgentes y pendientes solo del tenant del usuario', async () => {
    for (const handler of [deadlineController.getOverdue, deadlineController.getUrgent, deadlineController.getPending]) {
      const docs = await listar(handler);
      expect(docs.length).toBeGreaterThan(0);
      expect(new Set(tenantsDe(docs))).toEqual(new Set([String(TENANT_A)]));
    }
  });

  test('el calendario solo trae los del tenant del usuario', async () => {
    const data = await listar(deadlineController.getCalendar, {
      startDate: enDias(-5).toISOString(), endDate: enDias(5).toISOString()
    });
    expect(data.deadlines.length).toBe(2);
    expect(new Set(tenantsDe(data.deadlines))).toEqual(new Set([String(TENANT_A)]));
  });
});

describe('inspecciones (F13)', () => {
  beforeEach(async () => {
    const hoy = new Date();
    for (const tenantId of [TENANT_A, TENANT_B]) {
      const exp = await expedicion(tenantId);
      await Inspection.create({
        inspectionType: 'physical', expeditionId: exp._id, tenantId, status: 'scheduled',
        location: { type: 'port', name: 'Puerto', city: 'Barcelona' },
        scheduling: { scheduledDate: hoy }
      });
    }
  });

  test('hoy y calendario solo del tenant del usuario', async () => {
    const hoy = await listar(inspectionController.getToday);
    expect(hoy.length).toBe(1);
    expect(String(hoy[0].tenantId)).toBe(String(TENANT_A));

    const cal = await listar(inspectionController.getCalendar, {
      startDate: enDias(-1).toISOString(), endDate: enDias(1).toISOString()
    });
    expect(new Set(tenantsDe(cal.inspections))).toEqual(new Set([String(TENANT_A)]));
  });
});

describe('comunicaciones al inspector (F11, F16)', () => {
  beforeEach(async () => {
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await InspectorCommunication.create({
        communicationType: 'allegation', category: 'appeal', subject: `Alegacion ${tenantId}`, tenantId,
        authority: { type: 'AEAT', name: 'Aduana' }, status: 'draft',
        deadlines: { submissionDeadline: enDias(-1) }
      });
    }
  });

  test('listado, alegaciones y vencidas solo del tenant del usuario', async () => {
    const lista = await listar(commController.list);
    expect(new Set(tenantsDe(lista.communications))).toEqual(new Set([String(TENANT_A)]));

    for (const handler of [commController.getAppeals, commController.getOverdue]) {
      const docs = await listar(handler);
      expect(docs.length).toBe(1);
      expect(String(docs[0].tenantId)).toBe(String(TENANT_A));
    }
  });
});

describe('PUE (F9, F10, F17)', () => {
  beforeEach(async () => {
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await PUERequest.create({
        tenantId, pueType: 'ROHS', status: 'submitted', deadline: enDias(3),
        createdBy: new mongoose.Types.ObjectId(),
        operator: { name: 'Operador', eori: 'ES1234567890123', nif: 'B12345678', role: 'operator' },
        goods: [{ sequenceNumber: 1, description: 'Lavadora', taricCode: '84501100' }],
        soivreOffice: { code: 'SOIVRE-28', name: 'SOIVRE Madrid' }
      });
    }
  });

  test('el admin de A solo lista los PUE de A', async () => {
    const docs = await listar(pueController.list);
    expect(docs.length).toBe(1);
    expect(String(docs[0].tenantId)).toBe(String(TENANT_A));
  });

  test('los proximos vencimientos solo son del tenant del usuario', async () => {
    const docs = await listar(pueController.getUpcomingDeadlines);
    expect(docs.length).toBe(1);
    expect(String(docs[0].tenantId)).toBe(String(TENANT_A));
  });
});

describe('historial de chat (F7)', () => {
  let servidor;

  beforeEach(async () => {
    for (const tenantId of [TENANT_A, TENANT_B]) {
      const exp = await expedicion(tenantId);
      await ChatMessage.create({ expedition: exp._id, sender: 'client', content: `Hola desde ${tenantId}` });
    }
    const app = express();
    app.use(express.json());
    app.use('/api/chat', require('../../src/routes/chat'));
    servidor = http.createServer(app);
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    await new Promise((resolve) => servidor.close(resolve));
  });

  test('el mensaje hereda el tenant del expediente', async () => {
    const msgs = await ChatMessage.find({ tenantId: TENANT_B });
    expect(msgs).toHaveLength(1);
  });

  test('GET /api/chat/history solo devuelve mensajes del tenant del usuario', async () => {
    mockUsuario = adminDeA();
    const res = await request(servidor).get('/api/chat/history');

    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(1);
    expect(res.body.data.messages[0].content).toBe(`Hola desde ${TENANT_A}`);
  });
});
