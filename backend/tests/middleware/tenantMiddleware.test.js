/**
 * Tests para tenantMiddleware (estaba al 0%).
 *
 * Es la capa que decide el aislamiento de TODO el sistema: quien tiene contexto
 * de tenant, quien puede cruzar tenants y como se acotan las consultas. El
 * tenantController que envuelve delega en el todo su control de acceso, asi que
 * cubrir el middleware protege mas superficie que cubrir el controller.
 */

jest.mock('../../src/services/tenant/rbacService', () => ({
  getUserRoles: jest.fn(() => ({ roles: [] })),
  hasPermission: jest.fn(() => ({ allowed: true }))
}));
jest.mock('../../src/services/tenant/tenantService', () => ({
  getTenant: jest.fn(),
  getTenantBySlug: jest.fn()
}));

const {
  requireTenant,
  superAdminOnly,
  scopeQuery
} = require('../../src/middleware/tenantMiddleware');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = jest.fn(c => { res.statusCode = c; return res; });
  res.json = jest.fn(b => { res.body = b; return res; });
  return res;
}

describe('tenantMiddleware.requireTenant', () => {
  test('deja pasar si hay tenant en el request', () => {
    const next = jest.fn();
    requireTenant({ tenantId: 't1' }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('deja pasar si hay objeto tenant aunque no haya tenantId', () => {
    const next = jest.fn();
    requireTenant({ tenant: { _id: 't1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('400 sin contexto de tenant', () => {
    const res = mockRes();
    const next = jest.fn();

    requireTenant({}, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('TENANT_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('tenantMiddleware.superAdminOnly', () => {
  test('401 si no hay usuario autenticado', () => {
    const res = mockRes();
    const next = jest.fn();

    superAdminOnly({}, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  test('403 para un admin normal: admin de tenant no es admin del sistema', () => {
    const res = mockRes();
    const next = jest.fn();

    superAdminOnly({ user: { role: 'admin', tenantId: 't1' } }, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('deja pasar con role super_admin', () => {
    const next = jest.fn();
    superAdminOnly({ user: { role: 'super_admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('deja pasar si super_admin viene en el array roles', () => {
    const next = jest.fn();
    superAdminOnly({ user: { role: 'agent', roles: ['super_admin'] } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  // Este test fijaba la INCONSISTENCIA: tenantMiddleware exigia 'super_admin',
  // tenantGuard aceptaba 'superadmin' sin guion bajo, y el enum de User no
  // admitia ninguno de los dos, de modo que /api/v1/tenants era inalcanzable.
  // Unificado en src/constants/roles.js, la forma heredada ya se reconoce: por
  // eso ahora se espera lo contrario. Ver tests/security/superAdminRole.test.js.
  test("'superadmin' sin guion bajo tambien pasa (forma heredada)", () => {
    const next = jest.fn();

    superAdminOnly({ user: { role: 'superadmin' } }, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('un admin de tenant sigue sin pasar: es rol de organizacion', () => {
    // Unificar no puede significar abrir la puerta.
    const res = mockRes();
    const next = jest.fn();

    superAdminOnly({ user: { role: 'admin' } }, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('tenantMiddleware.scopeQuery', () => {
  test('inyecta el tenantId en las consultas', () => {
    const req = { tenantId: 't1' };
    scopeQuery(req, mockRes(), jest.fn());

    expect(req.scopedQuery({ status: 'draft' })).toEqual({ status: 'draft', tenantId: 't1' });
  });

  test('el tenant del contexto gana sobre el que traiga la consulta', () => {
    // Si un caller pasa otro tenantId, no debe poder ampliar su alcance.
    const req = { tenantId: 't1' };
    scopeQuery(req, mockRes(), jest.fn());

    expect(req.scopedQuery({ tenantId: 't2' }).tenantId).toBe('t1');
  });

  test('scopeModel acota find, findOne y countDocuments', () => {
    const req = { tenantId: 't1' };
    scopeQuery(req, mockRes(), jest.fn());

    const model = { find: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn(), aggregate: jest.fn() };
    const scoped = req.scopeModel(model);

    scoped.find({ status: 'x' });
    scoped.findOne({ mrn: 'm' });
    scoped.countDocuments();

    expect(model.find).toHaveBeenCalledWith({ status: 'x', tenantId: 't1' });
    expect(model.findOne).toHaveBeenCalledWith({ mrn: 'm', tenantId: 't1' });
    expect(model.countDocuments).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  test('sin tenantId no expone los helpers, para no dar falsa sensacion de scope', () => {
    const req = {};
    const next = jest.fn();

    scopeQuery(req, mockRes(), next);

    expect(req.scopedQuery).toBeUndefined();
    expect(req.scopeModel).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
