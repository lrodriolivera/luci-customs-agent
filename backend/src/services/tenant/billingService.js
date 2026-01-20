/**
 * Billing Service
 * Phase 6.3: Multi-Tenancy Support
 *
 * Handles subscriptions, invoices, and usage-based billing
 */

const logger = require('../../config/logger');

/**
 * Billing status
 */
const BILLING_STATUS = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  TRIALING: 'trialing',
  PAUSED: 'paused'
};

/**
 * Invoice status
 */
const INVOICE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

/**
 * Payment methods
 */
const PAYMENT_METHODS = {
  CARD: 'card',
  SEPA: 'sepa',
  TRANSFER: 'transfer',
  NONE: 'none'
};

/**
 * Pricing plans (monthly in EUR)
 */
const PLAN_PRICING = {
  free: {
    monthly: 0,
    yearly: 0,
    features: ['Basic declarations', 'Email support', '2 users']
  },
  starter: {
    monthly: 49,
    yearly: 490, // ~17% discount
    features: ['100 declarations/month', 'Standard support', '5 users', 'Basic analytics']
  },
  professional: {
    monthly: 149,
    yearly: 1490, // ~17% discount
    features: ['500 declarations/month', 'Priority support', '20 users', 'Advanced analytics', 'API access', 'Custom branding']
  },
  enterprise: {
    monthly: 499,
    yearly: 4990, // ~17% discount
    features: ['Unlimited declarations', 'Dedicated support', 'Unlimited users', 'Full analytics', 'SSO', 'SLA']
  }
};

/**
 * Usage-based pricing (per unit in EUR)
 */
const USAGE_PRICING = {
  extra_declaration: 0.50,
  extra_expedition: 0.75,
  extra_user: 10,
  extra_storage_gb: 2,
  extra_api_calls_1000: 1,
  extra_luci_queries_100: 5
};

/**
 * In-memory storage for billing data
 */
let subscriptions = new Map(); // tenantId -> subscription
let invoices = new Map(); // invoiceId -> invoice
let paymentMethods = new Map(); // tenantId -> [paymentMethods]
let usageRecords = new Map(); // tenantId -> [usageRecords]

/**
 * Create subscription for tenant
 */
function createSubscription(tenantId, plan, billingCycle = 'monthly') {
  try {
    const pricing = PLAN_PRICING[plan];
    if (!pricing) {
      return { success: false, error: 'Invalid plan' };
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      tenantId,
      plan,
      status: plan === 'free' ? BILLING_STATUS.ACTIVE : BILLING_STATUS.TRIALING,
      billingCycle,
      price: billingCycle === 'yearly' ? pricing.yearly : pricing.monthly,
      currency: 'EUR',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: plan !== 'free' ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null, // 14 days trial
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now
    };

    subscriptions.set(tenantId, subscription);

    logger.info(`[Billing] Created subscription for tenant ${tenantId}: ${plan} (${billingCycle})`);

    return { success: true, subscription };

  } catch (error) {
    logger.error(`[Billing] Error creating subscription: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get subscription for tenant
 */
function getSubscription(tenantId) {
  const subscription = subscriptions.get(tenantId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }
  return { success: true, subscription };
}

/**
 * Update subscription plan
 */
function updateSubscription(tenantId, updates) {
  const subscription = subscriptions.get(tenantId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  const updatedSubscription = {
    ...subscription,
    ...updates,
    tenantId, // Prevent tenantId change
    updatedAt: new Date()
  };

  // If changing plan, update price
  if (updates.plan && updates.plan !== subscription.plan) {
    const pricing = PLAN_PRICING[updates.plan];
    if (pricing) {
      updatedSubscription.price = subscription.billingCycle === 'yearly'
        ? pricing.yearly
        : pricing.monthly;
    }
  }

  subscriptions.set(tenantId, updatedSubscription);

  logger.info(`[Billing] Updated subscription for tenant ${tenantId}`);

  return { success: true, subscription: updatedSubscription };
}

/**
 * Change subscription plan
 */
function changePlan(tenantId, newPlan, immediate = false) {
  const subscription = subscriptions.get(tenantId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  const pricing = PLAN_PRICING[newPlan];
  if (!pricing) {
    return { success: false, error: 'Invalid plan' };
  }

  const isUpgrade = getPlanValue(newPlan) > getPlanValue(subscription.plan);

  if (immediate || isUpgrade) {
    // Immediate change for upgrades
    const now = new Date();
    const periodEnd = new Date(now);
    if (subscription.billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    subscription.plan = newPlan;
    subscription.price = subscription.billingCycle === 'yearly' ? pricing.yearly : pricing.monthly;
    subscription.status = BILLING_STATUS.ACTIVE;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;
    subscription.trialEndsAt = null;
    subscription.updatedAt = now;

    // Create prorated invoice for upgrade
    if (isUpgrade && subscription.plan !== 'free') {
      createInvoice(tenantId, {
        type: 'plan_upgrade',
        description: `Upgrade to ${newPlan} plan`,
        amount: subscription.price
      });
    }
  } else {
    // Schedule change at period end for downgrades
    subscription.scheduledPlanChange = {
      plan: newPlan,
      effectiveDate: subscription.currentPeriodEnd
    };
    subscription.updatedAt = new Date();
  }

  subscriptions.set(tenantId, subscription);

  logger.info(`[Billing] Plan change for tenant ${tenantId}: ${subscription.plan} -> ${newPlan}`);

  return {
    success: true,
    subscription,
    isUpgrade,
    effectiveImmediately: immediate || isUpgrade
  };
}

/**
 * Cancel subscription
 */
function cancelSubscription(tenantId, immediate = false) {
  const subscription = subscriptions.get(tenantId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (immediate) {
    subscription.status = BILLING_STATUS.CANCELLED;
    subscription.cancelledAt = new Date();
  } else {
    subscription.cancelAtPeriodEnd = true;
  }
  subscription.updatedAt = new Date();

  subscriptions.set(tenantId, subscription);

  logger.info(`[Billing] Cancelled subscription for tenant ${tenantId} (immediate: ${immediate})`);

  return {
    success: true,
    subscription,
    effectiveDate: immediate ? new Date() : subscription.currentPeriodEnd
  };
}

/**
 * Reactivate cancelled subscription
 */
function reactivateSubscription(tenantId) {
  const subscription = subscriptions.get(tenantId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (subscription.status === BILLING_STATUS.CANCELLED) {
    // Need to create new subscription
    return createSubscription(tenantId, subscription.plan, subscription.billingCycle);
  }

  subscription.cancelAtPeriodEnd = false;
  subscription.updatedAt = new Date();

  subscriptions.set(tenantId, subscription);

  logger.info(`[Billing] Reactivated subscription for tenant ${tenantId}`);

  return { success: true, subscription };
}

/**
 * Create invoice
 */
function createInvoice(tenantId, invoiceData) {
  try {
    const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();

    const invoice = {
      id: invoiceId,
      tenantId,
      number: generateInvoiceNumber(),
      status: INVOICE_STATUS.DRAFT,
      type: invoiceData.type || 'subscription',
      description: invoiceData.description || 'Subscription payment',
      items: invoiceData.items || [{
        description: invoiceData.description,
        quantity: 1,
        unitPrice: invoiceData.amount,
        amount: invoiceData.amount
      }],
      subtotal: invoiceData.amount,
      tax: Math.round(invoiceData.amount * 0.21 * 100) / 100, // 21% IVA
      total: Math.round(invoiceData.amount * 1.21 * 100) / 100,
      currency: 'EUR',
      dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdAt: now,
      updatedAt: now
    };

    invoices.set(invoiceId, invoice);

    logger.info(`[Billing] Created invoice ${invoiceId} for tenant ${tenantId}`);

    return { success: true, invoice };

  } catch (error) {
    logger.error(`[Billing] Error creating invoice: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get invoice by ID
 */
function getInvoice(invoiceId) {
  const invoice = invoices.get(invoiceId);
  if (!invoice) {
    return { success: false, error: 'Invoice not found' };
  }
  return { success: true, invoice };
}

/**
 * List invoices for tenant
 */
function listInvoices(tenantId, options = {}) {
  const tenantInvoices = Array.from(invoices.values())
    .filter(inv => inv.tenantId === tenantId);

  // Apply filters
  let filtered = tenantInvoices;

  if (options.status) {
    filtered = filtered.filter(inv => inv.status === options.status);
  }

  if (options.type) {
    filtered = filtered.filter(inv => inv.type === options.type);
  }

  if (options.from) {
    filtered = filtered.filter(inv => new Date(inv.createdAt) >= new Date(options.from));
  }

  if (options.to) {
    filtered = filtered.filter(inv => new Date(inv.createdAt) <= new Date(options.to));
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const page = options.page || 1;
  const limit = options.limit || 20;
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  return {
    success: true,
    invoices: paginated,
    pagination: {
      page,
      limit,
      total: filtered.length,
      pages: Math.ceil(filtered.length / limit)
    }
  };
}

/**
 * Update invoice status
 */
function updateInvoiceStatus(invoiceId, status, metadata = {}) {
  const invoice = invoices.get(invoiceId);
  if (!invoice) {
    return { success: false, error: 'Invoice not found' };
  }

  invoice.status = status;
  invoice.updatedAt = new Date();

  if (status === INVOICE_STATUS.PAID) {
    invoice.paidAt = new Date();
    invoice.paymentMethod = metadata.paymentMethod;
    invoice.paymentReference = metadata.paymentReference;
  }

  if (status === INVOICE_STATUS.REFUNDED) {
    invoice.refundedAt = new Date();
    invoice.refundReason = metadata.refundReason;
  }

  invoices.set(invoiceId, invoice);

  logger.info(`[Billing] Updated invoice ${invoiceId} status to ${status}`);

  return { success: true, invoice };
}

/**
 * Record payment
 */
function recordPayment(invoiceId, paymentData) {
  const invoice = invoices.get(invoiceId);
  if (!invoice) {
    return { success: false, error: 'Invoice not found' };
  }

  if (invoice.status === INVOICE_STATUS.PAID) {
    return { success: false, error: 'Invoice already paid' };
  }

  const payment = {
    id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    invoiceId,
    tenantId: invoice.tenantId,
    amount: paymentData.amount || invoice.total,
    currency: invoice.currency,
    method: paymentData.method || PAYMENT_METHODS.CARD,
    reference: paymentData.reference,
    processedAt: new Date()
  };

  // Update invoice
  updateInvoiceStatus(invoiceId, INVOICE_STATUS.PAID, {
    paymentMethod: payment.method,
    paymentReference: payment.reference
  });

  // Update subscription status if needed
  const subscription = subscriptions.get(invoice.tenantId);
  if (subscription && subscription.status === BILLING_STATUS.PAST_DUE) {
    subscription.status = BILLING_STATUS.ACTIVE;
    subscription.updatedAt = new Date();
    subscriptions.set(invoice.tenantId, subscription);
  }

  logger.info(`[Billing] Recorded payment ${payment.id} for invoice ${invoiceId}`);

  return { success: true, payment };
}

/**
 * Add payment method
 */
function addPaymentMethod(tenantId, methodData) {
  const methods = paymentMethods.get(tenantId) || [];

  const method = {
    id: `pm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    tenantId,
    type: methodData.type || PAYMENT_METHODS.CARD,
    isDefault: methods.length === 0 || methodData.isDefault,
    // Card details (masked)
    last4: methodData.last4,
    brand: methodData.brand,
    expiryMonth: methodData.expiryMonth,
    expiryYear: methodData.expiryYear,
    // SEPA details
    iban: methodData.iban ? maskIban(methodData.iban) : null,
    bankName: methodData.bankName,
    // Metadata
    createdAt: new Date()
  };

  // If this is default, unset others
  if (method.isDefault) {
    methods.forEach(m => m.isDefault = false);
  }

  methods.push(method);
  paymentMethods.set(tenantId, methods);

  logger.info(`[Billing] Added payment method ${method.id} for tenant ${tenantId}`);

  return { success: true, paymentMethod: method };
}

/**
 * List payment methods
 */
function listPaymentMethods(tenantId) {
  const methods = paymentMethods.get(tenantId) || [];
  return { success: true, paymentMethods: methods };
}

/**
 * Remove payment method
 */
function removePaymentMethod(tenantId, methodId) {
  const methods = paymentMethods.get(tenantId) || [];
  const index = methods.findIndex(m => m.id === methodId);

  if (index === -1) {
    return { success: false, error: 'Payment method not found' };
  }

  const removed = methods.splice(index, 1)[0];

  // If removed was default, make first one default
  if (removed.isDefault && methods.length > 0) {
    methods[0].isDefault = true;
  }

  paymentMethods.set(tenantId, methods);

  logger.info(`[Billing] Removed payment method ${methodId} for tenant ${tenantId}`);

  return { success: true };
}

/**
 * Set default payment method
 */
function setDefaultPaymentMethod(tenantId, methodId) {
  const methods = paymentMethods.get(tenantId) || [];
  const method = methods.find(m => m.id === methodId);

  if (!method) {
    return { success: false, error: 'Payment method not found' };
  }

  methods.forEach(m => m.isDefault = m.id === methodId);
  paymentMethods.set(tenantId, methods);

  return { success: true, paymentMethod: method };
}

/**
 * Record usage
 */
function recordUsage(tenantId, usageType, quantity = 1, metadata = {}) {
  const records = usageRecords.get(tenantId) || [];

  const record = {
    id: `usage-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    tenantId,
    type: usageType,
    quantity,
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    metadata,
    recordedAt: new Date()
  };

  records.push(record);
  usageRecords.set(tenantId, records);

  return { success: true, record };
}

/**
 * Get usage summary for tenant
 */
function getUsageSummary(tenantId, period = null) {
  const records = usageRecords.get(tenantId) || [];
  const targetPeriod = period || new Date().toISOString().slice(0, 7);

  const periodRecords = records.filter(r => r.period === targetPeriod);

  const summary = {
    period: targetPeriod,
    declarations: 0,
    expeditions: 0,
    apiCalls: 0,
    luciQueries: 0,
    storageGb: 0
  };

  for (const record of periodRecords) {
    switch (record.type) {
      case 'declaration':
        summary.declarations += record.quantity;
        break;
      case 'expedition':
        summary.expeditions += record.quantity;
        break;
      case 'api_call':
        summary.apiCalls += record.quantity;
        break;
      case 'luci_query':
        summary.luciQueries += record.quantity;
        break;
      case 'storage':
        summary.storageGb = record.quantity; // Last value
        break;
    }
  }

  return { success: true, summary };
}

/**
 * Calculate overage charges
 */
function calculateOverages(tenantId, limits) {
  const usageResult = getUsageSummary(tenantId);
  if (!usageResult.success) {
    return { success: false, error: usageResult.error };
  }

  const usage = usageResult.summary;
  const overages = [];

  // Check declarations
  if (limits.maxDeclarationsPerMonth > 0 && usage.declarations > limits.maxDeclarationsPerMonth) {
    const extra = usage.declarations - limits.maxDeclarationsPerMonth;
    overages.push({
      type: 'extra_declaration',
      quantity: extra,
      unitPrice: USAGE_PRICING.extra_declaration,
      total: extra * USAGE_PRICING.extra_declaration
    });
  }

  // Check expeditions
  if (limits.maxExpeditionsPerMonth > 0 && usage.expeditions > limits.maxExpeditionsPerMonth) {
    const extra = usage.expeditions - limits.maxExpeditionsPerMonth;
    overages.push({
      type: 'extra_expedition',
      quantity: extra,
      unitPrice: USAGE_PRICING.extra_expedition,
      total: extra * USAGE_PRICING.extra_expedition
    });
  }

  // Check API calls
  if (limits.maxApiCallsPerDay > 0) {
    const monthlyLimit = limits.maxApiCallsPerDay * 30;
    if (usage.apiCalls > monthlyLimit) {
      const extraThousands = Math.ceil((usage.apiCalls - monthlyLimit) / 1000);
      overages.push({
        type: 'extra_api_calls',
        quantity: extraThousands,
        unitPrice: USAGE_PRICING.extra_api_calls_1000,
        total: extraThousands * USAGE_PRICING.extra_api_calls_1000
      });
    }
  }

  // Check LUCI queries
  if (limits.maxLuciQueriesPerMonth > 0 && usage.luciQueries > limits.maxLuciQueriesPerMonth) {
    const extraHundreds = Math.ceil((usage.luciQueries - limits.maxLuciQueriesPerMonth) / 100);
    overages.push({
      type: 'extra_luci_queries',
      quantity: extraHundreds,
      unitPrice: USAGE_PRICING.extra_luci_queries_100,
      total: extraHundreds * USAGE_PRICING.extra_luci_queries_100
    });
  }

  // Check storage
  if (limits.maxStorageGB > 0 && usage.storageGb > limits.maxStorageGB) {
    const extra = Math.ceil(usage.storageGb - limits.maxStorageGB);
    overages.push({
      type: 'extra_storage',
      quantity: extra,
      unitPrice: USAGE_PRICING.extra_storage_gb,
      total: extra * USAGE_PRICING.extra_storage_gb
    });
  }

  const totalOverage = overages.reduce((sum, o) => sum + o.total, 0);

  return {
    success: true,
    usage,
    overages,
    totalOverage,
    currency: 'EUR'
  };
}

/**
 * Generate billing statement
 */
function generateBillingStatement(tenantId, period = null) {
  const subscription = subscriptions.get(tenantId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  const targetPeriod = period || new Date().toISOString().slice(0, 7);
  const usageResult = getUsageSummary(tenantId, targetPeriod);
  const invoiceList = listInvoices(tenantId, {
    from: `${targetPeriod}-01`,
    to: `${targetPeriod}-31`
  });

  const statement = {
    tenantId,
    period: targetPeriod,
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      price: subscription.price
    },
    usage: usageResult.success ? usageResult.summary : null,
    invoices: invoiceList.invoices,
    totals: {
      subscription: subscription.price,
      overages: 0,
      taxes: 0,
      total: 0
    },
    generatedAt: new Date()
  };

  // Calculate totals from invoices
  for (const invoice of invoiceList.invoices) {
    if (invoice.status === INVOICE_STATUS.PAID) {
      statement.totals.total += invoice.total;
      statement.totals.taxes += invoice.tax;
    }
  }

  return { success: true, statement };
}

/**
 * Get billing overview
 */
function getBillingOverview(tenantId) {
  const subscription = subscriptions.get(tenantId);
  const methods = paymentMethods.get(tenantId) || [];
  const invoiceList = listInvoices(tenantId, { limit: 5 });
  const usageResult = getUsageSummary(tenantId);

  return {
    success: true,
    overview: {
      subscription: subscription || null,
      defaultPaymentMethod: methods.find(m => m.isDefault) || null,
      paymentMethodCount: methods.length,
      recentInvoices: invoiceList.invoices,
      currentUsage: usageResult.success ? usageResult.summary : null,
      nextBillingDate: subscription?.currentPeriodEnd || null,
      pricing: PLAN_PRICING
    }
  };
}

/**
 * Process subscription renewal
 */
function processRenewal(tenantId) {
  const subscription = subscriptions.get(tenantId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (subscription.cancelAtPeriodEnd) {
    // Cancel the subscription
    subscription.status = BILLING_STATUS.CANCELLED;
    subscription.cancelledAt = new Date();
    subscriptions.set(tenantId, subscription);

    logger.info(`[Billing] Subscription cancelled at period end for tenant ${tenantId}`);

    return { success: true, action: 'cancelled', subscription };
  }

  // Process scheduled plan change
  if (subscription.scheduledPlanChange) {
    const { plan } = subscription.scheduledPlanChange;
    const pricing = PLAN_PRICING[plan];

    subscription.plan = plan;
    subscription.price = subscription.billingCycle === 'yearly' ? pricing.yearly : pricing.monthly;
    delete subscription.scheduledPlanChange;
  }

  // Extend period
  const now = new Date();
  subscription.currentPeriodStart = now;
  if (subscription.billingCycle === 'yearly') {
    subscription.currentPeriodEnd = new Date(now.setFullYear(now.getFullYear() + 1));
  } else {
    subscription.currentPeriodEnd = new Date(now.setMonth(now.getMonth() + 1));
  }
  subscription.updatedAt = new Date();

  // Create invoice for paid plans
  if (subscription.plan !== 'free' && subscription.price > 0) {
    createInvoice(tenantId, {
      type: 'subscription_renewal',
      description: `${subscription.plan} plan - ${subscription.billingCycle} subscription`,
      amount: subscription.price
    });
  }

  subscriptions.set(tenantId, subscription);

  logger.info(`[Billing] Processed renewal for tenant ${tenantId}`);

  return { success: true, action: 'renewed', subscription };
}

// Helper functions

function getPlanValue(plan) {
  const values = { free: 0, starter: 1, professional: 2, enterprise: 3 };
  return values[plan] || 0;
}

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = Array.from(invoices.values()).filter(
    inv => inv.number?.startsWith(`INV-${year}`)
  ).length + 1;
  return `INV-${year}-${String(count).padStart(5, '0')}`;
}

function maskIban(iban) {
  if (!iban || iban.length < 10) return iban;
  return iban.slice(0, 4) + '****' + iban.slice(-4);
}

/**
 * Get plan pricing info
 */
function getPlanPricing() {
  return {
    success: true,
    plans: PLAN_PRICING,
    usagePricing: USAGE_PRICING,
    currency: 'EUR'
  };
}

module.exports = {
  // Constants
  BILLING_STATUS,
  INVOICE_STATUS,
  PAYMENT_METHODS,
  PLAN_PRICING,
  USAGE_PRICING,

  // Subscription management
  createSubscription,
  getSubscription,
  updateSubscription,
  changePlan,
  cancelSubscription,
  reactivateSubscription,
  processRenewal,

  // Invoices
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
  recordPayment,

  // Payment methods
  addPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,

  // Usage
  recordUsage,
  getUsageSummary,
  calculateOverages,

  // Reports
  generateBillingStatement,
  getBillingOverview,
  getPlanPricing
};
