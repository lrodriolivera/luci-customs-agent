/**
 * ENS Cancellation XML Builder (IE314 / CC314A)
 * Schema: IE314V5Ent.xsd
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE314V5SOAP
 * elementFormDefault: unqualified - los hijos NO llevan prefijo ent:
 *
 * Anula una declaracion sumaria de entrada ya presentada. Sustituye al CC328C
 * que generaba ensGenerator.generateCancellation: el CC328C es el ACUSE que
 * AEAT emite al registrar una ENS, no un mensaje de anulacion, y ademas nunca
 * se enviaba a nadie — la declaracion quedaba 'cancelled' en LUCI mientras para
 * AEAT la sumaria seguia viva con su MRN.
 *
 * FORMA DEL MENSAJE: calcada del IE313 (ie313XmlBuilder), que es la unica de
 * esta familia verificada contra PRE. Las tres trampas que ya costaron un
 * rechazo real (CD917B / XMLERR805 "Invalid NameSpace", errCod 52):
 *   - el namespace va bajo /ADUA/internet/es/aeat/dit/adu/aden/enswsv5/,
 *     NO bajo /static_files/
 *   - la raiz es <ent:CC314A>, sin envoltorio <ent:IE314V5Ent>
 *   - el receptor del canal ENS es NICA.ES (NECA.ES no existe)
 * Y de la misma familia: DatOfPreMES9 en AAMMDD (en AAAAMMDD AEAT devuelve
 * "Element too long (length constraint)"), TimOfPreMES10 en HHMM,
 * MesIdeMES19 an..14.
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE314V5Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

function escapeXML(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
 * Construir XML de anulacion de ENS
 * @param {Object} data
 * @param {string} data.mrn - MRN de la ENS a anular (obligatorio)
 * @param {string} data.reason - Motivo de la anulacion
 * @param {string} data.declarantEORI - EORI del declarante que firma
 * @param {string} data.declarantName - Nombre del declarante
 * @param {string} data.entryOffice - Aduana de entrada de la sumaria original
 * @param {boolean} data.test - Entorno de pruebas
 */
function buildIE314CancelXML(data = {}) {
  const {
    mrn = '',
    reason = '',
    declarantEORI = '',
    declarantName = '',
    entryOffice = '',
    test = true
  } = data;

  // Sin MRN el mensaje no identifica que sumaria anular: mejor fallar aqui que
  // enviar a AEAT una anulacion que no puede aplicarse a nada.
  if (!mrn) {
    throw new Error('buildIE314CancelXML: el MRN de la ENS a anular es obligatorio');
  }

  const transId = generateTransactionId();
  const ahora = new Date();
  const prepDate = String(ahora.getFullYear()).substring(2) +
    String(ahora.getMonth() + 1).padStart(2, '0') +
    String(ahora.getDate()).padStart(2, '0');
  const prepTime = String(ahora.getHours()).padStart(2, '0') +
    String(ahora.getMinutes()).padStart(2, '0');

  const declaranteXML = (declarantEORI || declarantName)
    ? `
      <TRACONCO2>
        <NamCO27>${escapeXML(declarantName)}</NamCO27>
        <TINCO259>${escapeXML(declarantEORI)}</TINCO259>
      </TRACONCO2>`
    : '';

  const aduanaXML = entryOffice
    ? `
      <CUSOFFFENT730>
        <RefNumCUSOFFFENT731>${escapeXML(entryOffice)}</RefNumCUSOFFFENT731>
      </CUSOFFFENT730>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC314A xmlns:ent="${NS_ENT}">
      <MesSenMES3>${escapeXML(declarantEORI)}</MesSenMES3>
      <MesRecMES6>NICA.ES</MesRecMES6>
      <DatOfPreMES9>${prepDate}</DatOfPreMES9>
      <TimOfPreMES10>${prepTime}</TimOfPreMES10>
      <TesIndMES18>${test ? '1' : '0'}</TesIndMES18>
      <MesIdeMES19>${transId.substring(0, 14)}</MesIdeMES19>
      <MesTypMES20>CC314A</MesTypMES20>
      <HEAHEA>
        <DocNumHEA5>${escapeXML(mrn)}</DocNumHEA5>
        <AmdPlaHEA598>${escapeXML(reason || 'Anulacion solicitada por el declarante')}</AmdPlaHEA598>
        <DatOfCanReqHEA147>${prepDate}</DatOfCanReqHEA147>
        <DecPlaHEA394>ES</DecPlaHEA394>
      </HEAHEA>${declaranteXML}${aduanaXML}
    </ent:CC314A>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildIE314CancelXML };
