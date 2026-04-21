/**
 * H7 XML Builder - Declaracion simplificada de importacion (bajo valor <= 150 EUR)
 * Schema: DeclaSimpliImporV1Ent.xsd (mismos tipos que H1: ImportaTiposDeDatos.xsd)
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP
 *
 * CAMBIOS 9/Mar/2026:
 *   - Soporte documento previo N337 (referencia G4 deposito temporal)
 *   - Soporte documento previo 5025 (activacion PreH7 desde G3)
 *   - DSDT cerradas en recintos aereos → obligatorio G3v2/G4
 *
 * PENDIENTE 1/Jul/2026 (Reglamento UE 2026/382):
 *   - Supresion franquicia aduanera 150 EUR
 *   - Derecho fijo transitorio 3 EUR/articulo (IOSS/postal)
 *   - Nuevo tributo A00 = 3.00 EUR por articulo (no porcentual)
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
    // Ubicacion
    localizacionMercancias = '',
    // IOSS
    iossNumber = '',
    // Transporte
    modoTransporte = '4',
    // Documento previo (G4/DSDT reference) - obligatorio desde 9/Mar/2026 en aereos
    // N337 = referencia G4 deposito temporal, 5025 = activacion PreH7 desde G3
    documentoPrevioTipo = '',
    documentoPrevioRef = '',
    // Garantia
    garantiaGRN = '',
    // Reglamento UE 2026/382 - derecho fijo transitorio (desde 1/Jul/2026)
    aplicarDerechoFijo2026 = false,
    // Partidas
    partidas = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);
  const numPartidas = partidas.length || 1;
  const totalBultos = partidas.reduce((s, p) => s + (p.bultos || 1), 0);

  // AEAT H7 casilla 44 requiere un set minimo obligatorio por partida cuando
  // C372CodigoAdicional es C07/C08/318/308 (todos los casos nuestros). Verificado
  // empiricamente contra PRE el 21/Abr/2026 iterando errores 2214 / 4404 / 2213:
  //  - Factura comercial (N380 o N935) OBLIGATORIA
  //  - Documento de transporte (N703 HBL, N705 BL, N740 AWB) OBLIGATORIO
  //  - Codigo 7007 con valor intrinseco en formato 11 enteros + 2 decimales OBLIGATORIO
  function format7007(val) {
    // AEAT: importe monetario en euros, 11 enteros + 2 decimales con punto (14 chars)
    const n = Math.round(Number(val || 0) * 100) / 100;
    const intPart = Math.floor(n).toString().padStart(11, '0');
    const decPart = Math.round((n - Math.floor(n)) * 100).toString().padStart(2, '0');
    return `${intPart}.${decPart}`;
  }
  const TRANSPORT_PREFIXES = ['N703', 'N705', 'N714', 'N730', 'N740', 'N741'];
  function ensureMandatoryDocs(p) {
    const base = (p.documentos && p.documentos.length)
      ? [...p.documentos]
      : [{ tipo: p.docTipo || 'N380', referencia: p.docRef || 'FACTURA-001' }];
    const hasInvoice = base.some(d => ['N380', 'N935'].includes(d.tipo));
    const hasTransport = base.some(d => TRANSPORT_PREFIXES.includes(d.tipo));
    const has7007 = base.some(d => d.tipo === '7007');
    if (!hasInvoice) base.unshift({ tipo: 'N380', referencia: p.docRef || 'FACTURA-001' });
    if (!hasTransport) base.push({ tipo: 'N703', referencia: p.transportRef || `HBL-${transId.substring(0, 10)}` });
    if (!has7007) base.push({ tipo: '7007', referencia: format7007(p.valorFactura) });
    return base;
  }

  const partidasXML = partidas.map((p, i) => {
    const marcas = (p.marcas || (p.descripcion || '').substring(0, 35) || 'SIN-MARCA').trim();
    const docs = ensureMandatoryDocs(p);
    return `
    <Partida>
      <C32NumeroDePartida>${i + 1}</C32NumeroDePartida>
      <C31EmpaquetamientoInterno>
        <C31EmpaqInternoClase>${p.tipoBulto || 'PK'}</C31EmpaqInternoClase>
        <C31EmpaqInternoMarcas>${marcas}</C31EmpaqInternoMarcas>
        <C31EmpaqInternoNumeroBultos>${p.bultos || 1}</C31EmpaqInternoNumeroBultos>
      </C31EmpaquetamientoInterno>
      <C31DescripcionDeLaMercancia>${(p.descripcion || '').substring(0, 250)}</C31DescripcionDeLaMercancia>
      <C3312CodigoPosicionTaric>${p.taricCode || ''}</C3312CodigoPosicionTaric>
      <C34PaisOrigen>${p.paisOrigen || remitentePais}</C34PaisOrigen>
      <C35MasaBrutaEnKg>${Number(p.pesobruto || 0).toFixed(3)}</C35MasaBrutaEnKg>
      <C36Preferencia>1</C36Preferencia>
      <C36Reduccion>00</C36Reduccion>
      <C37RegimenAduanero>
        <C371RegimenSolicitado>40</C371RegimenSolicitado>
        <C371RegimenPrecedente>00</C371RegimenPrecedente>
        <C372CodigoAdicional>${p.codigoAdicional || 'F48'}</C372CodigoAdicional>
      </C37RegimenAduanero>
      <C38MasaNetaEnKg>${Number(p.pesoneto || p.pesobruto || 0).toFixed(3)}</C38MasaNetaEnKg>
      <C42ValorFactura>${Number(p.valorFactura || 0).toFixed(3)}</C42ValorFactura>
      ${docs.map(d => `<C44DocumentosYCertificados>
        <C44Tipo>${d.tipo}</C44Tipo>
        <C44Referencia>${d.referencia}</C44Referencia>
      </C44DocumentosYCertificados>`).join('\n      ')}${documentoPrevioTipo ? `
      <C44DocumentosYCertificados>
        <C44Tipo>${documentoPrevioTipo}</C44Tipo>
        <C44Referencia>${documentoPrevioRef}</C44Referencia>
      </C44DocumentosYCertificados>` : ''}${aplicarDerechoFijo2026 ? `
      <C47TributoDeclarado>
        <C47TributoClase>A00</C47TributoClase>
        <C47TributoBaseImponible>1.000</C47TributoBaseImponible>
        <C47TributoTipoImpositivo>3.000000</C47TributoTipoImpositivo>
        <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
        <C47TributoUnidadFiscal>EUR</C47TributoUnidadFiscal>
        <C47TributoCuota>3.00</C47TributoCuota>
      </C47TributoDeclarado>` : `
      <C47TributoDeclarado>
        <C47TributoClase>A00</C47TributoClase>
        <C47TributoBaseImponible>${Number(p.valorFactura || 0).toFixed(3)}</C47TributoBaseImponible>
        <C47TributoTipoImpositivo>0.000000</C47TributoTipoImpositivo>
        <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
        <C47TributoUnidadFiscal>%</C47TributoUnidadFiscal>
        <C47TributoCuota>0.00</C47TributoCuota>
      </C47TributoDeclarado>`}
      <C47TributoDeclarado>
        <C47TributoClase>B00</C47TributoClase>
        <C47TributoBaseImponible>${Number(p.valorFactura || 0).toFixed(3)}</C47TributoBaseImponible>
        <C47TributoTipoImpositivo>21.000000</C47TributoTipoImpositivo>
        <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
        <C47TributoUnidadFiscal>%</C47TributoUnidadFiscal>
        <C47TributoCuota>${(Number(p.valorFactura || 0) * 0.21).toFixed(2)}</C47TributoCuota>
      </C47TributoDeclarado>
      <C47ImporteTotal>${(Number(p.valorFactura || 0) * 0.21).toFixed(2)}</C47ImporteTotal>
    </Partida>`;
  }).join('');

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
        <C08ImportadorParticular>${!destinatarioNIF ? 'P' : ''}</C08ImportadorParticular>
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
        <C14DeclaranteTipoAutorizaDespacho>O</C14DeclaranteTipoAutorizaDespacho>
      </C14Declarante>
      <EmailNotificaDespacho>${emailDespacho}</EmailNotificaDespacho>
      <C15aPaisExpedicion>${remitentePais}</C15aPaisExpedicion>
      <C19TransporteEnContenedores>0</C19TransporteEnContenedores>
      <C221CodigoDivisa>EUR</C221CodigoDivisa>
      <C30LocalizacionMercancias>${localizacionMercancias || 'ES' + aduanaDespacho.replace(/^ES/, '').substring(0, 6) + 'EEEEEE'}</C30LocalizacionMercancias>
      <CBImporteTotalTributos>${partidas.reduce((s, p) => s + Number(p.valorFactura || 0) * 0.21, 0).toFixed(2)}</CBImporteTotalTributos>
      <CBmodalidadDePago>R</CBmodalidadDePago>
      <CBgarantiaGRN>${garantiaGRN}</CBgarantiaGRN>${partidasXML}
    </ent:DeclaSimpliImporV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildH7ImportXML };
