/**
 * paymentService — camino STRIPE CONFIGURADO + webhook handlers de suscripción.
 *
 * Los tests .db/.extra.db existentes cubren el modo mock (sin Stripe). Aquí
 * cubrimos el resto: la rama en la que `stripe` está inicializado.
 *
 * El módulo captura `stripe` y `PLAN_PRICE_MAP` al CARGARSE (según env). Por eso
 * preparamos la env ANTES de requerir el servicio y mockeamos el SDK `stripe`
 * con `jest.mock` (hoisted, sin isolateModules). NO recargamos el módulo por
 * test: los modelos Mongoose son singletons y aislar el módulo los duplicaría
 * → las escrituras quedarían en una conexión distinta de la del helper de
 * memoria y colgarían (trampa ya conocida). Cargamos el servicio una sola vez.
 *
 * Frontera externa: el SDK de `stripe` (mock — NUNCA se llama a la API real ni
 * a producción). Los modelos Payment/Tenant se usan con Mongo EN MEMORIA
 * (reales) para verificar de verdad las escrituras de suscripción.
 *
 * jest.config: resetMocks:true → las implementaciones de los mocks del SDK se
 * fijan en beforeEach.
 */

// Env ANTES de cargar el servicio (se leen a nivel de módulo).
process.env.STRIPE_SECRET_KEY = 'sk_test_ficticio';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_ficticio';
process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY = 'price_prof_m';

// Mock del SDK de Stripe: la fábrica devuelve un cliente con los métodos usados.
// El prefijo `mock` es el único que Jest permite referenciar desde la fábrica
// hoisted de jest.mock().
const mockStripe = {
  checkout: { sessions: { create: jest.fn() } },
  customers: { create: jest.fn() },
  subscriptions: { retrieve: jest.fn() },
  billingPortal: { sessions: { create: jest.fn() } },
  refunds: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() }
};
jest.mock('stripe', () => jest.fn(() => mockStripe));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { Payment, Tenant } = require('../../src/models');
const svc = require('../../src/services/paymentService');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

beforeEach(() => {
  // Reinstalar implementaciones (resetMocks las limpia entre tests).
  mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_test_1', url: 'https://stripe/checkout' });
  mockStripe.customers.create.mockResolvedValue({ id: 'cus_test_1' });
  mockStripe.subscriptions.retrieve.mockResolvedValue({
    status: 'trialing',
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    trial_end: 1701000000
  });
  mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://stripe/portal' });
  mockStripe.refunds.create.mockResolvedValue({ id: 're_test_1' });
});

afterAll(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY;
});

/** Crea un tenant con suscripción base. */
async function crearTenant(overrides = {}) {
  return Tenant.create({
    name: 'ACME',
    slug: 'acme-' + new mongoose.Types.ObjectId().toString().slice(-6),
    subscription: { plan: 'professional', status: 'active', ...(overrides.subscription || {}) },
    ...overrides
  });
}

// ==================== createCheckoutSession (Stripe real) ====================
describe('createCheckoutSession con Stripe activo', () => {
  test('crea sesión de checkout, guarda sessionId y pasa a processing', async () => {
    const payment = await Payment.create({
      organizationId: new mongoose.Types.ObjectId(),
      paymentId: Payment.generatePaymentId(),
      clientEmail: 'cliente@x.com',
      items: [{ description: 'Aranceles', type: 'duty', amount: 100, currency: 'EUR', reference: 'R1' }],
      subtotal: 100,
      totalAmount: 100,
      status: 'pending'
    });

    const r = await svc.createCheckoutSession(payment.paymentId, 'tok-123');

    expect(r.sessionId).toBe('cs_test_1');
    expect(r.url).toBe('https://stripe/checkout');
    // Se construyó line_items con unit_amount en céntimos.
    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.line_items[0].price_data.unit_amount).toBe(10000);
    expect(args.mode).toBe('payment');

    const recargado = await Payment.findOne({ paymentId: payment.paymentId });
    expect(recargado.status).toBe('processing');
    expect(recargado.stripe.checkoutSessionId).toBe('cs_test_1');
  });

  test('lanza si el pago no existe', async () => {
    await expect(svc.createCheckoutSession('NOPE', 'tok')).rejects.toThrow('Payment not found');
  });

  test('lanza si el pago no está pending', async () => {
    const payment = await Payment.create({
      organizationId: new mongoose.Types.ObjectId(),
      paymentId: Payment.generatePaymentId(),
      items: [{ description: 'x', type: 'duty', amount: 10, currency: 'EUR', reference: 'R' }],
      subtotal: 10,
      totalAmount: 10,
      status: 'completed'
    });
    await expect(svc.createCheckoutSession(payment.paymentId, 'tok')).rejects.toThrow('not pending');
  });
});

// ==================== handleWebhook: verificación de firma + switch ====================
describe('handleWebhook', () => {
  test('verifica la firma con el SDK y enruta payment_intent.succeeded', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1', metadata: {} } }
    });
    const r = await svc.handleWebhook('{}', 'sig');
    expect(r).toEqual({ received: true });
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith('{}', 'sig', 'whsec_ficticio');
  });

  test('lanza si la verificación de firma falla', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => { throw new Error('bad sig'); });
    await expect(svc.handleWebhook('{}', 'sig')).rejects.toThrow('Webhook signature verification failed');
  });

  test('checkout.session.completed modo subscription → activa suscripción del tenant', async () => {
    const tenant = await crearTenant();
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {
        mode: 'subscription',
        subscription: 'sub_1',
        customer: 'cus_1',
        metadata: { tenantId: tenant._id.toString(), plan: 'business' }
      } }
    });
    await svc.handleWebhook('{}', 'sig');
    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.plan).toBe('business');
    expect(t.subscription.stripeSubscriptionId).toBe('sub_1');
    // status trialing (el mock de subscriptions.retrieve devuelve trialing).
    expect(t.subscription.status).toBe('trialing');
  });

  test('checkout.session.completed modo payment → delega en handleCheckoutComplete', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', metadata: {} } }
    });
    // Sin payment asociado no debe lanzar (handler tolera ausencia).
    const r = await svc.handleWebhook('{}', 'sig');
    expect(r).toEqual({ received: true });
  });

  test('tipo de evento no manejado no lanza', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({ type: 'ping.unknown', data: { object: {} } });
    const r = await svc.handleWebhook('{}', 'sig');
    expect(r).toEqual({ received: true });
  });
});

// ==================== webhook handlers de suscripción (Mongo real) ====================
describe('handlers de suscripción', () => {
  test('handleSubscriptionCheckoutComplete sin tenantId no hace nada', async () => {
    await expect(svc.handleSubscriptionCheckoutComplete({ metadata: {} })).resolves.toBeUndefined();
  });

  test('handleSubscriptionCheckoutComplete con tenant inexistente no lanza', async () => {
    await expect(svc.handleSubscriptionCheckoutComplete({
      metadata: { tenantId: new mongoose.Types.ObjectId().toString(), plan: 'business' },
      subscription: 'sub_x'
    })).resolves.toBeUndefined();
  });

  test('handleInvoicePaid renueva el periodo del tenant', async () => {
    const tenant = await crearTenant({ subscription: { plan: 'business', status: 'past_due', stripeSubscriptionId: 'sub_9' } });
    await svc.handleInvoicePaid({ subscription: 'sub_9', period_start: 1700000000, period_end: 1702592000 });
    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.status).toBe('active');
    expect(t.subscription.currentPeriodEnd.getTime()).toBe(1702592000 * 1000);
  });

  test('handleInvoicePaid sin subscription retorna sin tocar nada', async () => {
    await expect(svc.handleInvoicePaid({})).resolves.toBeUndefined();
  });

  test('handleInvoicePaymentFailed marca past_due', async () => {
    const tenant = await crearTenant({ subscription: { plan: 'business', status: 'active', stripeSubscriptionId: 'sub_pf' } });
    await svc.handleInvoicePaymentFailed({ subscription: 'sub_pf' });
    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.status).toBe('past_due');
  });

  test('handleSubscriptionUpdated actualiza estado y cancel_at_period_end', async () => {
    const tenant = await crearTenant({ subscription: { plan: 'business', status: 'active', stripeSubscriptionId: 'sub_up' } });
    await svc.handleSubscriptionUpdated({
      id: 'sub_up', status: 'active', cancel_at_period_end: true, current_period_end: 1702592000
    });
    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.cancelAtPeriodEnd).toBe(true);
  });

  test('handleSubscriptionDeleted degrada a professional y cancela', async () => {
    const tenant = await crearTenant({ subscription: { plan: 'enterprise', status: 'active', stripeSubscriptionId: 'sub_del' } });
    await svc.handleSubscriptionDeleted({ id: 'sub_del' });
    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.status).toBe('cancelled');
    expect(t.subscription.plan).toBe('professional');
    expect(t.subscription.stripeSubscriptionId).toBeNull();
  });
});

// ==================== createSubscriptionCheckout ====================
describe('createSubscriptionCheckout', () => {
  test('plan free → activa starter sin Stripe y devuelve freePlan', async () => {
    const tenant = await crearTenant();
    const r = await svc.createSubscriptionCheckout({ tenantId: tenant._id }, 'free');
    expect(r.freePlan).toBe(true);
    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.plan).toBe('starter');
  });

  test('plan sin priceId configurado lanza error explicativo', async () => {
    // business no tiene STRIPE_PRICE_BUSINESS_* en la env de test.
    await expect(svc.createSubscriptionCheckout({ _id: new mongoose.Types.ObjectId(), email: 'a@x.com' }, 'business'))
      .rejects.toThrow(/Price ID/);
  });

  test('crea customer nuevo y sesión de suscripción cuando hay priceId', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_sub_1', url: 'https://stripe/sub' });
    const tenant = await crearTenant();
    const user = { _id: new mongoose.Types.ObjectId(), email: 'u@x.com', name: 'U', tenantId: tenant._id };
    const r = await svc.createSubscriptionCheckout(user, 'professional', 'monthly');

    expect(r.sessionId).toBe('cs_sub_1');
    expect(mockStripe.customers.create).toHaveBeenCalled();
    const t = await Tenant.findById(tenant._id);
    expect(t.subscription.stripeCustomerId).toBe('cus_test_1');
  });

  test('reutiliza el stripeCustomerId existente del tenant', async () => {
    const tenant = await crearTenant({ subscription: { plan: 'professional', status: 'active', stripeCustomerId: 'cus_existente' } });
    const user = { _id: new mongoose.Types.ObjectId(), email: 'u@x.com', name: 'U', tenantId: tenant._id };
    await svc.createSubscriptionCheckout(user, 'professional', 'monthly');
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    const args = mockStripe.checkout.sessions.create.mock.calls.at(-1)[0];
    expect(args.customer).toBe('cus_existente');
  });

  test('starter se normaliza a professional', async () => {
    const tenant = await crearTenant();
    const user = { _id: new mongoose.Types.ObjectId(), email: 'u@x.com', name: 'U', tenantId: tenant._id };
    await svc.createSubscriptionCheckout(user, 'starter', 'monthly');
    const args = mockStripe.checkout.sessions.create.mock.calls.at(-1)[0];
    expect(args.metadata.plan).toBe('professional');
  });
});

// ==================== createCustomerPortalSession ====================
describe('createCustomerPortalSession', () => {
  test('devuelve la URL del portal si hay customerId', async () => {
    const tenant = await crearTenant({ subscription: { plan: 'business', status: 'active', stripeCustomerId: 'cus_portal' } });
    const r = await svc.createCustomerPortalSession({ tenantId: tenant._id });
    expect(r.url).toBe('https://stripe/portal');
  });

  test('lanza si el tenant no tiene customer de Stripe', async () => {
    const tenant = await crearTenant();
    await expect(svc.createCustomerPortalSession({ tenantId: tenant._id }))
      .rejects.toThrow('No Stripe customer found');
  });
});

// ==================== getSubscriptionStatus ====================
describe('getSubscriptionStatus', () => {
  test('sin tenantId devuelve plan free por defecto', async () => {
    const r = await svc.getSubscriptionStatus(null);
    expect(r.plan).toBe('free');
    expect(r.stripeCustomerId).toBeNull();
  });

  test('tenant inexistente devuelve free/active', async () => {
    const r = await svc.getSubscriptionStatus(new mongoose.Types.ObjectId());
    expect(r).toEqual({ plan: 'free', status: 'active' });
  });

  test('devuelve la suscripción real del tenant', async () => {
    const tenant = await crearTenant({ subscription: { plan: 'enterprise', status: 'active', stripeCustomerId: 'cus_z', stripeSubscriptionId: 'sub_z' } });
    const r = await svc.getSubscriptionStatus(tenant._id);
    expect(r.plan).toBe('enterprise');
    expect(r.stripeSubscriptionId).toBe('sub_z');
  });
});
