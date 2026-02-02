/**
 * Payment Service
 * Phase 6.7: Portal Cliente Avanzado
 * Handles Stripe integration for online payments
 */

const logger = require('../config/logger');
const { Payment, Expedition } = require('../models');

// Stripe initialization (use test key if not configured)
let stripe;
try {
  const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
  stripe = require('stripe')(stripeKey);
} catch (error) {
  logger.warn('Stripe not configured, using mock mode');
  stripe = null;
}

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
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object);
        break;

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
