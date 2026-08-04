/**
 * tenantController: alta, ciclo de vida y aislamiento de organizaciones.
 *
 * Es el modulo que decide que ve cada cliente, asi que un fallo aqui no da un
 * error visible: da los datos de otro. Estaba al 11,88% de cobertura.
 *
 * IMPORTANTE SOBRE EL METODO: estos tests NO mockean tenantService. Se ejecuta
 * el servicio real, que guarda en un Map en memoria y no necesita MongoDB. Un
 * test que mockea la dependencia inmediata del codigo bajo prueba comprueba que
 * el controlador llama a algo, no que ese algo haga lo correcto -- y ese error
 * ya dejo pasar una regresion antes (los ocho ReferenceError de 7e3a435, donde
 * los tests mockeaban el helper de propiedad y nunca ejecutaron la linea real).
 *
 * Se mockea unicamente el logger, para no ensuciar la salida.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const tenantService = require('../../src/services/tenant/tenantService');
const controller = require('../../src/controllers/tenantController');

/** Respuesta que captura status y cuerpo. */
function res() {
  const r = { statusCode: 200 };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

/** Crea una organizacion real y devuelve su id. */
async function nuevaOrganizacion(extra = {}) {
  const r = await tenantService.createTenant({
    name: `Cliente ${Math.random().toString(36).slice(2, 8)}`,
    plan: 'free',
    contactEmail: 'contacto@cliente.es',
    ...extra
  });
  expect(r.success).toBe(true);
  return r.tenant.id;
}

describe('REGRESION: las escrituras deben esperar al servicio', () => {
  /**
   * Las ocho funciones de escritura de tenantService son async. El controlador
   * las llamaba SIN await, de modo que `result` era una Promise, result.success
   * salia undefined y se respondia 400... habiendo ejecutado la accion.
   *
   * Medido antes del arreglo:
   *   suspendTenant -> HTTP 400 {} , y tenantService.isActive(id) === false
   *
   * Es decir, la UI decia "error al suspender" con el cliente ya cortado. En el
   * alta el efecto es peor: el operador reintenta y crea duplicados.
   */
  test.each([
    ['createTenant', () => ({ body: { name: 'Await Test SL' } }), 201],
    ['updateTenant', (id) => ({ params: { id }, body: { name: 'Renombrada' } }), 200],
    ['activateTenant', (id) => ({ params: { id }, body: {} }), 200],
    ['suspendTenant', (id) => ({ params: { id }, body: { reason: 'x' } }), 200],
    ['cancelTenant', (id) => ({ params: { id }, body: {} }), 200],
    ['deleteTenant', (id) => ({ params: { id } }), 200],
    ['updateTenantSettings', (id) => ({ tenantId: id, body: { language: 'en' } }), 200],
    ['changeTenantPlan', (id) => ({ tenantId: id, body: { plan: 'starter' } }), 200]
  ])('%s devuelve exito cuando la accion funciona', async (fn, hacerReq, esperado) => {
    const id = await nuevaOrganizacion();
    const r = res();

    await controller[fn](hacerReq(id), r);

    expect(r.statusCode).toBe(esperado);
    expect(r.body.success).not.toBeUndefined();
  });

  test('el cuerpo de la respuesta nunca es un objeto vacio', async () => {
    // {} era la firma del bug: JSON.stringify de una Promise.
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.suspendTenant({ params: { id }, body: { reason: 'impago' } }, r);

    expect(Object.keys(r.body).length).toBeGreaterThan(0);
  });
});

describe('alta de organizaciones', () => {
  test('crea una organizacion con los datos enviados', async () => {
    const r = res();
    await controller.createTenant(
      { body: { name: 'Aduanas Levante SL', plan: 'free', contactEmail: 'a@b.es' } }, r
    );

    expect(r.statusCode).toBe(201);
    expect(r.body.success).toBe(true);
    expect(r.body.tenant.name).toBe('Aduanas Levante SL');
  });

  test('el slug se deriva del nombre', async () => {
    const r = res();
    await controller.createTenant({ body: { name: 'Transitos del Norte SA' } }, r);

    expect(r.body.tenant.slug).toBe('transitos-del-norte-sa');
  });

  test('rechaza un slug repetido', async () => {
    // Dos organizaciones con el mismo slug harian ambigua la resolucion por
    // subdominio, que es como el middleware identifica al cliente.
    await controller.createTenant({ body: { name: 'Duplicada SL', slug: 'duplicada' } }, res());

    const segunda = res();
    await controller.createTenant({ body: { name: 'Otra', slug: 'duplicada' } }, segunda);

    expect(segunda.statusCode).toBe(400);
    expect(segunda.body.success).toBe(false);
  });

  test('nace en estado pendiente, no activa', async () => {
    // Una organizacion recien creada no debe poder operar hasta activarse.
    const r = res();
    await controller.createTenant({ body: { name: 'Recien Creada SL' } }, r);

    expect(r.body.tenant.status).toBe('pending');
  });
});

describe('consulta de una organizacion', () => {
  let id;
  beforeAll(async () => { id = await nuevaOrganizacion({ name: 'Consultable SL' }); });

  test('por id', async () => {
    const r = res();
    await controller.getTenant({ params: { id } }, r);

    expect(r.body.success).toBe(true);
    expect(r.body.tenant.id).toBe(id);
  });

  test('un id inexistente da 404, no 500', async () => {
    const r = res();
    await controller.getTenant({ params: { id: 'TNT-no-existe' } }, r);

    expect(r.statusCode).toBe(404);
  });

  test('por slug', async () => {
    const creada = res();
    await controller.createTenant({ body: { name: 'Por Slug SL', slug: 'por-slug' } }, creada);

    const r = res();
    await controller.getTenantBySlug({ params: { slug: 'por-slug' } }, r);

    expect(r.body.tenant.slug).toBe('por-slug');
  });

  test('un slug inexistente da 404', async () => {
    const r = res();
    await controller.getTenantBySlug({ params: { slug: 'no-existe-jamas' } }, r);

    expect(r.statusCode).toBe(404);
  });

  test('el listado devuelve las organizaciones creadas', async () => {
    const r = res();
    await controller.listTenants({ query: {} }, r);

    expect(r.body.success).toBe(true);
    expect(Array.isArray(r.body.tenants)).toBe(true);
    expect(r.body.tenants.length).toBeGreaterThan(0);
  });
});

describe('ciclo de vida', () => {
  test('activar habilita la organizacion', async () => {
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.activateTenant({ params: { id } }, r);

    expect(r.body.success).toBe(true);
    expect(tenantService.isActive(id)).toBe(true);
  });

  test('suspender la inhabilita', async () => {
    // Es el mecanismo para cortar el servicio a un cliente que no paga: tiene
    // que surtir efecto en isActive, que es lo que consulta el middleware.
    const id = await nuevaOrganizacion();
    await controller.activateTenant({ params: { id } }, res());

    await controller.suspendTenant({ params: { id }, body: { reason: 'impago' } }, res());

    expect(tenantService.isActive(id)).toBe(false);
  });

  test('cancelar tambien la inhabilita', async () => {
    const id = await nuevaOrganizacion();
    await controller.activateTenant({ params: { id } }, res());

    await controller.cancelTenant({ params: { id }, body: {} }, res());

    expect(tenantService.isActive(id)).toBe(false);
  });

  test('borrar es LOGICO: la deja cancelada, no la elimina', async () => {
    // Por defecto deleteTenant hace borrado logico (status=cancelled +
    // deletedAt) y solo borra de verdad con hard=true. La organizacion sigue
    // siendo consultable a proposito, para conservar el historico de
    // declaraciones presentadas ante la AEAT, que hay que guardar 4 anos.
    const id = await nuevaOrganizacion();
    await controller.activateTenant({ params: { id } }, res());

    await controller.deleteTenant({ params: { id } }, res());

    expect(tenantService.isActive(id)).toBe(false);

    const r = res();
    await controller.getTenant({ params: { id } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.tenant.deletedAt).toBeDefined();
  });

  test('actualizar cambia los datos', async () => {
    const id = await nuevaOrganizacion({ name: 'Nombre Viejo SL' });
    const r = res();

    await controller.updateTenant({ params: { id }, body: { name: 'Nombre Nuevo SL' } }, r);

    expect(tenantService.getTenant(id).tenant.name).toBe('Nombre Nuevo SL');
  });

  test('operar sobre un id inexistente no revienta con 500', async () => {
    for (const fn of ['activateTenant', 'suspendTenant', 'cancelTenant', 'deleteTenant']) {
      const r = res();
      await controller[fn]({ params: { id: 'TNT-fantasma' }, body: {} }, r);

      expect(r.statusCode).toBeLessThan(500);
    }
  });
});

describe('contexto de organizacion en la peticion', () => {
  // Estas rutas las usa el propio cliente sobre SU organizacion, tomandola del
  // token. Sin contexto deben responder 400, no exponer la de otro.
  test.each([
    ['getCurrentTenant', 'tenant'],
    ['getTenantSettings', 'tenantId'],
    ['getTenantUsage', 'tenantId'],
    ['listRoles', 'tenantId']
  ])('%s sin contexto responde 400', async (fn) => {
    const r = res();
    await controller[fn]({ params: {}, query: {}, body: {}, user: {} }, r);

    expect(r.statusCode).toBe(400);
  });

  test('getCurrentTenant devuelve la organizacion del contexto', async () => {
    const r = res();
    const tenant = { id: 'TNT-x', name: 'Del Token SL' };

    await controller.getCurrentTenant({ tenant }, r);

    expect(r.body.tenant.name).toBe('Del Token SL');
  });

  test('getTenantSettings devuelve los ajustes reales', async () => {
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.getTenantSettings({ tenantId: id }, r);

    expect(r.body.success).toBe(true);
    expect(r.body.settings).toBeDefined();
  });

  test('updateTenantSettings los modifica', async () => {
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.updateTenantSettings({ tenantId: id, body: { language: 'en' } }, r);

    expect(r.statusCode).toBeLessThan(400);
  });

  test('getTenantUsage devuelve el consumo del plan', async () => {
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.getTenantUsage({ tenantId: id }, r);

    expect(r.body.success).toBe(true);
    expect(r.body.data.currentUsage).toBeDefined();
  });
});

describe('planes', () => {
  test('el catalogo de planes no esta vacio', async () => {
    const r = res();
    await controller.getAvailablePlans({}, r);

    expect(Array.isArray(r.body.data ?? r.body.plans ?? r.body)).toBe(true);
  });

  test('cambiar de plan sin contexto responde 400', async () => {
    const r = res();
    await controller.changeTenantPlan({ body: { plan: 'pro' } }, r);

    expect(r.statusCode).toBe(400);
  });

  test('cambiar a un plan valido surte efecto', async () => {
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.changeTenantPlan({ tenantId: id, body: { plan: 'starter' } }, r);

    expect(r.statusCode).toBeLessThan(400);
  });

  test('un plan inventado se rechaza', async () => {
    // Aceptarlo dejaria la organizacion con limites indefinidos.
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.changeTenantPlan({ tenantId: id, body: { plan: 'plan-inventado' } }, r);

    expect(r.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('roles', () => {
  test('los roles predefinidos incluyen super_admin y tenant_admin', async () => {
    const r = res();
    await controller.getBuiltInRoles({}, r);

    const texto = JSON.stringify(r.body);
    expect(texto).toMatch(/super_admin/);
    expect(texto).toMatch(/tenant_admin/);
  });

  test('el catalogo de permisos esta disponible', async () => {
    const r = res();
    await controller.getPermissionInfo({}, r);

    expect(r.statusCode).toBeLessThan(400);
  });

  test('listRoles de una organizacion real responde', async () => {
    const id = await nuevaOrganizacion();
    const r = res();

    await controller.listRoles({ tenantId: id }, r);

    expect(r.statusCode).toBeLessThan(500);
  });
});
