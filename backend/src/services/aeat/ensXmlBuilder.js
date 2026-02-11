/**
 * ENS/ICS2 XML Builder - Declaracion sumaria de entrada
 * Schema: IE315V5 (formato EU)
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE315V5.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de declaracion ENS/ICS2
 */
function buildENSDeclarationXML(data) {
  const {
    lrn = '',
    // Carrier
    carrierEORI = '', carrierName = '',
    // Entry office
    entryOffice = 'ES002801',
    // Transport
    transportMode = '1', transportId = '', transportCountry = '',
    // Consignment
    consignment = {},
    // Houses
    houseConsignments = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const totalGross = consignment.grossMass || houseConsignments.reduce((s, h) => s + (h.grossMass || 0), 0);
  const totalPackages = consignment.numberOfPackages || houseConsignments.reduce((s, h) => s + (h.numberOfPackages || 0), 0);

  const housesXML = houseConsignments.map((h, i) => `
        <HouseConsignment>
          <sequenceNumber>${i + 1}</sequenceNumber>
          <grossMass>${Number(h.grossMass || 0).toFixed(3)}</grossMass>
          <Consignor>
            <name>${h.consignor?.name || ''}</name>
            <Address>
              <streetAndNumber>${h.consignor?.street || ''}</streetAndNumber>
              <city>${h.consignor?.city || ''}</city>
              <country>${h.consignor?.country || ''}</country>
            </Address>
          </Consignor>
          <Consignee>
            <name>${h.consignee?.name || ''}</name>
            <Address>
              <streetAndNumber>${h.consignee?.street || ''}</streetAndNumber>
              <city>${h.consignee?.city || ''}</city>
              <country>${h.consignee?.country || 'ES'}</country>
            </Address>
          </Consignee>
          <ConsignmentItem>
            <goodsItemNumber>1</goodsItemNumber>
            <Commodity>
              <descriptionOfGoods>${(h.goodsDescription || '').substring(0, 512)}</descriptionOfGoods>
              <CommodityCode>
                <harmonizedSystemSubHeadingCode>${(h.commodityCode || '').substring(0, 6)}</harmonizedSystemSubHeadingCode>
              </CommodityCode>
            </Commodity>
            <Packaging>
              <sequenceNumber>1</sequenceNumber>
              <typeOfPackages>${h.packageType || 'CT'}</typeOfPackages>
              <numberOfPackages>${h.numberOfPackages || 1}</numberOfPackages>
            </Packaging>
          </ConsignmentItem>
        </HouseConsignment>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <IE315 xmlns="${NS_ENT}">
      <preparationDateAndTime>${new Date().toISOString()}</preparationDateAndTime>
      <CustomsOfficeOfFirstEntry>
        <referenceNumber>${entryOffice}</referenceNumber>
      </CustomsOfficeOfFirstEntry>
      <Carrier>
        <identificationNumber>${carrierEORI}</identificationNumber>
      </Carrier>
      <Consignment>
        <grossMass>${totalGross.toFixed(3)}</grossMass>
        <TransportEquipment>
          <sequenceNumber>1</sequenceNumber>
          <containerIdentificationNumber>${consignment.containerNumber || ''}</containerIdentificationNumber>
        </TransportEquipment>
        <ActiveBorderTransportMeans>
          <sequenceNumber>1</sequenceNumber>
          <typeOfIdentification>10</typeOfIdentification>
          <identificationNumber>${transportId}</identificationNumber>
          <nationality>${transportCountry}</nationality>
        </ActiveBorderTransportMeans>${housesXML}
      </Consignment>
    </IE315>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildENSDeclarationXML };
