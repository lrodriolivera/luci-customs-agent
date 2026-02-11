/**
 * NCTS XML Builder - Declaracion de transito
 * Schema: CC015CV1Ent.xsd -> ES_CC015C_v515.xsd (formato EU EUCDM qualified)
 * Endpoint: /wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC015CV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de declaracion NCTS transito
 */
function buildNCTSTransitXML(data) {
  const {
    lrn = '', transitType = 'T1', securityIndicator = '0',
    // Aduanas
    officeOfDeparture = 'ES002801', officeOfDestination = '',
    transitOffices = [],
    // Titular
    holderEORI = '', holderName = '', holderStreet = '', holderCity = '', holderPostcode = '', holderCountry = 'ES',
    // Declarante
    declarantEORI = 'ESB22477020000',
    // Garantia
    guaranteeType = '1', guaranteeGRN = '', guaranteeAccessCode = '',
    // Envio
    consignment = {},
    test = true
  } = data;

  const transId = generateTransactionId();
  const totalGross = (consignment.goodsItems || []).reduce((s, g) => s + (g.grossWeight || 0), 0);
  const totalPackages = (consignment.goodsItems || []).reduce((s, g) => s + (g.packages || 1), 0);
  const totalItems = (consignment.goodsItems || []).length || 1;

  const transitOfficesXML = transitOffices.map(o => `
        <CustomsOfficeOfTransitDeclared>
          <sequenceNumber>${o.sequence || 1}</sequenceNumber>
          <referenceNumber>${o.code}</referenceNumber>
        </CustomsOfficeOfTransitDeclared>`).join('');

  const itemsXML = (consignment.goodsItems || []).map((g, i) => `
          <HouseConsignment>
            <sequenceNumber>${i + 1}</sequenceNumber>
            <grossMass>${Number(g.grossWeight || 0).toFixed(3)}</grossMass>
            <ConsignmentItem>
              <goodsItemNumber>${i + 1}</goodsItemNumber>
              <declarationGoodsItemNumber>${i + 1}</declarationGoodsItemNumber>
              <Commodity>
                <descriptionOfGoods>${(g.description || '').substring(0, 512)}</descriptionOfGoods>
                <CommodityCode>
                  <harmonizedSystemSubHeadingCode>${(g.taricCode || '').substring(0, 6)}</harmonizedSystemSubHeadingCode>
                </CommodityCode>
              </Commodity>
              <Packaging>
                <sequenceNumber>1</sequenceNumber>
                <typeOfPackages>${g.packageType || 'CT'}</typeOfPackages>
                <numberOfPackages>${g.packages || 1}</numberOfPackages>
              </Packaging>
            </ConsignmentItem>
          </HouseConsignment>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC015CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <CC015C>
        <TransitOperation>
          <LRN>${lrn || transId}</LRN>
          <declarationType>${transitType}</declarationType>
          <additionalDeclarationType>A</additionalDeclarationType>
          <security>${securityIndicator}</security>
          <reducedDatasetIndicator>0</reducedDatasetIndicator>
          <bindingItinerary>0</bindingItinerary>
        </TransitOperation>
        <CustomsOfficeOfDeparture>
          <referenceNumber>${officeOfDeparture}</referenceNumber>
        </CustomsOfficeOfDeparture>
        <CustomsOfficeOfDestinationDeclared>
          <referenceNumber>${officeOfDestination}</referenceNumber>
        </CustomsOfficeOfDestinationDeclared>${transitOfficesXML}
        <HolderOfTheTransitProcedure>
          <identificationNumber>${holderEORI}</identificationNumber>
          <name>${holderName}</name>
          <Address>
            <streetAndNumber>${holderStreet}</streetAndNumber>
            <postcode>${holderPostcode}</postcode>
            <city>${holderCity}</city>
            <country>${holderCountry}</country>
          </Address>
        </HolderOfTheTransitProcedure>
        <Guarantee>
          <sequenceNumber>1</sequenceNumber>
          <guaranteeType>${guaranteeType}</guaranteeType>${guaranteeGRN ? `
          <GuaranteeReference>
            <sequenceNumber>1</sequenceNumber>
            <GRN>${guaranteeGRN}</GRN>
            <accessCode>${guaranteeAccessCode}</accessCode>
          </GuaranteeReference>` : ''}
        </Guarantee>
        <Consignment>
          <grossMass>${totalGross.toFixed(3)}</grossMass>
          <modeOfTransportAtTheBorder>${consignment.transportMode || '3'}</modeOfTransportAtTheBorder>${itemsXML}
        </Consignment>
      </CC015C>
    </ent:CC015CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildNCTSTransitXML };
