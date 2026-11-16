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

const { xml } = require('./xmlTemplate');
const { generateTransactionId } = require('./queryXmlBuilder');
const { fechaHora } = require('./h1CauXmlBuilder');
const { exigirMrn, exigirRemitente } = require('./aesNctsConsulta');
const { ErrorValidacion } = require('../forms/identificadorAduanero');
const NS_BASE = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5';
const NS_ENT = `${NS_BASE}/CC015CV1Ent.xsd`;
const NS_ENT_CC013 = `${NS_BASE}/CC013CV1Ent.xsd`;
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * El NCTS exige la subpartida SA (6 cifras, tabla CSRDT152) Y el codigo NC
 * (2 cifras): en la guia NCTS6 v1.21 el combinedNomenclatureCode es «D» con
 * guia «Es 'R'» y «la concatenacion de Harmonized system sub-heading code y
 * Combined nomenclature code tiene que existir en la base de TARIC». Antes, un
 * codigo de 6 cifras salia con un «00» inventado: un codigo que puede no existir
 * y que la AEAT rechaza con un error que no nombra la partida, o peor, que
 * existe y no es la mercancia. Se corta antes de construir el XML.
 */
function _codigoLimpio(taric) {
  return String(taric || '').replace(/[\s.]/g, '');
}

function validarCodigosMercancia(goodsItems = []) {
  const errores = [];
  goodsItems.forEach((g, i) => {
    if (!/^\d{8}/.test(_codigoLimpio(g?.taricCode))) {
      errores.push(`Partida ${i + 1}: el código de mercancía «${g?.taricCode || ''}» no tiene las 8 cifras de la Nomenclatura Combinada `
        + '(subpartida SA de 6 + código NC de 2); el NCTS no admite completarlo y exige que exista en el TARIC');
    }
  });
  if (errores.length) {
    throw new ErrorValidacion(`No se puede presentar el tránsito: ${errores.join('; ')}`, { code: 'CODIGO_NC_INCOMPLETO', errors: errores });
  }
}

/**
 * Bloques comunes a la declaracion (CC015C) y a su modificacion (CC013C): todo
 * lo que va tras TransitOperation. El CC013C «debe ser rellenado con todos los
 * datos de la predeclaracion, no solo con los que cambian» (guia 4.4.1), y sus
 * reglas son las del CC015C, asi que ambos salen de aqui.
 */
function _cuerpoDeclaracion(data, idRespaldo) {
  const {
    lrn = '',
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

  validarCodigosMercancia(consignment.goodsItems || []);
  const totalGross = (consignment.goodsItems || []).reduce((s, g) => s + (g.grossWeight || 0), 0);
  const totalItems = (consignment.goodsItems || []).length || 1;

  const transitOfficesXML = transitOffices.map(o => xml`
        <ent:CustomsOfficeOfTransitDeclared>
          <ent:sequenceNumber>${o.sequence || 1}</ent:sequenceNumber>
          <ent:referenceNumber>${o.code}</ent:referenceNumber>
        </ent:CustomsOfficeOfTransitDeclared>`);

  const itemsXML = (consignment.goodsItems || []).map((g, i) => xml`
          <ent:HouseConsignment>
            <ent:sequenceNumber>${i + 1}</ent:sequenceNumber>
            <ent:grossMass>${Number(g.grossWeight || 0).toFixed(3)}</ent:grossMass>${g.consigneeEORI || data.consigneeEORI || consignment.consigneeEORI ? xml`
            <ent:Consignee>
              <ent:identificationNumber>${g.consigneeEORI || data.consigneeEORI || consignment.consigneeEORI}</ent:identificationNumber>
            </ent:Consignee>` : (g.consigneeName || consignment.consigneeName) ? xml`
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
                  <ent:harmonizedSystemSubHeadingCode>${_codigoLimpio(g.taricCode).substring(0, 6)}</ent:harmonizedSystemSubHeadingCode>
                  <ent:combinedNomenclatureCode>${_codigoLimpio(g.taricCode).substring(6, 8)}</ent:combinedNomenclatureCode>
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
              </ent:Packaging>${g.previousDocumentType ? xml`
              <ent:PreviousDocument>
                <ent:sequenceNumber>1</ent:sequenceNumber>
                <ent:type>${g.previousDocumentType}</ent:type>
                <ent:referenceNumber>${g.previousDocumentRef}</ent:referenceNumber>
                <ent:goodsItemNumber>${parseInt(g.previousDocumentItem || '1', 10)}</ent:goodsItemNumber>${g.previousDocumentType === 'NMRN' ? xml`
                <ent:measurementUnitAndQualifier>KGM</ent:measurementUnitAndQualifier>
                <ent:quantity>${Number(g.netWeight || g.grossWeight || 1).toFixed(3)}</ent:quantity>` : ''}
              </ent:PreviousDocument>` : ''}
            </ent:ConsignmentItem>
          </ent:HouseConsignment>`);

  // Garantia: tipo 0,1,3,4 necesitan GRN; tipo 2,6,8 necesitan 1 GuaranteeReference sin GRN
  const needsGRN = ['0', '1', '3', '4'].includes(guaranteeType);
  const needsRefNoGRN = ['2', '6', '8'].includes(guaranteeType);

  return xml`${data.authorisationNumber ? xml`
        <ent:Authorisation>
          <ent:sequenceNumber>1</ent:sequenceNumber>
          <ent:type>C521</ent:type>
          <ent:referenceNumber>${data.authorisationNumber}</ent:referenceNumber>
        </ent:Authorisation>` : ''}
        <ent:CustomsOfficeOfDeparture>
          <ent:referenceNumber>${officeOfDeparture}</ent:referenceNumber>
        </ent:CustomsOfficeOfDeparture>
        <ent:CustomsOfficeOfDestinationDeclared>
          <ent:referenceNumber>${officeOfDestination}</ent:referenceNumber>
        </ent:CustomsOfficeOfDestinationDeclared>${transitOfficesXML}
        <ent:HolderOfTheTransitProcedure>
          <ent:identificationNumber>${holderEORI}</ent:identificationNumber>${!holderEORI ? xml`
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
            <ent:eMailAddress>${holderContactEmail || 'despacho@strixai.ai'}</ent:eMailAddress>
          </ent:ContactPerson>
        </ent:HolderOfTheTransitProcedure>
        <ent:Guarantee>
          <ent:sequenceNumber>1</ent:sequenceNumber>
          <ent:guaranteeType>${guaranteeType}</ent:guaranteeType>${needsGRN ? xml`
          <ent:GuaranteeReference>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:GRN>${guaranteeGRN}</ent:GRN>
            <ent:accessCode>${guaranteeAccessCode || '0000'}</ent:accessCode>
            <ent:amountToBeCovered>${Number(data.guaranteeAmount || totalGross * 10 || 10000).toFixed(2)}</ent:amountToBeCovered>
          </ent:GuaranteeReference>` : ''}${needsRefNoGRN ? xml`
          <ent:GuaranteeReference>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:amountToBeCovered>0.00</ent:amountToBeCovered>
          </ent:GuaranteeReference>` : ''}
        </ent:Guarantee>
        <ent:Consignment>
          <ent:containerIndicator>0</ent:containerIndicator>
          <ent:grossMass>${totalGross.toFixed(3)}</ent:grossMass>
          <ent:referenceNumberUCR>${data.referenceNumberUCR || lrn || idRespaldo}</ent:referenceNumberUCR>
          <ent:LocationOfGoods>
            <ent:typeOfLocation>B</ent:typeOfLocation>
            <ent:qualifierOfIdentification>Y</ent:qualifierOfIdentification>
            <ent:authorisationNumber>${data.locationAuthorisationNumber || officeOfDeparture + '001'}</ent:authorisationNumber>
          </ent:LocationOfGoods>
          <ent:PlaceOfLoading>
            <ent:country>${placeOfLoadingCountry || holderCountry}</ent:country>
            <ent:location>${placeOfLoadingLocation || holderCity || 'Zaragoza'}</ent:location>
          </ent:PlaceOfLoading>${itemsXML}
        </ent:Consignment>`;
}

/**
 * Construir XML de declaracion NCTS transito (CC015C). Con
 * additionalDeclarationType 'D' es una predeclaracion (estado PA).
 */
function buildNCTSTransitXML(data) {
  const {
    lrn = '', transitType = 'T1', securityIndicator = '0',
    additionalDeclarationType = 'A', holderEORI = ''
  } = data;
  const transId = generateTransactionId();
  const cuerpo = _cuerpoDeclaracion(data, transId);

  return xml`<?xml version="1.0" encoding="UTF-8"?>
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
        </ent:TransitOperation>${cuerpo}
      </ent:CC015C>
    </ent:CC015CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`.toString();
}

/**
 * Modificacion de una predeclaracion (CC013C, servicio CC013CV1). Solo se admite
 * en estado PA (guia 4.3). Lleva el MRN y no el LRN («No se puede rellenar»),
 * amendmentTypeFlag 0 (modificacion completa) y el resto de la declaracion
 * entera. No pueden cambiar respecto del CC015C: additionalDeclarationType,
 * security, aduana de partida, titular y representante (guia 11.1); eso lo
 * comprueba transitService antes de llegar aqui.
 *
 * @param {object} data  los del CC015C mas `mrn`, `messageSender` (NIF del
 *   firmante; se le quita el ES), y opcionales `mensajeId` y `fecha`.
 */
function buildCC013AmendmentXML(data) {
  const {
    mrn, messageSender, mensajeId = `LUCIN${generateTransactionId()}`, fecha = new Date(),
    transitType = 'T1', securityIndicator = '0', additionalDeclarationType = 'D'
  } = data;
  const mrnLimpio = exigirMrn(mrn, 'la modificación');
  const remitente = exigirRemitente(messageSender, 'la modificación');
  const cuerpo = _cuerpoDeclaracion(data, mensajeId);

  return xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC013CV1Ent xmlns:ent="${NS_ENT_CC013}" Id="${mensajeId}">
      <ent:CC013C>
        <ent:messageSender>${remitente}</ent:messageSender>
        <ent:messageRecipient>NTA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${fechaHora(fecha)}</ent:preparationDateAndTime>
        <ent:messageIdentification>${mensajeId.substring(0, 35)}</ent:messageIdentification>
        <ent:messageType>CC013C</ent:messageType>
        <ent:TransitOperation>
          <ent:MRN>${mrnLimpio}</ent:MRN>
          <ent:declarationType>${transitType}</ent:declarationType>
          <ent:additionalDeclarationType>${additionalDeclarationType}</ent:additionalDeclarationType>
          <ent:security>${securityIndicator}</ent:security>
          <ent:reducedDatasetIndicator>0</ent:reducedDatasetIndicator>
          <ent:bindingItinerary>0</ent:bindingItinerary>
          <ent:amendmentTypeFlag>0</ent:amendmentTypeFlag>
        </ent:TransitOperation>${cuerpo}
      </ent:CC013C>
    </ent:CC013CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`.toString();
}

module.exports = { buildNCTSTransitXML, buildCC013AmendmentXML, validarCodigosMercancia };
