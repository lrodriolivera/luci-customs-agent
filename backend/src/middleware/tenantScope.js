/**
 * Tenant Scope Middleware
 * Ensures all authenticated queries are scoped to the user's tenant.
 * Provides req.tenantQuery() helper for building tenant-scoped queries.
 */

const tenantScope = (req, res, next) => {
  if (!req.user) return next();

  const tenantId = req.user.tenantId || req.user.organizationId;

  // Attach tenant helpers to request
  req.tenantId = tenantId;

  // Helper: build a query scoped to the user's tenant
  // Usage: Model.find(req.tenantQuery({ status: 'draft' }))
  req.tenantQuery = (extraFilters = {}) => {
    if (!tenantId) return extraFilters;
    return { ...extraFilters, tenantId };
  };

  next();
};

module.exports = tenantScope;
