/**
 * Activacion de una predeclaracion de importacion CAU (servicio CC432AV1).
 *
 * Una predeclaracion (tipo adicional D) con modo de activacion «Operador»
 * queda en estado 63 «pendiente de activar», con numero de registro y sin
 * MRN. Al activarla, la AEAT hace el analisis de riesgos, liquida y responde
 * como al presentar (CC415R dentro de CC432AV1Sal): estado 90 y el MRN, que
 * es el mismo numero de registro. Con modo «Aduanas» la activa la propia
 * aduana cuando la sumaria esta activa.
 *
 * Comprobado en la preproduccion (recinto 009999, 13/11/2026): la activacion
 * no admite persona de contacto en el declarante (error 80118).
 */
const { DOMParser } = require('@xmldom/xmldom');
const { xml, joinXml } = require('./xmlTemplate');
const { fechaHora } = require('./h1CauXmlBuilder');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_CC432A = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/CC432AV1Ent.xsd';
const ENDPOINT_CC432A = '/wlpl/ADIP-JDIT/ws/cci/CC432AV1SOAP';
// Valores de ModoActivacionDeclaracion (Separata 17 de la guia complementaria).
const MODOS_ACTIVACION = Object.freeze(['Aduanas', 'Operador']);

const hijos = (nodo, nombre) => {
  const lista = [];
  for (let n = nodo?.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!nombre || n.localName === nombre)) lista.push(n);
  return lista;
};
const hijo = (nodo, ...ruta) => ruta.reduce((actual, nombre) => (actual ? hijos(actual, nombre)[0] : undefined), nodo);
const texto = (nodo, ...ruta) => (ruta.length ? hijo(nodo, ...ruta) : nodo)?.textContent?.trim() || null;
function buscar(nodo, nombre) {
  for (const n of hijos(nodo)) {
    if (n.localName === nombre) return n;
    const dentro = buscar(n, nombre);
    if (dentro) return dentro;
  }
  return null;
}

/**
 * Lo que la activacion repite de la predeclaracion, sacado del mensaje que se
 * envio (lo que la AEAT tiene registrado): LRN, aduana de presentacion,
 * ubicacion de las mercancias y contenedores.
 *
 * @param {string} requestXML  mensaje CC415A enviado
 * @returns {{ lrn, aduanaPresentacion, ubicacion, contenedores }|null}
 */
function datosDeActivacion(requestXML) {
  if (typeof requestXML !== 'string' || !requestXML.trim()) return null;
  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(requestXML, 'text/xml');
  if (!documento?.documentElement || fallos.length > 0) return null;
  const cc415a = buscar(documento.documentElement, 'CC415A');
  if (!cc415a) return null;
  const consignment = hijo(cc415a, 'GoodsShipment', 'Consignment');
  const lugar = hijo(consignment, 'LocationOfGoods');
  return {
    lrn: texto(cc415a, 'ImportOperation', 'LRN'),
    aduanaPresentacion: texto(cc415a, 'CustomsOfficeOfPresentation', 'referenceNumber'),
    ubicacion: lugar ? {
      tipo: texto(lugar, 'typeOfLocation'), calificador: texto(lugar, 'qualifierOfIdentification'), autorizacion: texto(lugar, 'authorisationNumber')
    } : null,
    contenedores: hijos(consignment, 'TransportEquipment').map((e) => texto(e, 'containerIdentificationNumber')).filter(Boolean)
  };
}

const el = (nombre, valor) => (valor === undefined || valor === null || valor === '' ? '' : xml`<${xml([nombre])}>${valor}</${xml([nombre])}>`);

/**
 * XML SOAP de la activacion (CC432AV1Ent).
 *
 * @param {{ mensajeId: string, numeroRegistro: string, lrn: string, aduanaPresentacion: string,
 *   ubicacion: { tipo, calificador, autorizacion }, contenedores?: string[],
 *   declarante: { id: string }, representante?: { id: string, estado: string }, fecha?: Date, test?: boolean }} d
 */
function buildActivacionH1CauXML({ mensajeId, numeroRegistro, lrn, aduanaPresentacion, ubicacion, contenedores = [], declarante, representante = null, fecha = new Date(), test = true }) {
  if (!numeroRegistro) throw new Error('La activación necesita el número de registro de la predeclaración');
  if (!lrn) throw new Error('La activación necesita el LRN de la predeclaración');
  if (!ubicacion?.tipo || !ubicacion?.calificador) throw new Error('La activación necesita la ubicación de las mercancías');
  if (!aduanaPresentacion) throw new Error('La activación necesita la aduana de presentación');
  if (!declarante?.id) throw new Error('La activación necesita el declarante');

  const equipos = joinXml(contenedores.map((c, i) => xml`<TransportEquipment><sequenceNumber>${i + 1}</sequenceNumber><containerIdentificationNumber>${c}</containerIdentificationNumber></TransportEquipment>`), '');
  const lugar = xml`<LocationOfGoods>${el('typeOfLocation', ubicacion.tipo)}${el('qualifierOfIdentification', ubicacion.calificador)}${el('authorisationNumber', ubicacion.autorizacion)}</LocationOfGoods>`;
  // Sin ContactPerson: la AEAT lo rechaza en la activacion (error 80118).
  const representanteXml = representante ? xml`<Representative>${el('identificationNumber', representante.id)}<status>${representante.estado}</status></Representative>` : '';

  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
<soapenv:Header/>
<soapenv:Body>
<es:CC432AV1Ent xmlns:es="${NS_CC432A}">
<Message><messageIdentification>${mensajeId}</messageIdentification><preparationDateAndTime>${fechaHora(fecha)}</preparationDateAndTime>${test === false ? '' : xml`<testIndicator>S</testIndicator>`}</Message>
<customsRegistrationNumber>${numeroRegistro}</customsRegistrationNumber>
<CC432A><ImportOperation><LRN>${lrn}</LRN></ImportOperation><CustomsOfficeOfPresentation><referenceNumber>${aduanaPresentacion}</referenceNumber></CustomsOfficeOfPresentation><Declarant><identificationNumber>${declarante.id}</identificationNumber></Declarant>${representanteXml}<GoodsShipment><Consignment>${equipos}${lugar}</Consignment></GoodsShipment></CC432A>
</es:CC432AV1Ent>
</soapenv:Body>
</soapenv:Envelope>`);
}

module.exports = { buildActivacionH1CauXML, datosDeActivacion, MODOS_ACTIVACION, ENDPOINT_CC432A, NS_CC432A };
