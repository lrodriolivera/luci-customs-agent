/**
 * NCTS XML Builder - Declaracion de transito
 * Schema: CC015CV1Ent.xsd -> ES_CC015C_v515.xsd (formato EU EUCDM qualified)
 * Endpoint: /wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP
 * IMPORTANTE: elementFormDefault="qualified" - TODOS los hijos llevan prefijo ent:
 *
 * Reglas AEAT:
 * - Si EORI/identificationNumber presente, NO enviar name/Address (reglas 1499/1626)
 * - Si no hay Representative, ContactPerson obligatorio en Holder
 * - GuaranteeReference obligatorio para guaranteeType 0,1,3,4
 * - containerIndicator obligatorio en Consignment
 * - PlaceOfLoading obligatorio si additionalDeclarationType != D
 * - LocationOfGoods obligatorio salvo pretransito D
 * - countryOfDispatch/countryOfDestination al menos en un nivel
 * - combinedNomenclatureCode obligatorio
 * - GoodsMeasure obligatorio
 * - shippingMarks obligatorio para ciertos tipos de bultos
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
    additionalDeclarationType = 'A',
    // Aduanas
    officeOfDeparture = '', officeOfDestination = '',
    transitOffices = [],
    // Titular
    holderEORI = '', holderName = '', holderStreet = '', holderCity = '', holderPostcode = '', holderCountry = 'ES',
    holderContactName = '', holderContactPhone = '', holderContactEmail = '',
    // Declarante
    declarantEORI = '',
    // Garantia
    guaranteeType = '1', guaranteeGRN = '', guaranteeAccessCode = '',
    // Envio
    consignment = {},
    // Paises
    countryOfDispatch = '', countryOfDestination = '',
    // Localizacion
    locationOfGoodsType = 'B', locationOfGoodsQualifier = 'Y',
    // Lugar de carga
    placeOfLoadingCountry = '', placeOfLoadingLocation = '',
    test = true
  } = data;

  const transId = generateTransactionId();
  const totalGross = (consignment.goodsItems || []).reduce((s, g) => s + (g.grossWeight || 0), 0);
  const totalItems = (consignment.goodsItems || []).length || 1;

  const transitOfficesXML = transitOffices.map(o => `
        <ent:CustomsOfficeOfTransitDeclared>
          <ent:sequenceNumber>${o.sequence || 1}</ent:sequenceNumber>
          <ent:referenceNumber>${o.code}</ent:referenceNumber>
        </ent:CustomsOfficeOfTransitDeclared>`).join('');

  const itemsXML = (consignment.goodsItems || []).map((g, i) => `
          <ent:HouseConsignment>
            <ent:sequenceNumber>${i + 1}</ent:sequenceNumber>
            <ent:grossMass>${Number(g.grossWeight || 0).toFixed(3)}</ent:grossMass>${g.consigneeEORI || data.consigneeEORI || consignment.consigneeEORI ? `
            <ent:Consignee>
              <ent:identificationNumber>${g.consigneeEORI || data.consigneeEORI || consignment.consigneeEORI}</ent:identificationNumber>
            </ent:Consignee>` : (g.consigneeName || consignment.consigneeName) ? `
            <ent:Consignee>
              <ent:name>${g.consigneeName || consignment.consigneeName}</ent:name>
              <ent:Address>
                <ent:streetAndNumber>${g.consigneeStreet || consignment.consigneeStreet || ''}</ent:streetAndNumber>
                <ent:postcode>${g.consigneePostcode || consignment.consigneePostcode || ''}</ent:postcode>
                <ent:city>${g.consigneeCity || consignment.consigneeCity || ''}</ent:city>
                <ent:country>${g.consigneeCountry || consignment.consigneeCountry || officeOfDestination.substring(0, 2)}</ent:country>
              </ent:Address>
            </ent:Consignee>` : ''}
            <ent:ConsignmentItem>
              <ent:goodsItemNumber>${i + 1}</ent:goodsItemNumber>
              <ent:declarationGoodsItemNumber>${i + 1}</ent:declarationGoodsItemNumber>
              <ent:countryOfDispatch>${g.countryOfDispatch || countryOfDispatch || holderCountry}</ent:countryOfDispatch>
              <ent:countryOfDestination>${g.countryOfDestination || countryOfDestination || officeOfDestination.substring(0, 2)}</ent:countryOfDestination>
              <ent:Commodity>
                <ent:descriptionOfGoods>${(g.description || '').substring(0, 512)}</ent:descriptionOfGoods>
                <ent:CommodityCode>
                  <ent:harmonizedSystemSubHeadingCode>${(g.taricCode || '').substring(0, 6)}</ent:harmonizedSystemSubHeadingCode>
                  <ent:combinedNomenclatureCode>${(g.taricCode || '').substring(6, 8) || '00'}</ent:combinedNomenclatureCode>
                </ent:CommodityCode>
                <ent:GoodsMeasure>
                  <ent:grossMass>${Number(g.grossWeight || 0).toFixed(3)}</ent:grossMass>
                  <ent:netMass>${Number(g.netWeight || g.grossWeight || 0).toFixed(3)}</ent:netMass>
                </ent:GoodsMeasure>
              </ent:Commodity>
              <ent:Packaging>
                <ent:sequenceNumber>1</ent:sequenceNumber>
                <ent:typeOfPackages>${g.packageType || 'PK'}</ent:typeOfPackages>
                <ent:numberOfPackages>${g.packages || 1}</ent:numberOfPackages>
                <ent:shippingMarks>${g.shippingMarks || 'N/M'}</ent:shippingMarks>
              </ent:Packaging>
            </ent:ConsignmentItem>
          </ent:HouseConsignment>`).join('');

  // Garantia: tipo 0,1,3,4 necesitan GRN; tipo 2,6,8 necesitan 1 GuaranteeReference sin GRN
  const needsGRN = ['0', '1', '3', '4'].includes(guaranteeType);
  const needsRefNoGRN = ['2', '6', '8'].includes(guaranteeType);

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
          <ent:additionalDeclarationType>${additionalDeclarationType}</ent:additionalDeclarationType>
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
          <ent:identificationNumber>${holderEORI}</ent:identificationNumber>${!holderEORI ? `
          <ent:name>${holderName}</ent:name>
          <ent:Address>
            <ent:streetAndNumber>${holderStreet}</ent:streetAndNumber>
            <ent:postcode>${holderPostcode}</ent:postcode>
            <ent:city>${holderCity}</ent:city>
            <ent:country>${holderCountry}</ent:country>
          </ent:Address>` : ''}
          <ent:ContactPerson>
            <ent:name>${holderContactName || holderName || 'Despacho'}</ent:name>
            <ent:phoneNumber>${holderContactPhone || '+34976000000'}</ent:phoneNumber>
            <ent:eMailAddress>${holderContactEmail || 'despacho@strixai.es'}</ent:eMailAddress>
          </ent:ContactPerson>
        </ent:HolderOfTheTransitProcedure>
        <ent:Guarantee>
          <ent:sequenceNumber>1</ent:sequenceNumber>
          <ent:guaranteeType>${guaranteeType}</ent:guaranteeType>${needsGRN ? `
          <ent:GuaranteeReference>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:GRN>${guaranteeGRN}</ent:GRN>
            <ent:accessCode>${guaranteeAccessCode || '0000'}</ent:accessCode>
            <ent:amountToBeCovered>${Number(data.guaranteeAmount || totalGross * 10 || 10000).toFixed(2)}</ent:amountToBeCovered>
          </ent:GuaranteeReference>` : ''}${needsRefNoGRN ? `
          <ent:GuaranteeReference>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:amountToBeCovered>0.00</ent:amountToBeCovered>
          </ent:GuaranteeReference>` : ''}
        </ent:Guarantee>
        <ent:Consignment>
          <ent:containerIndicator>0</ent:containerIndicator>
          <ent:grossMass>${totalGross.toFixed(3)}</ent:grossMass>
          <ent:referenceNumberUCR>${data.referenceNumberUCR || lrn || transId}</ent:referenceNumberUCR>
          <ent:LocationOfGoods>
            <ent:typeOfLocation>B</ent:typeOfLocation>
            <ent:qualifierOfIdentification>Y</ent:qualifierOfIdentification>
            <ent:authorisationNumber>${data.locationAuthorisationNumber || officeOfDeparture + '001'}</ent:authorisationNumber>
          </ent:LocationOfGoods>
          <ent:PlaceOfLoading>
            <ent:country>${placeOfLoadingCountry || holderCountry}</ent:country>
            <ent:location>${placeOfLoadingLocation || holderCity || 'Zaragoza'}</ent:location>
          </ent:PlaceOfLoading>${itemsXML}
        </ent:Consignment>
      </ent:CC015C>
    </ent:CC015CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildNCTSTransitXML };
