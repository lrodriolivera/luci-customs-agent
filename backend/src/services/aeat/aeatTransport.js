/**
 * Transporte SOAP hacia la AEAT.
 *
 * Extraido de aeatSubmitService para poder testear los builders sin necesitar
 * el certificado FNMT ni salida a red. Alli los require vivian dentro de la
 * funcion, asi que jest.mock no los alcanzaba y cualquier test del mapeo de
 * datos acababa intentando abrir una conexion real contra Hacienda.
 *
 * Comportamiento identico al original: mismo mTLS con el .p12, mismos
 * endpoints y mismos timeouts.
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const logger = require('../../config/logger');

const AEAT_BASE_URL_PROD = 'https://www1.agenciatributaria.gob.es';
const AEAT_BASE_URL_TEST = 'https://prewww1.aeat.es';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Carga el certificado FNMT y lo convierte al par PEM que necesita el agente TLS.
 * @returns {{cert: string, key: string}}
 */
function loadCertificate() {
  const certPath = path.resolve(process.cwd(), process.env.AEAT_CERTIFICATE_PATH || '');
  if (!fs.existsSync(certPath)) {
    throw new Error('Certificado AEAT no encontrado: ' + certPath);
  }

  const p12 = fs.readFileSync(certPath);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, process.env.AEAT_CERTIFICATE_PASSWORD);
  const cert = forge.pki.certificateToPem(
    parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert
  );
  const key = forge.pki.privateKeyToPem(
    parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key
  );

  return { cert, key };
}

/**
 * La URL base depende del entorno. Solo 'production' apunta a la AEAT real:
 * cualquier otro valor (incluido no definirlo) cae en PRE, que es lo que
 * queremos si alguien despliega sin configurar la variable.
 */
function getBaseUrl() {
  return process.env.AEAT_ENVIRONMENT === 'production' ? AEAT_BASE_URL_PROD : AEAT_BASE_URL_TEST;
}

/**
 * Envia un sobre SOAP ya construido al endpoint indicado.
 *
 * @param {string} soapXML   - sobre SOAP completo
 * @param {string} endpoint  - ruta del servicio (ej. '/wlpl/inwinvoc/...')
 * @returns {Promise<{status: number, data: string}>} respuesta cruda, sin parsear
 */
async function sendSoap(soapXML, endpoint) {
  const { cert, key } = loadCertificate();
  const url = getBaseUrl() + endpoint;

  // rejectUnauthorized:false se mantiene del original: la cadena de PRE no
  // valida contra el almacen por defecto de Node.
  const agent = new https.Agent({ cert, key, rejectUnauthorized: false });

  logger.info(`[AEAT-SUBMIT] Enviando a ${url}`);

  const response = await axios.post(url, soapXML, {
    httpsAgent: agent,
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: parseInt(process.env.AEAT_TIMEOUT) || DEFAULT_TIMEOUT_MS,
    validateStatus: () => true
  });

  logger.info(`[AEAT-SUBMIT] Respuesta HTTP ${response.status}, ${response.data.length} bytes`);
  logger.info(`[AEAT-SUBMIT-RAW] ${String(response.data).substring(0, 2000)}`);

  return response;
}

module.exports = { sendSoap, loadCertificate, getBaseUrl };
