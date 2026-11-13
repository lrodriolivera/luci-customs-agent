/**
 * Un admin de TENANT no puede conceder el rol de PLATAFORMA super_admin.
 *
 * El enum de User.role admite super_admin (para que superAdminOnly sea
 * alcanzable), asi que no basta con la validacion del modelo: cada punto que
 * asigna un rol a partir del body debe comprobar que quien lo pide puede
 * concederlo. Sin eso, un admin de tenant (lo que da el registro publico)
 * enviaba { role: 'super_admin' } y obtenia acceso a todos los tenants.
 *
 * Se cubren los cuatro puntos que asignan rol desde la peticion:
 *   PUT  /api/admin/users/:id   -> adminController.updateUser
 *   POST /api/admin/users       -> adminController.createUser
 *   PUT  /api/auth/users/:id    -> authController.updateUser
 *   POST /api/auth/admin/invite -> authController.adminInvite
 *
 * En cada uno: un admin de tenant recibe 403 y NO se escribe nada; un
 * super_admin si puede asignarlo.
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
const cognitoService = require('../../src/utils/cognitoService');
const adminController = require('../../src/controllers/adminController');
const authController = require('../../src/controllers/authController');
const { puedeAsignarRol } = require('../../src/constants/roles');

const ADMIN_T1 = { _id: 'a1', id: 'a1', name: 'Admin T1', email: 'admin@t1.es', role: 'admin', tenantId: 't1' };
const SUPER = { _id: 's1', id: 's1', name: 'Super', email: 'super@plataforma.es', role: 'super_admin', tenantId: 't0' };

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

/** Usuario existente del tenant t1, con save espiable. */
function usuarioDeT1() {
  return {
    _id: 'u2',
    email: 'u2@t1.es',
    name: 'U2',
    role: 'agent',
    tenantId: 't1',
    isActive: true,
    save: jest.fn().mockResolvedValue(true)
  };
}

let guardar;
beforeEach(() => {
  guardar = jest.fn().mockResolvedValue(true);
  User.mockImplementation(function (datos) {
    Object.assign(this, datos);
    this._id = 'nuevo-id';
    this.save = guardar;
    this.toPublicJSON = () => ({ email: this.email, role: this.role });
  });
});

describe('puedeAsignarRol', () => {
  test('un admin de tenant puede asignar roles de tenant', () => {
    for (const rol of ['admin', 'supervisor', 'agent', 'viewer']) {
      expect(puedeAsignarRol(ADMIN_T1, rol)).toBe(true);
    }
  });

  test('un admin de tenant NO puede asignar super_admin', () => {
    expect(puedeAsignarRol(ADMIN_T1, 'super_admin')).toBe(false);
  });

  test('rechaza valores no string que Mongoose podria convertir en super_admin', () => {
    expect(puedeAsignarRol(ADMIN_T1, { _id: 'super_admin' })).toBe(false);
    expect(puedeAsignarRol(ADMIN_T1, ['super_admin'])).toBe(false);
  });

  test('un super_admin puede asignar super_admin', () => {
    expect(puedeAsignarRol(SUPER, 'super_admin')).toBe(true);
  });
});

describe('adminController.updateUser (PUT /api/admin/users/:id)', () => {
  test('403 y sin cambios si un admin de tenant asigna super_admin a un usuario de su tenant', async () => {
    const objetivo = usuarioDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.updateUser(
      { user: ADMIN_T1, params: { id: 'u2' }, body: { role: 'super_admin', password: 'Known123!' } },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(objetivo.save).not.toHaveBeenCalled();
    expect(objetivo.role).toBe('agent');
    expect(objetivo.password).toBeUndefined();
  });

  test('403 si un admin de tenant intenta ascenderse a si mismo', async () => {
    const yo = { ...usuarioDeT1(), _id: 'a1', role: 'admin' };
    User.findById.mockResolvedValue(yo);
    const res = crearRes();

    await adminController.updateUser({ user: ADMIN_T1, params: { id: 'a1' }, body: { role: 'super_admin' } }, res);

    expect(res.statusCode).toBe(403);
    expect(yo.save).not.toHaveBeenCalled();
    expect(yo.role).toBe('admin');
  });

  test('un admin de tenant sigue pudiendo asignar un rol de tenant', async () => {
    const objetivo = usuarioDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.updateUser({ user: ADMIN_T1, params: { id: 'u2' }, body: { role: 'supervisor' } }, res);

    expect(res.statusCode).toBe(200);
    expect(objetivo.role).toBe('supervisor');
    expect(objetivo.save).toHaveBeenCalled();
  });

  test('un super_admin puede asignar super_admin', async () => {
    const objetivo = usuarioDeT1();
    User.findById.mockResolvedValue(objetivo);
    const res = crearRes();

    await adminController.updateUser({ user: SUPER, params: { id: 'u2' }, body: { role: 'super_admin' } }, res);

    expect(res.statusCode).toBe(200);
    expect(objetivo.role).toBe('super_admin');
    expect(objetivo.save).toHaveBeenCalled();
  });
});

describe('adminController.createUser (POST /api/admin/users)', () => {
  test('403 y no se crea nada si un admin de tenant crea un super_admin', async () => {
    User.findOne.mockResolvedValue(null);
    const res = crearRes();

    await adminController.createUser(
      { user: ADMIN_T1, body: { email: 'nuevo@t1.es', name: 'Nuevo', role: 'super_admin', password: 'Known123!' } },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(User).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
  });

  test('un super_admin puede crear un super_admin', async () => {
    User.findOne.mockResolvedValue(null);
    const res = crearRes();

    await adminController.createUser(
      { user: SUPER, body: { email: 'nuevo@plataforma.es', name: 'Nuevo', role: 'super_admin', password: 'Known123!' } },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(User).toHaveBeenCalledTimes(1);
    expect(User.mock.calls[0][0].role).toBe('super_admin');
    expect(guardar).toHaveBeenCalled();
  });
});

describe('authController.updateUser (PUT /api/auth/users/:id)', () => {
  test('403 y sin escritura si un admin de tenant asigna super_admin', async () => {
    const res = crearRes();

    await authController.updateUser({ user: ADMIN_T1, params: { id: 'u2' }, body: { role: 'super_admin' } }, res);

    expect(res.statusCode).toBe(403);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('un super_admin puede asignar super_admin', async () => {
    User.findOneAndUpdate.mockResolvedValue({ email: 'u2@t1.es', toPublicJSON: () => ({ id: 'u2', role: 'super_admin' }) });
    const res = crearRes();

    await authController.updateUser({ user: SUPER, params: { id: 'u2' }, body: { role: 'super_admin' } }, res);

    expect(res.statusCode).toBe(200);
    const [, cambios] = User.findOneAndUpdate.mock.calls[0];
    expect(cambios.role).toBe('super_admin');
  });
});

describe('authController.adminInvite (POST /api/auth/admin/invite)', () => {
  // Desde que Cognito se retiro, adminInvite crea el usuario en local (hash +
  // mustChangePassword), ya no llama a cognitoService.
  const cuerpo = { email: 'invitado@t1.es', name: 'Invitado Uno', role: 'super_admin' };

  test('403 y no se toca la BD si un admin de tenant invita a un super_admin', async () => {
    const res = crearRes();

    await authController.adminInvite({ user: ADMIN_T1, body: { ...cuerpo } }, res);

    expect(res.statusCode).toBe(403);
    expect(cognitoService.adminCreateUser).not.toHaveBeenCalled();
    expect(User).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
  });

  test('un super_admin puede invitar a un super_admin', async () => {
    User.findOne.mockResolvedValue(null);
    const res = crearRes();

    await authController.adminInvite({ user: SUPER, body: { ...cuerpo, tenantId: 't0' } }, res);

    expect(res.statusCode).toBe(201);
    expect(User.mock.calls[0][0].role).toBe('super_admin');
    expect(User.mock.calls[0][0].mustChangePassword).toBe(true);
    expect(guardar).toHaveBeenCalled();
    expect(cognitoService.adminCreateUser).not.toHaveBeenCalled();
    // La temporal se devuelve una sola vez en la respuesta, nunca en texto plano en otro sitio.
    expect(res.body.data.temporaryPassword).toBeTruthy();
    expect(res.body.data.user).toEqual({ email: 'invitado@t1.es', role: 'super_admin' });
  });
});
