/**
 * Query XML Builder - Consulta de estado de declaraciones en AEAT
 * Schema: ConsultaImportacionV2Ent.xsd
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ConsultaImportacionV2SOAP
 *
 * Permite consultar el estado de una declaracion por su MRN
 * y obtener el circuito asignado (verde/naranja/rojo)
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adip/ws/ConsultaImportacionV2Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

function generateTransactionId() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    String(now.getMilliseconds()).padStart(3, '0') +
    String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

/**
 * Construir XML para consulta de estado de declaracion H1
 * @param {string} mrn - Movement Reference Number
 * @param {Object} options - { test: boolean, datosATC: string }
 */
function buildQueryImportXML(mrn, options = {}) {
  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);
  const isTest = options.test !== false;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:ConsultaImportacionV2Ent xmlns:ent="${NS_ENT}">
      <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${isTest ? ' Test="S"' : ''}/>
      <NumeroDeReferencia>${mrn}</NumeroDeReferencia>${options.datosATC ? `
      <DatosEnATC>${options.datosATC}</DatosEnATC>` : ''}
    </ent:ConsultaImportacionV2Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildQueryImportXML, generateTransactionId };
