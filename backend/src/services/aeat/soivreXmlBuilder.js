/**
 * PUE ROHS XML Builder - Solicitud de certificado ROHS/RAEE via PUE
 *
 * Schema: ROHSSolicitudCertificadoV1Ent.xsd
 * Namespace: https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/ad44/jdit/ws/rohs/ROHSSolicitudCertificadoV1Ent.xsd
 * WSDL: ROHSSolicitudCertificadoV1.wsdl
 *
 * Endpoints:
 *   PRE:  https://prewww1.aeat.es/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP
 *   PROD: https://www1.agenciatributaria.gob.es/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP
 *
 * Root: ROHSSolicitudCertificadoV1Ent con prefijo roh:
 * elementFormDefault="unqualified" - hijos sin prefijo
 * USA SegmentosDeServicio con Id, fecha, hora (como H1)
 *
 * Flujo PUE ROHS:
 *   1. Operador presenta DUA (H1/H7) con nomenclatura sujeta a ROHS
 *   2. AEAT identifica partidas ROHS y crea solicitud pendiente
 *   3. Operador envia datos complementarios via ROHS1 (este servicio)
 *   4. SOIVRE emite certificado (verde automatico o naranja/rojo inspeccion)
 *
 * Basado en: Guia del Desarrollador AEAT SOIVRE (PUE ROHS/RAEE)
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/ad44/jdit/ws/rohs/ROHSSolicitudCertificadoV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

// Endpoint correcto para PUE ROHS (descubierto del WSDL oficial)
const ENDPOINT_PRE = '/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP';
const ENDPOINT_PROD = '/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP';

/**
 * Construir XML de solicitud PUE ROHS/RAEE
 * @param {Object} data - Datos de la solicitud
 * @returns {string} XML SOAP completo
 *
 * Campos del formulario ROHS1:
 * - TipoOperacion: ALT (alta) / MOD (modificacion)
 * - Especificidades: codigos 01-28 (ROHS_EXEMPT, REFURBISH, etc.)
 * - ReferenciaDocucice: referencias opcionales
 * - TipoDocumento: DUA / DVD / Z
 * - MRNPartida: 23 chars (MRN + partida + clave zeta)
 * - UnidadDeMedidaDeMercancia: texto libre (max 50)
 * - CantidadDeUnidadesDeMercancia: entero
 * - CodCice: 2 chars (centro SOIVRE provincial)
 * - CodPI: 2 chars (punto de inspeccion)
 * - email: max 40 chars
 * - TipoDeclaracion: 01-07
 * - CertificadoSolicitadoROHS: 01=Normal / 02=No aplica / 03=Consultar
 * - CertificadoSolicitadoRAEE: 01=Normal / 02=No aplica / 03=Consultar
 * - CodigoRAEE: RII RAEE (max 50)
 * - CodigoPYA: RII Pilas y Acumuladores (max 50)
 */
function buildSOIVREAltaXML(data) {
  const {
    // Operacion
    tipoOperacion = 'ALT',  // ALT = Alta, MOD = Modificacion
    // Especificidades (array de codigos 2-char: 01-28)
    especificidades = [],
    // Referencias DOCUCICE
    referenciasDocucice = [],
    // Documento y MRN
    tipoDocumento = 'DUA',  // DUA / DVD / Z
    mrnPartida = '',        // 23 chars: MRN(18) + partida(4) + claveZeta(1)
    // Unidades
    unidadMercancia = '',   // texto libre (max 50)
    cantidadMercancia = 0,  // entero
    // Precedente (para modificaciones)
    mrnPartidaPrecedente = '',
    idSolSoivrePrecedente = '',
    // Centro y punto inspeccion
    codCice = '',  // 2 chars (codigo centro SOIVRE provincial)
    codPi = '',    // 2 chars (codigo punto inspeccion)
    // Contacto
    email = '',    // max 40 chars
    // Tipo declaracion
    tipoDeclaracion = '01',  // 01-07
    // Certificados solicitados
    certificadoROHS = '01',  // 01=Normal, 02=No aplica, 03=Consultar
    certificadoRAEE = '01',  // 01=Normal, 02=No aplica, 03=Consultar
    // Codigos RII
    codigoRAEE = '',    // RII RAEE (max 50)
    codigoPYA = '',     // RII Pilas y Acumuladores (max 50)
    // Test
    test = true
  } = data;

  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);

  // Especificidades XML
  const especXML = especificidades.length > 0
    ? `\n      <Especificidades>${especificidades.map(v => `\n        <Valor>${v}</Valor>`).join('')}\n      </Especificidades>`
    : '';

  // Referencias DOCUCICE XML
  const refXML = referenciasDocucice.length > 0
    ? `\n      <ReferenciaDocucice>${referenciasDocucice.map(v => `\n        <Valor>${v}</Valor>`).join('')}\n      </ReferenciaDocucice>`
    : '';

  // MRN partido: si viene mrnPartidaClaveZeta del legacy, usarlo
  const mrn = mrnPartida || data.mrnPartidaClaveZeta || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:roh="${NS_ENT}">
  <soapenv:Header/>
  <soapenv:Body>
    <roh:ROHSSolicitudCertificadoV1Ent>
      <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${test ? ' Test="S"' : ''}/>
      <TipoOperacion>${tipoOperacion}</TipoOperacion>${especXML}${refXML}
      <TipoDocumento>${tipoDocumento}</TipoDocumento>
      <MRNPartida>${mrn}</MRNPartida>
      <UnidadDeMedidaDeMercancia>${unidadMercancia || 'unidades fisicas'}</UnidadDeMedidaDeMercancia>
      <CantidadDeUnidadesDeMercancia>${cantidadMercancia || 1}</CantidadDeUnidadesDeMercancia>${mrnPartidaPrecedente ? `
      <MRNPartidaPrecedente>${mrnPartidaPrecedente}</MRNPartidaPrecedente>` : ''}${idSolSoivrePrecedente ? `
      <IdSolSoivrePrecedente>${idSolSoivrePrecedente}</IdSolSoivrePrecedente>` : ''}
      <CodCice>${codCice}</CodCice>
      <CodPI>${codPi}</CodPI>
      <email>${email}</email>
      <TipoDeclaracion>${tipoDeclaracion}</TipoDeclaracion>
      <CertificadoSolicitadoROHS>${certificadoROHS}</CertificadoSolicitadoROHS>
      <CertificadoSolicitadoRAEE>${certificadoRAEE}</CertificadoSolicitadoRAEE>${codigoRAEE ? `
      <CodigoRAEE>${codigoRAEE}</CodigoRAEE>` : ''}${codigoPYA ? `
      <CodigoPYA>${codigoPYA}</CodigoPYA>` : ''}
    </roh:ROHSSolicitudCertificadoV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildSOIVREAltaXML, ENDPOINT_PRE, ENDPOINT_PROD };
