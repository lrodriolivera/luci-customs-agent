/**
 * Tests para aeatRealController (estaba al 0%).
 *
 * Es la puerta desde la UI a los servicios reales de AEAT: gestiona el
 * certificado FNMT de firma y dispara los envios de declaraciones. Los tests se
 * centran en las guardas previas —que no se llame a AEAT ni se toque el
 * certificado sin validar antes— y en que la contraseña del .p12, que viaja en
 * el body, no acabe en la respuesta ni en el log.
 */

const request = require('supertest');
const express = require('express');

const mockCertService = {
  importCertificate: jest.fn(),
  listCertificates: jest.fn(),
  deleteCertificate: jest.fn()
};
const mockAeatReal = { validateBeforeSubmit: jest.fn(), submitDeclaration: jest.fn() };
const mockExpedition = { findById: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock('../../src/services/aeat', () => ({
  certificateService: mockCertService,
  xadesSignatureService: { sign: jest.fn(), verify: jest.fn() },
  aeatRealService: mockAeatReal,
  aeatStatusMonitorService: { track: jest.fn() }
}), { virtual: true });
jest.mock('../../src/models', () => ({ Expedition: mockExpedition }));
jest.mock('../../src/config/logger', () => mockLogger);
jest.mock('../../src/services/aiService', () => ({ askLuci: undefined }));

const aeatRealController = require('../../src/controllers/aeatRealController');

const USER = { _id: 'u1', email: 'tester@strixai.es', tenantId: 't1' };
const PASSWORD_P12 = 'AbadiaSuperSecreta2026';

function app(handler, metodo = 'post', ruta = '/r') {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); }, handler);
  return a;
}

describe('aeatRealController.importCertificate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCertService.importCertificate.mockResolvedValue({
      alias: 'FNMT-STRIX', type: 'FNMT_PJ', subject: { CN: 'STRIX AI' },
      validFrom: '2025-10-14', validTo: '2027-10-14', daysUntilExpiry: 438
    });
  });

  test('400 si falta el certificado o la contraseña', async () => {
    const res = await request(app(aeatRealController.importCertificate))
      .post('/r').send({ certificateBase64: 'AAA' });

    expect(res.status).toBe(400);
    expect(mockCertService.importCertificate).not.toHaveBeenCalled();
  });

  test('decodifica el base64 antes de pasarlo al servicio', async () => {
    const p12 = Buffer.from('contenido-p12').toString('base64');

    await request(app(aeatRealController.importCertificate))
      .post('/r').send({ certificateBase64: p12, password: PASSWORD_P12 });

    const [buffer, pass] = mockCertService.importCertificate.mock.calls[0];
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('contenido-p12');
    expect(pass).toBe(PASSWORD_P12);
  });

  test('la contraseña del .p12 no aparece en la respuesta', async () => {
    const res = await request(app(aeatRealController.importCertificate))
      .post('/r').send({ certificateBase64: 'QUFB', password: PASSWORD_P12 });

    expect(JSON.stringify(res.body)).not.toContain(PASSWORD_P12);
  });

  test('la contraseña tampoco se escribe en el log', async () => {
    // El log de importacion incluye alias y usuario; la password nunca.
    await request(app(aeatRealController.importCertificate))
      .post('/r').send({ certificateBase64: 'QUFB', password: PASSWORD_P12 });

    const loguedo = JSON.stringify(mockLogger.info.mock.calls) + JSON.stringify(mockLogger.error.mock.calls);
    expect(loguedo).not.toContain(PASSWORD_P12);
  });

  test('un fallo del servicio no expone la contraseña', async () => {
    mockCertService.importCertificate.mockRejectedValue(new Error('Contraseña incorrecta'));

    const res = await request(app(aeatRealController.importCertificate))
      .post('/r').send({ certificateBase64: 'QUFB', password: PASSWORD_P12 });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD_P12);
  });

  test('usa FNMT_PJ como tipo por defecto', async () => {
    await request(app(aeatRealController.importCertificate))
      .post('/r').send({ certificateBase64: 'QUFB', password: PASSWORD_P12 });

    const [, , opciones] = mockCertService.importCertificate.mock.calls[0];
    expect(opciones.type).toBe('FNMT_PJ');
  });
});

describe('aeatRealController.submitH1Declaration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAeatReal.validateBeforeSubmit.mockResolvedValue({ valid: true, errors: [] });
  });

  test('400 sin expediente o sin certificado, y sin llamar a AEAT', async () => {
    const res = await request(app(aeatRealController.submitH1Declaration))
      .post('/r').send({ expeditionId: 'e1' }); // falta certificateAlias

    expect(res.status).toBe(400);
    expect(mockExpedition.findById).not.toHaveBeenCalled();
  });

  test('404 si el expediente es de otro tenant', async () => {
    // Presentar ante AEAT en nombre de otro cliente seria lo mas grave que
    // podria hacerse desde aqui.
    mockExpedition.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ _id: 'e1', tenantId: 't2', declaration: { xmlContent: '<x/>' } })
    });

    const res = await request(app(aeatRealController.submitH1Declaration))
      .post('/r').send({ expeditionId: 'e1', certificateAlias: 'FNMT-STRIX' });

    expect(res.status).toBe(404);
    expect(mockAeatReal.validateBeforeSubmit).not.toHaveBeenCalled();
  });

  test('400 si el expediente no tiene XML generado', async () => {
    mockExpedition.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ _id: 'e1', tenantId: 't1', declaration: {} })
    });

    const res = await request(app(aeatRealController.submitH1Declaration))
      .post('/r').send({ expeditionId: 'e1', certificateAlias: 'FNMT-STRIX' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/declaración generada/i);
    expect(mockAeatReal.validateBeforeSubmit).not.toHaveBeenCalled();
  });
});
