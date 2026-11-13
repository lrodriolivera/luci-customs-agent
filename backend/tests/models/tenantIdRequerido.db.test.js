/**
 * ChatMessage e InspectorCommunication NUEVOS no se guardan sin tenantId.
 *
 * Son los dos modelos a los que b8b5b02 anadio tenantId. Un documento nuevo sin
 * tenant no saldria en ningun listado de usuarios con tenant y pasaria
 * ensureSameTenant como legacy, asi que se rechaza. Los documentos antiguos sin
 * tenant (hasta que corra scripts/backfillTenantId.js) se siguen pudiendo
 * modificar: la obligacion es solo para los nuevos.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { InspectorCommunication, ChatMessage, Expedition, Report } = require('../../src/models');

usarBaseDeDatosEnMemoria();

async function expediente(tenantId) {
  return Expedition.create({
    expeditionId: 'EXP-' + new mongoose.Types.ObjectId().toString().slice(-6),
    ...(tenantId ? { tenantId } : {}),
    transportMode: 'maritime', operationType: 'import',
    client: { nif: 'B12345678', companyName: 'ACME' },
    goods: [{ itemNumber: 1, description: 'x', taricCode: '95030070', quantity: 1, invoiceValue: 10 }]
  });
}

const datosComunicacion = (extra = {}) => ({
  communicationType: 'allegation', category: 'appeal', subject: 'Alegacion',
  authority: { type: 'AEAT', name: 'Aduana' }, ...extra
});

describe('ChatMessage', () => {
  test('un mensaje nuevo toma el tenant del expediente', async () => {
    const tenant = new mongoose.Types.ObjectId();
    const exp = await expediente(tenant);
    const msg = await ChatMessage.create({ expedition: exp._id, sender: 'client', content: 'Hola' });
    expect(String(msg.tenantId)).toBe(String(tenant));
  });

  test('un mensaje nuevo en un expediente sin tenant se rechaza', async () => {
    const exp = await expediente(null);
    await expect(ChatMessage.create({ expedition: exp._id, sender: 'client', content: 'Hola' }))
      .rejects.toThrow(/tenantId/);
  });

  test('insertMany tambien exige tenantId', async () => {
    const exp = await expediente(null);
    await expect(ChatMessage.insertMany([{ expedition: exp._id, sender: 'client', content: 'Hola' }]))
      .rejects.toThrow(/tenantId/);
  });

  test('un mensaje antiguo sin tenant se puede seguir modificando', async () => {
    const exp = await expediente(null);
    const { insertedId } = await ChatMessage.collection.insertOne({ expedition: exp._id, sender: 'client', content: 'Antiguo', isRead: false });
    const msg = await ChatMessage.findById(insertedId);
    msg.isRead = true;
    await expect(msg.save()).resolves.toBeDefined();
  });
});

describe('InspectorCommunication', () => {
  test('una comunicacion nueva sin tenantId se rechaza', async () => {
    await expect(InspectorCommunication.create(datosComunicacion())).rejects.toThrow(/tenantId/);
  });

  test('insertMany tambien exige tenantId', async () => {
    await expect(InspectorCommunication.insertMany([datosComunicacion()])).rejects.toThrow(/tenantId/);
  });

  test('con tenantId se crea', async () => {
    const tenant = new mongoose.Types.ObjectId();
    const com = await InspectorCommunication.create(datosComunicacion({ tenantId: tenant }));
    expect(String(com.tenantId)).toBe(String(tenant));
  });

  test('una comunicacion antigua sin tenant se puede seguir modificando', async () => {
    const { insertedId } = await InspectorCommunication.collection.insertOne({ ...datosComunicacion(), active: true });
    const com = await InspectorCommunication.findById(insertedId);
    com.subject = 'Editada';
    await expect(com.save()).resolves.toBeDefined();
  });
});

/**
 * Report (PR 4.3: informes de analitica persistidos en Mongo). A diferencia de
 * ChatMessage/InspectorCommunication no hay documentos "antiguos" sin tenant
 * que respetar: es un modelo nuevo, asi que tenantId es obligatorio sin
 * excepcion para legado.
 */
describe('Report', () => {
  const datosInforme = (extra = {}) => ({
    generatedBy: new mongoose.Types.ObjectId(),
    type: 'executive_summary',
    format: 'pdf',
    period: 'last_30_days',
    ...extra
  });

  test('un informe nuevo sin tenantId se rechaza', async () => {
    await expect(Report.create(datosInforme())).rejects.toThrow(/tenantId/);
  });

  test('insertMany tambien exige tenantId', async () => {
    await expect(Report.insertMany([datosInforme()])).rejects.toThrow(/tenantId/);
  });

  test('con tenantId se crea', async () => {
    const tenant = new mongoose.Types.ObjectId();
    const rep = await Report.create(datosInforme({ tenantId: tenant }));
    expect(String(rep.tenantId)).toBe(String(tenant));
  });

  test('sin generatedBy se rechaza (siempre hay un autor autenticado)', async () => {
    const tenant = new mongoose.Types.ObjectId();
    const sinAutor = datosInforme({ tenantId: tenant });
    delete sinAutor.generatedBy;
    await expect(Report.create(sinAutor)).rejects.toThrow();
  });
});
