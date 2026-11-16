/**
 * Consulta del estado de una exportacion (servicio CCAESCV1) o de un transito
 * (servicio CCTRACV2) por su MRN: estado, circuito, fechas, CSV y errores.
 *
 * Sustituye a la peticion inventada `<aeat:ConsultaDeclaracion>` que construia
 * aeatRealService y que la AEAT rechazaba con «103 - No se ha encontrado la
 * etiqueta de inicio». Igual que los envios, va por mTLS con el certificado de
 * LUCI (aeatTransport.sendSoap) y sin firma XAdES: asi respondio OK en PRE.
 *
 * Guias: «Servicios Web de Exportacion (AES)» v1.25 cap. 20 y «Servicios Web
 * de Transito (NCTS6)» v1.21, descripcion de CCTRAC. Significado de los
 * codigos y su traduccion al monitor en aesNctsCodigos.js.
 */
const crypto = require('crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { xml } = require('./xmlTemplate');
const { fechaHora } = require('./h1CauXmlBuilder');
const { CIRCUITOS, TEXTO_CIRCUITO, ESTADOS_AES, ESTADOS_NCTS, estadoMonitor, esFinal } = require('./aesNctsCodigos');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const BASE_NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat';
const FORMATO_MRN = /^\d{2}[A-Z]{2}[A-Z0-9]{14}$/;
// NIF/CIF/NIE del firmante, sin el prefijo de pais del EORI (error 211 si no es el del certificado).
const FORMATO_NIF = /^[A-Z0-9]{8,12}$/;
// Un EORI de otro pais (PT123..., FR...) no es un NIF espanol.
const EORI_EXTRANJERO = /^(?!ES)[A-Z]{2}\d/;

const SERVICIOS = {
  AES: {
    raiz: 'CCAESCV1Ent',
    mensaje: 'CCAESC',
    ns: `${BASE_NS}/adex/jdit/ws/aes/CCAESCV1Ent.xsd`,
    destinatario: 'NECA.ES',
    grupo: 'ExportOperation',
    salida: 'CCAESCV1Sal',
    endpoint: '/wlpl/ADEX-JDIT/ws/aes/CCAESCV1SOAP'
  },
  NCTS: {
    raiz: 'CCTRACV2Ent',
    mensaje: 'CCTRAC',
    ns: `${BASE_NS}/adtr/jdit/ws/ncts5/CCTRACV2Ent.xsd`,
    destinatario: 'NTA.ES',
    grupo: 'TransitOperation',
    salida: 'CCTRACV2Sal',
    endpoint: '/wlpl/ADTR-JDIT/ws/ncts5/CCTRACV2SOAP'
  }
};

/** NIF del remitente a partir de un EORI espanol o un NIF suelto. */
function nifRemitente(valor) {
  return String(valor || '').trim().toUpperCase().replace(/^ES/, '');
}

function _buildConsulta(servicio, { mensajeId, mrn, sender, fecha = new Date() }) {
  const limpio = String(mrn || '').trim().toUpperCase();
  if (!FORMATO_MRN.test(limpio)) throw new Error('MRN no válido para la consulta');
  const remitente = nifRemitente(sender);
  if (EORI_EXTRANJERO.test(String(sender || '').trim().toUpperCase()) || !FORMATO_NIF.test(remitente)) throw new Error('NIF del remitente no válido para la consulta');
  const s = SERVICIOS[servicio];
  // El prefijo `c:` y el orden de MESSAGE son los del XSD (grupo MESSAGE de ES_htypes).
  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
<soapenv:Header/>
<soapenv:Body>
<c:${s.raiz} xmlns:c="${s.ns}" Id="${mensajeId}"><c:${s.mensaje}><c:messageSender>${remitente}</c:messageSender><c:messageRecipient>${s.destinatario}</c:messageRecipient><c:preparationDateAndTime>${fechaHora(fecha)}</c:preparationDateAndTime><c:messageIdentification>${mensajeId}</c:messageIdentification><c:messageType>${s.mensaje}</c:messageType><c:${s.grupo}><c:MRN>${limpio}</c:MRN></c:${s.grupo}></c:${s.mensaje}></c:${s.raiz}>
</soapenv:Body>
</soapenv:Envelope>`);
}

/** Peticion CCAESCV1Ent (consulta de exportacion). */
const buildConsultaAesXML = (datos) => _buildConsulta('AES', datos);
/** Peticion CCTRACV2Ent (consulta de transito). */
const buildConsultaNctsXML = (datos) => _buildConsulta('NCTS', datos);

// ---------- lectura de la respuesta ----------

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

/** Documento de la respuesta y su elemento de salida, o el resultado de fallo. */
function _salidaDe(cuerpo, nombreSalida, base) {
  if (!cuerpo.trim()) return { fallo: { ...base, error: 'La AEAT respondió sin contenido' } };
  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(cuerpo, 'text/xml');
  if (!documento?.documentElement || fallos.length > 0) return { fallo: { ...base, error: 'La respuesta de la AEAT no es un XML válido' } };

  const fault = buscar(documento, 'Fault');
  if (fault) {
    return {
      fallo: {
        ...base, tipo: 'fault', reintentable: /Server/i.test(texto(fault, 'faultcode') || ''),
        error: texto(fault, 'faultstring') || 'La AEAT devolvió un fallo sin descripción'
      }
    };
  }
  const salida = buscar(documento, nombreSalida);
  if (!salida) return { fallo: { ...base, error: `La respuesta no es del servicio ${nombreSalida}` } };
  return { salida };
}

/** Errores EX (XMLError) o EF (FunctionalError), o null si no los hay. */
function _erroresDe(salida, base) {
  const xmlErr = hijos(salida, 'XMLError');
  if (xmlErr.length) {
    const errores = xmlErr.map((e) => ({ codigo: texto(e, 'errorCode'), puntero: texto(e, 'errorPointer'), texto: texto(e, 'errorText') }));
    return {
      ...base, tipo: 'error_xml', errores,
      error: errores.map((e) => e.texto).filter(Boolean).join(' | ') || 'La AEAT no pudo leer la consulta'
    };
  }
  const funcionales = hijos(salida, 'FunctionalError');
  if (funcionales.length) {
    const errores = funcionales.map((e) => ({
      codigo: texto(e, 'errorCode'), motivo: texto(e, 'errorReason'), puntero: texto(e, 'errorPointer'), texto: texto(e, 'errorDescription')
    }));
    return {
      ...base, tipo: 'error_funcional', errores,
      error: errores.map((e) => [e.puntero, e.texto].filter(Boolean).join(': ')).filter(Boolean).join(' | ') || 'La AEAT rechazó la consulta'
    };
  }
  return null;
}

/**
 * @param {string} cuerpo  respuesta HTTP
 * @param {object} cfg     nombres de la salida, grupos y campos del servicio
 * @param {{ mrn?: string }} [esperado]  MRN consultado: si la respuesta es de otro, no vale
 */
function _interpretar(cuerpo, cfg, esperado = {}) {
  const crudo = typeof cuerpo === 'string' ? cuerpo : '';
  const base = { success: false, tipo: 'desconocida', mrn: null, status: null, channel: null, error: null, rawResponse: crudo };
  const { salida, fallo } = _salidaDe(crudo, cfg.salida, base);
  if (fallo) return fallo;

  const tipoRespuesta = texto(salida, 'ControlRespuesta', 'tipoRespuesta');
  const conError = _erroresDe(salida, { ...base, tipoRespuesta });
  if (conError) return conError;

  const datos = hijo(salida, 'DatosRespuestaCorrecta');
  const operacion = hijo(datos, cfg.grupo);
  const gestion = hijo(datos, cfg.gestion);
  if (tipoRespuesta !== 'OK' || !operacion || !gestion) {
    return { ...base, tipoRespuesta, error: 'La respuesta no trae ni la declaración ni errores' };
  }

  const mrnRespuesta = texto(operacion, 'MRN');
  const mrnPedido = esperado.mrn ? String(esperado.mrn).trim().toUpperCase() : null;
  if (mrnPedido && mrnRespuesta !== mrnPedido) {
    return { ...base, tipoRespuesta, mrn: mrnRespuesta, error: `La AEAT respondió con otro MRN (${mrnRespuesta}) al consultar ${mrnPedido}` };
  }

  const estado = texto(gestion, cfg.campoEstado);
  const circuito = texto(gestion, cfg.campoCircuito);
  const admision = texto(gestion, 'fechaAdmision');
  const status = estadoMonitor(cfg.estados, estado, Boolean(admision));
  const estadoTexto = cfg.estados[estado]?.texto || null;
  const fechas = { alta: texto(gestion, 'fechaHoraAlta'), admision, levante: texto(gestion, 'fechaLevante') };
  if (cfg.conLimiteLlegada) fechas.limiteLlegada = texto(gestion, 'fechaLimiteLlegada');

  return {
    ...base,
    success: true,
    tipo: 'encontrada',
    tipoRespuesta,
    mrn: mrnRespuesta,
    lrn: texto(operacion, 'LRN'),
    tipoDeclaracion: texto(operacion, 'declarationType'),
    estado,
    estadoTexto,
    status,
    final: esFinal(cfg.estados, estado),
    circuito,
    circuitoTexto: TEXTO_CIRCUITO[circuito] || null,
    channel: CIRCUITOS[circuito] || null,
    fechas,
    csv: texto(gestion, cfg.campoCsv),
    fase: texto(gestion, cfg.campoFase),
    messages: [estadoTexto ? `${estado}: ${estadoTexto}` : estado, TEXTO_CIRCUITO[circuito]].filter(Boolean)
  };
}

/** Respuesta CCAESCV1Sal -> objeto normalizado. */
function interpretarConsultaAes(cuerpo, esperado) {
  return _interpretar(cuerpo, {
    salida: 'CCAESCV1Sal', grupo: 'ExportOperation', gestion: 'AESDatosGestion', estados: ESTADOS_AES,
    campoEstado: 'estadoAES', campoCircuito: 'circuitoAEAT', campoCsv: 'CSVLevanteExportacion', campoFase: 'faseAES'
  }, esperado);
}

/** Respuesta CCTRACV2Sal -> objeto normalizado. */
function interpretarConsultaNcts(cuerpo, esperado) {
  return _interpretar(cuerpo, {
    salida: 'CCTRACV2Sal', grupo: 'TransitOperation', gestion: 'Ncts5DatosGestion', estados: ESTADOS_NCTS,
    campoEstado: 'estado', campoCircuito: 'circuitoExpedicion', campoCsv: 'CSVdeDAT', campoFase: 'faseOrigen', conLimiteLlegada: true
  }, esperado);
}

/** Identificador de mensaje (tambien el Id del sobre): `LUCIQ` + fecha UTC con ms + 4 cifras aleatorias. */
function idMensajeConsulta(ahora = new Date()) {
  return `LUCIQ${ahora.toISOString().replace(/\D/g, '').slice(2, 17)}${crypto.randomInt(1000, 10000)}`;
}

module.exports = {
  buildConsultaAesXML,
  buildConsultaNctsXML,
  interpretarConsultaAes,
  interpretarConsultaNcts,
  idMensajeConsulta,
  nifRemitente,
  ENDPOINT_AES: SERVICIOS.AES.endpoint,
  ENDPOINT_NCTS: SERVICIOS.NCTS.endpoint
};
