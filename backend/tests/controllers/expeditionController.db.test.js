/**
 * expeditionController: CRUD del expediente contra Mongo real.
 *
 * El expediente es el nucleo del producto y todo cuelga de su aislamiento por
 * tenant. Lo que se prueba de verdad:
 *   1. create: transforma la entrada, fija tenantId/createdBy del usuario y
 *      persiste (con el modelo real, no mockeado -- ahi vive la validacion).
 *   2. El guard de tenant en getById/update/remove: con el id de un expediente
 *      de otro tenant, la respuesta es 404 "no encontrado", nunca los datos.
 *   3. remove solo borra borradores/cancelados.
 *   4. getStats acota por tenant (admin ve SU tenant, no el de todos).
 *   5. calculateDocumentCompletion (via list): el % de documentacion.
 *
 * Que se mockea y por que: aiService sale a Bedrock, emailService envia correo
 * y documentChecklists.getChecklist es una utilidad ya cubierta aparte -- son
 * dependencias externas al controller. El modelo Expedition NO se mockea: es
 * justo donde estan las reglas (required, enums, tenantId) que dan valor al test.
 *
 * BD en memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// documentChecklists: utilidad pura ya cubierta; aqui devuelve algo predecible.
jest.mock('../../src/utils/documentChecklists', () => ({
  getChecklist: jest.fn(() => [
    { documentType: 'commercial_invoice', required: true, received: false },
    { documentType: 'packing_list', required: false, received: false }
  ])
}));
jest.mock('../../src/services/emailService', () => ({ sendPortalLink: jest.fn() }));
jest.mock('../../src/services/aiService', () => ({}));

const { Expedition, ChatMessage } = require('../../src/models');
const ctrl = require('../../src/controllers/expeditionController');

usarBaseDeDatosEnMemoria();

// getUnreadCount es un static que sale a la coleccion de mensajes; no es el
// codigo bajo prueba, se neutraliza para que list no dependa del chat.
beforeAll(() => {
  jest.spyOn(ChatMessage, 'getUnreadCount').mockResolvedValue(0);
});

/** Usuario simulado de un tenant. */
function usuario({ tenant, role = 'operator' } = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: tenant || new mongoose.Types.ObjectId(),
    role,
    name: 'Operario',
    email: 'op@ejemplo.es',
    profile: {}
  };
}

/** Res simulado que captura status y json. */
function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

/** Cuerpo minimo valido para crear un expediente. */
function cuerpoValido(extra = {}) {
  return {
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'b12345678' },
    goods: [{ description: 'Cafe', quantity: 10, invoiceValue: 1000 }],
    ...extra
  };
}

/** Persiste un expediente minimo directamente para un tenant/usuario dado. */
async function crearExpediente(user, extra = {}) {
  return Expedition.create({
    tenantId: user.tenantId,
    createdBy: user._id,
    assignedTo: user._id,
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B99999999' },
    status: 'draft',
    ...extra
  });
}

describe('create', () => {
  test('persiste el expediente con el tenant y el creador del usuario', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({ body: cuerpoValido(), user }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    const guardado = await Expedition.findById(res.body.data._id);
    expect(String(guardado.tenantId)).toBe(String(user.tenantId));
    expect(String(guardado.createdBy)).toBe(String(user._id));
    expect(guardado.status).toBe('draft');
  });

  test('normaliza el NIF a mayusculas y genera el EORI', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({ body: cuerpoValido({ client: { companyName: 'X', nif: 'b12345678' } }), user }, res);

    expect(res.body.data.client.nif).toBe('B12345678');
    expect(res.body.data.client.eori).toBe('ESB12345678');
  });

  test('numera los goods y castea los importes', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: cuerpoValido({ goods: [{ description: 'A', quantity: '5', invoiceValue: '200' }] }), user
    }, res);

    const g = res.body.data.goods[0];
    expect(g.itemNumber).toBe(1);
    expect(g.quantity).toBe(5);
    expect(g.invoiceValue).toBe(200);
  });

  test('un cuerpo sin tipo de operacion falla la validacion con 500', async () => {
    // operationType es required en el esquema: el modelo real lo rechaza.
    const user = usuario();
    const res = crearRes();

    await ctrl.create({ body: { transportMode: 'maritime' }, user }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('getById: guard de tenant', () => {
  test('devuelve el expediente al dueno del tenant', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    const res = crearRes();

    await ctrl.getById({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(String(res.body.data._id)).toBe(String(exp._id));
  });

  test('un usuario de otro tenant recibe 404, no los datos', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno);
    const intruso = usuario();
    const res = crearRes();

    await ctrl.getById({ params: { id: exp._id }, user: intruso }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.data).toBeUndefined();
  });

  test('un id inexistente da 404', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.getById({ params: { id: new mongoose.Types.ObjectId() }, user }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('update: guard de tenant y timeline', () => {
  test('actualiza solo los campos permitidos', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    const res = crearRes();

    await ctrl.update({
      params: { id: exp._id },
      body: { priority: 'high', expeditionId: 'HACKEADO' }, // expeditionId no esta en la allowlist
      user
    }, res);

    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.expeditionId).not.toBe('HACKEADO');
  });

  test('un cambio de estado deja rastro en el timeline', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { status: 'draft' });
    const res = crearRes();

    await ctrl.update({ params: { id: exp._id }, body: { status: 'pending_documents' }, user }, res);

    const evento = res.body.data.timeline.find(t => t.action === 'status_change');
    expect(evento).toBeTruthy();
    expect(evento.metadata.newStatus).toBe('pending_documents');
  });

  test('un usuario de otro tenant no puede actualizar (404)', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno);
    const intruso = usuario();
    const res = crearRes();

    await ctrl.update({ params: { id: exp._id }, body: { priority: 'urgent' }, user: intruso }, res);

    expect(res.statusCode).toBe(404);
    // El documento no se toco.
    const sinCambios = await Expedition.findById(exp._id);
    expect(sinCambios.priority).not.toBe('urgent');
  });
});

describe('remove', () => {
  test('borra un expediente en borrador', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { status: 'draft' });
    const res = crearRes();

    await ctrl.remove({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(await Expedition.findById(exp._id)).toBeNull();
  });

  test('no borra un expediente ya presentado', async () => {
    // Solo draft/cancelled. Borrar uno presentado perderia el rastro AEAT.
    const user = usuario();
    const exp = await crearExpediente(user, { status: 'declaration_submitted' });
    const res = crearRes();

    await ctrl.remove({ params: { id: exp._id }, user }, res);

    expect(res.statusCode).toBe(400);
    expect(await Expedition.findById(exp._id)).not.toBeNull();
  });

  test('un usuario de otro tenant no puede borrar (404)', async () => {
    const dueno = usuario();
    const exp = await crearExpediente(dueno, { status: 'draft' });
    const intruso = usuario();
    const res = crearRes();

    await ctrl.remove({ params: { id: exp._id }, user: intruso }, res);

    expect(res.statusCode).toBe(404);
    expect(await Expedition.findById(exp._id)).not.toBeNull();
  });
});

describe('getStats: acota por tenant', () => {
  test('cuenta solo los expedientes del tenant del usuario', async () => {
    const admin = usuario({ role: 'admin' });
    const ajeno = usuario();
    await crearExpediente(admin, { status: 'draft' });
    await crearExpediente(admin, { status: 'declaration_submitted' });
    await crearExpediente(ajeno, { status: 'draft' }); // otro tenant, no debe contar

    const res = crearRes();
    await ctrl.getStats({ user: admin, query: {} }, res);

    expect(res.body.data.summary.total).toBe(2);
    expect(res.body.data.byStatus.draft).toBe(1);
    expect(res.body.data.byStatus.declaration_submitted).toBe(1);
  });
});

describe('list: calculateDocumentCompletion', () => {
  test('el porcentaje de documentacion cuenta solo los requeridos recibidos', async () => {
    const user = usuario();
    // 2 requeridos, 1 recibido => 50%. El opcional no cuenta.
    await crearExpediente(user, {
      documentChecklist: [
        { documentType: 'commercial_invoice', required: true, received: true },
        { documentType: 'bill_of_lading', required: true, received: false },
        { documentType: 'packing_list', required: false, received: false }
      ]
    });
    const res = crearRes();

    await ctrl.list({ user, query: {} }, res);

    expect(res.body.data.expeditions[0].documentCompletion).toBe(50);
  });

  test('sin documentos requeridos el completado es 100%', async () => {
    const user = usuario();
    await crearExpediente(user, {
      documentChecklist: [{ documentType: 'packing_list', required: false, received: false }]
    });
    const res = crearRes();

    await ctrl.list({ user, query: {} }, res);

    expect(res.body.data.expeditions[0].documentCompletion).toBe(100);
  });
});
