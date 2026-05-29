const crypto = require('crypto');

function getSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET (or JWT_SECRET) not configured');
  return secret;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(email) {
  const payload = b64url(email.toLowerCase().trim());
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest();
  const got = fromB64url(signature);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
  return fromB64url(payload).toString('utf8');
}

module.exports = { sign, verify };
