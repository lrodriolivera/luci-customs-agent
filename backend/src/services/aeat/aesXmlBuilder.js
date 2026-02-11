/**
 * AES XML Builder - Declaracion de exportacion
 * Schema: CC515CV1Ent.xsd -> ES_CC515C_v514.xsd (formato EU EUCDM qualified)
 * Endpoint: /wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP
 * IMPORTANTE: elementFormDefault="qualified" - TODOS los hijos llevan prefijo ent:
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adex/jdit/ws/aes/CC515CV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de declaracion AES exportacion
 */
function buildAESExportXML(data) {
  const {
    lrn = '', declarationType = 'A',
    // Aduanas
    customsOfficeExport = 'ES002801', customsOfficeExit = 'ES002801',
    // Exportador
    exporterEORI = '', exporterName = '', exporterStreet = '', exporterCity = '', exporterPostcode = '', exporterCountry = 'ES',
    // Declarante
    declarantEORI = 'ESB22477020000', declarantName = 'Stock Logistic S.L.',
    // Envio
    destinationCountry = '',
    // Partidas
    goodsItems = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const totalGross = goodsItems.reduce((s, g) => s + (g.grossWeight || 0), 0);
  const totalPackages = goodsItems.reduce((s, g) => s + (g.packages || 1), 0);

  const itemsXML = goodsItems.map((g, i) => `
        <ent:GoodsItem>
          <ent:declarationGoodsItemNumber>${i + 1}</ent:declarationGoodsItemNumber>
          <ent:statisticalValue>${Number(g.statisticalValue || g.value || 0).toFixed(2)}</ent:statisticalValue>
          <ent:Procedure>
            <ent:requestedProcedure>10</ent:requestedProcedure>
            <ent:previousProcedure>00</ent:previousProcedure>
          </ent:Procedure>
          <ent:Commodity>
            <ent:descriptionOfGoods>${(g.description || '').substring(0, 512)}</ent:descriptionOfGoods>
            <ent:CommodityCode>
              <ent:harmonizedSystemSubHeadingCode>${(g.taricCode || '').substring(0, 6)}</ent:harmonizedSystemSubHeadingCode>
              <ent:combinedNomenclatureCode>${(g.taricCode || '').substring(6, 8)}</ent:combinedNomenclatureCode>
            </ent:CommodityCode>
            <ent:GoodsMeasure>
              <ent:grossMass>${Number(g.grossWeight || 0).toFixed(3)}</ent:grossMass>
              <ent:netMass>${Number(g.netWeight || 0).toFixed(3)}</ent:netMass>
            </ent:GoodsMeasure>
          </ent:Commodity>
          <ent:Packaging>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:typeOfPackages>${g.packageType || 'CT'}</ent:typeOfPackages>
            <ent:numberOfPackages>${g.packages || 1}</ent:numberOfPackages>
          </ent:Packaging>
          <ent:PreviousDocument>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:type>N380</ent:type>
            <ent:referenceNumber>${g.invoiceRef || 'INV-001'}</ent:referenceNumber>
          </ent:PreviousDocument>
        </ent:GoodsItem>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC515CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <ent:CC515C>
        <ent:messageSender>${exporterEORI}</ent:messageSender>
        <ent:messageRecipient>NECA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${new Date().toISOString().substring(0, 19)}</ent:preparationDateAndTime>
        <ent:messageIdentification>${transId.substring(0, 14)}</ent:messageIdentification>
        <ent:messageType>CC515C</ent:messageType>
        <ent:ExportOperation>
          <ent:LRN>${lrn || transId}</ent:LRN>
          <ent:declarationType>${declarationType}</ent:declarationType>
          <ent:additionalDeclarationType>A</ent:additionalDeclarationType>
        </ent:ExportOperation>
        <ent:CustomsOfficeOfExport>
          <ent:referenceNumber>${customsOfficeExport}</ent:referenceNumber>
        </ent:CustomsOfficeOfExport>
        <ent:CustomsOfficeOfExitDeclared>
          <ent:referenceNumber>${customsOfficeExit}</ent:referenceNumber>
        </ent:CustomsOfficeOfExitDeclared>
        <ent:Exporter>
          <ent:identificationNumber>${exporterEORI}</ent:identificationNumber>
          <ent:name>${exporterName}</ent:name>
          <ent:Address>
            <ent:streetAndNumber>${exporterStreet}</ent:streetAndNumber>
            <ent:postcode>${exporterPostcode}</ent:postcode>
            <ent:city>${exporterCity}</ent:city>
            <ent:country>${exporterCountry}</ent:country>
          </ent:Address>
        </ent:Exporter>
        <ent:Declarant>
          <ent:identificationNumber>${declarantEORI}</ent:identificationNumber>
        </ent:Declarant>
        <ent:GoodsShipment>
          <ent:countryOfDestination>${destinationCountry}</ent:countryOfDestination>
          <ent:Consignment>
            <ent:containerIndicator>0</ent:containerIndicator>
          </ent:Consignment>${itemsXML}
        </ent:GoodsShipment>
      </ent:CC515C>
    </ent:CC515CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildAESExportXML };
