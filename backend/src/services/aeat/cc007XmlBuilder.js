/**
 * NCTS Arrival Notification XML Builder (CC007C)
 * Schema: CC007CV1Ent.xsd
 * Endpoint: /wlpl/ADTR-JDIT/ws/ncts5/CC007CV1SOAP
 * elementFormDefault: qualified - ALL children need ent: prefix
 *
 * Sent when goods arrive at the office of destination in a transit operation.
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC007CV1Ent.xsd';
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
 * Normaliza una fecha al DateTimeType del NCTS (`AAAA-MM-DDThh:mm:ss`).
 *
 * Los llamantes pasan de todo: un Date de Mongoose, un ISO completo con
 * milisegundos y zona, o el AAAAMMDD que usaba la version anterior de este
 * builder. El pattern del XSD no admite ni la Z ni los milisegundos, asi que
 * cualquier entrada se recorta a los 19 primeros caracteres del ISO.
 */
function toDateTime(valor) {
  if (!valor) return new Date().toISOString().substring(0, 19);
  if (valor instanceof Date) return valor.toISOString().substring(0, 19);
  const texto = String(valor);
  // AAAAMMDD (formato antiguo): se le pone la hora a medianoche.
  if (/^\d{8}$/.test(texto)) {
    return `${texto.substring(0, 4)}-${texto.substring(4, 6)}-${texto.substring(6, 8)}T00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${texto}T00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(texto)) return texto.substring(0, 19);
  const fecha = new Date(texto);
  return isNaN(fecha) ? new Date().toISOString().substring(0, 19) : fecha.toISOString().substring(0, 19);
}

/**
 * Construir XML para notificacion de llegada NCTS
 *
 * La estructura sigue el sequence de CC007CType (ES_CC007C_v515.xsd): grupo
 * MESSAGE, TransitOperation, [Authorisation], CustomsOfficeOfDestinationActual,
 * TraderAtDestination, [RepresentanteEnDestino], Indicadores007, Consignment.
 * El orden es normativo: un elemento correcto fuera de sitio da el mismo error
 * 1207 que uno ausente.
 *
 * @param {Object} data
 * @param {string} data.mrn - MRN del transito
 * @param {string} data.officeOfDestination - Codigo aduana destino (ES + 6 chars)
 * @param {string|Date} data.arrivalDate - Fecha llegada (se normaliza a DateTimeType)
 * @param {string} data.traderEORI - EORI del destinatario
 * @param {string} data.traderName - Nombre del destinatario
 * @param {string} data.simplifiedProcedure - Flag procedimiento simplificado (0/1)
 * @param {string} data.incidentFlag - Flag de incidencias en ruta (0/1)
 * @param {string} data.tipoSumaria - Indicador de tipo de sumaria (max 2 chars)
 * @param {boolean} data.test - Entorno de pruebas
 */
function buildCC007ArrivalXML(data) {
  const {
    mrn = '',
    officeOfDestination = '',
    arrivalDate = '',
    traderEORI = '',
    traderName = '',
    simplifiedProcedure = '0',
    incidentFlag = '0',
    tipoSumaria = 'N',
    test = true
  } = data;

  const transId = generateTransactionId();
  const prepDate = toDateTime(arrivalDate);

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC007CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <ent:CC007C>
        <ent:messageSender>${traderEORI}</ent:messageSender>
        <ent:messageRecipient>NTA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${prepDate}</ent:preparationDateAndTime>
        <ent:messageIdentification>${transId}</ent:messageIdentification>
        <ent:messageType>CC007C</ent:messageType>
        <ent:TransitOperation>
          <ent:MRN>${mrn}</ent:MRN>
          <ent:arrivalNotificationDateAndTime>${prepDate}</ent:arrivalNotificationDateAndTime>
          <ent:simplifiedProcedure>${simplifiedProcedure}</ent:simplifiedProcedure>
          <ent:incidentFlag>${incidentFlag}</ent:incidentFlag>
        </ent:TransitOperation>
        <ent:CustomsOfficeOfDestinationActual>
          <ent:referenceNumber>${officeOfDestination}</ent:referenceNumber>
        </ent:CustomsOfficeOfDestinationActual>
        <ent:TraderAtDestination>
          <ent:identificationNumber>${traderEORI}</ent:identificationNumber>
          <ent:communicationLanguageAtDestination>ES</ent:communicationLanguageAtDestination>
        </ent:TraderAtDestination>
        <ent:Indicadores007>
          <ent:indicadorTipoSumaria>${tipoSumaria}</ent:indicadorTipoSumaria>
        </ent:Indicadores007>
        <ent:Consignment>
          <ent:LocationOfGoods>
            <ent:typeOfLocation>A</ent:typeOfLocation>
            <ent:qualifierOfIdentification>V</ent:qualifierOfIdentification>
            <ent:CustomsOffice>
              <ent:referenceNumber>${officeOfDestination}</ent:referenceNumber>
            </ent:CustomsOffice>
          </ent:LocationOfGoods>
        </ent:Consignment>
      </ent:CC007C>
    </ent:CC007CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildCC007ArrivalXML };
