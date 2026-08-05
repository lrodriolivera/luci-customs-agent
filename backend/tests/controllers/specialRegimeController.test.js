/**
 * specialRegimeController — API de regímenes aduaneros especiales
 * (depósito, perfeccionamiento activo/pasivo, importación temporal, tránsito).
 *
 * Wrapper sobre services/specialRegimeService. Lo propio que se ejercita: el
 * mapeo del catch (create/update/delete/authorize/... → 400; getById → 404 vs
 * 500; list/getStats/getExpiring → 500), la validación de linkGuarantee (400
 * sin guaranteeId), y sobre todo calculateDuties, que hace la AGREGACIÓN de los
 * derechos suspendidos EN EL CONTROLLER (no delega la suma) — eso se prueba con
 * datos reales para verificar que el reduce totaliza correctamente.
 * El service se mockea (frontera: su lógica ya está en tests/services/).
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/specialRegimeService');

const svc = require('../../src/services/specialRegimeService');
const ctrl = require('../../src/controllers/specialRegimeController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = ({ body = {}, query = {}, params = {}, user = { _id: 'u1' } } = {}) =>
  ({ body, query, params, user });

beforeEach(() => {
  Object.keys(svc).forEach((k) => {
    if (typeof svc[k] === 'function') svc[k].mockResolvedValue({ ok: true });
  });
});

describe('create', () => {
  test('201 con userId del token', async () => {
    svc.create.mockResolvedValue({ _id: 'r1' });
    const res = mockRes();
    await ctrl.create(req({ body: { regimeCode: '5100' } }), res);
    expect(res.statusCode).toBe(201);
    expect(svc.create).toHaveBeenCalledWith({ regimeCode: '5100' }, 'u1');
  });

  test('400 si el service lanza', async () => {
    svc.create.mockRejectedValue(new Error('validación'));
    const res = mockRes();
    await ctrl.create(req(), res);
    expect(res.statusCode).toBe(400);
  });
});

describe('list', () => {
  test('éxito acota por usuario y parsea page/limit', async () => {
    svc.list.mockResolvedValue({ data: [], pagination: {} });
    const res = mockRes();
    await ctrl.list(req({ query: { page: '3', limit: '50', status: 'active' } }), res);
    const [userId, filtros, opts] = svc.list.mock.calls[0];
    expect(userId).toBe('u1');
    expect(filtros.status).toBe('active');
    expect(opts).toEqual({ page: 3, limit: 50 });
  });

  test('500 si lanza', async () => {
    svc.list.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await ctrl.list(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getStats', () => {
  test('éxito', async () => {
    svc.getStats.mockResolvedValue({ total: 4 });
    const res = mockRes();
    await ctrl.getStats(req({ query: { regimeCode: '5100' } }), res);
    expect(res.body.data.total).toBe(4);
    expect(svc.getStats).toHaveBeenCalledWith('u1', expect.objectContaining({ regimeCode: '5100' }));
  });

  test('500 si lanza', async () => {
    svc.getStats.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getExpiring', () => {
  test('usa 30 días por defecto', async () => {
    svc.getExpiringRegimes.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getExpiring(req({ query: {} }), res);
    expect(svc.getExpiringRegimes).toHaveBeenCalledWith('u1', 30);
  });

  test('respeta days de la query', async () => {
    svc.getExpiringRegimes.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getExpiring(req({ query: { days: '7' } }), res);
    expect(svc.getExpiringRegimes).toHaveBeenCalledWith('u1', 7);
  });

  test('500 si lanza', async () => {
    svc.getExpiringRegimes.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getExpiring(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getById', () => {
  test('éxito', async () => {
    svc.getById.mockResolvedValue({ _id: 'r1' });
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'r1' } }), res);
    expect(res.body.data._id).toBe('r1');
    expect(svc.getById).toHaveBeenCalledWith('r1', 'u1');
  });

  test('404 con el mensaje exacto "Regimen no encontrado"', async () => {
    svc.getById.mockRejectedValue(new Error('Regimen no encontrado'));
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'x' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('500 en otros errores', async () => {
    svc.getById.mockRejectedValue(new Error('db caída'));
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'r1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('linkGuarantee', () => {
  test('400 si falta guaranteeId', async () => {
    const res = mockRes();
    await ctrl.linkGuarantee(req({ params: { id: 'r1' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito pasa id + guaranteeId + userId', async () => {
    svc.linkGuarantee.mockResolvedValue({ linked: true });
    const res = mockRes();
    await ctrl.linkGuarantee(req({ params: { id: 'r1' }, body: { guaranteeId: 'g1' } }), res);
    expect(res.body.data.linked).toBe(true);
    expect(svc.linkGuarantee).toHaveBeenCalledWith('r1', 'g1', 'u1');
  });

  test('400 si el service lanza', async () => {
    svc.linkGuarantee.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.linkGuarantee(req({ params: { id: 'r1' }, body: { guaranteeId: 'g1' } }), res);
    expect(res.statusCode).toBe(400);
  });
});

// Handlers que delegan (id, body, userId) y mapean el catch a 400.
describe('handlers de ciclo de vida (éxito + catch 400)', () => {
  const casos = [
    ['update', 'update'],
    ['authorize', 'authorize'],
    ['requestExtension', 'requestExtension'],
    ['discharge', 'discharge'],
    ['addGoods', 'addGoods'],
    ['partialExit', 'partialExit'],
    ['updateTransitStatus', 'updateTransitStatus']
  ];

  test.each(casos)('%s: éxito', async (handler, svcFn) => {
    svc[svcFn].mockResolvedValue({ _id: 'r1' });
    const res = mockRes();
    await ctrl[handler](req({ params: { id: 'r1' }, body: { x: 1 } }), res);
    expect(res.body.success).toBe(true);
    expect(svc[svcFn]).toHaveBeenCalledWith('r1', { x: 1 }, 'u1');
  });

  test.each(casos)('%s: 400 si lanza', async (handler, svcFn) => {
    svc[svcFn].mockRejectedValue(new Error('estado inválido'));
    const res = mockRes();
    await ctrl[handler](req({ params: { id: 'r1' } }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe('activate', () => {
  test('éxito (solo id + userId)', async () => {
    svc.activate.mockResolvedValue({ status: 'active' });
    const res = mockRes();
    await ctrl.activate(req({ params: { id: 'r1' } }), res);
    expect(svc.activate).toHaveBeenCalledWith('r1', 'u1');
  });

  test('400 si lanza', async () => {
    svc.activate.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.activate(req({ params: { id: 'r1' } }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe('delete', () => {
  test('éxito', async () => {
    svc.delete.mockResolvedValue(undefined);
    const res = mockRes();
    await ctrl.delete(req({ params: { id: 'r1' } }), res);
    expect(res.body.success).toBe(true);
    expect(svc.delete).toHaveBeenCalledWith('r1', 'u1');
  });

  test('400 si lanza (p.ej. no es borrador)', async () => {
    svc.delete.mockRejectedValue(new Error('solo borradores'));
    const res = mockRes();
    await ctrl.delete(req({ params: { id: 'r1' } }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe('calculateDuties (agregación en el controller)', () => {
  test('400 si faltan goods array o regimeCode', async () => {
    const res = mockRes();
    await ctrl.calculateDuties(req({ body: { regimeCode: '5100' } }), res);
    expect(res.statusCode).toBe(400);
    const res2 = mockRes();
    await ctrl.calculateDuties(req({ body: { goods: [] } }), res2);
    expect(res2.statusCode).toBe(400);
    const res3 = mockRes();
    await ctrl.calculateDuties(req({ body: { goods: 'no-array', regimeCode: '5100' } }), res3);
    expect(res3.statusCode).toBe(400);
  });

  test('suma los derechos suspendidos de todas las mercancías', async () => {
    // El service calcula por mercancía; el controller totaliza.
    svc.calculateSuspendedDuties
      .mockReturnValueOnce({ tariff: 10, vat: 21, excise: 0, total: 31 })
      .mockReturnValueOnce({ tariff: 5, vat: 10.5, excise: 2, total: 17.5 });
    const res = mockRes();
    await ctrl.calculateDuties(req({
      body: {
        regimeCode: '5100',
        goods: [{ customsValue: 100 }, { customsValue: 50 }]
      }
    }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.goods).toHaveLength(2);
    expect(res.body.data.goods[0].suspendedDuties.total).toBe(31);
    expect(res.body.data.totals).toEqual({
      customsValue: 150,
      tariff: 15,
      vat: 31.5,
      excise: 2,
      total: 48.5
    });
    expect(svc.calculateSuspendedDuties).toHaveBeenCalledWith({ customsValue: 100 }, '5100');
  });

  test('customsValue ausente cuenta como 0', async () => {
    svc.calculateSuspendedDuties.mockReturnValue({ tariff: 0, vat: 0, excise: 0, total: 0 });
    const res = mockRes();
    await ctrl.calculateDuties(req({ body: { regimeCode: '5100', goods: [{}] } }), res);
    expect(res.body.data.totals.customsValue).toBe(0);
  });

  test('400 si el cálculo lanza', async () => {
    svc.calculateSuspendedDuties.mockImplementation(() => { throw new Error('régimen desconocido'); });
    const res = mockRes();
    await ctrl.calculateDuties(req({ body: { regimeCode: 'XXX', goods: [{ customsValue: 1 }] } }), res);
    expect(res.statusCode).toBe(400);
  });
});
