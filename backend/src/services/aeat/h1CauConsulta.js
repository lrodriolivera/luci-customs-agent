/**
 * Consulta de una declaracion de importacion CAU por su MRN (servicio
 * ConsultaImportacionV3 de la AEAT): estado, circuito, levante, pago,
 * documentos que pide la aduana y liquidacion.
 *
 * Sustituye a la consulta del DUA anterior (ConsultaImportacionV2 «PreCAU»),
 * que no sirve para las declaraciones presentadas por CC415A.
 */
const { DOMParser } = require('@xmldom/xmldom');
const { xml } = require('./xmlTemplate');
const { fechaHora } = require('./h1CauXmlBuilder');
const { CIRCUITOS } = require('./h1CauResponse');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_CONSULTA = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/ConsultaImportacionV3Ent.xsd';
const ENDPOINT_CONSULTA = '/wlpl/ADIP-JDIT/ws/cci/ConsultaImportacionV3SOAP';
const FORMATO_MRN = /^\d{2}[A-Z]{2}[A-Z0-9]{14}$/;

/** XML SOAP de la consulta. */
function buildConsultaH1CauXML({ mensajeId, mrn, fecha = new Date() }) {
  const limpio = String(mrn || '').trim().toUpperCase();
  if (!FORMATO_MRN.test(limpio)) throw new Error('MRN no válido para la consulta');
  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
<soapenv:Header/>
<soapenv:Body>
<es:ConsultaImportacionV3Ent xmlns:es="${NS_CONSULTA}">
<Message><messageIdentification>${mensajeId}</messageIdentification><preparationDateAndTime>${fechaHora(fecha)}</preparationDateAndTime></Message>
<ConsultaCompleta><MRN>${limpio}</MRN></ConsultaCompleta>
</es:ConsultaImportacionV3Ent>
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
const numero = (nodo, ...ruta) => {
  const v = texto(nodo, ...ruta);
  return v === null || Number.isNaN(Number(v)) ? null : Number(v);
};
function buscar(nodo, nombre) {
  for (const n of hijos(nodo)) {
    if (n.localName === nombre) return n;
    const dentro = buscar(n, nombre);
    if (dentro) return dentro;
  }
  return null;
}

/**
 * @param {string} cuerpo  respuesta HTTP del servicio
 * @returns {object} `{ success, tipo, mrn, estado: {...}, liquidacion, documentosSolicitados, notificaciones, error }`
 */
function interpretarConsultaH1Cau(cuerpo) {
  const crudo = typeof cuerpo === 'string' ? cuerpo : '';
  const base = { success: false, tipo: 'desconocida', mrn: null, estado: null, error: null, rawResponse: crudo };
  if (!crudo.trim()) return { ...base, error: 'La AEAT respondió sin contenido' };

  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(crudo, 'text/xml');
  if (!documento?.documentElement || fallos.length > 0) return { ...base, error: 'La respuesta de la AEAT no es un XML válido' };

  const fault = buscar(documento, 'Fault');
  if (fault) {
    return { ...base, tipo: 'fault', reintentable: /Server/i.test(texto(fault, 'faultcode') || ''), error: texto(fault, 'faultstring') || 'La AEAT devolvió un fallo sin descripción' };
  }
  const salida = buscar(documento, 'ConsultaImportacionV3Sal');
  if (!salida) return { ...base, error: 'La respuesta no es del servicio de consulta de importación' };

  const rechazo = hijo(salida, 'CC456A');
  if (rechazo) {
    const errores = hijos(rechazo, 'FunctionalError').map((e) => ({
      codigo: texto(e, 'errorCode'), motivo: texto(e, 'errorReason'), puntero: texto(e, 'errorPointer'), observaciones: texto(e, 'remarks')
    }));
    return {
      ...base, tipo: 'error_funcional', errores,
      error: errores.map((e) => [e.motivo, e.observaciones].filter(Boolean).join(' ')).filter(Boolean).join(' | ') || 'La AEAT rechazó la consulta'
    };
  }
  const errorXml = hijo(salida, 'CD917A');
  if (errorXml) {
    return { ...base, tipo: 'error_xml', error: hijos(errorXml, 'XmlError').map((e) => texto(e, 'errorText')).filter(Boolean).join(' | ') || 'La AEAT no pudo leer la consulta' };
  }

  const r = hijo(salida, 'ConsultaCompletaR');
  if (!r) return { ...base, error: 'La respuesta no trae ni la declaración ni errores' };
  const gestion = hijo(r, 'DeclarationManagement');
  const circuito = texto(gestion, 'riskAnalysisResultCodeAEAT');
  const tributos = hijo(r, 'DutiesTaxesAndGuarantee', 'DutiesAndTaxesAEAT');
  const control = hijo(r, 'CC429R_CD', 'ControlResult');

  return {
    ...base,
    success: true,
    tipo: 'encontrada',
    mrn: texto(r, 'ImportOperation', 'MRN'),
    numeroRegistro: texto(r, 'ImportOperation', 'customsRegistrationNumber'),
    estado: {
      operacionRegistrada: texto(gestion, 'operationRegistered'),
      levante: texto(gestion, 'goodsReleaseStatus'),
      bajoControl: texto(gestion, 'underControl'),
      documentacionPendiente: texto(gestion, 'documentationPending'),
      pago: texto(gestion, 'paymentStatus'),
      circuito,
      channel: CIRCUITOS[circuito] || null,
      certificadosRequeridos: texto(gestion, 'requiredPCADocuments'),
      fechaRegistro: texto(gestion, 'declarationRegistrationDateAndTime'),
      fechaAdmision: texto(gestion, 'declarationAcceptanceDateAndTime'),
      fechaLevante: texto(gestion, 'releaseDateAndTime'),
      limiteDePago: texto(gestion, 'paymentTimeLimit'),
      csvLevante: texto(gestion, 'releaseCSVId'),
      csvCertificacion: texto(gestion, 'importCertificationCSVId')
    },
    liquidacion: tributos ? { totalAPagar: numero(tributos, 'payableTaxAmount'), totalAGarantizar: numero(tributos, 'amountToGuarantee') } : null,
    // Certificados de otros organismos que exige cada partida.
    certificados: hijos(hijo(r, 'PCAdocuments'), 'GoodsItem').map((g) => ({
      partida: numero(g, 'declarationGoodsItemNumber'),
      organismos: hijos(g, 'PCA').map((p) => ({
        organismo: texto(p, 'code'),
        nombre: texto(p, 'name'),
        documentos: hijos(p, 'TaricMeasure').flatMap((m) => hijos(m, 'DocumentRequired').map((d) => texto(d, 'type'))).filter(Boolean)
      }))
    })),
    documentosSolicitados: hijos(r, 'RequestedDocuments').map((d) => ({
      partida: numero(d, 'declarationGoodsItemNumber'), tipo: texto(d, 'type'), descripcion: texto(d, 'description')
    })),
    notificaciones: hijos(r, 'Notification').map((n) => ({ codigo: texto(n, 'code'), texto: texto(n, 'text') })),
    resultadoControl: control ? { codigo: texto(control, 'code'), fecha: texto(control, 'date'), observaciones: texto(control, 'remarks') } : null
  };
}

module.exports = { buildConsultaH1CauXML, interpretarConsultaH1Cau, ENDPOINT_CONSULTA, NS_CONSULTA };
