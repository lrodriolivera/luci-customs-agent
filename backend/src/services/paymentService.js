/**
 * Payment Service
 * Phase 6.7: Portal Cliente Avanzado
 * Handles Stripe integration for online payments
 */

const logger = require('../config/logger');
const { Payment, Expedition, Tenant } = require('../models');

// Stripe initialization
let stripe;
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (stripeKey && stripeKey.startsWith('sk_')) {
  stripe = require('stripe')(stripeKey);
  logger.info('Stripe initialized in ' + (stripeKey.startsWith('sk_live') ? 'LIVE' : 'TEST') + ' mode');
} else {
  logger.warn('Stripe not configured (no valid STRIPE_SECRET_KEY). Running in mock mode.');
  stripe = null;
}

// Plan -> Stripe Price ID mapping
const PLAN_PRICE_MAP = {
  professional: {
    monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || process.env.STRIPE_PRICE_PROFESSIONAL,
    yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY
  }
};

class PaymentService {
  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.currency = 'eur';
    this.successUrl = process.env.PAYMENT_SUCCESS_URL || 'http://localhost:3001/portal/{token}/payment/success';
    this.cancelUrl = process.env.PAYMENT_CANCEL_URL || 'http://localhost:3001/portal/{token}/payment/cancel';
  }

  /**
   * Create a payment for expedition duties/taxes
   */
  async createExpeditionPayment(expeditionId, organizationId, options = {}) {
    const expedition = await Expedition.findById(expeditionId);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    // Calculate items from expedition
    const items = this.calculatePaymentItems(expedition);

    if (items.length === 0) {
      throw new Error('No payable items found');
    }

    const payment = new Payment({
      organizationId,
      paymentId: Payment.generatePaymentId(),
      clientEmail: expedition.client?.contact?.email,
      clientName: expedition.client?.companyName,
      items,
      portalToken: expedition.clientPortal?.token,
      metadata: {
        expeditionId: expedition._id,
        expeditionNumber: expedition.expeditionId
      }
    });

    payment.calculateTotals();
    await payment.save();

    logger.info(`Payment created: ${payment.paymentId} for expedition ${expedition.expeditionId}`);

    return payment;
  }

  /**
   * Calculate payment items from expedition
   */
  calculatePaymentItems(expedition) {
    const items = [];

    // Add duties if calculated
    if (expedition.calculations?.dutyTotal > 0) {
      items.push({
        description: `Derechos de aduana - ${expedition.expeditionId}`,
        type: 'duty',
        amount: expedition.calculations.dutyTotal,
        currency: 'EUR',
        reference: expedition.declaration?.mrn || expedition.expeditionId,
        expeditionId: expedition._id
      });
    }

    // Add VAT if calculated
    if (expedition.calculations?.vatTotal > 0) {
      items.push({
        description: `IVA Importacion - ${expedition.expeditionId}`,
        type: 'vat',
        amount: expedition.calculations.vatTotal,
        currency: 'EUR',
        reference: expedition.declaration?.mrn || expedition.expeditionId,
        expeditionId: expedition._id
      });
    }

    // Add special taxes if any
    if (expedition.calculations?.specialTaxTotal > 0) {
      items.push({
        description: `Impuestos especiales - ${expedition.expeditionId}`,
        type: 'special_tax',
        amount: expedition.calculations.specialTaxTotal,
        currency: 'EUR',
        reference: expedition.expeditionId,
        expeditionId: expedition._id
      });
    }

    return items;
  }

  /**
   * Create Stripe Checkout Session
   */
  async createCheckoutSession(paymentId, portalToken) {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending') {
      throw new Error(`Payment is not pending: ${payment.status}`);
    }

    // If Stripe not configured, return mock session
    if (!stripe) {
      const mockSessionId = `cs_mock_${Date.now()}`;
      payment.stripe.checkoutSessionId = mockSessionId;
      payment.status = 'processing';
      await payment.save();

      return {
        sessionId: mockSessionId,
        url: `${this.successUrl.replace('{token}', portalToken)}?session_id=${mockSessionId}`,
        mockMode: true
      };
    }

    // Build line items for Stripe
    const lineItems = payment.items.map(item => ({
      price_data: {
        currency: this.currency,
        product_data: {
          name: item.description,
          metadata: {
            type: item.type,
            reference: item.reference
          }
        },
        unit_amount: Math.round(item.amount * 100) // Stripe uses cents
      },
      quantity: 1
    }));

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: this.successUrl.replace('{token}', portalToken) + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: this.cancelUrl.replace('{token}', portalToken),
      customer_email: payment.clientEmail,
      metadata: {
        paymentId: payment.paymentId,
        portalToken
      },
      billing_address_collection: 'required',
      locale: 'es'
    });

    // Update payment with session info
    payment.stripe.checkoutSessionId = session.id;
    payment.status = 'processing';
    await payment.save();

    logger.info(`Stripe checkout session created: ${session.id} for payment ${paymentId}`);

    return {
      sessionId: session.id,
      url: session.url
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload, signature) {
    let event;

    if (stripe && this.webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      } catch (err) {
        logger.error('Webhook signature verification failed:', err.message);
        throw new Error('Webhook signature verification failed');
      }
    } else {
      // Mock mode - parse payload directly
      event = JSON.parse(payload);
    }

    logger.info(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      // Subscription events
      case 'checkout.session.completed':
        if (event.data.object.mode === 'subscription') {
          await this.handleSubscriptionCheckoutComplete(event.data.object);
        } else {
          await this.handleCheckoutComplete(event.data.object);
        }
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;

      // One-time payment events
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      case 'charge.refunded':
        await this.handleRefund(event.data.object);
        break;

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle checkout session completed
   */
  async handleCheckoutComplete(session) {
    const payment = await Payment.findOne({
      'stripe.checkoutSessionId': session.id
    });

    if (!payment) {
      logger.warn(`Payment not found for session: ${session.id}`);
      return;
    }

    // Add webhook event to tracking
    payment.webhookEvents.push({
      eventId: session.id,
      eventType: 'checkout.session.completed',
      processed: true
    });

    // Update with payment intent
    if (session.payment_intent) {
      payment.stripe.paymentIntentId = session.payment_intent;
    }

    // Get payment details
    if (stripe && session.payment_intent) {
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);

      payment.paymentMethod = {
        type: paymentIntent.payment_method_types?.[0],
        brand: paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.brand,
        last4: paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.last4
      };

      payment.stripe.chargeId = paymentIntent.charges?.data?.[0]?.id;
      payment.stripe.receiptUrl = paymentIntent.charges?.data?.[0]?.receipt_url;
    }

    // Update billing address
    if (session.customer_details) {
      payment.billingAddress = {
        name: session.customer_details.name,
        address: session.customer_details.address?.line1,
        city: session.customer_details.address?.city,
        postalCode: session.customer_details.address?.postal_code,
        country: session.customer_details.address?.country
      };
    }

    await payment.markAsPaid();

    // Update expedition status if linked
    await this.updateExpeditionAfterPayment(payment);

    logger.info(`Payment completed: ${payment.paymentId}`);
  }

  /**
   * Handle payment success
   */
  async handlePaymentSuccess(paymentIntent) {
    const payment = await Payment.findOne({
      'stripe.paymentIntentId': paymentIntent.id
    });

    if (payment && payment.status !== 'completed') {
      await payment.markAsPaid({
        chargeId: paymentIntent.charges?.data?.[0]?.id,
        receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url
      });
    }
  }

  /**
   * Handle payment failed
   */
  async handlePaymentFailed(paymentIntent) {
    const payment = await Payment.findOne({
      'stripe.paymentIntentId': paymentIntent.id
    });

    if (payment) {
      const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
      await payment.markAsFailed(failureMessage);
      logger.info(`Payment failed: ${payment.paymentId} - ${failureMessage}`);
    }
  }

  /**
   * Handle refund
   */
  async handleRefund(charge) {
    const payment = await Payment.findOne({
      'stripe.chargeId': charge.id
    });

    if (payment) {
      const refundAmount = charge.amount_refunded / 100;
      await payment.processRefund(
        refundAmount,
        'Refund via Stripe',
        null,
        charge.refunds?.data?.[0]?.id
      );
      logger.info(`Payment refunded: ${payment.paymentId} - ${refundAmount}${payment.currency}`);
    }
  }

  /**
   * Update expedition after successful payment
   */
  async updateExpeditionAfterPayment(payment) {
    const expeditionIds = [...new Set(
      payment.items
        .filter(item => item.expeditionId)
        .map(item => item.expeditionId.toString())
    )];

    for (const expId of expeditionIds) {
      const expedition = await Expedition.findById(expId);
      if (expedition) {
        expedition.timeline.push({
          action: 'payment_received',
          description: `Pago recibido: ${payment.totalAmount} ${payment.currency}`,
          performedBy: 'system',
          metadata: {
            paymentId: payment.paymentId,
            amount: payment.totalAmount
          }
        });

        // Mark as paid in calculations
        if (!expedition.calculations) {
          expedition.calculations = {};
        }
        expedition.calculations.paid = true;
        expedition.calculations.paidAt = new Date();
        expedition.calculations.paymentId = payment.paymentId;

        await expedition.save();
      }
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId) {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      throw new Error('Payment not found');
    }

    return payment.toClientSummary();
  }

  /**
   * Get payments by portal token
   */
  async getPaymentsByPortalToken(portalToken) {
    return Payment.find({ portalToken })
      .sort({ createdAt: -1 })
      .limit(20);
  }

  /**
   * Get pending payment for expedition
   */
  async getPendingPaymentForExpedition(expeditionId) {
    return Payment.findOne({
      'items.expeditionId': expeditionId,
      status: 'pending'
    });
  }

  /**
   * Create manual payment record (for bank transfers, etc.)
   */
  async createManualPayment(organizationId, data) {
    const payment = new Payment({
      organizationId,
      paymentId: Payment.generatePaymentId(),
      clientEmail: data.clientEmail,
      clientName: data.clientName,
      items: data.items,
      paymentMethod: { type: 'bank_transfer' },
      billingAddress: data.billingAddress,
      notes: data.notes,
      metadata: data.metadata
    });

    payment.calculateTotals();
    await payment.save();

    return payment;
  }

  /**
   * Confirm manual payment
   */
  async confirmManualPayment(paymentId, userId) {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      throw new Error('Payment not found');
    }

    payment.status = 'completed';
    payment.paidAt = new Date();
    payment.metadata = {
      ...payment.metadata,
      confirmedBy: userId,
      confirmedAt: new Date()
    };

    await payment.save();

    // Update related expeditions
    await this.updateExpeditionAfterPayment(payment);

    return payment;
  }

  /**
   * Process refund
   */
  async refundPayment(paymentId, amount, reason, userId) {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'completed') {
      throw new Error('Can only refund completed payments');
    }

    const refundAmount = amount || payment.totalAmount;

    if (refundAmount > payment.totalAmount) {
      throw new Error('Refund amount exceeds payment amount');
    }

    // Process Stripe refund if applicable
    let stripeRefundId;
    if (stripe && payment.stripe.paymentIntentId) {
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe.paymentIntentId,
        amount: Math.round(refundAmount * 100)
      });
      stripeRefundId = refund.id;
    }

    await payment.processRefund(refundAmount, reason, userId, stripeRefundId);

    logger.info(`Payment refunded: ${paymentId} - ${refundAmount}${payment.currency} by user ${userId}`);

    return payment;
  }

  // ==================== SUBSCRIPTION METHODS ====================

  /**
   * Create Stripe Checkout Session for a subscription plan
   */
  async createSubscriptionCheckout(user, plan, billingCycle = 'monthly') {
    // Legacy starter redirect to professional
    if (plan === 'starter') {
      plan = 'professional';
    }
    // Handle legacy free plan
    if (plan === 'free') {
      const tenant = user.tenantId ? await Tenant.findById(user.tenantId) : null;
      if (tenant) {
        tenant.subscription.plan = 'starter';
        tenant.subscription.status = 'active';
        tenant.subscription.currentPeriodStart = new Date();
        tenant.subscription.currentPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const limits = Tenant.getDefaultLimits('starter');
        if (limits) tenant.limits = limits;
        await tenant.save();
      }
      return {
        url: (process.env.FRONTEND_URL || 'https://aduanas.strixai.es') + '/billing?success=true&plan=starter',
        sessionId: null,
        freePlan: true
      };
    }

    const priceId = PLAN_PRICE_MAP[plan]?.[billingCycle];

    if (!priceId) {
      throw new Error(`No hay Price ID configurado para el plan ${plan} (${billingCycle}). Configure STRIPE_PRICE_${plan.toUpperCase()}_${billingCycle.toUpperCase()} en .env`);
    }

    if (!stripe) {
      // Mock mode - simular suscripcion
      logger.info(`[MOCK] Subscription checkout for ${user.email}, plan=${plan}`);
      const tenant = await Tenant.findById(user.tenantId);
      if (tenant) {
        tenant.subscription.plan = plan;
        tenant.subscription.status = 'active';
        tenant.subscription.currentPeriodStart = new Date();
        tenant.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await tenant.save();
      }
      return {
        url: (process.env.FRONTEND_URL || 'https://aduanas.strixai.es') + '/billing?mock=true',
        sessionId: `cs_mock_${Date.now()}`,
        mockMode: true
      };
    }

    // Find or create Stripe customer
    let customerId;
    const tenant = user.tenantId ? await Tenant.findById(user.tenantId) : null;

    if (tenant?.subscription?.stripeCustomerId) {
      customerId = tenant.subscription.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString(),
          tenantId: user.tenantId?.toString() || ''
        }
      });
      customerId = customer.id;

      // Save customer ID to tenant
      if (tenant) {
        tenant.subscription.stripeCustomerId = customerId;
        await tenant.save();
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://aduanas.strixai.es';

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      subscription_data: {
        trial_period_days: plan !== 'free' ? 14 : undefined,
        metadata: {
          tenantId: user.tenantId?.toString() || '',
          plan
        }
      },
      success_url: `${frontendUrl}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${frontendUrl}/billing?cancelled=true`,
      locale: 'es',
      metadata: {
        userId: user._id.toString(),
        tenantId: user.tenantId?.toString() || '',
        plan,
        billingCycle
      }
    });

    logger.info(`Stripe checkout session created: ${session.id} for user ${user.email}, plan=${plan}`);

    return {
      url: session.url,
      sessionId: session.id
    };
  }

  /**
   * Create a Stripe Customer Portal session (for managing subscription)
   */
  async createCustomerPortalSession(user) {
    const tenant = user.tenantId ? await Tenant.findById(user.tenantId) : null;
    const customerId = tenant?.subscription?.stripeCustomerId;

    if (!customerId || !stripe) {
      throw new Error('No Stripe customer found for this account');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://aduanas.strixai.es';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/billing`
    });

    return { url: session.url };
  }

  /**
   * Get subscription status for a tenant
   */
  async getSubscriptionStatus(tenantId) {
    if (!tenantId) {
      return { plan: 'free', status: 'active', stripeCustomerId: null, stripeSubscriptionId: null };
    }
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return { plan: 'free', status: 'active' };

    const sub = tenant.subscription || {};
    return {
      plan: sub.plan || 'free',
      status: sub.status || 'active',
      stripeCustomerId: sub.stripeCustomerId || null,
      stripeSubscriptionId: sub.stripeSubscriptionId || null,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
      trialEnd: sub.trialEnd
    };
  }

  // ==================== SUBSCRIPTION WEBHOOK HANDLERS ====================

  /**
   * Handle subscription checkout completed
   */
  async handleSubscriptionCheckoutComplete(session) {
    const tenantId = session.metadata?.tenantId;
    const plan = session.metadata?.plan;
    const subscriptionId = session.subscription;

    if (!tenantId) {
      logger.warn('Subscription checkout without tenantId metadata');
      return;
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      logger.warn(`Tenant ${tenantId} not found for subscription checkout`);
      return;
    }

    // Get subscription details from Stripe
    let subDetails = {};
    if (stripe && subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      subDetails = {
        status: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null
      };
    }

    tenant.subscription.plan = plan || 'professional';
    tenant.subscription.status = subDetails.status === 'trialing' ? 'trialing' : 'active';
    tenant.subscription.stripeSubscriptionId = subscriptionId;
    tenant.subscription.stripeCustomerId = session.customer;
    tenant.subscription.currentPeriodStart = subDetails.currentPeriodStart || new Date();
    tenant.subscription.currentPeriodEnd = subDetails.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    tenant.subscription.trialEnd = subDetails.trialEnd;

    // Update plan limits
    const limits = Tenant.getDefaultLimits(plan || 'professional');
    if (limits) tenant.limits = limits;

    await tenant.save();
    logger.info(`Subscription activated for tenant ${tenantId}: plan=${plan}, stripeSubId=${subscriptionId}`);
  }

  /**
   * Handle invoice.paid - subscription renewal
   */
  async handleInvoicePaid(invoice) {
    const subId = invoice.subscription;
    if (!subId) return;

    const tenant = await Tenant.findOne({ 'subscription.stripeSubscriptionId': subId });
    if (!tenant) return;

    tenant.subscription.status = 'active';
    if (invoice.period_end) {
      tenant.subscription.currentPeriodEnd = new Date(invoice.period_end * 1000);
    }
    if (invoice.period_start) {
      tenant.subscription.currentPeriodStart = new Date(invoice.period_start * 1000);
    }

    await tenant.save();
    logger.info(`Invoice paid for tenant ${tenant._id}, subscription renewed`);
  }

  /**
   * Handle invoice.payment_failed
   */
  async handleInvoicePaymentFailed(invoice) {
    const subId = invoice.subscription;
    if (!subId) return;

    const tenant = await Tenant.findOne({ 'subscription.stripeSubscriptionId': subId });
    if (!tenant) return;

    tenant.subscription.status = 'past_due';
    await tenant.save();
    logger.warn(`Payment failed for tenant ${tenant._id}. Subscription marked as past_due.`);
  }

  /**
   * Handle customer.subscription.updated
   */
  async handleSubscriptionUpdated(subscription) {
    const tenant = await Tenant.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
    if (!tenant) return;

    tenant.subscription.status = subscription.status;
    if (subscription.cancel_at_period_end) {
      tenant.subscription.cancelAtPeriodEnd = true;
    }
    tenant.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await tenant.save();
    logger.info(`Subscription updated for tenant ${tenant._id}: status=${subscription.status}`);
  }

  /**
   * Handle customer.subscription.deleted
   */
  async handleSubscriptionDeleted(subscription) {
    const tenant = await Tenant.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
    if (!tenant) return;

    tenant.subscription.plan = 'professional';
    tenant.subscription.status = 'cancelled';
    tenant.subscription.stripeSubscriptionId = null;
    tenant.subscription.cancelAtPeriodEnd = false;

    // Reset to professional plan limits
    const limits = Tenant.getDefaultLimits('professional');
    if (limits) tenant.limits = limits;

    await tenant.save();
    logger.info(`Subscription cancelled for tenant ${tenant._id}. Downgraded to professional plan.`);
  }

  /**
   * Get payment stats for organization
   */
  async getPaymentStats(organizationId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    const matchStage = { organizationId: organizationId };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const result = {
      total: { count: 0, amount: 0 },
      byStatus: {}
    };

    for (const stat of stats) {
      result.byStatus[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount
      };
      result.total.count += stat.count;
      if (stat._id === 'completed') {
        result.total.amount += stat.totalAmount;
      }
    }

    return result;
  }
}

module.exports = new PaymentService();
