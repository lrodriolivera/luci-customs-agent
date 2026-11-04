/**
 * El log de auditoria de admin se limita al tenant y nunca guarda contraseñas.
 *
 * Hallazgos F5, F8 y F19 del escaneo del 3/Nov/2026: adminController guardaba
 * un unico array en memoria para todos los tenants y GET /api/admin/audit-logs
 * lo devolvia entero a cualquier admin de tenant. USER_UPDATE guardaba
 * `changes: req.body`, asi que la contraseña que un admin ponia a un usuario
 * quedaba en claro y la leia el admin de cualquier otro cliente.
 *
 * Se comprueba: cada admin ve solo las entradas de su tenant (super_admin
 * todas), las estadisticas tambien se acotan, y ninguna entrada contiene una
 * contraseña, ni al escribirla ni al leer entradas que ya la tuvieran.
 */

jest.mock('../../src/models/User', () => {
  const MockUser = jest.fn();
  MockUser.findOne = jest.fn();
  MockUser.findById = jest.fn();
  MockUser.countDocuments = jest.fn().mockResolvedValue(0);
  MockUser.aggregate = jest.fn().mockResolvedValue([]);
  return MockUser;
});
jest.mock('../../src/models', () => ({ User: require('../../src/models/User'), Tenant: {} }));

const User = require('../../src/models/User');
const adminController = require('../../src/controllers/adminController');

const ADMIN_A = { _id: 'aA', id: 'aA', name: 'Admin A', role: 'admin', tenantId: 'tA' };
const ADMIN_B = { _id: 'aB', id: 'aB', name: 'Admin B', role: 'admin', tenantId: 'tB' };
const SUPER = { _id: 's0', id: 's0', name: 'Super', role: 'super_admin', tenantId: 't0' };
const CLAVE = 'ClaveSecreta-2026!';

function crearRes() {
  const res = { statusCode: 200, headersSent: false };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.headersSent = true; return res; };
  return res;
}

const req = (user, extra = {}) => ({ user, params: {}, query: {}, body: {}, headers: {}, ...extra });

/** Un usuario del tenant del admin, con save espiable. */
function usuarioDe(tenantId, id) {
  return {
    _id: { toString: () => id }, email: `${id}@${tenantId}.es`, name: id, role: 'agent', tenantId,
    isActive: true, save: jest.fn().mockResolvedValue(true)
  };
}

async function cambiarPassword(admin, id) {
  User.findById.mockResolvedValue(usuarioDe(admin.tenantId, id));
  const res = crearRes();
  await adminController.updateUser(req(admin, { params: { id }, body: { name: 'Nuevo', password: CLAVE } }), res);
  expect(res.statusCode).toBe(200);
}

async function leerLogs(admin) {
  const res = crearRes();
  await adminController.getAuditLogs(req(admin, { query: { limit: 1000 } }), res);
  return res.body.logs;
}

beforeAll(async () => {
  await cambiarPassword(ADMIN_A, 'userA');
  await cambiarPassword(ADMIN_B, 'userB');
});

describe('alcance por tenant', () => {
  test('el admin de A solo ve las entradas de su tenant', async () => {
    const logs = await leerLogs(ADMIN_A);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((l) => l.tenantId === 'tA')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('userB');
  });

  test('el admin de B no ve las de A', async () => {
    const logs = await leerLogs(ADMIN_B);
    expect(JSON.stringify(logs)).not.toContain('userA');
  });

  test('super_admin ve las de todos los tenants', async () => {
    const texto = JSON.stringify(await leerLogs(SUPER));
    expect(texto).toContain('userA');
    expect(texto).toContain('userB');
  });

  test('las estadisticas de auditoria tambien se acotan al tenant', async () => {
    const res = crearRes();
    await adminController.getAuditStats(req(ADMIN_A), res);
    const resSuper = crearRes();
    await adminController.getAuditStats(req(SUPER), resSuper);
    expect(res.body.stats.totalLogs).toBeLessThan(resSuper.body.stats.totalLogs);
    expect(Object.keys(res.body.stats.byUser)).not.toContain('Admin B');
  });
});

describe('sin contraseñas', () => {
  test('ninguna entrada guarda la contraseña nueva, ni siquiera para super_admin', async () => {
    expect(JSON.stringify(await leerLogs(SUPER))).not.toContain(CLAVE);
  });

  test('el resto de cambios si queda registrado', async () => {
    const logs = await leerLogs(ADMIN_A);
    const update = logs.find((l) => l.action === 'USER_UPDATE');
    expect(update.details.changes.name).toBe('Nuevo');
    expect(update.details.changes.password).toBe('[REDACTED]');
  });

  test('una entrada antigua con contraseña en claro se lee sin ella', async () => {
    adminController._registrarAuditoriaParaTest({
      tenantId: 'tA', action: 'USER_UPDATE', module: 'users',
      details: { changes: { password: CLAVE, newPassword: CLAVE, nested: { contraseña: CLAVE } } }
    });
    const texto = JSON.stringify(await leerLogs(ADMIN_A));
    expect(texto).not.toContain(CLAVE);
  });
});
