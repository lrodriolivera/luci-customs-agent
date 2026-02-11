/**
 * AES XML Builder - Declaracion de exportacion
 * Schema: CC515CV1Ent.xsd -> ES_CC515C_v514.xsd (formato EU EUCDM qualified)
 * Endpoint: /wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP
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
        <GoodsItem>
          <declarationGoodsItemNumber>${i + 1}</declarationGoodsItemNumber>
          <statisticalValue>${Number(g.statisticalValue || g.value || 0).toFixed(2)}</statisticalValue>
          <Commodity>
            <descriptionOfGoods>${(g.description || '').substring(0, 512)}</descriptionOfGoods>
            <CommodityCode>
              <harmonizedSystemSubHeadingCode>${(g.taricCode || '').substring(0, 6)}</harmonizedSystemSubHeadingCode>
              <combinedNomenclatureCode>${(g.taricCode || '').substring(6, 8)}</combinedNomenclatureCode>
            </CommodityCode>
            <GoodsMeasure>
              <grossMass>${Number(g.grossWeight || 0).toFixed(3)}</grossMass>
              <netMass>${Number(g.netWeight || 0).toFixed(3)}</netMass>
            </GoodsMeasure>
          </Commodity>
          <Packaging>
            <numberOfPackages>${g.packages || 1}</numberOfPackages>
            <typeOfPackages>${g.packageType || 'CT'}</typeOfPackages>
          </Packaging>
          <PreviousDocument>
            <referenceNumber>${g.invoiceRef || 'INV-001'}</referenceNumber>
            <typeValue>N380</typeValue>
          </PreviousDocument>
        </GoodsItem>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC515CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <CC515C>
        <ExportOperation>
          <LRN>${lrn || transId}</LRN>
          <declarationType>${declarationType}</declarationType>
          <specificCircumstanceIndicator>E</specificCircumstanceIndicator>
          <totalNumberOfItems>${goodsItems.length || 1}</totalNumberOfItems>
          <totalGrossMass>${totalGross.toFixed(3)}</totalGrossMass>
          <totalNumberOfPackages>${totalPackages}</totalNumberOfPackages>
        </ExportOperation>
        <CustomsOfficeOfExport>
          <referenceNumber>${customsOfficeExport}</referenceNumber>
        </CustomsOfficeOfExport>
        <CustomsOfficeOfExitDeclared>
          <referenceNumber>${customsOfficeExit}</referenceNumber>
        </CustomsOfficeOfExitDeclared>
        <Exporter>
          <identificationNumber>${exporterEORI}</identificationNumber>
          <name>${exporterName}</name>
          <Address>
            <streetAndNumber>${exporterStreet}</streetAndNumber>
            <postcode>${exporterPostcode}</postcode>
            <city>${exporterCity}</city>
            <country>${exporterCountry}</country>
          </Address>
        </Exporter>
        <Declarant>
          <identificationNumber>${declarantEORI}</identificationNumber>
        </Declarant>
        <GoodsShipment>
          <Consignment>
            <countryOfDestination>${destinationCountry}</countryOfDestination>
            <containerIndicator>0</containerIndicator>
          </Consignment>${itemsXML}
        </GoodsShipment>
      </CC515C>
    </ent:CC515CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildAESExportXML };
