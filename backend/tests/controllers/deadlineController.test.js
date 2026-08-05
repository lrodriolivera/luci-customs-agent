/**
 * deadlineController — API de gestión de plazos y alertas aduaneras.
 *
 * Wrapper delgado sobre services/deadlineService. Lo propio que se ejercita:
 * las validaciones de entrada (400), el 404 de getById, que list SIEMPRE tome
 * el tenantId del token (no de la query — nota de seguridad del propio
 * controller), los defaults (getUrgent → 48h) y el catch → 500 de cada handler.
 * El service se mockea (frontera: su lógica de plazos ya se prueba en
 * tests/services/deadlineService*).
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/deadlineService');

const deadlineService = require('../../src/services/deadlineService');
const ctrl = require('../../src/controllers/deadlineController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = ({ body = {}, query = {}, params = {}, user = { id: 'u1', _id: 'u1', tenantId: 't1' } } = {}) =>
  ({ body, query, params, user });

beforeEach(() => {
  Object.keys(deadlineService).forEach((k) => {
    if (typeof deadlineService[k] === 'function') deadlineService[k].mockResolvedValue({ ok: true });
  });
});

describe('list', () => {
  test('éxito y toma el tenantId del token, no de la query', async () => {
    deadlineService.list.mockResolvedValue({ data: [], pagination: {} });
    const res = mockRes();
    await ctrl.list(req({ query: { tenantId: 'SUPLANTADO', status: 'pending', page: '2', limit: '5' } }), res);
    expect(res.body.success).toBe(true);
    const [filtros, opts] = deadlineService.list.mock.calls[0];
    expect(filtros.tenantId).toBe('t1');
    expect(filtros.status).toBe('pending');
    expect(opts.page).toBe(2);
    expect(opts.limit).toBe(5);
  });

  test('sin tenantId en el token no fuerza filtro de tenant', async () => {
    deadlineService.list.mockResolvedValue({ data: [] });
    const res = mockRes();
    await ctrl.list(req({ user: { id: 'u1' }, query: {} }), res);
    expect(deadlineService.list.mock.calls[0][0].tenantId).toBeUndefined();
  });

  test('500 si el service lanza', async () => {
    deadlineService.list.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await ctrl.list(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getById', () => {
  test('404 si no existe', async () => {
    deadlineService.getById.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'x' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('éxito', async () => {
    deadlineService.getById.mockResolvedValue({ _id: 'd1' });
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'd1' } }), res);
    expect(res.body.data._id).toBe('d1');
  });

  test('500 si lanza', async () => {
    deadlineService.getById.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'd1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('create', () => {
  test('201 con userId del token', async () => {
    deadlineService.create.mockResolvedValue({ _id: 'd1' });
    const res = mockRes();
    await ctrl.create(req({ body: { title: 'x' } }), res);
    expect(res.statusCode).toBe(201);
    expect(deadlineService.create).toHaveBeenCalledWith({ title: 'x' }, 'u1');
  });

  test('500 si lanza', async () => {
    deadlineService.create.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.create(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('update', () => {
  test('éxito', async () => {
    deadlineService.update.mockResolvedValue({ _id: 'd1', status: 'updated' });
    const res = mockRes();
    await ctrl.update(req({ params: { id: 'd1' }, body: { status: 'updated' } }), res);
    expect(res.body.data.status).toBe('updated');
    expect(deadlineService.update).toHaveBeenCalledWith('d1', { status: 'updated' }, 'u1');
  });

  test('500 si lanza', async () => {
    deadlineService.update.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.update(req({ params: { id: 'd1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('complete', () => {
  test('éxito pasa notes y userId', async () => {
    deadlineService.complete.mockResolvedValue({ status: 'completed' });
    const res = mockRes();
    await ctrl.complete(req({ params: { id: 'd1' }, body: { notes: 'hecho' } }), res);
    expect(res.body.data.status).toBe('completed');
    expect(deadlineService.complete).toHaveBeenCalledWith('d1', 'hecho', 'u1');
  });

  test('500 si lanza', async () => {
    deadlineService.complete.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.complete(req({ params: { id: 'd1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('extend', () => {
  test('400 si falta newDate o reason', async () => {
    const res = mockRes();
    await ctrl.extend(req({ params: { id: 'd1' }, body: { reason: 'x' } }), res);
    expect(res.statusCode).toBe(400);
    const res2 = mockRes();
    await ctrl.extend(req({ params: { id: 'd1' }, body: { newDate: '2026-01-01' } }), res2);
    expect(res2.statusCode).toBe(400);
  });

  test('éxito', async () => {
    deadlineService.extend.mockResolvedValue({ status: 'extended' });
    const res = mockRes();
    await ctrl.extend(req({ params: { id: 'd1' }, body: { newDate: '2026-01-01', reason: 'motivo' } }), res);
    expect(res.body.data.status).toBe('extended');
    expect(deadlineService.extend).toHaveBeenCalledWith('d1', '2026-01-01', 'motivo', 'u1');
  });

  test('500 si lanza', async () => {
    deadlineService.extend.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.extend(req({ params: { id: 'd1' }, body: { newDate: '2026-01-01', reason: 'm' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('cancel', () => {
  test('400 si falta reason', async () => {
    const res = mockRes();
    await ctrl.cancel(req({ params: { id: 'd1' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    deadlineService.cancel.mockResolvedValue({ status: 'cancelled' });
    const res = mockRes();
    await ctrl.cancel(req({ params: { id: 'd1' }, body: { reason: 'ya no aplica' } }), res);
    expect(res.body.data.status).toBe('cancelled');
    expect(deadlineService.cancel).toHaveBeenCalledWith('d1', 'ya no aplica', 'u1');
  });

  test('500 si lanza', async () => {
    deadlineService.cancel.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.cancel(req({ params: { id: 'd1' }, body: { reason: 'm' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('delete', () => {
  test('éxito pasa el _id del usuario', async () => {
    deadlineService.delete.mockResolvedValue(undefined);
    const res = mockRes();
    await ctrl.delete(req({ params: { id: 'd1' } }), res);
    expect(res.body.success).toBe(true);
    expect(deadlineService.delete).toHaveBeenCalledWith('d1', 'u1');
  });

  test('500 si lanza', async () => {
    deadlineService.delete.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.delete(req({ params: { id: 'd1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getPending', () => {
  test('éxito con filtro assignedTo opcional', async () => {
    deadlineService.getPending.mockResolvedValue([{ _id: 'd1' }]);
    const res = mockRes();
    await ctrl.getPending(req({ query: { assignedTo: 'u9' } }), res);
    expect(deadlineService.getPending).toHaveBeenCalledWith({ assignedTo: 'u9' });
  });

  test('500 si lanza', async () => {
    deadlineService.getPending.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getPending(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getOverdue', () => {
  test('éxito', async () => {
    deadlineService.getOverdue.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getOverdue(req(), res);
    expect(res.body.success).toBe(true);
  });

  test('500 si lanza', async () => {
    deadlineService.getOverdue.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getOverdue(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getUrgent', () => {
  test('usa 48h por defecto', async () => {
    deadlineService.getUrgent.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getUrgent(req({ query: {} }), res);
    expect(deadlineService.getUrgent).toHaveBeenCalledWith(48);
  });

  test('respeta el umbral de la query', async () => {
    deadlineService.getUrgent.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getUrgent(req({ query: { hours: '12' } }), res);
    expect(deadlineService.getUrgent).toHaveBeenCalledWith(12);
  });

  test('500 si lanza', async () => {
    deadlineService.getUrgent.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getUrgent(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getCalendar', () => {
  test('400 si falta startDate o endDate', async () => {
    const res = mockRes();
    await ctrl.getCalendar(req({ query: { startDate: '2026-01-01' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito convierte a Date', async () => {
    deadlineService.getCalendarView.mockResolvedValue({ events: [] });
    const res = mockRes();
    await ctrl.getCalendar(req({ query: { startDate: '2026-01-01', endDate: '2026-01-31' } }), res);
    expect(res.body.data.events).toEqual([]);
    const [ini, fin] = deadlineService.getCalendarView.mock.calls[0];
    expect(ini).toBeInstanceOf(Date);
    expect(fin).toBeInstanceOf(Date);
  });

  test('500 si lanza', async () => {
    deadlineService.getCalendarView.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getCalendar(req({ query: { startDate: '2026-01-01', endDate: '2026-01-31' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getDashboard', () => {
  test('usa userId de la query si viene, si no el del token', async () => {
    deadlineService.getDashboard.mockResolvedValue({ total: 0 });
    const res = mockRes();
    await ctrl.getDashboard(req({ query: { userId: 'u9' } }), res);
    expect(deadlineService.getDashboard).toHaveBeenCalledWith('u9');

    const res2 = mockRes();
    await ctrl.getDashboard(req({ query: {} }), res2);
    expect(deadlineService.getDashboard).toHaveBeenLastCalledWith('u1');
  });

  test('500 si lanza', async () => {
    deadlineService.getDashboard.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getDashboard(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getStats', () => {
  test('éxito con filtros opcionales', async () => {
    deadlineService.getStats.mockResolvedValue({ total: 5 });
    const res = mockRes();
    await ctrl.getStats(req({ query: { category: 'aduanas', assignedTo: 'u9' } }), res);
    expect(deadlineService.getStats).toHaveBeenCalledWith({ category: 'aduanas', assignedTo: 'u9' });
  });

  test('500 si lanza', async () => {
    deadlineService.getStats.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// Handlers síncronos de catálogo + tareas de mantenimiento.
describe('catálogos y mantenimiento', () => {
  const casos = [
    ['getTypes', 'getDeadlineTypes', false],
    ['getCategories', 'getCategories', false],
    ['processAlerts', 'processAlerts', true],
    ['sync', 'syncAll', true],
    ['getInfo', 'getInfo', false]
  ];

  test.each(casos)('%s: éxito y 500', async (handler, svcFn, esAsync) => {
    esAsync ? deadlineService[svcFn].mockResolvedValue({ ok: 1 }) : deadlineService[svcFn].mockReturnValue({ ok: 1 });
    const res = mockRes();
    await ctrl[handler](req(), res);
    expect(res.body.success).toBe(true);

    esAsync
      ? deadlineService[svcFn].mockRejectedValue(new Error('x'))
      : deadlineService[svcFn].mockImplementation(() => { throw new Error('x'); });
    const res2 = mockRes();
    await ctrl[handler](req(), res2);
    expect(res2.statusCode).toBe(500);
  });
});
