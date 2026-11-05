/**
 * F4 (escaneo 5/Nov/2026): la lista de declaraciones en seguimiento era global
 * (no filtrada por tenant) y `mrn` era una cadena libre. Un usuario plantaba
 * `../../tenant/...` y la fila aparecia en el monitor de todos los demas.
 *
 * Formato del MRN: el patron oficial de AEAT ya vive en utils/mrnFormat.js
 * (`[0-9]{2}[A-Z]{2}[A-Z0-9]{14}`, 18 caracteres; mas estricto que
 * /^[0-9A-Z]{18}$/), asi que se reutiliza esMRNValido en vez de otra regex.
 *
 * Servicio de seguimiento REAL (almacen en memoria); solo se simula la consulta
 * a AEAT.
 */

jest.mock('../../src/services/aeat/aeatRealService', () => ({
  queryDeclarationStatus: jest.fn(),
  SERVICES: {},
  getServiceInfo: jest.fn()
}));
jest.mock('../../src/services/cacheService', () => ({
  ...jest.requireActual('../../src/services/cacheService'),
  getRedisClient: () => null // sin Redis: el almacen usa su respaldo en memoria
}));

const { aeatStatusMonitorService } = require('../../src/services/aeat');
const aeatRealController = require('../../src/controllers/aeatRealController');

const TENANT_A = '64f000000000000000000001';
const TENANT_B = '64f000000000000000000002';
const MRN_A = '26ES00ABCDEF000011';
const MRN_B = '26ES00ABCDEF000022';

const usuario = (tenantId) => ({ _id: 'u-' + tenantId, role: 'admin', tenantId });

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function seguir(tenantId, mrn) {
  const res = crearRes();
  await aeatRealController.trackDeclaration(
    { user: usuario(tenantId), body: { mrn, declarationType: 'H1' }, params: {}, query: {} }, res);
  return res;
}

async function listar(tenantId) {
  const res = crearRes();
  await aeatRealController.getTrackedDeclarations({ user: usuario(tenantId), query: {}, params: {}, body: {} }, res);
  return res;
}

beforeEach(async () => {
  await aeatStatusMonitorService.trackedDeclarations.clear();
});

describe('F4 — monitoring/track valida el MRN', () => {
  test.each(['../../x', '../../tenant/users/1/roles/2?', '26ES', 'abc', '26es00abcdef000011', '26ES00ABCDEF0000111'])(
    'mrn %j -> 400 y no se guarda nada', async (mrn) => {
      const res = await seguir(TENANT_A, mrn);
      expect(res.statusCode).toBe(400);
      expect(await aeatStatusMonitorService.trackedDeclarations.size()).toBe(0);
    });

  test('un MRN valido se acepta', async () => {
    const res = await seguir(TENANT_A, MRN_A);
    expect(res.statusCode).toBe(200);
  });

  test('refresh con un mrn de ruta invalido -> 400', async () => {
    const res = crearRes();
    await aeatRealController.refreshDeclarationStatus(
      { user: usuario(TENANT_A), params: { mrn: '../../x' }, body: { certificateAlias: 'c1' } }, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('F4 — el seguimiento esta acotado por tenant', () => {
  test('el tenant A no ve lo que sigue el tenant B', async () => {
    await seguir(TENANT_A, MRN_A);
    await seguir(TENANT_B, MRN_B);

    const deA = (await listar(TENANT_A)).body.data.declarations.map((d) => d.mrn);
    const deB = (await listar(TENANT_B)).body.data.declarations.map((d) => d.mrn);

    expect(deA).toEqual([MRN_A]);
    expect(deB).toEqual([MRN_B]);
  });

  test('el mismo MRN seguido por dos tenants no se pisa', async () => {
    await seguir(TENANT_A, MRN_A);
    await seguir(TENANT_B, MRN_A);

    expect((await listar(TENANT_A)).body.data.total).toBe(1);
    expect((await listar(TENANT_B)).body.data.total).toBe(1);
  });

  test('el tenant B no puede refrescar el seguimiento del tenant A', async () => {
    await seguir(TENANT_A, MRN_A);
    const res = crearRes();
    await aeatRealController.refreshDeclarationStatus(
      { user: usuario(TENANT_B), params: { mrn: MRN_A }, body: { certificateAlias: 'c1' } }, res);

    expect(res.body.data.success).toBe(false);
    expect(require('../../src/services/aeat/aeatRealService').queryDeclarationStatus).not.toHaveBeenCalled();
  });

  test('un tenantId en metadata del body no cambia el tenant', async () => {
    const res = crearRes();
    await aeatRealController.trackDeclaration({
      user: usuario(TENANT_A),
      body: { mrn: MRN_A, declarationType: 'H1', metadata: { tenantId: TENANT_B } }, params: {}, query: {}
    }, res);

    expect((await listar(TENANT_B)).body.data.total).toBe(0);
    expect((await listar(TENANT_A)).body.data.total).toBe(1);
  });

  test('las alertas activas solo son las del tenant', async () => {
    await seguir(TENANT_A, MRN_A);
    await seguir(TENANT_B, MRN_B);
    for (const [tenant, mrn] of [[TENANT_A, MRN_A], [TENANT_B, MRN_B]]) {
      const t = await aeatStatusMonitorService.trackedDeclarations.get(`${tenant}:${mrn}`);
      t.alerts = [{ level: 'critical', message: 'x' }];
      await aeatStatusMonitorService.trackedDeclarations.set(`${tenant}:${mrn}`, t);
    }
    const res = crearRes();
    await aeatRealController.getActiveAlerts({ user: usuario(TENANT_A), query: {}, params: {}, body: {} }, res);
    expect(res.body.data.alerts.map((a) => a.mrn)).toEqual([MRN_A]);
  });
});
