/**
 * summaryQueryController — API de consultas ADDS-JDIT de la AEAT (por B/L, AWB,
 * contenedor, ubicación, MRN, EORI, documentos), más historial/stats/servicios.
 *
 * Wrapper sobre services/summaryQueryService. Lo propio que se ejercita: la
 * validación 400 de cada consulta (falta la referencia obligatoria), el
 * passthrough del resultado del service, el mapeo a 400 de container/EORI
 * cuando el service responde {success:false, error}, el 404 de getQuery, y el
 * catch → 500. Además que cada handler pasa el userId del token y el
 * certificateAlias/IP/UA como opciones. El service se mockea (frontera: habla
 * con la AEAT; su lógica vive en tests/services/).
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/summaryQueryService');

const svc = require('../../src/services/summaryQueryService');
const ctrl = require('../../src/controllers/summaryQueryController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = ({ body = {}, query = {}, params = {}, user = { _id: 'u1' } } = {}) => ({
  body, query, params, user,
  ip: '10.0.0.1',
  get: () => 'jest-agent'
});

beforeEach(() => {
  Object.keys(svc).forEach((k) => {
    if (typeof svc[k] === 'function') svc[k].mockResolvedValue({ success: true, data: [] });
  });
});

// Consultas con validación 400 (campo obligatorio) + passthrough + 500.
describe('consultas con campo obligatorio', () => {
  const casos = [
    ['queryByBillOfLading', 'queryByBillOfLading', 'reference'],
    ['queryByAWB', 'queryByAWB', 'awbNumber'],
    ['queryByContainer', 'queryByContainer', 'containerNumber'],
    ['queryByLocation', 'queryByLocation', 'locationCode'],
    ['queryByMRN', 'queryByMRN', 'mrn'],
    ['queryByEORI', 'queryByEORI', 'eori']
  ];

  test.each(casos)('%s: 400 si falta el campo obligatorio', async (handler, _svcFn, campo) => {
    const res = mockRes();
    await ctrl[handler](req({ body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/obligatori/i);
  });

  test.each(casos)('%s: éxito pasa userId y opciones', async (handler, svcFn, campo) => {
    svc[svcFn].mockResolvedValue({ success: true, data: ['ok'] });
    const res = mockRes();
    await ctrl[handler](req({ body: { [campo]: 'REF1', certificateAlias: 'FNMT' } }), res);
    expect(res.body.success).toBe(true);
    const [primerArg, userId, opts] = svc[svcFn].mock.calls[0];
    expect(primerArg).toBe('REF1');
    expect(userId).toBe('u1');
    expect(opts.certificateAlias).toBe('FNMT');
    expect(opts.sourceIP).toBe('10.0.0.1');
    expect(opts.userAgent).toBe('jest-agent');
  });

  test.each(casos)('%s: 500 si el service lanza', async (handler, svcFn, campo) => {
    svc[svcFn].mockRejectedValue(new Error('aeat down'));
    const res = mockRes();
    await ctrl[handler](req({ body: { [campo]: 'REF1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('container y EORI: mapeo a 400 del error de negocio', () => {
  test('queryByContainer 400 si el service responde {success:false, error}', async () => {
    svc.queryByContainer.mockResolvedValue({ success: false, error: 'contenedor inválido' });
    const res = mockRes();
    await ctrl.queryByContainer(req({ body: { containerNumber: 'MSKU1' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('contenedor inválido');
  });

  test('queryByEORI 400 si el service responde {success:false, error}', async () => {
    svc.queryByEORI.mockResolvedValue({ success: false, error: 'EORI no válido' });
    const res = mockRes();
    await ctrl.queryByEORI(req({ body: { eori: 'ESB1' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('queryByContainer 200 si success:false SIN error (no mapea a 400)', async () => {
    svc.queryByContainer.mockResolvedValue({ success: false });
    const res = mockRes();
    await ctrl.queryByContainer(req({ body: { containerNumber: 'MSKU1' } }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('queryDocuments', () => {
  test('400 si faltan reference y mrn', async () => {
    const res = mockRes();
    await ctrl.queryDocuments(req({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('usa reference si viene', async () => {
    svc.queryAssociatedDocuments.mockResolvedValue({ success: true });
    const res = mockRes();
    await ctrl.queryDocuments(req({ body: { reference: 'R1' } }), res);
    expect(svc.queryAssociatedDocuments).toHaveBeenCalledWith('R1', 'u1', expect.objectContaining({ mrn: undefined }));
  });

  test('cae a mrn si no hay reference', async () => {
    svc.queryAssociatedDocuments.mockResolvedValue({ success: true });
    const res = mockRes();
    await ctrl.queryDocuments(req({ body: { mrn: 'MRN9' } }), res);
    expect(svc.queryAssociatedDocuments).toHaveBeenCalledWith('MRN9', 'u1', expect.objectContaining({ mrn: 'MRN9' }));
  });

  test('500 si lanza', async () => {
    svc.queryAssociatedDocuments.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.queryDocuments(req({ body: { reference: 'R1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getHistory', () => {
  test('éxito parsea page/limit y devuelve data + pagination', async () => {
    svc.getQueryHistory.mockResolvedValue({ queries: [{ id: 1 }], pagination: { total: 1 } });
    const res = mockRes();
    await ctrl.getHistory(req({ query: { page: '2', limit: '10', queryType: 'MRN' } }), res);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
    const [userId, opts] = svc.getQueryHistory.mock.calls[0];
    expect(userId).toBe('u1');
    expect(opts.page).toBe(2);
    expect(opts.limit).toBe(10);
  });

  test('500 si lanza', async () => {
    svc.getQueryHistory.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getHistory(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getQuery', () => {
  test('404 si el service responde success:false', async () => {
    svc.getQueryById.mockResolvedValue({ success: false, message: 'no existe' });
    const res = mockRes();
    await ctrl.getQuery(req({ params: { id: 'q1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('éxito', async () => {
    svc.getQueryById.mockResolvedValue({ success: true, data: { id: 'q1' } });
    const res = mockRes();
    await ctrl.getQuery(req({ params: { id: 'q1' } }), res);
    expect(res.body.data.id).toBe('q1');
    expect(svc.getQueryById).toHaveBeenCalledWith('q1', 'u1');
  });

  test('500 si lanza', async () => {
    svc.getQueryById.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getQuery(req({ params: { id: 'q1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getStats', () => {
  test('éxito', async () => {
    svc.getQueryStats.mockResolvedValue({ total: 7 });
    const res = mockRes();
    await ctrl.getStats(req({ query: { startDate: '2026-01-01' } }), res);
    expect(res.body.data.total).toBe(7);
    expect(svc.getQueryStats).toHaveBeenCalledWith('u1', { startDate: '2026-01-01' });
  });

  test('500 si lanza', async () => {
    svc.getQueryStats.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getServices', () => {
  test('éxito (síncrono)', async () => {
    svc.getAvailableServices.mockReturnValue([{ code: 'BL' }]);
    const res = mockRes();
    await ctrl.getServices(req(), res);
    expect(res.body.data[0].code).toBe('BL');
  });

  test('500 si lanza', async () => {
    svc.getAvailableServices.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.getServices(req(), res);
    expect(res.statusCode).toBe(500);
  });
});
