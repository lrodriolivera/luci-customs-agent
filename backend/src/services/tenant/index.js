/**
 * Tenant Services Index
 * Phase 6.3: Multi-Tenancy Support
 */

const tenantService = require('./tenantService');
const rbacService = require('./rbacService');
const billingService = require('./billingService');

module.exports = {
  ...tenantService,
  ...rbacService,
  ...billingService,

  // Re-export for explicit imports
  tenantService,
  rbacService,
  billingService
};
