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
function aplicarCauAVistaPrevia(h1Data, datos) {
  const envio = datos.envio || {};
  const ubicacion = envio.expedicion?.ubicacion;
  const transporte = envio.expedicion?.documentosTransporte?.[0];
  const shipment = h1Data.goodsShipment || {};

  return {
    ...h1Data,
    servicio: 'CC415AV1',
    declarationHeader: {
      ...h1Data.declarationHeader,
      // La aduana de entrada (por donde entro la mercancia en la UE) no va en
      // el mensaje CAU: se deja la que calculo el generador.
      customsOfficeLodgement: datos.aduanaImportacion,
      customsOfficePresentation: datos.aduanaPresentacion
    },
    goodsShipment: {
      ...shipment,
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
