/**
 * Parser de respuestas XML de AEAT
 * STRIX AI - LUCI Customs Agent
 */

const { RESPONSE_CODES, INSPECTION_CHANNELS } = require('./aeatConfig');
const logger = require('../../config/logger');

class XMLParser {
  /**
   * Parsear respuesta de envio de declaracion
   * @param {string} xml - Respuesta XML de AEAT
   * @returns {object} - Datos parseados
   */
  parseSubmissionResponse(xml) {
    try {
      if (!xml || typeof xml !== 'string') {
        return {
          success: false,
          status: 'parse_error',
          errors: [{ code: 'EMPTY_RESPONSE', message: 'Respuesta vacia o invalida' }]
        };
      }

      // Extraer elementos principales con multiples formatos posibles
      const mrn = this._extractValue(xml, 'MRN') ||
                  this._extractValue(xml, 'MovementReferenceNumber');

      const responseCode = this._extractValue(xml, 'ResponseCode') ||
                          this._extractValue(xml, 'CodigoRespuesta') ||
                          this._extractValue(xml, 'FunctionalReferenceID');

      const channel = this._extractValue(xml, 'InspectionChannel') ||
                     this._extractValue(xml, 'CanalInspeccion') ||
                     this._extractValue(xml, 'Channel');

      const acceptanceDate = this._extractValue(xml, 'AcceptanceDate') ||
                            this._extractValue(xml, 'FechaAceptacion') ||
                            this._extractValue(xml, 'DeclarationAcceptanceDateTime');

      const customsOffice = this._extractValue(xml, 'CustomsOfficeID') ||
                           this._extractValue(xml, 'DeclarationOfficeID');

      // Extraer errores y advertencias
      const errors = this._extractErrors(xml);
      const warnings = this._extractWarnings(xml);

      // Extraer derechos si existen
      const duties = this._extractDuties(xml);

      // Determinar estado basado en codigo de respuesta
      const codeInfo = RESPONSE_CODES[responseCode] || {
        status: responseCode ? 'unknown' : 'no_code',
        severity: 'warning',
        description: responseCode ? `Codigo desconocido: ${responseCode}` : 'Sin codigo de respuesta'
      };

      // Determinar exito
      const successStatuses = ['accepted', 'pending', 'accepted_warnings'];
      const success = successStatuses.includes(codeInfo.status) || (errors.length === 0 && mrn);

      return {
        success,
        mrn,
        lrn: this._extractValue(xml, 'LRN'),
        status: codeInfo.status,
        channel: channel?.toLowerCase(),
        channelLabel: channel ? INSPECTION_CHANNELS[channel.toLowerCase()]?.label : null,
        channelDescription: channel ? INSPECTION_CHANNELS[channel.toLowerCase()]?.description : null,
        acceptanceDate,
        customsOffice,
        responseCode,
        responseDescription: codeInfo.description,
        duties,
        errors,
        warnings,
        rawResponse: xml.length > 5000 ? xml.substring(0, 5000) + '...[truncated]' : xml
      };

    } catch (error) {
      logger.error('[XML_PARSER] Error parsing submission response:', error);
      return {
        success: false,
        status: 'parse_error',
        errors: [{
          code: 'PARSE_ERROR',
          message: error.message
        }],
        rawResponse: xml?.substring(0, 500)
      };
    }
  }

  /**
   * Parsear respuesta de consulta de estado
   * @param {string} xml - Respuesta XML
   * @returns {object} - Estado parseado
   */
  parseQueryResponse(xml) {
    try {
      if (!xml) {
        return {
          success: false,
          status: 'parse_error',
          error: 'Respuesta vacia'
        };
      }

      const mrn = this._extractValue(xml, 'MRN') ||
                 this._extractValue(xml, 'MovementReferenceNumber');

      const status = this._extractValue(xml, 'Status') ||
                    this._extractValue(xml, 'Estado') ||
                    this._extractValue(xml, 'DeclarationStatus');

      const channel = this._extractValue(xml, 'Channel') ||
                     this._extractValue(xml, 'Canal') ||
                     this._extractValue(xml, 'InspectionChannel');

      const releaseDate = this._extractValue(xml, 'ReleaseDate') ||
                         this._extractValue(xml, 'FechaLevante') ||
                         this._extractValue(xml, 'GoodsReleaseDate');

      const releaseNumber = this._extractValue(xml, 'ReleaseNumber') ||
                           this._extractValue(xml, 'NumeroLevante');

      return {
        success: true,
        mrn,
        status: status?.toLowerCase(),
        statusDescription: this._getStatusDescription(status),
        channel: channel?.toLowerCase(),
        channelLabel: channel ? INSPECTION_CHANNELS[channel.toLowerCase()]?.label : null,
        releaseDate,
        releaseNumber,
        lastUpdate: this._extractValue(xml, 'LastUpdateDate') ||
                   this._extractValue(xml, 'FechaActualizacion'),
        rawResponse: xml.length > 2000 ? xml.substring(0, 2000) + '...[truncated]' : xml
      };

    } catch (error) {
      logger.error('[XML_PARSER] Error parsing query response:', error);
      return {
        success: false,
        status: 'parse_error',
        error: error.message,
        rawResponse: xml?.substring(0, 500)
      };
    }
  }

  /**
   * Parsear respuesta de anulacion
   */
  parseCancelResponse(xml) {
    try {
      const responseCode = this._extractValue(xml, 'ResponseCode') ||
                          this._extractValue(xml, 'CodigoRespuesta');

      const success = responseCode === '0000' ||
                     this._extractValue(xml, 'CancellationAccepted') === 'true';

      return {
        success,
        responseCode,
        responseDescription: RESPONSE_CODES[responseCode]?.description,
        cancellationDate: this._extractValue(xml, 'CancellationDate'),
        reason: this._extractValue(xml, 'CancellationReason')
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extraer valor de tag XML
   * Soporta diferentes formatos y namespaces
   */
  _extractValue(xml, tag) {
    const patterns = [
      // Sin namespace
      new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'),
      // Con namespace prefijo
      new RegExp(`<[a-z]+:${tag}>([^<]*)</[a-z]+:${tag}>`, 'i'),
      // Con atributos
      new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'),
      // CDATA
      new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tag}>`, 'i')
    ];

    for (const pattern of patterns) {
      const match = xml.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extraer todos los valores de un tag
   */
  _extractAllValues(xml, tag) {
    const pattern = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
    const matches = [...xml.matchAll(pattern)];
    return matches.map(m => m[1].trim()).filter(v => v);
  }

  /**
   * Extraer errores de respuesta AEAT
   */
  _extractErrors(xml) {
    const errors = [];

    // Patron 1: Estructura Error/Code/Description
    const errorPattern1 = /<Error>[\s\S]*?<Code>([^<]*)<\/Code>[\s\S]*?<Description>([^<]*)<\/Description>[\s\S]*?<\/Error>/gi;
    const matches1 = [...xml.matchAll(errorPattern1)];
    for (const match of matches1) {
      errors.push({
        code: match[1]?.trim(),
        message: match[2]?.trim(),
        ...RESPONSE_CODES[match[1]?.trim()]
      });
    }

    // Patron 2: Estructura FunctionalError
    const errorPattern2 = /<FunctionalError>[\s\S]*?<ErrorCode>([^<]*)<\/ErrorCode>[\s\S]*?<ErrorReason>([^<]*)<\/ErrorReason>[\s\S]*?<\/FunctionalError>/gi;
    const matches2 = [...xml.matchAll(errorPattern2)];
    for (const match of matches2) {
      errors.push({
        code: match[1]?.trim(),
        message: match[2]?.trim()
      });
    }

    // Patron 3: Estructura simple ErrorMessage
    const errorPattern3 = /<ErrorMessage>([^<]*)<\/ErrorMessage>/gi;
    const matches3 = [...xml.matchAll(errorPattern3)];
    for (const match of matches3) {
      if (match[1]?.trim()) {
        errors.push({
          code: 'ERROR',
          message: match[1].trim()
        });
      }
    }

    return errors;
  }

  /**
   * Extraer advertencias
   */
  _extractWarnings(xml) {
    const warnings = [];

    const warningPattern = /<Warning>[\s\S]*?<Code>([^<]*)<\/Code>[\s\S]*?<(?:Message|Description)>([^<]*)<\/(?:Message|Description)>[\s\S]*?<\/Warning>/gi;
    const matches = [...xml.matchAll(warningPattern)];

    for (const match of matches) {
      warnings.push({
        code: match[1]?.trim(),
        message: match[2]?.trim()
      });
    }

    return warnings;
  }

  /**
   * Extraer derechos y tributos
   */
  _extractDuties(xml) {
    const dutyAmount = this._extractNumeric(xml, 'DutyAmount') ||
                      this._extractNumeric(xml, 'ImportDutyAmount');
    const vatAmount = this._extractNumeric(xml, 'VATAmount') ||
                     this._extractNumeric(xml, 'IVAAmount');
    const totalAmount = this._extractNumeric(xml, 'TotalAmount') ||
                       this._extractNumeric(xml, 'TotalDutyAmount');

    if (dutyAmount || vatAmount || totalAmount) {
      return {
        dutyAmount: dutyAmount || 0,
        vatAmount: vatAmount || 0,
        totalAmount: totalAmount || (dutyAmount || 0) + (vatAmount || 0),
        currency: this._extractValue(xml, 'Currency') || 'EUR'
      };
    }

    return null;
  }

  /**
   * Extraer valor numerico
   */
  _extractNumeric(xml, tag) {
    const value = this._extractValue(xml, tag);
    if (value) {
      const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? null : num;
    }
    return null;
  }

  /**
   * Obtener descripcion de estado
   */
  _getStatusDescription(status) {
    const descriptions = {
      'accepted': 'Declaracion aceptada',
      'pending': 'Pendiente de procesamiento',
      'processing': 'En proceso de validacion',
      'released': 'Levante autorizado',
      'held': 'Retenida',
      'rejected': 'Rechazada',
      'cancelled': 'Anulada',
      'pending_documents': 'Pendiente de documentacion'
    };
    return descriptions[status?.toLowerCase()] || status;
  }

  /**
   * Validar estructura XML basica
   * @param {string} xml - XML a validar
   * @param {string} expectedRoot - Elemento raiz esperado
   * @returns {object} - Resultado de validacion
   */
  validateXmlStructure(xml, expectedRoot = 'CC515C') {
    const issues = [];

    if (!xml || typeof xml !== 'string') {
      issues.push('XML vacio o no es string');
      return { valid: false, issues };
    }

    // Verificar declaracion XML
    if (!xml.trim().startsWith('<?xml')) {
      issues.push('Falta declaracion XML (<?xml version="1.0"?>)');
    }

    // Verificar elemento raiz
    const rootPatterns = [
      expectedRoot,
      'Declaration',
      'CustomsDeclaration'
    ];

    const hasRoot = rootPatterns.some(root =>
      xml.includes(`<${root}`) || xml.includes(`<ns:${root}`)
    );

    if (!hasRoot) {
      issues.push(`Elemento raiz no encontrado. Esperado: ${expectedRoot}`);
    }

    // Verificar balance de tags (simplificado)
    const openTags = (xml.match(/<[A-Za-z][^>\/]*>/g) || []).length;
    const closeTags = (xml.match(/<\/[A-Za-z][^>]*>/g) || []).length;
    const selfClosing = (xml.match(/<[^>]+\/>/g) || []).length;

    if (Math.abs(openTags - closeTags - selfClosing) > 5) {
      issues.push('Posible desbalance en tags XML');
    }

    // Verificar caracteres invalidos
    if (xml.includes('&') && !xml.includes('&amp;') && !xml.includes('&lt;') && !xml.includes('&gt;')) {
      issues.push('Posibles caracteres especiales sin escapar');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Extraer datos de envio de una respuesta SOAP
   */
  parseSoapResponse(soapXml) {
    try {
      // Extraer el body del SOAP
      const bodyMatch = soapXml.match(/<(?:soap|soapenv):Body[^>]*>([\s\S]*)<\/(?:soap|soapenv):Body>/i);

      if (!bodyMatch) {
        // Si no es SOAP, intentar parsear directamente
        return this.parseSubmissionResponse(soapXml);
      }

      const bodyContent = bodyMatch[1];

      // Verificar si hay fault
      if (bodyContent.includes('Fault') || bodyContent.includes('fault')) {
        const faultCode = this._extractValue(bodyContent, 'faultcode') ||
                         this._extractValue(bodyContent, 'Code');
        const faultString = this._extractValue(bodyContent, 'faultstring') ||
                           this._extractValue(bodyContent, 'Reason');

        return {
          success: false,
          status: 'soap_fault',
          errors: [{
            code: faultCode || 'SOAP_FAULT',
            message: faultString || 'Error SOAP desconocido'
          }]
        };
      }

      // Parsear contenido normal
      return this.parseSubmissionResponse(bodyContent);

    } catch (error) {
      logger.error('[XML_PARSER] Error parsing SOAP response:', error);
      return {
        success: false,
        status: 'parse_error',
        errors: [{ code: 'SOAP_PARSE_ERROR', message: error.message }]
      };
    }
  }
}

// Exportar instancia singleton
module.exports = new XMLParser();
