/**
 * Deterministic HMAC-SHA256 hash for PII fields to enable equality lookups
 * on encrypted data.
 *
 * Encryption (piiCrypto) uses random IVs, so ciphertexts differ each call and
 * cannot be queried by equality. We store alongside each encrypted field a
 * `<field>_hash` computed by this module. Lookup query:
 *
 *   await Tenant.findOne({ 'businessInfo.nif_hash': piiHash('B22477020') });
 *
 * The hash is computed with HMAC using PII_HASH_KEY as the secret so a dump of
 * the database alone cannot be dictionary-attacked.
 */

const crypto = require('crypto');

function getKey() {
  const k = process.env.PII_HASH_KEY || process.env.PII_ENCRYPTION_KEY;
  if (!k || k.length < 16) return null;
  return k;
}

function hash(value) {
  if (value == null || value === '') return value;
  const key = getKey();
  if (!key) return null; // feature disabled
  const s = String(value).trim().toUpperCase();
  return crypto.createHmac('sha256', key).update(s).digest('hex');
}

function enabled() { return getKey() !== null; }

module.exports = { hash, enabled };
