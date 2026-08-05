/**
 * inspectionController — coordinación de inspecciones.
 *
 * Wrapper puro sobre services/inspectionService (única dependencia junto al
 * logger). Se mockea el service (frontera: su lógica y persistencia se prueban
 * en tests/services/) y se ejercita lo PROPIO del controller: la validación 400
 * (confirm/cancel/reschedule/getCalendar), el 404 de getById, la construcción de
 * filtros (tenantId SIEMPRE del token, no de la query), los fallbacks
 * query.userId||token (getPending/getDashboard), los handlers síncronos
 * (getTypes/getLocations/getResults/getChecklist/getInfo) y el catch → 500.
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/inspectionService');

const svc = require('../../src/services/inspectionService');
const ctrl = require('../../src/controllers/inspectionController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = ({ body = {}, query = {}, params = {}, user = { id: 'u1', _id: 'u1', tenantId: 'T1' } } = {}) =>
  ({ body, query, params, user });

// Por defecto todo async del service resuelve algo; los síncronos devuelven arrays.
const ASYNC_FNS = [
  'list', 'getById', 'create', 'schedule', 'confirm', 'start', 'complete',
  'addParticipant', 'addEvidence', 'addInspectedItem', 'registerFinding',
  'addSample', 'updateSampleResult', 'generateReport', 'addResultingAction',
  'cancel', 'reschedule', 'getToday', 'getPending', 'getCalendar',
  'getDashboard', 'getStats'
];
const SYNC_FNS = [
  'getInspectionTypes', 'getLocations', 'getInspectionResults',
  'getInspectionChecklist', 'getInfo'
];

beforeEach(() => {
  ASYNC_FNS.forEach((k) => { if (svc[k]) svc[k].mockResolvedValue({ ok: true }); });
  SYNC_FNS.forEach((k) => { if (svc[k]) svc[k].mockReturnValue(['x']); });
});

// ==================== list ====================
describe('list', () => {
  test('toma tenantId del TOKEN y arma filtros de la query', async () => {
    svc.list.mockResolvedValue({ items: [] });
    const res = mockRes();
    await ctrl.list(req({
      query: { page: '2', limit: '5', status: 'scheduled', inspectionType: 'physical', authorityType: 'SOIVRE', assignedTo: 'u9', sortOrder: 'desc' }
    }), res);
    expect(res.body.success).toBe(true);
    const [filters, opts] = svc.list.mock.calls[0];
    expect(filters.tenantId).toBe('T1');
    expect(filters.status).toBe('scheduled');
    expect(filters.inspectionType).toBe('physical');
    expect(filters['authority.type']).toBe('SOIVRE');
    expect(filters.assignedTo).toBe('u9');
    expect(opts.page).toBe(2);
    expect(opts.limit).toBe(5);
    expect(opts.sortOrder).toBe('desc');
  });

  test('sin tenant en el token no añade tenantId al filtro', async () => {
    svc.list.mockResolvedValue({ items: [] });
    const res = mockRes();
    await ctrl.list(req({ user: { id: 'u1' } }), res);
    const [filters] = svc.list.mock.calls[0];
    expect(filters.tenantId).toBeUndefined();
  });

  test('500 si el service lanza', async () => {
    svc.list.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await ctrl.list(req(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('db down');
  });
});

// ==================== getById ====================
describe('getById', () => {
  test('éxito', async () => {
    svc.getById.mockResolvedValue({ _id: 'i1' });
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'i1' } }), res);
    expect(res.body.data._id).toBe('i1');
  });

  test('404 si el service devuelve null', async () => {
    svc.getById.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'i1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('500 si lanza', async () => {
    svc.getById.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'i1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== create ====================
describe('create', () => {
  test('201 con el userId del token', async () => {
    svc.create.mockResolvedValue({ _id: 'i1' });
    const res = mockRes();
    await ctrl.create(req({ body: { inspectionType: 'physical' } }), res);
    expect(res.statusCode).toBe(201);
    const [body, userId] = svc.create.mock.calls[0];
    expect(body.inspectionType).toBe('physical');
    expect(userId).toBe('u1');
  });

  test('500 si lanza', async () => {
    svc.create.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.create(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== confirm (validación 400) ====================
describe('confirm', () => {
  test('400 sin confirmationNumber', async () => {
    const res = mockRes();
    await ctrl.confirm(req({ params: { id: 'i1' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/confirmaci/i);
  });

  test('éxito pasa el número y userId', async () => {
    svc.confirm.mockResolvedValue({ ok: true });
    const res = mockRes();
    await ctrl.confirm(req({ params: { id: 'i1' }, body: { confirmationNumber: 'CN9' } }), res);
    expect(svc.confirm).toHaveBeenCalledWith('i1', 'CN9', 'u1');
  });

  test('500 si lanza', async () => {
    svc.confirm.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.confirm(req({ params: { id: 'i1' }, body: { confirmationNumber: 'CN9' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== cancel (validación 400) ====================
describe('cancel', () => {
  test('400 sin reason', async () => {
    const res = mockRes();
    await ctrl.cancel(req({ params: { id: 'i1' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/motivo/i);
  });

  test('éxito', async () => {
    svc.cancel.mockResolvedValue({ ok: true });
    const res = mockRes();
    await ctrl.cancel(req({ params: { id: 'i1' }, body: { reason: 'duplicada' } }), res);
    expect(svc.cancel).toHaveBeenCalledWith('i1', 'duplicada', 'u1');
  });

  test('500 si lanza', async () => {
    svc.cancel.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.cancel(req({ params: { id: 'i1' }, body: { reason: 'r' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== reschedule (validación 400 + separa reason del resto) ====================
describe('reschedule', () => {
  test('400 sin reason', async () => {
    const res = mockRes();
    await ctrl.reschedule(req({ params: { id: 'i1' }, body: { scheduledDate: '2026-01-01' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('separa reason del resto del scheduling', async () => {
    svc.reschedule.mockResolvedValue({ ok: true });
    const res = mockRes();
    await ctrl.reschedule(req({
      params: { id: 'i1' },
      body: { reason: 'lluvia', scheduledDate: '2026-01-01', slot: 'AM' }
    }), res);
    const [id, scheduling, reason, userId] = svc.reschedule.mock.calls[0];
    expect(id).toBe('i1');
    expect(scheduling).toEqual({ scheduledDate: '2026-01-01', slot: 'AM' });
    expect(reason).toBe('lluvia');
    expect(userId).toBe('u1');
  });

  test('500 si lanza', async () => {
    svc.reschedule.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.reschedule(req({ params: { id: 'i1' }, body: { reason: 'r' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== getCalendar (validación 400 + Date parsing) ====================
describe('getCalendar', () => {
  test('400 sin startDate/endDate', async () => {
    const res = mockRes();
    await ctrl.getCalendar(req({ query: { startDate: '2026-01-01' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito pasa Dates', async () => {
    svc.getCalendar.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getCalendar(req({ query: { startDate: '2026-01-01', endDate: '2026-01-31' } }), res);
    const [d1, d2] = svc.getCalendar.mock.calls[0];
    expect(d1).toBeInstanceOf(Date);
    expect(d2).toBeInstanceOf(Date);
  });

  test('500 si lanza', async () => {
    svc.getCalendar.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getCalendar(req({ query: { startDate: '2026-01-01', endDate: '2026-01-31' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== getPending / getDashboard (query.userId || token) ====================
describe('getPending / getDashboard: fallback de userId', () => {
  test('getPending usa query.userId si viene', async () => {
    svc.getPending.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getPending(req({ query: { userId: 'qUser' } }), res);
    expect(svc.getPending).toHaveBeenCalledWith('qUser');
  });

  test('getPending cae al id del token', async () => {
    svc.getPending.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getPending(req({ query: {} }), res);
    expect(svc.getPending).toHaveBeenCalledWith('u1');
  });

  test('getDashboard usa query.userId si viene', async () => {
    svc.getDashboard.mockResolvedValue({});
    const res = mockRes();
    await ctrl.getDashboard(req({ query: { userId: 'qUser' } }), res);
    expect(svc.getDashboard).toHaveBeenCalledWith('qUser');
  });

  test('getPending 500 si lanza', async () => {
    svc.getPending.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getPending(req(), res);
    expect(res.statusCode).toBe(500);
  });

  test('getDashboard 500 si lanza', async () => {
    svc.getDashboard.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getDashboard(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== getStats (filtros opcionales) ====================
describe('getStats', () => {
  test('arma filtros de la query', async () => {
    svc.getStats.mockResolvedValue({ total: 3 });
    const res = mockRes();
    await ctrl.getStats(req({ query: { inspectionType: 'physical', assignedTo: 'u9' } }), res);
    const [filters] = svc.getStats.mock.calls[0];
    expect(filters).toEqual({ inspectionType: 'physical', assignedTo: 'u9' });
  });

  test('sin filtros pasa objeto vacío', async () => {
    svc.getStats.mockResolvedValue({});
    const res = mockRes();
    await ctrl.getStats(req({ query: {} }), res);
    expect(svc.getStats.mock.calls[0][0]).toEqual({});
  });

  test('500 si lanza', async () => {
    svc.getStats.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== handlers que delegan directo (éxito + 500) ====================
describe('handlers async que delegan directo', () => {
  const casos = [
    ['schedule', 'schedule', { params: { id: 'i1' }, body: { d: 1 } }],
    ['start', 'start', { params: { id: 'i1' } }],
    ['complete', 'complete', { params: { id: 'i1' }, body: {} }],
    ['addParticipant', 'addParticipant', { params: { id: 'i1' }, body: {} }],
    ['addEvidence', 'addEvidence', { params: { id: 'i1' }, body: {} }],
    ['addItem', 'addInspectedItem', { params: { id: 'i1' }, body: {} }],
    ['registerFinding', 'registerFinding', { params: { id: 'i1' }, body: {} }],
    ['addSample', 'addSample', { params: { id: 'i1' }, body: {} }],
    ['updateSampleResult', 'updateSampleResult', { params: { id: 'i1', sampleId: 's1' }, body: {} }],
    ['generateReport', 'generateReport', { params: { id: 'i1' }, body: {} }],
    ['addAction', 'addResultingAction', { params: { id: 'i1' }, body: {} }],
    ['getToday', 'getToday', {}]
  ];

  test.each(casos)('%s: éxito', async (handler, svcFn, args) => {
    svc[svcFn].mockResolvedValue({ ok: true });
    const res = mockRes();
    await ctrl[handler](req(args), res);
    expect(res.body.success).toBe(true);
  });

  test.each(casos)('%s: 500 si lanza', async (handler, svcFn, args) => {
    svc[svcFn].mockRejectedValue(new Error('fallo'));
    const res = mockRes();
    await ctrl[handler](req(args), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== handlers síncronos (catálogos) ====================
describe('handlers síncronos', () => {
  const casos = [
    ['getTypes', 'getInspectionTypes', {}],
    ['getLocations', 'getLocations', {}],
    ['getResults', 'getInspectionResults', {}],
    ['getChecklist', 'getInspectionChecklist', { params: { type: 'physical' } }],
    ['getInfo', 'getInfo', {}]
  ];

  test.each(casos)('%s: éxito', async (handler, svcFn, args) => {
    svc[svcFn].mockReturnValue(['dato']);
    const res = mockRes();
    await ctrl[handler](req(args), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(['dato']);
  });

  test.each(casos)('%s: 500 si lanza', async (handler, svcFn, args) => {
    svc[svcFn].mockImplementation(() => { throw new Error('boom'); });
    const res = mockRes();
    await ctrl[handler](req(args), res);
    expect(res.statusCode).toBe(500);
  });

  test('getChecklist pasa el type de params', async () => {
    svc.getInspectionChecklist.mockReturnValue([]);
    const res = mockRes();
    await ctrl.getChecklist(req({ params: { type: 'documentary' } }), res);
    expect(svc.getInspectionChecklist).toHaveBeenCalledWith('documentary');
  });
});
