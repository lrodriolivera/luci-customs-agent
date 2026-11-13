/**
 * POST /api/auth/admin/invite
 *
 * Reemplaza al antiguo adminInvite basado en Cognito (retirado, ver
 * src/scripts/crearUsuarioEnTenant.js): un administrador de tenant invita a un
 * usuario LOCAL con una contrasena temporal de un solo uso.
 *
 * Se monta el router real (src/routes/auth.js) con Mongo en memoria y sin
 * mockear `auth`: los tokens son JWT reales (user.generateAuthToken()), igual
 * que en produccion. Esto permite probar de punta a punta la puerta de
 * mustChangePassword en middleware/auth.js, no solo el endpoint de invitacion.
 */

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const AuditLog = require('../../src/models/AuditLog');
const auditService = require('../../src/services/auditService');

usarBaseDeDatosEnMemoria();

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(auditService.middleware);
  app.use('/api/auth', require('../../src/routes/auth'));
  return app;
}

let tenantA;
let tenantB;

async function crearUsuario({ role, tenantId, email, password = 'Password123!' }) {
  const user = await User.create({
    email,
    password,
    name: `Usuario ${role}`,
    role,
    tenantId,
    organizationId: tenantId,
    isActive: true
  });
  return user;
}

beforeEach(async () => {
  const sufijo = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
  // status: 'active' explicito -- el default del esquema es 'pending', y un
  // super_admin eligiendo tenant (arreglo 5) solo puede invitar a uno activo.
  tenantA = await Tenant.create({
    name: 'Tenant A', slug: `tenant-a-${sufijo}`, status: 'active',
    businessInfo: { eori: 'ESA0000000A' }, customsConfig: { eoriNumbers: { ES: 'ESA0000000A' } }
  });
  tenantB = await Tenant.create({
    name: 'Tenant B', slug: `tenant-b-${sufijo}`, status: 'active',
    businessInfo: { eori: 'ESB0000000B' }, customsConfig: { eoriNumbers: { ES: 'ESB0000000B' } }
  });
});

describe('autenticacion y roles', () => {
  test('401 sin token', async () => {
    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .send({ email: 'nuevo@t-a.es', name: 'Nuevo Agente', role: 'agent' });

    expect(res.status).toBe(401);
  });

  test.each(['supervisor', 'agent', 'viewer'])('403 para un %s (no es admin ni super_admin)', async (role) => {
    const actor = await crearUsuario({ role, tenantId: tenantA._id, email: `actor-${role}@t-a.es` });
    const token = actor.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `nuevo-${role}@t-a.es`, name: 'Nuevo', role: 'agent' });

    expect(res.status).toBe(403);
    expect(await User.findOne({ email: `nuevo-${role}@t-a.es` })).toBeNull();
  });
});

describe('creacion dentro del propio tenant', () => {
  test('201: crea el usuario en el tenant del admin, con contrasena temporal de un solo uso', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin@t-a.es' });
    const token = admin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'invitado@t-a.es', name: 'Invitado Uno', role: 'agent' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.temporaryPassword).toMatch(/.{8,}/);
    expect(res.body.data.user.email).toBe('invitado@t-a.es');
    expect(res.body.data.user.mustChangePassword).toBe(true);
    // La respuesta nunca incluye el hash ni expone el campo password.
    expect(res.body.data.user.password).toBeUndefined();

    const creado = await User.findOne({ email: 'invitado@t-a.es' }).select('+password');
    expect(String(creado.tenantId)).toBe(String(tenantA._id));
    expect(creado.mustChangePassword).toBe(true);
    expect(creado.tempPasswordExpires.getTime()).toBeGreaterThan(Date.now());
    expect(creado.tempPasswordExpires.getTime()).toBeLessThanOrEqual(Date.now() + 73 * 60 * 60 * 1000);
    // La temporal se guarda SOLO como hash, nunca en claro.
    expect(creado.password).not.toBe(res.body.data.temporaryPassword);
    expect(await creado.comparePassword(res.body.data.temporaryPassword)).toBe(true);
  });

  test('queda auditado "admin invito a X con rol Y" sin la contrasena en la auditoria', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin2@t-a.es' });
    const token = admin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'invitado2@t-a.es', name: 'Invitado Dos', role: 'supervisor' });

    expect(res.status).toBe(201);

    const entradas = await AuditLog.find({ action: 'admin_invite' }).lean();
    expect(entradas).toHaveLength(1);
    expect(entradas[0].metadata).toMatchObject({ email: 'invitado2@t-a.es', role: 'supervisor' });
    expect(JSON.stringify(entradas[0])).not.toContain(res.body.data.temporaryPassword);
  });

  test('ignora campos fuera de la lista blanca (isActive, permissions, password del body)', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin3@t-a.es' });
    const token = admin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'invitado3@t-a.es',
        name: 'Invitado Tres',
        role: 'agent',
        isActive: false,
        password: 'ContraseñaElegidaPorElAtacante1!',
        permissions: { canManageUsers: true, canConfigureSystem: true }
      });

    expect(res.status).toBe(201);

    const creado = await User.findOne({ email: 'invitado3@t-a.es' }).select('+password');
    expect(creado.isActive).toBe(true); // no se pudo desactivar vía body
    expect(await creado.comparePassword('ContraseñaElegidaPorElAtacante1!')).toBe(false);
    expect(creado.permissions.canManageUsers).toBe(false); // 'agent' no gestiona usuarios
  });
});

describe('el tenant del usuario nuevo es siempre el del admin autenticado', () => {
  test('un admin no puede crear en otro tenant ni con tenantId en el body ni con X-Tenant-ID en la cabecera', async () => {
    const adminA = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'adminA@t-a.es' });
    const token = adminA.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', String(tenantB._id))
      .send({ email: 'cruzado@otra.es', name: 'Cruzado', role: 'agent', tenantId: String(tenantB._id) });

    expect(res.status).toBe(201);

    const creado = await User.findOne({ email: 'cruzado@otra.es' });
    expect(String(creado.tenantId)).toBe(String(tenantA._id));
    expect(String(creado.tenantId)).not.toBe(String(tenantB._id));
  });

  test('un admin no puede conceder super_admin (ni dentro de su tenant)', async () => {
    const adminA = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'adminA2@t-a.es' });
    const token = adminA.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'quierosermas@t-a.es', name: 'Ambicioso', role: 'super_admin' });

    expect(res.status).toBe(403);
    expect(await User.findOne({ email: 'quierosermas@t-a.es' })).toBeNull();
  });

  test('un super_admin SI puede elegir tenant explicitamente, y queda auditado', async () => {
    const superAdmin = await crearUsuario({ role: 'super_admin', tenantId: undefined, email: 'super@plataforma.es' });
    const token = superAdmin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'elegido@t-b.es', name: 'Elegido', role: 'admin', tenantId: String(tenantB._id) });

    expect(res.status).toBe(201);
    const creado = await User.findOne({ email: 'elegido@t-b.es' });
    expect(String(creado.tenantId)).toBe(String(tenantB._id));

    const entrada = await AuditLog.findOne({ action: 'admin_invite', resourceId: String(creado._id) }).lean();
    expect(entrada.metadata.tenantOverride).toBe(true);
  });

  test('un super_admin sin tenant propio y sin tenantId explicito recibe 400, no crea nada sin tenant', async () => {
    const superAdmin = await crearUsuario({ role: 'super_admin', tenantId: undefined, email: 'super2@plataforma.es' });
    const token = superAdmin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'huerfano@nada.es', name: 'Huerfano', role: 'agent' });

    expect(res.status).toBe(400);
    expect(await User.findOne({ email: 'huerfano@nada.es' })).toBeNull();
  });
});

describe('email unico en toda la plataforma, sin revelar el tenant', () => {
  test('409 si el email ya existe en OTRO tenant, sin decir en cual', async () => {
    const adminA = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'adminA3@t-a.es' });
    await crearUsuario({ role: 'agent', tenantId: tenantB._id, email: 'compartido@ejemplo.es' });
    const token = adminA.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'compartido@ejemplo.es', name: 'Repetido', role: 'agent' });

    expect(res.status).toBe(409);
    expect(res.body.error.toLowerCase()).not.toContain('tenant');
    expect(res.body.error.toLowerCase()).not.toContain(tenantB.slug.toLowerCase());
  });
});

// Arreglo 3 de la revision de seguridad del 4.2: una invitacion caducada no
// debe bloquear la cuenta para siempre. Reinvitar al MISMO correo en el MISMO
// tenant, mientras siga pendiente (mustChangePassword activo), regenera la
// temporal en vez de dejar al admin sin forma de arreglarlo salvo por BD.
describe('reinvitar a un usuario pendiente regenera la temporal', () => {
  test('200 y temporal nueva si el correo sigue pendiente en el MISMO tenant', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'adminReinvita@t-a.es' });
    const token = admin.generateAuthToken();
    const app = crearApp();

    const primera = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'pendiente@t-a.es', name: 'Pendiente', role: 'agent' });
    expect(primera.status).toBe(201);
    const temporalVieja = primera.body.data.temporaryPassword;

    // Simula que la primera invitacion caduco sin usarse.
    await User.updateOne({ email: 'pendiente@t-a.es' }, { $set: { tempPasswordExpires: new Date(Date.now() - 1000) } });

    const segunda = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'pendiente@t-a.es', name: 'Pendiente', role: 'agent' });

    expect(segunda.status).toBe(200);
    expect(segunda.body.data.temporaryPassword).toBeTruthy();
    expect(segunda.body.data.temporaryPassword).not.toBe(temporalVieja);

    const actualizado = await User.findOne({ email: 'pendiente@t-a.es' }).select('+password');
    expect(actualizado.mustChangePassword).toBe(true);
    expect(actualizado.tempPasswordExpires.getTime()).toBeGreaterThan(Date.now());
    expect(await actualizado.comparePassword(temporalVieja)).toBe(false); // la vieja ya no vale
    expect(await actualizado.comparePassword(segunda.body.data.temporaryPassword)).toBe(true);

    // La vieja temporal, ya sustituida, no deja entrar.
    const loginConVieja = await request(app).post('/api/auth/login').send({ email: 'pendiente@t-a.es', password: temporalVieja });
    expect(loginConVieja.status).toBe(401);
  });

  test('409 si el correo pendiente esta en OTRO tenant (no se reinvita entre tenants)', async () => {
    const adminA = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'adminReinvitaB@t-a.es' });
    const adminB = await crearUsuario({ role: 'admin', tenantId: tenantB._id, email: 'adminReinvitaB@t-b.es' });

    const invite = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${adminB.generateAuthToken()}`)
      .send({ email: 'pendienteOtro@correo.es', name: 'Pendiente', role: 'agent' });
    expect(invite.status).toBe(201);

    const reintento = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${adminA.generateAuthToken()}`)
      .send({ email: 'pendienteOtro@correo.es', name: 'Pendiente', role: 'agent' });

    expect(reintento.status).toBe(409);
  });

  test('409 si el usuario del mismo tenant ya completo el primer acceso (no esta pendiente)', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'adminReinvitaActivo@t-a.es' });
    const token = admin.generateAuthToken();
    const app = crearApp();

    const invite = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'yaActivo@t-a.es', name: 'Ya Activo', role: 'agent' });
    expect(invite.status).toBe(201);

    // Completa el cambio de contrasena obligatorio: deja de estar pendiente.
    await User.updateOne({ email: 'yaActivo@t-a.es' }, { $set: { mustChangePassword: false, tempPasswordExpires: undefined } });

    const reinvite = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'yaActivo@t-a.es', name: 'Ya Activo', role: 'agent' });

    expect(reinvite.status).toBe(409);
  });
});

describe('validacion de entrada', () => {
  test('400 con email con formato invalido', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin4@t-a.es' });
    const token = admin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'no-es-un-email', name: 'X', role: 'agent' });

    expect(res.status).toBe(400);
  });

  test('400 sin nombre', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin5@t-a.es' });
    const token = admin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'sinnombre@t-a.es', role: 'agent' });

    expect(res.status).toBe(400);
  });

  test('400 con un rol que no existe', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin6@t-a.es' });
    const token = admin.generateAuthToken();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'rolraro@t-a.es', name: 'X', role: 'superusuario' });

    expect(res.status).toBe(400);
  });

  // Arreglo 5 de la revision de seguridad del 4.2: email/name/role como
  // array u objeto (en vez de texto) podian colarse por las validaciones de
  // forma (.isEmail()/.isIn() de express-validator aceptan algunos no-string
  // via coercion) y llegar al controller con una forma inesperada.
  test('400 si email llega como array', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin9@t-a.es' });
    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
      .send({ email: ['a@a.es', 'b@b.es'], name: 'X', role: 'agent' });

    expect(res.status).toBe(400);
  });

  test('400 si name llega como objeto', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin10@t-a.es' });
    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
      .send({ email: 'tipos@t-a.es', name: { toString: () => 'inyectado' }, role: 'agent' });

    expect(res.status).toBe(400);
  });

  test('400 si role llega como array', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin11@t-a.es' });
    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${admin.generateAuthToken()}`)
      .send({ email: 'tipos2@t-a.es', name: 'X', role: ['agent', 'admin'] });

    expect(res.status).toBe(400);
  });
});

describe('super_admin eligiendo tenant explicitamente: validacion del tenantId', () => {
  function superAdmin() {
    return crearUsuario({ role: 'super_admin', tenantId: undefined, email: `super-${Date.now()}@plataforma.es` });
  }

  test('400 si el tenantId no es un ObjectId valido', async () => {
    const super_ = await superAdmin();
    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${super_.generateAuthToken()}`)
      .send({ email: 'tenantinvalido@t-a.es', name: 'X', role: 'agent', tenantId: 'no-es-un-objectid' });

    expect(res.status).toBe(400);
  });

  test('400 si el tenantId es un ObjectId valido pero no existe ningun tenant con el', async () => {
    const super_ = await superAdmin();
    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${super_.generateAuthToken()}`)
      .send({ email: 'tenantfantasma@t-a.es', name: 'X', role: 'agent', tenantId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(400);
    expect(await User.findOne({ email: 'tenantfantasma@t-a.es' })).toBeNull();
  });

  test('400 si el tenant existe pero esta suspendido/cancelado (no activo)', async () => {
    const tenantSuspendido = await Tenant.create({
      name: 'Tenant Suspendido',
      slug: `tenant-susp-${Date.now()}`,
      status: 'suspended',
      businessInfo: { eori: 'ESSUSPEND01' }
    });
    const super_ = await superAdmin();

    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${super_.generateAuthToken()}`)
      .send({ email: 'tenantsuspendido@t-a.es', name: 'X', role: 'agent', tenantId: String(tenantSuspendido._id) });

    expect(res.status).toBe(400);
    expect(await User.findOne({ email: 'tenantsuspendido@t-a.es' })).toBeNull();
  });

  test('201 si el tenantId es valido, existe y esta activo', async () => {
    const super_ = await superAdmin();
    const res = await request(crearApp())
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${super_.generateAuthToken()}`)
      .send({ email: 'tenantok@t-a.es', name: 'X', role: 'agent', tenantId: String(tenantA._id) });

    expect(res.status).toBe(201);
  });
});

describe('primer acceso: cambio de contrasena obligatorio', () => {
  test('login con la temporal exige cambiarla y bloquea el resto de rutas hasta hacerlo', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin7@t-a.es' });
    const adminToken = admin.generateAuthToken();
    const app = crearApp();

    const invite = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'primeracceso@t-a.es', name: 'Primer Acceso', role: 'admin' });
    expect(invite.status).toBe(201);
    const temporal = invite.body.data.temporaryPassword;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'primeracceso@t-a.es', password: temporal });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
    const tokenInvitado = login.body.data.token;

    // /me si esta permitido con password temporal pendiente.
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenInvitado}`);
    expect(me.status).toBe(200);

    // Cualquier otra ruta (aunque el rol sea admin) queda bloqueada.
    const listado = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${tokenInvitado}`);
    expect(listado.status).toBe(403);
    expect(listado.body.code).toBe('MUST_CHANGE_PASSWORD');

    // Cambiar la contrasena: deja de estar bloqueado y la temporal deja de servir (un solo uso).
    const cambio = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${tokenInvitado}`)
      .send({ currentPassword: temporal, newPassword: 'NuevaContrasenaDefinitiva1' });
    expect(cambio.status).toBe(200);

    // El cambio de contrasena invalida el token viejo (passwordChangedAt);
    // el cliente debe usar el nuevo que devuelve la respuesta.
    const tokenTrasCambio = cambio.body.data.token;
    expect(tokenTrasCambio).toBeTruthy();

    const conTokenViejo = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${tokenInvitado}`);
    expect(conTokenViejo.status).toBe(401);

    const listadoTrasCambio = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${tokenTrasCambio}`);
    expect(listadoTrasCambio.status).toBe(200);

    const reLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'primeracceso@t-a.es', password: temporal });
    expect(reLogin.status).toBe(401); // la temporal ya no vale, fue de un solo uso
  });

  test('la temporal caducada (72h) rechaza el login', async () => {
    const admin = await crearUsuario({ role: 'admin', tenantId: tenantA._id, email: 'admin8@t-a.es' });
    const adminToken = admin.generateAuthToken();
    const app = crearApp();

    const invite = await request(app)
      .post('/api/auth/admin/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'caducado@t-a.es', name: 'Caducado', role: 'agent' });
    expect(invite.status).toBe(201);

    await User.updateOne(
      { email: 'caducado@t-a.es' },
      { $set: { tempPasswordExpires: new Date(Date.now() - 1000) } }
    );

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'caducado@t-a.es', password: invite.body.data.temporaryPassword });

    expect(login.status).toBe(401);
    expect(login.body.code).toBe('TEMP_PASSWORD_EXPIRED');
  });
});

describe('limitador de peticiones', () => {
  test('app.js aplica el limitador estricto de auth a /api/auth/admin/invite', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../src/app.js'), 'utf8');
    expect(appJs).toMatch(/app\.use\(\s*['"]\/api\/auth\/admin\/invite['"]\s*,\s*authLimiter\s*\)/);
  });
});
