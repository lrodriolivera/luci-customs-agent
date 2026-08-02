/**
 * Tests para tenantGuard (estaba al 0%).
 *
 * Es el control que impide que un tenant lea documentos de otro. Muchos
 * controllers hacen findById(req.params.id) sin incluir el tenant en la
 * consulta, asi que este guard es la unica barrera entre manipular una URL y
 * ver datos de otro cliente. No tenia un solo test.
 */

const { ensureSameTenant, extractTenantId, isSuperAdmin } = require('../../src/utils/tenantGuard');

/** Respuesta Express simulada, con lo justo que usa el guard. */
function mockRes() {
  const res = { headersSent: false, statusCode: null, body: null };
  res.status = jest.fn(code => { res.statusCode = code; return res; });
  res.json = jest.fn(payload => { res.body = payload; return res; });
  return res;
}

describe('tenantGuard.ensureSameTenant', () => {

  test('deja pasar cuando el documento es del mismo tenant', () => {
    const res = mockRes();
    const ok = ensureSameTenant({ tenantId: 't1' }, { user: { tenantId: 't1' } }, res);

    expect(ok).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('bloquea el acceso a un documento de otro tenant', () => {
    const res = mockRes();
    const ok = ensureSameTenant({ tenantId: 't2' }, { user: { tenantId: 't1' } }, res);

    expect(ok).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  test('responde 404 y no 403 para no revelar que el documento existe', () => {
    // Un 403 confirmaria al atacante que el id es valido en otro tenant.
    const res = mockRes();
    ensureSameTenant({ tenantId: 't2' }, { user: { tenantId: 't1' } }, res, { resource: 'Expediente' });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Expediente no encontrado');
    expect(JSON.stringify(res.body)).not.toMatch(/permiso|forbidden|autoriza/i);
  });

  test('documento inexistente tambien da 404', () => {
    const res = mockRes();
    expect(ensureSameTenant(null, { user: { tenantId: 't1' } }, res)).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  test('compara ObjectId y string sin falsos negativos', () => {
    // tenantId llega como ObjectId desde Mongoose y como string desde el JWT.
    const res = mockRes();
    const objectIdFalso = { toString: () => 't1' };
    const ok = ensureSameTenant({ tenantId: objectIdFalso }, { user: { tenantId: 't1' } }, res);

    expect(ok).toBe(true);
  });

  test('acepta organizationId como alias de tenantId', () => {
    const res = mockRes();
    expect(ensureSameTenant({ organizationId: 't1' }, { user: { tenantId: 't1' } }, res)).toBe(true);
  });

  test('req.tenantId tiene prioridad sobre req.user.tenantId', () => {
    const res = mockRes();
    const ok = ensureSameTenant({ tenantId: 't9' }, { tenantId: 't9', user: { tenantId: 't1' } }, res);

    expect(ok).toBe(true);
  });

  describe('superadmin', () => {
    test('atraviesa cualquier tenant por rol', () => {
      const res = mockRes();
      expect(ensureSameTenant({ tenantId: 't2' }, { user: { role: 'superadmin', tenantId: 't1' } }, res)).toBe(true);
    });

    test('tambien por el flag isSuperAdmin', () => {
      const res = mockRes();
      expect(ensureSameTenant({ tenantId: 't2' }, { user: { isSuperAdmin: true, tenantId: 't1' } }, res)).toBe(true);
    });

    test('un admin normal NO atraviesa tenants', () => {
      // 'admin' es administrador de su tenant, no del sistema.
      const res = mockRes();
      expect(ensureSameTenant({ tenantId: 't2' }, { user: { role: 'admin', tenantId: 't1' } }, res)).toBe(false);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('casos limite', () => {
    test('documento sin tenant (legacy) se permite', () => {
      // Decision explicita del guard: los registros previos al multi-tenant no
      // tienen tenantId y bloquearlos romperia el historico.
      const res = mockRes();
      expect(ensureSameTenant({ _id: 'x' }, { user: { tenantId: 't1' } }, res)).toBe(true);
    });

    test('usuario sin tenant contra documento con tenant da 401', () => {
      const res = mockRes();
      expect(ensureSameTenant({ tenantId: 't1' }, { user: {} }, res)).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    test('no escribe la respuesta si ya se enviaron cabeceras', () => {
      const res = mockRes();
      res.headersSent = true;
      expect(ensureSameTenant({ tenantId: 't2' }, { user: { tenantId: 't1' } }, res)).toBe(false);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

describe('tenantGuard.extractTenantId', () => {
  test('devuelve null sin documento', () => {
    expect(extractTenantId(null)).toBeNull();
  });

  test('convierte el ObjectId a string', () => {
    expect(extractTenantId({ tenantId: { toString: () => 'abc' } })).toBe('abc');
  });
});

describe('tenantGuard.isSuperAdmin', () => {
  test.each([
    [{ role: 'superadmin' }, true],
    [{ isSuperAdmin: true }, true],
    [{ role: 'admin' }, false],
    [{ role: 'user' }, false],
    [undefined, false]
  ])('%o -> %s', (user, esperado) => {
    expect(isSuperAdmin(user)).toBe(esperado);
  });
});
