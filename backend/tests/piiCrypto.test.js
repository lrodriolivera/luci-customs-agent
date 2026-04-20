const crypto = require('crypto');

describe('piiCrypto', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  test('encrypt then decrypt roundtrip', () => {
    const pii = require('../src/utils/piiCrypto');
    const plain = 'B22477020';
    const ct = pii.encrypt(plain);
    expect(pii.isEncrypted(ct)).toBe(true);
    expect(pii.decrypt(ct)).toBe(plain);
  });

  test('decrypt passes through plaintext (legacy records)', () => {
    const pii = require('../src/utils/piiCrypto');
    expect(pii.decrypt('B22477020')).toBe('B22477020');
  });

  test('encrypt is idempotent: re-encrypting ciphertext returns same value', () => {
    const pii = require('../src/utils/piiCrypto');
    const ct = pii.encrypt('ESB22477020');
    expect(pii.encrypt(ct)).toBe(ct);
  });

  test('ciphertext differs across calls (random IV)', () => {
    const pii = require('../src/utils/piiCrypto');
    const a = pii.encrypt('TEST-NIF');
    const b = pii.encrypt('TEST-NIF');
    expect(a).not.toBe(b);
    expect(pii.decrypt(a)).toBe('TEST-NIF');
    expect(pii.decrypt(b)).toBe('TEST-NIF');
  });

  test('tampered ciphertext falls back to returning the value as-is (no crash)', () => {
    const pii = require('../src/utils/piiCrypto');
    const ct = pii.encrypt('X');
    const tampered = ct.slice(0, -6) + 'zzzzzz';
    // decrypt returns the original garbled value (does not throw)
    expect(pii.decrypt(tampered)).toBe(tampered);
  });

  test('disabled when no key (null/empty/short)', () => {
    jest.resetModules();
    delete process.env.PII_ENCRYPTION_KEY;
    const pii = require('../src/utils/piiCrypto');
    expect(pii.enabled()).toBe(false);
    expect(pii.encrypt('X')).toBe('X'); // pass-through
  });

  test('handles null/undefined/empty gracefully', () => {
    const pii = require('../src/utils/piiCrypto');
    expect(pii.encrypt(null)).toBeNull();
    expect(pii.encrypt(undefined)).toBeUndefined();
    expect(pii.encrypt('')).toBe('');
    expect(pii.decrypt(null)).toBeNull();
  });
});
