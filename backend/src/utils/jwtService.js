const jwt = require('jsonwebtoken');

const ISSUER = process.env.JWT_ISSUER || 'luci-customs-agent';
const AUDIENCE = process.env.JWT_AUDIENCE || 'luci-api';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const LEGACY_MODE = process.env.JWT_LEGACY_MODE === 'true';

const PLACEHOLDER_SECRETS = new Set([
  'your-super-secret-jwt-key-change-in-production',
  'luci-customs-agent-jwt-secret-key-2025',
  'change-this-in-production',
  'secret'
]);

function validateSecret(secret, label) {
  if (!secret || secret.length < 32) {
    throw new Error(`${label} missing or too short (min 32 chars). Check environment.`);
  }
  if (PLACEHOLDER_SECRETS.has(secret)) {
    throw new Error(`${label} is a default placeholder. Rotate to a unique strong value.`);
  }
}

function getPrimarySecret() {
  const secret = process.env.JWT_SECRET;
  validateSecret(secret, 'JWT_SECRET');
  return secret;
}

function getPreviousSecret() {
  const secret = process.env.JWT_SECRET_PREVIOUS;
  if (!secret) return null;
  if (secret.length < 32) return null;
  return secret;
}

function sign(payload) {
  return jwt.sign(payload, getPrimarySecret(), {
    expiresIn: EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE
  });
}

function verify(token) {
  const primary = getPrimarySecret();
  const options = { issuer: ISSUER, audience: AUDIENCE };

  try {
    return jwt.verify(token, primary, options);
  } catch (err) {
    if (LEGACY_MODE && /audience|issuer/i.test(err.message || '')) {
      try {
        return jwt.verify(token, primary);
      } catch (_) { /* fall through to previous secret */ }
    }

    const previous = getPreviousSecret();
    if (previous) {
      try {
        return jwt.verify(token, previous, options);
      } catch (_) {
        if (LEGACY_MODE) {
          try { return jwt.verify(token, previous); } catch (_) { /* ignore */ }
        }
      }
    }
    throw err;
  }
}

module.exports = { sign, verify, ISSUER, AUDIENCE };
