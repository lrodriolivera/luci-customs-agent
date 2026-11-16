/**
 * Notificacion de presentacion de las mercancias en la aduana de partida
 * (CC170C, servicio CC170CV1). Guia NCTS6 v1.21, cap. 9: obligatoria cuando la
 * declaracion se presento como predeclaracion (additionalDeclarationType D) y
 * solo en estado PA. Convierte la predeclaracion en declaracion (D -> A), data
 * la sumaria o el documento de deposito, traba la garantia y deja el transito
 * en PG, PD o DE segun garantias y circuito.
 *
 * La predeclaracion se identifica por LRN + titular (9.4). La ubicacion
 * (LocationOfGoods B/Y con codigo de 10: recinto 4 + ubicacion 6) es obligatoria;
 * el resto de grupos modificables (contenedor, transporte...) solo se mandan si
 * cambian, y sustituyen completos a los de la predeclaracion: LUCI no los manda.
 */
const { xml } = require('./xmlTemplate');
const { generateTransactionId } = require('./queryXmlBuilder');
const { fechaHora } = require('./h1CauXmlBuilder');
const { exigirRemitente } = require('./aesNctsConsulta');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC170CV1Ent.xsd';
const FORMATO_ADUANA = /^[A-Z]{2}[A-Z0-9]{6}$/;
const FORMATO_UBICACION = /^[A-Z0-9]{10}$/;
const FORMATO_LRN = /^.{1,22}$/;

/**
 * @param {{ lrn: string, officeOfDeparture: string, holderEORI: string,
 *   locationAuthorisationNumber: string, sender: string, mensajeId?: string, fecha?: Date }} datos
 * @returns {string} sobre SOAP
 */
function buildCC170PresentationXML({ lrn, officeOfDeparture, holderEORI, locationAuthorisationNumber, sender, mensajeId = `LUCIN${generateTransactionId()}`, fecha = new Date() }) {
  const remitente = exigirRemitente(sender, 'la presentación');
  const lrnLimpio = String(lrn || '').trim();
  if (!FORMATO_LRN.test(lrnLimpio)) throw new Error('Falta el LRN de la predeclaración (hasta 22 caracteres)');
  const aduana = String(officeOfDeparture || '').trim().toUpperCase();
  if (!FORMATO_ADUANA.test(aduana)) throw new Error('Falta la aduana de partida declarada en el CC015C (8 caracteres)');
  const titular = String(holderEORI || '').trim().toUpperCase();
  if (!titular) throw new Error('Falta el titular del tránsito declarado en el CC015C');
  const ubicacion = String(locationAuthorisationNumber || '').trim().toUpperCase();
  if (!FORMATO_UBICACION.test(ubicacion)) {
    throw new Error('Indique la ubicación de la mercancía en la aduana de partida: 10 caracteres, recinto (4) + ubicación (6), p. ej. 2801AAAAAA');
  }

  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC170CV1Ent xmlns:ent="${NS_ENT}" Id="${mensajeId}">
      <ent:CC170C>
        <ent:messageSender>${remitente}</ent:messageSender>
        <ent:messageRecipient>NTA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${fechaHora(fecha)}</ent:preparationDateAndTime>
        <ent:messageIdentification>${mensajeId.substring(0, 35)}</ent:messageIdentification>
        <ent:messageType>CC170C</ent:messageType>
        <ent:TransitOperation><ent:LRN>${lrnLimpio}</ent:LRN></ent:TransitOperation>
        <ent:CustomsOfficeOfDeparture><ent:referenceNumber>${aduana}</ent:referenceNumber></ent:CustomsOfficeOfDeparture>
        <ent:HolderOfTheTransitProcedure><ent:identificationNumber>${titular}</ent:identificationNumber></ent:HolderOfTheTransitProcedure>
        <ent:Consignment>
          <ent:LocationOfGoods><ent:typeOfLocation>B</ent:typeOfLocation><ent:qualifierOfIdentification>Y</ent:qualifierOfIdentification><ent:authorisationNumber>${ubicacion}</ent:authorisationNumber></ent:LocationOfGoods>
        </ent:Consignment>
      </ent:CC170C>
    </ent:CC170CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`);
}

module.exports = { buildCC170PresentationXML };
