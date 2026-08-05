/**
 * clientPortalController — Portal Cliente Avanzado (Fase 6.7): self-service,
 * pagos, estadísticas, documentos firmados y gestión de API keys.
 *
 * Estrategia de mocks (frontera):
 *  - clientPortalService y paymentService SE MOCKEAN: son las fronteras externas
 *    (Stripe/PDF) y además clientPortalService ya está cubierto por sus propios
 *    tests db. Este controller es un wrapper delgado: reenvía y, sobre todo,
 *    MAPEA el status de error (404 vs 400 vs 500) según error.message. Ese mapeo
 *    es la lógica propia que aquí se ejercita de verdad.
 *  - ClientApiKey y Expedition NO se mockean: los 3 handlers de API keys y
 *    createPayment/getClientHistory tocan el modelo directamente, así que
 *    generateKey()/toSafeJSON()/revoke() y findByPortalToken() corren de verdad
 *    contra Mongo en memoria.
 *
 * jest.config: resetMocks:true borra la implementación de los jest.fn de fábrica
 * antes de cada test → se restauran en beforeEach.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/clientPortalService');
jest.mock('../../src/services/paymentService');

const clientPortalService = require('../../src/services/clientPortalService');
const paymentService = require('../../src/services/paymentService');
const clientPortalController = require('../../src/controllers/clientPortalController');
const { Expedition, ClientApiKey } = require('../../src/models');

usarBaseDeDatosEnMemoria();

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}

function mockReq({ params = {}, body = {}, query = {}, user, organizationId, headers = {}, rawBody } = {}) {
  return { params, body, query, user, organizationId, headers, rawBody };
}

let ORG_A;
let USER_A;

beforeEach(() => {
  ORG_A = new mongoose.Types.ObjectId();
  USER_A = new mongoose.Types.ObjectId();
});

async function sembrarExp(over = {}) {
  return Expedition.create({
    tenantId: ORG_A,
    expeditionId: over.expeditionId || `IMP-${Date.now()}-${Math.round(performance.now())}`,
    operationType: 'import',
    transportMode: 'maritime',
    status: 'draft',
    client: { companyName: 'Cliente SL', nif: 'B12345678', eori: 'ESB12345678' },
    createdBy: new mongoose.Types.ObjectId(),
    ...over
  });
}

// ==================== Self-Service ====================

describe('createExpedition', () => {
  test('400 si falta client.companyName o email', async () => {
    const res = mockRes();
    await clientPortalController.createExpedition(
      mockReq({ organizationId: ORG_A, body: { client: { companyName: 'X' }, operation: { operationType: 'import' } } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/empresa y email/);
  });

  test('400 si falta operation.operationType', async () => {
    const res = mockRes();
    await clientPortalController.createExpedition(
      mockReq({ organizationId: ORG_A, body: { client: { companyName: 'X', email: 'a@b.c' }, operation: {} } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/tipo de operacion/);
  });

  test('400 si no hay organizationId ni en req ni en body', async () => {
    const res = mockRes();
    await clientPortalController.createExpedition(
      mockReq({ body: { client: { companyName: 'X', email: 'a@b.c' }, operation: { operationType: 'import' } } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Organization ID required/);
  });

  test('201 delega en el service y devuelve el resultado', async () => {
    clientPortalService.createExpeditionFromPortal.mockResolvedValue({ expeditionId: 'IMP-1', portalToken: 'tok-1' });
    const res = mockRes();
    await clientPortalController.createExpedition(
      mockReq({ organizationId: ORG_A, body: { client: { companyName: 'X', email: 'a@b.c' }, operation: { operationType: 'import' } } }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expeditionId).toBe('IMP-1');
    expect(clientPortalService.createExpeditionFromPortal).toHaveBeenCalledWith(
      ORG_A, { companyName: 'X', email: 'a@b.c' }, { operationType: 'import' });
  });

  test('usa organizationId del body cuando no viene en req', async () => {
    clientPortalService.createExpeditionFromPortal.mockResolvedValue({ expeditionId: 'IMP-2' });
    const res = mockRes();
    await clientPortalController.createExpedition(
      mockReq({ body: { organizationId: String(ORG_A), client: { companyName: 'X', email: 'a@b.c' }, operation: { operationType: 'import' } } }), res);
    expect(res.statusCode).toBe(201);
    expect(clientPortalService.createExpeditionFromPortal).toHaveBeenCalledWith(
      String(ORG_A), expect.any(Object), expect.any(Object));
  });

  test('500 si el service falla', async () => {
    clientPortalService.createExpeditionFromPortal.mockRejectedValue(new Error('boom'));
    const res = mockRes();
    await clientPortalController.createExpedition(
      mockReq({ organizationId: ORG_A, body: { client: { companyName: 'X', email: 'a@b.c' }, operation: { operationType: 'import' } } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('boom');
  });
});

describe('updateExpedition', () => {
  test('mapea a 404 cuando el mensaje incluye "not found"', async () => {
    clientPortalService.updateExpeditionFromPortal.mockRejectedValue(new Error('Expedition not found'));
    const res = mockRes();
    await clientPortalController.updateExpedition(mockReq({ params: { token: 't' }, body: {} }), res);
    expect(res.statusCode).toBe(404);
  });

  test('mapea a 400 para otros errores', async () => {
    clientPortalService.updateExpeditionFromPortal.mockRejectedValue(new Error('invalid status'));
    const res = mockRes();
    await clientPortalController.updateExpedition(mockReq({ params: { token: 't' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito devuelve id/status/updatedAt', async () => {
    clientPortalService.updateExpeditionFromPortal.mockResolvedValue(
      { expeditionId: 'IMP-1', status: 'draft', updatedAt: new Date('2026-01-01') });
    const res = mockRes();
    await clientPortalController.updateExpedition(mockReq({ params: { token: 't' }, body: { incoterm: 'FOB' } }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expeditionId).toBe('IMP-1');
  });
});

describe('submitExpedition', () => {
  test('404 si "not found"', async () => {
    clientPortalService.submitExpedition.mockRejectedValue(new Error('not found'));
    const res = mockRes();
    await clientPortalController.submitExpedition(mockReq({ params: { token: 't' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('400 en otros errores', async () => {
    clientPortalService.submitExpedition.mockRejectedValue(new Error('missing documents'));
    const res = mockRes();
    await clientPortalController.submitExpedition(mockReq({ params: { token: 't' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    clientPortalService.submitExpedition.mockResolvedValue({ expeditionId: 'IMP-1', status: 'pending_documents' });
    const res = mockRes();
    await clientPortalController.submitExpedition(mockReq({ params: { token: 't' } }), res);
    expect(res.body.data.status).toBe('pending_documents');
  });
});

// ==================== Pagos ====================

describe('getPayments', () => {
  test('combina pendientes + historial mapeado', async () => {
    clientPortalService.getPendingPayments.mockResolvedValue({ amount: 100 });
    paymentService.getPaymentsByPortalToken.mockResolvedValue([
      { toClientSummary: () => ({ paymentId: 'PAY-1' }) }
    ]);
    const res = mockRes();
    await clientPortalController.getPayments(mockReq({ params: { token: 't' } }), res);
    expect(res.body.data.pending.amount).toBe(100);
    expect(res.body.data.history[0].paymentId).toBe('PAY-1');
  });

  test('500 en error genérico', async () => {
    clientPortalService.getPendingPayments.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await clientPortalController.getPayments(mockReq({ params: { token: 't' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('createPayment', () => {
  test('404 si no existe el expediente (token real)', async () => {
    const res = mockRes();
    await clientPortalController.createPayment(mockReq({ params: { token: 'nope' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('devuelve el pago pendiente existente sin crear otro', async () => {
    const exp = await sembrarExp({ clientPortal: { token: 'tok-cp-1', isActive: true } });
    paymentService.getPendingPaymentForExpedition.mockResolvedValue(
      { toClientSummary: () => ({ paymentId: 'PAY-EXIST' }) });
    const res = mockRes();
    await clientPortalController.createPayment(mockReq({ params: { token: 'tok-cp-1' } }), res);
    expect(res.body.data.payment.paymentId).toBe('PAY-EXIST');
    expect(paymentService.createExpeditionPayment).not.toHaveBeenCalled();
    expect(exp).toBeTruthy();
  });

  test('crea un pago nuevo acotado al tenant del expediente', async () => {
    await sembrarExp({ clientPortal: { token: 'tok-cp-2', isActive: true } });
    paymentService.getPendingPaymentForExpedition.mockResolvedValue(null);
    paymentService.createExpeditionPayment.mockResolvedValue({
      paymentId: 'PAY-NEW', totalAmount: 121, currency: 'EUR',
      items: [{ description: 'Arancel', type: 'duty', amount: 100 }]
    });
    const res = mockRes();
    await clientPortalController.createPayment(mockReq({ params: { token: 'tok-cp-2' } }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.paymentId).toBe('PAY-NEW');
    // El segundo argumento debe ser el tenantId del expediente (ORG_A).
    const [, tenantArg] = paymentService.createExpeditionPayment.mock.calls[0];
    expect(String(tenantArg)).toBe(String(ORG_A));
  });

  test('500 si createExpeditionPayment falla', async () => {
    await sembrarExp({ clientPortal: { token: 'tok-cp-3', isActive: true } });
    paymentService.getPendingPaymentForExpedition.mockResolvedValue(null);
    paymentService.createExpeditionPayment.mockRejectedValue(new Error('stripe error'));
    const res = mockRes();
    await clientPortalController.createPayment(mockReq({ params: { token: 'tok-cp-3' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('createCheckoutSession', () => {
  test('devuelve la sesión del service', async () => {
    paymentService.createCheckoutSession.mockResolvedValue({ url: 'https://stripe/checkout' });
    const res = mockRes();
    await clientPortalController.createCheckoutSession(mockReq({ params: { token: 't', paymentId: 'PAY-1' } }), res);
    expect(res.body.data.url).toBe('https://stripe/checkout');
  });

  test('500 si falla', async () => {
    paymentService.createCheckoutSession.mockRejectedValue(new Error('no session'));
    const res = mockRes();
    await clientPortalController.createCheckoutSession(mockReq({ params: { token: 't', paymentId: 'PAY-1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getPaymentStatus', () => {
  test('éxito', async () => {
    paymentService.getPaymentStatus.mockResolvedValue({ status: 'completed' });
    const res = mockRes();
    await clientPortalController.getPaymentStatus(mockReq({ params: { paymentId: 'PAY-1' } }), res);
    expect(res.body.data.status).toBe('completed');
  });

  test('404 si "not found"', async () => {
    paymentService.getPaymentStatus.mockRejectedValue(new Error('payment not found'));
    const res = mockRes();
    await clientPortalController.getPaymentStatus(mockReq({ params: { paymentId: 'X' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('500 en otros errores', async () => {
    paymentService.getPaymentStatus.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await clientPortalController.getPaymentStatus(mockReq({ params: { paymentId: 'X' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('handleStripeWebhook', () => {
  test('devuelve el resultado del service', async () => {
    paymentService.handleWebhook.mockResolvedValue({ received: true });
    const res = mockRes();
    await clientPortalController.handleStripeWebhook(
      mockReq({ headers: { 'stripe-signature': 'sig' }, rawBody: Buffer.from('x') }), res);
    expect(res.body.received).toBe(true);
    expect(paymentService.handleWebhook).toHaveBeenCalledWith(expect.anything(), 'sig');
  });

  test('400 si la firma es inválida', async () => {
    paymentService.handleWebhook.mockRejectedValue(new Error('bad signature'));
    const res = mockRes();
    await clientPortalController.handleStripeWebhook(mockReq({ headers: {}, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });
});

// ==================== Estadísticas ====================

describe('getClientStats', () => {
  test('éxito', async () => {
    clientPortalService.getClientStats.mockResolvedValue({ totalExpeditions: 3 });
    const res = mockRes();
    await clientPortalController.getClientStats(mockReq({ params: { token: 't' } }), res);
    expect(res.body.data.totalExpeditions).toBe(3);
  });

  test('404 si "not found"', async () => {
    clientPortalService.getClientStats.mockRejectedValue(new Error('token not found'));
    const res = mockRes();
    await clientPortalController.getClientStats(mockReq({ params: { token: 'X' } }), res);
    expect(res.statusCode).toBe(404);
  });
});

describe('getClientHistory', () => {
  test('404 si no existe el expediente (token real)', async () => {
    const res = mockRes();
    await clientPortalController.getClientHistory(mockReq({ params: { token: 'nope' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('sin email de contacto devuelve solo el expediente actual (sin llamar al service)', async () => {
    await sembrarExp({ expeditionId: 'IMP-H1', clientPortal: { token: 'tok-h-1', isActive: true } });
    const res = mockRes();
    await clientPortalController.getClientHistory(mockReq({ params: { token: 'tok-h-1' } }), res);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.expeditions[0].expeditionId).toBe('IMP-H1');
    expect(clientPortalService.getClientHistory).not.toHaveBeenCalled();
  });

  test('con email delega en el service acotando por tenantId', async () => {
    await sembrarExp({
      expeditionId: 'IMP-H2',
      clientPortal: { token: 'tok-h-2', isActive: true },
      client: { companyName: 'C', nif: 'B1', contact: { email: 'cli@ente.es' } }
    });
    clientPortalService.getClientHistory.mockResolvedValue({ expeditions: [], total: 0, hasMore: false });
    const res = mockRes();
    await clientPortalController.getClientHistory(
      mockReq({ params: { token: 'tok-h-2' }, query: { limit: '10', skip: '5', status: 'draft' } }), res);
    expect(res.body.success).toBe(true);
    const [tenantArg, emailArg, opts] = clientPortalService.getClientHistory.mock.calls[0];
    expect(String(tenantArg)).toBe(String(ORG_A));
    expect(emailArg).toBe('cli@ente.es');
    expect(opts.limit).toBe(10);
    expect(opts.skip).toBe(5);
    expect(opts.status).toBe('draft');
  });
});

// ==================== Documentos firmados ====================

describe('documentos firmados', () => {
  test('getSignedDocuments éxito', async () => {
    clientPortalService.getSignedDocuments.mockResolvedValue([{ type: 'levante' }]);
    const res = mockRes();
    await clientPortalController.getSignedDocuments(mockReq({ params: { token: 't' } }), res);
    expect(res.body.data[0].type).toBe('levante');
  });

  test('getSignedDocuments 404 si "not found"', async () => {
    clientPortalService.getSignedDocuments.mockRejectedValue(new Error('not found'));
    const res = mockRes();
    await clientPortalController.getSignedDocuments(mockReq({ params: { token: 'X' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('downloadLevante éxito', async () => {
    clientPortalService.generateLevanteDocument.mockResolvedValue({ mrn: '25ES001' });
    const res = mockRes();
    await clientPortalController.downloadLevante(mockReq({ params: { token: 't' } }), res);
    expect(res.body.data.mrn).toBe('25ES001');
  });

  test('downloadLevante 500 en error genérico', async () => {
    clientPortalService.generateLevanteDocument.mockRejectedValue(new Error('render failed'));
    const res = mockRes();
    await clientPortalController.downloadLevante(mockReq({ params: { token: 't' } }), res);
    expect(res.statusCode).toBe(500);
  });

  test('downloadDeclaration éxito', async () => {
    clientPortalService.generateDeclarationCopy.mockResolvedValue({ type: 'H1' });
    const res = mockRes();
    await clientPortalController.downloadDeclaration(mockReq({ params: { token: 't' } }), res);
    expect(res.body.data.type).toBe('H1');
  });

  test('downloadDeclaration 404 si "not found"', async () => {
    clientPortalService.generateDeclarationCopy.mockRejectedValue(new Error('declaration not found'));
    const res = mockRes();
    await clientPortalController.downloadDeclaration(mockReq({ params: { token: 'X' } }), res);
    expect(res.statusCode).toBe(404);
  });
});

// ==================== API Keys (modelo real) ====================

describe('createApiKey', () => {
  test('400 si falta name', async () => {
    const res = mockRes();
    await clientPortalController.createApiKey(
      mockReq({ user: { organizationId: ORG_A, _id: USER_A }, body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/name is required/);
  });

  test('crea la key, la persiste y devuelve la clave en claro una sola vez', async () => {
    const res = mockRes();
    await clientPortalController.createApiKey(
      mockReq({ user: { organizationId: ORG_A, _id: USER_A }, body: { name: 'ERP prod', description: 'integración' } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.key).toMatch(/^lca_/);
    // toSafeJSON no debe exponer el hash.
    expect(res.body.data.keyHash).toBeUndefined();

    const guardada = await ClientApiKey.findOne({ organizationId: ORG_A });
    expect(guardada).not.toBeNull();
    expect(guardada.name).toBe('ERP prod');
    expect(guardada.keyPrefix).toMatch(/^lca_/);
    // Se persiste el hash, nunca la clave en claro.
    expect(guardada.keyHash).toBeTruthy();
    // Permisos por defecto.
    expect(guardada.permissions).toEqual(['expeditions:read', 'documents:read']);
    expect(String(guardada.createdBy)).toBe(String(USER_A));
  });

  test('respeta permisos y expiración explícitos', async () => {
    const res = mockRes();
    await clientPortalController.createApiKey(mockReq({
      user: { organizationId: ORG_A, _id: USER_A },
      body: { name: 'ro', permissions: ['stats:read'], expiresAt: '2027-01-01T00:00:00Z' }
    }), res);
    const guardada = await ClientApiKey.findOne({ organizationId: ORG_A, name: 'ro' });
    expect(guardada.permissions).toEqual(['stats:read']);
    expect(guardada.expiresAt).toBeInstanceOf(Date);
  });

  test('500 si el guardado falla (permiso fuera del enum)', async () => {
    const res = mockRes();
    await clientPortalController.createApiKey(mockReq({
      user: { organizationId: ORG_A, _id: USER_A },
      body: { name: 'bad', permissions: ['permiso:inexistente'] }
    }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('listApiKeys', () => {
  test('lista solo las no revocadas de la organización, más recientes primero', async () => {
    const { hash: h1, prefix: p1 } = ClientApiKey.generateKey();
    const { hash: h2, prefix: p2 } = ClientApiKey.generateKey();
    const { hash: h3, prefix: p3 } = ClientApiKey.generateKey();
    await ClientApiKey.create({ organizationId: ORG_A, name: 'k1', keyHash: h1, keyPrefix: p1, createdBy: USER_A });
    await ClientApiKey.create({ organizationId: ORG_A, name: 'k2', keyHash: h2, keyPrefix: p2, createdBy: USER_A, status: 'revoked' });
    // Otra organización: no debe aparecer.
    await ClientApiKey.create({ organizationId: new mongoose.Types.ObjectId(), name: 'ajena', keyHash: h3, keyPrefix: p3, createdBy: USER_A });

    const res = mockRes();
    await clientPortalController.listApiKeys(mockReq({ user: { organizationId: ORG_A } }), res);
    expect(res.body.success).toBe(true);
    const nombres = res.body.data.map(k => k.name);
    expect(nombres).toEqual(['k1']);
  });
});

describe('revokeApiKey', () => {
  test('404 si la key no es de la organización', async () => {
    const { hash, prefix } = ClientApiKey.generateKey();
    const ajena = await ClientApiKey.create({
      organizationId: new mongoose.Types.ObjectId(), name: 'ajena', keyHash: hash, keyPrefix: prefix, createdBy: USER_A });
    const res = mockRes();
    await clientPortalController.revokeApiKey(
      mockReq({ user: { organizationId: ORG_A, _id: USER_A }, params: { keyId: String(ajena._id) }, body: {} }), res);
    expect(res.statusCode).toBe(404);
  });

  test('revoca la key propia y persiste el motivo', async () => {
    const { hash, prefix } = ClientApiKey.generateKey();
    const propia = await ClientApiKey.create({
      organizationId: ORG_A, name: 'propia', keyHash: hash, keyPrefix: prefix, createdBy: USER_A });
    const res = mockRes();
    await clientPortalController.revokeApiKey(
      mockReq({ user: { organizationId: ORG_A, _id: USER_A }, params: { keyId: String(propia._id) }, body: { reason: 'fuga' } }), res);

    expect(res.body.success).toBe(true);
    const tras = await ClientApiKey.findById(propia._id);
    expect(tras.status).toBe('revoked');
    expect(tras.revokeReason).toBe('fuga');
    expect(String(tras.revokedBy)).toBe(String(USER_A));
  });

  test('500 si keyId no es un ObjectId válido', async () => {
    const res = mockRes();
    await clientPortalController.revokeApiKey(
      mockReq({ user: { organizationId: ORG_A, _id: USER_A }, params: { keyId: 'no-es-objectid' }, body: {} }), res);
    expect(res.statusCode).toBe(500);
  });
});
