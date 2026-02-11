/**
 * AEAT Integration Service - Servicio Principal
 * Orquesta envio de declaraciones H1/AES a AEAT
 * STRIX AI - LUCI Customs Agent
 */

const https = require('https');
const fs = require('fs');
const logger = require('../../config/logger');
const {
  ENVIRONMENTS,
  RESPONSE_CODES,
  CUSTOMS_OFFICES,
  getCurrentEnvironment,
  isSimulationMode
} = require('./aeatConfig');
const SimulationEngine = require('./simulationEngine');
const signatureService = require('./signatureService');
const xmlParser = require('./xmlParser');

class AEATService {
  constructor() {
    this.environment = getCurrentEnvironment();
    this.simulationMode = isSimulationMode();
    this.simulationEngine = new SimulationEngine();

    // Certificado para produccion
    this.certificatePath = process.env.AEAT_CERTIFICATE_PATH;
    this.certificatePassword = process.env.AEAT_CERTIFICATE_PASSWORD;
    this.representativeNIF = process.env.AEAT_REPRESENTATIVE_NIF || 'B12345678';

    logger.info(`[AEAT] Service initialized - Mode: ${this.simulationMode ? 'SIMULATION' : this.environment.name}`);
  }

  /**
   * Verificar si el servicio esta configurado para produccion
   */
  isConfigured() {
    return !!(this.certificatePath && this.certificatePassword);
  }

  /**
   * Enviar declaracion H1 (Importacion)
   * @param {string} xml - XML de la declaracion en formato CC515C
   * @param {object} options - Opciones adicionales
   * @returns {object} Respuesta con MRN si es exitoso
   */
  async submitH1(xml, options = {}) {
    logger.info(`[AEAT] Submitting H1 declaration - Mode: ${this.simulationMode ? 'SIMULATION' : 'PRODUCTION'}`);

    // Modo simulacion
    if (this.simulationMode) {
      return this.simulationEngine.simulateH1Submission(xml, options);
    }

    // Modo produccion
    return this._submitToAEAT(xml, 'h1Submit', options);
  }

  /**
   * Enviar declaracion AES (Exportacion)
   * @param {string} xml - XML de la declaracion
   * @param {object} options - Opciones adicionales
   * @returns {object} Respuesta con MRN si es exitoso
   */
  async submitAES(xml, options = {}) {
    logger.info(`[AEAT] Submitting AES declaration - Mode: ${this.simulationMode ? 'SIMULATION' : 'PRODUCTION'}`);

    if (this.simulationMode) {
      return this.simulationEngine.simulateAESSubmission(xml, options);
    }

    return this._submitToAEAT(xml, 'aesSubmit', options);
  }

  /**
   * Consultar estado de declaracion
   * @param {string} mrn - Movement Reference Number
   * @param {object} options - Opciones adicionales
   * @returns {object} Estado actual de la declaracion
   */
  async queryStatus(mrn, options = {}) {
    logger.info(`[AEAT] Querying declaration status for MRN: ${mrn}`);

    if (this.simulationMode) {
      return this.simulationEngine.simulateQueryStatus(mrn);
    }

    return this._queryAEAT(mrn, options);
  }

  /**
   * Anular declaracion
   * @param {string} mrn - MRN de la declaracion a anular
   * @param {string} reason - Motivo de anulacion
   * @param {object} options - Opciones adicionales
   */
  async cancelDeclaration(mrn, reason, options = {}) {
    logger.info(`[AEAT] Cancelling declaration: ${mrn}`);

    if (this.simulationMode) {
      return this.simulationEngine.simulateCancelDeclaration(mrn, reason);
    }

    return this._cancelAEAT(mrn, reason, options);
  }

  /**
   * Envio real a AEAT (produccion)
   */
  async _submitToAEAT(xml, operation, options) {
    try {
      // 1. Validar XML
      const validation = xmlParser.validateXmlStructure(xml);
      if (!validation.valid) {
        logger.warn('[AEAT] XML validation failed:', validation.issues);
        return {
          success: false,
          status: 'validation_error',
          errors: validation.issues.map(i => ({ code: '1000', message: i }))
        };
      }

      // 2. Firmar XML
      logger.info('[AEAT] Signing XML...');
      const signedXml = await signatureService.signXml(xml);

      // 3. Construir envelope SOAP
      const soapEnvelope = this._buildSoapEnvelope(signedXml, operation);

      // 4. Enviar a AEAT
      logger.info(`[AEAT] Sending to ${operation}...`);
      const path = this.environment.paths[operation];
      const response = await this._sendRequest(path, soapEnvelope);

      // 5. Parsear respuesta
      const result = xmlParser.parseSoapResponse(response);

      logger.info(`[AEAT] ${operation} result: ${result.success ? 'SUCCESS' : 'FAILED'} - MRN: ${result.mrn || 'N/A'}`);

      return result;

    } catch (error) {
      logger.error(`[AEAT] Error in ${operation}:`, error);
      return {
        success: false,
        status: 'error',
        errors: [{
          code: 'SUBMIT_ERROR',
          message: error.message
        }]
      };
    }
  }

  /**
   * Consulta real a AEAT
   */
  async _queryAEAT(mrn, options) {
    try {
      const queryXml = this._buildQueryXml(mrn);
      const soapEnvelope = this._buildSoapEnvelope(queryXml, 'query');

      const response = await this._sendRequest(
        this.environment.paths.h1Query,
        soapEnvelope
      );

      return xmlParser.parseQueryResponse(response);

    } catch (error) {
      logger.error('[AEAT] Error querying status:', error);
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Anulacion real en AEAT
   */
  async _cancelAEAT(mrn, reason, options) {
    try {
      const cancelXml = this._buildCancelXml(mrn, reason);
      const signedXml = await signatureService.signXml(cancelXml);
      const soapEnvelope = this._buildSoapEnvelope(signedXml, 'cancel');

      const response = await this._sendRequest(
        this.environment.paths.cancel,
        soapEnvelope
      );

      return xmlParser.parseCancelResponse(response);

    } catch (error) {
      logger.error('[AEAT] Error cancelling declaration:', error);
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Construir envelope SOAP para AEAT
   */
  _buildSoapEnvelope(xml, operation) {
    const operationMap = {
      h1Submit: 'PresentacionH1',
      aesSubmit: 'PresentacionAES',
      query: 'ConsultaEstado',
      cancel: 'AnulacionDeclaracion'
    };

    const operationName = operationMap[operation] || operation;

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:aeat="https://www.agenciatributaria.gob.es/AEAT/ws">
  <soapenv:Header>
    <aeat:Security>
      <aeat:NIF>${this.representativeNIF}</aeat:NIF>
      <aeat:Timestamp>${new Date().toISOString()}</aeat:Timestamp>
    </aeat:Security>
  </soapenv:Header>
  <soapenv:Body>
    <aeat:${operationName}Request>
      <aeat:Declaration>
        <![CDATA[${xml}]]>
      </aeat:Declaration>
    </aeat:${operationName}Request>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Construir XML de consulta
   */
  _buildQueryXml(mrn) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<QueryDeclaration xmlns="urn:wco:datamodel:WCO:Query:1">
  <MRN>${mrn}</MRN>
  <QueryType>STATUS</QueryType>
  <RequestDate>${new Date().toISOString()}</RequestDate>
</QueryDeclaration>`;
  }

  /**
   * Construir XML de anulacion
   */
  _buildCancelXml(mrn, reason) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<CancelDeclaration xmlns="urn:wco:datamodel:WCO:Cancel:1">
  <MRN>${mrn}</MRN>
  <CancellationReason>${reason}</CancellationReason>
  <RequestDate>${new Date().toISOString()}</RequestDate>
  <Declarant>
    <NIF>${this.representativeNIF}</NIF>
  </Declarant>
</CancelDeclaration>`;
  }

  /**
   * Enviar peticion HTTPS a AEAT
   */
  async _sendRequest(path, body, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.environment.baseUrl);

      const requestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          'SOAPAction': options.soapAction || ''
        },
        timeout: options.timeout || 60000
      };

      // Agregar certificado cliente si esta configurado
      if (this.certificatePath && fs.existsSync(this.certificatePath)) {
        try {
          requestOptions.pfx = fs.readFileSync(this.certificatePath);
          requestOptions.passphrase = this.certificatePassword;
          logger.info('[AEAT] Using client certificate for MTLS');
        } catch (certError) {
          logger.error('[AEAT] Error loading certificate:', certError);
        }
      }

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', chunk => data += chunk);

        res.on('end', () => {
          logger.info(`[AEAT] Response status: ${res.statusCode}`);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`AEAT responded with status ${res.statusCode}: ${data.substring(0, 500)}`));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('[AEAT] Request error:', error);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Obtener informacion del servicio
   */
  getServiceInfo() {
    return {
      environment: this.environment.name,
      environmentDetails: this.environment,
      simulationMode: this.simulationMode,
      configured: this.isConfigured(),
      representativeNIF: this.representativeNIF,
      signatureService: signatureService.getInfo(),
      endpoints: this.simulationMode ? null : this.environment.paths,
      version: '2.0.0'
    };
  }

  /**
   * Forzar modo simulacion (para testing)
   */
  setSimulationMode(enabled) {
    this.simulationMode = enabled;
    logger.info(`[AEAT] Simulation mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Validar XML sin enviarlo
   */
  async validateDeclaration(xml, type = 'H1') {
    // Validar estructura
    const structureValidation = xmlParser.validateXmlStructure(xml, 'CC515C');

    // Validar contenido usando el motor de simulacion
    const contentValidation = this.simulationEngine._validateXmlStructure(xml, type);

    return {
      valid: structureValidation.valid && contentValidation.valid,
      structureIssues: structureValidation.issues,
      contentErrors: contentValidation.errors,
      contentWarnings: contentValidation.warnings
    };
  }

  /**
   * Test de conectividad (solo produccion)
   */
  async testConnectivity() {
    if (this.simulationMode) {
      return {
        success: true,
        mode: 'simulation',
        message: 'Simulation mode - no connectivity test needed'
      };
    }

    try {
      // Intentar conectar al endpoint de AEAT
      const testUrl = new URL('/wlpl/ADUA-JDIT/ws/', this.environment.baseUrl);

      return new Promise((resolve) => {
        const req = https.request({
          hostname: testUrl.hostname,
          port: 443,
          path: testUrl.pathname,
          method: 'HEAD',
          timeout: 10000
        }, (res) => {
          resolve({
            success: true,
            mode: 'production',
            statusCode: res.statusCode,
            message: `Connection successful (${res.statusCode})`
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            mode: 'production',
            error: error.message,
            message: 'Connection failed'
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            mode: 'production',
            error: 'Timeout',
            message: 'Connection timeout'
          });
        });

        req.end();
      });

    } catch (error) {
      return {
        success: false,
        mode: 'production',
        error: error.message
      };
    }
  }
}

// Exportar instancia singleton
module.exports = new AEATService();
