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

/**
 * Construir XML para observaciones de descarga NCTS
 * @param {Object} data
 * @param {string} data.mrn - MRN del transito
 * @param {string} data.officeOfDestination - Codigo aduana destino
 * @param {string} data.traderEORI - EORI del destinatario
 * @param {string} data.unloadingDate - Fecha descarga (YYYYMMDD)
 * @param {string} data.unloadingRemark - Observaciones de descarga
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
  const prepDate = unloadingDate || new Date().toISOString().substring(0, 10).replace(/-/g, '');

  let discrepancyXML = '';
  if (goodsDiscrepancies.length > 0) {
    discrepancyXML = goodsDiscrepancies.map(d => `
        <ent:UnloadingRemark>
          <ent:conform>0</ent:conform>
          <ent:unloadingCompletion>1</ent:unloadingCompletion>
          <ent:unloadingDate>${prepDate}</ent:unloadingDate>
          <ent:stateOfSeals>${sealsOk ? '1' : '0'}</ent:stateOfSeals>
          <ent:ResultsOfControl>
            <ent:description>${d.description || ''}</ent:description>
            <ent:controlIndicator>${d.shortageOrExcess || 'A'}</ent:controlIndicator>
          </ent:ResultsOfControl>
        </ent:UnloadingRemark>`).join('');
  } else {
    discrepancyXML = `
        <ent:UnloadingRemark>
          <ent:conform>${goodsConform ? '1' : '0'}</ent:conform>
          <ent:unloadingCompletion>1</ent:unloadingCompletion>
          <ent:unloadingDate>${prepDate}</ent:unloadingDate>
          <ent:stateOfSeals>${sealsOk ? '1' : '0'}</ent:stateOfSeals>
        </ent:UnloadingRemark>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC044CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <ent:CC044C>
        <ent:messageSender>${traderEORI}</ent:messageSender>
        <ent:messageRecipient>NETA.ES</ent:messageRecipient>
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
        <ent:Consignment>${discrepancyXML}
        </ent:Consignment>
      </ent:CC044C>
    </ent:CC044CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildCC044UnloadingXML };
