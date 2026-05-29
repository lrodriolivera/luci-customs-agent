const unsubscribeToken = require('../src/utils/unsubscribeToken');

describe('unsubscribeToken', () => {
  test('signs and verifies a valid token round-trip', () => {
    const token = unsubscribeToken.sign('test@example.com');
    expect(typeof token).toBe('string');
    expect(token).toContain('.');
    expect(unsubscribeToken.verify(token)).toBe('test@example.com');
  });

  test('normalizes case + trim', () => {
    const token = unsubscribeToken.sign('  Hi@Example.COM  ');
    expect(unsubscribeToken.verify(token)).toBe('hi@example.com');
  });

  test('rejects tampered payload', () => {
    const token = unsubscribeToken.sign('user@example.com');
    const [, sig] = token.split('.');
    const tampered = Buffer.from('attacker@evil.com').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.' + sig;
    expect(unsubscribeToken.verify(tampered)).toBeNull();
  });

  test('rejects tampered signature', () => {
    const token = unsubscribeToken.sign('user@example.com');
    const [payload] = token.split('.');
    const fake = Buffer.alloc(32, 0).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(unsubscribeToken.verify(`${payload}.${fake}`)).toBeNull();
  });

  test('rejects malformed input', () => {
    expect(unsubscribeToken.verify(null)).toBeNull();
    expect(unsubscribeToken.verify('')).toBeNull();
    expect(unsubscribeToken.verify('nodot')).toBeNull();
    expect(unsubscribeToken.verify(undefined)).toBeNull();
  });
});
