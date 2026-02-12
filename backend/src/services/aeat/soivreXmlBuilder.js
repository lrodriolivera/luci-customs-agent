/**
 * SOIVRE/PUE XML Builder - Alta de certificado SOIVRE
 * Schema: SOIVREaltaV1Ent.xsd
 * Endpoint: /L/inwinvoc/es.aeat.dit.adu.ad44.soivre.SOIVREaltaV1SOAP
 * Root: SOIVREaltaV1Ent con atributo Id (elementFormDefault="unqualified")
 * SIN SegmentosDeServicio - usa Id como atributo del root element
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/ad44/soivre/SOIVREaltaV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de alta certificado SOIVRE
 */
function buildSOIVREAltaXML(data) {
  const {
    // Certificado
    tipoDeCertificado = 'ROHS',
    numeroDeCertificado = '',
    // Operador
    nifOperadorAutorizado = '',
    razonSocialOperadorAut = '',
    // Validez
    fechaInicioValidez = '',
    fechaFinValidez = '',
    // Control
    tipoDeControl = 'DOC',
    resultadoDelControl = 'FAVORABLE',
    // Producto
    codigoSoivreProducto = '',
    descripcionProducto = '',
    // MRN
    mrnPartidaClaveZeta = '',
    // Contacto
    correoElectronico = '',
    test = true
  } = data;

  const transId = generateTransactionId();

  // Fechas por defecto (hoy y +1 ano)
  const now = new Date();
  const inicio = fechaInicioValidez || `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const fin = fechaFinValidez || `${now.getFullYear() + 1}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:SOIVREaltaV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <tipoDeCertificado>${tipoDeCertificado}</tipoDeCertificado>
      <numeroDeCertificado>${numeroDeCertificado || 'CERT-' + transId.substring(0, 10)}</numeroDeCertificado>
      <nifOperadorAutorizado>${nifOperadorAutorizado}</nifOperadorAutorizado>
      <razonSocialOperadorAut>${razonSocialOperadorAut}</razonSocialOperadorAut>
      <fechaInicioValidez>${inicio}</fechaInicioValidez>
      <fechaFinValidez>${fin}</fechaFinValidez>
      <tipoDeControl>${tipoDeControl}</tipoDeControl>
      <resultadoDelControl>${resultadoDelControl}</resultadoDelControl>
      <codigoMercancia>${codigoSoivreProducto || '8471300000'}</codigoMercancia>
      <productos>
        <producto>
          <codigoSoivre>${codigoSoivreProducto || '000000'}</codigoSoivre>
          <descripcion>${descripcionProducto || 'Producto de importacion'}</descripcion>
        </producto>
      </productos>
    </ent:SOIVREaltaV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildSOIVREAltaXML };
