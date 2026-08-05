/**
 * adminController (panel de administracion) contra Mongo real en memoria.
 *
 * El foco es el AISLAMIENTO POR TENANT del panel de admin, que es lo que ya
 * ha dado problemas antes (updateUser permitia escalada entre tenants). Un
 * 'admin' es administrador de SU organizacion, no de la plataforma; solo
 * super_admin (rol de plataforma) ve/gestiona todos los tenants.
 *
 * Se prueba:
 *   - listUsers: un admin solo ve los usuarios de su tenant; super_admin ve todos.
 *   - createUser: el usuario creado hereda el tenant del admin (si no, queda
 *     huerfano y se cuela por el legacy-allow de ensureSameTenant).
 *   - getUser/updateUser/deleteUser/resetUserPassword: 404 ante un usuario ajeno.
 *   - getDashboardStats: los conteos se acotan al tenant del admin.
 *   - settings y roles (almacen en memoria) y sus validaciones.
 *
 * Sin mocks de red: no hay dependencias externas (User real, tenantGuard real).
 * NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const User = require('../../src/models/User');
const ctrl = require('../../src/controllers/adminController');

usarBaseDeDatosEnMemoria();

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

let contador = 0;
async function usuario({ tenant, role = 'agent', isActive = true } = {}) {
  contador += 1;
  return User.create({
    name: `Usuario ${contador}`,
    email: `admu${contador}@ejemplo.es`,
    password: 'Password123!',
    role,
    tenantId: tenant,
    isActive
  });
}

// Un admin de tenant (rol DE TENANT, no de plataforma)
function adminDe(tenantId, id) {
  return { _id: id || new mongoose.Types.ObjectId(), id: (id || '').toString(), role: 'admin', tenantId };
}
function superAdmin() {
  return { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
}

describe('listUsers: aislamiento por tenant', () => {
  test('un admin solo ve los usuarios de su tenant', async () => {
    const t = new mongoose.Types.ObjectId();
    await usuario({ tenant: t });
    await usuario({ tenant: t });
    await usuario({ tenant: new mongoose.Types.ObjectId() }); // otro tenant

    const res = crearRes();
    await ctrl.listUsers({ user: adminDe(t), query: {} }, res);

    expect(res.body.total).toBe(2);
  });

  test('super_admin ve los usuarios de todos los tenants', async () => {
    await usuario({ tenant: new mongoose.Types.ObjectId() });
    await usuario({ tenant: new mongoose.Types.ObjectId() });

    const res = crearRes();
    await ctrl.listUsers({ user: superAdmin(), query: {} }, res);

    expect(res.body.total).toBe(2);
  });

  test('filtra por status=active y por role dentro del tenant', async () => {
    const t = new mongoose.Types.ObjectId();
    await usuario({ tenant: t, role: 'agent', isActive: true });
    await usuario({ tenant: t, role: 'viewer', isActive: false });

    const activos = crearRes();
    await ctrl.listUsers({ user: adminDe(t), query: { status: 'active' } }, activos);
    expect(activos.body.total).toBe(1);

    const viewers = crearRes();
    await ctrl.listUsers({ user: adminDe(t), query: { role: 'viewer' } }, viewers);
    expect(viewers.body.total).toBe(1);
  });

  test('search busca por nombre/email dentro del tenant', async () => {
    const t = new mongoose.Types.ObjectId();
    const u = await usuario({ tenant: t });
    const res = crearRes();
    await ctrl.listUsers({ user: adminDe(t), query: { search: u.email } }, res);
    expect(res.body.total).toBe(1);
  });
});

describe('createUser', () => {
  test('exige email, nombre y rol (400)', async () => {
    const res = crearRes();
    await ctrl.createUser({ user: adminDe(new mongoose.Types.ObjectId()), body: { email: 'x@x.es' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('rechaza email duplicado (400)', async () => {
    const t = new mongoose.Types.ObjectId();
    const existente = await usuario({ tenant: t });
    const res = crearRes();
    await ctrl.createUser({
      user: adminDe(t),
      body: { email: existente.email, name: 'X', role: 'agent' }
    }, res);
    expect(res.statusCode).toBe(400);
  });

  test('genera contrasena temporal cuando no se aporta', async () => {
    const t = new mongoose.Types.ObjectId();
    const res = crearRes();
    await ctrl.createUser({
      user: adminDe(t),
      body: { email: 'gen@x.es', name: 'Gen', role: 'agent' }
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.temporaryPassword).toMatch(/^[0-9a-f]{12}$/);
  });

  // El usuario creado debe heredar el tenant del admin que lo crea. Si se crea
  // sin tenantId queda huerfano: no aparece en el listUsers de nadie (que
  // acota por tenant) y ademas ensureSameTenant lo deja tocar a cualquier admin
  // (legacy-allow para docs sin tenant). Es la misma familia de fuga que la
  // escalada ya corregida en authController.updateUser.
  test('el usuario creado hereda el tenant del admin', async () => {
    const t = new mongoose.Types.ObjectId();
    const res = crearRes();
    await ctrl.createUser({
      user: adminDe(t),
      body: { email: 'hereda@x.es', name: 'Hereda', role: 'agent', password: 'Password123!' }
    }, res);

    expect(res.statusCode).toBe(201);
    const creado = await User.findOne({ email: 'hereda@x.es' });
    expect(creado.tenantId?.toString()).toBe(t.toString());
  });
});

describe('getUser/updateUser/deleteUser/resetUserPassword: 404 ante usuario ajeno', () => {
  test('getUser de otro tenant devuelve 404', async () => {
    const ajeno = await usuario({ tenant: new mongoose.Types.ObjectId() });
    const res = crearRes();
    await ctrl.getUser({ user: adminDe(new mongoose.Types.ObjectId()), params: { id: ajeno._id } }, res);
    expect(res.statusCode).toBe(404);
  });

  test('getUser del propio tenant devuelve 200', async () => {
    const t = new mongoose.Types.ObjectId();
    const u = await usuario({ tenant: t });
    const res = crearRes();
    await ctrl.getUser({ user: adminDe(t), params: { id: u._id } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe(u.email);
  });

  test('updateUser de otro tenant devuelve 404 sin cambios', async () => {
    const ajeno = await usuario({ tenant: new mongoose.Types.ObjectId(), role: 'agent' });
    const res = crearRes();
    await ctrl.updateUser({
      user: adminDe(new mongoose.Types.ObjectId()),
      params: { id: ajeno._id },
      body: { role: 'admin' }
    }, res);
    expect(res.statusCode).toBe(404);
    const sinCambios = await User.findById(ajeno._id);
    expect(sinCambios.role).toBe('agent');
  });

  test('updateUser del propio tenant actualiza rol y permisos', async () => {
    const t = new mongoose.Types.ObjectId();
    const u = await usuario({ tenant: t, role: 'agent' });
    const res = crearRes();
    await ctrl.updateUser({ user: adminDe(t), params: { id: u._id }, body: { role: 'supervisor' } }, res);
    expect(res.statusCode).toBe(200);
    const guardado = await User.findById(u._id);
    expect(guardado.role).toBe('supervisor');
    expect(guardado.permissions.canApproveDeclarations).toBe(true);
  });

  test('resetUserPassword de otro tenant devuelve 404', async () => {
    const ajeno = await usuario({ tenant: new mongoose.Types.ObjectId() });
    const res = crearRes();
    await ctrl.resetUserPassword({ user: adminDe(new mongoose.Types.ObjectId()), params: { id: ajeno._id } }, res);
    expect(res.statusCode).toBe(404);
  });

  test('resetUserPassword del propio tenant devuelve una temporal', async () => {
    const t = new mongoose.Types.ObjectId();
    const u = await usuario({ tenant: t });
    const res = crearRes();
    await ctrl.resetUserPassword({ user: adminDe(t), params: { id: u._id } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.temporaryPassword).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('deleteUser: reglas de negocio', () => {
  test('no permite eliminar el propio usuario (400)', async () => {
    const t = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const admin = await User.create({
      _id: adminId, name: 'Admin', email: 'adminself@x.es', password: 'Password123!', role: 'admin', tenantId: t
    });
    const res = crearRes();
    await ctrl.deleteUser({
      user: { _id: adminId, id: adminId.toString(), role: 'admin', tenantId: t },
      params: { id: adminId.toString() }
    }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/propio/);
  });

  test('no permite eliminar al ultimo admin del tenant (400)', async () => {
    const t = new mongoose.Types.ObjectId();
    const unicoAdmin = await usuario({ tenant: t, role: 'admin' });
    const res = crearRes();
    await ctrl.deleteUser({
      user: adminDe(t),
      params: { id: unicoAdmin._id.toString() }
    }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/último administrador/);
  });

  test('elimina (soft) a un agente del propio tenant', async () => {
    const t = new mongoose.Types.ObjectId();
    await usuario({ tenant: t, role: 'admin' }); // asegura que hay admin
    const agente = await usuario({ tenant: t, role: 'agent' });
    const res = crearRes();
    await ctrl.deleteUser({ user: adminDe(t), params: { id: agente._id.toString() } }, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('getDashboardStats: conteos acotados al tenant', () => {
  test('un admin solo cuenta los usuarios de su tenant', async () => {
    const t = new mongoose.Types.ObjectId();
    await usuario({ tenant: t, role: 'admin' });
    await usuario({ tenant: t, role: 'agent' });
    await usuario({ tenant: new mongoose.Types.ObjectId() }); // otro tenant, no debe contar

    const res = crearRes();
    await ctrl.getDashboardStats({ user: adminDe(t), query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.stats.users.total).toBe(2);
  });
});

describe('roles y settings (almacen en memoria)', () => {
  test('listRoles devuelve el catalogo de roles', async () => {
    const res = crearRes();
    await ctrl.listRoles({ user: adminDe(new mongoose.Types.ObjectId()) }, res);
    expect(res.body.roles.map(r => r.id)).toEqual(expect.arrayContaining(['admin', 'agent', 'viewer']));
  });

  test('getSettings devuelve la configuracion', async () => {
    const res = crearRes();
    await ctrl.getSettings({ user: adminDe(new mongoose.Types.ObjectId()) }, res);
    expect(res.body.settings.general.currency).toBe('EUR');
  });

  test('updateSettings exige section y settings (400)', async () => {
    const res = crearRes();
    await ctrl.updateSettings({ user: adminDe(new mongoose.Types.ObjectId()), body: { section: 'general' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('updateSettings rechaza una seccion invalida (400)', async () => {
    const res = crearRes();
    await ctrl.updateSettings({
      user: adminDe(new mongoose.Types.ObjectId()),
      body: { section: 'inexistente', settings: { x: 1 } }
    }, res);
    expect(res.statusCode).toBe(400);
  });

  test('updateSettings hace merge de una seccion valida', async () => {
    const res = crearRes();
    await ctrl.updateSettings({
      user: adminDe(new mongoose.Types.ObjectId()),
      body: { section: 'security', settings: { sessionTimeout: 30 } }
    }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.settings.security.sessionTimeout).toBe(30);
  });
});

describe('audit logs (almacen en memoria)', () => {
  test('getAuditLogs devuelve la lista paginada', async () => {
    const res = crearRes();
    await ctrl.getAuditLogs({ user: adminDe(new mongoose.Types.ObjectId()), query: { limit: 10, offset: 0 } }, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  test('getAuditStats devuelve estadisticas agregadas', async () => {
    const res = crearRes();
    await ctrl.getAuditStats({ user: adminDe(new mongoose.Types.ObjectId()), query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toHaveProperty('byModule');
  });
});
