/**
 * Tests para tenantMiddleware (estaba al 0%).
 *
 * Es la capa que decide el aislamiento de TODO el sistema: quien tiene contexto
 * de tenant, quien puede cruzar tenants y como se acotan las consultas. El
 * tenantController que envuelve delega en el todo su control de acceso, asi que
 * cubrir el middleware protege mas superficie que cubrir el controller.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));
jest.mock('../../src/services/tenant/rbacService', () => ({
  getUserRoles: jest.fn(() => ({ roles: [] })),
  hasPermission: jest.fn(() => true),
  hasAllPermissions: jest.fn(() => true),
  hasAnyPermission: jest.fn(() => true)
}));
jest.mock('../../src/services/tenant/tenantService', () => ({
  getTenant: jest.fn(),
  getTenantBySlug: jest.fn(),
  isActive: jest.fn(() => true),
  canUseFeature: jest.fn(() => true),
  hasReachedLimit: jest.fn(() => false),
  incrementUsage: jest.fn(() => Promise.resolve({ success: true }))
}));

const {
  extractTenant,
  requireTenant,
  checkPermission,
  checkAllPermissions,
  checkAnyPermission,
  requireFeature,
  checkLimit,
  trackUsage,
  scopeQuery,
  adminOnly,
  superAdminOnly,
  checkOwnership,
  tenantRateLimit,
  attachTenantContext
} = require('../../src/middleware/tenantMiddleware');
const rbacService = require('../../src/services/tenant/rbacService');
const tenantService = require('../../src/services/tenant/tenantService');

// jest.config tiene resetMocks:true -> borra las implementaciones de fabrica de
// los jest.fn(() => ...) antes de cada test. Se restauran los defaults aqui; los
// tests que necesitan otro valor lo sobreescriben con mockReturnValue.
beforeEach(() => {
  rbacService.getUserRoles.mockReturnValue({ roles: [] });
  rbacService.hasPermission.mockReturnValue(true);
  rbacService.hasAllPermissions.mockReturnValue(true);
  rbacService.hasAnyPermission.mockReturnValue(true);
  tenantService.isActive.mockReturnValue(true);
  tenantService.canUseFeature.mockReturnValue(true);
  tenantService.hasReachedLimit.mockReturnValue(false);
  tenantService.incrementUsage.mockResolvedValue({ success: true });
});

function mockRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = jest.fn(c => { res.statusCode = c; return res; });
  res.json = jest.fn(b => { res.body = b; return res; });
  res.set = jest.fn((k, v) => { res.headers[k] = v; return res; });
  res.end = jest.fn();
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

  test('scopeModel.aggregate antepone el $match del tenant al pipeline', () => {
    const req = { tenantId: 't1' };
    scopeQuery(req, mockRes(), jest.fn());
    const model = { aggregate: jest.fn() };
    req.scopeModel(model).aggregate([{ $group: { _id: null } }]);
    expect(model.aggregate).toHaveBeenCalledWith([
      { $match: { tenantId: 't1' } },
      { $group: { _id: null } }
    ]);
  });
});

// ==================== extractTenant ====================

describe('tenantMiddleware.extractTenant', () => {
  test('resuelve por header X-Tenant-ID e inyecta el pais del tenant', async () => {
    tenantService.getTenant.mockReturnValue({
      success: true, tenant: { id: 't1', slug: 's1', customsConfig: { country: 'NL' } }
    });
    const req = { headers: { 'x-tenant-id': 't1' } };
    const next = jest.fn();
    await extractTenant()(req, mockRes(), next);
    expect(req.tenantId).toBe('t1');
    expect(req.country).toBe('NL');
    expect(next).toHaveBeenCalledWith();
  });

  test('resuelve por header X-Tenant-Slug y aplica pais por defecto ES', async () => {
    tenantService.getTenantBySlug.mockReturnValue({
      success: true, tenant: { id: 't2', slug: 'acme' }
    });
    const req = { headers: { 'x-tenant-slug': 'acme' } };
    await extractTenant()(req, mockRes(), jest.fn());
    expect(req.tenantId).toBe('t2');
    expect(req.country).toBe('ES');
  });

  test('resuelve el slug por subdominio cuando useSubdomain', async () => {
    tenantService.getTenantBySlug.mockReturnValue({ success: false });
    const req = { headers: { host: 'acme.luci.es' }, hostname: 'acme.luci.es' };
    await extractTenant({ useSubdomain: true })(req, mockRes(), jest.fn());
    expect(tenantService.getTenantBySlug).toHaveBeenCalledWith('acme');
  });

  test('resuelve el slug por path /api/t/{tenant} cuando usePath', async () => {
    tenantService.getTenantBySlug.mockReturnValue({ success: false });
    const req = { headers: {}, path: '/api/t/acme/declarations' };
    await extractTenant({ usePath: true })(req, mockRes(), jest.fn());
    expect(tenantService.getTenantBySlug).toHaveBeenCalledWith('acme');
  });

  test('cae al tenant del usuario autenticado si no viene por otra via', async () => {
    tenantService.getTenant.mockReturnValue({ success: true, tenant: { id: 'tU', slug: 's' } });
    const req = { headers: {}, user: { tenantId: 'tU' } };
    await extractTenant()(req, mockRes(), jest.fn());
    expect(tenantService.getTenant).toHaveBeenCalledWith('tU');
    expect(req.tenantId).toBe('tU');
  });

  test('propaga el tenantId del JWT aunque no exista en el Map demo (tenant=null)', async () => {
    tenantService.getTenant.mockReturnValue({ success: false });
    const req = { headers: { 'x-tenant-id': 'objectid-mongo' } };
    await extractTenant()(req, mockRes(), jest.fn());
    expect(req.tenant).toBeNull();
    expect(req.tenantId).toBe('objectid-mongo');
  });

  test('required sin tenant resuelto devuelve 400 TENANT_REQUIRED', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await extractTenant({ required: true })(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('TENANT_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  test('tenant inactivo devuelve 403 TENANT_INACTIVE', async () => {
    tenantService.getTenant.mockReturnValue({ success: true, tenant: { id: 't1', slug: 's' } });
    tenantService.isActive.mockReturnValue(false);
    const req = { headers: { 'x-tenant-id': 't1' } };
    const res = mockRes();
    const next = jest.fn();
    await extractTenant()(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('TENANT_INACTIVE');
    expect(next).not.toHaveBeenCalled();
  });

  test('un error inesperado se delega a next(error)', async () => {
    tenantService.getTenant.mockImplementation(() => { throw new Error('boom'); });
    const req = { headers: { 'x-tenant-id': 't1' } };
    const next = jest.fn();
    await extractTenant()(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ==================== checkPermission / checkAll / checkAny ====================

describe('tenantMiddleware.checkPermission', () => {
  test('401 sin tenant o sin usuario', () => {
    const res = mockRes();
    checkPermission('declaration', 'create')({ user: { id: 'u' } }, res, jest.fn());
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  test('deja pasar cuando rbac concede el permiso', () => {
    rbacService.hasPermission.mockReturnValue(true);
    const next = jest.fn();
    checkPermission('declaration', 'create')(
      { tenant: {}, tenantId: 't1', user: { id: 'u' } }, mockRes(), next
    );
    expect(rbacService.hasPermission).toHaveBeenCalledWith('t1', 'u', 'declaration', 'create', null);
    expect(next).toHaveBeenCalled();
  });

  test('403 PERMISSION_DENIED cuando rbac lo niega, propagando el requerido', () => {
    rbacService.hasPermission.mockReturnValue(false);
    const res = mockRes();
    const next = jest.fn();
    checkPermission('declaration', 'delete', 'own')(
      { tenant: {}, tenantId: 't1', user: { id: 'u' } }, res, next
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
    expect(res.body.required).toEqual({ resource: 'declaration', action: 'delete', scope: 'own' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('tenantMiddleware.checkAllPermissions', () => {
  const perms = [{ resource: 'a', action: 'read' }];
  test('401 sin tenant/usuario', () => {
    const res = mockRes();
    checkAllPermissions(perms)({}, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });
  test('pasa si las tiene todas', () => {
    rbacService.hasAllPermissions.mockReturnValue(true);
    const next = jest.fn();
    checkAllPermissions(perms)({ tenant: {}, tenantId: 't', user: { id: 'u' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('403 si falta alguna', () => {
    rbacService.hasAllPermissions.mockReturnValue(false);
    const res = mockRes();
    checkAllPermissions(perms)({ tenant: {}, tenantId: 't', user: { id: 'u' } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.required).toBe(perms);
  });
});

describe('tenantMiddleware.checkAnyPermission', () => {
  const perms = [{ resource: 'a', action: 'read' }];
  test('401 sin tenant/usuario', () => {
    const res = mockRes();
    checkAnyPermission(perms)({}, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });
  test('pasa si tiene al menos una', () => {
    rbacService.hasAnyPermission.mockReturnValue(true);
    const next = jest.fn();
    checkAnyPermission(perms)({ tenant: {}, tenantId: 't', user: { id: 'u' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('403 si no tiene ninguna', () => {
    rbacService.hasAnyPermission.mockReturnValue(false);
    const res = mockRes();
    checkAnyPermission(perms)({ tenant: {}, tenantId: 't', user: { id: 'u' } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.requiredAny).toBe(perms);
  });
});

// ==================== requireFeature / checkLimit ====================

describe('tenantMiddleware.requireFeature', () => {
  test('400 sin tenant', () => {
    const res = mockRes();
    requireFeature('advanced')({}, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('TENANT_REQUIRED');
  });
  test('pasa si el plan incluye la feature', () => {
    tenantService.canUseFeature.mockReturnValue(true);
    const next = jest.fn();
    requireFeature('advanced')({ tenant: {}, tenantId: 't' }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('403 FEATURE_NOT_AVAILABLE si el plan no la incluye', () => {
    tenantService.canUseFeature.mockReturnValue(false);
    const res = mockRes();
    requireFeature('advanced')({ tenant: {}, tenantId: 't' }, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(res.body.feature).toBe('advanced');
  });
});

describe('tenantMiddleware.checkLimit', () => {
  test('400 sin tenant', () => {
    const res = mockRes();
    checkLimit('declarations')({}, res, jest.fn());
    expect(res.statusCode).toBe(400);
  });
  test('pasa si no ha alcanzado el limite', () => {
    tenantService.hasReachedLimit.mockReturnValue(false);
    const next = jest.fn();
    checkLimit('declarations')({ tenant: {}, tenantId: 't' }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('429 LIMIT_REACHED si lo ha alcanzado', () => {
    tenantService.hasReachedLimit.mockReturnValue(true);
    const res = mockRes();
    checkLimit('declarations')({ tenant: {}, tenantId: 't' }, res, jest.fn());
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('LIMIT_REACHED');
  });
});

// ==================== trackUsage ====================

describe('tenantMiddleware.trackUsage', () => {
  test('cuenta la operacion solo en respuestas 2xx con tenantId', () => {
    const req = { tenantId: 't1' };
    const res = mockRes();
    res.statusCode = 200;
    trackUsage('declarations')(req, res, jest.fn());
    res.end(); // dispara el wrapper
    expect(tenantService.incrementUsage).toHaveBeenCalledWith('t1', 'declarations');
  });

  test('no cuenta si la respuesta no es 2xx', () => {
    const req = { tenantId: 't1' };
    const res = mockRes();
    res.statusCode = 500;
    trackUsage('declarations')(req, res, jest.fn());
    res.end();
    expect(tenantService.incrementUsage).not.toHaveBeenCalled();
  });

  test('no cuenta si no hay tenantId', () => {
    const req = {};
    const res = mockRes();
    res.statusCode = 200;
    trackUsage('declarations')(req, res, jest.fn());
    res.end();
    expect(tenantService.incrementUsage).not.toHaveBeenCalled();
  });
});

// ==================== adminOnly ====================

describe('tenantMiddleware.adminOnly', () => {
  test('401 sin usuario', () => {
    const res = mockRes();
    adminOnly({}, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });

  test('admin via RBAC in-memory (tenant_admin) pasa', () => {
    rbacService.getUserRoles.mockReturnValue({ roles: [{ id: 'tenant_admin' }] });
    const next = jest.fn();
    adminOnly({ tenant: {}, tenantId: 't', user: { id: 'u' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('admin via User.role en MongoDB (sin tenant in-memory) pasa', () => {
    const next = jest.fn();
    adminOnly({ tenantId: 't', user: { id: 'u', role: 'supervisor' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('403 ADMIN_REQUIRED para un usuario sin rol admin', () => {
    rbacService.getUserRoles.mockReturnValue({ roles: [{ id: 'agent' }] });
    const res = mockRes();
    adminOnly({ tenant: {}, tenantId: 't', user: { id: 'u', role: 'agent' } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ADMIN_REQUIRED');
  });
});

// ==================== checkOwnership ====================

describe('tenantMiddleware.checkOwnership', () => {
  test('401 sin tenant/usuario', async () => {
    const res = mockRes();
    await checkOwnership(() => 'x')({}, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });

  test('un admin (manager) salta la comprobacion de propiedad', async () => {
    rbacService.getUserRoles.mockReturnValue({ roles: [{ id: 'manager' }] });
    const getOwner = jest.fn();
    const next = jest.fn();
    await checkOwnership(getOwner)({ tenant: {}, tenantId: 't', user: { id: 'u' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(getOwner).not.toHaveBeenCalled(); // ni se consulta el propietario
  });

  test('el dueno del recurso pasa', async () => {
    rbacService.getUserRoles.mockReturnValue({ roles: [{ id: 'agent' }] });
    const next = jest.fn();
    await checkOwnership(async () => 'u')({ tenant: {}, tenantId: 't', user: { id: 'u' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('403 OWNERSHIP_DENIED si el recurso es de otro', async () => {
    rbacService.getUserRoles.mockReturnValue({ roles: [{ id: 'agent' }] });
    const res = mockRes();
    await checkOwnership(async () => 'otro')({ tenant: {}, tenantId: 't', user: { id: 'u' } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('OWNERSHIP_DENIED');
  });

  test('un error del resolver se delega a next(error)', async () => {
    rbacService.getUserRoles.mockReturnValue({ roles: [{ id: 'agent' }] });
    const next = jest.fn();
    await checkOwnership(async () => { throw new Error('db'); })(
      { tenant: {}, tenantId: 't', user: { id: 'u' } }, mockRes(), next
    );
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ==================== tenantRateLimit ====================

describe('tenantMiddleware.tenantRateLimit', () => {
  test('sin tenantId no aplica limite (pasa directo)', () => {
    const next = jest.fn();
    tenantRateLimit()({}, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('permite hasta maxRequests y luego devuelve 429 con Retry-After', () => {
    const mw = tenantRateLimit({ maxRequests: 2, windowMs: 60000 });
    const req = { tenantId: 't1' };

    const r1 = mockRes(); mw(req, r1, jest.fn());
    expect(r1.headers['X-RateLimit-Remaining']).toBe(1);
    const r2 = mockRes(); mw(req, r2, jest.fn());
    expect(r2.headers['X-RateLimit-Remaining']).toBe(0);

    const r3 = mockRes(); const next3 = jest.fn();
    mw(req, r3, next3);
    expect(r3.statusCode).toBe(429);
    expect(r3.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(r3.headers['Retry-After']).toBeDefined();
    expect(next3).not.toHaveBeenCalled();
  });

  test('cada tenant tiene su propio contador', () => {
    const mw = tenantRateLimit({ maxRequests: 1 });
    const rA = mockRes(); const nextA = jest.fn();
    mw({ tenantId: 'A' }, rA, nextA);
    expect(nextA).toHaveBeenCalled();
    // otro tenant no se ve afectado por el consumo de A
    const rB = mockRes(); const nextB = jest.fn();
    mw({ tenantId: 'B' }, rB, nextB);
    expect(nextB).toHaveBeenCalled();
  });
});

// ==================== attachTenantContext ====================

describe('tenantMiddleware.attachTenantContext', () => {
  test('publica cabeceras X-Tenant-* cuando hay tenant', () => {
    const res = mockRes();
    const next = jest.fn();
    attachTenantContext({ tenant: { id: 't1', slug: 'acme' } }, res, next);
    expect(res.headers['X-Tenant-ID']).toBe('t1');
    expect(res.headers['X-Tenant-Slug']).toBe('acme');
    expect(next).toHaveBeenCalled();
  });

  test('sin tenant no publica cabeceras pero deja pasar', () => {
    const res = mockRes();
    const next = jest.fn();
    attachTenantContext({}, res, next);
    expect(res.set).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
