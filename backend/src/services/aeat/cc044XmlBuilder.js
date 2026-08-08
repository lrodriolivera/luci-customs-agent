/**
 * NCTS Unloading Remarks XML Builder (CC044C)
 * Schema: CC044CV1Ent.xsd
 * Endpoint: /wlpl/ADTR-JDIT/ws/ncts5/CC044CV1SOAP
 * elementFormDefault: qualified - ALL children need ent: prefix
 *
 * Sent after goods have been unloaded at destination to confirm
 * the state of seals and goods against the transit declaration.
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC044CV1Ent.xsd';
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

const MAX_REMARK = 512; // AlphaNumeric_MAX512_NoSpaces

/**
 * Normaliza una fecha al DateTimeType del NCTS (`AAAA-MM-DDThh:mm:ss`).
 * Acepta Date, ISO con milisegundos/zona, AAAA-MM-DD y el AAAAMMDD que usaba la
 * version anterior de este builder; el pattern del XSD no admite ni la Z ni los
 * milisegundos.
 */
function toDateTime(valor) {
  if (!valor) return new Date().toISOString().substring(0, 19);
  if (valor instanceof Date) return valor.toISOString().substring(0, 19);
  const texto = String(valor);
  if (/^\d{8}$/.test(texto)) {
    return `${texto.substring(0, 4)}-${texto.substring(4, 6)}-${texto.substring(6, 8)}T00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${texto}T00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(texto)) return texto.substring(0, 19);
  const fecha = new Date(texto);
  return isNaN(fecha) ? new Date().toISOString().substring(0, 19) : fecha.toISOString().substring(0, 19);
}

function escaparXML(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Resume las discrepancias en el texto libre de `unloadingRemark`.
 *
 * El XSD admite UNA sola UnloadingRemark (maxOccurs por defecto = 1) y no tiene
 * ningun bloque estructurado para discrepancias por partida, asi que todas se
 * concatenan aqui. El limite de 512 caracteres es del propio tipo: pasarse
 * tumba el mensaje completo, asi que se trunca.
 */
function resumirDiscrepancias(discrepancias) {
  const texto = discrepancias.map(d => {
    const partes = [];
    if (d.itemNumber != null) partes.push(`Partida ${d.itemNumber}`);
    if (d.shortageOrExcess) partes.push(`tipo ${d.shortageOrExcess}`);
    if (d.quantity != null) partes.push(`cant ${d.quantity}`);
    const cabecera = partes.length ? `${partes.join(' ')}: ` : '';
    return `${cabecera}${d.description || 'sin detalle'}`;
  }).join(' | ');

  return escaparXML(texto).substring(0, MAX_REMARK).trim();
}

/**
 * Construir XML para observaciones de descarga NCTS
 *
 * Sigue el sequence de CC044CType (ES_CC044C_v515.xsd): grupo MESSAGE,
 * TransitOperation, CustomsOfficeOfDestinationActual, TraderAtDestination,
 * [RepresentanteEnDestino], UnloadingRemark, [Consignment]. UnloadingRemark va
 * al nivel raiz —no dentro de Consignment— y el orden es normativo.
 *
 * @param {Object} data
 * @param {string} data.mrn - MRN del transito
 * @param {string} data.officeOfDestination - Codigo aduana destino
 * @param {string} data.traderEORI - EORI del destinatario
 * @param {string|Date} data.unloadingDate - Fecha descarga (se normaliza a DateType)
 * @param {string} data.unloadingRemark - Observaciones de descarga (max 512)
 * @param {boolean} data.sealsOk - Precintos intactos
 * @param {string} data.newSealNumber - Nuevo numero de precinto si fue reemplazado
 * @param {boolean} data.goodsConform - Mercancias conformes
 * @param {Array} data.goodsDiscrepancies - Discrepancias encontradas [{itemNumber, description, shortageOrExcess, quantity}]
 * @param {boolean} data.test - Entorno de pruebas
 */
function buildCC044UnloadingXML(data) {
  const {
    mrn = '',
    officeOfDestination = '',
    traderEORI = '',
    unloadingDate = '',
    unloadingRemark = '',
    sealsOk = true,
    newSealNumber = '',
    goodsConform = true,
    goodsDiscrepancies = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const prepDate = toDateTime(unloadingDate);
  // unloadingDate es DateType (AAAA-MM-DD), no DateTimeType.
  const fechaDescarga = prepDate.substring(0, 10);

  const hayDiscrepancias = Array.isArray(goodsDiscrepancies) && goodsDiscrepancies.length > 0;
  const conforme = hayDiscrepancias ? '0' : (goodsConform ? '1' : '0');
  const observaciones = hayDiscrepancias
    ? resumirDiscrepancias(goodsDiscrepancies)
    : escaparXML(unloadingRemark).substring(0, MAX_REMARK).trim();
  const observacionesXML = observaciones
    ? `\n          <ent:unloadingRemark>${observaciones}</ent:unloadingRemark>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC044CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <ent:CC044C>
        <ent:messageSender>${traderEORI}</ent:messageSender>
        <ent:messageRecipient>NTA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${prepDate}</ent:preparationDateAndTime>
        <ent:messageIdentification>${transId}</ent:messageIdentification>
        <ent:messageType>CC044C</ent:messageType>
        <ent:TransitOperation>
          <ent:MRN>${mrn}</ent:MRN>
        </ent:TransitOperation>
        <ent:CustomsOfficeOfDestinationActual>
          <ent:referenceNumber>${officeOfDestination}</ent:referenceNumber>
        </ent:CustomsOfficeOfDestinationActual>
        <ent:TraderAtDestination>
          <ent:identificationNumber>${traderEORI}</ent:identificationNumber>
        </ent:TraderAtDestination>
        <ent:UnloadingRemark>
          <ent:conform>${conforme}</ent:conform>
          <ent:unloadingCompletion>1</ent:unloadingCompletion>
          <ent:unloadingDate>${fechaDescarga}</ent:unloadingDate>
          <ent:stateOfSeals>${sealsOk ? '1' : '0'}</ent:stateOfSeals>${observacionesXML}
        </ent:UnloadingRemark>
      </ent:CC044C>
    </ent:CC044CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildCC044UnloadingXML };
