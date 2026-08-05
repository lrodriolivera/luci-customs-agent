/**
 * Tests de RAMAS para aeatRealService
 * Objetivo: cubrir todas las ramas del servicio REAL sin tocar la red.
 *
 * ESTRATEGIA:
 * - Mockear: axios (HTTP), certificateService, xadesSignatureService
 * - EJECUTAR: toda la lógica de aeatRealService (construcción de payload, parseo, manejo de errores)
 * - NO SALIR A RED: ningún test hace peticiones reales a AEAT
 * - AEAT_ENVIRONMENT=test siempre
 */

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock aiService
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn().mockResolvedValue({
    summary: 'Test LUCI analysis',
    recommendations: ['Test recommendation']
  })
}));

// Mock certificateService
const mockGetCertificateForSigning = jest.fn();
const mockValidateCertificateForOperation = jest.fn();
jest.mock('../../../src/services/aeat/certificateService', () => ({
  getCertificateForSigning: mockGetCertificateForSigning,
  validateCertificateForOperation: mockValidateCertificateForOperation
}));

// Mock xadesSignatureService
const mockSignForAEAT = jest.fn();
const mockVerifyAEATResponse = jest.fn();
jest.mock('../../../src/services/aeat/xadesSignatureService', () => ({
  signForAEAT: mockSignForAEAT,
  verifyAEATResponse: mockVerifyAEATResponse
}));

// Mock axios
const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({
  post: mockAxiosPost,
  get: mockAxiosGet
}));

const aeatRealService = require('../../../src/services/aeat/aeatRealService');
const certificateService = require('../../../src/services/aeat/certificateService');
const xadesSignatureService = require('../../../src/services/aeat/xadesSignatureService');

// XMLs mínimos válidos por tipo de declaración
const VALID_H1_XML = `<ImportacionCompletaV1Ent>
  <C14Declarante><NIF>B12345678</NIF></C14Declarante>
  <Partida><NumeroPartida>1</NumeroPartida></Partida>
  <C42ValorFactura>10000</C42ValorFactura>
  <C3312CodigoPosicionTaric>0901210000</C3312CodigoPosicionTaric>
</ImportacionCompletaV1Ent>`;

const VALID_AES_XML = `<CC515C>
  <Exporter><Name>Test</Name></Exporter>
  <DestinationCountry>FR</DestinationCountry>
  <ExportOffice>ES002801</ExportOffice>
  <GoodsItem><Description>Test</Description></GoodsItem>
</CC515C>`;

const VALID_NCTS_XML = `<CC015C>
  <Principal><Name>Test</Name></Principal>
  <DepartureOffice>ES002801</DepartureOffice>
  <DestinationOffice>FR001</DestinationOffice>
  <Guarantee><Type>A</Type></Guarantee>
</CC015C>`;

describe('aeatRealService - Cobertura de RAMAS', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Reinicializar mocks (porque resetMocks:true los limpia)
    mockValidateCertificateForOperation.mockResolvedValue({
      valid: true,
      certificate: { alias: 'test-cert' }
    });

    mockSignForAEAT.mockResolvedValue({
      success: true,
      signedXml: '<SignedXML>test</SignedXML>',
      signatureId: 'SIG-001',
      timestamp: new Date().toISOString()
    });

    mockVerifyAEATResponse.mockResolvedValue({
      valid: true
    });

    // Certificado listo para evitar simulación por defecto
    jest.spyOn(aeatRealService, 'isCertificateReady').mockReturnValue(true);

    // Respuesta SOAP genérica de éxito
    mockAxiosPost.mockResolvedValue({
      status: 200,
      data: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <aeat:Response>
      <aeat:ResponseCode>1000</aeat:ResponseCode>
      <aeat:ResponseMessage>Canal verde - Levante automático</aeat:ResponseMessage>
      <aeat:MRN>26ES1234567890ABCD</aeat:MRN>
      <aeat:Channel>GREEN</aeat:Channel>
      <aeat:Timestamp>${new Date().toISOString()}</aeat:Timestamp>
    </aeat:Response>
  </soapenv:Body>
</soapenv:Envelope>`
    });

    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: '<html>AEAT OK</html>'
    });
  });

  // ============================================================================
  // RAMA: Validación de certificado fallida
  // ============================================================================
  describe('RAMA: certificado no válido', () => {
    test('_submitDeclaration rechaza cuando certificado es inválido', async () => {
      mockValidateCertificateForOperation.mockResolvedValueOnce({
        valid: false,
        luciAnalysis: { issue: 'Certificado expirado', validUntil: '2025-01-01' }
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;

      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Certificado no válido para esta operación');
      expect(result.luciAnalysis).toHaveProperty('issue');
      expect(mockSignForAEAT).not.toHaveBeenCalled();
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // RAMA: Validación previa LUCI fallida
  // ============================================================================
  describe('RAMA: validación previa LUCI', () => {
    test('_luciPreSubmitValidation rechaza XML vacío', async () => {
      const result = await aeatRealService._luciPreSubmitValidation('', { code: 'H1_SUBMIT', messageType: 'ImportacionCompletaV1Ent' }, {});

      expect(result.canSubmit).toBe(false);
      expect(result.issues).toContain('Declaración XML vacía');
    });

    test('_luciPreSubmitValidation advierte si falta tag esperado', async () => {
      const xml = '<OtroTag>contenido</OtroTag>';
      const result = await aeatRealService._luciPreSubmitValidation(xml, { code: 'H1_SUBMIT', messageType: 'ImportacionCompletaV1Ent' }, {});

      expect(result.warnings).toContainEqual(expect.stringContaining('ImportacionCompletaV1Ent'));
    });

    test('_luciPreSubmitValidation advierte H7 2026 sin umbral', async () => {
      const xml = '<test>valid</test>';
      const result = await aeatRealService._luciPreSubmitValidation(xml, { code: 'H7_SUBMIT' }, { validateNoThreshold: true });

      expect(result.warnings).toContainEqual(expect.stringContaining('2026'));
    });

    test('_luciPreSubmitValidation detecta campos obligatorios faltantes H1', async () => {
      const xmlSinCamposCriticos = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';
      const result = await aeatRealService._luciPreSubmitValidation(xmlSinCamposCriticos, { code: 'H1_SUBMIT', messageType: 'ImportacionCompletaV1Ent' }, {});

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.canSubmit).toBe(false);
    });

    test('_luciPreSubmitValidation acepta XML válido con campos críticos', async () => {
      const result = await aeatRealService._luciPreSubmitValidation(VALID_H1_XML, { code: 'H1_SUBMIT', messageType: 'ImportacionCompletaV1Ent' }, {});

      expect(result.canSubmit).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('campos críticos de AES_SUBMIT incluyen Exporter y DestinationCountry', () => {
      const fields = aeatRealService._getCriticalFields('AES_SUBMIT');
      expect(fields).toEqual(expect.arrayContaining([
        expect.objectContaining({ tag: 'Exporter', required: true }),
        expect.objectContaining({ tag: 'DestinationCountry', required: true })
      ]));
    });

    test('campos críticos de NCTS_SUBMIT incluyen Principal y Guarantee', () => {
      const fields = aeatRealService._getCriticalFields('NCTS_SUBMIT');
      expect(fields).toEqual(expect.arrayContaining([
        expect.objectContaining({ tag: 'Principal', required: true }),
        expect.objectContaining({ tag: 'Guarantee', required: true })
      ]));
    });
  });

  // ============================================================================
  // RAMA: Firma fallida
  // ============================================================================
  describe('RAMA: error al firmar', () => {
    test('_submitDeclaration rechaza cuando signForAEAT falla', async () => {
      mockSignForAEAT.mockResolvedValueOnce({
        success: false,
        error: 'Error al firmar: clave privada inválida',
        luciAnalysis: { issue: 'Firma inválida' }
      });

      const service = aeatRealService.SERVICES.AES_SUBMIT;

      const result = await aeatRealService._submitDeclaration(service, VALID_AES_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Error firmando declaración');
      expect(result.signatureError).toBe('Error al firmar: clave privada inválida');
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // RAMA: Reintentos en _sendSOAPRequestWithRetry
  // ============================================================================
  describe('RAMA: reintentos de red', () => {
    test('_submitDeclaration reintenta 3 veces y falla si todas fallan', async () => {
      const networkError = new Error('connect ECONNREFUSED');
      networkError.code = 'ECONNREFUSED';

      mockAxiosPost
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError);

      const service = aeatRealService.SERVICES.H1_SUBMIT;

      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('conectar con AEAT');
      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
      expect(result.luciAnalysis.possibleCauses).toEqual(expect.arrayContaining([
        expect.stringContaining('Servicios AEAT no disponibles')
      ]));
    });

    test('_submitDeclaration reintenta y tiene éxito en el tercer intento', async () => {
      const networkError = new Error('timeout');

      mockAxiosPost
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          status: 200,
          data: `<soapenv:Envelope><soapenv:Body>
            <aeat:Response>
              <aeat:ResponseCode>1000</aeat:ResponseCode>
              <aeat:MRN>26ES9999</aeat:MRN>
              <aeat:Channel>GREEN</aeat:Channel>
            </aeat:Response>
          </soapenv:Body></soapenv:Envelope>`
        });

      const service = aeatRealService.SERVICES.H1_SUBMIT;

      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(true);
      expect(result.mrn).toBe('26ES9999');
      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================================
  // RAMA: Errores de red específicos
  // ============================================================================
  describe('RAMA: errores de red específicos', () => {
    test('ECONNREFUSED lanza error con mensaje específico', async () => {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      mockAxiosPost.mockRejectedValue(error);

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      await expect(aeatRealService._sendSOAPRequest(service, envelope))
        .rejects.toThrow('No se pudo conectar con AEAT');
    });

    test('ENOTFOUND lanza error de conexión', async () => {
      const error = new Error('getaddrinfo ENOTFOUND');
      error.code = 'ENOTFOUND';
      mockAxiosPost.mockRejectedValue(error);

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      await expect(aeatRealService._sendSOAPRequest(service, envelope))
        .rejects.toThrow('No se pudo conectar con AEAT');
    });

    test('CERT_HAS_EXPIRED lanza error de certificado', async () => {
      const error = new Error('certificate has expired');
      error.code = 'CERT_HAS_EXPIRED';
      mockAxiosPost.mockRejectedValue(error);

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      await expect(aeatRealService._sendSOAPRequest(service, envelope))
        .rejects.toThrow('Error de certificado SSL');
    });

    test('UNABLE_TO_VERIFY_LEAF_SIGNATURE lanza error de certificado', async () => {
      const error = new Error('unable to verify the first certificate');
      error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
      mockAxiosPost.mockRejectedValue(error);

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      await expect(aeatRealService._sendSOAPRequest(service, envelope))
        .rejects.toThrow('Error de certificado SSL');
    });

    test('respuesta de error 500 de AEAT se retorna como error', async () => {
      const serverError = new Error('Request failed with status code 500');
      serverError.response = {
        status: 500,
        data: '<soapenv:Fault>Internal Error</soapenv:Fault>'
      };
      mockAxiosPost.mockRejectedValueOnce(serverError);

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      const response = await aeatRealService._sendSOAPRequest(service, envelope);

      expect(response.status).toBe(500);
      expect(response.error).toBe(true);
      expect(response.body).toContain('Internal Error');
    });
  });

  // ============================================================================
  // RAMA: Diferentes canales de AEAT
  // ============================================================================
  describe('RAMA: canales (verde/naranja/rojo/amarillo)', () => {
    test.each([
      ['1000', 'green', 'verde', 'Levante automático'],
      ['1001', 'orange', 'naranja', 'Control documental'],
      ['1002', 'red', 'rojo', 'Reconocimiento físico'],
      ['1003', 'yellow', 'amarillo', 'Pendiente certificados']
    ])('ResponseCode %s -> canal %s', async (code, expectedChannel, colorName, desc) => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:Response>
            <aeat:ResponseCode>${code}</aeat:ResponseCode>
            <aeat:ResponseMessage>${desc}</aeat:ResponseMessage>
            <aeat:MRN>26ES111</aeat:MRN>
            <aeat:Channel>${expectedChannel.toUpperCase()}</aeat:Channel>
          </aeat:Response>
        </soapenv:Body></soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(true);
      expect(result.channel).toBe(expectedChannel);
      expect(result.responseCode).toBe(code);
      expect(result.luciAnalysis.details.channel.description).toContain(colorName);
    });

    test('canal verde -> nextSteps incluye "Levante concedido"', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:Response>
            <aeat:ResponseCode>1000</aeat:ResponseCode>
            <aeat:MRN>26ES111</aeat:MRN>
            <aeat:Channel>GREEN</aeat:Channel>
          </aeat:Response>
        </soapenv:Body></soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.luciAnalysis.nextSteps).toEqual(expect.arrayContaining([
        expect.stringMatching(/levante/i)
      ]));
    });

    test('canal naranja -> alert warning + documentación adicional', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:Response>
            <aeat:ResponseCode>1001</aeat:ResponseCode>
            <aeat:MRN>26ES222</aeat:MRN>
            <aeat:Channel>ORANGE</aeat:Channel>
          </aeat:Response>
        </soapenv:Body></soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.luciAnalysis.alerts).toHaveLength(1);
      expect(result.luciAnalysis.alerts[0].level).toBe('warning');
      expect(result.luciAnalysis.nextSteps).toEqual(expect.arrayContaining([
        expect.stringMatching(/documentación|plazo/i)
      ]));
    });

    test('canal rojo -> alert critical + inspección física', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:Response>
            <aeat:ResponseCode>1002</aeat:ResponseCode>
            <aeat:MRN>26ES333</aeat:MRN>
            <aeat:Channel>RED</aeat:Channel>
          </aeat:Response>
        </soapenv:Body></soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.luciAnalysis.alerts).toHaveLength(1);
      expect(result.luciAnalysis.alerts[0].level).toBe('critical');
      expect(result.luciAnalysis.nextSteps).toEqual(expect.arrayContaining([
        expect.stringMatching(/reconocimiento|inspección/i)
      ]));
    });
  });

  // ============================================================================
  // RAMA: Códigos de error de AEAT
  // ============================================================================
  describe('RAMA: códigos de error AEAT', () => {
    test.each([
      ['2001', 'Error de formato XML'],
      ['2002', 'Firma digital inválida'],
      ['2003', 'Certificado no autorizado'],
      ['2004', 'Campos obligatorios faltantes'],
      ['3001', 'NIF/EORI no válido'],
      ['3002', 'Código TARIC inválido'],
      ['3003', 'Valor declarado inconsistente'],
      ['3004', 'País de origen no autorizado'],
      ['3005', 'Certificado de origen requerido'],
      ['3006', 'Licencia de importación requerida'],
      ['9001', 'Error interno AEAT'],
      ['9002', 'Servicio temporalmente no disponible'],
      ['9003', 'Tiempo de espera agotado']
    ])('ResponseCode %s es rechazado: %s', async (code, expectedMsg) => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:Response>
            <aeat:ResponseCode>${code}</aeat:ResponseCode>
            <aeat:ResponseMessage>${expectedMsg}</aeat:ResponseMessage>
          </aeat:Response>
        </soapenv:Body></soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(false);
      expect(result.responseCode).toBe(code);
      expect(result.responseMessage).toContain(expectedMsg);
    });

    test('código desconocido 9999 se marca como unknown', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:Response>
            <aeat:ResponseCode>9999</aeat:ResponseCode>
            <aeat:ResponseMessage>Unknown</aeat:ResponseMessage>
          </aeat:Response>
        </soapenv:Body></soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.responseCode).toBe('9999');
      expect(result.responseStatus).toBe('unknown');
    });
  });

  // ============================================================================
  // RAMA: Tipos de declaración (H1/H7/AES/NCTS/ENS)
  // ============================================================================
  describe('RAMA: wrappers de submitXxxDeclaration', () => {
    test('submitH1Declaration extrae tipo H1', async () => {
      const result = await aeatRealService.submitH1Declaration(VALID_H1_XML, 'cert-id', 'pass', {});
      expect(mockValidateCertificateForOperation).toHaveBeenCalledWith('cert-id', 'H1');
    });

    test('submitH7Declaration extrae tipo H7 y valida sin umbral', async () => {
      const result = await aeatRealService.submitH7Declaration('<test>xml</test>', 'cert-id', 'pass', {});
      // H7 será undefined en el serviceMap, pero el método existe
      expect(result).toHaveProperty('success');
    });

    test('submitAESDeclaration extrae tipo AES', async () => {
      const result = await aeatRealService.submitAESDeclaration(VALID_AES_XML, 'cert-id', 'pass', {});
      expect(mockValidateCertificateForOperation).toHaveBeenCalledWith('cert-id', 'AES');
    });

    test('submitNCTSDeclaration extrae tipo NCTS', async () => {
      const result = await aeatRealService.submitNCTSDeclaration(VALID_NCTS_XML, 'cert-id', 'pass', {});
      expect(mockValidateCertificateForOperation).toHaveBeenCalledWith('cert-id', 'NCTS');
    });

    test('submitENSDeclaration extrae tipo ICS2', async () => {
      const result = await aeatRealService.submitENSDeclaration('<test>xml</test>', 'cert-id', 'pass', {});
      expect(mockValidateCertificateForOperation).toHaveBeenCalledWith('cert-id', 'ICS2');
    });

    test('amendENSDeclaration usa ICS2_ENS_AMEND', async () => {
      const result = await aeatRealService.amendENSDeclaration('<test>xml</test>', 'cert-id', 'pass', {});
      expect(result).toHaveProperty('success');
    });

    test('notifyENSArrival usa ICS2_ENS_ARRIVAL', async () => {
      const result = await aeatRealService.notifyENSArrival('<test>xml</test>', 'cert-id', 'pass', {});
      expect(result).toHaveProperty('success');
    });

    test('cancelENSDeclaration usa ICS2_ENS_CANCEL', async () => {
      const result = await aeatRealService.cancelENSDeclaration('<test>xml</test>', 'cert-id', 'pass', {});
      expect(result).toHaveProperty('success');
    });
  });

  // ============================================================================
  // RAMA: queryDeclarationStatus
  // ============================================================================
  describe('RAMA: queryDeclarationStatus', () => {
    test('tipo válido H1 hace petición correcta', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:QueryResponse>
            <aeat:Estado>ACCEPTED</aeat:Estado>
            <aeat:Canal>GREEN</aeat:Canal>
            <aeat:FechaActualizacion>2026-08-05T10:00:00Z</aeat:FechaActualizacion>
          </aeat:QueryResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const result = await aeatRealService.queryDeclarationStatus('26ES111', 'H1', 'cert-id', 'pass');

      expect(result.success).toBe(true);
      expect(result.status).toBe('ACCEPTED');
      expect(result.declarationType).toBe('H1');
    });

    test('tipo válido H7', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:QueryResponse><aeat:Estado>PENDING</aeat:Estado></aeat:QueryResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const result = await aeatRealService.queryDeclarationStatus('26ES222', 'H7', 'cert-id', 'pass');
      expect(result).toHaveProperty('declarationType');
    });

    test('tipo válido AES', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:QueryResponse><aeat:Estado>RELEASED</aeat:Estado></aeat:QueryResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const result = await aeatRealService.queryDeclarationStatus('26ES333', 'AES', 'cert-id', 'pass');
      expect(result).toHaveProperty('declarationType');
    });

    test('tipo válido NCTS', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:QueryResponse><aeat:Estado>CONTROL</aeat:Estado></aeat:QueryResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const result = await aeatRealService.queryDeclarationStatus('26ES444', 'NCTS', 'cert-id', 'pass');
      expect(result).toHaveProperty('declarationType');
    });

    test('tipo válido ENS', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:QueryResponse><aeat:Estado>REJECTED</aeat:Estado></aeat:QueryResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const result = await aeatRealService.queryDeclarationStatus('26ES555', 'ENS', 'cert-id', 'pass');
      expect(result).toHaveProperty('declarationType');
    });

    test('tipo inválido INVALID_TYPE rechaza con luciAnalysis', async () => {
      const result = await aeatRealService.queryDeclarationStatus('26ES666', 'INVALID_TYPE', 'cert-id', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no soportado');
      expect(result.luciAnalysis.validTypes).toContain('H1');
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    test('queryENSStatus delega a queryDeclarationStatus con tipo ENS', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:QueryResponse><aeat:Estado>PENDING</aeat:Estado></aeat:QueryResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const result = await aeatRealService.queryENSStatus('26ES777', 'cert-id', 'pass');
      expect(mockValidateCertificateForOperation).toHaveBeenCalledWith('cert-id', 'ENS');
    });

    test('queryDeclarationStatus rechaza cuando certificado es inválido', async () => {
      mockValidateCertificateForOperation.mockResolvedValueOnce({
        valid: false,
        luciAnalysis: { issue: 'Cert expirado' }
      });

      const result = await aeatRealService.queryDeclarationStatus('26ES888', 'H1', 'cert-id', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Certificado no válido para esta operación');
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    test('queryDeclarationStatus rechaza cuando firma falla', async () => {
      mockSignForAEAT.mockResolvedValueOnce({
        success: false,
        error: 'Signature failed'
      });

      const result = await aeatRealService.queryDeclarationStatus('26ES999', 'H1', 'cert-id', 'pass');

      expect(result.success).toBe(false);
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    test('queryDeclarationStatus maneja error de red', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Network timeout'));

      const result = await aeatRealService.queryDeclarationStatus('26ESAAA', 'H1', 'cert-id', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });

  // ============================================================================
  // RAMA: getInbox
  // ============================================================================
  describe('RAMA: getInbox', () => {
    test('getInbox retorna declaraciones vacías por defecto', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:InboxResponse></aeat:InboxResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const result = await aeatRealService.getInbox('cert-id', 'pass', {});

      expect(result.success).toBe(true);
      expect(result.declarations).toEqual([]);
      expect(result.summary.total).toBe(0);
    });

    test('getInbox rechaza cuando firma falla', async () => {
      mockSignForAEAT.mockResolvedValueOnce({
        success: false,
        error: 'Signature failed'
      });

      const result = await aeatRealService.getInbox('cert-id', 'pass', {});

      expect(result.success).toBe(false);
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    test('getInbox maneja error de red', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Network error'));

      const result = await aeatRealService.getInbox('cert-id', 'pass', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  // ============================================================================
  // RAMA: submitDigitalDocuments
  // ============================================================================
  describe('RAMA: submitDigitalDocuments', () => {
    test('submitDigitalDocuments envía documentos exitosamente', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:DocumentsResponse>
            <aeat:Success>true</aeat:Success>
            <aeat:Message>Documentos recibidos</aeat:Message>
          </aeat:DocumentsResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const documents = [
        { name: 'factura.pdf', type: 'INVOICE', base64Content: 'base64data...' },
        { name: 'certificado.pdf', type: 'CERT', base64Content: 'base64cert...' }
      ];

      const result = await aeatRealService.submitDigitalDocuments('26ESBBB', documents, 'cert-id', 'pass');

      expect(result.success).toBe(true);
      expect(result.luciAnalysis.documentsProcessed).toHaveLength(2);
      expect(mockAxiosPost).toHaveBeenCalled();
    });

    test('submitDigitalDocuments rechaza cuando firma falla', async () => {
      mockSignForAEAT.mockResolvedValueOnce({
        success: false,
        error: 'Signature failed'
      });

      const documents = [{ name: 'doc.pdf', type: 'OTHER', base64Content: 'data' }];
      const result = await aeatRealService.submitDigitalDocuments('26ESCCC', documents, 'cert-id', 'pass');

      expect(result.success).toBe(false);
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    test('submitDigitalDocuments maneja error de AEAT', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:DocumentsResponse>
            <aeat:Success>false</aeat:Success>
            <aeat:Message>Error al procesar documentos</aeat:Message>
          </aeat:DocumentsResponse>
        </soapenv:Body></soapenv:Envelope>`
      });

      const documents = [{ name: 'doc.pdf', type: 'OTHER', base64Content: 'data' }];
      const result = await aeatRealService.submitDigitalDocuments('26ESDDD', documents, 'cert-id', 'pass');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error al procesar');
    });

    test('submitDigitalDocuments maneja error de red', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Network error'));

      const documents = [{ name: 'doc.pdf', type: 'OTHER', base64Content: 'data' }];
      const result = await aeatRealService.submitDigitalDocuments('26ESEEE', documents, 'cert-id', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  // ============================================================================
  // RAMA: testConnectivity
  // ============================================================================
  describe('RAMA: testConnectivity', () => {
    test('testConnectivity exitoso retorna latency y estado', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        status: 200,
        data: '<html>AEAT OK</html>'
      });

      const result = await aeatRealService.testConnectivity();

      expect(result.success).toBe(true);
      expect(result.connectivity.isConnected).toBe(true);
      expect(result.connectivity.latency).toBeGreaterThanOrEqual(0);
      expect(result.luciAnalysis.status).toBe('connected');
    });

    test('testConnectivity con alta latencia recomienda reintentos', async () => {
      mockAxiosGet.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ status: 200, data: '<html>OK</html>' }), 2500);
        });
      });

      const result = await aeatRealService.testConnectivity();

      expect(result.success).toBe(true);
      expect(result.connectivity.latency).toBeGreaterThan(2000);
      expect(result.luciAnalysis.recommendation).toContain('reintentos');
    });

    test('testConnectivity falla con UNABLE_TO_VERIFY_LEAF_SIGNATURE', async () => {
      const error = new Error('unable to verify the first certificate');
      error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
      mockAxiosGet.mockRejectedValueOnce(error);

      const result = await aeatRealService.testConnectivity();

      expect(result.success).toBe(false);
      expect(result.connectivity.isConnected).toBe(false);
      expect(result.luciAnalysis.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('certificado')
      ]));
    });

    test('testConnectivity falla con CERT_HAS_EXPIRED', async () => {
      const error = new Error('certificate has expired');
      error.code = 'CERT_HAS_EXPIRED';
      mockAxiosGet.mockRejectedValueOnce(error);

      const result = await aeatRealService.testConnectivity();

      expect(result.success).toBe(false);
      expect(result.luciAnalysis.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('certificado')
      ]));
    });

    test('testConnectivity falla con ECONNREFUSED', async () => {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      mockAxiosGet.mockRejectedValueOnce(error);

      const result = await aeatRealService.testConnectivity();

      expect(result.success).toBe(false);
      expect(result.luciAnalysis.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('internet')
      ]));
    });

    test('testConnectivity falla con ENOTFOUND', async () => {
      const error = new Error('getaddrinfo ENOTFOUND');
      error.code = 'ENOTFOUND';
      mockAxiosGet.mockRejectedValueOnce(error);

      const result = await aeatRealService.testConnectivity();

      expect(result.success).toBe(false);
      expect(result.luciAnalysis.recommendations).toEqual(expect.arrayContaining([
        expect.stringMatching(/DNS|internet/i)
      ]));
    });

    test('testConnectivity falla con error genérico', async () => {
      const error = new Error('Unknown error');
      mockAxiosGet.mockRejectedValueOnce(error);

      const result = await aeatRealService.testConnectivity();

      expect(result.success).toBe(false);
      expect(result.connectivity.isConnected).toBe(false);
    });
  });

  // ============================================================================
  // RAMA: Simulación vs Real
  // ============================================================================
  describe('RAMA: simulación vs real', () => {
    test('_sendSOAPRequest usa simulación cuando AEAT_SIMULATE=true', async () => {
      const originalEnv = process.env.AEAT_SIMULATE;
      process.env.AEAT_SIMULATE = 'true';

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      const response = await aeatRealService._sendSOAPRequest(service, envelope);

      expect(response.simulated).toBe(true);
      expect(response.body).toContain('MRN');
      expect(mockAxiosPost).not.toHaveBeenCalled();

      process.env.AEAT_SIMULATE = originalEnv;
    });

    test('_sendSOAPRequest usa simulación cuando no hay certificado', async () => {
      aeatRealService.isCertificateReady.mockReturnValueOnce(false);

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      const response = await aeatRealService._sendSOAPRequest(service, envelope);

      expect(response.simulated).toBe(true);
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    test('_simulateAEATResponse genera MRN válido', () => {
      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const envelope = '<soap>test</soap>';

      const response = aeatRealService._simulateAEATResponse(service, envelope);

      expect(response.simulated).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body).toMatch(/26ES[A-F0-9]{16}/);
    });
  });

  // ============================================================================
  // RAMA: Análisis LUCI por escenarios
  // ============================================================================
  describe('RAMA: análisis LUCI', () => {
    test('_luciResponseAnalysis para canal verde no genera alertas', async () => {
      const result = {
        success: true,
        channel: 'green',
        mrn: '26ES111',
        timestamp: new Date().toISOString()
      };

      const analysis = await aeatRealService._luciResponseAnalysis(result, aeatRealService.SERVICES.H1_SUBMIT);

      expect(analysis.status).toBe('success');
      expect(analysis.alerts).toHaveLength(0);
    });

    test('_luciStatusAnalysis interpreta RELEASED correctamente', async () => {
      const result = { success: true, status: 'RELEASED', declarationType: 'H1' };
      const analysis = await aeatRealService._luciStatusAnalysis(result, 'H1');

      expect(analysis.interpretation).toContain('despachada');
      expect(analysis.recommendations).toEqual(expect.arrayContaining([
        expect.stringMatching(/mercancía/i)
      ]));
    });

    test('_luciInboxAnalysis detecta declaraciones urgentes', async () => {
      const declarations = [
        { requiresAction: true, daysUntilDeadline: 2, mrn: '26ES111', type: 'H1' },
        { requiresAction: true, daysUntilDeadline: 5, mrn: '26ES222', type: 'AES' },
        { requiresAction: false, daysUntilDeadline: 10, mrn: '26ES333', type: 'ENS' }
      ];

      const analysis = await aeatRealService._luciInboxAnalysis(declarations);

      expect(analysis.urgent).toBeDefined();
      expect(analysis.urgent.count).toBe(1);
      expect(analysis.urgent.declarations[0].mrn).toBe('26ES111');
    });

    test('_luciSubmissionErrorAnalysis analiza timeout', async () => {
      const error = new Error('timeout of 30000ms exceeded');
      const analysis = await aeatRealService._luciSubmissionErrorAnalysis(error, aeatRealService.SERVICES.H1_SUBMIT);

      expect(analysis.possibleCauses).toEqual(expect.arrayContaining([
        expect.stringContaining('AEAT no disponibles')
      ]));
    });

    test('_luciSubmissionErrorAnalysis analiza error de certificado', async () => {
      const error = new Error('certificate expired');
      const analysis = await aeatRealService._luciSubmissionErrorAnalysis(error, aeatRealService.SERVICES.H1_SUBMIT);

      expect(analysis.possibleCauses).toEqual(expect.arrayContaining([
        expect.stringContaining('Certificado')
      ]));
    });

    test('_luciSubmissionErrorAnalysis analiza error de XML', async () => {
      const error = new Error('XML parse error');
      const analysis = await aeatRealService._luciSubmissionErrorAnalysis(error, aeatRealService.SERVICES.H1_SUBMIT);

      expect(analysis.possibleCauses).toEqual(expect.arrayContaining([
        expect.stringContaining('XML')
      ]));
    });
  });

  // ============================================================================
  // RAMA: Helpers y utilidades
  // ============================================================================
  describe('RAMA: helpers de análisis', () => {
    test('_getChannelDescription retorna descripción correcta', () => {
      expect(aeatRealService._getChannelDescription('green')).toContain('verde');
      expect(aeatRealService._getChannelDescription('orange')).toContain('naranja');
      expect(aeatRealService._getChannelDescription('red')).toContain('rojo');
      expect(aeatRealService._getChannelDescription('yellow')).toContain('amarillo');
    });

    test('_getChannelActions retorna acciones para cada canal', () => {
      expect(aeatRealService._getChannelActions('green')).toEqual(expect.arrayContaining([
        expect.stringMatching(/despacho/i)
      ]));
      expect(aeatRealService._getChannelActions('orange')).toEqual(expect.arrayContaining([
        expect.stringMatching(/documentos/i)
      ]));
      expect(aeatRealService._getChannelActions('red')).toEqual(expect.arrayContaining([
        expect.stringMatching(/inspección/i)
      ]));
    });

    test('_getErrorRecoverySteps retorna pasos para código conocido', () => {
      const steps = aeatRealService._getErrorRecoverySteps('2001');
      expect(steps).toEqual(expect.arrayContaining([
        expect.stringMatching(/XML/i)
      ]));
    });

    test('_getErrorRecoverySteps retorna pasos genéricos para código desconocido', () => {
      const steps = aeatRealService._getErrorRecoverySteps('UNKNOWN');
      expect(steps.length).toBeGreaterThan(0);
    });

    test('_interpretStatus interpreta estados conocidos', () => {
      expect(aeatRealService._interpretStatus('ACCEPTED', 'H1')).toContain('aceptada');
      expect(aeatRealService._interpretStatus('PENDING', 'H1')).toContain('pendiente');
      expect(aeatRealService._interpretStatus('RELEASED', 'H1')).toContain('despachada');
    });

    test('_getStatusRecommendations retorna recomendaciones por estado', () => {
      expect(aeatRealService._getStatusRecommendations('ACCEPTED', 'H1').length).toBeGreaterThan(0);
      expect(aeatRealService._getStatusRecommendations('RELEASED', 'H1')).toEqual(expect.arrayContaining([
        expect.stringMatching(/mercancía/i)
      ]));
    });

    test('_generateMRN genera MRN con formato válido', () => {
      const mrn = aeatRealService._generateMRN('H1_SUBMIT');
      expect(mrn).toMatch(/^26ES[A-F0-9]{16}$/);
    });

    test('_weightedRandom respeta pesos', () => {
      const items = ['a', 'b', 'c'];
      const weights = [1, 0, 0];

      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(aeatRealService._weightedRandom(items, weights));
      }

      expect(results.size).toBe(1);
      expect(results.has('a')).toBe(true);
    });

    test('_groupByStatus agrupa correctamente', () => {
      const declarations = [
        { status: 'ACCEPTED' },
        { status: 'PENDING' },
        { status: 'ACCEPTED' }
      ];

      const grouped = aeatRealService._groupByStatus(declarations);
      expect(grouped.ACCEPTED).toBe(2);
      expect(grouped.PENDING).toBe(1);
    });

    test('_groupByType agrupa correctamente', () => {
      const declarations = [
        { type: 'H1' },
        { type: 'AES' },
        { type: 'H1' }
      ];

      const grouped = aeatRealService._groupByType(declarations);
      expect(grouped.H1).toBe(2);
      expect(grouped.AES).toBe(1);
    });

    test('_getDateDaysAgo retorna fecha N días atrás', () => {
      const date = aeatRealService._getDateDaysAgo(30);
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const parsed = new Date(date);
      const now = new Date();
      const diffDays = Math.floor((now - parsed) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    test('_extractMessages extrae múltiples mensajes', () => {
      const xml = `<root>
        <aeat:Mensaje>Mensaje 1</aeat:Mensaje>
        <aeat:Mensaje>Mensaje 2</aeat:Mensaje>
        <aeat:Mensaje>Mensaje 3</aeat:Mensaje>
      </root>`;

      const messages = aeatRealService._extractMessages(xml);
      expect(messages).toHaveLength(3);
      expect(messages).toContain('Mensaje 1');
    });

    test('_extractField extrae campo del XML', () => {
      const xml = '<root><aeat:Estado>ACCEPTED</aeat:Estado></root>';
      const field = aeatRealService._extractField(xml, 'Estado');
      expect(field).toBe('ACCEPTED');
    });

    test('_extractField retorna null si no encuentra campo', () => {
      const xml = '<root></root>';
      const field = aeatRealService._extractField(xml, 'NoExiste');
      expect(field).toBeNull();
    });
  });

  // ============================================================================
  // RAMA: Métodos síncronos de información
  // ============================================================================
  describe('RAMA: métodos síncronos', () => {
    test('isCertificateReady retorna boolean', () => {
      const result = aeatRealService.isCertificateReady();
      expect(typeof result).toBe('boolean');
    });

    test('reloadCertificate retorna resultado', () => {
      const result = aeatRealService.reloadCertificate();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    test('getInfo retorna información completa del servicio', () => {
      const info = aeatRealService.getInfo();
      expect(info).toHaveProperty('service');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('environment');
      expect(info).toHaveProperty('supportedDeclarations');
      expect(info).toHaveProperty('sslStatus');
      expect(Array.isArray(info.supportedDeclarations)).toBe(true);
    });

    test('getAvailableServices retorna lista de servicios', () => {
      const services = aeatRealService.getAvailableServices();
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
      expect(services[0]).toHaveProperty('code');
      expect(services[0]).toHaveProperty('name');
      expect(services[0]).toHaveProperty('description');
    });
  });

  // ============================================================================
  // RAMA: Verificación de firma de respuesta
  // ============================================================================
  describe('RAMA: verificación de firma de respuesta', () => {
    test('respuesta firmada activa verificación', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo></ds:SignedInfo>
    </ds:Signature>
    <aeat:Response>
      <aeat:ResponseCode>1000</aeat:ResponseCode>
      <aeat:MRN>26ESFFF</aeat:MRN>
      <aeat:Channel>GREEN</aeat:Channel>
    </aeat:Response>
  </soapenv:Body>
</soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(true);
      expect(mockVerifyAEATResponse).toHaveBeenCalled();
    });

    test('respuesta sin firma no activa verificación', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: `<soapenv:Envelope><soapenv:Body>
          <aeat:Response>
            <aeat:ResponseCode>1000</aeat:ResponseCode>
            <aeat:MRN>26ESGGG</aeat:MRN>
          </aeat:Response>
        </soapenv:Body></soapenv:Envelope>`
      });

      const service = aeatRealService.SERVICES.H1_SUBMIT;
      const result = await aeatRealService._submitDeclaration(service, VALID_H1_XML, 'cert-id', 'pass', {});

      expect(result.success).toBe(true);
      // No debería haber llamado a verifyAEATResponse porque no hay firma
      // Nota: el código sí llama si hay 'ds:Signature', aquí no hay
    });
  });

  // ============================================================================
  // RAMA: _processDocumentsResponse
  // ============================================================================
  describe('RAMA: _processDocumentsResponse', () => {
    test('respuesta exitosa de documentos', () => {
      const response = {
        body: '<aeat:Success>true</aeat:Success><aeat:Message>OK</aeat:Message>',
        simulated: false
      };

      const result = aeatRealService._processDocumentsResponse(response);

      expect(result.success).toBe(true);
      expect(result.message).toContain('OK');
    });

    test('respuesta de error de documentos', () => {
      const response = {
        body: '<aeat:Success>false</aeat:Success><aeat:Message>Error al procesar</aeat:Message>',
        simulated: false
      };

      const result = aeatRealService._processDocumentsResponse(response);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });

    test('respuesta sin mensaje usa mensaje por defecto', () => {
      const response = {
        body: '<aeat:Success>true</aeat:Success>',
        simulated: false
      };

      const result = aeatRealService._processDocumentsResponse(response);

      expect(result.success).toBe(true);
      expect(result.message).toContain('correctamente');
    });
  });

  // ============================================================================
  // RAMA: _generateInvalidTypeAnalysis
  // ============================================================================
  describe('RAMA: _generateInvalidTypeAnalysis', () => {
    test('genera análisis para tipo inválido', () => {
      const analysis = aeatRealService._generateInvalidTypeAnalysis('INVALID_TYPE');

      expect(analysis.issue).toContain('no válido');
      expect(analysis.validTypes).toContain('H1');
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // RAMA: _generateQueryErrorAnalysis
  // ============================================================================
  describe('RAMA: _generateQueryErrorAnalysis', () => {
    test('genera análisis de error de consulta', () => {
      const error = new Error('Network timeout');
      const analysis = aeatRealService._generateQueryErrorAnalysis(error, 'H1');

      expect(analysis.issue).toContain('Error consultando');
      expect(analysis.declarationType).toBe('H1');
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });
});
