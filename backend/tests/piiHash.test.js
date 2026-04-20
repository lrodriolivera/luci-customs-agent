const crypto = require('crypto');

describe('piiHash', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.PII_HASH_KEY = crypto.randomBytes(32).toString('hex');
  });

  test('returns stable hash for same input', () => {
    const p = require('../src/utils/piiHash');
    const a = p.hash('B22477020');
    const b = p.hash('B22477020');
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // hex sha256
  });

  test('different inputs produce different hashes', () => {
    const p = require('../src/utils/piiHash');
    expect(p.hash('B22477020')).not.toBe(p.hash('B84285923'));
  });

  test('normalizes (trim + uppercase) before hashing', () => {
    const p = require('../src/utils/piiHash');
    expect(p.hash(' b22477020 ')).toBe(p.hash('B22477020'));
  });

  test('returns null when key not set', () => {
    jest.resetModules();
    delete process.env.PII_HASH_KEY;
    delete process.env.PII_ENCRYPTION_KEY;
    const p = require('../src/utils/piiHash');
    expect(p.enabled()).toBe(false);
    expect(p.hash('B22477020')).toBeNull();
  });

  test('handles null/undefined/empty', () => {
    const p = require('../src/utils/piiHash');
    expect(p.hash(null)).toBeNull();
    expect(p.hash('')).toBe('');
  });

  test('falls back to PII_ENCRYPTION_KEY if PII_HASH_KEY missing', () => {
    jest.resetModules();
    delete process.env.PII_HASH_KEY;
    process.env.PII_ENCRYPTION_KEY = 'a'.repeat(32);
    const p = require('../src/utils/piiHash');
    expect(p.enabled()).toBe(true);
    expect(p.hash('X')).toHaveLength(64);
  });
});
