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
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
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
    it('responde 400 cuando falta el canal, no 500', async () => {
      // channel es obligatorio (un requerimiento nace de un circuito AEAT), pero
      // no se validaba: la peticion llegaba hasta el save de Mongoose y salia
      // como 500 "Error al crear requerimiento". Antes incluso reventaba con un
      // TypeError al hacer channel.toUpperCase() al montar el timeline.
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);

      const res = crearRes();
      await controller.createRequirement(
        {
          body: {
            expeditionId: exp._id.toString(),
            requirementType: 'documentary',
            subject: 'Certificado de origen',
            description: 'Aporte certificado de origen'
          },
          user
        },
        res
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/canal/i);

      // Y el expediente no se toca: darlo por naranja pondria en control
      // documental un despacho al que la AEAT aun no ha asignado circuito.
      const recargado = await Expedition.findById(exp._id);
      expect(recargado.status).not.toBe('orange_channel');
    });

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

  // --- getRequirements: ramas de filtros sin cubrir --------------------------

  describe('getRequirements - filtros adicionales', () => {
    it('filtra por channel', async () => {
      const user = usuario(TENANT_A);
      await crearRequerimiento(TENANT_A, { channel: 'orange' });
      await crearRequerimiento(TENANT_A, { channel: 'red' });

      const res = crearRes();
      await controller.getRequirements({ query: { channel: 'red' }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].channel).toBe('red');
    });

    it('filtra por requirementType', async () => {
      const user = usuario(TENANT_A);
      await crearRequerimiento(TENANT_A, { channel: 'orange' });
      await Requirement.create({
        expeditionId: new mongoose.Types.ObjectId(),
        tenantId: TENANT_A,
        mrn: 'M-VAL',
        requirementType: 'valuation',
        channel: 'orange',
        subject: 'Cuestionamiento valor',
        description: 'Se cuestiona el valor',
        deadline: new Date('2026-12-31')
      });

      const res = crearRes();
      await controller.getRequirements({ query: { requirementType: 'valuation' }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].requirementType).toBe('valuation');
    });

    it('filtra por expeditionId', async () => {
      const user = usuario(TENANT_A);
      const expId = new mongoose.Types.ObjectId();
      await crearRequerimiento(TENANT_A, { expeditionId: expId });
      await crearRequerimiento(TENANT_A, { expeditionId: new mongoose.Types.ObjectId() });

      const res = crearRes();
      await controller.getRequirements({ query: { expeditionId: expId.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      // el populate puede dejar el campo en null si el expediente no existe; lo importante es que filtre
    });

    it('filtra por assignedTo', async () => {
      const user = usuario(TENANT_A);
      const assignedUser = new mongoose.Types.ObjectId();
      await Requirement.create({
        expeditionId: new mongoose.Types.ObjectId(),
        tenantId: TENANT_A,
        mrn: 'M1',
        requirementType: 'documentary',
        channel: 'orange',
        subject: 'S1',
        description: 'D1',
        deadline: new Date('2026-12-31'),
        assignedTo: assignedUser
      });
      await crearRequerimiento(TENANT_A);

      const res = crearRes();
      await controller.getRequirements({ query: { assignedTo: assignedUser.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      // el populate puede dejar el campo en null si el User no existe; lo importante es que filtre
    });

    it('filtra por overdue (vencidos)', async () => {
      const user = usuario(TENANT_A);
      // requerimiento vencido (deadline pasado, estado activo)
      await Requirement.create({
        expeditionId: new mongoose.Types.ObjectId(),
        tenantId: TENANT_A,
        mrn: 'M-OV',
        requirementType: 'documentary',
        channel: 'orange',
        subject: 'Vencido',
        description: 'Ya paso el deadline',
        deadline: new Date('2020-01-01'),
        status: 'pending'
      });
      // requerimiento futuro
      await crearRequerimiento(TENANT_A, { status: 'pending' });

      const res = crearRes();
      await controller.getRequirements({ query: { overdue: 'true' }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].subject).toBe('Vencido');
    });

    it('filtra por urgent (vencen en 3 dias o menos)', async () => {
      const user = usuario(TENANT_A);
      // requerimiento urgente (vence en 2 dias)
      const urgente = new Date();
      urgente.setDate(urgente.getDate() + 2);
      await Requirement.create({
        expeditionId: new mongoose.Types.ObjectId(),
        tenantId: TENANT_A,
        mrn: 'M-URG',
        requirementType: 'documentary',
        channel: 'red',
        subject: 'Urgente',
        description: 'Vence pronto',
        deadline: urgente,
        status: 'pending'
      });
      // requerimiento lejano (vence en 30 dias)
      const lejano = new Date();
      lejano.setDate(lejano.getDate() + 30);
      await Requirement.create({
        expeditionId: new mongoose.Types.ObjectId(),
        tenantId: TENANT_A,
        mrn: 'M-LEJ',
        requirementType: 'documentary',
        channel: 'orange',
        subject: 'Lejano',
        description: 'Vence lejos',
        deadline: lejano,
        status: 'pending'
      });

      const res = crearRes();
      await controller.getRequirements({ query: { urgent: 'true' }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].subject).toBe('Urgente');
    });

    it('filtra por array de status', async () => {
      const user = usuario(TENANT_A);
      await crearRequerimiento(TENANT_A, { status: 'pending' });
      await crearRequerimiento(TENANT_A, { status: 'resolved' });
      await crearRequerimiento(TENANT_A, { status: 'rejected' });

      const res = crearRes();
      await controller.getRequirements({ query: { status: ['pending', 'resolved'] }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every(r => ['pending', 'resolved'].includes(r.status))).toBe(true);
    });
  });

  // --- markItemProvided ------------------------------------------------------

  describe('markItemProvided', () => {
    it('marca un item solicitado como proporcionado', async () => {
      const user = usuario(TENANT_A);
      const req = await Requirement.create({
        expeditionId: new mongoose.Types.ObjectId(),
        tenantId: TENANT_A,
        mrn: 'M-ITEM',
        requirementType: 'documentary',
        channel: 'orange',
        subject: 'Items',
        description: 'Items solicitados',
        deadline: new Date('2026-12-31'),
        requestedItems: [
          { itemType: 'document', description: 'Factura', mandatory: true, provided: false }
        ]
      });

      const itemId = req.requestedItems[0]._id;
      const docId = new mongoose.Types.ObjectId();

      const res = crearRes();
      await controller.markItemProvided(
        { params: { id: req._id.toString(), itemId: itemId.toString() }, body: { documentId: docId.toString() }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.requestedItems[0].provided).toBe(true);
      expect(String(recargado.requestedItems[0].providedDocumentId)).toBe(docId.toString());
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);
      const itemId = new mongoose.Types.ObjectId();

      const res = crearRes();
      await controller.markItemProvided(
        { params: { id: req._id.toString(), itemId: itemId.toString() }, body: {}, user },
        res
      );

      expect(res.statusCode).toBe(404);
    });
  });

  // --- AI endpoints ----------------------------------------------------------

  const aiService = require('../../src/services/aiService');

  describe('generateAIResponse (basico)', () => {
    it('genera una respuesta IA basica (version legacy)', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      aiService.generateRequirementResponse.mockResolvedValue({
        rawResponse: 'Respuesta sugerida por IA',
        formalResponse: { body: 'Respuesta formal' },
        documentsToAttach: ['factura.pdf'],
        keyPoints: ['punto 1'],
        risks: ['riesgo 1'],
        legalArguments: ['argumento 1'],
        recommendedActions: ['accion 1'],
        estimatedOutcome: { favorable: 80 },
        model: 'claude-3-sonnet',
        tokensUsed: 1500,
        summary: 'Resumen'
      });

      const res = crearRes();
      await controller.generateAIResponse({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.suggestedResponse).toBeDefined();
      expect(res.body.data.confidence).toBeGreaterThan(0);
      expect(aiService.generateRequirementResponse).toHaveBeenCalledWith(expect.anything(), expect.anything());
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.generateAIResponse({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('aiAnalyzeDocuments', () => {
    it('analiza documentos solicitados con IA', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      aiService.analyzeRequestedDocuments.mockResolvedValue({
        analysis: 'Analisis de documentos',
        missing: ['certificado origen'],
        complete: true
      });

      const res = crearRes();
      await controller.aiAnalyzeDocuments({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.analysis).toBeDefined();
      expect(aiService.analyzeRequestedDocuments).toHaveBeenCalled();
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.aiAnalyzeDocuments({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('aiSuggestArguments', () => {
    it('sugiere argumentacion legal con IA', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      aiService.suggestLegalArguments.mockResolvedValue({
        arguments: ['Argumento 1', 'Argumento 2'],
        legalBasis: 'Art. 123 del Reglamento UE'
      });

      const res = crearRes();
      await controller.aiSuggestArguments({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.arguments).toBeDefined();
      expect(aiService.suggestLegalArguments).toHaveBeenCalled();
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.aiSuggestArguments({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('aiAnalyzeRisk', () => {
    it('analiza riesgo del requerimiento con IA', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      aiService.analyzeRequirementRisk.mockResolvedValue({
        riskLevel: 'medium',
        factors: ['factor 1'],
        mitigation: ['mitigation 1']
      });

      const res = crearRes();
      await controller.aiAnalyzeRisk({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.riskLevel).toBeDefined();
      expect(aiService.analyzeRequirementRisk).toHaveBeenCalled();
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.aiAnalyzeRisk({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('aiFullAnalysis', () => {
    it('realiza analisis completo con IA y lo registra en timeline', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      aiService.fullRequirementAnalysis.mockResolvedValue({
        overallReadiness: { score: 85, estimatedOutcome: 'favorable' },
        risk: { riskLevel: 'low' },
        complete: true
      });

      const res = crearRes();
      await controller.aiFullAnalysis({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.overallReadiness).toBeDefined();
      expect(aiService.fullRequirementAnalysis).toHaveBeenCalled();

      // verificar que se registro en timeline
      const recargado = await Requirement.findById(req._id);
      const evento = recargado.timeline.find(t => t.action === 'ai_analysis');
      expect(evento).toBeDefined();
      expect(evento.metadata.readinessScore).toBe(85);
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.aiFullAnalysis({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('aiDraftResponse', () => {
    it('genera borrador de respuesta formal con IA', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      aiService.generateRequirementResponse.mockResolvedValue({
        rawResponse: 'Borrador generado',
        formalResponse: { body: 'Respuesta formal generada' },
        model: 'claude-3-opus',
        tokensUsed: 2000
      });

      const res = crearRes();
      await controller.aiDraftResponse({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.rawResponse).toBeDefined();
      expect(aiService.generateRequirementResponse).toHaveBeenCalled();
    });

    it('devuelve 404 si el requerimiento es de otro tenant', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_B);

      const res = crearRes();
      await controller.aiDraftResponse({ params: { id: req._id.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // --- Casos de error 500 (bloques catch) ------------------------------------

  describe('manejo de errores 500', () => {
    it('getRequirements devuelve 500 en error de BD', async () => {
      const user = usuario(TENANT_A);
      // forzar error: invalid ObjectId
      const res = crearRes();
      await controller.getRequirements({ query: { assignedTo: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('getRequirementById devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.getRequirementById({ params: { id: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('createRequirement devuelve 500 en error interno', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      // expeditionId invalido para forzar error
      await controller.createRequirement(
        { body: { expeditionId: 'invalid', requirementType: 'documentary', channel: 'orange', subject: 'X', description: 'Y' }, user },
        res
      );

      expect(res.statusCode).toBe(500);
    });

    it('updateRequirement devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.updateRequirement({ params: { id: 'invalid-id' }, body: {}, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('addResponse devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.addResponse({ params: { id: 'invalid-id' }, body: { responseType: 'documentary', notes: 'x' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('markItemProvided devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.markItemProvided({ params: { id: 'invalid-id', itemId: 'invalid-item' }, body: {}, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('submitToAEAT devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.submitToAEAT({ params: { id: 'invalid-id' }, body: { responseIndex: 0 }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('scheduleInspection devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.scheduleInspection({ params: { id: 'invalid-id' }, body: {}, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('recordInspectionResult devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.recordInspectionResult({ params: { id: 'invalid-id' }, body: { result: 'approved' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('resolveRequirement devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.resolveRequirement({ params: { id: 'invalid-id' }, body: { status: 'levante' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('getStats devuelve 500 en error interno', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.getStats({ query: { userId: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('getByExpedition devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.getByExpedition({ params: { expeditionId: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('generateAIResponse devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.generateAIResponse({ params: { id: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('aiAnalyzeDocuments devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.aiAnalyzeDocuments({ params: { id: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('aiSuggestArguments devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.aiSuggestArguments({ params: { id: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('aiAnalyzeRisk devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.aiAnalyzeRisk({ params: { id: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('aiFullAnalysis devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.aiFullAnalysis({ params: { id: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });

    it('aiDraftResponse devuelve 500 con id invalido', async () => {
      const user = usuario(TENANT_A);
      const res = crearRes();
      await controller.aiDraftResponse({ params: { id: 'invalid-id' }, user }, res);

      expect(res.statusCode).toBe(500);
    });
  });

  // --- Edge cases adicionales para aumentar cobertura de ramas ---------------

  describe('edge cases adicionales', () => {
    it('getRequirements sin usuario devuelve los requerimientos (sin tenant filter)', async () => {
      await crearRequerimiento(TENANT_A);
      await crearRequerimiento(TENANT_B);

      const res = crearRes();
      // req.user undefined o sin tenantId
      await controller.getRequirements({ query: {}, user: { _id: new mongoose.Types.ObjectId() } }, res);

      expect(res.statusCode).toBe(200);
      // sin tenantId, devuelve todos
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('getRequirementById devuelve 404 cuando el requerimiento no existe (null)', async () => {
      const user = usuario(TENANT_A);
      const idInexistente = new mongoose.Types.ObjectId();

      const res = crearRes();
      await controller.getRequirementById({ params: { id: idInexistente.toString() }, user }, res);

      expect(res.statusCode).toBe(404);
    });

    it('createRequirement usa mrn/lrn heredados del expediente cuando no se proveen', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);

      const res = crearRes();
      await controller.createRequirement(
        {
          body: {
            expeditionId: exp._id.toString(),
            requirementType: 'documentary',
            channel: 'orange',
            subject: 'X',
            description: 'Y'
            // NO provee mrn ni lrn
          },
          user
        },
        res
      );

      expect(res.statusCode).toBe(201);
      expect(res.body.data.mrn).toBe('25ES00280012345678'); // heredado
      expect(res.body.data.lrn).toBe('LRN-001'); // heredado
    });

    it('updateRequirement permite actualizar sin cambiar el estado', async () => {
      const user = usuario(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { status: 'pending', priority: 'normal' });

      const res = crearRes();
      await controller.updateRequirement(
        { params: { id: req._id.toString() }, body: { priority: 'urgent', internalNotes: 'Notas internas' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.priority).toBe('urgent');
      expect(recargado.status).toBe('pending'); // sin cambiar
    });

    it('recordInspectionResult con partial deja el requerimiento sin resolver', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { channel: 'red', expeditionId: exp._id });
      await req.scheduleInspection({ scheduledDate: '2026-09-01' });

      const res = crearRes();
      await controller.recordInspectionResult(
        { params: { id: req._id.toString() }, body: { result: 'partial', findings: 'Parcial' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      // partial no es ni approved ni rejected, no cambia el status del requerimiento
      expect(recargado.status).not.toBe('resolved');
      expect(recargado.status).not.toBe('rejected');
    });

    it('resolveRequirement con status distinto de levante/rejected no toca el expediente', async () => {
      const user = usuario(TENANT_A);
      const exp = await crearExpediente(TENANT_A);
      const req = await crearRequerimiento(TENANT_A, { expeditionId: exp._id });

      const res = crearRes();
      await controller.resolveRequirement(
        { params: { id: req._id.toString() }, body: { status: 'pending_payment', notes: 'Pendiente pago' }, user },
        res
      );

      expect(res.statusCode).toBe(200);
      const recargado = await Requirement.findById(req._id);
      expect(recargado.status).toBe('resolved');
      const expRecargado = await Expedition.findById(exp._id);
      // el expediente no cambia a levante ni on_hold
      expect(expRecargado.status).toBe('declaration_submitted');
    });
  });
});
