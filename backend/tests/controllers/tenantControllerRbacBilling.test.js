/**
 * tenantController: handlers de RBAC (roles/permisos) y Billing.
 *
 * La mitad trasera del controller son wrappers finos sobre rbacService y
 * billingService, dos servicios EN MEMORIA (Maps a nivel de modulo, sin
 * modelos ni I/O externo). Aqui se ejercita la logica REAL de esos handlers:
 * el guard de contexto (!req.tenantId -> 400), las validaciones de entrada, y
 * el mapeo de result.success -> 400/404/201/200. Los servicios subyacentes ya
 * tienen su propio test unitario; esto cubre el CONTROLLER, que estaba sin
 * tocar (34%L).
 *
 * No se mockea nada: rbacService/billingService son deterministas y en memoria.
 * Se usa un tenantId UNICO por test porque el estado de los servicios persiste
 * entre tests (son Maps de modulo, no mocks que resetMocks limpie).
 */

const ctrl = require('../../src/controllers/tenantController');
const billingService = require('../../src/services/tenant/billingService');

let contador = 0;
function nuevoTenant() {
  contador += 1;
  return `tenant-test-${contador}-${process.pid}`;
}

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

// ---------- RBAC: roles ----------

describe('RBAC roles', () => {
  test('listRoles sin contexto de tenant devuelve 400', async () => {
    const res = crearRes();
    await ctrl.listRoles({ tenantId: null }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/tenant context/i);
  });

  test('listRoles devuelve los roles predefinidos', async () => {
    const res = crearRes();
    await ctrl.listRoles({ tenantId: nuevoTenant() }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.builtInCount).toBeGreaterThan(0);
    expect(Array.isArray(res.body.roles)).toBe(true);
  });

  test('getBuiltInRoles devuelve el catalogo de roles internos', async () => {
    const res = crearRes();
    await ctrl.getBuiltInRoles({}, res);
    expect(res.statusCode).toBe(200);
    const ids = res.body.roles.map(r => r.id);
    expect(ids).toContain('super_admin');
    expect(ids).toContain('tenant_admin');
  });

  test('getRole de un rol interno existente devuelve 200', async () => {
    const res = crearRes();
    await ctrl.getRole({ params: { roleId: 'tenant_admin' }, tenantId: nuevoTenant() }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.role.id).toBe('tenant_admin');
  });

  test('getRole de un rol inexistente devuelve 404', async () => {
    const res = crearRes();
    await ctrl.getRole({ params: { roleId: 'no-existe' }, tenantId: nuevoTenant() }, res);
    expect(res.statusCode).toBe(404);
  });

  test('createRole crea un rol personalizado (201) y luego es recuperable', async () => {
    const tenantId = nuevoTenant();
    const resCrear = crearRes();
    await ctrl.createRole({
      tenantId,
      body: { name: 'Operador Aduanas', permissions: ['expedition:read'], priority: 30 }
    }, resCrear);

    expect(resCrear.statusCode).toBe(201);
    expect(resCrear.body.success).toBe(true);
    const roleId = resCrear.body.role.id;

    const resGet = crearRes();
    await ctrl.getRole({ params: { roleId }, tenantId }, resGet);
    expect(resGet.statusCode).toBe(200);
    expect(resGet.body.role.name).toBe('Operador Aduanas');
  });

  test('createRole sin contexto de tenant devuelve 400', async () => {
    const res = crearRes();
    await ctrl.createRole({ tenantId: null, body: { name: 'X' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('createRole que intenta pisar un rol interno devuelve 400', async () => {
    const res = crearRes();
    await ctrl.createRole({ tenantId: nuevoTenant(), body: { id: 'super_admin', name: 'Fake' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/built-in/i);
  });

  test('updateRole modifica un rol personalizado', async () => {
    const tenantId = nuevoTenant();
    const resCrear = crearRes();
    await ctrl.createRole({ tenantId, body: { name: 'Rev1', permissions: [] } }, resCrear);
    const roleId = resCrear.body.role.id;

    const res = crearRes();
    await ctrl.updateRole({ tenantId, params: { roleId }, body: { name: 'Rev2' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.role.name).toBe('Rev2');
  });

  test('updateRole sobre un rol interno devuelve 400', async () => {
    const res = crearRes();
    await ctrl.updateRole({ tenantId: nuevoTenant(), params: { roleId: 'tenant_admin' }, body: { name: 'X' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('deleteRole borra un rol personalizado', async () => {
    const tenantId = nuevoTenant();
    const resCrear = crearRes();
    await ctrl.createRole({ tenantId, body: { name: 'Temporal', permissions: [] } }, resCrear);
    const roleId = resCrear.body.role.id;

    const res = crearRes();
    await ctrl.deleteRole({ tenantId, params: { roleId } }, res);
    expect(res.statusCode).toBe(200);

    const resGet = crearRes();
    await ctrl.getRole({ params: { roleId }, tenantId }, resGet);
    expect(resGet.statusCode).toBe(404);
  });

  test('deleteRole sobre un rol interno devuelve 400', async () => {
    const res = crearRes();
    await ctrl.deleteRole({ tenantId: nuevoTenant(), params: { roleId: 'viewer' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('cloneRole duplica un rol interno como personalizado (201)', async () => {
    const res = crearRes();
    await ctrl.cloneRole({
      tenantId: nuevoTenant(),
      params: { roleId: 'tenant_admin' },
      body: { name: 'Admin Clonado' }
    }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.role.name).toBe('Admin Clonado');
    expect(res.body.role.isBuiltIn).toBe(false);
  });

  test('cloneRole de un origen inexistente devuelve 400', async () => {
    const res = crearRes();
    await ctrl.cloneRole({ tenantId: nuevoTenant(), params: { roleId: 'no-existe' }, body: { name: 'X' } }, res);
    expect(res.statusCode).toBe(400);
  });
});

// ---------- RBAC: roles de usuario / permisos ----------

describe('RBAC roles de usuario y permisos', () => {
  test('setUserRoles exige un array de roles (400)', async () => {
    const res = crearRes();
    await ctrl.setUserRoles({ tenantId: nuevoTenant(), params: { userId: 'u1' }, body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/array/i);
  });

  test('setUserRoles y getUserRoles reflejan la asignacion', async () => {
    const tenantId = nuevoTenant();
    const resSet = crearRes();
    await ctrl.setUserRoles({ tenantId, params: { userId: 'u1' }, body: { roles: ['tenant_admin'] } }, resSet);
    expect(resSet.statusCode).toBe(200);

    const resGet = crearRes();
    await ctrl.getUserRoles({ tenantId, params: { userId: 'u1' } }, resGet);
    expect(resGet.statusCode).toBe(200);
    expect(resGet.body.success).toBe(true);
  });

  test('assignRole asigna un rol interno a un usuario', async () => {
    const tenantId = nuevoTenant();
    const res = crearRes();
    await ctrl.assignRole({ tenantId, params: { userId: 'u1', roleId: 'viewer' } }, res);
    expect(res.statusCode).toBe(200);
  });

  test('assignRole de un rol inexistente devuelve 400', async () => {
    const res = crearRes();
    await ctrl.assignRole({ tenantId: nuevoTenant(), params: { userId: 'u1', roleId: 'no-existe' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('checkPermission exige resource y action (400)', async () => {
    const res = crearRes();
    await ctrl.checkPermission({ tenantId: nuevoTenant(), params: { userId: 'u1' }, query: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  test('checkPermission devuelve hasPermission booleano', async () => {
    const tenantId = nuevoTenant();
    await ctrl.assignRole({ tenantId, params: { userId: 'u1', roleId: 'super_admin' } }, crearRes());

    const res = crearRes();
    await ctrl.checkPermission({
      tenantId, params: { userId: 'u1' }, query: { resource: 'expedition', action: 'read' }
    }, res);
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.hasPermission).toBe('boolean');
  });

  test('getUserPermissions sin contexto devuelve 400', async () => {
    const res = crearRes();
    await ctrl.getUserPermissions({ tenantId: null, params: { userId: 'u1' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('getPermissionInfo devuelve el catalogo de recursos y acciones', async () => {
    const res = crearRes();
    await ctrl.getPermissionInfo({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------- Billing ----------

describe('Billing', () => {
  test('getBillingOverview sin contexto devuelve 400', async () => {
    const res = crearRes();
    await ctrl.getBillingOverview({ tenantId: null }, res);
    expect(res.statusCode).toBe(400);
  });

  test('getBillingOverview devuelve el resumen (sin suscripcion previa)', async () => {
    const res = crearRes();
    await ctrl.getBillingOverview({ tenantId: nuevoTenant() }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.overview).toBeDefined();
    expect(res.body.overview.paymentMethodCount).toBe(0);
  });

  test('getSubscription sin suscripcion previa devuelve 404', async () => {
    const res = crearRes();
    await ctrl.getSubscription({ tenantId: nuevoTenant() }, res);
    expect(res.statusCode).toBe(404);
  });

  test('getSubscription devuelve la suscripcion tras crearla', async () => {
    const tenantId = nuevoTenant();
    billingService.createSubscription(tenantId, 'professional');
    const res = crearRes();
    await ctrl.getSubscription({ tenantId }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.subscription.plan).toBe('professional');
  });

  test('getPlanPricing devuelve el catalogo de precios', async () => {
    const res = crearRes();
    await ctrl.getPlanPricing({}, res);
    expect(res.statusCode).toBe(200);
  });

  test('changeBillingPlan exige un plan (400)', async () => {
    const res = crearRes();
    await ctrl.changeBillingPlan({ tenantId: nuevoTenant(), body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/plan/i);
  });

  test('listInvoices devuelve una lista paginada', async () => {
    const res = crearRes();
    await ctrl.listInvoices({ tenantId: nuevoTenant(), query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.invoices)).toBe(true);
  });

  test('getInvoice de un id inexistente devuelve 404', async () => {
    const res = crearRes();
    await ctrl.getInvoice({ tenantId: nuevoTenant(), params: { invoiceId: 'no-existe' } }, res);
    expect(res.statusCode).toBe(404);
  });

  test('listPaymentMethods empieza vacio y refleja el metodo agregado', async () => {
    const tenantId = nuevoTenant();
    const resVacio = crearRes();
    await ctrl.listPaymentMethods({ tenantId }, resVacio);
    expect(resVacio.body.paymentMethods).toHaveLength(0);

    const resAdd = crearRes();
    await ctrl.addPaymentMethod({ tenantId, body: { type: 'card', last4: '4242', brand: 'visa' } }, resAdd);
    expect(resAdd.statusCode).toBe(201);
    const methodId = resAdd.body.paymentMethod.id;

    const resList = crearRes();
    await ctrl.listPaymentMethods({ tenantId }, resList);
    expect(resList.body.paymentMethods).toHaveLength(1);

    const resDel = crearRes();
    await ctrl.removePaymentMethod({ tenantId, params: { methodId } }, resDel);
    expect(resDel.statusCode).toBe(200);
  });

  test('removePaymentMethod inexistente devuelve 400', async () => {
    const res = crearRes();
    await ctrl.removePaymentMethod({ tenantId: nuevoTenant(), params: { methodId: 'no-existe' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('getUsageSummary devuelve el consumo del periodo', async () => {
    const res = crearRes();
    await ctrl.getUsageSummary({ tenantId: nuevoTenant(), query: {} }, res);
    expect(res.statusCode).toBe(200);
  });

  test('los handlers de billing responden 400 sin contexto de tenant', async () => {
    for (const handler of ['listInvoices', 'listPaymentMethods', 'getUsageSummary', 'getSubscription', 'updateSubscription', 'cancelSubscription', 'reactivateSubscription', 'getBillingStatement']) {
      const res = crearRes();
      await ctrl[handler]({ tenantId: null, query: {}, body: {} }, res);
      expect(res.statusCode).toBe(400);
    }
  });
});
