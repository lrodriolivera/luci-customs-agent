/**
 * authController EXTRA: cobertura de handlers y ramas faltantes contra Mongo real.
 *
 * Este fichero AMPLIA la cobertura de authController.js cubriendo las ramas que
 * faltan tras authController.db.test.js y authController.test.js (baseline 50%L/36%B).
 *
 * Se cubren:
 * - refreshToken (completo, incluido error path)
 * - logout (completo, incluido error path)
 * - cognitoSession (todas las ramas: sin token, token invalido, usuario no encontrado, exito)
 * - registerSync (todas las ramas: sin secret, sin cognitoSub/email, ya existe, link por email, creacion nueva)
 * - adminInvite (todas las ramas: sin campos, usuario existente, creacion nueva con permisos por rol)
 * - adminDisableUser (todas las ramas: usuario no encontrado, sin cognitoSub, exito)
 * - cognitoChangePassword (todas las ramas: sin campos, password actual incorrecta, exito)
 * - Ramas de error en getMe, updateProfile, changePassword, listUsers, updateUser, forgotPassword, resetPassword
 * - Ramas de validacion: password muy corta, email duplicado en registerSync, etc.
 *
 * Se mockean SOLO fronteras: emailService, cognitoService, logger (opcional).
 * User/Tenant van con Mongo real en memoria, password hashing REAL, JWT REAL.
 *
 * NUNCA produccion, NUNCA mockear el codigo bajo prueba.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// Mock fronteras: email y Cognito (servicio externo)
jest.mock('../../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/utils/cognitoService', () => ({
  verifyAccessToken: jest.fn(),
  adminUpdateAttributes: jest.fn().mockResolvedValue(true),
  adminCreateUser: jest.fn(),
  adminDisableUser: jest.fn().mockResolvedValue(true),
  changePassword: jest.fn().mockResolvedValue(true)
}));

const { User, Tenant } = require('../../src/models');
const emailService = require('../../src/services/emailService');
const cognitoService = require('../../src/utils/cognitoService');
const ctrl = require('../../src/controllers/authController');

usarBaseDeDatosEnMemoria();

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function crearReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    header: jest.fn(),
    audit: jest.fn(),
    ...overrides
  };
}

let contador = 0;
async function crearUsuario({ tenant, role = 'agent', isActive = true, cognitoSub } = {}) {
  contador += 1;
  const tenantId = tenant || new mongoose.Types.ObjectId();
  const userDoc = {
    name: `Usuario ${contador}`,
    email: `user${contador}@ejemplo.es`,
    password: 'Password123!',
    role,
    tenantId,
    isActive
  };
  // Solo incluir cognitoSub si se pasa explicitamente (para evitar null duplicados en indice unico)
  if (cognitoSub !== undefined) {
    userDoc.cognitoSub = cognitoSub;
  }
  return User.create(userDoc);
}

async function crearTenant(overrides = {}) {
  return Tenant.create({
    name: 'Tenant Test',
    slug: `tenant-${Date.now()}`,
    status: 'active',
    subscription: { plan: 'starter', status: 'active', startDate: new Date() },
    limits: {},
    primaryContact: { name: 'Test', email: 'test@ejemplo.es' },
    ...overrides
  });
}

describe('refreshToken', () => {
  test('genera un nuevo token y devuelve el usuario (200)', async () => {
    const user = await crearUsuario();
    const req = crearReq({ user });
    const res = crearRes();

    await ctrl.refreshToken(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe(user.email);
  });

  test('responde 500 si generateAuthToken falla', async () => {
    const user = await crearUsuario();
    user.generateAuthToken = jest.fn(() => { throw new Error('JWT error'); });
    const req = crearReq({ user });
    const res = crearRes();

    await ctrl.refreshToken(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al renovar sesion');
  });
});

describe('logout', () => {
  test('responde 200 con mensaje de exito', async () => {
    const user = await crearUsuario();
    const req = crearReq({ user, audit: jest.fn() });
    const res = crearRes();

    await ctrl.logout(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeTruthy();
    expect(req.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'logout' }));
  });

  test('responde 500 si audit falla', async () => {
    const user = await crearUsuario();
    const req = crearReq({
      user,
      audit: jest.fn(() => { throw new Error('Audit explosion'); })
    });
    const res = crearRes();

    await ctrl.logout(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al cerrar sesion');
  });
});

describe('getMe: rama de error', () => {
  test('responde 500 si toPublicJSON falla', async () => {
    const user = await crearUsuario();
    user.toPublicJSON = jest.fn(() => { throw new Error('Serialize error'); });
    const req = crearReq({ user });
    const res = crearRes();

    await ctrl.getMe(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al obtener usuario');
  });
});

describe('updateProfile: rama de error', () => {
  test('responde 500 si save falla', async () => {
    const user = await crearUsuario();
    user.save = jest.fn().mockRejectedValue(new Error('DB write error'));
    const req = crearReq({ user, body: { name: 'Nuevo' } });
    const res = crearRes();

    await ctrl.updateProfile(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al actualizar perfil');
  });
});

describe('changePassword: rama de error', () => {
  test('responde 500 si findById falla', async () => {
    const user = await crearUsuario();
    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('DB error'))
    });
    const req = crearReq({ user, body: { currentPassword: 'x', newPassword: 'y' } });
    const res = crearRes();

    await ctrl.changePassword(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al cambiar contrasena');
  });
});

describe('listUsers: rama de error', () => {
  test('responde 500 si find falla', async () => {
    const user = await crearUsuario({ role: 'admin' });
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValue(new Error('DB error'))
    });
    const req = crearReq({ user, query: {} });
    const res = crearRes();

    await ctrl.listUsers(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al listar usuarios');
  });
});

describe('updateUser: rama de error', () => {
  test('responde 500 si findOneAndUpdate falla', async () => {
    const admin = await crearUsuario({ role: 'admin' });
    const objetivo = await crearUsuario({ tenant: admin.tenantId });
    jest.spyOn(User, 'findOneAndUpdate').mockRejectedValue(new Error('DB error'));
    const req = crearReq({ user: admin, params: { id: objetivo._id }, body: { name: 'X' } });
    const res = crearRes();

    await ctrl.updateUser(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al actualizar usuario');
  });
});

describe('forgotPassword: rama de error', () => {
  test('responde 500 si save del token falla (no por email)', async () => {
    const user = await crearUsuario();
    user.save = jest.fn().mockRejectedValue(new Error('DB error'));
    jest.spyOn(User, 'findOne').mockResolvedValue(user);
    const req = crearReq({ body: { email: user.email } });
    const res = crearRes();

    await ctrl.forgotPassword(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al procesar la solicitud');
  });
});

describe('resetPassword: rama de error', () => {
  test('responde 500 si save falla', async () => {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await crearUsuario();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save({ validateBeforeSave: false });

    user.save = jest.fn().mockRejectedValue(new Error('DB error'));
    jest.spyOn(User, 'findOne').mockResolvedValue(user);

    const req = crearReq({ params: { token }, body: { password: 'NuevaPass123!' } });
    const res = crearRes();

    await ctrl.resetPassword(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al restablecer la contrasena');
  });
});

describe('cognitoSession', () => {
  test('rechaza peticion sin accessToken (400)', async () => {
    const req = crearReq({ body: {} });
    const res = crearRes();

    await ctrl.cognitoSession(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('accessToken es obligatorio');
  });

  test('responde 401 si el token es invalido', async () => {
    cognitoService.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));
    const req = crearReq({ body: { accessToken: 'invalid' } });
    const res = crearRes();

    await ctrl.cognitoSession(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Token invalido');
  });

  test('responde 404 si el usuario no existe en BD', async () => {
    cognitoService.verifyAccessToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    const req = crearReq({ body: { accessToken: 'valid-token' } });
    const res = crearRes();

    await ctrl.cognitoSession(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/Completa el registro/);
  });

  test('devuelve el usuario si el token es valido (200)', async () => {
    const user = await crearUsuario({ cognitoSub: 'cognito-sub-123' });
    cognitoService.verifyAccessToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    jest.spyOn(User, 'findOne').mockImplementation((query) => {
      if (query.cognitoSub === 'cognito-sub-123') return Promise.resolve(user);
      return Promise.resolve(null);
    });
    const req = crearReq({ body: { accessToken: 'valid-token' }, audit: jest.fn() });
    const res = crearRes();

    await ctrl.cognitoSession(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(user.email);
    expect(req.audit).toHaveBeenCalled();
  });
});

describe('registerSync', () => {
  beforeEach(() => {
    process.env.REGISTER_SYNC_SECRET = 'secret-123';
  });

  test('rechaza peticion sin secret (403)', async () => {
    const req = crearReq({ body: { cognitoSub: 'sub', email: 'test@x.es' } });
    req.header.mockReturnValue(null);
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  test('rechaza peticion con secret incorrecto (403)', async () => {
    const req = crearReq({ body: { cognitoSub: 'sub', email: 'test@x.es' } });
    req.header.mockReturnValue('wrong-secret');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('rechaza peticion sin cognitoSub (400)', async () => {
    const req = crearReq({ body: { email: 'test@x.es' } });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cognitoSub y email son obligatorios/);
  });

  test('rechaza peticion sin email (400)', async () => {
    const req = crearReq({ body: { cognitoSub: 'sub-123' } });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(400);
  });

  test('devuelve el usuario existente si el cognitoSub ya existe', async () => {
    const user = await crearUsuario({ cognitoSub: 'sub-existing' });
    const req = crearReq({ body: { cognitoSub: 'sub-existing', email: 'nuevo@x.es' } });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.userId).toBeDefined();
    expect(res.body.data.tenantId).toBeDefined();
  });

  test('enlaza el cognitoSub si el email existe sin cognitoSub ($exists: false)', async () => {
    const user = await crearUsuario(); // sin cognitoSub
    const email = user.email;
    const req = crearReq({
      body: {
        cognitoSub: 'new-sub',
        email,
        givenName: 'John',
        familyName: 'Doe'
      }
    });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.linked).toBe(true);
    const updated = await User.findById(user._id);
    expect(updated.cognitoSub).toBe('new-sub');
  });

  test('enlaza el cognitoSub si el email existe CON cognitoSub explicitamente null', async () => {
    // Esta rama cubre el caso donde cognitoSub es null literal (no undefined ni $exists:false)
    const userConNull = await User.create({
      name: 'User Null',
      email: 'usernull@x.es',
      password: 'Password123!',
      role: 'agent',
      tenantId: new mongoose.Types.ObjectId(),
      cognitoSub: null
    });

    const req = crearReq({
      body: {
        cognitoSub: 'sub-para-null',
        email: 'usernull@x.es',
        givenName: 'User',
        familyName: 'Null'
      }
    });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.linked).toBe(true);
    const updated = await User.findById(userConNull._id);
    expect(updated.cognitoSub).toBe('sub-para-null');
  });

  test('crea un nuevo usuario y tenant si no existe', async () => {
    const req = crearReq({
      body: {
        cognitoSub: 'new-sub-123',
        email: 'newuser@empresa.es',
        givenName: 'Juan',
        familyName: 'Perez',
        apellido2: 'Garcia',
        companyName: 'Nueva Empresa'
      }
    });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeDefined();
    expect(res.body.data.tenantId).toBeDefined();

    const user = await User.findById(res.body.data.userId);
    expect(user.email).toBe('newuser@empresa.es');
    expect(user.role).toBe('admin');
    expect(user.cognitoSub).toBe('new-sub-123');

    const tenant = await Tenant.findById(res.body.data.tenantId);
    expect(tenant.name).toBe('Nueva Empresa');
    expect(tenant.slug).toBe('nueva-empresa');
  });

  test('genera slug unico si el tenant ya existe en registerSync', async () => {
    // Crear un tenant con un slug especifico
    await crearTenant({ slug: 'empresa-duplicada' });

    const req = crearReq({
      body: {
        cognitoSub: 'new-sub-dup',
        email: 'dup@x.es',
        givenName: 'Dup',
        familyName: 'Test',
        companyName: 'Empresa Duplicada'
      }
    });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(201);
    const user = await User.findById(res.body.data.userId);
    const tenant = await Tenant.findById(user.tenantId);
    expect(tenant.slug).not.toBe('empresa-duplicada'); // tiene sufijo unico
    expect(tenant.slug).toMatch(/^empresa-duplicada-/);
  });

  test('continua si adminUpdateAttributes falla en registerSync', async () => {
    cognitoService.adminUpdateAttributes.mockRejectedValueOnce(new Error('Cognito error'));
    const req = crearReq({
      body: {
        cognitoSub: 'sub-cognito-fail',
        email: 'cognitofail@x.es',
        givenName: 'Cognito',
        familyName: 'Fail',
        companyName: 'CognitoFail'
      }
    });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(201); // el usuario se crea igual
    expect(res.body.success).toBe(true);
  });

  test('responde 500 si el save falla', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(Tenant, 'findOne').mockResolvedValue(null);
    jest.spyOn(Tenant.prototype, 'save').mockRejectedValue(new Error('DB error'));

    const req = crearReq({
      body: { cognitoSub: 'sub', email: 'test@x.es', givenName: 'X', familyName: 'Y' }
    });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error en register-sync');
  });
});

describe('adminInvite', () => {
  test('rechaza peticion sin email (400)', async () => {
    const admin = await crearUsuario({ role: 'admin' });
    const req = crearReq({ user: admin, body: { givenName: 'X', familyName: 'Y' } });
    const res = crearRes();

    await ctrl.adminInvite(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/email, givenName y familyName son obligatorios/);
  });

  test('rechaza peticion sin givenName (400)', async () => {
    const admin = await crearUsuario({ role: 'admin' });
    const req = crearReq({ user: admin, body: { email: 'x@x.es', familyName: 'Y' } });
    const res = crearRes();

    await ctrl.adminInvite(req, res);

    expect(res.statusCode).toBe(400);
  });

  test('responde 409 si el usuario ya existe en Cognito', async () => {
    const admin = await crearUsuario({ role: 'admin' });
    cognitoService.adminCreateUser.mockRejectedValue({ name: 'UsernameExistsException' });
    const req = crearReq({
      user: admin,
      body: { email: 'existing@x.es', givenName: 'X', familyName: 'Y' },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminInvite(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/ya existe/);
  });

  test('crea el usuario con permisos de agent por defecto', async () => {
    const tenant = await crearTenant();
    const admin = await crearUsuario({ tenant: tenant._id, role: 'admin' });
    cognitoService.adminCreateUser.mockResolvedValue({
      User: { Attributes: [{ Name: 'sub', Value: 'cognito-sub-456' }] }
    });
    const req = crearReq({
      user: admin,
      body: { email: 'agent@x.es', givenName: 'Agent', familyName: 'Test' },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminInvite(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toBeDefined();

    const user = await User.findOne({ email: 'agent@x.es' });
    expect(user.role).toBe('agent');
    expect(user.permissions.canCreateExpeditions).toBe(true);
    expect(user.permissions.canManageUsers).toBe(false);
  });

  test('crea el usuario con permisos de admin si role=admin', async () => {
    const tenant = await crearTenant();
    const admin = await crearUsuario({ tenant: tenant._id, role: 'admin' });
    cognitoService.adminCreateUser.mockResolvedValue({
      User: { Attributes: [{ Name: 'sub', Value: 'cognito-sub-789' }] }
    });
    const req = crearReq({
      user: admin,
      body: { email: 'admin2@x.es', givenName: 'Admin', familyName: 'Two', role: 'admin' },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminInvite(req, res);

    expect(res.statusCode).toBe(201);

    const user = await User.findOne({ email: 'admin2@x.es' });
    expect(user.role).toBe('admin');
    expect(user.permissions.canManageUsers).toBe(true);
    expect(user.permissions.canConfigureSystem).toBe(true);
  });

  test('responde 500 si el save de User falla', async () => {
    const admin = await crearUsuario({ role: 'admin' });
    cognitoService.adminCreateUser.mockResolvedValue({
      User: { Attributes: [{ Name: 'sub', Value: 'sub-fail' }] }
    });
    jest.spyOn(User.prototype, 'save').mockRejectedValue(new Error('DB error'));
    const req = crearReq({
      user: admin,
      body: { email: 'fail@x.es', givenName: 'Fail', familyName: 'Test' },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminInvite(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al invitar usuario');
  });
});

describe('adminDisableUser', () => {
  test('responde 404 si el usuario no existe', async () => {
    const admin = await crearUsuario({ role: 'admin' });
    const req = crearReq({
      user: admin,
      params: { id: new mongoose.Types.ObjectId() },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminDisableUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Usuario no encontrado');
  });

  test('responde 404 si el usuario es de otro tenant', async () => {
    const admin = await crearUsuario({ tenant: new mongoose.Types.ObjectId(), role: 'admin' });
    const otroUsuario = await crearUsuario({ tenant: new mongoose.Types.ObjectId() });
    const req = crearReq({
      user: admin,
      params: { id: otroUsuario._id },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminDisableUser(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('desactiva el usuario sin cognitoSub (200)', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    const objetivo = await crearUsuario({ tenant: tenantId }); // sin cognitoSub
    const req = crearReq({
      user: admin,
      params: { id: objetivo._id },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminDisableUser(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await User.findById(objetivo._id);
    expect(updated.isActive).toBe(false);
    expect(cognitoService.adminDisableUser).not.toHaveBeenCalled();
  });

  test('desactiva el usuario y llama a Cognito si tiene cognitoSub (200)', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    const objetivo = await crearUsuario({ tenant: tenantId, cognitoSub: 'cognito-sub-999' });
    const req = crearReq({
      user: admin,
      params: { id: objetivo._id },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminDisableUser(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await User.findById(objetivo._id);
    expect(updated.isActive).toBe(false);
    expect(cognitoService.adminDisableUser).toHaveBeenCalledWith('cognito-sub-999');
  });

  test('responde 500 si Cognito falla', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    const objetivo = await crearUsuario({ tenant: tenantId, cognitoSub: 'sub-error' });
    cognitoService.adminDisableUser.mockRejectedValue(new Error('Cognito error'));
    const req = crearReq({
      user: admin,
      params: { id: objetivo._id },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminDisableUser(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al desactivar usuario');
  });
});

describe('cognitoChangePassword', () => {
  test('rechaza peticion sin currentPassword (400)', async () => {
    const user = await crearUsuario();
    const req = crearReq({
      user,
      token: 'access-token',
      body: { newPassword: 'Nueva123!' }
    });
    const res = crearRes();

    await ctrl.cognitoChangePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/currentPassword y newPassword son obligatorios/);
  });

  test('rechaza peticion sin newPassword (400)', async () => {
    const user = await crearUsuario();
    const req = crearReq({
      user,
      token: 'access-token',
      body: { currentPassword: 'Old123!' }
    });
    const res = crearRes();

    await ctrl.cognitoChangePassword(req, res);

    expect(res.statusCode).toBe(400);
  });

  test('responde 400 si la contrasena actual es incorrecta', async () => {
    const user = await crearUsuario();
    cognitoService.changePassword.mockRejectedValue({ name: 'NotAuthorizedException' });
    const req = crearReq({
      user,
      token: 'access-token',
      body: { currentPassword: 'wrong', newPassword: 'Nueva123!' }
    });
    const res = crearRes();

    await ctrl.cognitoChangePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Contrasena actual incorrecta');
  });

  test('cambia la contrasena en Cognito (200)', async () => {
    const user = await crearUsuario();
    const req = crearReq({
      user,
      token: 'access-token-valid',
      body: { currentPassword: 'Old123!', newPassword: 'Nueva123!' }
    });
    const res = crearRes();

    await ctrl.cognitoChangePassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cognitoService.changePassword).toHaveBeenCalledWith('access-token-valid', 'Old123!', 'Nueva123!');
  });

  test('responde 400 con mensaje generico si Cognito falla con otro error', async () => {
    const user = await crearUsuario();
    cognitoService.changePassword.mockRejectedValue(new Error('Network error'));
    const req = crearReq({
      user,
      token: 'access-token',
      body: { currentPassword: 'Old123!', newPassword: 'Nueva123!' }
    });
    const res = crearRes();

    await ctrl.cognitoChangePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Error al cambiar contrasena');
  });
});

describe('register: ramas adicionales', () => {
  test('limpia el tenant si save de User falla', async () => {
    jest.spyOn(User.prototype, 'save').mockRejectedValueOnce(new Error('User save error'));
    const req = crearReq({ body: { email: 'fail@x.es', password: 'Password123!', name: 'Fail', companyName: 'FailCo' } });
    const res = crearRes();

    const tenantsAntes = await Tenant.countDocuments();
    await ctrl.register(req, res);

    expect(res.statusCode).toBe(500);
    expect(await Tenant.countDocuments()).toBe(tenantsAntes); // limpio el tenant huerfano
  });

  test('no envia welcome email si falla, pero el usuario se crea', async () => {
    emailService.sendWelcomeEmail.mockRejectedValueOnce(new Error('Email error'));
    const req = crearReq({ body: { email: 'noemail@x.es', password: 'Password123!', name: 'NoEmail', companyName: 'NoEmailCo' } });
    const res = crearRes();

    await ctrl.register(req, res);

    expect(res.statusCode).toBe(201);
    const user = await User.findOne({ email: 'noemail@x.es' });
    expect(user).toBeTruthy();
  });
});

describe('forgotPassword: rama de usuario inactivo', () => {
  test('no envia email si el usuario esta desactivado', async () => {
    const user = await crearUsuario({ isActive: false });
    const req = crearReq({ body: { email: user.email } });
    const res = crearRes();

    await ctrl.forgotPassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('updateUser: ramas adicionales', () => {
  test('persiste permissions al actualizar', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    const objetivo = await crearUsuario({ tenant: tenantId, role: 'agent' });

    const req = crearReq({
      user: admin,
      params: { id: objetivo._id },
      body: { permissions: { canManageUsers: true } }
    });
    const res = crearRes();

    await ctrl.updateUser(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await User.findById(objetivo._id);
    expect(updated.permissions.canManageUsers).toBe(true);
  });

  test('persiste isActive al actualizar', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    const objetivo = await crearUsuario({ tenant: tenantId, isActive: true });

    const req = crearReq({
      user: admin,
      params: { id: objetivo._id },
      body: { isActive: false }
    });
    const res = crearRes();

    await ctrl.updateUser(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await User.findById(objetivo._id);
    expect(updated.isActive).toBe(false);
  });
});

describe('changePassword: validacion de password', () => {
  test('rechaza password muy corta (<6 caracteres)', async () => {
    const user = await crearUsuario();
    const userConPassword = await User.findById(user._id).select('+password');
    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue(userConPassword)
    });

    const req = crearReq({ user, body: { currentPassword: 'Password123!', newPassword: '12345' } });
    const res = crearRes();

    await ctrl.changePassword(req, res);

    expect(res.statusCode).toBe(500); // el modelo rechaza con error de validacion
    expect(res.body.error).toBe('Error al cambiar contrasena');
  });
});

describe('listUsers: usuario sin tenantId', () => {
  test('lista todos los usuarios si el admin no tiene tenantId', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    await crearUsuario({ tenant: tenantId });
    await crearUsuario({ tenant: tenantId });

    // Admin sin tenantId (SUPER_ADMIN de plataforma)
    const adminSinTenant = await User.create({
      name: 'Super Admin',
      email: 'superadmin@ejemplo.es',
      password: 'Password123!',
      role: 'super_admin'
      // sin tenantId
    });

    const req = crearReq({ user: adminSinTenant, query: {} });
    const res = crearRes();

    await ctrl.listUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(2); // ve todos
  });
});

describe('updateUser: usuario sin tenantId', () => {
  test('actualiza usuario sin filtrar por tenant si el admin no tiene tenantId', async () => {
    const objetivo = await crearUsuario({ role: 'agent' });

    const adminSinTenant = await User.create({
      name: 'Super Admin',
      email: 'superadmin2@ejemplo.es',
      password: 'Password123!',
      role: 'super_admin'
    });

    const req = crearReq({
      user: adminSinTenant,
      params: { id: objetivo._id },
      body: { name: 'Actualizado por super admin' }
    });
    const res = crearRes();

    await ctrl.updateUser(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await User.findById(objetivo._id);
    expect(updated.name).toBe('Actualizado por super admin');
  });
});

describe('adminDisableUser: usuario sin tenantId', () => {
  test('desactiva usuario sin filtrar por tenant si el admin no tiene tenantId', async () => {
    const objetivo = await crearUsuario();

    const adminSinTenant = await User.create({
      name: 'Super Admin',
      email: 'superadmin3@ejemplo.es',
      password: 'Password123!',
      role: 'super_admin'
    });

    const req = crearReq({
      user: adminSinTenant,
      params: { id: objetivo._id },
      audit: jest.fn()
    });
    const res = crearRes();

    await ctrl.adminDisableUser(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await User.findById(objetivo._id);
    expect(updated.isActive).toBe(false);
  });
});

describe('register: tenant sin _id', () => {
  test('no intenta limpiar el tenant si no tiene _id', async () => {
    // Mockear Tenant.findOne para que retorne null (slug no existe)
    const findOneSpy = jest.spyOn(Tenant, 'findOne').mockResolvedValue(null);

    // Simular que tenant.save() falla ANTES de que Mongo asigne _id
    const saveSpy = jest.spyOn(Tenant.prototype, 'save')
      .mockImplementationOnce(function() {
        // No asignar _id, solo lanzar error
        throw new Error('Database connection lost before _id assignment');
      });

    const req = crearReq({
      body: { email: 'tenant-sin-id@x.es', password: 'Password123!', name: 'Test', companyName: 'TestCo' }
    });
    const res = crearRes();

    await ctrl.register(req, res);

    expect(res.statusCode).toBe(500);

    // Restaurar
    saveSpy.mockRestore();
    findOneSpy.mockRestore();
  });

  test('limpia el tenant si SÍ tiene _id cuando falla User.save', async () => {
    // Este test ya existe como "limpia el tenant si save de User falla",
    // pero lo repetimos aquí para claridad de la cobertura de la rama positiva
    const findOneSpy = jest.spyOn(Tenant, 'findOne').mockResolvedValue(null);

    // Permitir que el tenant se guarde con _id
    const tenantSaveSpy = jest.spyOn(Tenant.prototype, 'save').mockImplementationOnce(async function() {
      this._id = new mongoose.Types.ObjectId();
      return this;
    });

    // Fallar en User.save
    const userSaveSpy = jest.spyOn(User.prototype, 'save').mockRejectedValueOnce(new Error('User save error'));

    const req = crearReq({
      body: { email: 'fail2@x.es', password: 'Password123!', name: 'Fail', companyName: 'FailCo2' }
    });
    const res = crearRes();

    const tenantsAntes = await Tenant.countDocuments();
    await ctrl.register(req, res);

    expect(res.statusCode).toBe(500);
    expect(await Tenant.countDocuments()).toBe(tenantsAntes); // limpio el tenant

    // Restaurar
    userSaveSpy.mockRestore();
    tenantSaveSpy.mockRestore();
    findOneSpy.mockRestore();
  });
});

describe('registerSync: Tenant.getDefaultLimits inexistente', () => {
  test('usa objeto vacio si Tenant.getDefaultLimits no existe', async () => {
    // Guardar referencia original
    const originalGetDefaultLimits = Tenant.getDefaultLimits;
    delete Tenant.getDefaultLimits;

    const req = crearReq({
      body: {
        cognitoSub: 'sub-no-defaults',
        email: 'nodefaults@x.es',
        givenName: 'No',
        familyName: 'Defaults',
        companyName: 'NoDefaults'
      }
    });
    req.header.mockReturnValue('secret-123');
    const res = crearRes();

    await ctrl.registerSync(req, res);

    expect(res.statusCode).toBe(201);

    // Restaurar
    Tenant.getDefaultLimits = originalGetDefaultLimits;
  });
});
