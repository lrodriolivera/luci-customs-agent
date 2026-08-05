/**
 * requirementController contra Mongo en memoria (modelos Requirement y Expedition
 * reales). Se mockea SOLO lo externo: aeatRealService (envio a AEAT real),
 * certificateService (lee el .p12) y aiService (Bedrock). La logica de negocio
 * -transiciones de estado, guard de tenant, efectos sobre el expediente, timeline-
 * se ejecuta de verdad. BD efimera, NUNCA produccion.
 *
 * Cubre en particular:
 *   - createRequirement: hereda tenant/mrn del expediente, deadline por defecto
 *     +14 dias, transiciona el expediente a orange_channel/red_channel, 201.
 *   - updateRequirement: REGRESION del bug del timeline (status_changed no se
 *     disparaba porque se comparaba tras Object.assign) + guard de tenant.
 *   - addResponse: solo en estados permitidos (400 en el resto).
 *   - scheduleInspection: solo canal rojo (400 en naranja).
 *   - recordInspectionResult: exige inspeccion programada; approved -> resolved +
 *     levante en el expediente; rejected -> rejected.
 *   - resolveRequirement: levante -> expediente levante + levanteDate; rejected ->
 *     expediente on_hold.
 *   - submitToAEAT: mockea AEAT/certificados, marca submitted, 400 sin respuesta.
 *   - getStats: REGRESION del crash de getStats con userId (ObjectId sin new).
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// resetMocks:true borra las implementaciones de fabrica antes de cada test.
jest.mock('../../src/services/aeat/aeatRealService', () => ({
  submitDigitalDocuments: jest.fn()
}));
jest.mock('../../src/services/aeat/certificateService', () => ({
  listCertificates: jest.fn()
}));
jest.mock('../../src/services/aiService', () => ({
  generateRequirementResponse: jest.fn(),
  analyzeRequestedDocuments: jest.fn(),
  suggestLegalArguments: jest.fn(),
  analyzeRequirementRisk: jest.fn(),
  fullRequirementAnalysis: jest.fn()
}));

const Requirement = require('../../src/models/Requirement');
const Expedition = require('../../src/models/Expedition');
// Registrar el modelo User: addResponse/submitToAEAT hacen populate de
// responses.submittedBy y Mongoose falla si el schema no esta registrado.
require('../../src/models/User');
const aeatRealService = require('../../src/services/aeat/aeatRealService');
const certificateService = require('../../src/services/aeat/certificateService');
const controller = require('../../src/controllers/requirementController');

// --- Helpers -----------------------------------------------------------------

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

function usuario(tenantId = TENANT_A) {
  return { _id: new mongoose.Types.ObjectId(), name: 'Operador Aduanas', tenantId };
}

function crearRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((payload) => { res.body = payload; return res; });
  return res;
}

async function crearExpediente(tenantId = TENANT_A, extra = {}) {
  return Expedition.create({
    tenantId,
    operationType: 'import',
    transportMode: 'maritime',
    status: 'declaration_submitted',
    client: { companyName: 'Importadora SL', nif: 'B12345678' },
    declaration: { mrn: '25ES00280012345678', lrn: 'LRN-001' },
    goods: [{ itemNumber: 1, description: 'Mercancia', quantity: 10, unit: 'KG', invoiceValue: 500 }],
    ...extra
  });
}

// Requerimiento minimo valido para los handlers que parten de uno ya existente.
async function crearRequerimiento(tenantId = TENANT_A, { channel = 'orange', status = 'pending', expeditionId } = {}) {
  return Requirement.create({
    expeditionId: expeditionId || new mongoose.Types.ObjectId(),
    tenantId,
    mrn: '25ES00280012345678',
    requirementType: 'documentary',
    channel,
    subject: 'Aportacion de factura comercial',
    description: 'Se requiere factura comercial y packing list',
    deadline: new Date('2026-12-31'),
    status
  });
}

describe('requirementController (BD real)', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(() => {
    certificateService.listCertificates.mockResolvedValue({
      certificates: [{ id: 'cert-1', metadata: { alias: 'strix-fnmt' } }]
    });
    aeatRealService.submitDigitalDocuments.mockResolvedValue({ csv: 'CSV-ABC123', code: '0' });
  });

  // --- createRequirement -----------------------------------------------------

  describe('createRequirement', () => {
    it('crea el requerimiento heredando tenant/mrn del expediente y transiciona a orange_channel', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);

      const res = crearRes();
      await controller.createRequirement(
        {
          body: {
            expeditionId: exp._id.toString(),
            requirementType: 'documentary',
            channel: 'orange',
            subject: 'Factura comercial',
            description: 'Aporte factura'
          },
          user
        },
        res
      );

      expect(res.statusCode).toBe(201);
      const creado = res.body.data;
      expect(String(creado.tenantId)).toBe(TENANT_A.toString());
      expect(creado.mrn).toBe('25ES00280012345678'); // heredado de declaration.mrn
      // deadline por defecto: +14 dias (no aporto uno)
      expect(new Date(creado.deadline).getTime()).toBeGreaterThan(Date.now());
      // el expediente paso a orange_channel
      const recargado = await Expedition.findById(exp._id);
      expect(recargado.status).toBe('orange_channel');
    });

    it('canal rojo transiciona el expediente a red_channel', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);

      const res = crearRes();
      await controller.createRequirement(
        { body: { expeditionId: exp._id.toString(), requirementType: 'physical', channel: 'red', subject: 'Inspeccion', description: 'Canal rojo' }, user },
        res
      );

      expect(res.statusCode).toBe(201);
      const recargado = await Expedition.findById(exp._id);
      expect(recargado.status).toBe('red_channel');
    });

    it('devuelve 404 si el expediente es de otro tenant (guard) y no crea nada', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_B); // ajeno

      const res = crearRes();
      await controller.createRequirement(
        { body: { expeditionId: exp._id.toString(), requirementType: 'documentary', channel: 'orange', subject: 'X', description: 'Y' }, user },
        res
      );

      expect(res.statusCode).toBe(404);
      expect(await Requirement.countDocuments()).toBe(0);
    });
  });

  // --- updateRequirement (REGRESION del timeline) ----------------------------

  describe('updateRequirement', () => {
    it('anade evento status_changed al timeline cuando cambia el estado (regresion)', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { status: 'pending' });

      const res = crearRes();
      await controller.updateRequirement(
        { params: { id: req._id.toString() }, body: { status: 'in_progress' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.status).toBe('in_progress');
      // Antes del fix este evento NO se anadia nunca (se comparaba tras Object.assign).
      const evento = recargado.timeline.find(t => t.action === 'status_changed');
      expect(evento).toBeDefined();
      expect(evento.metadata.oldStatus).toBe('pending');
      expect(evento.metadata.newStatus).toBe('in_progress');
    });

    it('NO anade evento status_changed si el estado no cambia', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { status: 'pending' });

      const res = crearRes();
      await controller.updateRequirement(
        { params: { id: req._id.toString() }, body: { priority: 'urgent' }, user },
        res
      );

      const recargado = await Requirement.findById(req._id);
      expect(recargado.timeline.some(t => t.action === 'status_changed')).toBe(false);
      expect(recargado.priority).toBe('urgent');
    });

    it('devuelve 404 y no toca el requerimiento de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B, { status: 'pending' });

      const res = crearRes();
      await controller.updateRequirement(
        { params: { id: req._id.toString() }, body: { status: 'in_progress' }, user },
        res
      );

      expect(res.statusCode).toBe(404);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.status).toBe('pending'); // intacto
    });
  });

  // --- addResponse -----------------------------------------------------------

  describe('addResponse', () => {
    it('agrega la respuesta y pasa a in_progress desde pending', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { status: 'pending' });

      const res = crearRes();
      await controller.addResponse(
        { params: { id: req._id.toString() }, body: { responseType: 'documentary', notes: 'Adjunto factura' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.responses).toHaveLength(1);
      expect(recargado.responses[0].responseType).toBe('documentary');
      expect(recargado.status).toBe('in_progress');
    });

    it('devuelve 400 si el estado no permite respuestas', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { status: 'resolved' });

      const res = crearRes();
      await controller.addResponse(
        { params: { id: req._id.toString() }, body: { responseType: 'documentary', notes: 'x' }, user },
        res
      );

      expect(res.statusCode).toBe(400);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.responses).toHaveLength(0);
    });
  });

  // --- scheduleInspection ----------------------------------------------------

  describe('scheduleInspection', () => {
    it('programa la inspeccion en un requerimiento de canal rojo', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { channel: 'red' });

      const res = crearRes();
      await controller.scheduleInspection(
        { params: { id: req._id.toString() }, body: { scheduledDate: '2026-09-01', location: 'Puerto de Valencia', inspectorName: 'Inspector X' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.physicalInspection.scheduled).toBe(true);
    });

    it('devuelve 400 si el canal no es rojo', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { channel: 'orange' });

      const res = crearRes();
      await controller.scheduleInspection(
        { params: { id: req._id.toString() }, body: { scheduledDate: '2026-09-01' }, user },
        res
      );

      expect(res.statusCode).toBe(400);
    });
  });

  // --- recordInspectionResult ------------------------------------------------

  describe('recordInspectionResult', () => {
    it('approved -> requerimiento resolved + expediente a levante', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { channel: 'red', expeditionId: exp._id });
      // programar primero (recordInspectionResult exige scheduled)
      await req.scheduleInspection({ scheduledDate: '2026-09-01', location: 'Puerto' });

      const res = crearRes();
      await controller.recordInspectionResult(
        { params: { id: req._id.toString() }, body: { result: 'approved', findings: 'Todo correcto', actaNumber: 'ACTA-001' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.status).toBe('resolved');
      expect(recargado.resolution.status).toBe('levante');
      expect(recargado.physicalInspection.completed).toBe(true);
      const expRecargado = await Expedition.findById(exp._id);
      expect(expRecargado.status).toBe('levante');
    });

    it('rejected -> requerimiento rejected, expediente sin tocar', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { channel: 'red', expeditionId: exp._id });
      await req.scheduleInspection({ scheduledDate: '2026-09-01' });

      const res = crearRes();
      await controller.recordInspectionResult(
        { params: { id: req._id.toString() }, body: { result: 'rejected', findings: 'Discrepancias', actaNumber: 'ACTA-002' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.status).toBe('rejected');
      const expRecargado = await Expedition.findById(exp._id);
      expect(expRecargado.status).toBe('declaration_submitted'); // no cambia a levante
    });

    it('devuelve 400 si no hay inspeccion programada', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { channel: 'red' });

      const res = crearRes();
      await controller.recordInspectionResult(
        { params: { id: req._id.toString() }, body: { result: 'approved' }, user },
        res
      );

      expect(res.statusCode).toBe(400);
    });
  });

  // --- resolveRequirement ----------------------------------------------------

  describe('resolveRequirement', () => {
    it('status levante -> requerimiento resuelto + expediente levante con levanteDate', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      const res = crearRes();
      await controller.resolveRequirement(
        { params: { id: req._id.toString() }, body: { status: 'levante', notes: 'Resuelto favorablemente' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.status).toBe('resolved');
      expect(recargado.resolution.status).toBe('levante');
      const expRecargado = await Expedition.findById(exp._id);
      expect(expRecargado.status).toBe('levante');
      expect(expRecargado.declaration.levanteDate).toBeInstanceOf(Date);
    });

    it('status rejected -> expediente on_hold', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      const res = crearRes();
      await controller.resolveRequirement(
        { params: { id: req._id.toString() }, body: { status: 'rejected', notes: 'No procede' }, user },
        res
      );

      const expRecargado = await Expedition.findById(exp._id);
      expect(expRecargado.status).toBe('on_hold');
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.resolveRequirement(
        { params: { id: req._id.toString() }, body: { status: 'levante' }, user },
        res
      );

      expect(res.statusCode).toBe(404);
    });
  });

  // --- submitToAEAT ----------------------------------------------------------

  describe('submitToAEAT', () => {
    it('envia la respuesta a AEAT (mock) y marca submitted', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { status: 'in_progress' });
      // anadir una respuesta con un adjunto
      await req.addResponse({ responseType: 'documentary', notes: 'doc', attachments: [{ fileName: 'factura.pdf', content: 'base64...', mimeType: 'application/pdf' }] }, user._id);

      const res = crearRes();
      await controller.submitToAEAT(
        { params: { id: req._id.toString() }, body: { responseIndex: 0 }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      expect(aeatRealService.submitDigitalDocuments).toHaveBeenCalled();
      const recargado = await Requirement.findById(req._id);
      expect(recargado.status).toBe('submitted');
      expect(recargado.responses[0].aeatSubmission.submitted).toBe(true);
      expect(recargado.responses[0].aeatSubmission.confirmationNumber).toBe('CSV-ABC123');
    });

    it('devuelve 400 si la respuesta indicada no existe', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { status: 'in_progress' });

      const res = crearRes();
      await controller.submitToAEAT(
        { params: { id: req._id.toString() }, body: { responseIndex: 5 }, user },
        res
      );

      expect(res.statusCode).toBe(400);
      expect(aeatRealService.submitDigitalDocuments).not.toHaveBeenCalled();
    });
  });

  // --- getStats (REGRESION del crash con userId) -----------------------------

  describe('getStats', () => {
    it('agrega estadisticas filtrando por userId sin crashear (regresion ObjectId)', async () => {
      const user = usuario(TENANT_A);
      const assignedTo = new mongoose.Types.ObjectId();
      // 2 requerimientos asignados a ese usuario, 1 a otro
      await Requirement.create({ expeditionId: new mongoose.Types.ObjectId(), tenantId: TENANT_A, mrn: 'M1', requirementType: 'documentary', channel: 'orange', subject: 'S1', description: 'D1', deadline: new Date('2026-12-31'), status: 'pending', assignedTo });
      await Requirement.create({ expeditionId: new mongoose.Types.ObjectId(), tenantId: TENANT_A, mrn: 'M2', requirementType: 'documentary', channel: 'red', subject: 'S2', description: 'D2', deadline: new Date('2026-12-31'), status: 'resolved', assignedTo });
      await Requirement.create({ expeditionId: new mongoose.Types.ObjectId(), tenantId: TENANT_A, mrn: 'M3', requirementType: 'documentary', channel: 'orange', subject: 'S3', description: 'D3', deadline: new Date('2026-12-31'), status: 'pending', assignedTo: new mongoose.Types.ObjectId() });

      const res = crearRes();
      // Antes del fix, getStats(userId) crasheaba con "Class constructor ObjectId
      // cannot be invoked without 'new'" -> HTTP 500.
      await controller.getStats({ query: { userId: assignedTo.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.total).toBe(2); // solo los 2 de ese userId
      expect(res.body.data.pending).toBeGreaterThanOrEqual(1);
    });

    it('sin userId devuelve el total global sin crashear', async () => {
      const user = usuario(TENANT_A);
      await crearRequerimiento(TENANT_A, { status: 'pending' });

      const res = crearRes();
      await controller.getStats({ query: {}, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.total).toBe(1);
    });
  });

  // --- getRequirements (listado con tenant-scoping) --------------------------

  describe('getRequirements', () => {
    it('lista SOLO los requerimientos del tenant del usuario', async () => {
      const user = usuario(TENANT_A);
      await crearRequerimiento(TENANT_A, { status: 'pending' });
      await crearRequerimiento(TENANT_A, { status: 'in_progress' });
      await crearRequerimiento(TENANT_B, { status: 'pending' }); // ajeno

      const res = crearRes();
      await controller.getRequirements({ query: {}, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(2); // no cuenta el de B
      expect(res.body.pagination.total).toBe(2);
    });

    it('aplica el filtro por status dentro del tenant', async () => {
      const user = usuario(TENANT_A);
      await crearRequerimiento(TENANT_A, { status: 'pending' });
      await crearRequerimiento(TENANT_A, { status: 'resolved' });

      const res = crearRes();
      await controller.getRequirements({ query: { status: 'resolved' }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('resolved');
    });

    it('respeta la paginacion (limit + pages)', async () => {
      const user = usuario(TENANT_A);
      await crearRequerimiento(TENANT_A, { status: 'pending' });
      await crearRequerimiento(TENANT_A, { status: 'pending' });
      await crearRequerimiento(TENANT_A, { status: 'pending' });

      const res = crearRes();
      await controller.getRequirements({ query: { page: '1', limit: '2' }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.pages).toBe(2);
    });
  });

  // --- getRequirementById ----------------------------------------------------

  describe('getRequirementById', () => {
    it('devuelve el requerimiento propio', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A);

      const res = crearRes();
      await controller.getRequirementById({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(String(res.body.data._id)).toBe(req._id.toString());
    });

    it('devuelve 404 si el requerimiento es de otro tenant (guard)', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.getRequirementById({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // --- getByExpedition -------------------------------------------------------

  describe('getByExpedition', () => {
    it('devuelve los requerimientos de un expediente', async () => {
      const expId = new mongoose.Types.ObjectId();
      await crearRequerimiento(TENANT_A, { expeditionId: expId });
      await crearRequerimiento(TENANT_A, { expeditionId: expId });
      await crearRequerimiento(TENANT_A, { expeditionId: new mongoose.Types.ObjectId() });

      const res = crearRes();
      await controller.getByExpedition({ params: { expeditionId: expId.toString() }, user: usuario() }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });
});
