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
const { CIRCUITOS, liquidacionDe, certificadosDe } = require('./h1CauResponse');
const { OPERACION_REGISTRADA, ESTADO_DESPACHO, ESTADO_CONTABLE, PENDENCIAS, ADUANA_RESPONSABLE, describir } = require('./h1CauCodigos');

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
      pendencias: texto(gestion, 'pendingInformation'),
      // El mismo dato en palabras, segun las guias de la AEAT (null si el codigo no esta en ellas).
      textos: {
        operacionRegistrada: describir(OPERACION_REGISTRADA, texto(gestion, 'operationRegistered')),
        levante: describir(ESTADO_DESPACHO, texto(gestion, 'goodsReleaseStatus')),
        pago: describir(ESTADO_CONTABLE, texto(gestion, 'paymentStatus')),
        pendencias: describir(PENDENCIAS, texto(gestion, 'pendingInformation')),
        bajoControl: describir(ADUANA_RESPONSABLE, texto(gestion, 'underControl')),
        documentacionPendiente: describir(ADUANA_RESPONSABLE, texto(gestion, 'documentationPending'))
      },
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
    // Liquidacion y certificados con la misma forma que la respuesta al presentar.
    liquidacion: tributos ? liquidacionDe(tributos, hijo(r, 'DutiesTaxesAndGuarantee')) : null,
    certificados: certificadosDe(texto(gestion, 'requiredPCADocuments'), hijo(r, 'PCAdocuments')),
    documentosSolicitados: hijos(r, 'RequestedDocuments').map((d) => ({
      partida: numero(d, 'declarationGoodsItemNumber'), tipo: texto(d, 'type'), descripcion: texto(d, 'description')
    })),
    notificaciones: hijos(r, 'Notification').map((n) => ({ codigo: texto(n, 'code'), texto: texto(n, 'text') })),
    resultadoControl: control ? { codigo: texto(control, 'code'), fecha: texto(control, 'date'), observaciones: texto(control, 'remarks') } : null
  };
}

// ---------- traduccion al monitor de seguimiento ----------
//
// Criterio (codigos de h1CauCodigos.js; guias «Consulta de Importacion adaptado
// al CAU» v4.1 e «Informacion complementaria H1» v3.26, Separata 30):
//  - final + REJECTED: anulada (goodsReleaseStatus A, operationRegistered 40/43)
//    o sin levante definitivo (operationRegistered 41).
//  - final + RELEASED: despachada con levante (goodsReleaseStatus L u
//    operationRegistered 96). El pago posterior no cambia el despacho.
//  - CONTROL: intencion de control (42) o pendiente de despacho (P) con
//    circuito naranja/rojo o con la aduana teniendola bajo control.
//  - ACCEPTED: admitida (0, 62, 64, o con fecha de admision) o despachada sin
//    levante (D, p. ej. pendiente de pago o garantia).
//  - PENDING: el resto (predeclaraciones, pendientes de validar o de activar:
//    1-3, 60, 61, 63, 65, 66, 90, 91) y codigos que no estan en las guias.
const ANULADA = new Set(['40', '43']);
const SIN_LEVANTE = '41';
const LEVANTADA = '96';
const INTENCION_CONTROL = '42';
const ADMITIDA = new Set(['0', '62', '64']);
const TEXTO_CIRCUITO_H1 = {
  V: 'Verde: levante automático',
  A: 'Amarillo: control documental previo al despacho',
  N: 'Naranja: control documental',
  R: 'Rojo: control físico'
};

/** { status, final } del monitor para el bloque `estado` de interpretarConsultaH1Cau. */
function estadoMonitorH1Cau(estado) {
  const op = estado?.operacionRegistrada ?? null;
  const levante = estado?.levante ?? null;
  if (levante === 'A' || ANULADA.has(op)) return { status: 'REJECTED', final: true };
  if (op === SIN_LEVANTE) return { status: 'REJECTED', final: true };
  if (levante === 'L' || op === LEVANTADA) return { status: 'RELEASED', final: true };
  const bajoControl = op === INTENCION_CONTROL || ['N', 'R'].includes(estado?.circuito) || Boolean(estado?.bajoControl && estado.bajoControl !== '0');
  if (bajoControl && levante !== 'D') return { status: 'CONTROL', final: false };
  if (levante === 'D' || ADMITIDA.has(op) || estado?.fechaAdmision) return { status: 'ACCEPTED', final: false };
  return { status: 'PENDING', final: false };
}

/**
 * Resultado de interpretarConsultaH1Cau -> misma forma que las consultas
 * AES/NCTS (status, channel, estado, circuito, fechas, csv, final), sin perder
 * el detalle del H1 (pago, documentos pedidos, liquidacion...).
 * @param {object} r  salida de interpretarConsultaH1Cau
 * @param {{ mrn?: string }} [esperado]  MRN consultado: si la respuesta es de otro, no vale
 */
function normalizarConsultaH1Cau(r, esperado = {}) {
  const base = { success: false, tipo: r?.tipo || 'desconocida', mrn: r?.mrn || null, status: null, channel: null, rawResponse: r?.rawResponse || '' };
  if (!r?.success) return { ...r, ...base, error: r?.error || 'La AEAT rechazó la consulta' };

  const mrnPedido = esperado.mrn ? String(esperado.mrn).trim().toUpperCase() : null;
  if (mrnPedido && r.mrn !== mrnPedido) {
    return { ...base, error: `La AEAT respondió con otro MRN (${r.mrn}) al consultar ${mrnPedido}` };
  }

  const e = r.estado || {};
  const { status, final } = estadoMonitorH1Cau(e);
  const estadoTexto = [e.textos?.operacionRegistrada, e.textos?.levante].filter(Boolean).join(' · ') || null;
  return {
    ...base,
    success: true,
    tipo: 'encontrada',
    mrn: r.mrn,
    numeroRegistro: r.numeroRegistro || null,
    // Codigo principal: situacion de la declaracion (operationRegistered).
    estado: e.operacionRegistrada,
    estadoTexto,
    status,
    final,
    circuito: e.circuito,
    circuitoTexto: TEXTO_CIRCUITO_H1[e.circuito] || null,
    channel: e.channel,
    fechas: { alta: e.fechaRegistro, admision: e.fechaAdmision, levante: e.fechaLevante, limiteDePago: e.limiteDePago },
    csv: e.csvLevante,
    detalle: {
      levante: e.levante, pago: e.pago, pendencias: e.pendencias, bajoControl: e.bajoControl,
      documentacionPendiente: e.documentacionPendiente, certificadosRequeridos: e.certificadosRequeridos,
      csvCertificacion: e.csvCertificacion, textos: e.textos
    },
    liquidacion: r.liquidacion,
    documentosSolicitados: r.documentosSolicitados,
    notificaciones: r.notificaciones,
    resultadoControl: r.resultadoControl,
    messages: [estadoTexto, TEXTO_CIRCUITO_H1[e.circuito]].filter(Boolean)
  };
}

module.exports = { buildConsultaH1CauXML, interpretarConsultaH1Cau, normalizarConsultaH1Cau, estadoMonitorH1Cau, ENDPOINT_CONSULTA, NS_CONSULTA };
