/**
 * Tenant Service
 * Phase 6.3: Multi-Tenancy Support
 *
 * Manages tenant lifecycle, data isolation, and tenant-scoped operations
 */

const logger = require('../../config/logger');

// In-memory tenant store (replace with MongoDB Tenant model in production)
let tenants = new Map();
let tenantUsers = new Map();

/**
 * Tenant status constants
 */
const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TRIAL: 'trial',
  CANCELLED: 'cancelled',
  PENDING: 'pending'
};

/**
 * Plan types
 */
const PLAN_TYPES = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise'
};

/**
 * Default plan limits
 */
const PLAN_LIMITS = {
  [PLAN_TYPES.FREE]: {
    maxUsers: 2,
    maxDeclarationsPerMonth: 20,
    maxExpeditionsPerMonth: 10,
    maxStorageGB: 1,
    maxApiCallsPerDay: 100,
    maxLuciQueriesPerMonth: 50,
    features: {
      analytics: false,
      advancedReports: false,
      apiAccess: false,
      customBranding: false,
      prioritySupport: false,
      sso: false,
      webhooks: false
    }
  },
  [PLAN_TYPES.STARTER]: {
    maxUsers: 5,
    maxDeclarationsPerMonth: 100,
    maxExpeditionsPerMonth: 50,
    maxStorageGB: 10,
    maxApiCallsPerDay: 1000,
    maxLuciQueriesPerMonth: 500,
    features: {
      analytics: true,
      advancedReports: false,
      apiAccess: false,
      customBranding: false,
      prioritySupport: false,
      sso: false,
      webhooks: false
    }
  },
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
      sso: false,
      webhooks: true
    }
  },
  [PLAN_TYPES.ENTERPRISE]: {
    maxUsers: -1,
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
      sso: true,
      webhooks: true
    }
  }
};

/**
 * Create a new tenant
 */
async function createTenant(data) {
  try {
    const tenantId = `TNT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Generate slug from name
    const slug = data.slug || data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check slug uniqueness
    const existingBySlug = Array.from(tenants.values()).find(t => t.slug === slug);
    if (existingBySlug) {
      return { success: false, error: 'Slug already exists' };
    }

    const plan = data.plan || PLAN_TYPES.FREE;
    const limits = PLAN_LIMITS[plan];

    const tenant = {
      id: tenantId,
      name: data.name,
      slug,
      description: data.description || '',
      status: data.status || TENANT_STATUS.PENDING,

      businessInfo: {
        type: data.businessType || 'customs_agent',
        nif: data.nif || '',
        eori: data.eori || '',
        rea: data.rea || '',
        address: data.address || {}
      },

      primaryContact: {
        name: data.contactName || '',
        email: data.contactEmail || '',
        phone: data.contactPhone || ''
      },

      subscription: {
        plan,
        status: 'active',
        startDate: new Date(),
        trialEndsAt: data.trialDays ? new Date(Date.now() + data.trialDays * 24 * 60 * 60 * 1000) : null
      },

      limits,

      currentUsage: {
        declarations: 0,
        expeditions: 0,
        users: 0,
        storage: 0,
        apiCalls: 0,
        luciQueries: 0,
        lastReset: new Date()
      },

      settings: {
        branding: {
          primaryColor: '#8B5CF6',
          companyName: data.name
        },
        defaults: {
          language: 'es',
          timezone: 'Europe/Madrid',
          currency: 'EUR'
        },
        notifications: {
          emailAlerts: true,
          deadlineReminders: true
        },
        security: {
          mfaRequired: false,
          sessionTimeout: 480
        }
      },

      owner: data.ownerId || null,

      createdAt: new Date(),
      updatedAt: new Date(),
      activatedAt: data.status === TENANT_STATUS.ACTIVE ? new Date() : null
    };

    tenants.set(tenantId, tenant);

    logger.info(`[Tenant] Created tenant: ${tenant.name} (${tenantId})`);

    return {
      success: true,
      tenant: _sanitizeTenant(tenant)
    };

  } catch (error) {
    logger.error(`[Tenant] Error creating tenant: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get tenant by ID
 */
function getTenant(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }
  return { success: true, tenant: _sanitizeTenant(tenant) };
}

/**
 * Get tenant by slug
 */
function getTenantBySlug(slug) {
  const tenant = Array.from(tenants.values()).find(t => t.slug === slug);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }
  return { success: true, tenant: _sanitizeTenant(tenant) };
}

/**
 * List all tenants
 */
function listTenants(filters = {}) {
  let result = Array.from(tenants.values());

  // Apply filters
  if (filters.status) {
    result = result.filter(t => t.status === filters.status);
  }
  if (filters.plan) {
    result = result.filter(t => t.subscription?.plan === filters.plan);
  }
  if (filters.search) {
    const search = filters.search.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(search) ||
      t.slug.toLowerCase().includes(search) ||
      t.businessInfo?.nif?.toLowerCase().includes(search)
    );
  }

  // Sort
  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const start = (page - 1) * limit;
  const paginated = result.slice(start, start + limit);

  return {
    success: true,
    tenants: paginated.map(_sanitizeTenant),
    pagination: {
      total: result.length,
      page,
      limit,
      pages: Math.ceil(result.length / limit)
    }
  };
}

/**
 * Update tenant
 */
async function updateTenant(tenantId, updates) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  try {
    // Prevent slug collision if updating slug
    if (updates.slug && updates.slug !== tenant.slug) {
      const existingBySlug = Array.from(tenants.values()).find(t => t.slug === updates.slug && t.id !== tenantId);
      if (existingBySlug) {
        return { success: false, error: 'Slug already exists' };
      }
    }

    // Deep merge updates
    const updatedTenant = _deepMerge(tenant, updates);
    updatedTenant.updatedAt = new Date();

    tenants.set(tenantId, updatedTenant);

    logger.info(`[Tenant] Updated tenant: ${tenantId}`);

    return {
      success: true,
      tenant: _sanitizeTenant(updatedTenant)
    };

  } catch (error) {
    logger.error(`[Tenant] Error updating tenant: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Activate tenant
 */
async function activateTenant(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  tenant.status = TENANT_STATUS.ACTIVE;
  tenant.activatedAt = new Date();
  tenant.updatedAt = new Date();

  tenants.set(tenantId, tenant);

  logger.info(`[Tenant] Activated tenant: ${tenantId}`);

  return { success: true, tenant: _sanitizeTenant(tenant) };
}

/**
 * Suspend tenant
 */
async function suspendTenant(tenantId, reason) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  tenant.status = TENANT_STATUS.SUSPENDED;
  tenant.suspendedAt = new Date();
  tenant.suspensionReason = reason;
  tenant.updatedAt = new Date();

  tenants.set(tenantId, tenant);

  logger.info(`[Tenant] Suspended tenant: ${tenantId} - Reason: ${reason}`);

  return { success: true, tenant: _sanitizeTenant(tenant) };
}

/**
 * Cancel tenant
 */
async function cancelTenant(tenantId, reason) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  tenant.status = TENANT_STATUS.CANCELLED;
  tenant.cancelledAt = new Date();
  tenant.cancellationReason = reason;
  tenant.updatedAt = new Date();

  tenants.set(tenantId, tenant);

  logger.info(`[Tenant] Cancelled tenant: ${tenantId} - Reason: ${reason}`);

  return { success: true, tenant: _sanitizeTenant(tenant) };
}

/**
 * Delete tenant (soft delete or full delete)
 */
async function deleteTenant(tenantId, hard = false) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  if (hard) {
    tenants.delete(tenantId);
    // Also delete associated users
    tenantUsers.delete(tenantId);
    logger.info(`[Tenant] Hard deleted tenant: ${tenantId}`);
  } else {
    tenant.status = TENANT_STATUS.CANCELLED;
    tenant.deletedAt = new Date();
    tenant.updatedAt = new Date();
    tenants.set(tenantId, tenant);
    logger.info(`[Tenant] Soft deleted tenant: ${tenantId}`);
  }

  return { success: true };
}

/**
 * Change tenant plan
 */
async function changePlan(tenantId, newPlan) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  if (!PLAN_LIMITS[newPlan]) {
    return { success: false, error: 'Invalid plan' };
  }

  const oldPlan = tenant.subscription.plan;
  tenant.subscription.plan = newPlan;
  tenant.limits = PLAN_LIMITS[newPlan];
  tenant.updatedAt = new Date();

  tenants.set(tenantId, tenant);

  logger.info(`[Tenant] Changed plan for ${tenantId}: ${oldPlan} -> ${newPlan}`);

  return {
    success: true,
    tenant: _sanitizeTenant(tenant),
    previousPlan: oldPlan,
    newPlan
  };
}

/**
 * Check if tenant is active
 */
function isActive(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) return false;
  return tenant.status === TENANT_STATUS.ACTIVE || tenant.status === TENANT_STATUS.TRIAL;
}

/**
 * Check if tenant can use a feature
 */
function canUseFeature(tenantId, featureName) {
  const tenant = tenants.get(tenantId);
  if (!tenant) return false;
  return tenant.limits?.features?.[featureName] === true;
}

/**
 * Check if tenant has reached a limit
 */
function hasReachedLimit(tenantId, limitType) {
  const tenant = tenants.get(tenantId);
  if (!tenant) return true;

  const limits = tenant.limits || {};
  const usage = tenant.currentUsage || {};

  // -1 means unlimited
  const getLimit = (type) => {
    const limit = limits[`max${type.charAt(0).toUpperCase() + type.slice(1)}`];
    return limit === -1 ? Infinity : limit;
  };

  switch (limitType) {
    case 'users':
      return usage.users >= getLimit('users');
    case 'declarations':
      return usage.declarations >= getLimit('declarationsPerMonth');
    case 'expeditions':
      return usage.expeditions >= getLimit('expeditionsPerMonth');
    case 'storage':
      return usage.storage >= getLimit('storageGB') * 1024 * 1024 * 1024;
    case 'apiCalls':
      return usage.apiCalls >= getLimit('apiCallsPerDay');
    case 'luciQueries':
      return usage.luciQueries >= getLimit('luciQueriesPerMonth');
    default:
      return false;
  }
}

/**
 * Increment usage counter
 */
async function incrementUsage(tenantId, type, amount = 1) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  if (!tenant.currentUsage) {
    tenant.currentUsage = {};
  }

  tenant.currentUsage[type] = (tenant.currentUsage[type] || 0) + amount;
  tenant.updatedAt = new Date();

  tenants.set(tenantId, tenant);

  return {
    success: true,
    usage: tenant.currentUsage
  };
}

/**
 * Reset monthly usage
 */
async function resetMonthlyUsage(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  // Archive current usage
  if (!tenant.usageHistory) {
    tenant.usageHistory = [];
  }

  tenant.usageHistory.push({
    period: new Date().toISOString().slice(0, 7),
    ...tenant.currentUsage
  });

  // Reset (keep users and storage counts)
  tenant.currentUsage = {
    declarations: 0,
    expeditions: 0,
    users: tenant.currentUsage?.users || 0,
    storage: tenant.currentUsage?.storage || 0,
    apiCalls: 0,
    luciQueries: 0,
    lastReset: new Date()
  };

  tenant.updatedAt = new Date();
  tenants.set(tenantId, tenant);

  logger.info(`[Tenant] Reset monthly usage for: ${tenantId}`);

  return { success: true };
}

/**
 * Get usage statistics
 */
function getUsageStats(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  const limits = tenant.limits || {};
  const usage = tenant.currentUsage || {};

  const calculatePercentage = (used, max) => {
    if (max === -1) return 0; // Unlimited
    return Math.min(100, Math.round((used / max) * 100));
  };

  return {
    success: true,
    data: {
      plan: tenant.subscription?.plan,
      currentUsage: usage,
      limits: {
        maxUsers: limits.maxUsers,
        maxDeclarationsPerMonth: limits.maxDeclarationsPerMonth,
        maxExpeditionsPerMonth: limits.maxExpeditionsPerMonth,
        maxStorageGB: limits.maxStorageGB,
        maxApiCallsPerDay: limits.maxApiCallsPerDay,
        maxLuciQueriesPerMonth: limits.maxLuciQueriesPerMonth
      },
      percentages: {
        users: calculatePercentage(usage.users, limits.maxUsers),
        declarations: calculatePercentage(usage.declarations, limits.maxDeclarationsPerMonth),
        expeditions: calculatePercentage(usage.expeditions, limits.maxExpeditionsPerMonth),
        storage: calculatePercentage(usage.storage, limits.maxStorageGB * 1024 * 1024 * 1024),
        apiCalls: calculatePercentage(usage.apiCalls, limits.maxApiCallsPerDay),
        luciQueries: calculatePercentage(usage.luciQueries, limits.maxLuciQueriesPerMonth)
      },
      lastReset: usage.lastReset
    }
  };
}

/**
 * Update tenant settings
 */
async function updateSettings(tenantId, settings) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  tenant.settings = _deepMerge(tenant.settings || {}, settings);
  tenant.updatedAt = new Date();

  tenants.set(tenantId, tenant);

  return {
    success: true,
    settings: tenant.settings
  };
}

/**
 * Get available plans
 */
function getAvailablePlans() {
  return Object.entries(PLAN_LIMITS).map(([plan, limits]) => ({
    id: plan,
    name: plan.charAt(0).toUpperCase() + plan.slice(1),
    limits,
    pricing: _getPlanPricing(plan)
  }));
}

// ==================== Helper Functions ====================

function _sanitizeTenant(tenant) {
  // Remove sensitive data
  const { ...safe } = tenant;
  delete safe.settings?.integrations?.apiKey;
  delete safe.settings?.integrations?.webhookSecret;
  return safe;
}

function _deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = _deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

function _getPlanPricing(plan) {
  const pricing = {
    [PLAN_TYPES.FREE]: { monthly: 0, yearly: 0, currency: 'EUR' },
    [PLAN_TYPES.STARTER]: { monthly: 49, yearly: 490, currency: 'EUR' },
    [PLAN_TYPES.PROFESSIONAL]: { monthly: 149, yearly: 1490, currency: 'EUR' },
    [PLAN_TYPES.ENTERPRISE]: { monthly: null, yearly: null, currency: 'EUR', contactSales: true }
  };
  return pricing[plan] || pricing[PLAN_TYPES.FREE];
}

module.exports = {
  // Constants
  TENANT_STATUS,
  PLAN_TYPES,
  PLAN_LIMITS,

  // Tenant CRUD
  createTenant,
  getTenant,
  getTenantBySlug,
  listTenants,
  updateTenant,
  deleteTenant,

  // Lifecycle
  activateTenant,
  suspendTenant,
  cancelTenant,

  // Plan management
  changePlan,
  getAvailablePlans,

  // Checks
  isActive,
  canUseFeature,
  hasReachedLimit,

  // Usage
  incrementUsage,
  resetMonthlyUsage,
  getUsageStats,

  // Settings
  updateSettings
};
