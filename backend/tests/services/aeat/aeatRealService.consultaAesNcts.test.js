/**
 * queryDeclarationStatus para AES y NCTS: consulta oficial (CCAESC/CCTRAC)
 * por el transporte mTLS de los envíos, sin XAdES ni certificado del almacén.
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

const FIX = path.join(__dirname, '../../fixtures/aeat-consultas');
const leer = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const TENANT = { _id: 't1', companyName: 'STRIX AI', customsConfig: { eoriNumbers: { ES: 'ESB22477020' } } };

beforeEach(() => {
  jest.clearAllMocks();
  mockFindById.mockReturnValue({ lean: () => Promise.resolve(TENANT) });
});

describe('queryDeclarationStatus AES', () => {
  test('envía CCAESC por mTLS al endpoint oficial y devuelve estado y canal para el monitor', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aes/respuesta-ok.xml') });

    const r = await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'AES', 'cert-x', 'pw', { tenantId: 't1' });

    expect(aeatTransport.sendSoap).toHaveBeenCalledTimes(1);
    const [xml, endpoint] = aeatTransport.sendSoap.mock.calls[0];
    expect(endpoint).toBe('/wlpl/ADEX-JDIT/ws/aes/CCAESCV1SOAP');
    expect(xml).toContain('<c:CCAESCV1Ent ');
    expect(xml).toContain('<c:messageSender>B22477020</c:messageSender>');
    expect(xml).toContain('<c:MRN>26ES002801100321B8</c:MRN>');
    expect(mockFindById).toHaveBeenCalledWith('t1');

    expect(r).toMatchObject({
      success: true, declarationType: 'AES', status: 'RELEASED', channel: 'green',
      estado: 'DS', circuito: 'V', csv: 'VTURE98JFHDK65CX', mrn: '26ES002801100321B8'
    });
    expect(r.luciAnalysis.status).toBe('RELEASED');
    expect(Array.isArray(r.messages)).toBe(true);

    // Nada del camino antiguo: ni certificado del almacén, ni XAdES, ni axios directo.
    expect(certificateService.validateCertificateForOperation).not.toHaveBeenCalled();
    expect(xadesSignatureService.signForAEAT).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('un EX de la AEAT vuelve como fallo con el texto del error', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aes/respuesta-ex.xml') });
    const r = await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'AES', null, null, { tenantId: 't1' });
    expect(r.success).toBe(false);
    expect(r.declarationType).toBe('AES');
    expect(r.tipo).toBe('error_xml');
    expect(r.error).toContain('103');
    expect(r.luciAnalysis).toBeDefined();
  });

  test('acepta el remitente explícito sin buscar el tenant', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aes/respuesta-ok.xml') });
    await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'AES', null, null, { sender: 'ESB22477020' });
    expect(mockFindById).not.toHaveBeenCalled();
    expect(aeatTransport.sendSoap.mock.calls[0][0]).toContain('<c:messageSender>B22477020</c:messageSender>');
  });

  test('sin tenant ni remitente no se envía nada', async () => {
    const r = await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'AES', 'cert', 'pw');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/tenant|remitente/i);
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });

  test('tenant sin EORI configurado: 422 de identificación, sin envío', async () => {
    mockFindById.mockReturnValue({ lean: () => Promise.resolve({ _id: 't1', companyName: 'X' }) });
    const r = await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'AES', null, null, { tenantId: 't1' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('EORI');
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });

  test('MRN mal formado: fallo sin envío', async () => {
    const r = await aeatRealService.queryDeclarationStatus('123', 'AES', null, null, { sender: 'B22477020' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('MRN');
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });

  test('el tipo se normaliza y un nombre heredado de Object no se toma por servicio', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aes/respuesta-ok.xml') });
    const r = await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'aes', null, null, { sender: 'B22477020' });
    expect(r).toMatchObject({ success: true, declarationType: 'AES' });
    const raro = await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'constructor', null, null, {});
    expect(raro.success).toBe(false);
    expect(raro.error).toContain('no soportado');
  });

  test('si la AEAT contesta con otro MRN, la consulta falla', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('aes/respuesta-ok.xml') });
    const r = await aeatRealService.queryDeclarationStatus('26ES002801100999X1', 'AES', null, null, { sender: 'B22477020' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('otro MRN');
  });

  test('un fallo de red se devuelve como error, no se lanza', async () => {
    aeatTransport.sendSoap.mockRejectedValue(new Error('socket hang up'));
    const r = await aeatRealService.queryDeclarationStatus('26ES002801100321B8', 'AES', null, null, { sender: 'B22477020' });
    expect(r).toMatchObject({ success: false, declarationType: 'AES', error: 'socket hang up' });
  });
});

describe('queryDeclarationStatus NCTS', () => {
  test('envía CCTRAC al endpoint oficial e interpreta la respuesta real', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('ncts/respuesta-ok.xml') });
    const r = await aeatRealService.queryDeclarationStatus('26ES002801501441J7', 'NCTS', null, null, { tenant: TENANT });
    const [xml, endpoint] = aeatTransport.sendSoap.mock.calls[0];
    expect(endpoint).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CCTRACV2SOAP');
    expect(xml).toContain('<c:CCTRAC>');
    expect(xml).toContain('<c:messageRecipient>NTA.ES</c:messageRecipient>');
    expect(mockFindById).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      success: true, declarationType: 'NCTS', status: 'RELEASED', channel: 'green', estado: 'DE', csv: 'BLQPJ8N8YFWG6ZJJ'
    });
    expect(r.fechas.limiteLlegada).toBe('2026-11-22');
  });

  test('un EX de NCTS vuelve como fallo', async () => {
    aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: leer('ncts/respuesta-ex.xml') });
    const r = await aeatRealService.queryDeclarationStatus('26ES002801501441J7', 'NCTS', null, null, { tenant: TENANT });
    expect(r).toMatchObject({ success: false, tipo: 'error_xml', declarationType: 'NCTS' });
  });
});
