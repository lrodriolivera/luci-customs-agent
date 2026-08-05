/**
 * inspectorCommunicationController — comunicaciones con inspectores/autoridades
 * (alegaciones, recursos de reposición, reclamaciones económico-administrativas).
 *
 * Wrapper puro sobre services/inspectorCommunicationService (única dependencia
 * junto al logger). Se mockea el service (frontera) y se ejercita lo PROPIO del
 * controller: validaciones 400 (markDelivered/updateStatus/generateDraft/
 * calculateDeadline), 404 de getById, construcción de filtros (list/getStats),
 * fallbacks query.userId||token (getPending/getDashboard), la aritmética de
 * daysRemaining en calculateDeadline (rama deadline?…:null), los catálogos
 * síncronos y el catch → 500.
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/inspectorCommunicationService');

const svc = require('../../src/services/inspectorCommunicationService');
const ctrl = require('../../src/controllers/inspectorCommunicationController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = ({ body = {}, query = {}, params = {}, user = { id: 'u1', _id: 'u1' } } = {}) =>
  ({ body, query, params, user });

const ASYNC_FNS = [
  'list', 'getById', 'create', 'createAllegation', 'createAdministrativeAppeal',
  'createEconomicAppeal', 'addMessage', 'addArgument', 'approve', 'submit',
  'markDelivered', 'receiveResponse', 'resolve', 'updateStatus', 'archive',
  'getPending', 'getAppeals', 'getOverdue', 'getDashboard', 'getStats'
];
const SYNC_FNS = [
  'generateDraft', 'calculateAppealDeadline', 'isWithinDeadline',
  'getCommunicationTypes', 'getAuthorities', 'getTemplates', 'getInfo'
];

beforeEach(() => {
  ASYNC_FNS.forEach((k) => { if (svc[k]) svc[k].mockResolvedValue({ ok: true }); });
  SYNC_FNS.forEach((k) => { if (svc[k]) svc[k].mockReturnValue(['x']); });
});

// ==================== list ====================
describe('list', () => {
  test('arma filtros de la query y parsea page/limit', async () => {
    svc.list.mockResolvedValue({ items: [] });
    const res = mockRes();
    await ctrl.list(req({
      query: { page: '3', limit: '7', status: 'draft', communicationType: 'allegation', category: 'appeal', authorityType: 'AEAT', assignedTo: 'u9' }
    }), res);
    const [filters, opts] = svc.list.mock.calls[0];
    expect(filters.status).toBe('draft');
    expect(filters.communicationType).toBe('allegation');
    expect(filters.category).toBe('appeal');
    expect(filters['authority.type']).toBe('AEAT');
    expect(filters.assignedTo).toBe('u9');
    expect(opts.page).toBe(3);
    expect(opts.limit).toBe(7);
  });

  test('sin filtros pasa objeto vacío', async () => {
    svc.list.mockResolvedValue({});
    const res = mockRes();
    await ctrl.list(req({ query: {} }), res);
    expect(svc.list.mock.calls[0][0]).toEqual({});
  });

  test('500 si lanza', async () => {
    svc.list.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.list(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== getById ====================
describe('getById', () => {
  test('éxito', async () => {
    svc.getById.mockResolvedValue({ _id: 'c1' });
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'c1' } }), res);
    expect(res.body.data._id).toBe('c1');
  });

  test('404 si null', async () => {
    svc.getById.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'c1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('500 si lanza', async () => {
    svc.getById.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getById(req({ params: { id: 'c1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== creates (201) ====================
describe('handlers de creación (201)', () => {
  const casos = [
    ['create', 'create'],
    ['createAllegation', 'createAllegation'],
    ['createAdministrativeAppeal', 'createAdministrativeAppeal'],
    ['createEconomicAppeal', 'createEconomicAppeal']
  ];

  test.each(casos)('%s: 201 con userId del token', async (handler, svcFn) => {
    svc[svcFn].mockResolvedValue({ _id: 'c1' });
    const res = mockRes();
    await ctrl[handler](req({ body: { subject: 's' } }), res);
    expect(res.statusCode).toBe(201);
    const [body, userId] = svc[svcFn].mock.calls[0];
    expect(body.subject).toBe('s');
    expect(userId).toBe('u1');
  });

  test.each(casos)('%s: 500 si lanza', async (handler, svcFn) => {
    svc[svcFn].mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl[handler](req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== markDelivered (validación 400) ====================
describe('markDelivered', () => {
  test('400 sin confirmationNumber', async () => {
    const res = mockRes();
    await ctrl.markDelivered(req({ params: { id: 'c1' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito pasa el número y userId', async () => {
    svc.markDelivered.mockResolvedValue({ ok: true });
    const res = mockRes();
    await ctrl.markDelivered(req({ params: { id: 'c1' }, body: { confirmationNumber: 'CN1' } }), res);
    expect(svc.markDelivered).toHaveBeenCalledWith('c1', 'CN1', 'u1');
  });

  test('500 si lanza', async () => {
    svc.markDelivered.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.markDelivered(req({ params: { id: 'c1' }, body: { confirmationNumber: 'CN1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== updateStatus (validación 400) ====================
describe('updateStatus', () => {
  test('400 sin status', async () => {
    const res = mockRes();
    await ctrl.updateStatus(req({ params: { id: 'c1' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito pasa status, notes y userId', async () => {
    svc.updateStatus.mockResolvedValue({ ok: true });
    const res = mockRes();
    await ctrl.updateStatus(req({ params: { id: 'c1' }, body: { status: 'submitted', notes: 'n' } }), res);
    expect(svc.updateStatus).toHaveBeenCalledWith('c1', 'submitted', 'n', 'u1');
  });

  test('500 si lanza', async () => {
    svc.updateStatus.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.updateStatus(req({ params: { id: 'c1' }, body: { status: 'submitted' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== generateDraft (validación 400 + separa type) ====================
describe('generateDraft', () => {
  test('400 sin communicationType', async () => {
    const res = mockRes();
    await ctrl.generateDraft(req({ body: { foo: 1 } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('separa communicationType del resto de data', async () => {
    svc.generateDraft.mockReturnValue({ draft: true });
    const res = mockRes();
    await ctrl.generateDraft(req({ body: { communicationType: 'allegation', subject: 's', ref: 'R1' } }), res);
    const [type, data] = svc.generateDraft.mock.calls[0];
    expect(type).toBe('allegation');
    expect(data).toEqual({ subject: 's', ref: 'R1' });
  });

  test('500 si lanza', async () => {
    svc.generateDraft.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.generateDraft(req({ body: { communicationType: 'allegation' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== calculateDeadline (validación 400 + aritmética) ====================
describe('calculateDeadline', () => {
  test('400 sin notificationDate o communicationType', async () => {
    const res = mockRes();
    await ctrl.calculateDeadline(req({ body: { notificationDate: '2026-01-01' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('calcula daysRemaining con deadline futura', async () => {
    const futuro = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    svc.calculateAppealDeadline.mockReturnValue(futuro);
    svc.isWithinDeadline.mockReturnValue(true);
    const res = mockRes();
    await ctrl.calculateDeadline(req({ body: { notificationDate: '2026-01-01', communicationType: 'administrative_appeal' } }), res);
    expect(res.body.data.isWithinDeadline).toBe(true);
    expect(res.body.data.deadline).toBe(futuro);
    expect(res.body.data.daysRemaining).toBeGreaterThan(0);
    const [d, type] = svc.calculateAppealDeadline.mock.calls[0];
    expect(d).toBeInstanceOf(Date);
    expect(type).toBe('administrative_appeal');
  });

  test('daysRemaining es null si no hay deadline (rama deadline?…:null)', async () => {
    svc.calculateAppealDeadline.mockReturnValue(null);
    svc.isWithinDeadline.mockReturnValue(false);
    const res = mockRes();
    await ctrl.calculateDeadline(req({ body: { notificationDate: '2026-01-01', communicationType: 'allegation' } }), res);
    expect(res.body.data.daysRemaining).toBeNull();
  });

  test('500 si lanza', async () => {
    svc.calculateAppealDeadline.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.calculateDeadline(req({ body: { notificationDate: '2026-01-01', communicationType: 'allegation' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== getPending / getDashboard (query.userId || token) ====================
describe('getPending / getDashboard: fallback userId', () => {
  test('getPending usa query.userId', async () => {
    svc.getPending.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getPending(req({ query: { userId: 'qU' } }), res);
    expect(svc.getPending).toHaveBeenCalledWith('qU');
  });

  test('getPending cae al token', async () => {
    svc.getPending.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getPending(req({ query: {} }), res);
    expect(svc.getPending).toHaveBeenCalledWith('u1');
  });

  test('getDashboard usa query.userId', async () => {
    svc.getDashboard.mockResolvedValue({});
    const res = mockRes();
    await ctrl.getDashboard(req({ query: { userId: 'qU' } }), res);
    expect(svc.getDashboard).toHaveBeenCalledWith('qU');
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

// ==================== getAppeals / getStats ====================
describe('getAppeals', () => {
  test('pasa el status de la query', async () => {
    svc.getAppeals.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getAppeals(req({ query: { status: 'pending' } }), res);
    expect(svc.getAppeals).toHaveBeenCalledWith('pending');
  });

  test('500 si lanza', async () => {
    svc.getAppeals.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getAppeals(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getStats', () => {
  test('arma filtros de la query', async () => {
    svc.getStats.mockResolvedValue({ total: 2 });
    const res = mockRes();
    await ctrl.getStats(req({ query: { category: 'appeal', assignedTo: 'u9' } }), res);
    expect(svc.getStats.mock.calls[0][0]).toEqual({ category: 'appeal', assignedTo: 'u9' });
  });

  test('500 si lanza', async () => {
    svc.getStats.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== handlers async que delegan directo ====================
describe('handlers async que delegan directo', () => {
  const casos = [
    ['addMessage', 'addMessage', { params: { id: 'c1' }, body: {} }],
    ['addArgument', 'addArgument', { params: { id: 'c1' }, body: {} }],
    ['approve', 'approve', { params: { id: 'c1' } }],
    ['submit', 'submit', { params: { id: 'c1' } }],
    ['receiveResponse', 'receiveResponse', { params: { id: 'c1' }, body: {} }],
    ['resolve', 'resolve', { params: { id: 'c1' }, body: {} }],
    ['archive', 'archive', { params: { id: 'c1' } }],
    ['getOverdue', 'getOverdue', {}]
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

// ==================== catálogos síncronos ====================
describe('catálogos síncronos', () => {
  const casos = [
    ['getTypes', 'getCommunicationTypes'],
    ['getAuthorities', 'getAuthorities'],
    ['getTemplates', 'getTemplates'],
    ['getInfo', 'getInfo']
  ];

  test.each(casos)('%s: éxito', async (handler, svcFn) => {
    svc[svcFn].mockReturnValue(['dato']);
    const res = mockRes();
    await ctrl[handler](req(), res);
    expect(res.body.data).toEqual(['dato']);
  });

  test.each(casos)('%s: 500 si lanza', async (handler, svcFn) => {
    svc[svcFn].mockImplementation(() => { throw new Error('boom'); });
    const res = mockRes();
    await ctrl[handler](req(), res);
    expect(res.statusCode).toBe(500);
  });
});
