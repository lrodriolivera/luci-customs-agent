/**
 * paymentService (complemento): cobros de expedicion, checkout mock, consultas,
 * webhooks y SUSCRIPCIONES, contra Mongo real.
 *
 * paymentService.db.test.js ya cubre alta manual/confirmacion/reembolso y
 * calculatePaymentItems. Aqui se cubre el resto de la logica de negocio que NO
 * sale a red (Stripe corre en modo mock por no haber STRIPE_SECRET_KEY en test):
 *   1. createExpeditionPayment: monta el cobro desde los calculos de la
 *      expedicion; expedicion inexistente y sin tributos pagables.
 *   2. createCheckoutSession en modo mock: pasa a processing; guard de estado y
 *      de existencia.
 *   3. Consultas: getPaymentStatus / getPaymentsByPortalToken /
 *      getPendingPaymentForExpedition / getPaymentStats (agrega y suma solo lo
 *      completado).
 *   4. handleWebhook en modo mock (parsea el JSON del payload): enruta por tipo
 *      y actualiza el cobro; evento no manejado no revienta.
 *   5. Suscripciones sobre el Tenant: alta free->starter, error sin Price ID,
 *      estado, y los handlers de renovacion/impago/cancelacion.
 *
 * Que se mockea y por que: NADA propio. Stripe ya esta en modo mock por entorno.
 * Payment/Expedition/Tenant van con la BD en memoria real. NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const { Payment, Expedition, Tenant } = require('../../src/models');
const paymentService = require('../../src/services/paymentService');

usarBaseDeDatosEnMemoria();

const ORG = () => new mongoose.Types.ObjectId();

/** Expedicion con calculos, apta para generar un cobro. */
async function crearExpedicion(extra = {}) {
  return Expedition.create({
    reference: 'EXP-PAY-1',
    tenantId: new mongoose.Types.ObjectId(),
    client: { nif: 'B22477020', companyName: 'STRIX AI SL', contact: { email: 'pago@strixai.es' } },
    transportMode: 'maritime',
    operationType: 'import',
    calculations: { totalDuties: 100, totalVat: 210, totalSpecialTaxes: 0 },
    ...extra
  });
}

/** Tenant con una suscripcion dada. */
async function crearTenant(sub = {}) {
  return Tenant.create({
    name: 'Cliente SL',
    slug: 'cliente-' + new mongoose.Types.ObjectId().toString().slice(-6),
    subscription: { plan: 'free', status: 'active', ...sub }
  });
}

describe('createExpeditionPayment', () => {
  test('crea un cobro pendiente con las lineas de la expedicion', async () => {
    const org = ORG();
    const exp = await crearExpedicion();

    const payment = await paymentService.createExpeditionPayment(exp._id, org);
    expect(payment.status).toBe('pending');
    expect(payment.organizationId.toString()).toBe(org.toString());
    expect(payment.items).toHaveLength(2);   // derechos + IVA
    expect(payment.totalAmount).toBe(310);   // calculateTotals
    expect(payment.paymentId).toMatch(/^PAY-/);
  });

  test('expedicion inexistente lanza error', async () => {
    await expect(
      paymentService.createExpeditionPayment(new mongoose.Types.ObjectId(), ORG())
    ).rejects.toThrow(/Expedition not found/);
  });

  test('expedicion sin tributos pagables lanza "No payable items"', async () => {
    const exp = await crearExpedicion({ calculations: { totalDuties: 0, totalVat: 0, totalSpecialTaxes: 0 } });
    await expect(
      paymentService.createExpeditionPayment(exp._id, ORG())
    ).rejects.toThrow(/No payable items/);
  });
});

describe('createCheckoutSession en modo mock (sin Stripe)', () => {
  test('devuelve una sesion mock y deja el cobro en processing', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    const payment = await paymentService.createExpeditionPayment(exp._id, org);

    const session = await paymentService.createCheckoutSession(payment.paymentId, 'tok-123');
    expect(session.mockMode).toBe(true);
    expect(session.sessionId).toMatch(/^cs_mock_/);

    const enBd = await Payment.findOne({ paymentId: payment.paymentId });
    expect(enBd.status).toBe('processing');
    expect(enBd.stripe.checkoutSessionId).toBe(session.sessionId);
  });

  test('cobro inexistente lanza "Payment not found"', async () => {
    await expect(paymentService.createCheckoutSession('PAY-NADA', 't')).rejects.toThrow(/Payment not found/);
  });

  test('un cobro que no esta pendiente no puede iniciar checkout', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    const payment = await paymentService.createExpeditionPayment(exp._id, org);
    payment.status = 'completed';
    await payment.save();

    await expect(
      paymentService.createCheckoutSession(payment.paymentId, 't')
    ).rejects.toThrow(/not pending/);
  });
});

describe('confirmManualPayment actualiza la expedicion vinculada', () => {
  test('marca la expedicion como pagada y anota el timeline', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    const payment = await paymentService.createManualPayment(org, {
      clientEmail: 'c@x.es',
      items: [{ description: 'Derechos', type: 'duty', amount: 100, expeditionId: exp._id }]
    });

    await paymentService.confirmManualPayment(payment.paymentId, 'user-1', org);

    const expBd = await Expedition.findById(exp._id);
    expect(expBd.calculations.paid).toBe(true);
    expect(expBd.timeline.some(t => t.action === 'payment_received')).toBe(true);
  });
});

describe('consultas de cobros', () => {
  test('getPaymentStatus devuelve el resumen para el cliente', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    const payment = await paymentService.createExpeditionPayment(exp._id, org);

    const resumen = await paymentService.getPaymentStatus(payment.paymentId);
    expect(resumen.paymentId).toBe(payment.paymentId);
    expect(resumen.totalAmount).toBe(310);
    expect(resumen.status).toBe('pending');
  });

  test('getPaymentStatus de un id inexistente lanza error', async () => {
    await expect(paymentService.getPaymentStatus('PAY-NADA')).rejects.toThrow(/Payment not found/);
  });

  test('getPaymentsByPortalToken filtra por token del portal', async () => {
    const org = ORG();
    const exp = await crearExpedicion({ clientPortal: { token: 'PT-1' } });
    const p = await paymentService.createExpeditionPayment(exp._id, org);
    expect(p.portalToken).toBe('PT-1'); // copiado de expedition.clientPortal.token

    const lista = await paymentService.getPaymentsByPortalToken('PT-1');
    expect(lista).toHaveLength(1);
  });

  test('getPendingPaymentForExpedition devuelve el cobro pendiente de la expedicion', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    await paymentService.createExpeditionPayment(exp._id, org);

    const pend = await paymentService.getPendingPaymentForExpedition(exp._id);
    expect(pend).not.toBeNull();
    expect(pend.status).toBe('pending');
  });

  test('getPaymentStats agrega por estado y suma solo lo completado', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    await paymentService.createExpeditionPayment(exp._id, org); // pending 310
    const manual = await paymentService.createManualPayment(org, {
      clientEmail: 'c@x.es', items: [{ description: 'D', type: 'duty', amount: 90 }]
    });
    await paymentService.confirmManualPayment(manual.paymentId, 'u', org); // completed 90

    const stats = await paymentService.getPaymentStats(org);
    expect(stats.total.count).toBe(2);
    expect(stats.total.amount).toBe(90); // solo completed
    expect(stats.byStatus.pending.count).toBe(1);
    expect(stats.byStatus.completed.amount).toBe(90);
  });
});

describe('handleWebhook en modo mock: enruta y actualiza', () => {
  test('checkout.session.completed (pago unico) marca el cobro como pagado', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    const payment = await paymentService.createExpeditionPayment(exp._id, org);
    const session = await paymentService.createCheckoutSession(payment.paymentId, 'tok');

    const evento = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: session.sessionId, mode: 'payment', customer_details: { name: 'Cliente' } } }
    });
    const res = await paymentService.handleWebhook(evento, 'sig');
    expect(res.received).toBe(true);

    const enBd = await Payment.findOne({ paymentId: payment.paymentId });
    expect(enBd.status).toBe('completed');
    expect(enBd.paidAt).toBeInstanceOf(Date);
  });

  test('payment_intent.payment_failed marca el cobro como fallido', async () => {
    const org = ORG();
    const exp = await crearExpedicion();
    const payment = await paymentService.createExpeditionPayment(exp._id, org);
    payment.stripe.paymentIntentId = 'pi_123';
    await payment.save();

    const evento = JSON.stringify({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_123', last_payment_error: { message: 'Tarjeta rechazada' } } }
    });
    await paymentService.handleWebhook(evento, 'sig');

    const enBd = await Payment.findOne({ paymentId: payment.paymentId });
    expect(enBd.status).toBe('failed');
    expect(enBd.failureReason).toBe('Tarjeta rechazada');
  });

  test('un tipo de evento no manejado no revienta', async () => {
    const evento = JSON.stringify({ type: 'foo.bar', data: { object: {} } });
    await expect(paymentService.handleWebhook(evento, 'sig')).resolves.toEqual({ received: true });
  });
});

describe('suscripciones', () => {
  test('createSubscriptionCheckout con plan free activa starter en el tenant', async () => {
    const tenant = await crearTenant();
    const user = { _id: new mongoose.Types.ObjectId(), email: 'u@x.es', name: 'U', tenantId: tenant._id };

    const r = await paymentService.createSubscriptionCheckout(user, 'free');
    expect(r.freePlan).toBe(true);

    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.plan).toBe('starter');
    expect(t.subscription.status).toBe('active');
  });

  test('un plan de pago sin Price ID configurado lanza error explicito', async () => {
    const user = { _id: new mongoose.Types.ObjectId(), email: 'u@x.es', name: 'U', tenantId: new mongoose.Types.ObjectId() };
    await expect(
      paymentService.createSubscriptionCheckout(user, 'enterprise', 'yearly')
    ).rejects.toThrow(/No hay Price ID configurado/);
  });

  test('getSubscriptionStatus sin tenant devuelve el plan free por defecto', async () => {
    const r = await paymentService.getSubscriptionStatus(null);
    expect(r.plan).toBe('free');
    expect(r.status).toBe('active');
  });

  test('getSubscriptionStatus devuelve la suscripcion real del tenant', async () => {
    const tenant = await crearTenant({ plan: 'business', status: 'trialing', stripeCustomerId: 'cus_1' });
    const r = await paymentService.getSubscriptionStatus(tenant._id);
    expect(r.plan).toBe('business');
    expect(r.status).toBe('trialing');
    expect(r.stripeCustomerId).toBe('cus_1');
  });

  test('handleInvoicePaymentFailed marca la suscripcion como past_due', async () => {
    const tenant = await crearTenant({ plan: 'professional', status: 'active', stripeSubscriptionId: 'sub_1' });
    await paymentService.handleInvoicePaymentFailed({ subscription: 'sub_1' });

    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.status).toBe('past_due');
  });

  test('handleSubscriptionDeleted degrada a professional y cancela', async () => {
    const tenant = await crearTenant({ plan: 'business', status: 'active', stripeSubscriptionId: 'sub_2' });
    await paymentService.handleSubscriptionDeleted({ id: 'sub_2' });

    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.status).toBe('cancelled');
    expect(t.subscription.plan).toBe('professional');
    expect(t.subscription.stripeSubscriptionId).toBeNull();
  });

  test('handleInvoicePaid reactiva la suscripcion', async () => {
    const tenant = await crearTenant({ plan: 'professional', status: 'past_due', stripeSubscriptionId: 'sub_3' });
    await paymentService.handleInvoicePaid({ subscription: 'sub_3', period_end: 1893456000, period_start: 1890777600 });

    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.status).toBe('active');
  });
});
