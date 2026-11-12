/**
 * Vista previa del H1 cuando se presenta por el servicio CAU.
 *
 * La vista previa sale del generador interno (`h1Generator`), que no es el
 * mensaje que recibe la AEAT. En lo que ambos difieren, aqui se sustituye por
 * lo que de verdad se va a enviar: aduanas, ubicacion de las mercancias,
 * documento de transporte y documentos de cada partida. Asi lo que se revisa
 * antes de presentar es lo que se presenta.
 */
const documentosDe = (partida, envio) => [
  ...(partida.documentosPrevios || []),
  ...(partida.documentosJustificativos || []),
  ...(envio.expedicion?.documentosTransporte || []),
  ...(envio.documentosJustificativos || [])
].map((d) => ({ type: d.tipo, reference: d.referencia }));

/**
 * @param {object} h1Data  datos de la vista previa (`h1Generator.generate(...).data`)
 * @param {object} datos   datos del mensaje CAU (`expeditionToH1CauData`)
 * @returns {object} copia de `h1Data` con lo que se envia a la AEAT
 */
/**
 * Con una divisa que el BCE no cotiza se declara en euros el contravalor: la
 * vista previa muestra esos importes (la divisa y el cambio, en el 1017).
 */
function enEurosSiSeDeclaraEnEuros(h1Data, envio) {
  const shipment = h1Data.goodsShipment || {};
  if (!envio.divisa || !shipment.currency || envio.divisa === shipment.currency) return h1Data;
  const importes = (envio.partidas || []).map((p) => p.importeFactura || 0);
  const total = Math.round(importes.reduce((s, v) => s + v, 0) * 100) / 100;
  return {
    ...h1Data,
    goodsShipment: { ...shipment, currency: envio.divisa, totalInvoicedAmount: total, exchangeRate: null },
    valuation: h1Data.valuation ? { ...h1Data.valuation, invoiceCurrency: envio.divisa, invoiceValue: total } : h1Data.valuation,
    goodsItems: (h1Data.goodsItems || []).map((item, i) => (importes[i] !== undefined ? { ...item, invoiceValue: importes[i] } : item))
  };
}

function aplicarCauAVistaPrevia(vistaGenerada, datos) {
  const envio = datos.envio || {};
  const h1Data = enEurosSiSeDeclaraEnEuros(vistaGenerada, envio);
  const ubicacion = envio.expedicion?.ubicacion;
  const transporte = envio.expedicion?.documentosTransporte?.[0];
  const shipment = h1Data.goodsShipment || {};
  const cabecera = h1Data.declarationHeader || {};
  const garantia = datos.garantias?.[0];
  const medioDePago = envio.partidas?.[0]?.tributos?.[0]?.medioDePago;

  // En representacion directa el declarante es el importador y la agencia va
  // como representante; en autodespacho e indirecta no hay representante.
  const agencia = cabecera.declarant || {};
  const declarante = datos.representante
    ? { name: cabecera.importer?.name, identificationNumber: datos.declarante?.id, representativeStatus: agencia.representativeStatus }
    : { ...agencia, identificationNumber: datos.declarante?.id || agencia.identificationNumber };

  return {
    ...h1Data,
    servicio: 'CC415AV1',
    // El LRN lo asigna LUCI al presentar (uno nuevo por mensaje): hasta entonces no hay.
    lrn: null,
    // Solo se declara garantia con pago aplazado; con pago previo al levante, ninguna.
    guarantee: garantia ? { guaranteeType: garantia.tipo, grn: garantia.referencias?.[0]?.grn || null } : null,
    dutyTaxFee: h1Data.dutyTaxFee && medioDePago && medioDePago !== h1Data.dutyTaxFee.paymentMethod
      ? { ...h1Data.dutyTaxFee, paymentMethod: medioDePago, paymentMethodDescription: undefined }
      : h1Data.dutyTaxFee,
    declarationHeader: {
      ...cabecera,
      lrn: null,
      declarant: declarante,
      representative: datos.representante ? { name: agencia.name, identificationNumber: datos.representante.id } : null,
      // La aduana de entrada (por donde entro la mercancia en la UE) no va en
      // el mensaje CAU: se deja la que calculo el generador.
      customsOfficeLodgement: datos.aduanaImportacion,
      customsOfficePresentation: datos.aduanaPresentacion
    },
    goodsShipment: {
      ...shipment,
      // Region de destino: el codigo de provincia que se declara.
      regionOfDestination: envio.destino?.region || shipment.regionOfDestination,
      goodsLocation: ubicacion
        ? { ...shipment.goodsLocation, typeOfLocation: ubicacion.tipo, qualifierOfIdentification: ubicacion.calificador }
        : shipment.goodsLocation,
      placeOfUnloading: ubicacion ? { ...shipment.placeOfUnloading, location: ubicacion.autorizacion } : shipment.placeOfUnloading,
      transportDocument: transporte ? { type: transporte.tipo, reference: transporte.referencia } : shipment.transportDocument
    },
    goodsItems: (h1Data.goodsItems || []).map((item, i) => (
      envio.partidas?.[i] ? { ...item, supportingDocuments: documentosDe(envio.partidas[i], envio) } : item
    ))
  };
}

module.exports = { aplicarCauAVistaPrevia };
