/**
 * queryDeclarationStatus para H1 (ConsultaImportacionV3), H7 (ConsultaH7V1) y
 * ENS (sin consulta disponible): servicios oficiales por el transporte mTLS de
 * los envíos, sin XAdES, sin certificado del almacén y sin el XML inventado
 * <aeat:ConsultaDeclaracion>.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/aeat/aeatTransport', () => ({ sendSoap: jest.fn() }));
jest.mock('../../../src/services/aeat/certificateService', () => ({ validateCertificateForOperation: jest.fn() }));
jest.mock('../../../src/services/aeat/xadesSignatureService', () => ({ signForAEAT: jest.fn() }));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
const mockFindById = jest.fn();
jest.mock('../../../src/models/Tenant', () => ({ findById: (...a) => mockFindById(...a) }));

const fs = require('fs');
const path = require('path');
const aeatTransport = require('../../../src/services/aeat/aeatTransport');
const certificateService = require('../../../src/services/aeat/certificateService');
const xadesSignatureService = require('../../../src/services/aeat/xadesSignatureService');
const axios = require('axios');
const aeatRealService = require('../../../src/services/aeat/aeatRealService');

const leer = (...p) => fs.readFileSync(path.join(__dirname, '../../fixtures', ...p), 'utf8');
const H1_REAL = leer('aeat-cau', 'consulta-respuesta-real-009999.xml');
const MRN_H1 = '26ES009999I0026SR0';
const MRN_H7 = '26ESH7A000072339R8';

function sinCaminoAntiguo() {
  expect(certificateService.validateCertificateForOperation).not.toHaveBeenCalled();
  expect(xadesSignatureService.signForAEAT).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
}

const entornoOriginal = process.env.AEAT_ENVIRONMENT;
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.AEAT_ENVIRONMENT;
});
afterAll(() => {
  if (entornoOriginal === undefined) delete process.env.AEAT_ENVIRONMENT;
  else process.env.AEAT_ENVIRONMENT = entornoOriginal;
});

describe('queryDeclarationStatus H1', () => {
  test('envía ConsultaImportacionV3 al endpoint oficial y normaliza estado, circuito y fechas', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: H1_REAL });

    const r = await aeatRealService.queryDeclarationStatus(MRN_H1, 'H1', { tenantId: 't1' });

    expect(aeatTransport.sendSoap).toHaveBeenCalledTimes(1);
    const [xml, endpoint] = aeatTransport.sendSoap.mock.calls[0];
    expect(endpoint).toBe('/wlpl/ADIP-JDIT/ws/cci/ConsultaImportacionV3SOAP');
    expect(xml).toContain('<es:ConsultaImportacionV3Ent ');
    expect(xml).toContain(`<ConsultaCompleta><MRN>${MRN_H1}</MRN></ConsultaCompleta>`);
    expect(xml).toMatch(/<messageIdentification>LUCIQ\d{19}<\/messageIdentification>/);
    // La consulta H1 no lleva remitente: no hace falta buscar el tenant.
    expect(mockFindById).not.toHaveBeenCalled();

    expect(r).toMatchObject({
      success: true, declarationType: 'H1', mrn: MRN_H1, estado: '64', status: 'ACCEPTED',
      channel: 'yellow', circuito: 'A', final: false
    });
    expect(r.luciAnalysis.status).toBe('ACCEPTED');
    sinCaminoAntiguo();
  });

  test('un rechazo funcional (CC456A) vuelve como fallo con su tipo', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: '<e:Envelope xmlns:e="http://schemas.xmlsoap.org/soap/envelope/"><e:Body><es:ConsultaImportacionV3Sal xmlns:es="urn:x"><CC456A><FunctionalError><errorReason>21151</errorReason><remarks>No encontrada</remarks></FunctionalError></CC456A></es:ConsultaImportacionV3Sal></e:Body></e:Envelope>' });
    const r = await aeatRealService.queryDeclarationStatus(MRN_H1, 'h1');
    expect(r).toMatchObject({ success: false, tipo: 'error_funcional', declarationType: 'H1', httpStatus: 200 });
    expect(r.error).toContain('21151');
    expect(r.luciAnalysis).toBeDefined();
  });

  test('MRN mal formado: fallo de petición, sin envío', async () => {
    const r = await aeatRealService.queryDeclarationStatus('123', 'H1');
    expect(r).toMatchObject({ success: false, tipo: 'peticion' });
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });

  test('fallo de red: tipo red, no lanza', async () => {
    aeatTransport.sendSoap.mockRejectedValue(new Error('ECONNRESET'));
    await expect(aeatRealService.queryDeclarationStatus(MRN_H1, 'H1')).resolves.toMatchObject({ success: false, tipo: 'red', error: 'La AEAT no respondió a la consulta' });
  });
});

describe('queryDeclarationStatus H7', () => {
  test('envía ConsultaH7V1 (modo pruebas fuera de producción) e interpreta la situación', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aeat-consultas', 'h7', 'respuesta-ok-levante.xml') });

    const r = await aeatRealService.queryDeclarationStatus(MRN_H7, 'H7', { tenantId: 't1' });

    const [xml, endpoint] = aeatTransport.sendSoap.mock.calls[0];
    expect(endpoint).toBe('/wlpl/ADIP-JDIT/ws/ConsultaH7V1SOAP');
    expect(xml).toContain(`<MRN_H7>${MRN_H7}</MRN_H7>`);
    expect(xml).toContain('<testIndicator>S</testIndicator>');
    expect(mockFindById).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      success: true, declarationType: 'H7', estado: 'LE', status: 'RELEASED', channel: 'green', final: false, csv: 'H7LEV9K2M4N6P8QR'
    });
    sinCaminoAntiguo();
  });

  test('en producción la consulta va como envío real (testIndicator N)', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aeat-consultas', 'h7', 'respuesta-ok-levante.xml') });
    await aeatRealService.queryDeclarationStatus(MRN_H7, 'H7');
    expect(aeatTransport.sendSoap.mock.calls[0][0]).toContain('<testIndicator>N</testIndicator>');
  });

  test('un rechazo (R) vuelve como fallo funcional', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aeat-consultas', 'h7', 'respuesta-rechazo.xml') });
    const r = await aeatRealService.queryDeclarationStatus(MRN_H7, 'H7');
    expect(r).toMatchObject({ success: false, tipo: 'error_funcional', declarationType: 'H7' });
  });

  test('respuesta HTML (p. ej. 404 de un servicio inexistente): fallo desconocido', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 404, data: '<html><body>Not Found</body></html>' });
    const r = await aeatRealService.queryDeclarationStatus(MRN_H7, 'H7');
    expect(r).toMatchObject({ success: false, tipo: 'desconocida', httpStatus: 404 });
  });
});

describe('queryDeclarationStatus ENS', () => {
  test('consulta no disponible (ICS2 va por el STI de la UE): no se envía nada', async () => {
    const r = await aeatRealService.queryDeclarationStatus('26ES0028010000001A', 'ENS', { tenantId: 't1' });
    expect(r).toMatchObject({ success: false, tipo: 'no_disponible', declarationType: 'ENS' });
    expect(r.error).toMatch(/^Consulta no disponible: .*STI/);
    expect(r.fuente).toMatch(/^https:\/\/sede\.agenciatributaria\.gob\.es\//);
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
    sinCaminoAntiguo();
  });

  test('queryENSStatus da el mismo resultado', async () => {
    const r = await aeatRealService.queryENSStatus('26ES0028010000001A');
    expect(r.tipo).toBe('no_disponible');
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });
});

describe('tipos y camino antiguo', () => {
  test('puedeConsultarEstado: H1, H7, AES y NCTS sí; ENS y desconocidos no', () => {
    for (const t of ['H1', 'h7', 'AES', 'NCTS']) expect(aeatRealService.puedeConsultarEstado(t)).toBe(true);
    for (const t of ['ENS', 'X', '', undefined, 'constructor', 'hasOwnProperty']) expect(aeatRealService.puedeConsultarEstado(t)).toBe(false);
  });

  test('tipo no soportado: fallo sin envío', async () => {
    const r = await aeatRealService.queryDeclarationStatus(MRN_H1, 'DUA');
    expect(r).toMatchObject({ success: false, tipo: 'no_soportado' });
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });

  test('ya no existe la petición inventada ni los servicios de consulta inexistentes', () => {
    expect(aeatRealService._buildQueryRequest).toBeUndefined();
    expect(aeatRealService._processQueryResponse).toBeUndefined();
    expect(aeatRealService.SERVICES.ICS2_ENS_QUERY).toBeUndefined();
    expect(aeatRealService.SERVICES.H7_QUERY.path).toBe('/wlpl/ADIP-JDIT/ws/ConsultaH7V1SOAP');
    expect(aeatRealService.SERVICES.H1_QUERY.path).toBe('/wlpl/ADIP-JDIT/ws/cci/ConsultaImportacionV3SOAP');
  });
});
