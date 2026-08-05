/**
 * Tests para xadesSignatureService.js
 * Ejercita firma XAdES con certificado/clave RSA REALES generados con node-forge
 * Objetivo: >65%L, >55%B con lógica criptográfica auténtica
 */

const forge = require('node-forge');

// Mock de certificateService antes de importar el servicio bajo prueba
jest.mock('../../../src/services/aeat/certificateService');
jest.mock('../../../src/config/logger');

const xadesSignatureService = require('../../../src/services/aeat/xadesSignatureService');
const certificateService = require('../../../src/services/aeat/certificateService');
const logger = require('../../../src/config/logger');

describe('XAdESSignatureService', () => {
  let realCert, realPrivateKey, realCertPem, realKeyPem;

  beforeAll(() => {
    // Generar par de claves RSA 1024 (más rápido que 2048 en tests)
    const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });

    // Crear certificado X.509 autofirmado
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
      { name: 'commonName', value: 'STRIX AI TEST' },
      { name: 'countryName', value: 'ES' },
      { name: 'organizationName', value: 'STRIX AI SL' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Firmar el certificado
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Almacenar objetos forge y PEMs
    realCert = cert;
    realPrivateKey = keys.privateKey;
    realCertPem = forge.pki.certificateToPem(cert);
    realKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock del logger para silenciar
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock de getCertificateForSigning: devuelve el cert/clave REALES generados en beforeAll
    certificateService.getCertificateForSigning = jest.fn().mockResolvedValue({
      success: true,
      certificate: realCert,
      privateKey: realPrivateKey,
      certPem: realCertPem,
      keyPem: realKeyPem,
      info: {
        subject: 'CN=STRIX AI TEST, O=STRIX AI SL, C=ES',
        serialNumber: '01',
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  });

  describe('signForAEAT', () => {
    it('debe firmar exitosamente un XML con certificado válido', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ImportacionCompletaV1Ent>
  <Declaracion>
    <Importador>B22477020</Importador>
  </Declaracion>
</ImportacionCompletaV1Ent>`;

      const result = await xadesSignatureService.signForAEAT(
        xmlContent,
        'test-cert-id',
        'test-password',
        { operationType: 'H7' }
      );

      // Verificar respuesta exitosa
      expect(result.success).toBe(true);
      expect(result.signedXML).toBeDefined();
      expect(result.signatureInfo).toBeDefined();
      expect(result.luciAnalysis).toBeDefined();

      // Verificar que el XML firmado contiene la firma XAdES
      expect(result.signedXML).toContain('<ds:Signature');
      expect(result.signedXML).toContain('</ds:Signature>');
      expect(result.signedXML).toContain('xades:QualifyingProperties');
      expect(result.signedXML).toContain('xades:SignedProperties');

      // Verificar que la firma se insertó antes del tag de cierre
      expect(result.signedXML).toContain('</ImportacionCompletaV1Ent>');
      const signatureIndex = result.signedXML.indexOf('<ds:Signature');
      const closingTagIndex = result.signedXML.indexOf('</ImportacionCompletaV1Ent>');
      expect(signatureIndex).toBeLessThan(closingTagIndex);

      // Verificar signatureInfo
      expect(result.signatureInfo.signatureType).toBe('XAdES-EPES');
      expect(result.signatureInfo.algorithm).toBe('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
      expect(result.signatureInfo.policy).toBe('urn:oid:2.16.724.1.3.1.1.2.1.9');
      expect(result.signatureInfo.timestamp).toBeDefined();
      expect(result.signatureInfo.certificate.subject).toContain('STRIX AI TEST');

      // Verificar que se llamó a certificateService
      expect(certificateService.getCertificateForSigning).toHaveBeenCalledWith('test-cert-id', 'test-password');
    });

    it('debe retornar error si el certificado falla', async () => {
      certificateService.getCertificateForSigning.mockResolvedValue({
        success: false,
        error: 'Certificado no encontrado'
      });

      const xmlContent = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';
      const result = await xadesSignatureService.signForAEAT(xmlContent, 'bad-cert', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Certificado no encontrado');
      expect(result.luciAnalysis).toBeDefined();
      expect(result.luciAnalysis.issue).toBe('Error de certificado');
    });

    it('debe retornar error si la validación previa impide firmar', async () => {
      // XML vacío → preValidation.canSign = false
      const result = await xadesSignatureService.signForAEAT('', 'cert-id', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validación previa fallida');
      expect(result.luciAnalysis).toBeDefined();
      expect(result.luciAnalysis.canSign).toBe(false);
      expect(result.luciAnalysis.issues).toContain('El contenido XML está vacío');
    });

    it('debe incluir warnings cuando el certificado expira pronto', async () => {
      // Certificado que expira en 5 días
      const soonExpiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      certificateService.getCertificateForSigning.mockResolvedValue({
        success: true,
        certificate: realCert,
        privateKey: realPrivateKey,
        certPem: realCertPem,
        keyPem: realKeyPem,
        info: {
          subject: 'CN=STRIX AI TEST',
          serialNumber: '01',
          validTo: soonExpiryDate.toISOString()
        }
      });

      const xmlContent = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';
      const result = await xadesSignatureService.signForAEAT(xmlContent, 'cert-id', 'password');

      // Debe firmar (canSign=true) pero con warning
      expect(result.success).toBe(true);
      // El warning se genera en preValidation pero el flujo continúa
      // Verificar que el logger registró el proceso
      expect(logger.info).toHaveBeenCalled();
    });

    it('debe manejar certificado expirado', async () => {
      certificateService.getCertificateForSigning.mockResolvedValue({
        success: true,
        certificate: realCert,
        privateKey: realPrivateKey,
        certPem: realCertPem,
        keyPem: realKeyPem,
        info: {
          subject: 'CN=STRIX AI TEST',
          serialNumber: '01',
          validTo: new Date(Date.now() - 1000).toISOString() // Expirado hace 1 segundo
        }
      });

      const xmlContent = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';
      const result = await xadesSignatureService.signForAEAT(xmlContent, 'cert-id', 'password');

      expect(result.success).toBe(false);
      expect(result.luciAnalysis.issues).toContain('El certificado ha expirado');
    });

    it('debe capturar excepciones inesperadas y devolver luciAnalysis', async () => {
      // Forzar error lanzando excepción en el mock
      certificateService.getCertificateForSigning.mockRejectedValue(new Error('Database timeout'));

      const xmlContent = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';
      const result = await xadesSignatureService.signForAEAT(xmlContent, 'cert-id', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database timeout');
      expect(result.luciAnalysis).toBeDefined();
      expect(result.luciAnalysis.issue).toBe('Error durante la firma');
    });

    it('debe incluir política de firma AEAT en el XML firmado', async () => {
      const xmlContent = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';
      const result = await xadesSignatureService.signForAEAT(xmlContent, 'cert-id', 'password', {
        includePolicy: true
      });

      expect(result.success).toBe(true);
      expect(result.signedXML).toContain('xades:SignaturePolicyIdentifier');
      expect(result.signedXML).toContain('urn:oid:2.16.724.1.3.1.1.2.1.9');
      expect(result.signedXML).toContain('Política de firma electrónica de la AEAT');
    });

    it('debe retornar error si _generateXAdESSignature falla', async () => {
      const xmlContent = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';

      // Mock _generateXAdESSignature para que retorne fallo
      const originalGenerate = xadesSignatureService._generateXAdESSignature;
      xadesSignatureService._generateXAdESSignature = jest.fn().mockResolvedValue({
        success: false,
        error: 'Fallo al generar firma XAdES'
      });

      const result = await xadesSignatureService.signForAEAT(xmlContent, 'cert-id', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fallo al generar firma XAdES');

      // Restaurar implementación original
      xadesSignatureService._generateXAdESSignature = originalGenerate;
    });
  });

  describe('verifyAEATResponse', () => {
    it('debe verificar firma presente con todos los elementos', async () => {
      const signedXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
    <ds:SignedInfo>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    </ds:SignedInfo>
    <ds:KeyInfo>
      <ds:X509Data>
        <ds:X509SubjectName>CN=AEAT, O=AGENCIA TRIBUTARIA, C=ES</ds:X509SubjectName>
      </ds:X509Data>
    </ds:KeyInfo>
    <ds:Object>
      <xades:QualifyingProperties>
        <xades:SignedProperties>
          <xades:SignedSignatureProperties>
            <xades:SigningTime>2026-08-05T12:00:00Z</xades:SigningTime>
          </xades:SignedSignatureProperties>
        </xades:SignedProperties>
      </xades:QualifyingProperties>
    </ds:Object>
  </ds:Signature>
  <xades:Identifier>urn:oid:2.16.724.1.3.1.1.2.1.9</xades:Identifier>
</Response>`;

      const result = await xadesSignatureService.verifyAEATResponse(signedXML);

      expect(result.valid).toBe(true);
      expect(result.signatureInfo.timestamp).toBe('2026-08-05T12:00:00Z');
      expect(result.signatureInfo.algorithm).toBe('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
      expect(result.signatureInfo.certificate.subject).toContain('CN=AEAT');
      expect(result.signatureInfo.policy).toBe('urn:oid:2.16.724.1.3.1.1.2.1.9');

      expect(result.checks.hasSignature).toBe(true);
      expect(result.checks.hasTimestamp).toBe(true);
      expect(result.checks.hasCertificate).toBe(true);
      expect(result.checks.hasPolicy).toBe(true);
      expect(result.checks.algorithmValid).toBe(true);

      expect(result.luciAnalysis.overallStatus).toBe('valid');
    });

    it('debe retornar valid=false si no hay firma en la respuesta', async () => {
      const unsignedXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Status>OK</Status>
</Response>`;

      const result = await xadesSignatureService.verifyAEATResponse(unsignedXML);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No se encontró firma en la respuesta');
      expect(result.luciAnalysis.issue).toBe('Respuesta sin firma');
      expect(result.luciAnalysis.recommendations).toContain('Verificar que la comunicación con AEAT se completó correctamente');
    });

    it('debe detectar elementos faltantes en la firma', async () => {
      // Firma sin timestamp ni política
      const partialSignedXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ds:SignedInfo>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    </ds:SignedInfo>
  </ds:Signature>
</Response>`;

      const result = await xadesSignatureService.verifyAEATResponse(partialSignedXML);

      expect(result.valid).toBe(false); // No pasa todas las verificaciones
      expect(result.checks.hasSignature).toBe(true);
      expect(result.checks.hasTimestamp).toBe(false);
      expect(result.checks.hasCertificate).toBe(false);
      expect(result.checks.hasPolicy).toBe(false);
      expect(result.checks.algorithmValid).toBe(true);

      expect(result.luciAnalysis.overallStatus).toBe('warning');
    });

    it('debe manejar excepción durante la verificación', async () => {
      // XML null → TypeError en .match()
      const result = await xadesSignatureService.verifyAEATResponse(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('_generateXAdESSignature', () => {
    it('debe generar firma XAdES con estructura completa', async () => {
      const xmlContent = '<ImportacionCompletaV1Ent></ImportacionCompletaV1Ent>';
      const certResult = {
        certPem: realCertPem,
        keyPem: realKeyPem,
        info: {
          subject: 'STRIX AI TEST',
          serialNumber: '01',
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      const result = await xadesSignatureService._generateXAdESSignature(
        xmlContent,
        certResult,
        { includePolicy: true }
      );

      expect(result.success).toBe(true);
      expect(result.signedXML).toBeDefined();
      expect(result.signatureId).toMatch(/^Signature-\d+-\d+$/);
      expect(result.timestamp).toBeDefined();

      // Verificar que la firma contiene todos los bloques esperados
      expect(result.signedXML).toContain('<ds:SignedInfo>');
      expect(result.signedXML).toContain('<ds:SignatureValue');
      expect(result.signedXML).toContain('<ds:KeyInfo');
      expect(result.signedXML).toContain('<xades:QualifyingProperties');
      expect(result.signedXML).toContain('<xades:SigningTime>');
      expect(result.signedXML).toContain('<xades:SigningCertificate>');
    });
  });

  describe('_buildSignedInfo', () => {
    it('debe construir SignedInfo con digest de contenido y propiedades', () => {
      const contentDigest = 'abc123contentDigest';
      const signedPropertiesId = 'SignedProperties-1';

      const signedInfo = xadesSignatureService._buildSignedInfo(contentDigest, signedPropertiesId);

      expect(signedInfo).toContain('<ds:SignedInfo');
      expect(signedInfo).toContain(contentDigest);
      expect(signedInfo).toContain(signedPropertiesId);
      expect(signedInfo).toContain('CanonicalizationMethod');
      expect(signedInfo).toContain('SignatureMethod');
      expect(signedInfo).toContain('ds:Reference');
      expect(signedInfo).toContain('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
    });
  });

  describe('_buildXAdESSignature', () => {
    it('debe incluir política explícita cuando includePolicy=true', () => {
      const params = {
        signatureId: 'Sig-1',
        signedPropertiesId: 'Props-1',
        timestamp: '2026-08-05T12:00:00Z',
        contentDigest: 'digest123',
        certDigest: 'certDigest456',
        signatureValue: 'signatureValue789',
        certificate: realCertPem,
        certInfo: { subject: 'STRIX AI TEST', serialNumber: '01' },
        includePolicy: true
      };

      const signature = xadesSignatureService._buildXAdESSignature(params);

      expect(signature).toContain('xades:SignaturePolicyIdentifier');
      expect(signature).toContain('xades:SignaturePolicyId');
      expect(signature).toContain('urn:oid:2.16.724.1.3.1.1.2.1.9');
      expect(signature).not.toContain('xades:SignaturePolicyImplied');
    });

    it('debe incluir política implícita cuando includePolicy=false', () => {
      const params = {
        signatureId: 'Sig-1',
        signedPropertiesId: 'Props-1',
        timestamp: '2026-08-05T12:00:00Z',
        contentDigest: 'digest123',
        certDigest: 'certDigest456',
        signatureValue: 'signatureValue789',
        certificate: realCertPem,
        certInfo: { subject: 'STRIX AI TEST', serialNumber: '01' },
        includePolicy: false
      };

      const signature = xadesSignatureService._buildXAdESSignature(params);

      expect(signature).toContain('xades:SignaturePolicyIdentifier');
      expect(signature).toContain('xades:SignaturePolicyImplied');
      // Verificar que NO hay tag <xades:SignaturePolicyId> (debe ser substring completo con '<')
      expect(signature).not.toContain('<xades:SignaturePolicyId>');
    });

    it('debe incluir certificado en formato base64 sin headers PEM', () => {
      const params = {
        signatureId: 'Sig-1',
        signedPropertiesId: 'Props-1',
        timestamp: '2026-08-05T12:00:00Z',
        contentDigest: 'digest123',
        certDigest: 'certDigest456',
        signatureValue: 'signatureValue789',
        certificate: realCertPem,
        certInfo: { subject: 'STRIX AI TEST', serialNumber: '01' },
        includePolicy: true
      };

      const signature = xadesSignatureService._buildXAdESSignature(params);

      expect(signature).toContain('<ds:X509Certificate>');
      expect(signature).not.toContain('-----BEGIN CERTIFICATE-----');
      expect(signature).not.toContain('-----END CERTIFICATE-----');
      // Debe contener base64 (al menos parte del contenido del cert)
      expect(signature).toMatch(/<ds:X509Certificate>[A-Za-z0-9+/=]+<\/ds:X509Certificate>/);
    });

    it('debe usar serialNumber por defecto "0" cuando certInfo.serialNumber es undefined', () => {
      const params = {
        signatureId: 'Sig-1',
        signedPropertiesId: 'Props-1',
        timestamp: '2026-08-05T12:00:00Z',
        contentDigest: 'digest123',
        certDigest: 'certDigest456',
        signatureValue: 'signatureValue789',
        certificate: realCertPem,
        certInfo: { subject: 'STRIX AI TEST', serialNumber: null }, // null → fallback a '0'
        includePolicy: true
      };

      const signature = xadesSignatureService._buildXAdESSignature(params);

      expect(signature).toContain('<ds:X509SerialNumber>0</ds:X509SerialNumber>');
    });
  });

  describe('_calculateDigest', () => {
    it('debe calcular digest SHA-256 en base64', () => {
      const content = 'test content';
      const digest = xadesSignatureService._calculateDigest(content);

      expect(digest).toBeDefined();
      expect(typeof digest).toBe('string');
      // Verificar que es base64 válido
      expect(digest).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Verificar que es determinista
      const digest2 = xadesSignatureService._calculateDigest(content);
      expect(digest2).toBe(digest);
    });

    it('debe producir digests distintos para contenidos distintos', () => {
      const digest1 = xadesSignatureService._calculateDigest('content1');
      const digest2 = xadesSignatureService._calculateDigest('content2');

      expect(digest1).not.toBe(digest2);
    });
  });

  describe('_calculateCertificateDigest', () => {
    it('debe calcular digest del certificado desde PEM', () => {
      const digest = xadesSignatureService._calculateCertificateDigest(realCertPem);

      expect(digest).toBeDefined();
      expect(typeof digest).toBe('string');
      expect(digest).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Verificar que es determinista
      const digest2 = xadesSignatureService._calculateCertificateDigest(realCertPem);
      expect(digest2).toBe(digest);
    });
  });

  describe('_calculateSignature', () => {
    it('debe calcular firma RSA-SHA256 con clave privada real', () => {
      const signedInfo = '<ds:SignedInfo>test content</ds:SignedInfo>';
      const signature = xadesSignatureService._calculateSignature(signedInfo, realKeyPem);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(signature).not.toContain('MOCK_SIGNATURE_');

      // Verificar que es determinista
      const signature2 = xadesSignatureService._calculateSignature(signedInfo, realKeyPem);
      expect(signature2).toBe(signature);
    });

    it('debe devolver firma mock si la clave privada es inválida', () => {
      const signedInfo = '<ds:SignedInfo>test</ds:SignedInfo>';
      const invalidKey = 'not a valid key';

      const signature = xadesSignatureService._calculateSignature(signedInfo, invalidKey);

      expect(signature).toBeDefined();
      expect(signature).toContain('MOCK_SIGNATURE_');
      expect(logger.warn).toHaveBeenCalledWith(
        'XAdESSignature: Usando firma mock (clave privada no disponible)'
      );
    });
  });

  describe('_insertSignature', () => {
    it('debe insertar firma antes del tag de cierre conocido H7', () => {
      const xmlContent = `<?xml version="1.0"?>
<CC515B>
  <Data>test</Data>
</CC515B>`;
      const signatureXML = '<ds:Signature>...</ds:Signature>';

      const signed = xadesSignatureService._insertSignature(xmlContent, signatureXML);

      expect(signed).toContain(signatureXML);
      expect(signed).toContain('</CC515B>');

      const signatureIndex = signed.indexOf(signatureXML);
      const closingIndex = signed.indexOf('</CC515B>');
      expect(signatureIndex).toBeLessThan(closingIndex);
    });

    it('debe insertar firma antes de </CC515C> (H1)', () => {
      const xmlContent = '<CC515C><Data>test</Data></CC515C>';
      const signatureXML = '<ds:Signature>H1</ds:Signature>';

      const signed = xadesSignatureService._insertSignature(xmlContent, signatureXML);

      expect(signed).toContain(signatureXML);
      expect(signed.indexOf(signatureXML)).toBeLessThan(signed.indexOf('</CC515C>'));
    });

    it('debe insertar firma antes de </CC615C> (AES)', () => {
      const xmlContent = '<CC615C></CC615C>';
      const signatureXML = '<ds:Signature>AES</ds:Signature>';

      const signed = xadesSignatureService._insertSignature(xmlContent, signatureXML);

      expect(signed).toContain(signatureXML);
      expect(signed.indexOf(signatureXML)).toBeLessThan(signed.indexOf('</CC615C>'));
    });

    it('debe insertar firma antes del último tag si no hay tags conocidos', () => {
      const xmlContent = '<CustomDeclaration><Data>test</Data></CustomDeclaration>';
      const signatureXML = '<ds:Signature>custom</ds:Signature>';

      const signed = xadesSignatureService._insertSignature(xmlContent, signatureXML);

      expect(signed).toContain(signatureXML);
      expect(signed).toContain('</CustomDeclaration>');
      expect(signed.indexOf(signatureXML)).toBeLessThan(signed.indexOf('</CustomDeclaration>'));
    });

    it('debe agregar firma al final si no hay tags de cierre reconocibles', () => {
      const xmlContent = '<Data>no closing tag';
      const signatureXML = '<ds:Signature>end</ds:Signature>';

      const signed = xadesSignatureService._insertSignature(xmlContent, signatureXML);

      expect(signed).toContain(xmlContent);
      expect(signed).toContain(signatureXML);
      // Debe estar al final
      expect(signed.endsWith(signatureXML)).toBe(true);
    });
  });

  describe('_extractSignatureInfo', () => {
    it('debe extraer timestamp, algorithm, certificate y policy completos', () => {
      const signedXML = `
<ds:Signature>
  <xades:SigningTime>2026-08-05T10:30:00Z</xades:SigningTime>
  <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  <ds:X509SubjectName>CN=Test User, O=Test Org, C=ES</ds:X509SubjectName>
  <xades:Identifier>urn:oid:2.16.724.1.3.1.1.2.1.9</xades:Identifier>
</ds:Signature>`;

      const info = xadesSignatureService._extractSignatureInfo(signedXML);

      expect(info.timestamp).toBe('2026-08-05T10:30:00Z');
      expect(info.algorithm).toBe('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
      expect(info.certificate.subject).toBe('CN=Test User, O=Test Org, C=ES');
      expect(info.policy).toBe('urn:oid:2.16.724.1.3.1.1.2.1.9');
    });

    it('debe retornar null para elementos ausentes', () => {
      const signedXML = '<ds:Signature></ds:Signature>';

      const info = xadesSignatureService._extractSignatureInfo(signedXML);

      expect(info.timestamp).toBeNull();
      expect(info.algorithm).toBeNull();
      expect(info.certificate).toBeNull();
      expect(info.policy).toBeNull();
    });

    it('debe extraer elementos con namespaces opcionales', () => {
      // Sin prefijo de namespace
      const signedXML = `
<Signature>
  <SigningTime>2026-01-01T00:00:00Z</SigningTime>
  <X509SubjectName>CN=NoNamespace</X509SubjectName>
  <Identifier>policy123</Identifier>
</Signature>`;

      const info = xadesSignatureService._extractSignatureInfo(signedXML);

      expect(info.timestamp).toBe('2026-01-01T00:00:00Z');
      expect(info.certificate.subject).toBe('CN=NoNamespace');
      expect(info.policy).toBe('policy123');
    });
  });

  describe('_generateId', () => {
    it('debe generar ID único con prefijo y timestamp', () => {
      const id1 = xadesSignatureService._generateId('Test');
      const id2 = xadesSignatureService._generateId('Test');

      expect(id1).toMatch(/^Test-\d+-\d+$/);
      expect(id2).toMatch(/^Test-\d+-\d+$/);
      expect(id1).not.toBe(id2); // Contador incrementa
    });

    it('debe incrementar el contador en llamadas sucesivas', () => {
      const id1 = xadesSignatureService._generateId('Sig');
      const id2 = xadesSignatureService._generateId('Sig');
      const id3 = xadesSignatureService._generateId('Sig');

      const counter1 = parseInt(id1.split('-').pop());
      const counter2 = parseInt(id2.split('-').pop());
      const counter3 = parseInt(id3.split('-').pop());

      expect(counter2).toBe(counter1 + 1);
      expect(counter3).toBe(counter2 + 1);
    });
  });

  describe('getInfo', () => {
    it('debe retornar información del servicio', () => {
      const info = xadesSignatureService.getInfo();

      expect(info.service).toBe('XAdES Signature Service');
      expect(info.version).toBe('6.1.2');
      expect(info.supportedTypes).toBeDefined();
      expect(info.supportedTypes.length).toBe(2);
      expect(info.algorithms).toBeDefined();
      expect(info.algorithms.SIGNATURE).toBe('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
      expect(info.policy).toBeDefined();
      expect(info.policy.identifier).toBe('urn:oid:2.16.724.1.3.1.1.2.1.9');
      expect(info.capabilities).toContain('Firma XAdES-BES');
      expect(info.capabilities).toContain('Firma XAdES-EPES con política AEAT');
    });
  });

  describe('_luciPreValidation', () => {
    it('debe retornar canSign=true para XML válido y certificado válido', async () => {
      const xmlContent = '<?xml version="1.0"?><Root>Valid</Root>';
      const certResult = {
        success: true,
        info: {
          subject: 'CN=Test',
          validTo: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      const validation = await xadesSignatureService._luciPreValidation(xmlContent, certResult, {});

      expect(validation.canSign).toBe(true);
      expect(validation.issues.length).toBe(0);
      expect(validation.documentInfo.size).toBe(xmlContent.length);
      expect(validation.certificateInfo).toBeDefined();
      expect(validation.recommendations[0]).toContain('listo para firmar');
    });

    it('debe detectar XML vacío', async () => {
      const certResult = { success: true };
      const validation = await xadesSignatureService._luciPreValidation('', certResult, {});

      expect(validation.canSign).toBe(false);
      expect(validation.issues).toContain('El contenido XML está vacío');
    });

    it('debe detectar certificado expirado', async () => {
      const xmlContent = '<Root></Root>';
      const certResult = {
        success: true,
        info: {
          subject: 'CN=Expired',
          validTo: new Date(Date.now() - 1000).toISOString()
        }
      };

      const validation = await xadesSignatureService._luciPreValidation(xmlContent, certResult, {});

      expect(validation.canSign).toBe(false);
      expect(validation.issues).toContain('El certificado ha expirado');
    });

    it('debe emitir warning si el certificado expira en menos de 7 días', async () => {
      const xmlContent = '<Root></Root>';
      const certResult = {
        success: true,
        info: {
          subject: 'CN=SoonExpiring',
          validTo: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      const validation = await xadesSignatureService._luciPreValidation(xmlContent, certResult, {});

      expect(validation.canSign).toBe(true);
      expect(validation.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('expira en 5 días - renovar urgentemente')])
      );
    });

    it('debe emitir warning si el certificado expira en 30 días', async () => {
      const xmlContent = '<Root></Root>';
      const certResult = {
        success: true,
        info: {
          subject: 'CN=ThirtyDays',
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      const validation = await xadesSignatureService._luciPreValidation(xmlContent, certResult, {});

      expect(validation.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('expira en 30 días - planificar renovación')])
      );
    });

    it('debe detectar documento muy grande', async () => {
      const largeXML = '<Root>' + 'x'.repeat(11 * 1024 * 1024) + '</Root>';
      const certResult = {
        success: true,
        info: { subject: 'CN=Test', validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }
      };

      const validation = await xadesSignatureService._luciPreValidation(largeXML, certResult, {});

      expect(validation.canSign).toBe(true); // No impide, solo advierte
      expect(validation.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('muy grande (>10MB)')])
      );
    });

    it('debe detectar contenido no-XML', async () => {
      const notXML = 'This is plain text, not XML';
      const certResult = { success: true };

      const validation = await xadesSignatureService._luciPreValidation(notXML, certResult, {});

      expect(validation.canSign).toBe(false);
      expect(validation.issues).toContain('El contenido no parece ser XML válido');
    });

    it('debe emitir warning si el tipo de operación no es reconocido', async () => {
      const xmlContent = '<Root></Root>';
      const certResult = {
        success: true,
        info: {
          subject: 'CN=Test',
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      const validation = await xadesSignatureService._luciPreValidation(xmlContent, certResult, {
        operationType: 'UNKNOWN_TYPE'
      });

      expect(validation.canSign).toBe(true); // No impide firmar, solo advierte
      expect(validation.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Tipo de operación "UNKNOWN_TYPE" no reconocido')])
      );
    });

    it('debe agregar issue si certResult.success=false', async () => {
      const xmlContent = '<Root></Root>';
      const certResult = {
        success: false,
        error: 'Certificado inválido'
      };

      const validation = await xadesSignatureService._luciPreValidation(xmlContent, certResult, {});

      expect(validation.canSign).toBe(false);
      expect(validation.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Error con el certificado: Certificado inválido')])
      );
    });
  });

  describe('_formatBytes', () => {
    it('debe formatear bytes correctamente', () => {
      expect(xadesSignatureService._formatBytes(500)).toBe('500 B');
      expect(xadesSignatureService._formatBytes(1024)).toBe('1.0 KB');
      expect(xadesSignatureService._formatBytes(2048)).toBe('2.0 KB');
      expect(xadesSignatureService._formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(xadesSignatureService._formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
    });
  });

  describe('_generateCertificateErrorAnalysis', () => {
    it('debe generar análisis de error de certificado', () => {
      const analysis = xadesSignatureService._generateCertificateErrorAnalysis('Certificado no encontrado');

      expect(analysis.issue).toBe('Error de certificado');
      expect(analysis.description).toBe('Certificado no encontrado');
      expect(analysis.possibleCauses).toBeDefined();
      expect(analysis.possibleCauses.length).toBeGreaterThan(0);
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.helpLink).toContain('agenciatributaria.gob.es');
    });
  });

  describe('_generateSignatureErrorAnalysis', () => {
    it('debe identificar error de clave', () => {
      const error = new Error('Private key corrupted');
      const analysis = xadesSignatureService._generateSignatureErrorAnalysis(error);

      expect(analysis.issue).toBe('Error durante la firma');
      expect(analysis.description).toContain('key corrupted');
      expect(analysis.possibleCauses).toContain('Clave privada no disponible o corrupta');
      expect(analysis.recommendations).toContain('Reimportar el certificado P12/PFX');
    });

    it('debe identificar error de XML', () => {
      const error = new Error('XML malformed');
      const analysis = xadesSignatureService._generateSignatureErrorAnalysis(error);

      expect(analysis.possibleCauses).toContain('Documento XML mal formado');
      expect(analysis.recommendations).toEqual(
        expect.arrayContaining([
          'Verificar la estructura del XML',
          'Asegurar codificación UTF-8'
        ])
      );
    });

    it('debe retornar análisis genérico para errores desconocidos', () => {
      const error = new Error('Unknown problem');
      const analysis = xadesSignatureService._generateSignatureErrorAnalysis(error);

      expect(analysis.possibleCauses).toContain('Error técnico no identificado');
      expect(analysis.recommendations).toContain('Reintentar la operación');
    });
  });
});
