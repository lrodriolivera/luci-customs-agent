/**
 * Tenant Middleware
 * Phase 6.3: Multi-Tenancy Support
 *
 * Middleware for tenant isolation and request scoping
 */

const logger = require('../config/logger');
const tenantService = require('../services/tenant/tenantService');
const rbacService = require('../services/tenant/rbacService');

/**
 * Extract tenant from request
 * Supports multiple methods: header, subdomain, path
 */
const extractTenant = (options = {}) => {
  return async (req, res, next) => {
    try {
      let tenantId = null;
      let tenantSlug = null;

      // 1. Try from header (X-Tenant-ID)
      if (req.headers['x-tenant-id']) {
        tenantId = req.headers['x-tenant-id'];
      }

      // 2. Try from header (X-Tenant-Slug)
      if (!tenantId && req.headers['x-tenant-slug']) {
        tenantSlug = req.headers['x-tenant-slug'];
      }

      // 3. Try from subdomain (tenant.domain.com)
      if (!tenantId && !tenantSlug && options.useSubdomain) {
        const host = req.hostname || req.headers.host;
        if (host) {
          const parts = host.split('.');
          if (parts.length > 2) {
            tenantSlug = parts[0];
          }
        }
      }

      // 4. Try from path (/api/t/{tenant}/...)
      if (!tenantId && !tenantSlug && options.usePath) {
        const match = req.path.match(/^\/api\/t\/([^\/]+)/);
        if (match) {
          tenantSlug = match[1];
        }
      }

      // 5. Try from user's tenant (if authenticated)
      if (!tenantId && !tenantSlug && req.user?.tenantId) {
        tenantId = req.user.tenantId;
      }

      // Resolve tenant
      let tenant = null;

      if (tenantId) {
        const result = tenantService.getTenant(tenantId);
        if (result.success) {
          tenant = result.tenant;
        }
      } else if (tenantSlug) {
        const result = tenantService.getTenantBySlug(tenantSlug);
        if (result.success) {
          tenant = result.tenant;
        }
      }

      // If tenant is required but not found
      if (options.required && !tenant) {
        return res.status(400).json({
          success: false,
          error: 'Tenant identification required',
          code: 'TENANT_REQUIRED'
        });
      }

      // Check tenant is active
      if (tenant && !tenantService.isActive(tenant.id)) {
        return res.status(403).json({
          success: false,
          error: 'Tenant account is not active',
          code: 'TENANT_INACTIVE'
        });
      }

      // Attach tenant to request
      req.tenant = tenant;
      req.tenantId = tenant?.id || null;

      next();
    } catch (error) {
      logger.error(`[TenantMiddleware] Error extracting tenant: ${error.message}`);
      next(error);
    }
  };
};

/**
 * Require tenant to be present
 */
const requireTenant = (req, res, next) => {
  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED'
    });
  }
  next();
};

/**
 * Check permission middleware
 * Usage: checkPermission('declaration', 'create')
 */
const checkPermission = (resource, action, scope = null) => {
  return (req, res, next) => {
    if (!req.tenant || !req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const hasPermission = rbacService.hasPermission(
      req.tenantId,
      req.user.id,
      resource,
      action,
      scope
    );

    if (!hasPermission) {
      logger.warn(`[RBAC] Permission denied: ${req.user.id} -> ${resource}:${action}${scope ? ':' + scope : ''}`);
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED',
        required: { resource, action, scope }
      });
    }

    next();
  };
};

/**
 * Check multiple permissions (all must pass)
 */
const checkAllPermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.tenant || !req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const hasAll = rbacService.hasAllPermissions(req.tenantId, req.user.id, permissions);

    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: permissions
      });
    }

    next();
  };
};

/**
 * Check any permission (at least one must pass)
 */
const checkAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.tenant || !req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const hasAny = rbacService.hasAnyPermission(req.tenantId, req.user.id, permissions);

    if (!hasAny) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED',
        requiredAny: permissions
      });
    }

    next();
  };
};

/**
 * Check feature access
 */
const requireFeature = (featureName) => {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context required',
        code: 'TENANT_REQUIRED'
      });
    }

    const hasFeature = tenantService.canUseFeature(req.tenantId, featureName);

    if (!hasFeature) {
      return res.status(403).json({
        success: false,
        error: `Feature '${featureName}' not available in your plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature: featureName
      });
    }

    next();
  };
};

/**
 * Check usage limits
 */
const checkLimit = (limitType) => {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context required',
        code: 'TENANT_REQUIRED'
      });
    }

    const reachedLimit = tenantService.hasReachedLimit(req.tenantId, limitType);

    if (reachedLimit) {
      return res.status(429).json({
        success: false,
        error: `Usage limit reached for ${limitType}`,
        code: 'LIMIT_REACHED',
        limitType
      });
    }

    next();
  };
};

/**
 * Track usage middleware
 */
const trackUsage = (usageType) => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    res.end = function(...args) {
      // Only track successful operations
      if (res.statusCode >= 200 && res.statusCode < 300 && req.tenantId) {
        tenantService.incrementUsage(req.tenantId, usageType).catch(err => {
          logger.error(`[Usage] Error tracking ${usageType}: ${err.message}`);
        });
      }

      // Call original end
      originalEnd.apply(res, args);
    };

    next();
  };
};

/**
 * Scope query to tenant
 * Adds tenantId filter to MongoDB queries
 */
const scopeQuery = (req, res, next) => {
  if (req.tenantId) {
    // Store original query builder
    req.scopedQuery = (query) => {
      return { ...query, tenantId: req.tenantId };
    };

    // For mongoose models
    req.scopeModel = (model) => {
      return {
        find: (query = {}) => model.find({ ...query, tenantId: req.tenantId }),
        findOne: (query = {}) => model.findOne({ ...query, tenantId: req.tenantId }),
        countDocuments: (query = {}) => model.countDocuments({ ...query, tenantId: req.tenantId }),
        aggregate: (pipeline = []) => model.aggregate([
          { $match: { tenantId: req.tenantId } },
          ...pipeline
        ])
      };
    };
  }

  next();
};

/**
 * Admin only middleware
 */
const adminOnly = (req, res, next) => {
  if (!req.tenant || !req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const rolesResult = rbacService.getUserRoles(req.tenantId, req.user.id);
  const isAdmin = rolesResult.roles?.some(r =>
    r.id === 'super_admin' || r.id === 'tenant_admin'
  );

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Administrator access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Super admin only middleware
 */
const superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Super admin can work across tenants
  const isSuperAdmin = req.user.role === 'super_admin' ||
    req.user.roles?.includes('super_admin');

  if (!isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Super administrator access required',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Resource ownership check
 * Ensures user can only access their own resources or has admin rights
 */
const checkOwnership = (getOwnerId) => {
  return async (req, res, next) => {
    if (!req.tenant || !req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admins bypass ownership check
    const rolesResult = rbacService.getUserRoles(req.tenantId, req.user.id);
    const isAdmin = rolesResult.roles?.some(r =>
      r.id === 'super_admin' || r.id === 'tenant_admin' || r.id === 'manager'
    );

    if (isAdmin) {
      return next();
    }

    // Get resource owner ID
    try {
      const ownerId = await getOwnerId(req);

      if (ownerId && ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this resource',
          code: 'OWNERSHIP_DENIED'
        });
      }

      next();
    } catch (error) {
      logger.error(`[Ownership] Error checking ownership: ${error.message}`);
      next(error);
    }
  };
};

/**
 * Rate limiting per tenant
 */
const tenantRateLimit = (options = {}) => {
  const limits = new Map(); // tenantId -> { count, resetTime }
  const maxRequests = options.maxRequests || 100;
  const windowMs = options.windowMs || 60000; // 1 minute

  return (req, res, next) => {
    if (!req.tenantId) {
      return next();
    }

    const now = Date.now();
    let tenantLimit = limits.get(req.tenantId);

    if (!tenantLimit || now > tenantLimit.resetTime) {
      tenantLimit = { count: 0, resetTime: now + windowMs };
      limits.set(req.tenantId, tenantLimit);
    }

    tenantLimit.count++;

    if (tenantLimit.count > maxRequests) {
      res.set('Retry-After', Math.ceil((tenantLimit.resetTime - now) / 1000));
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((tenantLimit.resetTime - now) / 1000)
      });
    }

    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', maxRequests - tenantLimit.count);
    res.set('X-RateLimit-Reset', Math.ceil(tenantLimit.resetTime / 1000));

    next();
  };
};

/**
 * Attach tenant context to response
 */
const attachTenantContext = (req, res, next) => {
  if (req.tenant) {
    res.set('X-Tenant-ID', req.tenant.id);
    res.set('X-Tenant-Slug', req.tenant.slug);
  }
  next();
};

module.exports = {
  extractTenant,
  requireTenant,
  checkPermission,
  checkAllPermissions,
  checkAnyPermission,
  requireFeature,
  checkLimit,
  trackUsage,
  scopeQuery,
  adminOnly,
  superAdminOnly,
  checkOwnership,
  tenantRateLimit,
  attachTenantContext
};
