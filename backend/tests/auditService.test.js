/**
 * Pure unit tests for auditService helpers (no DB connection).
 * Integration test for AuditLog.create would require a running MongoDB.
 */
const mongoose = require('mongoose');

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

  // Sin conexion, AuditLog.create() quedaba encolado en el buffer de Mongoose
  // y la promesa nunca se asentaba: eso mantenia vivo el event loop y colgaba
  // a Jest al desmontar el entorno ("Jest did not exit..." + ReferenceError
  // desde mongoose/lib/document.js). La escritura debe descartarse, no encolarse.
  test('req.audit settles instead of hanging when mongo is disconnected', async () => {
    jest.resetModules();
    const { middleware } = require('../src/services/auditService');
    expect(mongoose.connection.readyState).not.toBe(1);

    const req = {};
    middleware(req, {}, () => {});

    const pending = req.audit({ action: 'test', resource: 'Test' });
    expect(pending).toBeInstanceOf(Promise);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('req.audit never settled: write left pending')), 1000).unref()
    );
    await expect(Promise.race([pending, timeout])).resolves.toBeUndefined();
  });

  test('auditService.log is awaitable and never rejects on bad input', async () => {
    jest.resetModules();
    const { log } = require('../src/services/auditService');
    // Falta action/resource: sale temprano, pero sigue devolviendo una promesa
    // resuelta para que un `await` en el llamador no se quede colgado.
    await expect(log({})).resolves.toBeUndefined();
  });
});
