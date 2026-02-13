/**
 * H7 XML Builder - Declaracion simplificada de importacion (bajo valor <= 150 EUR)
 * Schema: DeclaSimpliImporV1Ent.xsd (mismos tipos que H1: ImportaTiposDeDatos.xsd)
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adip/ws/DeclaSimpliImporV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de declaracion H7 para la AEAT
 */
function buildH7ImportXML(data) {
  const {
    aduanaDespacho = '',
    // Exportador/Remitente
    remitenteNIF = '', remitenteNombre = '', remitentePais = '',
    // Destinatario
    destinatarioNIF = '', destinatarioNombre = '', destinatarioDireccion = '',
    destinatarioPoblacion = '', destinatarioCP = '', destinatarioPais = 'ES',
    // Declarante
    declaranteNIF = '', declaranteNombre = '',
    emailDespacho = '',
    formaRepresentacion = '2',
    // IOSS
    iossNumber = '',
    // Transporte
    modoTransporte = '4',
    // Partidas
    partidas = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);
  const numPartidas = partidas.length || 1;
  const totalBultos = partidas.reduce((s, p) => s + (p.bultos || 1), 0);

  const partidasXML = partidas.map((p, i) => `
    <Partida>
      <C32NumeroDePartida>${i + 1}</C32NumeroDePartida>
      <C31EmpaquetamientoInterno>
        <C31NumeroBultos>${p.bultos || 1}</C31NumeroBultos>
        <C31TipoBulto>${p.tipoBulto || 'PK'}</C31TipoBulto>
        <C31MarcasNumerosDeLosBultos>${p.marcas || ''}</C31MarcasNumerosDeLosBultos>
      </C31EmpaquetamientoInterno>
      <C31DescripcionDeLaMercancia>
        <C31DescrMerc1>${(p.descripcion || '').substring(0, 280)}</C31DescrMerc1>
      </C31DescripcionDeLaMercancia>
      <C3312CodigoPosicionTaric>${p.taricCode || ''}</C3312CodigoPosicionTaric>
      <C34PaisOrigen>${p.paisOrigen || remitentePais}</C34PaisOrigen>
      <C35MasaBrutaEnKg>${Number(p.pesobruto || 0).toFixed(3)}</C35MasaBrutaEnKg>
      <C36Preferencia>1</C36Preferencia>
      <C36Reduccion>00</C36Reduccion>
      <C37RegimenAduanero>
        <C371RegimenSolicitado>40</C371RegimenSolicitado>
        <C371RegimenPrecedente>00</C371RegimenPrecedente>
        <C372CodigoAdicional>C07</C372CodigoAdicional>
      </C37RegimenAduanero>
      <C38MasaNetaEnKg>${Number(p.pesoneto || p.pesobruto || 0).toFixed(3)}</C38MasaNetaEnKg>
      <C42ValorFactura>${Number(p.valorFactura || 0).toFixed(3)}</C42ValorFactura>
      <C46ValorEstadistico>${Number(p.valorFactura || 0).toFixed(2)}</C46ValorEstadistico>
      <C47ImporteTotal>0.00</C47ImporteTotal>
    </Partida>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:DeclaSimpliImporV1Ent xmlns:ent="${NS_ENT}">
      <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${test ? ' Test="S"' : ''}/>
      <CAaduana>${aduanaDespacho.replace(/^ES/, '').substring(0, 6)}</CAaduana>
      <C011EstatutoMercancias>IM</C011EstatutoMercancias>
      <C012ProcedimientoSolicitado>C</C012ProcedimientoSolicitado>
      <C05NumeroDePartidas>${numPartidas}</C05NumeroDePartidas>
      <C06TotalBultos>${totalBultos}</C06TotalBultos>
      <C08Importador>
        <C08ImportadorNID>${destinatarioNIF}</C08ImportadorNID>
        <C08ImportadorParticular></C08ImportadorParticular>
        <C08ImportadorRazonSocial>${destinatarioNombre}</C08ImportadorRazonSocial>
        <C08ImportadorDireccion>${destinatarioDireccion}</C08ImportadorDireccion>
        <C08ImportadorPoblacion>${destinatarioPoblacion}</C08ImportadorPoblacion>
        <C08ImportadorCodigoPostal>${destinatarioCP}</C08ImportadorCodigoPostal>
        <C08ImportadorPais>${destinatarioPais}</C08ImportadorPais>
      </C08Importador>
      <C14Declarante>
        <C14DeclaranteFormaRepresentacion>${formaRepresentacion}</C14DeclaranteFormaRepresentacion>
        <C14DeclaranteNID>${declaranteNIF}</C14DeclaranteNID>
        <C14DeclaranteRazonSocial>${declaranteNombre}</C14DeclaranteRazonSocial>
        <C14DeclaranteTipoAutorizaDespacho>G</C14DeclaranteTipoAutorizaDespacho>
      </C14Declarante>
      <EmailNotificaDespacho>${emailDespacho}</EmailNotificaDespacho>
      <C15aPaisExpedicion>${remitentePais}</C15aPaisExpedicion>
      <C30LocalizacionMercancias>ES${aduanaDespacho.replace(/^ES/, '').substring(0, 6)}LUCI01</C30LocalizacionMercancias>
      <CBImporteTotalTributos>0.00</CBImporteTotalTributos>
      <CBmodalidadDePago>A</CBmodalidadDePago>
      <C17aPaisDestino>ES</C17aPaisDestino>
      <C19TransporteEnContenedores>0</C19TransporteEnContenedores>
      <C20CondicionesDeEntrega>
        <C201CondicionesEntregaCodigo>DAP</C201CondicionesEntregaCodigo>
        <C202CondicionesEntregaNombre>DAP</C202CondicionesEntregaNombre>
        <C203CondicionesEntregaZona></C203CondicionesEntregaZona>
      </C20CondicionesDeEntrega>
      <C221CodigoDivisa>EUR</C221CodigoDivisa>
      <C222ImporteFactura>${partidas.reduce((s, p) => s + Number(p.valorFactura || 0), 0).toFixed(3)}</C222ImporteFactura>
      <C24NaturalezaTransaccion>11</C24NaturalezaTransaccion>
      <C25ModoTransporteFrontera>${modoTransporte}</C25ModoTransporteFrontera>${partidasXML}
    </ent:DeclaSimpliImporV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildH7ImportXML };
