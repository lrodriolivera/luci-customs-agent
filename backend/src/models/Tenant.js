/**
 * Tenant Model
 * Phase 6.3: Multi-Tenancy Support
 *
 * Represents an organization/company using the system
 */

const mongoose = require('mongoose');

/**
 * Subscription plan types
 */
const PLAN_TYPES = {
  PROFESSIONAL: 'professional',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise'
};

/**
 * Tenant status
 */
const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TRIAL: 'trial',
  CANCELLED: 'cancelled',
  PENDING: 'pending'
};

/**
 * Address schema
 */
const AddressSchema = new mongoose.Schema({
  street: { type: String },
  city: { type: String },
  postalCode: { type: String },
  province: { type: String },
  country: { type: String, default: 'ES' }
}, { _id: false });

/**
 * Contact schema
 */
const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  role: { type: String }
}, { _id: false });

/**
 * Billing info schema
 */
const BillingInfoSchema = new mongoose.Schema({
  legalName: { type: String },
  nif: { type: String },
  address: AddressSchema,
  email: { type: String },
  paymentMethod: {
    type: { type: String, enum: ['card', 'sepa', 'transfer', 'none'], default: 'none' },
    last4: { type: String },
    expiryMonth: { type: Number },
    expiryYear: { type: Number },
    brand: { type: String }
  },
  vatExempt: { type: Boolean, default: false }
}, { _id: false });

/**
 * Subscription schema
 */
const SubscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: Object.values(PLAN_TYPES),
    default: PLAN_TYPES.FREE
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'cancelled', 'trialing'],
    default: 'active'
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  trialEndsAt: { type: Date },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  // External billing system IDs
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String }
}, { _id: false });

/**
 * Usage tracking schema
 */
const UsageSchema = new mongoose.Schema({
  period: { type: String }, // YYYY-MM
  declarations: { type: Number, default: 0 },
  expeditions: { type: Number, default: 0 },
  users: { type: Number, default: 0 },
  storage: { type: Number, default: 0 }, // bytes
  apiCalls: { type: Number, default: 0 },
  luciQueries: { type: Number, default: 0 }
});

/**
 * Plan limits schema
 */
const LimitsSchema = new mongoose.Schema({
  maxUsers: { type: Number, default: 5 },
  maxDeclarationsPerMonth: { type: Number, default: 100 },
  maxExpeditionsPerMonth: { type: Number, default: 50 },
  maxStorageGB: { type: Number, default: 5 },
  maxApiCallsPerDay: { type: Number, default: 1000 },
  maxLuciQueriesPerMonth: { type: Number, default: 500 },
  // Features
  features: {
    analytics: { type: Boolean, default: false },
    advancedReports: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    dedicatedAccount: { type: Boolean, default: false },
    sso: { type: Boolean, default: false },
    auditLogs: { type: Boolean, default: true },
    webhooks: { type: Boolean, default: false },
    multipleLocations: { type: Boolean, default: false }
  }
}, { _id: false });

/**
 * Settings schema
 */
const SettingsSchema = new mongoose.Schema({
  // Branding
  branding: {
    logo: { type: String },
    primaryColor: { type: String, default: '#8B5CF6' },
    companyName: { type: String }
  },
  // Defaults
  defaults: {
    declarationOffice: { type: String },
    currency: { type: String, default: 'EUR' },
    language: { type: String, default: 'es' },
    timezone: { type: String, default: 'Europe/Madrid' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' }
  },
  // Notifications
  notifications: {
    emailAlerts: { type: Boolean, default: true },
    deadlineReminders: { type: Boolean, default: true },
    channelNotifications: { type: Boolean, default: true },
    weeklyReport: { type: Boolean, default: false }
  },
  // Security
  security: {
    mfaRequired: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 480 }, // minutes
    ipWhitelist: [{ type: String }],
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requireUppercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSpecialChars: { type: Boolean, default: false },
      expiryDays: { type: Number, default: 0 } // 0 = never expires
    }
  },
  // Integrations
  integrations: {
    aeatCertificateAlias: { type: String },
    webhookUrl: { type: String },
    webhookSecret: { type: String },
    apiKey: { type: String }
  }
}, { _id: false });

/**
 * Main Tenant Schema
 */
const TenantSchema = new mongoose.Schema({
  // Basic info
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: Object.values(TENANT_STATUS),
    default: TENANT_STATUS.PENDING
  },

  // Business info
  businessInfo: {
    type: { type: String, enum: ['customs_agent', 'importer', 'exporter', 'carrier', 'other'], default: 'customs_agent' },
    nif: { type: String },
    eori: { type: String },
    rea: { type: String }, // Registro Especial de Agentes
    oeaCertification: { type: String },
    address: AddressSchema
  },

  // Contact
  primaryContact: ContactSchema,
  contacts: [ContactSchema],

  // Billing
  billing: BillingInfoSchema,
  subscription: SubscriptionSchema,

  // Usage
  usage: [UsageSchema],
  currentUsage: {
    declarations: { type: Number, default: 0 },
    expeditions: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    storage: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    luciQueries: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },

  // Plan limits
  limits: LimitsSchema,

  // Settings
  settings: SettingsSchema,

  // Admin
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Metadata
  metadata: {
    source: { type: String },
    referredBy: { type: String },
    notes: { type: String }
  },

  // Audit
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  activatedAt: { type: Date },
  suspendedAt: { type: Date },
  cancelledAt: { type: Date }
}, {
  timestamps: true
});

// Indexes
TenantSchema.index({ slug: 1 }, { unique: true });
TenantSchema.index({ 'businessInfo.nif': 1 });
TenantSchema.index({ 'businessInfo.eori': 1 });
TenantSchema.index({ status: 1 });
TenantSchema.index({ 'subscription.plan': 1 });
TenantSchema.index({ owner: 1 });

// Pre-save middleware
TenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Generate slug from name if not set
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  next();
});

// Instance methods
TenantSchema.methods.isActive = function() {
  return this.status === TENANT_STATUS.ACTIVE || this.status === TENANT_STATUS.TRIAL;
};

TenantSchema.methods.canUseFeature = function(featureName) {
  return this.limits?.features?.[featureName] === true;
};

TenantSchema.methods.hasReachedLimit = function(limitType) {
  const limits = this.limits || {};
  const usage = this.currentUsage || {};

  switch (limitType) {
    case 'users':
      return usage.users >= (limits.maxUsers || Infinity);
    case 'declarations':
      return usage.declarations >= (limits.maxDeclarationsPerMonth || Infinity);
    case 'expeditions':
      return usage.expeditions >= (limits.maxExpeditionsPerMonth || Infinity);
    case 'storage':
      return usage.storage >= (limits.maxStorageGB || Infinity) * 1024 * 1024 * 1024;
    case 'apiCalls':
      return usage.apiCalls >= (limits.maxApiCallsPerDay || Infinity);
    case 'luciQueries':
      return usage.luciQueries >= (limits.maxLuciQueriesPerMonth || Infinity);
    default:
      return false;
  }
};

TenantSchema.methods.incrementUsage = function(type, amount = 1) {
  if (!this.currentUsage) {
    this.currentUsage = {};
  }
  this.currentUsage[type] = (this.currentUsage[type] || 0) + amount;
  return this.save();
};

TenantSchema.methods.resetMonthlyUsage = function() {
  // Archive current usage
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  this.usage.push({
    period: currentPeriod,
    ...this.currentUsage
  });

  // Reset
  this.currentUsage = {
    declarations: 0,
    expeditions: 0,
    users: this.currentUsage.users, // Don't reset users count
    storage: this.currentUsage.storage, // Don't reset storage
    apiCalls: 0,
    luciQueries: 0,
    lastReset: new Date()
  };

  return this.save();
};

// Static methods
TenantSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug });
};

TenantSchema.statics.findActive = function() {
  return this.find({ status: { $in: [TENANT_STATUS.ACTIVE, TENANT_STATUS.TRIAL] } });
};

TenantSchema.statics.findByPlan = function(plan) {
  return this.find({ 'subscription.plan': plan });
};

// Virtual for full address
TenantSchema.virtual('fullAddress').get(function() {
  const addr = this.businessInfo?.address;
  if (!addr) return '';
  return `${addr.street || ''}, ${addr.postalCode || ''} ${addr.city || ''}, ${addr.province || ''}, ${addr.country || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/\s+/g, ' ');
});

// Default plan limits
TenantSchema.statics.getDefaultLimits = function(plan) {
  const defaults = {
    [PLAN_TYPES.PROFESSIONAL]: {
      maxUsers: 20,
      maxDeclarationsPerMonth: 500,
      maxExpeditionsPerMonth: 250,
      maxStorageGB: 50,
      maxApiCallsPerDay: 5000,
      maxLuciQueriesPerMonth: 2000,
      features: {
        analytics: true,
        advancedReports: true,
        apiAccess: true,
        customBranding: true,
        prioritySupport: true,
        dedicatedAccount: false,
        sso: false,
        auditLogs: true,
        webhooks: true,
        multipleLocations: true
      }
    },
    [PLAN_TYPES.BUSINESS]: {
      maxUsers: 15,
      maxDeclarationsPerMonth: 200,
      maxExpeditionsPerMonth: 100,
      maxStorageGB: 100,
      maxApiCallsPerDay: 10000,
      maxLuciQueriesPerMonth: 5000,
      features: {
        analytics: true,
        advancedReports: true,
        apiAccess: true,
        customBranding: true,
        prioritySupport: true,
        dedicatedAccount: false,
        sso: false,
        auditLogs: true,
        webhooks: true,
        multipleLocations: true
      }
    },
    [PLAN_TYPES.ENTERPRISE]: {
      maxUsers: -1, // Unlimited
      maxDeclarationsPerMonth: -1,
      maxExpeditionsPerMonth: -1,
      maxStorageGB: -1,
      maxApiCallsPerDay: -1,
      maxLuciQueriesPerMonth: -1,
      features: {
        analytics: true,
        advancedReports: true,
        apiAccess: true,
        customBranding: true,
        prioritySupport: true,
        dedicatedAccount: true,
        sso: true,
        auditLogs: true,
        webhooks: true,
        multipleLocations: true
      }
    }
  };

  return defaults[plan] || defaults[PLAN_TYPES.PROFESSIONAL];
};

// Export constants
TenantSchema.statics.PLAN_TYPES = PLAN_TYPES;
TenantSchema.statics.TENANT_STATUS = TENANT_STATUS;

module.exports = mongoose.model('Tenant', TenantSchema);
