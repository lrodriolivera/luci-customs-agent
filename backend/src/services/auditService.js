const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'cookie', 'apiKey', 'secret']);

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) out[k] = '[REDACTED]';
    else if (v && typeof v === 'object') out[k] = scrub(v);
    else out[k] = v;
  }
  return out;
}

/**
 * Log an audit entry. Fire-and-forget: failures must not block the caller.
 *
 * @param {object} opts
 * @param {object} opts.req        - Express request (optional, used for context)
 * @param {string} opts.action     - action verb (login, create, update, delete, export, submit_aeat, …)
 * @param {string} opts.resource   - resource type (User, Expedition, H7Declaration, …)
 * @param {string} [opts.resourceId] - specific resource id
 * @param {boolean} [opts.success=true]
 * @param {string} [opts.errorMessage]
 * @param {object} [opts.changes]    - before/after diff (scrubbed)
 * @param {object} [opts.metadata]   - extra context (scrubbed)
 */
async function log(opts = {}) {
  try {
    const { req, action, resource, resourceId, success = true, errorMessage, changes, metadata } = opts;
    if (!action || !resource) {
      logger.warn('auditService.log called without action/resource');
      return;
    }
    const entry = {
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      success,
      errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : undefined,
      changes: changes ? scrub(changes) : undefined,
      metadata: metadata ? scrub(metadata) : undefined,
      timestamp: new Date()
    };
    if (req) {
      entry.tenantId = req.tenantId || req.user?.tenantId;
      entry.userId = req.user?._id;
      entry.userEmail = req.user?.email;
      entry.method = req.method;
      entry.url = req.originalUrl;
      entry.ip = req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim();
      entry.userAgent = req.headers?.['user-agent'];
      entry.requestId = req.id;
      entry.status = req.res?.statusCode;
    }
    await AuditLog.create(entry);
  } catch (err) {
    logger.error('auditService.log failed', { error: err.message });
  }
}

/**
 * Express middleware. Attaches req.audit(opts) helper so controllers can call:
 *   req.audit({ action: 'login', resource: 'User', resourceId: user._id });
 */
function middleware(req, res, next) {
  req.audit = (opts) => log({ req, ...opts });
  next();
}

async function query({ tenantId, userId, resource, resourceId, from, to, limit = 100 } = {}) {
  const q = {};
  if (tenantId) q.tenantId = tenantId;
  if (userId) q.userId = userId;
  if (resource) q.resource = resource;
  if (resourceId) q.resourceId = String(resourceId);
  if (from || to) {
    q.timestamp = {};
    if (from) q.timestamp.$gte = new Date(from);
    if (to)   q.timestamp.$lte = new Date(to);
  }
  return AuditLog.find(q).sort({ timestamp: -1 }).limit(Math.min(limit, 1000)).lean();
}

module.exports = { log, middleware, query };
