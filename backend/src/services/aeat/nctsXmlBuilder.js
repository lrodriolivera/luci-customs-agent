/**
 * NCTS XML Builder - Declaracion de transito
 * Schema: CC015CV1Ent.xsd -> ES_CC015C_v515.xsd (formato EU EUCDM qualified)
 * Endpoint: /wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP
 * IMPORTANTE: elementFormDefault="qualified" - TODOS los hijos llevan prefijo ent:
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
    officeOfDeparture = '', officeOfDestination = '',
    transitOffices = [],
    // Titular
    holderEORI = '', holderName = '', holderStreet = '', holderCity = '', holderPostcode = '', holderCountry = 'ES',
    // Declarante
    declarantEORI = '',
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
        <ent:CustomsOfficeOfTransitDeclared>
          <ent:sequenceNumber>${o.sequence || 1}</ent:sequenceNumber>
          <ent:referenceNumber>${o.code}</ent:referenceNumber>
        </ent:CustomsOfficeOfTransitDeclared>`).join('');

  const itemsXML = (consignment.goodsItems || []).map((g, i) => `
          <ent:HouseConsignment>
            <ent:sequenceNumber>${i + 1}</ent:sequenceNumber>
            <ent:grossMass>${Number(g.grossWeight || 0).toFixed(3)}</ent:grossMass>
            <ent:ConsignmentItem>
              <ent:goodsItemNumber>${i + 1}</ent:goodsItemNumber>
              <ent:declarationGoodsItemNumber>${i + 1}</ent:declarationGoodsItemNumber>
              <ent:Commodity>
                <ent:descriptionOfGoods>${(g.description || '').substring(0, 512)}</ent:descriptionOfGoods>
                <ent:CommodityCode>
                  <ent:harmonizedSystemSubHeadingCode>${(g.taricCode || '').substring(0, 6)}</ent:harmonizedSystemSubHeadingCode>
                </ent:CommodityCode>
              </ent:Commodity>
              <ent:Packaging>
                <ent:sequenceNumber>1</ent:sequenceNumber>
                <ent:typeOfPackages>${g.packageType || 'CT'}</ent:typeOfPackages>
                <ent:numberOfPackages>${g.packages || 1}</ent:numberOfPackages>
              </ent:Packaging>
            </ent:ConsignmentItem>
          </ent:HouseConsignment>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC015CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <ent:CC015C>
        <ent:messageSender>${holderEORI}</ent:messageSender>
        <ent:messageRecipient>NTA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${new Date().toISOString().substring(0, 19)}</ent:preparationDateAndTime>
        <ent:messageIdentification>${transId.substring(0, 14)}</ent:messageIdentification>
        <ent:messageType>CC015C</ent:messageType>
        <ent:TransitOperation>
          <ent:LRN>${lrn || transId}</ent:LRN>
          <ent:declarationType>${transitType}</ent:declarationType>
          <ent:additionalDeclarationType>A</ent:additionalDeclarationType>
          <ent:security>${securityIndicator}</ent:security>
          <ent:reducedDatasetIndicator>0</ent:reducedDatasetIndicator>
          <ent:bindingItinerary>0</ent:bindingItinerary>
        </ent:TransitOperation>
        <ent:CustomsOfficeOfDeparture>
          <ent:referenceNumber>${officeOfDeparture}</ent:referenceNumber>
        </ent:CustomsOfficeOfDeparture>
        <ent:CustomsOfficeOfDestinationDeclared>
          <ent:referenceNumber>${officeOfDestination}</ent:referenceNumber>
        </ent:CustomsOfficeOfDestinationDeclared>${transitOfficesXML}
        <ent:HolderOfTheTransitProcedure>
          <ent:identificationNumber>${holderEORI}</ent:identificationNumber>
          <ent:name>${holderName}</ent:name>
          <ent:Address>
            <ent:streetAndNumber>${holderStreet}</ent:streetAndNumber>
            <ent:postcode>${holderPostcode}</ent:postcode>
            <ent:city>${holderCity}</ent:city>
            <ent:country>${holderCountry}</ent:country>
          </ent:Address>
        </ent:HolderOfTheTransitProcedure>
        <ent:Guarantee>
          <ent:sequenceNumber>1</ent:sequenceNumber>
          <ent:guaranteeType>${guaranteeType}</ent:guaranteeType>${guaranteeGRN ? `
          <ent:GuaranteeReference>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:GRN>${guaranteeGRN}</ent:GRN>
            <ent:accessCode>${guaranteeAccessCode}</ent:accessCode>
          </ent:GuaranteeReference>` : ''}
        </ent:Guarantee>
        <ent:Consignment>
          <ent:grossMass>${totalGross.toFixed(3)}</ent:grossMass>${itemsXML}
        </ent:Consignment>
      </ent:CC015C>
    </ent:CC015CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildNCTSTransitXML };
