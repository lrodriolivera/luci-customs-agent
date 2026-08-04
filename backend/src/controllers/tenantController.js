/**
 * Tenant Controller
 * Phase 6.3: Multi-Tenancy Support
 *
 * HTTP endpoints for tenant, RBAC, and billing management
 *
 * OJO: las ocho funciones de ESCRITURA de tenantService son async. Sin `await`,
 * `result` es una Promise, `result.success` es undefined y el controlador
 * responde 400 aunque la accion SI se haya ejecutado. Ver los tests.
 */

const logger = require('../config/logger');
const tenantService = require('../services/tenant/tenantService');
const rbacService = require('../services/tenant/rbacService');
const billingService = require('../services/tenant/billingService');

// =====================================================
// TENANT MANAGEMENT
// =====================================================

/**
 * Create tenant
 * POST /api/tenants
 */
exports.createTenant = async (req, res) => {
  try {
    const result = await tenantService.createTenant(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Create subscription for new tenant
    const plan = req.body.plan || 'free';
    billingService.createSubscription(result.tenant.id, plan, req.body.billingCycle || 'monthly');

    logger.info(`[Tenant] Created tenant: ${result.tenant.id}`);

    res.status(201).json(result);
  } catch (error) {
    logger.error(`[Tenant] Error creating tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get tenant by ID
 * GET /api/tenants/:id
 */
exports.getTenant = async (req, res) => {
  try {
    const result = tenantService.getTenant(req.params.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error getting tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get tenant by slug
 * GET /api/tenants/slug/:slug
 */
exports.getTenantBySlug = async (req, res) => {
  try {
    const result = tenantService.getTenantBySlug(req.params.slug);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error getting tenant by slug: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * List all tenants
 * GET /api/tenants
 */
exports.listTenants = async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      plan: req.query.plan,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = tenantService.listTenants(options);
    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error listing tenants: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update tenant
 * PUT /api/tenants/:id
 */
exports.updateTenant = async (req, res) => {
  try {
    const result = await tenantService.updateTenant(req.params.id, req.body);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error updating tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete tenant
 * DELETE /api/tenants/:id
 */
exports.deleteTenant = async (req, res) => {
  try {
    const result = await tenantService.deleteTenant(req.params.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error deleting tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Activate tenant
 * POST /api/tenants/:id/activate
 */
exports.activateTenant = async (req, res) => {
  try {
    const result = await tenantService.activateTenant(req.params.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error activating tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Suspend tenant
 * POST /api/tenants/:id/suspend
 */
exports.suspendTenant = async (req, res) => {
  try {
    const result = await tenantService.suspendTenant(req.params.id, req.body.reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error suspending tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Cancel tenant
 * POST /api/tenants/:id/cancel
 */
exports.cancelTenant = async (req, res) => {
  try {
    const result = await tenantService.cancelTenant(req.params.id, req.body.reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error cancelling tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get current tenant (from context)
 * GET /api/tenant
 */
exports.getCurrentTenant = async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    res.json({ success: true, tenant: req.tenant });
  } catch (error) {
    logger.error(`[Tenant] Error getting current tenant: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get tenant settings
 * GET /api/tenant/settings
 */
exports.getTenantSettings = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = tenantService.getTenant(req.tenantId);
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({ success: true, settings: result.tenant.settings });
  } catch (error) {
    logger.error(`[Tenant] Error getting settings: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update tenant settings
 * PUT /api/tenant/settings
 */
exports.updateTenantSettings = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = await tenantService.updateSettings(req.tenantId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error updating settings: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get tenant usage stats
 * GET /api/tenant/usage
 */
exports.getTenantUsage = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = tenantService.getUsageStats(req.tenantId);
    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error getting usage: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get available plans
 * GET /api/tenant/plans
 */
exports.getAvailablePlans = async (req, res) => {
  try {
    const result = tenantService.getAvailablePlans();
    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error getting plans: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Change tenant plan
 * POST /api/tenant/plan
 */
exports.changeTenantPlan = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Plan is required' });
    }

    const result = await tenantService.changePlan(req.tenantId, plan);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Update subscription
    billingService.changePlan(req.tenantId, plan, req.body.immediate);

    res.json(result);
  } catch (error) {
    logger.error(`[Tenant] Error changing plan: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =====================================================
// RBAC - ROLES
// =====================================================

/**
 * List all roles
 * GET /api/tenant/roles
 */
exports.listRoles = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.listRoles(req.tenantId);
    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error listing roles: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get built-in roles
 * GET /api/tenant/roles/builtin
 */
exports.getBuiltInRoles = async (req, res) => {
  try {
    const roles = rbacService.getBuiltInRoles();
    res.json({ success: true, roles });
  } catch (error) {
    logger.error(`[RBAC] Error getting built-in roles: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get role by ID
 * GET /api/tenant/roles/:roleId
 */
exports.getRole = async (req, res) => {
  try {
    const result = rbacService.getRole(req.params.roleId, req.tenantId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error getting role: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create custom role
 * POST /api/tenant/roles
 */
exports.createRole = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.createRole(req.tenantId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    logger.error(`[RBAC] Error creating role: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update role
 * PUT /api/tenant/roles/:roleId
 */
exports.updateRole = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.updateRole(req.tenantId, req.params.roleId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error updating role: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete role
 * DELETE /api/tenant/roles/:roleId
 */
exports.deleteRole = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.deleteRole(req.tenantId, req.params.roleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error deleting role: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Clone role
 * POST /api/tenant/roles/:roleId/clone
 */
exports.cloneRole = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.cloneRole(req.tenantId, req.params.roleId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    logger.error(`[RBAC] Error cloning role: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =====================================================
// RBAC - USER ROLES
// =====================================================

/**
 * Get user roles
 * GET /api/tenant/users/:userId/roles
 */
exports.getUserRoles = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.getUserRoles(req.tenantId, req.params.userId);
    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error getting user roles: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Set user roles
 * PUT /api/tenant/users/:userId/roles
 */
exports.setUserRoles = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const { roles } = req.body;
    if (!Array.isArray(roles)) {
      return res.status(400).json({ success: false, error: 'Roles array is required' });
    }

    const result = rbacService.setUserRoles(req.tenantId, req.params.userId, roles);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error setting user roles: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Assign role to user
 * POST /api/tenant/users/:userId/roles/:roleId
 */
exports.assignRole = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.assignRole(req.tenantId, req.params.userId, req.params.roleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error assigning role: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Remove role from user
 * DELETE /api/tenant/users/:userId/roles/:roleId
 */
exports.removeRole = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.removeRole(req.tenantId, req.params.userId, req.params.roleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error removing role: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get user permissions
 * GET /api/tenant/users/:userId/permissions
 */
exports.getUserPermissions = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = rbacService.getUserPermissions(req.tenantId, req.params.userId);
    res.json(result);
  } catch (error) {
    logger.error(`[RBAC] Error getting user permissions: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Check user permission
 * GET /api/tenant/users/:userId/permissions/check
 */
exports.checkPermission = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const { resource, action, scope } = req.query;
    if (!resource || !action) {
      return res.status(400).json({ success: false, error: 'Resource and action are required' });
    }

    const hasPermission = rbacService.hasPermission(
      req.tenantId,
      req.params.userId,
      resource,
      action,
      scope
    );

    res.json({ success: true, hasPermission, resource, action, scope });
  } catch (error) {
    logger.error(`[RBAC] Error checking permission: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get permission info
 * GET /api/tenant/permissions/info
 */
exports.getPermissionInfo = async (req, res) => {
  try {
    const info = rbacService.getPermissionInfo();
    res.json({ success: true, ...info });
  } catch (error) {
    logger.error(`[RBAC] Error getting permission info: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =====================================================
// BILLING
// =====================================================

/**
 * Get billing overview
 * GET /api/tenant/billing
 */
exports.getBillingOverview = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.getBillingOverview(req.tenantId);
    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error getting overview: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get subscription
 * GET /api/tenant/billing/subscription
 */
exports.getSubscription = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.getSubscription(req.tenantId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error getting subscription: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update subscription
 * PUT /api/tenant/billing/subscription
 */
exports.updateSubscription = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.updateSubscription(req.tenantId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error updating subscription: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Change plan
 * POST /api/tenant/billing/change-plan
 */
exports.changeBillingPlan = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const { plan, immediate } = req.body;
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Plan is required' });
    }

    // Change billing subscription
    const billingResult = billingService.changePlan(req.tenantId, plan, immediate);
    if (!billingResult.success) {
      return res.status(400).json(billingResult);
    }

    // Change tenant plan
    tenantService.changePlan(req.tenantId, plan);

    res.json(billingResult);
  } catch (error) {
    logger.error(`[Billing] Error changing plan: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Cancel subscription
 * POST /api/tenant/billing/cancel
 */
exports.cancelSubscription = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.cancelSubscription(req.tenantId, req.body.immediate);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error cancelling subscription: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Reactivate subscription
 * POST /api/tenant/billing/reactivate
 */
exports.reactivateSubscription = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.reactivateSubscription(req.tenantId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error reactivating subscription: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get plan pricing
 * GET /api/tenant/billing/pricing
 */
exports.getPlanPricing = async (req, res) => {
  try {
    const result = billingService.getPlanPricing();
    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error getting pricing: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * List invoices
 * GET /api/tenant/billing/invoices
 */
exports.listInvoices = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const options = {
      status: req.query.status,
      type: req.query.type,
      from: req.query.from,
      to: req.query.to,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = billingService.listInvoices(req.tenantId, options);
    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error listing invoices: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get invoice
 * GET /api/tenant/billing/invoices/:invoiceId
 */
exports.getInvoice = async (req, res) => {
  try {
    const result = billingService.getInvoice(req.params.invoiceId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Verify invoice belongs to tenant
    if (result.invoice.tenantId !== req.tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error getting invoice: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * List payment methods
 * GET /api/tenant/billing/payment-methods
 */
exports.listPaymentMethods = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.listPaymentMethods(req.tenantId);
    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error listing payment methods: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Add payment method
 * POST /api/tenant/billing/payment-methods
 */
exports.addPaymentMethod = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.addPaymentMethod(req.tenantId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    logger.error(`[Billing] Error adding payment method: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Remove payment method
 * DELETE /api/tenant/billing/payment-methods/:methodId
 */
exports.removePaymentMethod = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.removePaymentMethod(req.tenantId, req.params.methodId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error removing payment method: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Set default payment method
 * PUT /api/tenant/billing/payment-methods/:methodId/default
 */
exports.setDefaultPaymentMethod = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.setDefaultPaymentMethod(req.tenantId, req.params.methodId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error setting default payment method: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get usage summary
 * GET /api/tenant/billing/usage
 */
exports.getUsageSummary = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.getUsageSummary(req.tenantId, req.query.period);
    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error getting usage summary: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get billing statement
 * GET /api/tenant/billing/statement
 */
exports.getBillingStatement = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, error: 'No tenant context' });
    }

    const result = billingService.generateBillingStatement(req.tenantId, req.query.period);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Error generating statement: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};
