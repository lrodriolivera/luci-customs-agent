/**
 * H1 XML Builder - Genera XML segun schema ImportacionCompletaV1Ent.xsd de la AEAT
 * Namespace: https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adip/ws/ImportacionCompletaV1Ent.xsd
 *
 * Basado en el XSD oficial descargado de www3.agenciatributaria.gob.es
 */

const { xml, joinXml } = require('./xmlTemplate');
const { codigoUnidadDua } = require('./unidadesSuplementarias');
const { ErrorValidacion, exigirEori } = require('../forms/identificadorAduanero');
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
    declaranteNIF = '',
    declaranteNombre = '',
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
    identidadTransporteFrontera = '',
    paisTransporteFrontera = '',
    // Provincia destino (casilla 17b)
    provinciaDestino = '',
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
      tributos.push(xml`
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
      tributos.push(xml`
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

    return xml`
    <Partida>
      <C32NumeroDePartida>${i + 1}</C32NumeroDePartida>
      <C31EmpaquetamientoInterno>
        <C31EmpaqInternoClase>${p.tipoBulto || 'CT'}</C31EmpaqInternoClase>
        <C31EmpaqInternoMarcas>${p.marcas || ''}</C31EmpaqInternoMarcas>
        <C31EmpaqInternoNumeroBultos>${p.bultos || 1}</C31EmpaqInternoNumeroBultos>
      </C31EmpaquetamientoInterno>
      <C31DescripcionDeLaMercancia>${(p.descripcion || '').substring(0, 250)}</C31DescripcionDeLaMercancia>
      <C3312CodigoPosicionTaric>${p.taricCode || ''}</C3312CodigoPosicionTaric>
      <C34PaisOrigen>${p.paisOrigen || paisExpedicion || ''}</C34PaisOrigen>
      <C35MasaBrutaEnKg>${Number(p.pesobruto || 0).toFixed(3)}</C35MasaBrutaEnKg>
      <C36Preferencia>${(p.preferencia || '1').substring(0, 1)}</C36Preferencia>
      <C36Reduccion>${(p.preferencia || '100').substring(1) || '00'}</C36Reduccion>
      <C37RegimenAduanero>
        <C371RegimenSolicitado>${p.regimen || '40'}</C371RegimenSolicitado>
        <C371RegimenPrecedente>${p.regimenPrecedente || '00'}</C371RegimenPrecedente>${(p.codigoAdicional && !['000','00','0',''].includes(String(p.codigoAdicional))) ? xml`
        <C372CodigoAdicional>${p.codigoAdicional}</C372CodigoAdicional>` : ''}
      </C37RegimenAduanero>
      <C38MasaNetaEnKg>${Number(p.pesoneto || 0).toFixed(3)}</C38MasaNetaEnKg>${p.documentoCargo ? xml`
      <C40DocumentoCargoPrecedente>
        <C40TipoDocumento>${p.documentoCargo.tipo}</C40TipoDocumento>
        <C40ClaseDocumento>${p.documentoCargo.clase}</C40ClaseDocumento>
        <C40ReferenciaDocumento>${p.documentoCargo.referencia}</C40ReferenciaDocumento>
      </C40DocumentoCargoPrecedente>` : ''}
      ${p.unidadesSuplementarias ? xml`<C41UnidadesSuplementarias>
        <C41UnidadesCodigo>${codigoUnidadDua(p.unidadesCodigo || 'NAR')}</C41UnidadesCodigo>
        <C41UnidadesNumero>${Number(p.unidadesSuplementarias).toFixed(3)}</C41UnidadesNumero>
      </C41UnidadesSuplementarias>` : ''}
      <C42ValorFactura>${Number(p.valorFactura || 0).toFixed(3)}</C42ValorFactura>
      ${joinXml((p.documentos || [{ tipo: p.docTipo || 'N380', referencia: p.docId || data.referenciaComercial || 'FACTURA-001' }]).map(d => xml`<C44DocumentosYCertificados>
        <C44Tipo>${d.tipo}</C44Tipo>
        <C44Referencia>${d.referencia}</C44Referencia>
      </C44DocumentosYCertificados>`), '\n      ')}
      <C46ValorEstadistico>${Number(p.valorEstadistico || p.valorFactura || 0).toFixed(2)}</C46ValorEstadistico>${joinXml(tributos)}
      <C47ImporteTotal>${Number(importeTotal).toFixed(2)}</C47ImporteTotal>
    </Partida>`;
  });

  // XML principal - NOTA: elementFormDefault="unqualified" en el XSD
  // Los hijos NO deben tener namespace, solo el root element
  const bodyXML = xml`<ent:ImportacionCompletaV1Ent xmlns:ent="${NS_ENT}">
  <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${isTest ? xml` Test="S"` : ''}/>${mrn ? xml`
  <NumeroReferenciaDUA>${mrn}</NumeroReferenciaDUA>` : ''}
  <CAaduana>${(data.aduanaDespacho || data.customsOffice || '002801').replace(/^ES/, '').substring(0, 6)}</CAaduana>
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
  <C06TotalBultos>${totalBultos}</C06TotalBultos>${referenciaComercial ? xml`
  <C07ReferenciaComercial>${referenciaComercial}</C07ReferenciaComercial>` : ''}
  <C08Importador>
    <C08ImportadorNID>${importadorNIF}</C08ImportadorNID>
    <C08ImportadorParticular>${importadorParticular === 'P' ? 'P' : ''}</C08ImportadorParticular>
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
  <EmailNotificaDespacho>${emailDespacho}</EmailNotificaDespacho>
  <C15aPaisExpedicion>${paisExpedicion}</C15aPaisExpedicion>
  <C17aPaisDestino>${paisDestino}</C17aPaisDestino>${provinciaDestino ? xml`
  <C17bProvinciaIslaDestino>${provinciaDestino}</C17bProvinciaIslaDestino>` : ''}
  <C181IdentMedioTransporteLlegada>${identidadTransporteFrontera || ''}</C181IdentMedioTransporteLlegada>
  <C19TransporteEnContenedores>${contenedores}</C19TransporteEnContenedores>
  <C20CondicionesDeEntrega>
    <C201CondicionesEntregaCodigo>${incoterm}</C201CondicionesEntregaCodigo>
    <C202CondicionesEntregaNombre>${incotermNombre || incoterm}</C202CondicionesEntregaNombre>
    <C203CondicionesEntregaZona>${incotermZona || ''}</C203CondicionesEntregaZona>
  </C20CondicionesDeEntrega>
  <C21PaisMedioTransporteFrontera>${paisTransporteFrontera || paisExpedicion || ''}</C21PaisMedioTransporteFrontera>
  <C221CodigoDivisa>${divisa}</C221CodigoDivisa>
  <C222ImporteFactura>${Number(importeFactura).toFixed(3)}</C222ImporteFactura>
  <C24NaturalezaTransaccion>${naturalezaTransaccion}</C24NaturalezaTransaccion>
  <C25ModoTransporteFrontera>${modoTransporteFrontera}</C25ModoTransporteFrontera>
  <C30LocalizacionMercancias>${localizacionMercancias || 'ES' + (data.aduanaDespacho || '002801') + 'LUCI01'}</C30LocalizacionMercancias>
  <CBImporteTotalTributos>${Number(importeTotalTributos).toFixed(2)}</CBImporteTotalTributos>
  <CBmodalidadDePago>${modalidadPago}</CBmodalidadDePago>${garantiaLevante ? xml`
  <CBgarantiaLevante>${garantiaLevante}</CBgarantiaLevante>` : ''}${partidasXML}
</ent:ImportacionCompletaV1Ent>`;

  // SOAP Envelope
  return xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    ${bodyXML}
  </soapenv:Body>
</soapenv:Envelope>`.toString();
}

/**
 * Convertir datos de expedicion LUCI al formato AEAT
 */
function expeditionToH1Data(expedition, { declarante } = {}) {
  const decl = expedition.declaration || {};
  const client = expedition.client || {};
  const transport = expedition.transport || {};
  const goods = expedition.goods || [];
  const calc = expedition.calculations || {};

  // Sin identificacion o direccion del exportador no se construye el SOAP:
  // antes salian un NIF y una direccion de Zaragoza inventados.
  const exportadorNIF = expedition.exporter?.eori || expedition.exporter?.nif || client.taxId;
  const exportadorDireccion = expedition.exporter?.address || client.address?.street;
  const exportadorPoblacion = expedition.exporter?.city || client.address?.city;
  if (!exportadorNIF) {
    throw new ErrorValidacion('Falta el EORI del exportador: complétalo en el expediente', { quien: 'exportador' });
  }
  if (!exportadorDireccion || !exportadorPoblacion) {
    throw new ErrorValidacion('Falta la dirección del exportador (calle y población): complétala en el expediente',
      { code: 'DIRECCION_FALTANTE', quien: 'exportador' });
  }
  // El declarante lo resuelve quien llama (representante del expediente o del tenant).
  const declaranteNIF = exigirEori(declarante?.eori, 'representante');
  if (!declarante?.companyName) {
    throw new ErrorValidacion('Falta el nombre del representante: configúralo en Ajustes > Aduanas',
      { code: 'NOMBRE_FALTANTE', quien: 'representante' });
  }

  const modeMap = { air: '4', sea: '1', road: '3', rail: '2', maritime: '1' };
  const documentoCargo = documentoCargoDe(expedition);
  const totalValue = goods.reduce((s, g) => s + (g.invoiceValue || g.value || 0), 0);

  return {
    tipoOperacion: decl.mrn ? 'MODI' : 'DECL',
    mrn: decl.mrn || '',
    referenciaComercial: expedition.expeditionId,
    // Exportador
    exportadorNIF,
    exportadorNombre: expedition.exporter?.companyName || client.companyName || '',
    exportadorDireccion,
    exportadorPoblacion,
    exportadorCP: expedition.exporter?.postalCode || client.address?.postalCode || '',
    exportadorPais: expedition.exporter?.country || goods[0]?.countryOfOrigin || expedition.origin?.country || 'CN',
    // Importador
    importadorNIF: client.taxId || client.nif || '',
    importadorNombre: client.companyName || '',
    importadorDireccion: client.address?.street || '',
    importadorPoblacion: client.address?.city || client.city || '',
    importadorCP: client.address?.postalCode || client.postalCode || '',
    importadorPais: 'ES',
    // Aduana
    aduanaDespacho: decl.customsOffice || '002801',
    // Ubicacion
    localizacionMercancias: decl.goodsLocation || 'ES002801AAAAAC',
    // Declarante: representante del expediente o del tenant (nunca un literal)
    declaranteNIF,
    declaranteNombre: declarante.companyName,
    formaRepresentacion: '1',
    tipoAutorizaDespacho: 'O',
    // Emails
    emailDespacho: client.contact?.email || declarante.contact?.email || '',
    // Paises
    paisExpedicion: goods[0]?.countryOfOrigin || expedition.exporter?.country || 'CN',
    paisDestino: 'ES',
    provinciaDestino: '28',
    // Incoterm
    incoterm: typeof expedition.incoterm === 'object' ? expedition.incoterm?.code : (expedition.incoterm || 'CIF'),
    incotermZona: '1',
    // Transporte frontera
    identidadTransporteFrontera: expedition.transport?.vehicleId || 'ABC1234',
    paisTransporteFrontera: 'ES',
    // Divisa
    importeFactura: totalValue,
    // Transporte
    modoTransporteFrontera: modeMap[expedition.transportMode] || '1',
    contenedores: transport.containerNumber ? '1' : '0',
    // Tributos
    importeTotalTributos: calc.totalTaxes || goods.reduce((s, g) => s + ((g.invoiceValue || g.value || 0) * (g.vatRate || 21) / 100), 0),
    // Partidas
    partidas: goods.map(g => ({
      descripcion: g.description || '',
      taricCode: g.taricCode || g.tariffCode || g.hsCode || '',
      paisOrigen: g.countryOfOrigin || g.originCountry || g.origin || '',
      pesobruto: g.grossWeight || 0,
      pesoneto: g.netWeight || 0,
      // Unidades suplementarias (casilla 41) — TARICs como 8471.30 las exigen.
      // Lee supplementaryUnits del schema; cae a quantity si unit/quantityUnit indica piezas.
      unidadesSuplementarias: g.supplementaryUnits
        ?? g.supplementaryUnitsQuantity
        ?? ((g.unit === 'PCS' || g.unit === 'NAR' || g.quantityUnit === 'PCS' || g.quantityUnit === 'NAR') ? g.quantity : null),
      unidadesCodigo: g.supplementaryUnitType
        || g.supplementaryUnitCode
        || ((g.unit === 'PCS' || g.unit === 'NAR' || g.quantityUnit === 'PCS' || g.quantityUnit === 'NAR') ? 'NAR' : null),
      // El expediente guarda los bultos en `packages`; `numberOfPackages` no
      // existe en su esquema y la partida salia siempre con 1 bulto, que es
      // ademas lo que la AEAT descuenta de la declaracion sumaria (casilla 40).
      bultos: g.packages?.quantity || g.numberOfPackages || 1,
      tipoBulto: g.packages?.type || 'CT',
      marcas: g.packages?.marks || g.shippingMarks || 'S/M',
      documentoCargo,
      valorFactura: g.invoiceValue || g.value || 0,
      valorEstadistico: g.statisticalValue || g.invoiceValue || g.value || 0,
      preferencia: decl.preference || '100',
      regimen: decl.regime || '40',
      regimenPrecedente: '00',
      // AEAT PRE rechaza F44/F48/00 con regimen 40/00 en algunos TARIC (error 2077
      // "codigo adicional incompatible"). Vacios ('', '0', '00', '000') indican
      // "sin codigo adicional" y el builder omite la etiqueta C372CodigoAdicional.
      codigoAdicional: (decl.additionalProcedure && !['000','00','0',''].includes(String(decl.additionalProcedure)))
        ? decl.additionalProcedure
        : '000',
      documentos: [
        { tipo: 'N380', referencia: expedition.expeditionId || 'FACTURA-001' },
        { tipo: 'N730', referencia: 'CMR-' + (expedition.expeditionId || '001') },
      ],
      arancelTipo: g.dutyRate || 0,
      arancelImporte: g.dutyAmount || 0,
      ivaTipo: g.vatRate || 21,
      ivaImporte: g.vatAmount || ((g.invoiceValue || g.value || 0) * (g.vatRate || 21) / 100)
    }))
  };
}

// Casilla 40: clase de documento segun el modo de transporte (esquema
// ImportaTiposDeDatos.xsd, Cas40Td): 'SUM' sumaria maritima, 'SUA' sumaria aerea.
const CLASE_SUMARIA_POR_MODO = { sea: 'SUM', maritime: 'SUM', air: 'SUA' };
const TIPO_DOCUMENTO_SUMARIA = 'X';
const FORMATO_CLAVE_SUMARIA = /^\d{11}$/;

/**
 * Documento de cargo (casilla 40) a partir de la declaracion sumaria registrada
 * en el expediente. La referencia es la de 16 caracteres de la AEAT:
 * RRRRANNNNNN (clave) + PPPPP (partida).
 *
 * Devuelve null si no hay sumaria, si el modo de transporte no tiene clase de
 * sumaria o si no se conoce la clave (por ejemplo, solo se registro el MRN y
 * aun no se consulto en la AEAT): antes que inventar una referencia, la
 * casilla no se declara.
 */
function documentoCargoDe(expedition) {
  const sumaria = expedition?.transport?.summaryDeclaration;
  if (!sumaria) return null;

  const clase = CLASE_SUMARIA_POR_MODO[String(expedition.transportMode || '').toLowerCase()];
  if (!clase) return null;

  const numero = String(sumaria.number || '').replace(/[\s.\-/]/g, '');
  const clave = FORMATO_CLAVE_SUMARIA.test(numero) ? numero : sumaria.aeat?.clave;
  const partida = String(sumaria.item ?? '').trim();
  if (!FORMATO_CLAVE_SUMARIA.test(String(clave || '')) || !/^\d{1,5}$/.test(partida)) return null;

  return { tipo: TIPO_DOCUMENTO_SUMARIA, clase, referencia: `${clave}${partida.padStart(5, '0')}` };
}

module.exports = {
  documentoCargoDe,
  buildH1ImportXML,
  expeditionToH1Data,
  NS_ENT,
  NS_SOAP
};
