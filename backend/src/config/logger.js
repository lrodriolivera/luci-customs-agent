const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) { /* ignore */ }
}

const REDACT_KEYS = new Set([
  'password', 'token', 'authorization', 'cookie', 'jwt', 'jwtSecret',
  'apiKey', 'api_key', 'secret', 'privateKey', 'private_key',
  'stripeSecretKey', 'anthropicApiKey', 'passphrase',
  'x-api-key', 'set-cookie'
]);

function redactDeep(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 4096) return value.slice(0, 4096) + '…[truncated]';
    return value;
  }
  if (Array.isArray(value)) return value.map(v => redactDeep(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACT_KEYS.has(k.toLowerCase())) out[k] = '[REDACTED]';
      else out[k] = redactDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

const redactFormat = winston.format((info) => redactDeep(info))();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    redactFormat,
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'luci-customs' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Lightweight child-helper for request-scoped logging
logger.forRequest = (req) => logger.child({
  requestId: req?.id,
  userId: req?.user?._id?.toString(),
  tenantId: req?.tenantId?.toString(),
  method: req?.method,
  url: req?.originalUrl
});

module.exports = logger;
