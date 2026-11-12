/**
 * H1 CAU: declaracion de importacion adaptada al Codigo Aduanero de la Union
 * (mensaje CC415A, servicio web CC415AV1 de la AEAT).
 *
 * Sustituye al DUA «PreCAU» (`h1XmlBuilder.js`, servicio ImportacionCompletaV1),
 * que la AEAT cerro para declaraciones nuevas el 14/10/2025.
 *
 * Constructor PURO: recibe los datos ya resueltos y devuelve el XML SOAP. No
 * decide nada de negocio ni pone valores por defecto de la operacion; eso es
 * cosa de quien prepara los datos. El orden de los elementos es el del XSD
 * oficial (`ES_CC415A.xsd`): cambiarlo invalida el mensaje.
 *
 * Guia: «Guia Tecnica de Importacion adaptada al CAU» v3.20 (AEAT).
 */
const { xml, joinXml } = require('./xmlTemplate');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_CC415A = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/CC415AV1Ent.xsd';
const ENDPOINT_CC415A = '/wlpl/ADIP-JDIT/ws/cci/CC415AV1SOAP';

const vacio = (v) => v === undefined || v === null || v === '';

/** `<nombre>valor</nombre>`, o nada si no hay valor. */
const el = (nombre, valor) => (vacio(valor) ? '' : xml`<${raw(nombre)}>${valor}</${raw(nombre)}>`);
/** Nombre de etiqueta (constante del codigo, nunca un dato). */
function raw(nombre) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(nombre)) throw new Error(`Nombre de etiqueta no válido: ${nombre}`);
  return xml([nombre]);
}
/** `<nombre>…hijos…</nombre>`, o nada si no hay ningun hijo con contenido. */
function grupo(nombre, hijos) {
  const contenido = joinXml(hijos.filter((h) => h !== '' && h !== null && h !== undefined), '');
  return String(contenido) === '' ? '' : xml`<${raw(nombre)}>${contenido}</${raw(nombre)}>`;
}
/** Lista de grupos numerados con `sequenceNumber` desde 1. */
const lista = (nombre, elementos, pintar) =>
  (elementos || []).map((e, i) => grupo(nombre, [el('sequenceNumber', i + 1), ...pintar(e, i)]));

/** Importe con dos decimales (los que admite el mensaje). */
const importe = (v) => (vacio(v) ? '' : (Math.round(Number(v) * 100) / 100).toFixed(2));
/** Cantidad o masa: hasta seis decimales, sin ceros de relleno. */
const cantidad = (v) => (vacio(v) ? '' : String(Number(Number(v).toFixed(6))));
/** Tipo impositivo: hasta tres decimales. */
const tipo = (v) => (vacio(v) ? '' : String(Number(Number(v).toFixed(3))));

/** `AAAA-MM-DDTHH:MM:SS` en hora de Madrid, como pide el grupo Message. */
function fechaHora(fecha) {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(fecha);
  return partes.replace(' ', 'T');
}

const direccion = (d) => (d ? grupo('Address', [
  el('streetAndNumber', d.calle), el('postcode', d.cp), el('city', d.ciudad), el('country', d.pais)
]) : '');

const contacto = (c) => (c ? grupo('ContactPerson', [
  el('name', c.nombre), el('phoneNumber', c.telefono), el('eMailAddress', c.email)
]) : '');

/** Operador: identificador, o nombre y direccion cuando no lo tiene. */
const operador = (nombre, o) => (o ? grupo(nombre, [el('identificationNumber', o.id), el('name', o.nombre), direccion(o.direccion)]) : '');

const documento = (d) => [el('type', d.tipo), el('ccQualifier', d.pais), el('referenceNumber', d.referencia)];

function tributos(lineas) {
  return lista('DutiesAndTaxes', lineas, (t) => [
    el('taxType', t.tipo),
    el('methodOfPayment', t.medioDePago),
    ...lista('TaxBase', t.bases, (b) => [
      el('taxRate', tipo(b.tipoImpositivo)),
      el('measurementUnitAndQualifier', b.unidad),
      el('quantity', cantidad(b.cantidad)),
      el('amount', importe(b.importe)),
      el('taxAmount', importe(b.cuota))
    ])
  ]);
}

function partida(p) {
  const codigo = p.codigo || {};
  return grupo('GoodsShipmentItem', [
    el('sequenceNumber', p.numero),
    el('declarationGoodsItemNumber', p.numero),
    el('statisticalValue', importe(p.valorEstadistico)),
    grupo('Procedure', [
      el('requestedProcedure', p.regimen?.solicitado),
      el('previousProcedure', p.regimen?.precedente),
      ...lista('AdditionalProcedure', p.regimen?.adicionales, (a) => [el('additionalProcedure', a)])
    ]),
    grupo('Origin', [el('countryOfOrigin', p.origen), el('countryOfPreferentialOrigin', p.origenPreferencial)]),
    grupo('Commodity', [
      el('descriptionOfGoods', p.descripcion),
      grupo('CommodityCode', [
        el('harmonizedSystemSubheadingCode', codigo.sa6),
        el('combinedNomenclatureCode', codigo.nc2),
        el('taricCode', codigo.taric2),
        ...lista('TaricAdditionalCode', codigo.adicionalesTaric, (a) => [el('taricAdditionalCode', a)]),
        ...lista('NationalAdditionalCode', codigo.adicionalesNacionales, (a) => [el('nationalAdditionalCode', a)])
      ]),
      grupo('GoodsMeasure', [
        el('grossMass', cantidad(p.masaBruta)), el('netMass', cantidad(p.masaNeta)), el('supplementaryUnits', cantidad(p.unidadesSuplementarias))
      ]),
      grupo('InvoiceLine', [el('itemAmountInvoiced', importe(p.importeFactura))]),
      grupo('CalculationOfTaxes', [el('preference', p.preferencia), ...tributos(p.tributos)])
    ]),
    ...lista('Packaging', p.bultos, (b) => [el('typeOfPackages', b.tipo), el('numberOfPackages', b.numero), el('shippingMarks', b.marcas)]),
    ...lista('PreviousDocument', p.documentosPrevios, (d) => [
      ...documento(d),
      el('typeOfPackages', d.tipoBultos),
      el('numberOfPackages', d.bultos),
      el('measurementUnitAndQualifier', d.unidad),
      el('quantity', cantidad(d.cantidad)),
      el('goodsItemIdentifier', d.partida)
    ]),
    ...lista('SupportingDocument', p.documentosJustificativos, (d) => [...documento(d), el('documentLineItemNumber', d.linea)]),
    ...lista('TransportDocument', p.documentosTransporte, (d) => [el('type', d.tipo), el('referenceNumber', d.referencia)]),
    ...lista('AdditionalReference', p.referenciasAdicionales, documento),
    ...lista('AdditionalInformation', p.informacionAdicional, (i) => [el('code', i.codigo), el('text', i.texto)]),
    p.valoracion ? grupo('CustomsValuation', [
      el('valuationMethod', p.valoracion.metodo),
      ...lista('AdditionsAndDeductions', p.valoracion.ajustes, (a) => [el('code', a.codigo), el('amount', importe(a.importe))])
    ]) : '',
    grupo('ValuationAdjustment', [el('valuationIndicators', p.indicadoresValoracion)])
  ]);
}

function expedicion(c) {
  if (!c) return '';
  return grupo('Consignment', [
    el('containerIndicator', c.contenedores ? 1 : 0),
    el('inlandModeOfTransport', c.modoInterior),
    el('modeOfTransportAtTheBorder', c.modoFrontera),
    el('grossMass', cantidad(c.masaBruta)),
    el('referenceNumberUCR', c.ucr),
    ...lista('TransportEquipment', c.equipos, (e) => [
      el('containerIdentificationNumber', e.contenedor),
      ...lista('GoodsReference', e.partidas, (n) => [el('declarationGoodsItemNumber', n)])
    ]),
    c.ubicacion ? grupo('LocationOfGoods', [
      el('typeOfLocation', c.ubicacion.tipo),
      el('qualifierOfIdentification', c.ubicacion.calificador),
      el('authorisationNumber', c.ubicacion.autorizacion)
    ]) : '',
    c.medioLlegada ? grupo('ArrivalTransportMeans', [
      el('typeOfIdentification', c.medioLlegada.tipo), el('identificationNumber', c.medioLlegada.id)
    ]) : '',
    grupo('ActiveBorderTransportMeans', [el('nationality', c.nacionalidadMedioActivo)]),
    ...lista('TransportDocument', c.documentosTransporte, (d) => [el('type', d.tipo), el('referenceNumber', d.referencia)])
  ]);
}

function envio(e) {
  return grupo('GoodsShipment', [
    el('sequenceNumber', 1),
    el('natureOfTransaction', e.naturalezaTransaccion),
    el('invoiceCurrency', e.divisa),
    operador('Buyer', e.comprador),
    operador('Seller', e.vendedor),
    operador('Exporter', e.exportador),
    e.entrega ? grupo('DeliveryTerms', [
      el('incotermCode', e.entrega.incoterm), el('UNLOCODE', e.entrega.unlocode), el('location', e.entrega.lugar), el('country', e.entrega.pais)
    ]) : '',
    grupo('CountryOfDispatch', [el('countryOfDispatch', e.paisExpedicion)]),
    grupo('Destination', [el('countryOfDestination', e.destino?.pais), el('regionOfDestination', e.destino?.region)]),
    ...lista('PreviousDocument', e.documentosPrevios, documento),
    ...lista('SupportingDocument', e.documentosJustificativos, documento),
    ...lista('AdditionalReference', e.referenciasAdicionales, documento),
    ...lista('AdditionalInformation', e.informacionAdicional, (i) => [el('code', i.codigo), el('text', i.texto)]),
    expedicion(e.expedicion),
    ...(e.partidas || []).map(partida)
  ]);
}

/**
 * XML SOAP del mensaje CC415AV1Ent.
 *
 * @param {object} d  datos de la declaracion (ver `expeditionToH1CauData`)
 * @returns {string}
 */
function buildH1CauXML(d) {
  const mensaje = d.mensaje || {};
  const cuerpo = joinXml([
    grupo('Message', [
      el('messageIdentification', mensaje.id),
      el('preparationDateAndTime', mensaje.fecha ? fechaHora(mensaje.fecha) : ''),
      // Modo test por defecto: nunca una declaracion real por accidente.
      el('testIndicator', mensaje.test === false ? '' : 'S')
    ]),
    el('MRN', d.mrn),
    el('operation', d.operacion || 'A'),
    grupo('CustomsOfficeOfImport', [el('referenceNumber', d.aduanaImportacion)]),
    grupo('CC415A', [
      grupo('ImportOperation', [
        el('LRN', d.declaracion?.lrn),
        el('declarationType', d.declaracion?.tipo),
        el('additionalDeclarationType', d.declaracion?.tipoAdicional),
        el('languageCode', d.declaracion?.idioma || 'ES')
      ]),
      ...lista('Authorisation', d.autorizaciones, (a) => [el('type', a.tipo), el('referenceNumber', a.referencia), el('holderOfTheAuthorisation', a.titular)]),
      grupo('CustomsOfficeOfPresentation', [el('referenceNumber', d.aduanaPresentacion)]),
      operador('Importer', d.importador),
      grupo('Declarant', [el('identificationNumber', d.declarante?.id), contacto(d.declarante?.contacto)]),
      d.representante ? grupo('Representative', [
        el('identificationNumber', d.representante.id), el('status', d.representante.estado), contacto(d.representante.contacto)
      ]) : '',
      ...lista('Guarantee', d.garantias, (g) => [
        el('guaranteeType', g.tipo),
        ...lista('GuaranteeReference', g.referencias, (r) => [
          el('GRN', r.grn),
          el('ccQualifier', r.pais),
          el('accessCode', r.codigoAcceso),
          // La AEAT exige EUR e importe 0: el importe a garantizar lo calcula ella.
          el('currencyCode', 'EUR'),
          el('amountToBeCovered', '0'),
          el('otherGuaranteeReference', r.otraReferencia)
        ])
      ]),
      envio(d.envio || {})
    ])
  ].filter((x) => x !== ''), '\n');

  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
<soapenv:Header/>
<soapenv:Body>
<es:CC415AV1Ent xmlns:es="${NS_CC415A}">
${cuerpo}
</es:CC415AV1Ent>
</soapenv:Body>
</soapenv:Envelope>`);
}

module.exports = { buildH1CauXML, NS_CC415A, NS_SOAP, ENDPOINT_CC415A, fechaHora };
