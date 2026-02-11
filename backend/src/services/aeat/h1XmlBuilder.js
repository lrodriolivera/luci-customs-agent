/**
 * H1 XML Builder - Genera XML segun schema ImportacionCompletaV1Ent.xsd de la AEAT
 * Namespace: https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adip/ws/ImportacionCompletaV1Ent.xsd
 *
 * Basado en el XSD oficial descargado de www3.agenciatributaria.gob.es
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adip/ws/ImportacionCompletaV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir el XML completo de una declaracion H1 para la AEAT
 * @param {Object} data - Datos de la declaracion
 * @returns {string} XML completo envuelto en SOAP envelope
 */
function buildH1ImportXML(data) {
  const {
    // Servicio
    tipoOperacion = 'DECL',  // DECL, PREC (predeclaracion), COMP (complementaria)
    // Casillas principales
    estatutoMercancias = 'IM',  // IM = Importacion desde pais tercero no AELC, CO = Comunitaria
    procedimiento = 'A',       // A = Declaracion completa
    // Exportador (C02)
    exportadorNIF = '',
    exportadorNombre = '',
    exportadorDireccion = '',
    exportadorPoblacion = '',
    exportadorCP = '',
    exportadorPais = '',
    // Importador (C08)
    importadorNIF = '',
    importadorNombre = '',
    importadorDireccion = '',
    importadorPoblacion = '',
    importadorCP = '',
    importadorPais = 'ES',
    importadorParticular = 'N',
    // Declarante (C14)
    declaranteNIF = 'B22477020',
    declaranteNombre = 'Stock Logistic S.L.',
    formaRepresentacion = '2',  // 2 = Representacion indirecta
    tipoAutorizaDespacho = 'G', // G = Global
    // Emails
    emailDespacho = '',
    emailOtras = '',
    // Paises y transporte
    paisExpedicion = '',
    paisDestino = 'ES',
    transporteLlegada = '',
    contenedores = '0',  // 0 = No, 1 = Si
    // Condiciones entrega (C20)
    incoterm = 'CIF',
    incotermNombre = '',
    incotermZona = '',
    // Divisa e importe
    divisa = 'EUR',
    importeFactura = 0,
    // Naturaleza transaccion
    naturalezaTransaccion = '11',  // 11 = Compraventa
    // Transporte
    modoTransporteFrontera = '1',  // 1=Mar, 2=Ferro, 3=Road, 4=Air
    modoTransporteInterior = '',
    // Aduana
    aduanaEntrada = '',
    localizacionMercancias = '',
    // Deposito
    identificacionDeposito = '',
    // Datos contables
    importeTotalTributos = 0,
    modalidadPago = 'A',  // A = Efectivo, E = Aplazamiento
    garantiaLevante = '',
    // Partidas
    partidas = [],
    // Numero de referencia (si es modificacion)
    mrn = '',
    // Referencia comercial
    referenciaComercial = ''
  } = data;

  const numPartidas = partidas.length || 1;
  const totalBultos = partidas.reduce((sum, p) => sum + (p.bultos || 0), 0);

  // Generar Id de transaccion unico (timestamp con microsegundos)
  const now = new Date();
  const transId = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    String(now.getMilliseconds()).padStart(3, '0') +
    String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  const fecha = transId.substring(0, 8);  // AAAAMMDD
  const hora = transId.substring(8, 14);  // HHMMSS
  const isTest = data.test !== false;  // Default to test mode

  // Construir XML de partidas
  const partidasXML = partidas.map((p, i) => {
    const tributos = [];
    // A00 - Derechos arancelarios
    if (p.arancelTipo != null) {
      tributos.push(`
        <C47TributoDeclarado>
          <C47TributoClase>A00</C47TributoClase>
          <C47TributoBaseImponible>${Number(p.valorFactura || 0).toFixed(3)}</C47TributoBaseImponible>
          <C47TributoTipoImpositivo>${Number(p.arancelTipo || 0).toFixed(6)}</C47TributoTipoImpositivo>
          <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
          <C47TributoUnidadFiscal>%</C47TributoUnidadFiscal>
          <C47TributoCuota>${Number(p.arancelImporte || 0).toFixed(2)}</C47TributoCuota>
        </C47TributoDeclarado>`);
    }
    // B00 - IVA
    if (p.ivaTipo != null) {
      const baseIVA = (p.valorFactura || 0) + (p.arancelImporte || 0);
      tributos.push(`
        <C47TributoDeclarado>
          <C47TributoClase>B00</C47TributoClase>
          <C47TributoBaseImponible>${Number(baseIVA).toFixed(3)}</C47TributoBaseImponible>
          <C47TributoTipoImpositivo>${Number(p.ivaTipo || 21).toFixed(6)}</C47TributoTipoImpositivo>
          <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
          <C47TributoUnidadFiscal>%</C47TributoUnidadFiscal>
          <C47TributoCuota>${Number(p.ivaImporte || 0).toFixed(2)}</C47TributoCuota>
        </C47TributoDeclarado>`);
    }

    const importeTotal = (p.arancelImporte || 0) + (p.ivaImporte || 0);

    return `
    <Partida>
      <C32NumeroDePartida>${i + 1}</C32NumeroDePartida>
      <C31EmpaquetamientoInterno>
        <C31NumeroBultos>${p.bultos || 1}</C31NumeroBultos>
        <C31TipoBulto>${p.tipoBulto || 'CT'}</C31TipoBulto>
        <C31MarcasNumerosDeLosBultos>${p.marcas || ''}</C31MarcasNumerosDeLosBultos>
      </C31EmpaquetamientoInterno>
      <C31DescripcionDeLaMercancia>
        <C31DescrMerc1>${(p.descripcion || '').substring(0, 280)}</C31DescrMerc1>
      </C31DescripcionDeLaMercancia>
      <C3312CodigoPosicionTaric>${p.taricCode || ''}</C3312CodigoPosicionTaric>
      <C34PaisOrigen>${p.paisOrigen || paisExpedicion || ''}</C34PaisOrigen>
      <C35MasaBrutaEnKg>${Number(p.pesobruto || 0).toFixed(3)}</C35MasaBrutaEnKg>
      <C36Preferencia>${(p.preferencia || '1').substring(0, 1)}</C36Preferencia>
      <C36Reduccion>${(p.preferencia || '100').substring(1) || '00'}</C36Reduccion>
      <C37RegimenAduanero>
        <C371RegimenSolicitado>${p.regimen || '40'}</C371RegimenSolicitado>
        <C371RegimenPrecedente>${p.regimenPrecedente || '00'}</C371RegimenPrecedente>
        <C372CodigoAdicional>${p.codigoAdicional || '000'}</C372CodigoAdicional>
      </C37RegimenAduanero>
      <C38MasaNetaEnKg>${Number(p.pesoneto || 0).toFixed(3)}</C38MasaNetaEnKg>
      <C42ValorFactura>${Number(p.valorFactura || 0).toFixed(3)}</C42ValorFactura>
      <C46ValorEstadistico>${Number(p.valorEstadistico || p.valorFactura || 0).toFixed(2)}</C46ValorEstadistico>${tributos.join('')}
      <C47ImporteTotal>${Number(importeTotal).toFixed(2)}</C47ImporteTotal>
    </Partida>`;
  }).join('');

  // XML principal - NOTA: elementFormDefault="unqualified" en el XSD
  // Los hijos NO deben tener namespace, solo el root element
  const bodyXML = `<ent:ImportacionCompletaV1Ent xmlns:ent="${NS_ENT}">
  <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${isTest ? ' Test="S"' : ''}/>${mrn ? `
  <NumeroReferenciaDUA>${mrn}</NumeroReferenciaDUA>` : ''}
  <CAaduana>${data.aduanaDespacho || data.customsOffice || 'ES002801'}</CAaduana>
  <C011EstatutoMercancias>${estatutoMercancias}</C011EstatutoMercancias>
  <C012ProcedimientoSolicitado>${procedimiento}</C012ProcedimientoSolicitado>
  <C02Exportador>
    <C02ExportadorNID>${exportadorNIF}</C02ExportadorNID>
    <C02ExportadorRazonSocial>${exportadorNombre}</C02ExportadorRazonSocial>
    <C02ExportadorDireccion>${exportadorDireccion}</C02ExportadorDireccion>
    <C02ExportadorPoblacion>${exportadorPoblacion}</C02ExportadorPoblacion>
    <C02ExportadorCodigoPostal>${exportadorCP}</C02ExportadorCodigoPostal>
    <C02ExportadorPais>${exportadorPais}</C02ExportadorPais>
  </C02Exportador>
  <C05NumeroDePartidas>${numPartidas}</C05NumeroDePartidas>
  <C06TotalBultos>${totalBultos}</C06TotalBultos>${referenciaComercial ? `
  <C07ReferenciaComercial>${referenciaComercial}</C07ReferenciaComercial>` : ''}
  <C08Importador>
    <C08ImportadorNID>${importadorNIF}</C08ImportadorNID>
    <C08ImportadorParticular>${importadorParticular}</C08ImportadorParticular>
    <C08ImportadorRazonSocial>${importadorNombre}</C08ImportadorRazonSocial>
    <C08ImportadorDireccion>${importadorDireccion}</C08ImportadorDireccion>
    <C08ImportadorPoblacion>${importadorPoblacion}</C08ImportadorPoblacion>
    <C08ImportadorCodigoPostal>${importadorCP}</C08ImportadorCodigoPostal>
    <C08ImportadorPais>${importadorPais}</C08ImportadorPais>
  </C08Importador>
  <C14Declarante>
    <C14DeclaranteFormaRepresentacion>${formaRepresentacion}</C14DeclaranteFormaRepresentacion>
    <C14DeclaranteNID>${declaranteNIF}</C14DeclaranteNID>
    <C14DeclaranteRazonSocial>${declaranteNombre}</C14DeclaranteRazonSocial>
    <C14DeclaranteTipoAutorizaDespacho>${tipoAutorizaDespacho}</C14DeclaranteTipoAutorizaDespacho>
  </C14Declarante>
  <EmailNotificaDespacho>${emailDespacho || 'despacho@stocklogistic.es'}</EmailNotificaDespacho>
  <C15aPaisExpedicion>${paisExpedicion}</C15aPaisExpedicion>
  <C17aPaisDestino>${paisDestino}</C17aPaisDestino>
  <C19TransporteEnContenedores>${contenedores}</C19TransporteEnContenedores>
  <C20CondicionesDeEntrega>
    <C201CondicionesEntregaCodigo>${incoterm}</C201CondicionesEntregaCodigo>
    <C202CondicionesEntregaNombre>${incotermNombre || incoterm}</C202CondicionesEntregaNombre>
    <C203CondicionesEntregaZona>${incotermZona || ''}</C203CondicionesEntregaZona>
  </C20CondicionesDeEntrega>
  <C221CodigoDivisa>${divisa}</C221CodigoDivisa>
  <C222ImporteFactura>${Number(importeFactura).toFixed(3)}</C222ImporteFactura>
  <C24NaturalezaTransaccion>${naturalezaTransaccion}</C24NaturalezaTransaccion>
  <C25ModoTransporteFrontera>${modoTransporteFrontera}</C25ModoTransporteFrontera>
  <C30LocalizacionMercancias>${localizacionMercancias || 'ES' + (data.aduanaDespacho || '002801') + 'LUCI01'}</C30LocalizacionMercancias>
  <CBImporteTotalTributos>${Number(importeTotalTributos).toFixed(2)}</CBImporteTotalTributos>
  <CBmodalidadDePago>${modalidadPago}</CBmodalidadDePago>${garantiaLevante ? `
  <CBgarantiaLevante>${garantiaLevante}</CBgarantiaLevante>` : ''}${partidasXML}
</ent:ImportacionCompletaV1Ent>`;

  // SOAP Envelope
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    ${bodyXML}
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Convertir datos de expedicion LUCI al formato AEAT
 */
function expeditionToH1Data(expedition) {
  const decl = expedition.declaration || {};
  const client = expedition.client || {};
  const transport = expedition.transport || {};
  const goods = expedition.goods || [];
  const calc = expedition.calculations || {};

  const modeMap = { air: '4', sea: '1', road: '3', rail: '2', maritime: '1' };
  const totalValue = goods.reduce((s, g) => s + (g.invoiceValue || g.value || 0), 0);

  return {
    tipoOperacion: decl.mrn ? 'MODI' : 'DECL',
    mrn: decl.mrn || '',
    referenciaComercial: expedition.expeditionId,
    // Exportador
    exportadorNIF: client.taxId || client.nif || '',
    exportadorNombre: client.companyName || '',
    exportadorDireccion: client.address?.street || '',
    exportadorPoblacion: client.address?.city || '',
    exportadorCP: client.address?.postalCode || '',
    exportadorPais: goods[0]?.countryOfOrigin || expedition.origin?.country || '',
    // Importador
    importadorNIF: client.taxId || client.nif || '',
    importadorNombre: client.companyName || '',
    importadorDireccion: client.address?.street || '',
    importadorPoblacion: client.address?.city || '',
    importadorCP: client.address?.postalCode || '',
    // Emails
    emailDespacho: client.contact?.email || 'despacho@stocklogistic.es',
    // Paises
    paisExpedicion: goods[0]?.countryOfOrigin || '',
    // Incoterm
    incoterm: typeof expedition.incoterm === 'object' ? expedition.incoterm?.code : (expedition.incoterm || 'CIF'),
    // Divisa
    importeFactura: totalValue,
    // Transporte
    modoTransporteFrontera: modeMap[expedition.transportMode] || '1',
    contenedores: transport.containerNumber ? '1' : '0',
    // Tributos
    importeTotalTributos: calc.totalTaxes || 0,
    // Partidas
    partidas: goods.map(g => ({
      descripcion: g.description || '',
      taricCode: g.taricCode || '',
      paisOrigen: g.countryOfOrigin || '',
      pesobruto: g.grossWeight || 0,
      pesoneto: g.netWeight || 0,
      bultos: g.numberOfPackages || 1,
      tipoBulto: 'CT',
      marcas: '',
      valorFactura: g.invoiceValue || g.value || 0,
      valorEstadistico: g.statisticalValue || g.invoiceValue || g.value || 0,
      preferencia: decl.preference || '100',
      regimen: decl.regime || '40',
      regimenPrecedente: '00',
      codigoAdicional: decl.additionalProcedure || '000',
      arancelTipo: g.dutyRate || 0,
      arancelImporte: g.dutyAmount || 0,
      ivaTipo: g.vatRate || 21,
      ivaImporte: g.vatAmount || 0
    }))
  };
}

module.exports = {
  buildH1ImportXML,
  expeditionToH1Data,
  NS_ENT,
  NS_SOAP
};
