const jwt = require('jsonwebtoken');

// Require jwtService lazily so env vars are read after setup.js
let jwtService;
beforeAll(() => {
  jwtService = require('../src/utils/jwtService');
});

describe('jwtService', () => {
  describe('sign + verify', () => {
    test('signs token with iss and aud claims', () => {
      const token = jwtService.sign({ id: 'u1', email: 'a@b.com', role: 'admin' });
      const decoded = jwtService.verify(token);
      expect(decoded.iss).toBe('luci-customs-agent');
      expect(decoded.aud).toBe('luci-api');
      expect(decoded.id).toBe('u1');
      expect(decoded.email).toBe('a@b.com');
      expect(decoded.role).toBe('admin');
    });

    test('sets exp claim', () => {
      const token = jwtService.sign({ id: 'u1' });
      const decoded = jwtService.verify(token);
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('security', () => {
    test('rejects tampered token', () => {
      const token = jwtService.sign({ id: 'u1' });
      const tampered = token.slice(0, -6) + 'xxxxxx';
      expect(() => jwtService.verify(tampered)).toThrow();
    });

    test('rejects token with wrong issuer', () => {
      const evil = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, {
        issuer: 'attacker',
        audience: 'luci-api'
      });
      expect(() => jwtService.verify(evil)).toThrow(/issuer/i);
    });

    test('rejects token with wrong audience', () => {
      const evil = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, {
        issuer: 'luci-customs-agent',
        audience: 'attacker-api'
      });
      expect(() => jwtService.verify(evil)).toThrow(/audience/i);
    });

    test('rejects garbage token', () => {
      expect(() => jwtService.verify('not.a.jwt')).toThrow();
      expect(() => jwtService.verify('abcdef')).toThrow();
    });

    test('rejects token signed with different secret', () => {
      const other = jwt.sign({ id: 'u1' }, 'another-secret-that-is-different-and-long-enough', {
        issuer: 'luci-customs-agent',
        audience: 'luci-api'
      });
      expect(() => jwtService.verify(other)).toThrow(/signature/i);
    });
  });

  describe('legacy mode', () => {
    const originalLegacy = process.env.JWT_LEGACY_MODE;
    afterAll(() => { process.env.JWT_LEGACY_MODE = originalLegacy; });

    test('when enabled, accepts tokens without iss/aud', () => {
      process.env.JWT_LEGACY_MODE = 'true';
      jest.resetModules();
      const svc = require('../src/utils/jwtService');
      const legacy = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
      const decoded = svc.verify(legacy);
      expect(decoded.id).toBe('u1');
    });

    test('when disabled, rejects tokens without iss/aud', () => {
      process.env.JWT_LEGACY_MODE = 'false';
      jest.resetModules();
      const svc = require('../src/utils/jwtService');
      const legacy = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
      expect(() => svc.verify(legacy)).toThrow();
    });
  });

  describe('dual-secret rotation', () => {
    test('verifies tokens signed with JWT_SECRET_PREVIOUS', () => {
      process.env.JWT_SECRET_PREVIOUS = 'a-previous-rotated-secret-32-characters-long-abc';
      jest.resetModules();
      const svc = require('../src/utils/jwtService');
      const oldToken = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET_PREVIOUS, {
        issuer: 'luci-customs-agent',
        audience: 'luci-api'
      });
      const decoded = svc.verify(oldToken);
      expect(decoded.id).toBe('u1');
      delete process.env.JWT_SECRET_PREVIOUS;
    });
  });
});
