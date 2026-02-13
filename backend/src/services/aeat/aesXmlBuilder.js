/**
 * AES XML Builder - Declaracion de exportacion
 * Schema: CC515CV1Ent.xsd -> ES_CC515C_v514.xsd (formato EU EUCDM qualified)
 * Endpoint: /wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP
 * IMPORTANTE: elementFormDefault="qualified" - TODOS los hijos llevan prefijo ent:
 *
 * Reglas AEAT validadas 13/Feb/2026:
 * - Si EORI presente, NO enviar name/Address (reglas 1289/1290)
 * - Si additionalDeclarationType A: invoiceCurrency + totalAmountInvoiced obligatorios en ExportOperation
 * - Si no hay Representative, ContactPerson es obligatorio en Declarant
 * - security=2 obligatorio para destinos fuera UE con additionalDeclarationType A
 * - DeliveryTerms: UNLocode O (location+country) - no ambos
 * - LocationOfGoods qualifier Y: usa authorisationNumber, NO CustomsOffice
 * - DepartureTransportMeans + ActiveBorderTransportMeans obligatorios para modo carretera
 * - supplementaryUnits obligatorio si TARIC lo exige
 * - Origin obligatorio si countryOfExport=ES
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adex/jdit/ws/aes/CC515CV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

function buildAESExportXML(data) {
  const {
    lrn = '', declarationType = 'EX',
    additionalDeclarationType = 'A',
    security = '2',
    // Facturacion - van en ExportOperation
    invoiceCurrency = 'EUR', totalAmountInvoiced = 0,
    // Aduanas
    customsOfficeExport = '', customsOfficeExit = '',
    // Exportador
    exporterEORI = '', exporterName = '', exporterStreet = '', exporterCity = '', exporterPostcode = '', exporterCountry = 'ES',
    // Declarante
    declarantEORI = '', declarantName = '',
    declarantContactName = '', declarantContactPhone = '', declarantContactEmail = '',
    // Consignatario
    consigneeEORI = '', consigneeName = '', consigneeStreet = '', consigneeCity = '', consigneePostcode = '', consigneeCountry = '',
    // Envio
    countryOfExport = 'ES', destinationCountry = '',
    natureOfTransaction = '11',
    // Transporte
    modeOfTransportAtBorder = '3', inlandModeOfTransport = '3',
    transportDocType = 'N730', transportDocRef = '',
    // Transport means
    departureTransportType = '30', departureTransportId = '', departureTransportCountry = '',
    activeBorderTransportType = '30', activeBorderTransportId = '', activeBorderTransportCountry = '',
    // Condiciones entrega - opcion 1: UNLocode; opcion 2: location+country
    incotermCode = 'DAP', incotermUNLocode = '', incotermLocation = '', incotermCountry = '',
    // Localizacion
    locationOfGoodsType = 'B', locationOfGoodsQualifier = 'Y',
    locationAuthorisationNumber = '',
    // Partidas
    goodsItems = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const totalGross = goodsItems.reduce((s, g) => s + (g.grossWeight || 0), 0);
  const totalInvoiced = totalAmountInvoiced || goodsItems.reduce((s, g) => s + (g.value || g.statisticalValue || 0), 0);

  const itemsXML = goodsItems.map((g, i) => `
        <ent:GoodsItem>
          <ent:declarationGoodsItemNumber>${i + 1}</ent:declarationGoodsItemNumber>
          <ent:statisticalValue>${Number(g.statisticalValue || g.value || 0).toFixed(2)}</ent:statisticalValue>
          <ent:Procedure>
            <ent:requestedProcedure>10</ent:requestedProcedure>
            <ent:previousProcedure>00</ent:previousProcedure>
          </ent:Procedure>${g.countryOfOrigin ? `
          <ent:Origin>
            <ent:countryOfOrigin>${g.countryOfOrigin}</ent:countryOfOrigin>
          </ent:Origin>` : ''}
          <ent:Commodity>
            <ent:descriptionOfGoods>${(g.description || '').substring(0, 512)}</ent:descriptionOfGoods>
            <ent:CommodityCode>
              <ent:harmonizedSystemSubHeadingCode>${(g.taricCode || '').substring(0, 6)}</ent:harmonizedSystemSubHeadingCode>
              <ent:combinedNomenclatureCode>${(g.taricCode || '').substring(6, 8)}</ent:combinedNomenclatureCode>
            </ent:CommodityCode>
            <ent:GoodsMeasure>
              <ent:grossMass>${Number(g.grossWeight || 0).toFixed(3)}</ent:grossMass>
              <ent:netMass>${Number(g.netWeight || 0).toFixed(3)}</ent:netMass>${g.supplementaryUnits != null ? `
              <ent:supplementaryUnits>${g.supplementaryUnits}</ent:supplementaryUnits>` : ''}
            </ent:GoodsMeasure>
          </ent:Commodity>
          <ent:Packaging>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:typeOfPackages>${g.packageType || 'PK'}</ent:typeOfPackages>
            <ent:numberOfPackages>${g.packages || 1}</ent:numberOfPackages>
            <ent:shippingMarks>${g.shippingMarks || 'N/M'}</ent:shippingMarks>
          </ent:Packaging>
          <ent:SupportingDocument>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:type>N380</ent:type>
            <ent:referenceNumber>${g.invoiceRef || 'INV-001'}</ent:referenceNumber>
          </ent:SupportingDocument>
        </ent:GoodsItem>`).join('');

  // DeliveryTerms: opcion 1 = UNLocode (R), opcion 2 = location (R) + country (R)
  const deliveryTermsXML = incotermUNLocode
    ? `<ent:DeliveryTerms>
            <ent:incotermCode>${incotermCode}</ent:incotermCode>
            <ent:UNLocode>${incotermUNLocode}</ent:UNLocode>
          </ent:DeliveryTerms>`
    : `<ent:DeliveryTerms>
            <ent:incotermCode>${incotermCode}</ent:incotermCode>
            <ent:location>${incotermLocation || 'Destino'}</ent:location>
            <ent:country>${incotermCountry || destinationCountry}</ent:country>
          </ent:DeliveryTerms>`;

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
          <ent:additionalDeclarationType>${additionalDeclarationType}</ent:additionalDeclarationType>
          <ent:security>${security}</ent:security>
          <ent:totalAmountInvoiced>${Number(totalInvoiced).toFixed(2)}</ent:totalAmountInvoiced>
          <ent:invoiceCurrency>${invoiceCurrency}</ent:invoiceCurrency>
        </ent:ExportOperation>
        <ent:CustomsOfficeOfExport>
          <ent:referenceNumber>${customsOfficeExport}</ent:referenceNumber>
        </ent:CustomsOfficeOfExport>
        <ent:CustomsOfficeOfExitDeclared>
          <ent:referenceNumber>${customsOfficeExit}</ent:referenceNumber>
        </ent:CustomsOfficeOfExitDeclared>
        <ent:Exporter>
          <ent:identificationNumber>${exporterEORI}</ent:identificationNumber>${!exporterEORI ? `
          <ent:name>${exporterName}</ent:name>
          <ent:Address>
            <ent:streetAndNumber>${exporterStreet}</ent:streetAndNumber>
            <ent:postcode>${exporterPostcode}</ent:postcode>
            <ent:city>${exporterCity}</ent:city>
            <ent:country>${exporterCountry}</ent:country>
          </ent:Address>` : ''}
        </ent:Exporter>
        <ent:Declarant>
          <ent:identificationNumber>${declarantEORI || exporterEORI}</ent:identificationNumber>
          <ent:ContactPerson>
            <ent:name>${declarantContactName || declarantName || 'Despacho'}</ent:name>
            <ent:phoneNumber>${declarantContactPhone || '+34976000000'}</ent:phoneNumber>
            <ent:eMailAddress>${declarantContactEmail || 'despacho@strixai.es'}</ent:eMailAddress>
          </ent:ContactPerson>
        </ent:Declarant>
        <ent:GoodsShipment>
          <ent:natureOfTransaction>${natureOfTransaction}</ent:natureOfTransaction>
          <ent:countryOfExport>${countryOfExport}</ent:countryOfExport>
          <ent:countryOfDestination>${destinationCountry}</ent:countryOfDestination>
          ${deliveryTermsXML}
          <ent:Consignment>
            <ent:containerIndicator>0</ent:containerIndicator>
            <ent:inlandModeOfTransport>${inlandModeOfTransport}</ent:inlandModeOfTransport>
            <ent:modeOfTransportAtTheBorder>${modeOfTransportAtBorder}</ent:modeOfTransportAtTheBorder>
            <ent:grossMass>${totalGross.toFixed(3)}</ent:grossMass>
            <ent:Consignee>
              <ent:identificationNumber>${consigneeEORI}</ent:identificationNumber>${!consigneeEORI ? `
              <ent:name>${consigneeName}</ent:name>
              <ent:Address>
                <ent:streetAndNumber>${consigneeStreet}</ent:streetAndNumber>
                <ent:postcode>${consigneePostcode}</ent:postcode>
                <ent:city>${consigneeCity}</ent:city>
                <ent:country>${consigneeCountry || destinationCountry}</ent:country>
              </ent:Address>` : ''}
            </ent:Consignee>
            <ent:LocationOfGoods>
              <ent:typeOfLocation>${locationOfGoodsType}</ent:typeOfLocation>
              <ent:qualifierOfIdentification>${locationOfGoodsQualifier}</ent:qualifierOfIdentification>
              <ent:authorisationNumber>${locationAuthorisationNumber || customsOfficeExport}</ent:authorisationNumber>
            </ent:LocationOfGoods>
            <ent:DepartureTransportMeans>
              <ent:sequenceNumber>1</ent:sequenceNumber>
              <ent:typeOfIdentification>${departureTransportType}</ent:typeOfIdentification>
              <ent:identificationNumber>${departureTransportId || 'UNKNOWN'}</ent:identificationNumber>
              <ent:nationality>${departureTransportCountry || countryOfExport}</ent:nationality>
            </ent:DepartureTransportMeans>
            <ent:ActiveBorderTransportMeans>
              <ent:typeOfIdentification>${activeBorderTransportType}</ent:typeOfIdentification>
              <ent:identificationNumber>${activeBorderTransportId || departureTransportId || 'UNKNOWN'}</ent:identificationNumber>
              <ent:nationality>${activeBorderTransportCountry || departureTransportCountry || countryOfExport}</ent:nationality>
            </ent:ActiveBorderTransportMeans>
            <ent:TransportDocument>
              <ent:sequenceNumber>1</ent:sequenceNumber>
              <ent:type>${transportDocType}</ent:type>
              <ent:referenceNumber>${transportDocRef || 'TD-' + transId.substring(0, 8)}</ent:referenceNumber>
            </ent:TransportDocument>
          </ent:Consignment>${itemsXML}
        </ent:GoodsShipment>
      </ent:CC515C>
    </ent:CC515CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildAESExportXML };
