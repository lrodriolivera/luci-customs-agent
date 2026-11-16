/**
 * Bandeja de entrada de la AEAT: avisos de exportación AES.
 *
 * La AEAT no responde por servicio síncrono el levante en aduana con control,
 * el levante en la aduana de salida ni el resultado de la salida (salida
 * efectiva o parada, el equivalente del CC599C): los deja en la «Bandeja de
 * Entrada» del destinatario (representante o, si no hay, declarante del
 * CC515C) y el operador los recoge en dos pasos (guía AES v1.25 §4.2, §14-22 y
 * documento «Bandeja de entrada» v0.14 §4):
 *
 *   1. ListaDecV4 (/wlpl/ADHT-BAND/ws/li/ListaDecV4SOAP): con el NIF del
 *      destinatario devuelve hasta 1000 pendientes de leer, de cualquier
 *      negociado, con su `clave`, `referencia` y `tipoRespuesta`. La
 *      referencia de un aviso AES es «ADEX» + MRN + código (CLEVEX, CSALID...)
 *      + letra de resultado.
 *   2. DetalleV5 (/wlpl/ADHT-BAND/ws/det/DetalleV5SOAP): con la `clave`
 *      devuelve el aviso (ComunicaXxxV1Sal). Leerlo lo pasa a «Leído» en la
 *      AEAT: no hay otro servicio para confirmar la lectura y ya no vuelve a
 *      salir en la lista (ListaLeidosV1 da las claves ya leídas).
 *
 * Igual que las consultas (aesNctsConsulta.js), va por mTLS con el certificado
 * de LUCI (aeatTransport.sendSoap) y sin firma XAdES: los esquemas de entrada
 * de la bandeja no la piden.
 *
 * Solo se construyen peticiones y se interpretan respuestas; la lectura
 * periódica y lo que cambia en LUCI está en aesBandejaProceso.js.
 */
const { DOMParser } = require('@xmldom/xmldom');
const { xml } = require('./xmlTemplate');
const { ESTADOS_AES, esFinal } = require('./aesNctsCodigos');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const BASE_NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat';
const NS_LISTA = `${BASE_NS}/adht/band/ws/li/ListaDecV4Ent.xsd`;
const NS_DETALLE = `${BASE_NS}/adht/band/ws/det/DetalleV5Ent.xsd`;
const ENDPOINT_LISTA = '/wlpl/ADHT-BAND/ws/li/ListaDecV4SOAP';
const ENDPOINT_DETALLE = '/wlpl/ADHT-BAND/ws/det/DetalleV5SOAP';

const FORMATO_MRN = /^\d{2}[A-Z]{2}[A-Z0-9]{14}$/;
const FORMATO_NIF = /^[A-Z0-9]{8,12}$/;
const EORI_EXTRANJERO = /^(?!ES)[A-Z]{2}\d/;
const FORMATO_CLAVE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Avisos de exportación de la guía AES v1.25 (cap. y servicio).
 * `campos`: elemento de DatosComunicacion -> nombre en LUCI.
 */
const TIPOS_AVISO_AES = Object.freeze({
  CLEVEX: { texto: 'Levante en la aduana de exportación', servicio: 'ComunicaLevanteExpor', capitulo: 14,
    campos: { fechaLevante: 'fechaLevante', CSVLevanteExportacion: 'csvLevante', CSVDocumentoT2L: 'csvT2L', flagDirectaIndirecta: 'flagDirectaIndirecta' } },
  CDISEX: { texto: 'Despacho disconforme en la aduana de exportación', servicio: 'ComunicaDisconformeExpor', capitulo: 15,
    campos: { otrasCosasAInformar: 'motivo' } },
  CLEVSA: { texto: 'Levante en la aduana de salida', servicio: 'ComunicaLevanteSalida', capitulo: 16,
    campos: { fechaLevanteSalida: 'fechaLevanteSalida', CSVLevanteSalida: 'csvLevanteSalida' } },
  CDISSA: { texto: 'Despacho disconforme en la aduana de salida', servicio: 'ComunicaDisconformeSalida', capitulo: 17,
    campos: { fechaDisconformeSalida: 'fechaDisconforme', otrasCosasAInformar: 'motivo' } },
  CONCCE: { texto: 'Decisión de controles de la aduana de presentación extranjera', servicio: 'ComunicaControlesCCE', capitulo: 18,
    campos: { fechaNotificacionControl: 'fechaNotificacion', tipoNotificacion: 'tipoNotificacion' } },
  CINVAL: { texto: 'Invalidación de la exportación', servicio: 'ComunicaInvalidacion', capitulo: 19,
    campos: { fechaInvalidacion: 'fechaInvalidacion', fechaHoraSolicitudInvalidacion: 'fechaSolicitud', invalidacionIniciadaPorLaAduana: 'invalidacionIniciadaPorLaAduana', justificacionDeLaInvalidacion: 'justificacion' } },
  CSALID: { texto: 'Resultado de la salida', servicio: 'ComunicaResulSalida', capitulo: 22,
    campos: { fechaSalidaEfectiva: 'fechaSalidaEfectiva', resultadoSalida: 'resultadoSalida', fechaParadaAduanaSalida: 'fechaParada' } }
});

/** Resultado de la salida (guía §22.4). */
const RESULTADOS_SALIDA = Object.freeze({
  A1: 'Resultado conforme con inspección física o documental',
  A2: 'Resultado automático considerado conforme',
  A4: 'Resultado conforme con discrepancias menores',
  B1: 'Resultado disconforme'
});

// Mismos códigos que TIPOS_AVISO_AES (un test lo comprueba).
const REFERENCIA_AES = /^ADEX(\d{2}[A-Z]{2}[A-Z0-9]{14})(CLEVEX|CDISEX|CLEVSA|CDISSA|CONCCE|CINVAL|CSALID)([A-Z])$/;

/** NIF de la bandeja (sin el ES del EORI); lanza si no es un NIF español. */
function nifBandeja(valor) {
  const crudo = String(valor || '').trim().toUpperCase();
  const nif = crudo.replace(/^ES/, '');
  if (EORI_EXTRANJERO.test(crudo) || !FORMATO_NIF.test(nif)) throw new Error('NIF no válido para la bandeja de entrada');
  return nif;
}

const sobre = (cuerpo) => String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
<soapenv:Header/>
<soapenv:Body>
${cuerpo}
</soapenv:Body>
</soapenv:Envelope>`);

/**
 * Petición ListaDecV4Ent: pendientes de leer del NIF.
 * @param {{ nif: string, nombre?: string, tipoRespuesta?: string }} datos
 */
function buildListaBandejaXML({ nif, nombre, tipoRespuesta } = {}) {
  const limpio = nifBandeja(nif);
  const nombreDeclarante = String(nombre || '').trim() || limpio;
  const filtro = tipoRespuesta ? xml` tipoRespuesta="${tipoRespuesta}"` : '';
  return sobre(xml`<l:ListaDecV4Ent xmlns:l="${NS_LISTA}"${filtro}><l:declarante><l:NifDeclarante>${limpio}</l:NifDeclarante><l:NombreDeclarante>${nombreDeclarante}</l:NombreDeclarante></l:declarante></l:ListaDecV4Ent>`);
}

/**
 * Petición DetalleV5Ent: un aviso por su clave. OJO: la AEAT lo marca leído.
 * @param {{ clave: string }} datos
 */
function buildDetalleBandejaXML({ clave } = {}) {
  const limpia = String(clave || '').trim();
  if (!FORMATO_CLAVE.test(limpia)) throw new Error('clave de la bandeja no válida');
  return sobre(xml`<d:DetalleV5Ent xmlns:d="${NS_DETALLE}"><d:clave>${limpia}</d:clave></d:DetalleV5Ent>`);
}

/** MRN, código y letra de resultado de una referencia AES, o null. */
function referenciaAes(referencia) {
  const m = REFERENCIA_AES.exec(String(referencia || '').trim().toUpperCase());
  return m ? { mrn: m[1], codigo: m[2], resultado: m[3] } : null;
}

// ---------- lectura de respuestas ----------

const hijos = (nodo, nombre) => {
  const lista = [];
  for (let n = nodo?.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!nombre || n.localName === nombre)) lista.push(n);
  return lista;
};
const hijo = (nodo, nombre) => hijos(nodo, nombre)[0];
const texto = (nodo, nombre) => (nombre ? hijo(nodo, nombre) : nodo)?.textContent?.trim() || null;

function buscar(nodo, predicado) {
  for (const n of hijos(nodo)) {
    if (predicado(n)) return n;
    const dentro = buscar(n, predicado);
    if (dentro) return dentro;
  }
  return null;
}

/** Elemento de salida que cumple `esSalida`, o el fallo normalizado. */
function _salidaDe(cuerpo, esSalida, descripcion) {
  const crudo = typeof cuerpo === 'string' ? cuerpo : '';
  const base = { success: false, tipo: 'desconocida', error: null };
  if (!crudo.trim()) return { fallo: { ...base, error: 'La AEAT respondió sin contenido' } };
  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(crudo, 'text/xml');
  if (!documento?.documentElement || fallos.length > 0) return { fallo: { ...base, error: 'La respuesta de la AEAT no es un XML válido' } };

  const fault = buscar(documento, (n) => n.localName === 'Fault');
  if (fault) {
    return {
      fallo: {
        ...base, tipo: 'fault', reintentable: /Server/i.test(texto(fault, 'faultcode') || ''),
        error: texto(fault, 'faultstring') || 'La AEAT devolvió un fallo sin descripción'
      }
    };
  }
  const salida = esSalida(documento.documentElement) ? documento.documentElement : buscar(documento, esSalida);
  if (!salida) return { fallo: { ...base, error: `La respuesta no es ${descripcion}` } };
  return { salida };
}

/**
 * Respuesta ListaDecV4Sal.
 * @returns {{ success: boolean, total?: number, avisos?: Array<{clave, referencia, tipoRespuesta, mrn, codigo, resultado}>, error?: string, tipo?: string, reintentable?: boolean }}
 *   `avisos`: solo los de exportación AES (el resto de negociados no se toca).
 */
function interpretarLista(cuerpo) {
  const { salida, fallo } = _salidaDe(cuerpo, (n) => n.localName === 'ListaDecV4Sal', 'la lista de la bandeja (ListaDecV4Sal)');
  if (fallo) return fallo;
  const declaraciones = hijos(salida, 'declaracion').map((d) => ({
    clave: texto(d, 'clave'), referencia: texto(d, 'referencia'), tipoRespuesta: texto(d, 'tipoRespuesta')
  }));
  const avisos = declaraciones
    .map((d) => ({ ...d, ...(referenciaAes(d.referencia) || {}) }))
    .filter((d) => d.mrn && d.clave && FORMATO_CLAVE.test(d.clave));
  return { success: true, tipo: 'lista', total: declaraciones.length, avisos, error: null };
}

/** Campos de DatosComunicacion traducidos a LUCI, más los derivados. */
function _datosDe(tipo, nodoDatos, salida) {
  const datos = {};
  for (const [aeat, luci] of Object.entries(TIPOS_AVISO_AES[tipo].campos)) {
    const valor = texto(nodoDatos, aeat);
    if (valor !== null) datos[luci] = valor;
  }
  if (tipo === 'CLEVEX' && datos.flagDirectaIndirecta) {
    const flag = datos.flagDirectaIndirecta;
    if (flag === 'D' || flag === 'I') datos.salidaDirecta = flag === 'D';
  }
  if (tipo === 'CSALID' && datos.resultadoSalida) {
    datos.resultadoSalidaTexto = RESULTADOS_SALIDA[datos.resultadoSalida] || null;
  }
  if (tipo === 'CINVAL' && datos.invalidacionIniciadaPorLaAduana !== undefined) {
    datos.iniciadaPorAduana = datos.invalidacionIniciadaPorLaAduana === '1';
    delete datos.invalidacionIniciadaPorLaAduana;
  }
  if (tipo === 'CONCCE') {
    datos.controles = hijos(salida, 'TipoDeControl').map((c) => ({ tipo: texto(c, 'tipo'), texto: texto(c, 'texto') }));
    datos.documentos = hijos(salida, 'DocumentoSolicitado').map((d) => ({ tipo: texto(d, 'tipoDocumento'), descripcion: texto(d, 'descripcion') }));
  }
  return datos;
}

/**
 * Respuesta DetalleV5 con un aviso AES (ComunicaXxxV1Sal).
 * @param {string} cuerpo
 * @param {{ mrn?: string }} [esperado]  MRN de la referencia de la lista
 */
function interpretarAviso(cuerpo, esperado = {}) {
  const esAviso = (n) => /^Comunica[A-Za-z]+V\d+Sal$/.test(n.localName || '');
  const { salida, fallo } = _salidaDe(cuerpo, esAviso, 'un aviso de exportación AES');
  if (fallo) return fallo;
  const base = { success: false, tipo: 'aviso' };

  const tipo = texto(salida, 'messageType');
  if (!Object.hasOwn(TIPOS_AVISO_AES, tipo || '')) return { ...base, error: `Tipo de aviso AES desconocido: ${tipo}` };
  const nodoDatos = hijo(salida, 'DatosComunicacion');
  const mrn = String(texto(nodoDatos, 'MRN') || '').toUpperCase();
  if (!FORMATO_MRN.test(mrn)) return { ...base, error: 'El aviso no trae un MRN válido' };
  const mrnEsperado = esperado.mrn ? String(esperado.mrn).trim().toUpperCase() : null;
  if (mrnEsperado && mrn !== mrnEsperado) return { ...base, error: `El aviso es de otro MRN (${mrn}) que el de la referencia (${mrnEsperado})` };

  const estadoAES = texto(nodoDatos, 'estadoAES');
  const destinatario = String(texto(salida, 'messageRecipient') || '').toUpperCase().replace(/^ES/, '') || null;
  return {
    success: true,
    tipo,
    tipoTexto: TIPOS_AVISO_AES[tipo].texto,
    id: salida.getAttribute('Id') || null,
    mensajeId: texto(salida, 'messageIdentification'),
    destinatario,
    fechaPreparacion: texto(salida, 'preparationDateAndTime'),
    mrn,
    estadoAES,
    estadoTexto: ESTADOS_AES[estadoAES]?.texto || null,
    final: esFinal(ESTADOS_AES, estadoAES),
    datos: _datosDe(tipo, nodoDatos, salida),
    error: null
  };
}

module.exports = {
  buildListaBandejaXML,
  buildDetalleBandejaXML,
  interpretarLista,
  interpretarAviso,
  referenciaAes,
  nifBandeja,
  TIPOS_AVISO_AES,
  RESULTADOS_SALIDA,
  ENDPOINT_LISTA,
  ENDPOINT_DETALLE
};
