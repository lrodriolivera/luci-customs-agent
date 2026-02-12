/**
 * H1 Cancellation XML Builder - Anulacion de declaraciones de importacion
 * Schema: AnulaImportacionV1Ent.xsd
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.AnulaImportacionV1SOAP
 * elementFormDefault: unqualified
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adip/ws/AnulaImportacionV1Ent.xsd';
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
 * Construir XML para anulacion de declaracion H1
 * @param {Object} data
 * @param {string} data.mrn - MRN de la declaracion a anular
 * @param {string} data.reason - Motivo de la anulacion (codigo AEAT)
 * @param {string} data.declaranteNIF - NIF del declarante
 * @param {string} data.aduanaDespacho - Codigo de aduana (6 chars)
 * @param {boolean} data.test - Entorno de pruebas
 */
function buildH1CancelXML(data) {
  const {
    mrn = '',
    reason = '0',
    declaranteNIF = '',
    aduanaDespacho = '',
    test = true
  } = data;

  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:AnulaImportacionV1Ent xmlns:ent="${NS_ENT}">
      <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${test ? ' Test="S"' : ''}/>
      <CAaduana>${(aduanaDespacho || '').replace(/^ES/, '').substring(0, 6)}</CAaduana>
      <MRN>${mrn}</MRN>
      <MotivoAnulacion>${reason}</MotivoAnulacion>
      <NifDeclarante>${declaranteNIF}</NifDeclarante>
    </ent:AnulaImportacionV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildH1CancelXML };
