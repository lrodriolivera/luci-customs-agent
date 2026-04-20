const crypto = require('crypto');

// This test checks the encrypt/decrypt roundtrip logic without needing a real
// MongoDB connection. We simulate the pre-save + post-init hook flow directly.

describe('Tenant PII encryption roundtrip', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.PII_HASH_KEY = crypto.randomBytes(32).toString('hex');
    process.env.ENCRYPT_PII = 'true';
  });

  afterEach(() => { delete process.env.ENCRYPT_PII; });

  test('encrypt → hash stable → decrypt recovers original', () => {
    const { encrypt, decrypt, isEncrypted } = require('../src/utils/piiCrypto');
    const { hash } = require('../src/utils/piiHash');

    const nifPlain = 'B22477020';
    const h1 = hash(nifPlain);
    const encrypted = encrypt(nifPlain);

    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted).not.toContain(nifPlain);

    // Hash remains stable (it was computed from plaintext, so lookups still work)
    expect(hash(nifPlain)).toBe(h1);

    // Decrypt recovers
    expect(decrypt(encrypted)).toBe(nifPlain);
  });

  test('legacy plaintext records keep working via pass-through decrypt', () => {
    const { decrypt, isEncrypted } = require('../src/utils/piiCrypto');
    const legacy = 'B22477020';
    expect(isEncrypted(legacy)).toBe(false);
    expect(decrypt(legacy)).toBe(legacy);
  });

  test('re-encrypting is idempotent (no double-wrap)', () => {
    const { encrypt } = require('../src/utils/piiCrypto');
    const a = encrypt('ESB22477020');
    const b = encrypt(a);
    expect(b).toBe(a); // already-encrypted pass-through
  });
});
