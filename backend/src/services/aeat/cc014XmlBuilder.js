/**
 * Solicitud de invalidacion de una declaracion o predeclaracion de transito
 * (CC014C, servicio CC014CV1). Guia «Servicios Web de Transito NCTS6» v1.21,
 * cap. 10: solo se admite en estado PA (predeclaracion) o PG (pendiente de
 * garantia extranjera); en PD o DE hay que pedirla en la aduana por registro.
 *
 * Campos (10.4): MRN «es R», LRN «No se puede rellenar»; de Invalidation solo
 * initiatedByCustoms = 0 (a peticion del operador) y justification «es R»;
 * aduana de partida y titular iguales a los del CC015C. Nombre, direccion y
 * contacto del titular «No se puede rellenar».
 */
const { xml } = require('./xmlTemplate');
const { generateTransactionId } = require('./queryXmlBuilder');
const { fechaHora } = require('./h1CauXmlBuilder');
const { exigirMrn, exigirRemitente } = require('./aesNctsConsulta');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC014CV1Ent.xsd';
const MAX_MOTIVO = 512; // JustificationContentType02: an..512
const FORMATO_ADUANA = /^[A-Z]{2}[A-Z0-9]{6}$/;

/**
 * @param {{ mrn: string, officeOfDeparture: string, holderEORI: string, motivo: string,
 *   sender: string, mensajeId?: string, fecha?: Date }} datos
 * @returns {string} sobre SOAP
 */
function buildCC014InvalidationXML({ mrn, officeOfDeparture, holderEORI, motivo, sender, mensajeId = `LUCIN${generateTransactionId()}`, fecha = new Date() }) {
  const mrnLimpio = exigirMrn(mrn, 'la invalidación');
  const remitente = exigirRemitente(sender, 'la invalidación');
  const aduana = String(officeOfDeparture || '').trim().toUpperCase();
  if (!FORMATO_ADUANA.test(aduana)) throw new Error('Falta la aduana de partida declarada en el CC015C (8 caracteres)');
  const titular = String(holderEORI || '').trim().toUpperCase();
  if (!titular) throw new Error('Falta el titular del tránsito declarado en el CC015C');
  const justificacion = String(motivo ?? '').trim();
  if (!justificacion) throw new Error('Indique el motivo de la anulación: la AEAT lo exige');
  if (justificacion.length > MAX_MOTIVO) throw new Error(`El motivo de la anulación no puede pasar de ${MAX_MOTIVO} caracteres`);

  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC014CV1Ent xmlns:ent="${NS_ENT}" Id="${mensajeId}">
      <ent:CC014C>
        <ent:messageSender>${remitente}</ent:messageSender>
        <ent:messageRecipient>NTA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${fechaHora(fecha)}</ent:preparationDateAndTime>
        <ent:messageIdentification>${mensajeId.substring(0, 35)}</ent:messageIdentification>
        <ent:messageType>CC014C</ent:messageType>
        <ent:TransitOperation><ent:MRN>${mrnLimpio}</ent:MRN></ent:TransitOperation>
        <ent:Invalidation>
          <ent:initiatedByCustoms>0</ent:initiatedByCustoms>
          <ent:justification>${justificacion}</ent:justification>
        </ent:Invalidation>
        <ent:CustomsOfficeOfDeparture><ent:referenceNumber>${aduana}</ent:referenceNumber></ent:CustomsOfficeOfDeparture>
        <ent:HolderOfTheTransitProcedure><ent:identificationNumber>${titular}</ent:identificationNumber></ent:HolderOfTheTransitProcedure>
      </ent:CC014C>
    </ent:CC014CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`);
}

module.exports = { buildCC014InvalidationXML, MAX_MOTIVO };
