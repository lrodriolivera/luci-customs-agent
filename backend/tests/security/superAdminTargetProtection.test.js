/**
 * Un admin de TENANT no puede tomar el control de una cuenta super_admin.
 *
 * Tras f00a3e9 un admin de tenant ya no puede CONCEDER super_admin, pero si
 * podia gestionar a un super_admin que estuviera en su tenant (o sin tenant, que
 * ensureSameTenant deja pasar como legacy): cambiarle la contraseña o
 * restablecerla (y recibir la temporal en la respuesta), cambiarle el email o
 * quitarle el rol. Con la contraseña nueva entraba como super_admin
 * (hallazgo F6 del escaneo del 3/Nov/2026, segundo intento del panel).
 *
 * Puntos cubiertos:
 *   PUT  /api/admin/users/:id                -> adminController.updateUser
 *   POST /api/admin/users/:id/reset-password -> adminController.resetUserPassword
 *   PUT  /api/auth/users/:id                 -> authController.updateUser
 *
 * En cada uno: el admin de tenant recibe 403 y no se escribe nada; un
 * super_admin si puede, y sobre usuarios normales todo sigue igual.
 */

jest.mock('../../src/models/User', () => {
  const MockUser = jest.fn();
  MockUser.findOne = jest.fn();
  MockUser.findById = jest.fn();
  MockUser.findOneAndUpdate = jest.fn();
  return MockUser;
});
jest.mock('../../src/models', () => ({ User: require('../../src/models/User'), Tenant: {} }));
jest.mock('../../src/utils/cognitoService', () => ({
  adminCreateUser: jest.fn(),
  adminUpdateAttributes: jest.fn()
}));

const User = require('../../src/models/User');
const adminController = require('../../src/controllers/adminController');
const authController = require('../../src/controllers/authController');
const { puedeGestionarUsuario } = require('../../src/constants/roles');

const ADMIN_T1 = { _id: 'a1', id: 'a1', name: 'Admin T1', email: 'admin@t1.es', role: 'admin', tenantId: 't1' };
const SUPER = { _id: 's0', id: 's0', name: 'Super', email: 'super@plataforma.es', role: 'super_admin', tenantId: 't1' };

function crearRes() {
  const res = { statusCode: 200, headersSent: false };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.headersSent = true; return res; };
  return res;
}

/** Un super_admin que vive en el tenant t1, con save espiable. */
function superAdminDeT1() {
  return {
    _id: 'sx', email: 'sx@strixai.ai', name: 'SX', role: 'super_admin', tenantId: 't1',
    isActive: true, password: 'hash-original', save: jest.fn().mockResolvedValue(true)
  };
}

function agenteDeT1() {
  return {
    _id: 'u2', email: 'u2@t1.es', name: 'U2', role: 'agent', tenantId: 't1',
    isActive: true, password: 'hash-original', save: jest.fn().mockResolvedValue(true)
  };
}

const req = (user, params, body = {}) => ({ user, params, body, query: {}, headers: {} });

describe('puedeGestionarUsuario', () => {
  test('un admin de tenant gestiona usuarios normales pero no a un super_admin', () => {
    expect(puedeGestionarUsuario(ADMIN_T1, { role: 'agent' })).toBe(true);
    expect(puedeGestionarUsuario(ADMIN_T1, { role: 'admin' })).toBe(true);
    expect(puedeGestionarUsuario(ADMIN_T1, { role: 'super_admin' })).toBe(false);
    expect(puedeGestionarUsuario(ADMIN_T1, { isSuperAdmin: true })).toBe(false);
  });

  test('un super_admin puede gestionar a cualquiera', () => {
    expect(puedeGestionarUsuario(SUPER, { role: 'super_admin' })).toBe(true);
    expect(puedeGestionarUsuario(SUPER, { role: 'agent' })).toBe(true);
  });
});

describe('PUT /api/admin/users/:id (adminController.updateUser)', () => {
  test.each([
    ['la contraseña', { password: 'Nueva1234!' }],
    ['el email', { email: 'atacante@x.es' }],
    ['el rol', { role: 'viewer' }]
  ])('un admin de tenant no puede cambiar %s de un super_admin', async (_q, body) => {
    const objetivo = superAdminDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.updateUser(req(ADMIN_T1, { id: 'sx' }, body), res);

    expect(res.statusCode).toBe(403);
    expect(objetivo.save).not.toHaveBeenCalled();
    expect(objetivo.password).toBe('hash-original');
    expect(objetivo.email).toBe('sx@strixai.ai');
    expect(objetivo.role).toBe('super_admin');
  });

  test('un super_admin si puede cambiar la contraseña de otro super_admin', async () => {
    const objetivo = superAdminDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.updateUser(req(SUPER, { id: 'sx' }, { password: 'Nueva1234!' }), res);

    expect(res.statusCode).toBe(200);
    expect(objetivo.save).toHaveBeenCalled();
  });

  test('sobre un usuario normal el admin sigue pudiendo cambiar contraseña y rol', async () => {
    const objetivo = agenteDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.updateUser(req(ADMIN_T1, { id: 'u2' }, { password: 'Nueva1234!', role: 'supervisor' }), res);

    expect(res.statusCode).toBe(200);
    expect(objetivo.save).toHaveBeenCalled();
    expect(objetivo.role).toBe('supervisor');
  });
});

describe('POST /api/admin/users/:id/reset-password (adminController.resetUserPassword)', () => {
  test('un admin de tenant no puede restablecer la contraseña de un super_admin', async () => {
    const objetivo = superAdminDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.resetUserPassword(req(ADMIN_T1, { id: 'sx' }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.temporaryPassword).toBeUndefined();
    expect(objetivo.save).not.toHaveBeenCalled();
    expect(objetivo.password).toBe('hash-original');
  });

  test('sobre un usuario normal sigue devolviendo la contraseña temporal', async () => {
    const objetivo = agenteDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.resetUserPassword(req(ADMIN_T1, { id: 'u2' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.temporaryPassword).toEqual(expect.any(String));
  });
});

describe('PUT /api/auth/users/:id (authController.updateUser)', () => {
  test('un admin de tenant no puede quitarle el rol a un super_admin', async () => {
    User.findOne.mockResolvedValue(superAdminDeT1());
    const res = crearRes();

    await authController.updateUser(req(ADMIN_T1, { id: 'sx' }, { role: 'viewer' }), res);

    expect(res.statusCode).toBe(403);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('sobre un usuario normal el cambio de rol sigue funcionando', async () => {
    User.findOne.mockResolvedValue(agenteDeT1());
    User.findOneAndUpdate.mockResolvedValue({ ...agenteDeT1(), role: 'supervisor', toPublicJSON: () => ({}) });
    const res = crearRes();

    await authController.updateUser(req(ADMIN_T1, { id: 'u2' }, { role: 'supervisor' }), res);

    expect(res.statusCode).toBe(200);
    expect(User.findOneAndUpdate).toHaveBeenCalled();
  });
});
