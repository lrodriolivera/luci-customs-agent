/**
 * AEAT Integration Service
 * Servicio para envio de declaraciones H1/AES a la AEAT
 *
 * En produccion, este servicio se conectaria a los Web Services de AEAT:
 * - Entorno de pruebas: https://www1.agenciatributaria.gob.es/wlpl/ADUA-JDIT/ws
 * - Entorno produccion: https://www.agenciatributaria.gob.es/AEAT/ws
 *
 * Documentacion oficial:
 * - Especificaciones tecnicas DUA: https://sede.agenciatributaria.gob.es
 * - Manual desarrollador SICEX: Disponible en Sede Electronica
 */

const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../config/logger');

// Configuracion de endpoints AEAT
const AEAT_CONFIG = {
  // Entorno de pruebas (sandbox)
  test: {
    baseUrl: 'https://www1.agenciatributaria.gob.es',
    submitPath: '/wlpl/ADUA-JDIT/ws/PresDecAduana',
    queryPath: '/wlpl/ADUA-JDIT/ws/ConsultaDeclarac',
    cancelPath: '/wlpl/ADUA-JDIT/ws/AnulacionDeclara'
  },
  // Entorno de produccion
  production: {
    baseUrl: 'https://www.agenciatributaria.gob.es',
    submitPath: '/AEAT/ws/Presentacion/ImportacionH1',
    queryPath: '/AEAT/ws/Consulta/EstadoDeclaracion',
    cancelPath: '/AEAT/ws/Anulacion/Declaracion'
  }
};

// Codigos de respuesta AEAT
const AEAT_RESPONSE_CODES = {
  '0000': { status: 'accepted', description: 'Declaracion aceptada' },
  '0001': { status: 'pending', description: 'Declaracion pendiente de validacion' },
  '1000': { status: 'error', description: 'Error de formato XML' },
  '1001': { status: 'error', description: 'Error de firma digital' },
  '1002': { status: 'error', description: 'Certificado no valido' },
  '2000': { status: 'rejected', description: 'Declaracion rechazada - datos incorrectos' },
  '2001': { status: 'rejected', description: 'EORI no valido' },
  '2002': { status: 'rejected', description: 'Codigo TARIC no valido' },
  '2003': { status: 'rejected', description: 'Aduana de presentacion incorrecta' }
};

// Canales de inspeccion
const INSPECTION_CHANNELS = {
  'green': 'Canal Verde - Levante autorizado',
  'orange': 'Canal Naranja - Revision documental',
  'red': 'Canal Rojo - Inspeccion fisica'
};

class AEATService {
  constructor() {
    this.environment = process.env.AEAT_ENVIRONMENT || 'test';
    this.config = AEAT_CONFIG[this.environment];

    // Certificado digital del representante aduanero
    this.certificatePath = process.env.AEAT_CERTIFICATE_PATH;
    this.certificatePassword = process.env.AEAT_CERTIFICATE_PASSWORD;

    // NIF del representante
    this.representativeNIF = process.env.AEAT_REPRESENTATIVE_NIF || 'B12345678';

    logger.info(`AEAT Service initialized in ${this.environment} mode`);
  }

  /**
   * Verificar si el servicio esta configurado para produccion
   */
  isConfigured() {
    return !!(this.certificatePath && this.certificatePassword);
  }

  /**
   * Enviar declaracion H1 a AEAT
   * @param {string} xml - XML de la declaracion en formato CC515C
   * @param {object} options - Opciones adicionales
   * @returns {object} Respuesta de AEAT con MRN si es exitoso
   */
  async submitH1(xml, options = {}) {
    logger.info('Submitting H1 declaration to AEAT...');

    // En modo demo, simular respuesta
    if (!this.isConfigured()) {
      return this._simulateSubmission(xml, options);
    }

    try {
      // 1. Firmar el XML con certificado digital
      const signedXml = await this._signXml(xml);

      // 2. Construir envelope SOAP
      const soapEnvelope = this._buildSoapEnvelope(signedXml, 'submitH1');

      // 3. Enviar a AEAT
      const response = await this._sendToAEAT(
        this.config.submitPath,
        soapEnvelope
      );

      // 4. Parsear respuesta
      const result = this._parseResponse(response);

      logger.info(`H1 submission result: ${result.status} - MRN: ${result.mrn || 'N/A'}`);

      return result;

    } catch (error) {
      logger.error('Error submitting H1 to AEAT:', error);
      throw error;
    }
  }

  /**
   * Consultar estado de declaracion
   * @param {string} mrn - Movement Reference Number
   * @returns {object} Estado actual de la declaracion
   */
  async queryStatus(mrn) {
    logger.info(`Querying declaration status for MRN: ${mrn}`);

    if (!this.isConfigured()) {
      return this._simulateQuery(mrn);
    }

    try {
      const queryXml = this._buildQueryXml(mrn);
      const soapEnvelope = this._buildSoapEnvelope(queryXml, 'query');
      const response = await this._sendToAEAT(this.config.queryPath, soapEnvelope);

      return this._parseQueryResponse(response);

    } catch (error) {
      logger.error('Error querying AEAT:', error);
      throw error;
    }
  }

  /**
   * Anular declaracion
   * @param {string} mrn - MRN de la declaracion a anular
   * @param {string} reason - Motivo de anulacion
   */
  async cancelDeclaration(mrn, reason) {
    logger.info(`Cancelling declaration: ${mrn}`);

    if (!this.isConfigured()) {
      return {
        success: true,
        mrn,
        status: 'cancelled',
        message: '[SIMULADO] Declaracion anulada correctamente'
      };
    }

    // Implementacion real de anulacion...
    throw new Error('Cancel not implemented for production');
  }

  /**
   * Simular envio para modo demo/test
   */
  _simulateSubmission(xml, options) {
    // Generar MRN simulado (formato real: 24ES + 14 caracteres)
    const year = new Date().getFullYear().toString().slice(-2);
    const randomPart = crypto.randomBytes(7).toString('hex').toUpperCase();
    const mrn = `${year}ES${randomPart}`;

    // Simular tiempo de respuesta
    const delay = Math.random() * 2000 + 500; // 0.5-2.5 segundos

    return new Promise((resolve) => {
      setTimeout(() => {
        // Simular asignacion de canal (70% verde, 25% naranja, 5% rojo)
        const random = Math.random();
        let channel;
        if (random < 0.70) channel = 'green';
        else if (random < 0.95) channel = 'orange';
        else channel = 'red';

        const result = {
          success: true,
          simulated: true,
          mrn,
          lrn: this._extractLRN(xml),
          status: 'accepted',
          channel,
          channelDescription: INSPECTION_CHANNELS[channel],
          acceptanceDate: new Date().toISOString(),
          customsOffice: this._extractCustomsOffice(xml),
          message: `[MODO DEMO] Declaracion aceptada - Canal ${channel.toUpperCase()}`,

          // Datos adicionales simulados
          duties: {
            dutyAmount: Math.floor(Math.random() * 5000) + 500,
            vatAmount: Math.floor(Math.random() * 10000) + 1000,
            totalAmount: 0
          },

          // Fecha estimada de levante
          estimatedRelease: channel === 'green'
            ? new Date().toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),

          // Respuesta AEAT simulada
          aeatResponse: {
            code: '0000',
            description: AEAT_RESPONSE_CODES['0000'].description,
            timestamp: new Date().toISOString()
          }
        };

        result.duties.totalAmount = result.duties.dutyAmount + result.duties.vatAmount;

        logger.info(`[SIMULATED] H1 accepted with MRN: ${mrn}, Channel: ${channel}`);
        resolve(result);
      }, delay);
    });
  }

  /**
   * Simular consulta de estado
   */
  _simulateQuery(mrn) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          simulated: true,
          mrn,
          status: 'accepted',
          channel: 'green',
          releaseDate: new Date().toISOString(),
          message: '[MODO DEMO] Declaracion en estado LEVANTE AUTORIZADO'
        });
      }, 500);
    });
  }

  /**
   * Firmar XML con certificado digital
   */
  async _signXml(xml) {
    if (!this.certificatePath) {
      throw new Error('Certificate path not configured');
    }

    // En produccion, usar xmldsig o similar
    // const SignedXml = require('xml-crypto').SignedXml;
    // const certificate = fs.readFileSync(this.certificatePath);
    // ... firma digital

    return xml; // Por ahora devolver sin firmar
  }

  /**
   * Construir envelope SOAP para AEAT
   */
  _buildSoapEnvelope(xml, operation) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:aeat="https://www.agenciatributaria.gob.es/AEAT/ws">
  <soapenv:Header>
    <aeat:Authentication>
      <aeat:NIF>${this.representativeNIF}</aeat:NIF>
      <aeat:Timestamp>${new Date().toISOString()}</aeat:Timestamp>
    </aeat:Authentication>
  </soapenv:Header>
  <soapenv:Body>
    <aeat:${operation}Request>
      <aeat:Declaration>
        ${xml}
      </aeat:Declaration>
    </aeat:${operation}Request>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Construir XML de consulta
   */
  _buildQueryXml(mrn) {
    return `<QueryDeclaration>
  <MRN>${mrn}</MRN>
  <QueryType>STATUS</QueryType>
</QueryDeclaration>`;
  }

  /**
   * Enviar peticion HTTPS a AEAT
   */
  async _sendToAEAT(path, body) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.config.baseUrl.replace('https://', ''),
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      // Agregar certificado cliente si esta configurado
      if (this.certificatePath && fs.existsSync(this.certificatePath)) {
        options.pfx = fs.readFileSync(this.certificatePath);
        options.passphrase = this.certificatePassword;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Parsear respuesta de AEAT
   */
  _parseResponse(response) {
    // Parsear XML de respuesta AEAT
    // En produccion usar xml2js o similar

    // Buscar MRN en respuesta
    const mrnMatch = response.match(/<MRN>([^<]+)<\/MRN>/);
    const codeMatch = response.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
    const channelMatch = response.match(/<InspectionChannel>([^<]+)<\/InspectionChannel>/);

    return {
      success: codeMatch && codeMatch[1] === '0000',
      mrn: mrnMatch ? mrnMatch[1] : null,
      responseCode: codeMatch ? codeMatch[1] : 'UNKNOWN',
      channel: channelMatch ? channelMatch[1].toLowerCase() : null,
      rawResponse: response
    };
  }

  /**
   * Parsear respuesta de consulta
   */
  _parseQueryResponse(response) {
    const statusMatch = response.match(/<Status>([^<]+)<\/Status>/);
    const channelMatch = response.match(/<Channel>([^<]+)<\/Channel>/);

    return {
      success: true,
      status: statusMatch ? statusMatch[1] : 'unknown',
      channel: channelMatch ? channelMatch[1].toLowerCase() : null
    };
  }

  /**
   * Extraer LRN del XML
   */
  _extractLRN(xml) {
    const match = xml.match(/<LRN>([^<]+)<\/LRN>/);
    return match ? match[1] : null;
  }

  /**
   * Extraer aduana del XML
   */
  _extractCustomsOffice(xml) {
    const match = xml.match(/<DeclarationOfficeID>([^<]+)<\/DeclarationOfficeID>/);
    return match ? match[1] : null;
  }
}

module.exports = new AEATService();
