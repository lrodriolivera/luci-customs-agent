/**
 * scripts/backfillTenantId.js rellena el tenantId de InspectorCommunication y
 * ChatMessage antiguos copiandolo de su expediente.
 *
 * b8b5b02 anadio tenantId a esos dos modelos y acoto sus listados por el: los
 * documentos anteriores no lo tienen y dejan de salir para usuarios con tenant.
 *
 * Requisitos: --dry-run por defecto (no escribe nada salvo con --apply),
 * idempotente (una segunda pasada no cambia nada), y un informe de lo que no
 * se pudo resolver (sin expediente, expediente inexistente, expediente sin
 * tenant). Los documentos "antiguos" se insertan con el driver, sin pasar por
 * Mongoose, que es como estan hoy en la base.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { InspectorCommunication, ChatMessage, Expedition } = require('../../src/models');
const { backfillTenantId } = require('../../scripts/backfillTenantId');

usarBaseDeDatosEnMemoria();

const TENANT = new mongoose.Types.ObjectId();

async function expediente(tenantId) {
  const doc = {
    expeditionId: 'EXP-' + new mongoose.Types.ObjectId().toString().slice(-6),
    transportMode: 'maritime', operationType: 'import',
    client: { nif: 'B12345678', companyName: 'ACME' },
    goods: [{ itemNumber: 1, description: 'x', taricCode: '95030070', quantity: 1, invoiceValue: 10 }]
  };
  if (tenantId) doc.tenantId = tenantId;
  const r = await Expedition.collection.insertOne(doc);
  return r.insertedId;
}

let numero = 0;
const insertarComunicacion = (extra) => InspectorCommunication.collection.insertOne({
  communicationNumber: `COM-ANT-${++numero}`,
  communicationType: 'allegation', category: 'appeal', subject: 'Antigua', active: true,
  authority: { type: 'AEAT', name: 'Aduana' }, ...extra
});
const insertarMensaje = (extra) => ChatMessage.collection.insertOne({
  sender: 'client', content: 'Hola', ...extra
});

const leer = (Modelo, id) => Modelo.collection.findOne({ _id: id });
const silencio = { info: () => {}, warn: () => {} };

let expConTenant, expSinTenant;
let comBuena, comSinExp, comExpInexistente, comExpSinTenant, comYaConTenant;
let msgBueno, msgExpSinTenant;

beforeEach(async () => {
  expConTenant = await expediente(TENANT);
  expSinTenant = await expediente(null);

  comBuena = (await insertarComunicacion({ references: { expeditionId: expConTenant } })).insertedId;
  comSinExp = (await insertarComunicacion({ references: {} })).insertedId;
  comExpInexistente = (await insertarComunicacion({ references: { expeditionId: new mongoose.Types.ObjectId() } })).insertedId;
  comExpSinTenant = (await insertarComunicacion({ references: { expeditionId: expSinTenant } })).insertedId;
  const otroTenant = new mongoose.Types.ObjectId();
  comYaConTenant = (await insertarComunicacion({ tenantId: otroTenant, references: { expeditionId: expConTenant } })).insertedId;

  msgBueno = (await insertarMensaje({ expedition: expConTenant })).insertedId;
  msgExpSinTenant = (await insertarMensaje({ expedition: expSinTenant })).insertedId;
});

test('por defecto es dry-run: informa pero no escribe nada', async () => {
  const informe = await backfillTenantId({ logger: silencio });

  expect(informe.dryRun).toBe(true);
  expect(informe.InspectorCommunication.resolubles).toBe(1);
  expect(informe.ChatMessage.resolubles).toBe(1);
  expect((await leer(InspectorCommunication, comBuena)).tenantId).toBeUndefined();
  expect((await leer(ChatMessage, msgBueno)).tenantId).toBeUndefined();
});

test('con apply copia el tenant del expediente', async () => {
  const informe = await backfillTenantId({ apply: true, logger: silencio });

  expect(informe.dryRun).toBe(false);
  expect(informe.InspectorCommunication.actualizados).toBe(1);
  expect(informe.ChatMessage.actualizados).toBe(1);
  expect(String((await leer(InspectorCommunication, comBuena)).tenantId)).toBe(String(TENANT));
  expect(String((await leer(ChatMessage, msgBueno)).tenantId)).toBe(String(TENANT));
});

test('no toca los que ya tienen tenant', async () => {
  const antes = (await leer(InspectorCommunication, comYaConTenant)).tenantId;
  await backfillTenantId({ apply: true, logger: silencio });
  expect(String((await leer(InspectorCommunication, comYaConTenant)).tenantId)).toBe(String(antes));
});

test('es idempotente: la segunda pasada no actualiza nada', async () => {
  await backfillTenantId({ apply: true, logger: silencio });
  const segunda = await backfillTenantId({ apply: true, logger: silencio });
  expect(segunda.InspectorCommunication.actualizados).toBe(0);
  expect(segunda.ChatMessage.actualizados).toBe(0);
});

test('informa de cada documento que no puede resolver y por que', async () => {
  const informe = await backfillTenantId({ apply: true, logger: silencio });

  const porId = (lista) => Object.fromEntries(lista.map((x) => [String(x.id), x.motivo]));
  const com = porId(informe.InspectorCommunication.sinResolver);
  expect(com[String(comSinExp)]).toBe('sin expediente');
  expect(com[String(comExpInexistente)]).toBe('expediente inexistente');
  expect(com[String(comExpSinTenant)]).toBe('expediente sin tenant');
  expect(Object.keys(com)).toHaveLength(3);

  const msg = porId(informe.ChatMessage.sinResolver);
  expect(msg[String(msgExpSinTenant)]).toBe('expediente sin tenant');
  expect((await leer(InspectorCommunication, comSinExp)).tenantId).toBeUndefined();
});
