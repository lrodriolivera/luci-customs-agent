/**
 * Tenant Routes
 * Phase 6.3: Multi-Tenancy Support
 *
 * REST API routes for tenant, RBAC, and billing
 */

const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const {
  extractTenant,
  requireTenant,
  checkPermission,
  adminOnly,
  superAdminOnly,
  attachTenantContext
} = require('../middleware/tenantMiddleware');

// Apply tenant extraction to all routes
router.use(extractTenant({ required: false }));
router.use(attachTenantContext);

// =====================================================
// SUPER ADMIN - TENANT MANAGEMENT
// =====================================================

// Create tenant (super admin)
router.post('/tenants', superAdminOnly, tenantController.createTenant);

// List all tenants (super admin)
router.get('/tenants', superAdminOnly, tenantController.listTenants);

// Get tenant by ID (super admin)
router.get('/tenants/:id', superAdminOnly, tenantController.getTenant);

// Get tenant by slug (super admin)
router.get('/tenants/slug/:slug', superAdminOnly, tenantController.getTenantBySlug);

// Update tenant (super admin)
router.put('/tenants/:id', superAdminOnly, tenantController.updateTenant);

// Delete tenant (super admin)
router.delete('/tenants/:id', superAdminOnly, tenantController.deleteTenant);

// Activate tenant (super admin)
router.post('/tenants/:id/activate', superAdminOnly, tenantController.activateTenant);

// Suspend tenant (super admin)
router.post('/tenants/:id/suspend', superAdminOnly, tenantController.suspendTenant);

// Cancel tenant (super admin)
router.post('/tenants/:id/cancel', superAdminOnly, tenantController.cancelTenant);

// =====================================================
// CURRENT TENANT CONTEXT
// =====================================================

// Get current tenant
router.get('/tenant', requireTenant, tenantController.getCurrentTenant);

// Get available plans
router.get('/tenant/plans', tenantController.getAvailablePlans);

// Get tenant settings
router.get('/tenant/settings', requireTenant, tenantController.getTenantSettings);

// Update tenant settings (admin only)
router.put('/tenant/settings', requireTenant, adminOnly, tenantController.updateTenantSettings);

// Get tenant usage stats
router.get('/tenant/usage', requireTenant, tenantController.getTenantUsage);

// Change tenant plan (admin only)
router.post('/tenant/plan', requireTenant, adminOnly, tenantController.changeTenantPlan);

// =====================================================
// RBAC - ROLES
// =====================================================

// Get permission info (resources, actions)
router.get('/tenant/permissions/info', tenantController.getPermissionInfo);

// Get built-in roles
router.get('/tenant/roles/builtin', tenantController.getBuiltInRoles);

// List all roles for tenant
router.get('/tenant/roles', requireTenant, tenantController.listRoles);

// Get role by ID
router.get('/tenant/roles/:roleId', requireTenant, tenantController.getRole);

// Create custom role (admin only)
router.post('/tenant/roles', requireTenant, adminOnly, tenantController.createRole);

// Update role (admin only)
router.put('/tenant/roles/:roleId', requireTenant, adminOnly, tenantController.updateRole);

// Delete role (admin only)
router.delete('/tenant/roles/:roleId', requireTenant, adminOnly, tenantController.deleteRole);

// Clone role (admin only)
router.post('/tenant/roles/:roleId/clone', requireTenant, adminOnly, tenantController.cloneRole);

// =====================================================
// RBAC - USER ROLES
// =====================================================

// Get user roles
router.get(
  '/tenant/users/:userId/roles',
  requireTenant,
  checkPermission('user', 'read'),
  tenantController.getUserRoles
);

// Set user roles (replace all)
router.put(
  '/tenant/users/:userId/roles',
  requireTenant,
  adminOnly,
  tenantController.setUserRoles
);

// Assign role to user
router.post(
  '/tenant/users/:userId/roles/:roleId',
  requireTenant,
  adminOnly,
  tenantController.assignRole
);

// Remove role from user
router.delete(
  '/tenant/users/:userId/roles/:roleId',
  requireTenant,
  adminOnly,
  tenantController.removeRole
);

// Get user permissions
router.get(
  '/tenant/users/:userId/permissions',
  requireTenant,
  checkPermission('user', 'read'),
  tenantController.getUserPermissions
);

// Check specific permission
router.get(
  '/tenant/users/:userId/permissions/check',
  requireTenant,
  tenantController.checkPermission
);

// =====================================================
// BILLING - SUBSCRIPTION
// =====================================================

// Get billing overview
router.get('/tenant/billing', requireTenant, tenantController.getBillingOverview);

// Get plan pricing
router.get('/tenant/billing/pricing', tenantController.getPlanPricing);

// Get subscription
router.get('/tenant/billing/subscription', requireTenant, tenantController.getSubscription);

// Update subscription
router.put(
  '/tenant/billing/subscription',
  requireTenant,
  adminOnly,
  tenantController.updateSubscription
);

// Change plan
router.post(
  '/tenant/billing/change-plan',
  requireTenant,
  adminOnly,
  tenantController.changeBillingPlan
);

// Cancel subscription
router.post(
  '/tenant/billing/cancel',
  requireTenant,
  adminOnly,
  tenantController.cancelSubscription
);

// Reactivate subscription
router.post(
  '/tenant/billing/reactivate',
  requireTenant,
  adminOnly,
  tenantController.reactivateSubscription
);

// =====================================================
// BILLING - INVOICES
// =====================================================

// List invoices
router.get(
  '/tenant/billing/invoices',
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.listInvoices
);

// Get invoice by ID
router.get(
  '/tenant/billing/invoices/:invoiceId',
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.getInvoice
);

// =====================================================
// BILLING - PAYMENT METHODS
// =====================================================

// List payment methods
router.get(
  '/tenant/billing/payment-methods',
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.listPaymentMethods
);

// Add payment method
router.post(
  '/tenant/billing/payment-methods',
  requireTenant,
  adminOnly,
  tenantController.addPaymentMethod
);

// Remove payment method
router.delete(
  '/tenant/billing/payment-methods/:methodId',
  requireTenant,
  adminOnly,
  tenantController.removePaymentMethod
);

// Set default payment method
router.put(
  '/tenant/billing/payment-methods/:methodId/default',
  requireTenant,
  adminOnly,
  tenantController.setDefaultPaymentMethod
);

// =====================================================
// BILLING - USAGE
// =====================================================

// Get usage summary
router.get(
  '/tenant/billing/usage',
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.getUsageSummary
);

// Get billing statement
router.get(
  '/tenant/billing/statement',
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.getBillingStatement
);

// =====================================================
// CUSTOMS CONFIG - EORI per country
// =====================================================

const Tenant = require('../models/Tenant');
const { auth } = require('../middleware/auth');

/**
 * GET /api/tenant/eori
 * Get EORI numbers for all countries
 */
/**
 * GET /api/tenant/me
 * Devuelve el tenant del usuario autenticado leído de MongoDB (no del Map demo).
 */
router.get('/tenant/me', auth, extractTenant({ required: false }), requireTenant, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
    res.json({
      success: true,
      data: {
        id: String(tenant._id),
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        businessInfo: tenant.businessInfo || {},
        subscription: tenant.subscription || {},
        customsConfig: tenant.customsConfig || {},
        settings: tenant.settings || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tenant/eori', auth, extractTenant({ required: false }), requireTenant, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });

    res.json({
      success: true,
      data: {
        eoriNumbers: tenant.customsConfig?.eoriNumbers || {},
        defaultEori: tenant.businessInfo?.eori || ''
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/tenant/eori
 * Update EORI numbers per country
 * Body: { eoriNumbers: { ES: 'ESxxx', NL: 'NLxxx' } }
 */
router.put('/tenant/eori', auth, extractTenant({ required: false }), requireTenant, adminOnly, async (req, res) => {
  try {
    const { eoriNumbers } = req.body;
    if (!eoriNumbers || typeof eoriNumbers !== 'object') {
      return res.status(400).json({ success: false, error: 'eoriNumbers object requerido' });
    }

    // Validate EORI format per country
    const validCountries = ['ES', 'NL', 'BE', 'DE', 'FR', 'PT', 'IT'];
    const errors = [];
    for (const [country, eori] of Object.entries(eoriNumbers)) {
      if (!validCountries.includes(country)) {
        errors.push(`Pais no soportado: ${country}`);
        continue;
      }
      if (eori && !eori.startsWith(country)) {
        errors.push(`EORI de ${country} debe comenzar con ${country} (recibido: ${eori})`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });

    if (!tenant.customsConfig) tenant.customsConfig = {};
    if (!tenant.customsConfig.eoriNumbers) tenant.customsConfig.eoriNumbers = {};

    // Merge con los EORI existentes
    const merged = { ...(tenant.customsConfig.eoriNumbers || {}) };
    for (const [country, eori] of Object.entries(eoriNumbers)) {
      merged[country] = eori;
    }

    // Update directo en MongoDB (sin .save() para no revalidar campos legacy
    // como slug que pueden faltar en tenants creados antes del schema actual).
    await Tenant.updateOne(
      { _id: req.tenantId },
      { $set: { 'customsConfig.eoriNumbers': merged } },
      { runValidators: false }
    );

    res.json({
      success: true,
      data: { eoriNumbers: merged }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
