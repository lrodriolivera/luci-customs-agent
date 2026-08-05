/**
 * authController: alta y gestion de usuarios contra Mongo real en memoria.
 *
 * El authController.test.js hermano cubre login/forgot/reset/change-password
 * con modelos mockeados (flujo puro de credenciales). Aqui se ejercita la otra
 * mitad —register, getMe, updateProfile, listUsers, updateUser— contra la BD
 * real, porque lo valioso es el AISLAMIENTO POR TENANT: register crea el tenant
 * y el usuario admin, listUsers solo ve los de su tenant, y updateUser NO puede
 * tocar a un usuario de otro cliente (requireRole('admin') es rol DE TENANT,
 * no de plataforma — ver la regresion de escalada ya arreglada).
 *
 * Se mockea SOLO emailService (welcome email, red). User/Tenant van con BD real.
 * NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));

const { User, Tenant } = require('../../src/models');
const ctrl = require('../../src/controllers/authController');

usarBaseDeDatosEnMemoria();

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

let contador = 0;
async function crearUsuario({ tenant, role = 'agent', isActive = true } = {}) {
  contador += 1;
  const tenantId = tenant || new mongoose.Types.ObjectId();
  return User.create({
    name: `Usuario ${contador}`,
    email: `user${contador}@ejemplo.es`,
    password: 'Password123!',
    role,
    tenantId,
    isActive
  });
}

describe('register', () => {
  test('crea el tenant y el usuario admin, devuelve token (201)', async () => {
    const res = crearRes();
    await ctrl.register({
      body: { email: 'nuevo@empresa.es', password: 'Password123!', name: 'Ana', companyName: 'Empresa Test SL' }
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.token).toBeTruthy();

    const user = await User.findOne({ email: 'nuevo@empresa.es' });
    expect(user.role).toBe('admin');
    const tenant = await Tenant.findById(user.tenantId);
    expect(tenant).toBeTruthy();
    expect(tenant.slug).toBe('empresa-test-sl');
  });

  test('rechaza un email ya registrado (400) sin crear tenant huerfano', async () => {
    await crearUsuario();
    const existente = await User.findOne({});
    const res = crearRes();

    const tenantsAntes = await Tenant.countDocuments();
    await ctrl.register({
      body: { email: existente.email, password: 'Password123!', name: 'X', companyName: 'Otra SL' }
    }, res);

    expect(res.statusCode).toBe(400);
    expect(await Tenant.countDocuments()).toBe(tenantsAntes); // no crea tenant si el email choca
  });

  test('sin companyName usa el fallback de slug "empresa"', async () => {
    const res = crearRes();
    await ctrl.register({ body: { email: 'sinempresa@x.es', password: 'Password123!', name: 'Solo' } }, res);

    expect(res.statusCode).toBe(201);
    const user = await User.findOne({ email: 'sinempresa@x.es' });
    const tenant = await Tenant.findById(user.tenantId);
    expect(tenant.slug).toBe('empresa');
    expect(tenant.name).toBe('Solo'); // sin companyName cae al name
  });

  test('genera un slug unico si el nombre de empresa ya existe', async () => {
    const res1 = crearRes();
    await ctrl.register({ body: { email: 'a@x.es', password: 'Password123!', name: 'A', companyName: 'Duplicada' } }, res1);
    const res2 = crearRes();
    await ctrl.register({ body: { email: 'b@x.es', password: 'Password123!', name: 'B', companyName: 'Duplicada' } }, res2);

    const u1 = await User.findOne({ email: 'a@x.es' });
    const u2 = await User.findOne({ email: 'b@x.es' });
    const t1 = await Tenant.findById(u1.tenantId);
    const t2 = await Tenant.findById(u2.tenantId);
    expect(t1.slug).toBe('duplicada');
    expect(t2.slug).not.toBe('duplicada'); // sufijo unico
  });
});

describe('getMe / updateProfile', () => {
  test('getMe devuelve el usuario publico (sin password)', async () => {
    const user = await crearUsuario();
    const res = crearRes();

    await ctrl.getMe({ user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$|password/);
  });

  test('updateProfile persiste el nombre y no toca el rol', async () => {
    const user = await crearUsuario({ role: 'agent' });
    const res = crearRes();

    await ctrl.updateProfile({ user, body: { name: 'Nombre Nuevo', role: 'admin' } }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await User.findById(user._id);
    expect(guardado.name).toBe('Nombre Nuevo');
    expect(guardado.role).toBe('agent'); // role NO esta entre los campos permitidos
  });

  test('updateProfile persiste profile y notifications', async () => {
    const user = await crearUsuario();
    const res = crearRes();

    await ctrl.updateProfile({
      user,
      body: { profile: { company: 'ACME' }, notifications: { emailOnNewExpedition: false } }
    }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await User.findById(user._id);
    expect(guardado.profile.company).toBe('ACME');
    expect(guardado.notifications.emailOnNewExpedition).toBe(false);
  });
});

describe('listUsers: aislamiento por tenant', () => {
  test('un admin solo ve los usuarios de SU tenant', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    await crearUsuario({ tenant: tenantId });
    await crearUsuario(); // otro tenant

    const res = crearRes();
    await ctrl.listUsers({ user: admin, query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.users).toHaveLength(2); // admin + companero, NO el de otro tenant
    expect(res.body.data.pagination.total).toBe(2);
  });

  test('el filtro por role funciona dentro del tenant', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    await crearUsuario({ tenant: tenantId, role: 'viewer' });

    const res = crearRes();
    await ctrl.listUsers({ user: admin, query: { role: 'viewer' } }, res);

    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].role).toBe('viewer');
  });

  test('el filtro por isActive="false" excluye a los activos', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin', isActive: true });
    await crearUsuario({ tenant: tenantId, isActive: false });

    const res = crearRes();
    await ctrl.listUsers({ user: admin, query: { isActive: 'false' } }, res);

    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].isActive).toBe(false);
  });

  test('la paginacion respeta page y limit', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    await crearUsuario({ tenant: tenantId });
    await crearUsuario({ tenant: tenantId });

    const res = crearRes();
    await ctrl.listUsers({ user: admin, query: { page: '2', limit: '2' } }, res);

    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.pages).toBe(2);
    expect(res.body.data.users).toHaveLength(1); // pagina 2 con limit 2 → el sobrante
  });
});

describe('updateUser: no escalada de privilegios entre tenants', () => {
  test('un admin actualiza a un usuario de su propio tenant', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const admin = await crearUsuario({ tenant: tenantId, role: 'admin' });
    const objetivo = await crearUsuario({ tenant: tenantId, role: 'agent' });

    const res = crearRes();
    await ctrl.updateUser({ user: admin, params: { id: objetivo._id }, body: { role: 'supervisor' } }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await User.findById(objetivo._id);
    expect(guardado.role).toBe('supervisor');
  });

  // Regresion de escalada de privilegios: requireRole('admin') es rol DE TENANT.
  // Sin el filtro por tenantId, un admin del tenant A podia cambiar el rol y los
  // permisos de un usuario del tenant B conociendo su id. updateUser filtra por
  // { _id, tenantId } y devuelve 404 si no es de su tenant.
  test('un admin NO puede tocar a un usuario de otro tenant (404, sin cambios)', async () => {
    const admin = await crearUsuario({ tenant: new mongoose.Types.ObjectId(), role: 'admin' });
    const ajeno = await crearUsuario({ tenant: new mongoose.Types.ObjectId(), role: 'agent' });

    const res = crearRes();
    await ctrl.updateUser({ user: admin, params: { id: ajeno._id }, body: { role: 'admin' } }, res);

    expect(res.statusCode).toBe(404);
    const sinCambios = await User.findById(ajeno._id);
    expect(sinCambios.role).toBe('agent'); // NO escalado
  });

  test('404 al actualizar un usuario inexistente', async () => {
    const admin = await crearUsuario({ role: 'admin' });
    const res = crearRes();
    await ctrl.updateUser({ user: admin, params: { id: new mongoose.Types.ObjectId() }, body: { name: 'X' } }, res);
    expect(res.statusCode).toBe(404);
  });
});
