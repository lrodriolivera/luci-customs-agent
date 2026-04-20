/**
 * Pure unit tests for auditService helpers (no DB connection).
 * Integration test for AuditLog.create would require a running MongoDB.
 */
describe('auditService.middleware', () => {
  test('attaches req.audit helper that is safely callable', () => {
    jest.resetModules();
    const { middleware } = require('../src/services/auditService');
    const req = {};
    const res = {};
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(typeof req.audit).toBe('function');
    // Calling audit without DB connection should not throw (fire-and-forget)
    expect(() => req.audit({ action: 'test', resource: 'Test' })).not.toThrow();
  });
});
