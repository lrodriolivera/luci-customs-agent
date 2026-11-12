/**
 * Anulacion de una declaracion de importacion CAU (servicio CC414AV1).
 *
 * El servicio solo anula lo que aun no esta activado: predeclaracion
 * incompleta (PDI), declaracion completa pendiente de activar (DPA) y
 * simplificada pendiente de activar (SPA), y solo si la aduana no ha
 * notificado intencion de control (guia tecnica v3.20, apartado 10). Una
 * declaracion ya activada no se anula por servicio web: hay que solicitarlo a
 * la aduana, y el resultado llega por la Bandeja de Entrada.
 */
const { DOMParser } = require('@xmldom/xmldom');
const { xml } = require('./xmlTemplate');
const { fechaHora } = require('./h1CauXmlBuilder');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_CC414A = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/CC414AV1Ent.xsd';
const ENDPOINT_CC414A = '/wlpl/ADIP-JDIT/ws/cci/CC414AV1SOAP';

// Codigos de `operationRegistered` (Separata 30) que el servicio deja anular.
const ESTADOS_ANULABLES = new Set(['60', '61', '63', '65', '66']);

/** ¿Se puede anular por servicio web una declaracion en ese estado? */
const anulablePorServicio = (operacionRegistrada) => ESTADOS_ANULABLES.has(String(operacionRegistrada ?? ''));

const contacto = (c) => (c ? xml`<ContactPerson><name>${c.nombre}</name><phoneNumber>${c.telefono}</phoneNumber><eMailAddress>${c.email}</eMailAddress></ContactPerson>` : '');

/**
 * XML SOAP de la anulacion de una predeclaracion (regla ESC0930: LRN y numero
 * de registro, sin MRN).
 *
 * @param {{ mensajeId: string, lrn: string, numeroRegistro: string, motivo: string, declarante: object, representante?: object, fecha?: Date, test?: boolean }} d
 */
function buildAnulacionH1CauXML({ mensajeId, lrn, numeroRegistro, motivo, declarante, representante = null, fecha = new Date(), test = true }) {
  const razon = String(motivo || '').trim();
  if (!razon) throw new Error('La anulación necesita un motivo');
  if (!lrn || !numeroRegistro) throw new Error('La anulación necesita el LRN y el número de registro de la predeclaración');
  if (!declarante?.id) throw new Error('La anulación necesita el declarante');

  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
<soapenv:Header/>
<soapenv:Body>
<es:CC414AV1Ent xmlns:es="${NS_CC414A}">
<Message><messageIdentification>${mensajeId}</messageIdentification><preparationDateAndTime>${fechaHora(fecha)}</preparationDateAndTime>${test === false ? '' : xml`<testIndicator>S</testIndicator>`}</Message>
<CC414A>
<ImportOperation><LRN>${lrn}</LRN><customsRegistrationNumber>${numeroRegistro}</customsRegistrationNumber><invalidationRequestDateAndTime>${fechaHora(fecha)}</invalidationRequestDateAndTime><invalidationReason>${razon.slice(0, 512)}</invalidationReason></ImportOperation>
<Declarant><identificationNumber>${declarante.id}</identificationNumber>${contacto(declarante.contacto)}</Declarant>${representante ? xml`
<Representative><identificationNumber>${representante.id}</identificationNumber><status>${representante.estado}</status>${contacto(representante.contacto)}</Representative>` : ''}
</CC414A>
</es:CC414AV1Ent>
</soapenv:Body>
</soapenv:Envelope>`);
}

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

/** Respuesta `CC410AV1Sal`: anulacion admitida (CC410A), error funcional, error de XML o fallo SOAP. */
function interpretarAnulacionH1Cau(cuerpo) {
  const crudo = typeof cuerpo === 'string' ? cuerpo : '';
  const base = { success: false, tipo: 'desconocida', error: null, rawResponse: crudo };
  if (!crudo.trim()) return { ...base, error: 'La AEAT respondió sin contenido' };

  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(crudo, 'text/xml');
  if (!documento?.documentElement || fallos.length > 0) return { ...base, error: 'La respuesta de la AEAT no es un XML válido' };

  const fault = buscar(documento, 'Fault');
  if (fault) {
    return { ...base, tipo: 'fault', reintentable: /Server/i.test(texto(fault, 'faultcode') || ''), error: texto(fault, 'faultstring') || 'La AEAT devolvió un fallo sin descripción' };
  }
  const salida = buscar(documento, 'CC410AV1Sal');
  if (!salida) return { ...base, error: 'La respuesta no es del servicio de anulación' };

  const admitida = hijo(salida, 'CC410A');
  if (admitida) {
    return {
      ...base, success: true, tipo: 'anulada',
      lrn: texto(admitida, 'ImportOperation', 'LRN'),
      numeroRegistro: texto(admitida, 'ImportOperation', 'customsRegistrationNumber'),
      mrn: texto(admitida, 'ImportOperation', 'MRN'),
      fechaDecision: texto(admitida, 'ImportOperation', 'invalidationDecisionDateAndTime'),
      justificacion: texto(admitida, 'ImportOperation', 'invalidationJustification'),
      csv: texto(admitida, 'edeclarationCSVId')
    };
  }
  const rechazo = hijo(salida, 'CC456A');
  if (rechazo) {
    const errores = hijos(rechazo, 'FunctionalError').map((e) => ({
      codigo: texto(e, 'errorCode'), motivo: texto(e, 'errorReason'), puntero: texto(e, 'errorPointer'), observaciones: texto(e, 'remarks')
    }));
    return {
      ...base, tipo: 'error_funcional', errores,
      error: errores.map((e) => [e.motivo, e.observaciones].filter(Boolean).join(' ')).filter(Boolean).join(' | ') || 'La AEAT rechazó la anulación'
    };
  }
  const errorXml = hijo(salida, 'CD917A');
  if (errorXml) {
    return { ...base, tipo: 'error_xml', error: hijos(errorXml, 'XmlError').map((e) => texto(e, 'errorText')).filter(Boolean).join(' | ') || 'La AEAT no pudo leer la anulación' };
  }
  return { ...base, error: 'La respuesta no trae ni la anulación ni errores' };
}

module.exports = { buildAnulacionH1CauXML, interpretarAnulacionH1Cau, anulablePorServicio, ESTADOS_ANULABLES, ENDPOINT_CC414A, NS_CC414A };
