/**
 * Plan Limits Middleware
 * Checks if the user's subscription plan allows a specific action
 */

const { Tenant } = require('../models');
const logger = require('../config/logger');

// Plan feature access
const PLAN_FEATURES = {
  free: ['classification_basic', 'calculator', 'taric_tree'],
  starter: ['classification_basic', 'calculator', 'taric_tree', 'expeditions', 'analytics_basic'],
  professional: ['classification_basic', 'classification_unlimited', 'calculator', 'taric_tree', 'expeditions', 'declarations', 'pue_soivre', 'preferences', 'analytics_basic', 'analytics_advanced', 'api_access'],
  enterprise: ['*'] // All features
};

// Monthly usage limits per plan
const PLAN_LIMITS = {
  free: { aiClassifications: 10, declarations: 0, expeditions: 5 },
  starter: { aiClassifications: 100, declarations: 20, expeditions: 50 },
  professional: { aiClassifications: -1, declarations: 500, expeditions: -1 }, // -1 = unlimited
  enterprise: { aiClassifications: -1, declarations: -1, expeditions: -1 }
};

/**
 * Check if tenant's plan includes a specific feature
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId;

      // No tenant = free plan
      const plan = await getTenantPlan(tenantId);

      if (plan === 'enterprise' || PLAN_FEATURES[plan]?.includes('*')) {
        return next();
      }

      if (!PLAN_FEATURES[plan]?.includes(feature)) {
        return res.status(403).json({
          success: false,
          error: 'Tu plan actual no incluye esta funcionalidad',
          requiredPlan: getMinimumPlan(feature),
          upgradeUrl: '/billing'
        });
      }

      next();
    } catch (error) {
      logger.error('Error checking plan feature:', error);
      next(); // Don't block on errors
    }
  };
}

/**
 * Check if tenant has remaining usage for a specific metric
 */
function requireUsage(metric) {
  return async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      const plan = await getTenantPlan(tenantId);
      const limit = PLAN_LIMITS[plan]?.[metric];

      // Unlimited
      if (limit === -1 || limit === undefined) return next();

      // Check current usage
      const tenant = tenantId ? await Tenant.findById(tenantId) : null;
      const currentUsage = tenant?.usage?.[metric] || 0;

      if (currentUsage >= limit) {
        return res.status(429).json({
          success: false,
          error: `Has alcanzado el limite de ${limit} ${getMetricLabel(metric)} para tu plan ${plan}`,
          currentUsage,
          limit,
          upgradeUrl: '/billing'
        });
      }

      // Increment usage (fire and forget)
      if (tenant) {
        Tenant.findByIdAndUpdate(tenantId, { $inc: { [`usage.${metric}`]: 1 } }).catch(() => {});
      }

      next();
    } catch (error) {
      logger.error('Error checking plan usage:', error);
      next();
    }
  };
}

// Helpers
async function getTenantPlan(tenantId) {
  if (!tenantId) return 'free';
  const tenant = await Tenant.findById(tenantId).select('subscription.plan subscription.status').lean();
  if (!tenant || tenant.subscription?.status === 'cancelled') return 'free';
  return tenant.subscription?.plan || 'free';
}

function getMinimumPlan(feature) {
  for (const plan of ['starter', 'professional', 'enterprise']) {
    if (PLAN_FEATURES[plan]?.includes(feature) || PLAN_FEATURES[plan]?.includes('*')) {
      return plan;
    }
  }
  return 'enterprise';
}

function getMetricLabel(metric) {
  const labels = {
    aiClassifications: 'clasificaciones IA',
    declarations: 'declaraciones',
    expeditions: 'expedientes'
  };
  return labels[metric] || metric;
}

module.exports = {
  requireFeature,
  requireUsage,
  PLAN_FEATURES,
  PLAN_LIMITS
};
