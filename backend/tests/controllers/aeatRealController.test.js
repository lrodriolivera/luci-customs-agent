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
  deleteCertificate: jest.fn(),
  verifyCertificateStatus: jest.fn(),
  validateCertificateForOperation: jest.fn(),
  analyzeCertificateWithLuci: jest.fn()
};

const mockXadesService = {
  signForAEAT: jest.fn(),
  verifyAEATResponse: jest.fn()
};

const mockAeatReal = {
  validateBeforeSubmit: jest.fn(),
  submitDeclaration: jest.fn()
};

const mockStatusMonitor = {
  trackDeclaration: jest.fn(),
  listTrackedDeclarations: jest.fn(),
  refreshDeclarationStatus: jest.fn(),
  getActiveAlerts: jest.fn(),
  acknowledgeAlert: jest.fn(),
  predictInspectionChannel: jest.fn()
};

const mockExpedition = { findById: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock('../../src/services/aeat', () => ({
  certificateService: mockCertService,
  xadesSignatureService: mockXadesService,
  aeatRealService: mockAeatReal,
  aeatStatusMonitorService: mockStatusMonitor
}), { virtual: false });

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

describe('aeatRealController.importCertificate con LUCI', () => {
  const mockAiServiceConLuci = { askLuci: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mockear aiService con askLuci como función
    jest.doMock('../../src/services/aiService', () => mockAiServiceConLuci);
    mockCertService.importCertificate.mockResolvedValue({
      alias: 'FNMT-STRIX', type: 'FNMT_PJ', subject: { CN: 'STRIX AI' },
      validFrom: '2025-10-14', validTo: '2027-10-14', daysUntilExpiry: 438
    });
    mockAiServiceConLuci.askLuci.mockResolvedValue('El certificado es válido y tiene buena cobertura temporal.');
  });

  test('incluye análisis de LUCI cuando askLuci está disponible (líneas 54-66)', async () => {
    // Recargar el controller para que use el mock actualizado
    jest.resetModules();
    jest.doMock('../../src/services/aiService', () => mockAiServiceConLuci);
    const controller = require('../../src/controllers/aeatRealController');

    const res = await request(app(controller.importCertificate))
      .post('/r').send({ certificateBase64: 'QUFB', password: PASSWORD_P12 });

    expect(res.status).toBe(200);
    expect(res.body.data.luciAnalysis).toBe('El certificado es válido y tiene buena cobertura temporal.');
    expect(mockAiServiceConLuci.askLuci).toHaveBeenCalled();
  });

  test('maneja error de LUCI sin fallar la importación (línea 66)', async () => {
    mockAiServiceConLuci.askLuci.mockRejectedValue(new Error('LUCI no disponible'));

    jest.resetModules();
    jest.doMock('../../src/services/aiService', () => mockAiServiceConLuci);
    const controller = require('../../src/controllers/aeatRealController');

    const res = await request(app(controller.importCertificate))
      .post('/r').send({ certificateBase64: 'QUFB', password: PASSWORD_P12 });

    expect(res.status).toBe(200); // La importación sigue exitosa
    expect(res.body.data.luciAnalysis).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Error en análisis LUCI del certificado:',
      'LUCI no disponible'
    );
  });
});

describe('aeatRealController.listCertificates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCertService.listCertificates.mockResolvedValue({
      certificates: [
        { id: 'c1', metadata: { alias: 'FNMT-1' }, type: 'FNMT_PJ', subject: { CN: 'STRIX AI' }, status: 'active', daysToExpiry: 100 },
        { id: 'c2', metadata: { alias: 'FNMT-2' }, type: 'FNMT_PF', subject: 'Jenifer Romero', status: 'expired', daysToExpiry: -10 }
      ]
    });
  });

  test('filtra certificados expirados por defecto', async () => {
    const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
      .get('/r');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].alias).toBe('FNMT-1');
  });

  test('incluye expirados si includeExpired=true', async () => {
    const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
      .get('/r').query({ includeExpired: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('normaliza subject a string cuando es objeto', async () => {
    const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
      .get('/r').query({ includeExpired: 'true' });

    expect(res.body.data[0].subject).toBe('STRIX AI');
    expect(res.body.data[0].subjectDetails.CN).toBe('STRIX AI');
    expect(res.body.data[1].subject).toBe('Jenifer Romero');
  });

  test('500 si el servicio lanza', async () => {
    mockCertService.listCertificates.mockRejectedValue(new Error('Keystore corrupto'));

    const res = await request(app(aeatRealController.listCertificates, 'get', '/r'))
      .get('/r');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Keystore corrupto');
  });
});

describe('aeatRealController.getCertificateInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCertService.listCertificates.mockResolvedValue({
      certificates: [
        { id: 'c1', metadata: { alias: 'FNMT-STRIX' }, validTo: '2027-10-14' }
      ]
    });
    mockCertService.analyzeCertificateWithLuci.mockResolvedValue({ message: 'Válido' });
  });

  test('404 si el alias no existe', async () => {
    const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
      .get('/r/INEXISTENTE');

    expect(res.status).toBe(404);
    expect(mockCertService.analyzeCertificateWithLuci).not.toHaveBeenCalled();
  });

  test('camino feliz: devuelve certificado y análisis LUCI', async () => {
    const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
      .get('/r/FNMT-STRIX');

    expect(res.status).toBe(200);
    expect(res.body.data.certificate.metadata.alias).toBe('FNMT-STRIX');
    expect(res.body.data.analysis.message).toBe('Válido');
  });

  test('500 si analyzeCertificateWithLuci lanza', async () => {
    mockCertService.analyzeCertificateWithLuci.mockRejectedValue(new Error('LUCI offline'));

    const res = await request(app(aeatRealController.getCertificateInfo, 'get', '/r/:alias'))
      .get('/r/FNMT-STRIX');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('LUCI offline');
  });
});

describe('aeatRealController.verifyCertificate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCertService.verifyCertificateStatus.mockResolvedValue({ valid: true, revoked: false });
  });

  test('camino feliz: verifica estado del certificado', async () => {
    const res = await request(app(aeatRealController.verifyCertificate, 'get', '/r/:alias/verify'))
      .get('/r/FNMT-STRIX/verify');

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(mockCertService.verifyCertificateStatus).toHaveBeenCalledWith('FNMT-STRIX');
  });

  test('500 si el servicio lanza', async () => {
    mockCertService.verifyCertificateStatus.mockRejectedValue(new Error('OCSP no responde'));

    const res = await request(app(aeatRealController.verifyCertificate, 'get', '/r/:alias/verify'))
      .get('/r/FNMT-STRIX/verify');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('OCSP no responde');
  });
});

describe('aeatRealController.deleteCertificate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCertService.deleteCertificate.mockResolvedValue();
  });

  test('camino feliz: elimina certificado', async () => {
    const res = await request(app(aeatRealController.deleteCertificate, 'delete', '/r/:alias'))
      .delete('/r/FNMT-STRIX');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/eliminado/i);
    expect(mockCertService.deleteCertificate).toHaveBeenCalledWith('FNMT-STRIX');
  });

  test('500 si el servicio lanza', async () => {
    mockCertService.deleteCertificate.mockRejectedValue(new Error('Certificado en uso'));

    const res = await request(app(aeatRealController.deleteCertificate, 'delete', '/r/:alias'))
      .delete('/r/FNMT-STRIX');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Certificado en uso');
  });
});

describe('aeatRealController.validateCertificateForOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCertService.validateCertificateForOperation.mockResolvedValue({ valid: true });
  });

  test('400 sin certificateAlias u operationType', async () => {
    const res = await request(app(aeatRealController.validateCertificateForOperation))
      .post('/r').send({ certificateAlias: 'FNMT-STRIX' });

    expect(res.status).toBe(400);
    expect(mockCertService.validateCertificateForOperation).not.toHaveBeenCalled();
  });

  test('camino feliz: valida certificado para operación', async () => {
    const res = await request(app(aeatRealController.validateCertificateForOperation))
      .post('/r').send({
        certificateAlias: 'FNMT-STRIX',
        operationType: 'import',
        declarationType: 'H1'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(mockCertService.validateCertificateForOperation).toHaveBeenCalledWith(
      'FNMT-STRIX',
      'import',
      'H1'
    );
  });

  test('500 si el servicio lanza', async () => {
    mockCertService.validateCertificateForOperation.mockRejectedValue(new Error('Validación falló'));

    const res = await request(app(aeatRealController.validateCertificateForOperation))
      .post('/r').send({
        certificateAlias: 'FNMT-STRIX',
        operationType: 'import'
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Validación falló');
  });
});

describe('aeatRealController.signDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockXadesService.signForAEAT.mockResolvedValue({ signedXml: '<Signed>...</Signed>' });
  });

  test('400 sin xmlContent o certificateAlias', async () => {
    const res = await request(app(aeatRealController.signDocument))
      .post('/r').send({ xmlContent: '<H1/>' });

    expect(res.status).toBe(400);
    expect(mockXadesService.signForAEAT).not.toHaveBeenCalled();
  });

  test('camino feliz: firma documento con serviceType por defecto', async () => {
    const res = await request(app(aeatRealController.signDocument))
      .post('/r').send({
        xmlContent: '<H1>...</H1>',
        certificateAlias: 'FNMT-STRIX'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.signedXml).toContain('Signed');
    expect(mockXadesService.signForAEAT).toHaveBeenCalledWith(
      '<H1>...</H1>',
      'FNMT-STRIX',
      'H1_SUBMIT'
    );
  });

  test('500 si el servicio lanza', async () => {
    mockXadesService.signForAEAT.mockRejectedValue(new Error('Clave privada no encontrada'));

    const res = await request(app(aeatRealController.signDocument))
      .post('/r').send({
        xmlContent: '<H1/>',
        certificateAlias: 'FNMT-STRIX'
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Clave privada');
  });
});

describe('aeatRealController.verifySignature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockXadesService.verifyAEATResponse.mockResolvedValue({ valid: true });
  });

  test('400 sin signedXml', async () => {
    const res = await request(app(aeatRealController.verifySignature))
      .post('/r').send({});

    expect(res.status).toBe(400);
    expect(mockXadesService.verifyAEATResponse).not.toHaveBeenCalled();
  });

  test('camino feliz: verifica firma de respuesta AEAT', async () => {
    const res = await request(app(aeatRealController.verifySignature))
      .post('/r').send({ signedXml: '<Signed>...</Signed>' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
  });

  test('500 si el servicio lanza', async () => {
    mockXadesService.verifyAEATResponse.mockRejectedValue(new Error('Firma inválida'));

    const res = await request(app(aeatRealController.verifySignature))
      .post('/r').send({ signedXml: '<Signed/>' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Firma inválida');
  });
});

describe('aeatRealController.getTrackedDeclarations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusMonitor.listTrackedDeclarations.mockResolvedValue([
      { mrn: '26ES123', status: 'submitted' }
    ]);
  });

  test('camino feliz: lista declaraciones monitoreadas', async () => {
    const res = await request(app(aeatRealController.getTrackedDeclarations, 'get', '/r'))
      .get('/r');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mrn).toBe('26ES123');
  });

  test('500 si el monitor lanza', async () => {
    mockStatusMonitor.listTrackedDeclarations.mockRejectedValue(new Error('DB offline'));

    const res = await request(app(aeatRealController.getTrackedDeclarations, 'get', '/r'))
      .get('/r');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('DB offline');
  });
});

describe('aeatRealController.getActiveAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusMonitor.getActiveAlerts.mockResolvedValue([
      { id: 'a1', severity: 'high', message: 'Inspección física' }
    ]);
  });

  test('camino feliz: filtra por severity y unacknowledgedOnly', async () => {
    const res = await request(app(aeatRealController.getActiveAlerts, 'get', '/r'))
      .get('/r').query({ severity: 'high', unacknowledgedOnly: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockStatusMonitor.getActiveAlerts).toHaveBeenCalledWith({
      severity: 'high',
      unacknowledgedOnly: true
    });
  });

  test('500 si el monitor lanza', async () => {
    mockStatusMonitor.getActiveAlerts.mockRejectedValue(new Error('Alertas no accesibles'));

    const res = await request(app(aeatRealController.getActiveAlerts, 'get', '/r'))
      .get('/r');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Alertas no accesibles');
  });
});

describe('aeatRealController.acknowledgeAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusMonitor.acknowledgeAlert.mockReturnValue();
  });

  test('camino feliz: confirma alerta con userId', async () => {
    const res = await request(app(aeatRealController.acknowledgeAlert, 'post', '/r/:alertId/ack'))
      .post('/r/alert123/ack');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/confirmada/i);
    expect(mockStatusMonitor.acknowledgeAlert).toHaveBeenCalledWith('alert123', USER._id);
  });

  test('500 si el monitor lanza', async () => {
    mockStatusMonitor.acknowledgeAlert.mockImplementation(() => {
      throw new Error('Alerta no encontrada');
    });

    const res = await request(app(aeatRealController.acknowledgeAlert, 'post', '/r/:alertId/ack'))
      .post('/r/alert999/ack');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Alerta no encontrada');
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
