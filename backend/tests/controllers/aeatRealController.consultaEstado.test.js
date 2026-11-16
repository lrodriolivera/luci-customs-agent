/**
 * Rutas de consulta de estado (GET /declarations/:mrn/status) y de refresco
 * del seguimiento (POST /monitoring/:mrn/refresh): ya no piden alias de
 * certificado (las consultas van con el de LUCI) y una consulta fallida
 * responde con un código HTTP coherente, no 200 con el error dentro de `data`.
 */
const request = require('supertest');
const express = require('express');

const mockAeatRealService = { queryDeclarationStatus: jest.fn() };
const mockStatusMonitor = { refreshDeclarationStatus: jest.fn(), getTrackedDeclaration: jest.fn() };
const mockExpedicionExiste = jest.fn();
const mockH7Existe = jest.fn();
jest.mock('../../src/models', () => ({
  Expedition: { exists: (...a) => mockExpedicionExiste(...a) },
  H7Declaration: { exists: (...a) => mockH7Existe(...a) }
}));
jest.mock('../../src/services/aeat', () => ({
  certificateService: {},
  xadesSignatureService: {},
  aeatRealService: mockAeatRealService,
  aeatStatusMonitorService: mockStatusMonitor
}));
jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const aeatRealController = require('../../src/controllers/aeatRealController');

const USER = { _id: 'u1', tenantId: 'tenant-1', role: 'user' };
const MRN = '26ES0028013001BLP3';

function app(handler, metodo, ruta, user = USER) {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => { req.user = user; next(); }, handler);
  return a;
}
const estado = (mrn, query = {}, user = USER) => request(app(aeatRealController.getDeclarationStatus, 'get', '/r/:mrn', user)).get(`/r/${mrn}`).query(query);
const refrescar = (mrn, body = {}) => request(app(aeatRealController.refreshDeclarationStatus, 'post', '/r/:mrn/refresh')).post(`/r/${mrn}/refresh`).send(body);

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto el MRN está en el seguimiento del tenant del usuario.
  mockStatusMonitor.getTrackedDeclaration.mockResolvedValue({ mrn: MRN });
  mockExpedicionExiste.mockResolvedValue(null);
  mockH7Existe.mockResolvedValue(null);
});

describe('GET /declarations/:mrn/status', () => {
  test('sin alias de certificado: consulta con el tipo y el tenant del usuario', async () => {
    mockAeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'ACCEPTED', channel: 'yellow', rawResponse: '<x/>' });

    const res = await estado(MRN, { declarationType: 'H1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ACCEPTED', channel: 'yellow' } });
    expect(res.body.data).not.toHaveProperty('rawResponse');
    expect(mockAeatRealService.queryDeclarationStatus).toHaveBeenCalledWith(MRN, 'H1', { tenantId: 'tenant-1' });
  });

  test('404 si el MRN no es del tenant (ni en su seguimiento, ni en un expediente, ni en un H7 suyo), sin consultar', async () => {
    mockStatusMonitor.getTrackedDeclaration.mockResolvedValue(undefined);
    const res = await estado(MRN, { declarationType: 'H1' });
    expect(res.status).toBe(404);
    expect(mockStatusMonitor.getTrackedDeclaration).toHaveBeenCalledWith(MRN, 'tenant-1');
    expect(mockExpedicionExiste).toHaveBeenCalledWith({ tenantId: 'tenant-1', 'declaration.mrn': MRN });
    expect(mockH7Existe).toHaveBeenCalledWith({ tenantId: 'tenant-1', mrn: MRN });
    expect(mockAeatRealService.queryDeclarationStatus).not.toHaveBeenCalled();
  });

  test('se permite si el MRN está en un expediente o en un H7 del tenant', async () => {
    mockStatusMonitor.getTrackedDeclaration.mockResolvedValue(undefined);
    mockAeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'PENDING' });
    mockExpedicionExiste.mockResolvedValueOnce({ _id: 'e1' });
    expect((await estado(MRN)).status).toBe(200);
    mockH7Existe.mockResolvedValueOnce({ _id: 'h1' });
    expect((await estado(MRN, { declarationType: 'H7' })).status).toBe(200);
  });

  test('usuario sin tenant: 404; super admin de plataforma sin tenant: sin acotar', async () => {
    mockStatusMonitor.getTrackedDeclaration.mockResolvedValue(undefined);
    mockAeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'PENDING' });
    expect((await estado(MRN, {}, { _id: 'u2', role: 'user' })).status).toBe(404);
    expect((await estado(MRN, {}, { _id: 'u3', role: 'super_admin' })).status).toBe(200);
  });

  test('H1 por defecto y el tipo se normaliza', async () => {
    mockAeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'PENDING' });
    await estado(MRN);
    expect(mockAeatRealService.queryDeclarationStatus).toHaveBeenLastCalledWith(MRN, 'H1', { tenantId: 'tenant-1' });
    await estado(MRN, { declarationType: 'h7' });
    expect(mockAeatRealService.queryDeclarationStatus).toHaveBeenLastCalledWith(MRN, 'H7', { tenantId: 'tenant-1' });
  });

  test('400 con un MRN mal formado o un tipo desconocido, sin consultar', async () => {
    expect((await estado('26ES123')).status).toBe(400);
    const tipo = await estado(MRN, { declarationType: 'DUA' });
    expect(tipo.status).toBe(400);
    expect(tipo.body.error).toMatch(/tipo/i);
    expect(mockAeatRealService.queryDeclarationStatus).not.toHaveBeenCalled();
  });

  test.each([
    ['no_disponible', 501],
    ['peticion', 422],
    ['error_funcional', 422],
    ['error_xml', 502],
    ['fault', 502],
    ['red', 502],
    ['desconocida', 502],
    [undefined, 502]
  ])('consulta fallida (%s) -> HTTP %i con success:false y el error arriba', async (tipo, http) => {
    mockAeatRealService.queryDeclarationStatus.mockResolvedValue({ success: false, tipo, error: 'motivo', rawResponse: '<x/>', errores: [{ codigo: '1' }] });

    const res = await estado(MRN, { declarationType: 'AES' });

    expect(res.status).toBe(http);
    expect(res.body).toMatchObject({ success: false, error: 'motivo', tipo: tipo || null, data: { errores: [{ codigo: '1' }] } });
    expect(res.body.data).not.toHaveProperty('rawResponse');
  });

  test('500 si el servicio lanza', async () => {
    mockAeatRealService.queryDeclarationStatus.mockRejectedValue(new Error('boom'));
    const res = await estado(MRN);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /monitoring/:mrn/refresh', () => {
  test('sin alias de certificado: refresca con el tenant del usuario', async () => {
    mockStatusMonitor.refreshDeclarationStatus.mockResolvedValue({ success: true, mrn: MRN, tracking: { currentStatus: 'RELEASED' } });

    const res = await refrescar(MRN);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { tracking: { currentStatus: 'RELEASED' } } });
    expect(mockStatusMonitor.refreshDeclarationStatus).toHaveBeenCalledWith(MRN, 'tenant-1');
  });

  test('404 si no está en seguimiento', async () => {
    mockStatusMonitor.refreshDeclarationStatus.mockResolvedValue({ success: false, tipo: 'no_encontrada', error: 'Declaración no encontrada en seguimiento' });
    const res = await refrescar(MRN);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Declaración no encontrada en seguimiento' });
  });

  test('consulta fallida en la AEAT -> 502 con success:false', async () => {
    mockStatusMonitor.refreshDeclarationStatus.mockResolvedValue({ success: false, tipo: 'red', error: 'socket hang up' });
    const res = await refrescar(MRN);
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ success: false, error: 'socket hang up', tipo: 'red' });
  });

  test('ENS: 501, consulta no disponible', async () => {
    mockStatusMonitor.refreshDeclarationStatus.mockResolvedValue({ success: false, tipo: 'no_disponible', error: 'Consulta no disponible: …' });
    expect((await refrescar(MRN)).status).toBe(501);
  });

  test('400 con un MRN mal formado', async () => {
    expect((await refrescar('X1')).status).toBe(400);
    expect(mockStatusMonitor.refreshDeclarationStatus).not.toHaveBeenCalled();
  });
});
