/**
 * SOIVRE XML Builder - Alta de solicitud de inspeccion SOIVRE
 * Schema: SOIVREaltaV1Ent.xsd (formato AEAT propio con SegmentosDeServicio)
 * Endpoint: /L/inwinvoc/es.aeat.dit.adu.ad44.soivre.SOIVREaltaV1SOAP
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/ad44/soivre/SOIVREaltaV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de alta solicitud SOIVRE
 */
function buildSOIVREAltaXML(data) {
  const {
    // Operacion
    operacion = 'Alta', tipoDocumento = 'DUA',
    referencia = '', docucice1 = '',
    // Especificidades
    especificidades = [],
    // MRN y partida
    mrnPartidaClaveZeta = '',
    // Centro e inspeccion
    codCice = '', codPi = '',
    // Unidades
    unidadesMercancia = 'PCE', cantidadMercancia = 0,
    // DUA precedente
    duaPrecedente = '', soivrePrecedente = '',
    // Contacto
    correoElectronico = '',
    // Tipo declaracion
    tipoDeclaracion = 'Expediente SOIVRE nuevo',
    // Producto
    codigoSoivreProducto = '',
    // Certificados
    certificadoCOM = 'Declaracion Normal',
    certificadoROHS = '',
    certificadoRAEE = '',
    // RII
    numeroRIIRAEE = '', numeroRIIPyA = '',
    test = true
  } = data;

  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);

  const especXML = especificidades.map(e => `
      <Especificidad>${e}</Especificidad>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:SOIVREaltaV1Ent xmlns:ent="${NS_ENT}">
      <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${test ? ' Test="S"' : ''}/>
      <Operacion>${operacion}</Operacion>
      <TipoDocumento>${tipoDocumento}</TipoDocumento>
      <Referencia>${referencia}</Referencia>
      <Docucice1>${docucice1}</Docucice1>${especXML}
      <MRNPartidaClaveZeta>${mrnPartidaClaveZeta}</MRNPartidaClaveZeta>
      <UnidadesDeMercancia>${unidadesMercancia}</UnidadesDeMercancia>
      <CantidadDeMercancia>${cantidadMercancia}</CantidadDeMercancia>${duaPrecedente ? `
      <DuaPrecedente>${duaPrecedente}</DuaPrecedente>` : ''}${soivrePrecedente ? `
      <IdSoivrePrecedente>${soivrePrecedente}</IdSoivrePrecedente>` : ''}
      <CodCice>${codCice}</CodCice>
      <CodPi>${codPi}</CodPi>
      <CorreoElectronicoContacto>${correoElectronico}</CorreoElectronicoContacto>
      <TipoDeclaracion>${tipoDeclaracion}</TipoDeclaracion>${codigoSoivreProducto ? `
      <CodigoSoivreProducto>${codigoSoivreProducto}</CodigoSoivreProducto>` : ''}
      <CertificadoSolicitadoCOM>${certificadoCOM}</CertificadoSolicitadoCOM>${certificadoROHS ? `
      <CertificadoSolicitadoROHS>${certificadoROHS}</CertificadoSolicitadoROHS>` : ''}${certificadoRAEE ? `
      <CertificadoSolicitadoRAEE>${certificadoRAEE}</CertificadoSolicitadoRAEE>` : ''}${numeroRIIRAEE ? `
      <NumeroRIIRAEE>${numeroRIIRAEE}</NumeroRIIRAEE>` : ''}${numeroRIIPyA ? `
      <NumeroRIIPyA>${numeroRIIPyA}</NumeroRIIPyA>` : ''}
    </ent:SOIVREaltaV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildSOIVREAltaXML };
