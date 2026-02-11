/**
 * Servicio de Firma Digital para AEAT
 * En produccion usara xml-crypto o similar
 * En simulacion agrega estructura mock XAdES
 * STRIX AI - LUCI Customs Agent
 */

const crypto = require('crypto');
const fs = require('fs');
const logger = require('../../config/logger');

class SignatureService {
  constructor() {
    this.certificatePath = process.env.AEAT_CERTIFICATE_PATH;
    this.certificatePassword = process.env.AEAT_CERTIFICATE_PASSWORD;
    this.representativeNIF = process.env.AEAT_REPRESENTATIVE_NIF || 'B12345678';
  }

  /**
   * Verificar si hay certificado configurado
   */
  isConfigured() {
    return !!(this.certificatePath && this.certificatePassword);
  }

  /**
   * Verificar si el certificado existe y es accesible
   */
  certificateExists() {
    if (!this.certificatePath) return false;
    try {
      return fs.existsSync(this.certificatePath);
    } catch {
      return false;
    }
  }

  /**
   * Firmar XML para envio a AEAT
   * @param {string} xml - XML a firmar
   * @param {object} options - Opciones de firma
   * @returns {string} - XML firmado
   */
  async signXml(xml, options = {}) {
    if (!xml) {
      throw new Error('XML requerido para firma');
    }

    // Si no hay certificado configurado, usar mock
    if (!this.isConfigured()) {
      logger.info('[SIGNATURE] Using mock signature (no certificate configured)');
      return this._mockSign(xml, options);
    }

    // Si hay certificado pero no existe el archivo
    if (!this.certificateExists()) {
      logger.warn('[SIGNATURE] Certificate path configured but file not found, using mock');
      return this._mockSign(xml, options);
    }

    try {
      // En produccion, usar xml-crypto o xml-dsig
      // Por ahora, usar mock pero loggear que se intentaria firma real
      logger.warn('[SIGNATURE] Real signature not implemented - using mock');
      logger.info('[SIGNATURE] Would use certificate:', this.certificatePath);
      return this._mockSign(xml, options);

      /*
      IMPLEMENTACION FUTURA CON xml-crypto:

      const { SignedXml } = require('xml-crypto');
      const { DOMParser } = require('xmldom');

      // Cargar certificado
      const pfx = fs.readFileSync(this.certificatePath);
      const { key, cert } = this._extractFromPfx(pfx, this.certificatePassword);

      // Configurar firma
      const sig = new SignedXml();
      sig.signingKey = key;
      sig.addReference("//*[local-name(.)='Declaration']",
        ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
        "http://www.w3.org/2001/04/xmlenc#sha256"
      );
      sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
      sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

      // Firmar
      const doc = new DOMParser().parseFromString(xml);
      sig.computeSignature(xml);

      return sig.getSignedXml();
      */

    } catch (error) {
      logger.error('[SIGNATURE] Error signing XML:', error);
      throw new Error('Error en firma digital: ' + error.message);
    }
  }

  /**
   * Firma mock para desarrollo/simulacion
   * Genera una estructura XAdES-BES simplificada
   */
  _mockSign(xml, options = {}) {
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomBytes(16).toString('base64');
    const signatureId = `SIG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Generar hash del contenido
    const contentHash = crypto
      .createHash('sha256')
      .update(xml)
      .digest('base64');

    // Generar hash del certificado (simulado)
    const certHash = crypto
      .createHash('sha256')
      .update(`MOCK-CERT-${this.representativeNIF}`)
      .digest('base64');

    // Estructura de firma XAdES-BES simplificada
    const signatureBlock = `
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
                Id="${signatureId}">
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <ds:Reference URI="">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue>${contentHash}</ds:DigestValue>
      </ds:Reference>
      <ds:Reference URI="#${signatureId}-SignedProperties" Type="http://uri.etsi.org/01903#SignedProperties">
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue>${crypto.createHash('sha256').update(timestamp).digest('base64')}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>MOCK_SIGNATURE_VALUE_${nonce.replace(/[+/=]/g, '')}</ds:SignatureValue>
    <ds:KeyInfo>
      <ds:X509Data>
        <ds:X509SubjectName>CN=LUCI Customs Agent Mock,O=STRIX AI SL,C=ES,SERIALNUMBER=${this.representativeNIF}</ds:X509SubjectName>
        <ds:X509Certificate>MOCK_CERTIFICATE_BASE64_DATA_${certHash.substring(0, 20)}</ds:X509Certificate>
      </ds:X509Data>
      <ds:KeyValue>
        <ds:RSAKeyValue>
          <ds:Modulus>MOCK_MODULUS_${nonce}</ds:Modulus>
          <ds:Exponent>AQAB</ds:Exponent>
        </ds:RSAKeyValue>
      </ds:KeyValue>
    </ds:KeyInfo>
    <ds:Object>
      <xades:QualifyingProperties Target="#${signatureId}">
        <xades:SignedProperties Id="${signatureId}-SignedProperties">
          <xades:SignedSignatureProperties>
            <xades:SigningTime>${timestamp}</xades:SigningTime>
            <xades:SigningCertificate>
              <xades:Cert>
                <xades:CertDigest>
                  <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                  <ds:DigestValue>${certHash}</ds:DigestValue>
                </xades:CertDigest>
                <xades:IssuerSerial>
                  <ds:X509IssuerName>CN=FNMT Clase 2 CA,OU=FNMT Clase 2 CA,O=FNMT,C=ES</ds:X509IssuerName>
                  <ds:X509SerialNumber>123456789</ds:X509SerialNumber>
                </xades:IssuerSerial>
              </xades:Cert>
            </xades:SigningCertificate>
            <xades:SignaturePolicyIdentifier>
              <xades:SignaturePolicyImplied/>
            </xades:SignaturePolicyIdentifier>
          </xades:SignedSignatureProperties>
          <xades:SignedDataObjectProperties>
            <xades:DataObjectFormat ObjectReference="#${signatureId}-ref">
              <xades:MimeType>application/xml</xades:MimeType>
            </xades:DataObjectFormat>
          </xades:SignedDataObjectProperties>
        </xades:SignedProperties>
      </xades:QualifyingProperties>
    </ds:Object>
  </ds:Signature>`;

    // Insertar firma antes del cierre del documento
    // Buscar diferentes posibles tags de cierre
    const closingTags = ['</CC515C>', '</Declaration>', '</CustomsDeclaration>'];

    for (const closingTag of closingTags) {
      if (xml.includes(closingTag)) {
        return xml.replace(closingTag, `${signatureBlock}\n${closingTag}`);
      }
    }

    // Si no encuentra el tag esperado, agregar al final antes del ultimo tag
    const lastTagMatch = xml.match(/<\/[^>]+>\s*$/);
    if (lastTagMatch) {
      return xml.replace(lastTagMatch[0], `${signatureBlock}\n${lastTagMatch[0]}`);
    }

    // Ultimo recurso: agregar al final
    return xml + signatureBlock;
  }

  /**
   * Verificar firma de respuesta AEAT
   * @param {string} signedXml - XML firmado por AEAT
   * @returns {object} - Resultado de verificacion
   */
  async verifySignature(signedXml) {
    if (!signedXml) {
      return {
        valid: false,
        mock: false,
        message: 'XML no proporcionado'
      };
    }

    // Verificar si tiene estructura de firma
    const hasSignature = signedXml.includes('<ds:Signature') ||
                        signedXml.includes('<Signature');

    if (!hasSignature) {
      return {
        valid: true,
        mock: true,
        message: 'XML sin firma - asumiendo valido en modo simulacion',
        signaturePresent: false
      };
    }

    // En produccion, verificar firma real
    // Por ahora, siempre retorna true en simulacion
    logger.info('[SIGNATURE] Verifying signature (mock mode)');

    return {
      valid: true,
      mock: true,
      message: 'Verificacion de firma simulada - firma presente',
      signaturePresent: true,
      signatureInfo: {
        algorithm: 'RSA-SHA256 (assumed)',
        timestamp: this._extractSigningTime(signedXml)
      }
    };
  }

  /**
   * Extraer fecha de firma del XML
   */
  _extractSigningTime(xml) {
    const match = xml.match(/<(?:xades:)?SigningTime>([^<]+)<\/(?:xades:)?SigningTime>/);
    return match ? match[1] : null;
  }

  /**
   * Obtener informacion del servicio
   */
  getInfo() {
    return {
      configured: this.isConfigured(),
      certificateExists: this.certificateExists(),
      certificatePath: this.certificatePath ? '***configured***' : null,
      representativeNIF: this.representativeNIF,
      mode: this.isConfigured() && this.certificateExists() ? 'production_ready' : 'mock'
    };
  }

  /**
   * Validar configuracion de certificado
   */
  validateConfiguration() {
    const issues = [];

    if (!this.certificatePath) {
      issues.push('AEAT_CERTIFICATE_PATH no configurado');
    } else if (!this.certificateExists()) {
      issues.push(`Certificado no encontrado en: ${this.certificatePath}`);
    }

    if (!this.certificatePassword) {
      issues.push('AEAT_CERTIFICATE_PASSWORD no configurado');
    }

    if (!this.representativeNIF) {
      issues.push('AEAT_REPRESENTATIVE_NIF no configurado');
    } else if (!/^[A-Z]\d{8}$/.test(this.representativeNIF)) {
      issues.push('AEAT_REPRESENTATIVE_NIF no tiene formato valido (debe ser letra + 8 digitos)');
    }

    return {
      valid: issues.length === 0,
      issues,
      ready: issues.length === 0
    };
  }
}

// Exportar instancia singleton
module.exports = new SignatureService();
