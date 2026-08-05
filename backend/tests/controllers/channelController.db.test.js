/**
 * channelController — circuitos de control aduanero (verde/amarillo/naranja/rojo)
 * y levante. Logica de negocio critica (asignacion de canal, aislamiento por
 * tenant, requerimientos AEAT en naranja/rojo), justo lo que el mandato manda
 * cubrir antes que utilidades.
 *
 * FRONTERAS mockeadas SOLO las que hacen I/O de negocio ya cubierto por su
 * propio suite (channelService.db.test.js):
 *  - channelService.reevaluateYellowChannel  (reescribe la declaracion)
 *  - channelService.processChannelAssignment (asigna canal + crea Requirement)
 * Se DEJAN REALES getChannelConfig / getAllChannels: son puros (leen la
 * constante CHANNEL_CONFIG), mockearlos probaria el mock, no el controller.
 * Los modelos Expedition / Requirement / H7Declaration NO se mockean: Mongo
 * real en memoria, de modo que los guards de tenant, aggregate y populate se
 * ejecutan de verdad. El propio channelController NO se mockea.
 *
 * jest.config tiene resetMocks:true -> los fakes se reinstalan en beforeEach.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/channelService', () => {
  const real = jest.requireActual('../../src/services/channelService');
  return {
    getChannelConfig: real.getChannelConfig.bind(real),
    getAllChannels: real.getAllChannels.bind(real),
    reevaluateYellowChannel: jest.fn(),
    processChannelAssignment: jest.fn()
  };
});

const channelController = require('../../src/controllers/channelController');
const channelService = require('../../src/services/channelService');
const { Expedition, Requirement } = require('../../src/models');
const H7Declaration = require('../../src/models/H7Declaration');
const User = require('../../src/models/User');

usarBaseDeDatosEnMemoria();

const enDias = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.headersSent = false;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; res.headersSent = true; return res; });
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

let TENANT_A;
let TENANT_B;
let adminA;
let otroTenantUser;

beforeEach(async () => {
  TENANT_A = new mongoose.Types.ObjectId();
  TENANT_B = new mongoose.Types.ObjectId();

  const uniq = `${Date.now()}-${Math.round(performance.now())}`;
  adminA = await User.create({
    name: 'Admin A', email: `admin-${uniq}@a.es`, password: 'secret123',
    role: 'admin', tenantId: TENANT_A
  });
  otroTenantUser = await User.create({
    name: 'Otro', email: `otro-${uniq}@b.es`, password: 'secret123',
    role: 'agent', tenantId: TENANT_B
  });

  // Defaults de los mocks (resetMocks:true los limpia entre tests).
  channelService.reevaluateYellowChannel.mockResolvedValue({ success: true, newChannel: 'green' });
  channelService.processChannelAssignment.mockResolvedValue({ channel: 'orange', processed: true });
});

// Siembra una H7 minima directamente en la coleccion. El H7DeclarationSchema
// tiene muchos required (recipient, trackingNumber, valores...) irrelevantes
// para lo que lee el controller (channel/mrn/reference/recipient.name via .lean),
// asi que insertamos sin pasar por la validacion del schema.
async function sembrarH7({ tenantId, channel, mrn, reference, recipientName, submittedAt }) {
  await H7Declaration.collection.insertOne({
    tenantId, channel, mrn, reference, status: 'submitted',
    recipient: { name: recipientName }, submittedAt, createdAt: submittedAt
  });
}

// Siembra un expediente con canal asignado. La declaracion se pasa por overrides.
async function sembrarExpedicion(tenantId, declaration = {}, extra = {}) {
  return Expedition.create({
    tenantId,
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B12345678', eori: 'ESB12345678' },
    createdBy: adminA._id,
    declaration,
    ...extra
  });
}

describe('getChannelConfigs', () => {
  test('devuelve la configuracion completa de los 4 canales', async () => {
    const req = mockReq({ user: adminA });
    const res = mockRes();
    await channelController.getChannelConfigs(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.green.label).toBe('Canal Verde');
    expect(res.body.data.red.label).toBe('Canal Rojo');
  });
});

describe('getChannelStatus', () => {
  test('404 si el expediente es de otro tenant (ensureSameTenant)', async () => {
    const exp = await sembrarExpedicion(TENANT_B, { channel: 'green', mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.getChannelStatus(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('400 si el expediente no tiene canal asignado', async () => {
    const exp = await sembrarExpedicion(TENANT_A, { mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.getChannelStatus(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/no tiene canal/);
  });

  test('verde: devuelve estado con levante autorizado y label del canal', async () => {
    const exp = await sembrarExpedicion(TENANT_A, {
      channel: 'green', mrn: '25ES00281234567890',
      channelAssignedAt: new Date(), levanteDate: new Date(), levanteNumber: 'LEV-001'
    });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.getChannelStatus(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.channel).toBe('green');
    expect(res.body.data.channelLabel).toBe('Canal Verde');
    expect(res.body.data.levante.authorized).toBe(true);
    expect(res.body.data.levante.number).toBe('LEV-001');
  });

  test('rojo: mapea los requerimientos e incluye la inspeccion fisica', async () => {
    const exp = await sembrarExpedicion(TENANT_A, {
      channel: 'red', mrn: '25ES00281234567890', channelAssignedAt: new Date()
    });
    await Requirement.create({
      expeditionId: exp._id, mrn: '25ES00281234567890',
      requirementType: 'physical', channel: 'red', deadline: enDias(5),
      subject: 'Inspeccion fisica', description: 'Canal rojo - inspeccion completa',
      physicalInspection: { scheduled: true, inspectionType: 'complete' }
    });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.getChannelStatus(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.channel).toBe('red');
    expect(res.body.data.levante.authorized).toBe(false);
    expect(res.body.data.requirements).toHaveLength(1);
    expect(res.body.data.requirements[0].type).toBe('physical');
    expect(res.body.data.physicalInspection?.scheduled).toBe(true);
  });
});

describe('reevaluateChannel', () => {
  test('404 si el expediente es de otro tenant (no llama al service)', async () => {
    const exp = await sembrarExpedicion(TENANT_B, { channel: 'yellow', mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.reevaluateChannel(req, res);

    expect(res.statusCode).toBe(404);
    expect(channelService.reevaluateYellowChannel).not.toHaveBeenCalled();
  });

  test('delega en el service para un expediente propio', async () => {
    const exp = await sembrarExpedicion(TENANT_A, { channel: 'yellow', mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.reevaluateChannel(req, res);

    expect(channelService.reevaluateYellowChannel).toHaveBeenCalledWith(exp._id.toString(), adminA);
    expect(res.body.success).toBe(true);
    expect(res.body.data.newChannel).toBe('green');
  });

  test('500 si el service lanza', async () => {
    const exp = await sembrarExpedicion(TENANT_A, { channel: 'yellow', mrn: '25ES00281234567890' });
    channelService.reevaluateYellowChannel.mockRejectedValue(new Error('boom'));
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.reevaluateChannel(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('boom');
  });
});

describe('processChannelManually', () => {
  test('400 si el canal no es valido', async () => {
    const exp = await sembrarExpedicion(TENANT_A, { mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() }, body: { channel: 'purple' } });
    const res = mockRes();
    await channelController.processChannelManually(req, res);

    expect(res.statusCode).toBe(400);
    expect(channelService.processChannelAssignment).not.toHaveBeenCalled();
  });

  test('404 si el expediente es de otro tenant', async () => {
    const exp = await sembrarExpedicion(TENANT_B, { mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() }, body: { channel: 'orange' } });
    const res = mockRes();
    await channelController.processChannelManually(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('400 si el expediente no tiene MRN', async () => {
    const exp = await sembrarExpedicion(TENANT_A, { channel: 'green' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() }, body: { channel: 'orange' } });
    const res = mockRes();
    await channelController.processChannelManually(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/MRN/);
  });

  test('delega en processChannelAssignment con manual:true', async () => {
    const exp = await sembrarExpedicion(TENANT_A, { channel: 'green', mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() }, body: { channel: 'orange' } });
    const res = mockRes();
    await channelController.processChannelManually(req, res);

    expect(channelService.processChannelAssignment).toHaveBeenCalledWith(
      exp._id.toString(), 'orange', { manual: true }, adminA
    );
    expect(res.body.success).toBe(true);
  });
});

describe('getLevante', () => {
  test('404 cross-tenant', async () => {
    const exp = await sembrarExpedicion(TENANT_B, { channel: 'green', levanteDate: new Date() });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.getLevante(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('400 si no hay levante autorizado', async () => {
    const exp = await sembrarExpedicion(TENANT_A, { channel: 'orange', mrn: '25ES00281234567890' });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.getLevante(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/levante/);
  });

  test('devuelve datos de levante con importador y mercancias', async () => {
    const exp = await sembrarExpedicion(TENANT_A, {
      channel: 'green', mrn: '25ES00281234567890',
      levanteDate: new Date(), levanteNumber: 'LEV-XYZ', customsOffice: 'ES002801'
    }, {
      goods: [{ itemNumber: 1, description: 'Zapatos', quantity: 10, invoiceValue: 500, taricCode: '6403990000' }]
    });
    const req = mockReq({ user: adminA, params: { expeditionId: exp._id.toString() } });
    const res = mockRes();
    await channelController.getLevante(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.levanteNumber).toBe('LEV-XYZ');
    expect(res.body.data.importer.nif).toBe('B12345678');
    expect(res.body.data.goods).toHaveLength(1);
    expect(res.body.data.goods[0].description).toBe('Zapatos');
  });
});

describe('getChannelStats', () => {
  test('agrega por canal y acota por tenant', async () => {
    await sembrarExpedicion(TENANT_A, { channel: 'green', mrn: 'A1', channelAssignedAt: new Date() });
    await sembrarExpedicion(TENANT_A, { channel: 'red', mrn: 'A2', channelAssignedAt: new Date() });
    // Ruido de otro tenant que NO debe contar.
    await sembrarExpedicion(TENANT_B, { channel: 'green', mrn: 'B1', channelAssignedAt: new Date() });

    const req = mockReq({ user: adminA });
    const res = mockRes();
    await channelController.getChannelStats(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.green.count).toBe(1);
    expect(res.body.data.red.count).toBe(1);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.green.percentage).toBe(50);
  });
});

describe('getChannelExpeditions', () => {
  test('lista expedientes con canal del propio tenant, no de otros', async () => {
    await sembrarExpedicion(TENANT_A, { channel: 'green', mrn: 'A1', channelAssignedAt: new Date() });
    await sembrarExpedicion(TENANT_B, { channel: 'red', mrn: 'B1', channelAssignedAt: new Date() });

    const req = mockReq({ user: adminA });
    const res = mockRes();
    await channelController.getChannelExpeditions(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].channel).toBe('green');
    expect(res.body.data[0].type).toBe('expedition');
  });

  test('combina expedientes y declaraciones H7 con canal, ordenados por fecha', async () => {
    await sembrarExpedicion(TENANT_A, { channel: 'green', mrn: 'A1', channelAssignedAt: new Date(Date.now() - 60000) });
    await sembrarH7({
      tenantId: TENANT_A, reference: 'H7-REF-1', channel: 'orange', mrn: 'H7MRN1',
      recipientName: 'Destinatario H7', submittedAt: new Date()
    });

    const req = mockReq({ user: adminA });
    const res = mockRes();
    await channelController.getChannelExpeditions(req, res);

    expect(res.body.success).toBe(true);
    const tipos = res.body.data.map(d => d.type);
    expect(tipos).toContain('expedition');
    expect(tipos).toContain('h7');
    const h7 = res.body.data.find(d => d.type === 'h7');
    expect(h7.channel).toBe('orange');
    expect(h7.clientName).toBe('Destinatario H7');
  });
});

// Ramas H7 de estadisticas + los catch 500. Los 500 se fuerzan con un id que no
// es un ObjectId valido: findById revienta con CastError antes del guard.
describe('ramas H7 y manejo de errores', () => {
  test('getChannelStats suma tambien las H7 con canal', async () => {
    await sembrarExpedicion(TENANT_A, { channel: 'green', mrn: 'A1', channelAssignedAt: new Date() });
    await sembrarH7({
      tenantId: TENANT_A, reference: 'H7-STAT-1', channel: 'green', mrn: 'H7S1',
      recipientName: 'X', submittedAt: new Date()
    });

    const req = mockReq({ user: adminA });
    const res = mockRes();
    await channelController.getChannelStats(req, res);

    // 1 expedicion verde + 1 H7 verde => green.count === 2
    expect(res.body.data.green.count).toBe(2);
    expect(res.body.data.total).toBe(2);
  });

  test('getChannelStatus responde 500 ante un id invalido', async () => {
    const req = mockReq({ user: adminA, params: { expeditionId: 'no-es-un-objectid' } });
    const res = mockRes();
    await channelController.getChannelStatus(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/estado del canal/);
  });

  test('getLevante responde 500 ante un id invalido', async () => {
    const req = mockReq({ user: adminA, params: { expeditionId: 'no-es-un-objectid' } });
    const res = mockRes();
    await channelController.getLevante(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/levante/);
  });

  test('processChannelManually responde 500 ante un id invalido', async () => {
    const req = mockReq({ user: adminA, params: { expeditionId: 'no-es-un-objectid' }, body: { channel: 'orange' } });
    const res = mockRes();
    await channelController.processChannelManually(req, res);

    expect(res.statusCode).toBe(500);
  });
});
