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
 * Construir XML para notificacion de llegada NCTS
 * @param {Object} data
 * @param {string} data.mrn - MRN del transito
 * @param {string} data.officeOfDestination - Codigo aduana destino (ES + 6 chars)
 * @param {string} data.arrivalDate - Fecha llegada (YYYYMMDD)
 * @param {string} data.traderEORI - EORI del destinatario
 * @param {string} data.traderName - Nombre del destinatario
 * @param {string} data.simplifiedProcedure - Tipo procedimiento (normal/simplified)
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
    test = true
  } = data;

  const transId = generateTransactionId();
  const prepDate = arrivalDate || new Date().toISOString().substring(0, 10).replace(/-/g, '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC007CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <ent:CC007C>
        <ent:messageSender>${traderEORI}</ent:messageSender>
        <ent:messageRecipient>NETA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${prepDate}</ent:preparationDateAndTime>
        <ent:messageIdentification>${transId}</ent:messageIdentification>
        <ent:messageType>CC007C</ent:messageType>
        <ent:TransitOperation>
          <ent:MRN>${mrn}</ent:MRN>
          <ent:arrivalNotificationDateAndTime>${prepDate}</ent:arrivalNotificationDateAndTime>
          <ent:simplifiedProcedure>${simplifiedProcedure}</ent:simplifiedProcedure>
        </ent:TransitOperation>
        <ent:CustomsOfficeOfDestinationActual>
          <ent:referenceNumber>${officeOfDestination}</ent:referenceNumber>
        </ent:CustomsOfficeOfDestinationActual>
        <ent:TraderAtDestination>
          <ent:identificationNumber>${traderEORI}</ent:identificationNumber>
          <ent:communicationLanguageAtDestination>ES</ent:communicationLanguageAtDestination>
        </ent:TraderAtDestination>
      </ent:CC007C>
    </ent:CC007CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildCC007ArrivalXML };
