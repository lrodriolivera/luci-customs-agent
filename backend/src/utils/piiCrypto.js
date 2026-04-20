/**
 * Field-level encryption for PII (NIF, EORI, tax IDs).
 *
 * Uses AES-256-GCM with a derived key from PII_ENCRYPTION_KEY.
 * Ciphertext is stored as a base64 string with a "v1:" version prefix so we
 * can rotate algorithms later. Values without the prefix are treated as
 * plaintext (backward compatible with existing records).
 *
 * Set PII_ENCRYPTION_KEY to a strong secret (min 32 chars). Same value across
 * cluster is required.
 */

const crypto = require('crypto');

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.PII_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    return null; // encryption disabled; callers will pass-through
  }
  cachedKey = crypto.createHash('sha256').update(secret).digest();
  return cachedKey;
}

function isEncrypted(str) {
  return typeof str === 'string' && str.startsWith(`${VERSION}:`);
}

function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (typeof plaintext !== 'string') return plaintext;
  if (isEncrypted(plaintext)) return plaintext;

  const key = getKey();
  if (!key) return plaintext; // feature disabled

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ct]).toString('base64');
  return `${VERSION}:${payload}`;
}

function decrypt(value) {
  if (value == null || value === '') return value;
  if (typeof value !== 'string') return value;
  if (!isEncrypted(value)) return value; // plaintext legacy

  const key = getKey();
  if (!key) return value;

  try {
    const payload = Buffer.from(value.slice(VERSION.length + 1), 'base64');
    const iv = payload.subarray(0, IV_LEN);
    const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = payload.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch (_err) {
    return value;
  }
}

function enabled() {
  return getKey() !== null;
}

module.exports = { encrypt, decrypt, isEncrypted, enabled };
