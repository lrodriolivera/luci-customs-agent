/**
 * API Key Authentication Middleware
 * Phase 6.7: Portal Cliente Avanzado
 * Authenticates requests using client API keys
 */

const { ClientApiKey } = require('../models');
const logger = require('../config/logger');

// Rate limit tracking (in-memory, use Redis in production)
const rateLimitStore = new Map();

/**
 * Authenticate API key from header
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    // Find and validate API key
    const keyDoc = await ClientApiKey.findByKey(apiKey);

    if (!keyDoc) {
      logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 12)}...`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired API key',
        code: 'INVALID_API_KEY'
      });
    }

    // Check IP whitelist
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!keyDoc.isIpAllowed(clientIp)) {
      logger.warn(`API key ${keyDoc.keyPrefix} blocked from IP: ${clientIp}`);
      return res.status(403).json({
        success: false,
        error: 'IP not allowed',
        code: 'IP_NOT_ALLOWED'
      });
    }

    // Check rate limits
    const rateLimitResult = checkRateLimit(keyDoc, clientIp);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', keyDoc.rateLimit.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimitResult.resetTime);

    // Record usage (async, don't wait)
    keyDoc.recordUsage(clientIp).catch(err => {
      logger.error('Error recording API key usage:', err);
    });

    // Attach to request
    req.apiKey = keyDoc;
    req.organizationId = keyDoc.organizationId._id || keyDoc.organizationId;
    req.organization = keyDoc.organizationId;

    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Check rate limits
 */
function checkRateLimit(keyDoc, clientIp) {
  const keyId = keyDoc._id.toString();
  const now = Date.now();
  const minuteWindow = 60 * 1000;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(keyId);
  if (!entry || now - entry.windowStart > minuteWindow) {
    entry = {
      windowStart: now,
      count: 0
    };
  }

  entry.count++;
  rateLimitStore.set(keyId, entry);

  const limit = keyDoc.rateLimit.requestsPerMinute;
  const remaining = Math.max(0, limit - entry.count);
  const resetTime = Math.ceil((entry.windowStart + minuteWindow) / 1000);

  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter: Math.ceil((entry.windowStart + minuteWindow - now) / 1000)
    };
  }

  return {
    allowed: true,
    remaining,
    resetTime
  };
}

/**
 * Require specific permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    if (!req.apiKey.hasPermission(permission)) {
      logger.warn(`API key ${req.apiKey.keyPrefix} denied permission: ${permission}`);
      return res.status(403).json({
        success: false,
        error: `Permission denied: ${permission}`,
        code: 'PERMISSION_DENIED'
      });
    }

    next();
  };
};

/**
 * Require any of the specified permissions
 */
const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    const hasAny = permissions.some(p => req.apiKey.hasPermission(p));
    if (!hasAny) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Requires one of: ${permissions.join(', ')}`,
        code: 'PERMISSION_DENIED'
      });
    }

    next();
  };
};

/**
 * Clean up old rate limit entries (run periodically)
 */
function cleanupRateLimits() {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every minute
setInterval(cleanupRateLimits, 60 * 1000);

module.exports = {
  authenticateApiKey,
  requirePermission,
  requireAnyPermission
};
