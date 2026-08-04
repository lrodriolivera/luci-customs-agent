/**
 * Payment Model
 * Phase 6.7: Portal Cliente Avanzado
 * Manages payments for customs duties, VAT, and services
 */

const mongoose = require('mongoose');

const PaymentItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  type: {
    type: String,
    enum: ['duty', 'vat', 'special_tax', 'service_fee', 'inspection_fee', 'storage_fee', 'other'],
    required: true
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  reference: String, // MRN, expedition ID, etc.
  expeditionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition'
  }
}, { _id: true });

const PaymentSchema = new mongoose.Schema({
  // Organization reference
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // Client reference
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  clientEmail: String,
  clientName: String,

  // Payment identification
  paymentId: {
    type: String,
    required: true,
    unique: true
  },

  // Items being paid
  items: [PaymentItemSchema],

  // Totals
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },

  // Status
  status: {
    type: String,
    enum: [
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelled',
      'refunded',
      'partially_refunded'
    ],
    default: 'pending',
    index: true
  },

  // Stripe integration
  stripe: {
    customerId: String,
    paymentIntentId: String,
    checkoutSessionId: String,
    chargeId: String,
    receiptUrl: String,
    refundId: String
  },

  // Payment method details (from Stripe o alta manual).
  // OJO: el campo interno se llama `type`. Escrito como `type: String`, Mongoose
  // interpreta TODO el bloque como un SchemaType String y descarta brand/last4;
  // ademas rompe el alta manual, que asigna un objeto { type: 'bank_transfer' }.
  // La forma anidada `type: { type: String }` fuerza a tratarlo como subdocumento.
  paymentMethod: {
    type: { type: String }, // card, bank_transfer, etc.
    brand: String, // visa, mastercard, etc.
    last4: String,
    expiryMonth: Number,
    expiryYear: Number
  },

  // Billing address
  billingAddress: {
    name: String,
    company: String,
    address: String,
    city: String,
    postalCode: String,
    country: String,
    taxId: String // NIF/CIF
  },

  // Invoice
  invoice: {
    number: String,
    issuedAt: Date,
    pdfUrl: String
  },

  // Refund info
  refund: {
    amount: Number,
    reason: String,
    refundedAt: Date,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Timestamps
  paidAt: Date,
  failedAt: Date,
  failureReason: String,

  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  notes: String,

  // Portal token (for unauthenticated payments)
  portalToken: String,

  // Webhook tracking
  webhookEvents: [{
    eventId: String,
    eventType: String,
    receivedAt: { type: Date, default: Date.now },
    processed: { type: Boolean, default: false }
  }]

}, {
  timestamps: true
});

// Indexes
PaymentSchema.index({ organizationId: 1, status: 1 });
PaymentSchema.index({ 'stripe.paymentIntentId': 1 });
PaymentSchema.index({ 'stripe.checkoutSessionId': 1 });
PaymentSchema.index({ paymentId: 1 });
PaymentSchema.index({ clientEmail: 1 });
PaymentSchema.index({ portalToken: 1 });

// Generate payment ID
PaymentSchema.statics.generatePaymentId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PAY-${timestamp}-${random}`.toUpperCase();
};

// Calculate totals from items
PaymentSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
  this.totalAmount = this.subtotal + this.taxAmount;
  return this;
};

// Mark as paid
PaymentSchema.methods.markAsPaid = async function(stripeData = {}) {
  this.status = 'completed';
  this.paidAt = new Date();

  if (stripeData.chargeId) {
    this.stripe.chargeId = stripeData.chargeId;
  }
  if (stripeData.receiptUrl) {
    this.stripe.receiptUrl = stripeData.receiptUrl;
  }
  if (stripeData.paymentMethod) {
    this.paymentMethod = stripeData.paymentMethod;
  }

  await this.save();
  return this;
};

// Mark as failed
PaymentSchema.methods.markAsFailed = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  await this.save();
  return this;
};

// Process refund
PaymentSchema.methods.processRefund = async function(amount, reason, userId, stripeRefundId) {
  const isPartial = amount < this.totalAmount;

  this.status = isPartial ? 'partially_refunded' : 'refunded';
  this.refund = {
    amount,
    reason,
    refundedAt: new Date(),
    refundedBy: userId
  };

  if (stripeRefundId) {
    this.stripe.refundId = stripeRefundId;
  }

  await this.save();
  return this;
};

// Get payments by expedition
PaymentSchema.statics.findByExpedition = function(expeditionId) {
  return this.find({
    'items.expeditionId': expeditionId
  }).sort({ createdAt: -1 });
};

// Get client payment history
PaymentSchema.statics.getClientHistory = function(organizationId, clientEmail, options = {}) {
  const { limit = 50, skip = 0, status } = options;

  const query = {
    organizationId,
    clientEmail
  };

  if (status) {
    query.status = status;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Summary for client
PaymentSchema.methods.toClientSummary = function() {
  return {
    paymentId: this.paymentId,
    items: this.items.map(item => ({
      description: item.description,
      type: item.type,
      amount: item.amount
    })),
    totalAmount: this.totalAmount,
    currency: this.currency,
    status: this.status,
    paidAt: this.paidAt,
    receiptUrl: this.stripe?.receiptUrl,
    invoiceNumber: this.invoice?.number
  };
};

module.exports = mongoose.model('Payment', PaymentSchema);
