/**
 * Consulta del estado de una declaracion de escaso valor H7 por su MRN
 * (servicio ConsultaH7V1 de la AEAT): situacion, circuito, fechas, CSV del
 * levante y liquidacion.
 *
 * Sustituye a la consulta inventada `H7QueryV1` (no existe: 404). Igual que el
 * alta del H7 (AltaH7V1), va por mTLS con el certificado de LUCI
 * (aeatTransport.sendSoap) y sin firma XAdES.
 *
 * Fuentes:
 *  - ConsultaH7V1.wsdl, ConsultaH7V1Ent.xsd, ConsultaH7V1Sal.xsd y
 *    TiposDatosH7.xsd, carpeta .../es/aeat/adip/jdit/ws/h7/ de
 *    https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/ws.html
 *    Endpoint (PRE y produccion): /wlpl/ADIP-JDIT/ws/ConsultaH7V1SOAP.
 *  - «Servicio de presentacion de declaraciones H7» v3.23: 10.3 (mensajes de
 *    consulta), CS105 (circuito) y tabla LSSD (situaciones de la declaracion).
 *
 * Situaciones LSSD y su traduccion al monitor (PENDING, ACCEPTED, CONTROL,
 * RELEASED, REJECTED). La guia marca como «estado final» SOLO AN (invalidada)
 * y U1 (declarado en un H1 despachado con despacho conforme); el resto son
 * intermedios: un LE (levante) aun puede pasar a IN por reexportacion, y un
 * NL o un DV aun pueden reexportarse. Por eso el monitor solo deja de
 * consultar en AN y U1.
 */
const { DOMParser } = require('@xmldom/xmldom');
const { xml } = require('./xmlTemplate');
const { fechaHora } = require('./h1CauXmlBuilder');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_CONSULTA = 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/h7/ConsultaH7V1Ent.xsd';
const ENDPOINT_CONSULTA_H7 = '/wlpl/ADIP-JDIT/ws/ConsultaH7V1SOAP';
const FORMATO_MRN = /^\d{2}[A-Z]{2}[A-Z0-9]{14}$/;

const ESTADOS_H7 = {
  PR: { texto: 'Predeclaración completa con/sin control aduanero', monitor: 'PENDING' },
  PD: { texto: 'Declaración pendiente de despacho', monitor: 'CONTROL' },
  DE: { texto: 'Declaración despachada (pendiente de pago previo)', monitor: 'ACCEPTED' },
  LE: { texto: 'Declaración con levante: se puede entregar el paquete', monitor: 'RELEASED' },
  AN: { texto: 'Invalidada', monitor: 'REJECTED', final: true },
  H1: { texto: 'Pendiente de declaración en DUA de alto valor (H1)', monitor: 'PENDING' },
  CA: { texto: 'Carta de pago realizada (arancel y tasa de la Unión, SA): se puede entregar el paquete', monitor: 'RELEASED' },
  CP: { texto: 'Carta de pago realizada (arancel, tasa de la Unión e IVA): se puede entregar el paquete', monitor: 'RELEASED' },
  NL: { texto: 'No levante', monitor: 'REJECTED' },
  DV: { texto: 'Devuelto', monitor: 'REJECTED' },
  IN: { texto: 'Mercancía enviada fuera del territorio aduanero (EXS, ETD)', monitor: 'REJECTED' },
  U1: { texto: 'Declarado en un H1 de alto valor despachado con despacho conforme', monitor: 'RELEASED', final: true },
  AD: { texto: 'Abandono o destrucción', monitor: 'REJECTED' },
  A1: { texto: 'Declarado en un H1 de alto valor', monitor: 'PENDING' },
  RA: { texto: 'Anulada la reexportación, pendiente de confirmar con una EXS/ETD anulada', monitor: 'PENDING' }
};

// CS105: L latencia (circuito aun no conocido), V sin control, N/R bajo control.
const CIRCUITOS_H7 = { V: 'green', N: 'orange', R: 'red' };
const TEXTO_CIRCUITO_H7 = {
  L: 'Latencia: el circuito se conocerá al terminar la latencia de la ENS',
  V: 'Verde: no está bajo control aduanero',
  N: 'Naranja: bajo control aduanero',
  R: 'Rojo: bajo control aduanero'
};

/**
 * XML SOAP de la consulta (ConsultaH7V1Ent).
 * @param {{ mensajeId: string, mrn: string, fecha?: Date, test?: boolean }} datos
 *   `test`: mensaje de pruebas (ES.AEAT.PRUEBAS + testIndicator S), como el alta en PRE.
 */
function buildConsultaH7XML({ mensajeId, mrn, fecha = new Date(), test = false }) {
  const limpio = String(mrn || '').trim().toUpperCase();
  if (!FORMATO_MRN.test(limpio)) throw new Error('MRN no válido para la consulta');
  const [dia, hora] = fechaHora(fecha).split('T');
  return String(xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
<soapenv:Header/>
<soapenv:Body>
<n1:ConsultaH7V1Ent xmlns:n1="${NS_CONSULTA}">
<Message><messageIdentification>${mensajeId}</messageIdentification><messageRecipient>${test ? 'ES.AEAT.PRUEBAS' : 'ES.AEAT'}</messageRecipient><preparationDate>${dia.replace(/-/g, '')}</preparationDate><preparationTime>${hora.replace(/:/g, '')}</preparationTime><testIndicator>${test ? 'S' : 'N'}</testIndicator></Message>
<Declaration><MRN_H7>${limpio}</MRN_H7></Declaration>
</n1:ConsultaH7V1Ent>
</soapenv:Body>
</soapenv:Envelope>`);
}

// ---------- lectura de la respuesta ----------

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

/** AAAAMMDD + HHMMSS -> 'AAAA-MM-DDTHH:MM:SS' (o solo la fecha si no hay hora). */
function fechaIso(dia, hora) {
  if (!/^\d{8}$/.test(dia || '')) return null;
  const f = `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6, 8)}`;
  return /^\d{6}$/.test(hora || '') ? `${f}T${hora.slice(0, 2)}:${hora.slice(2, 4)}:${hora.slice(4, 6)}` : f;
}

function _documento(crudo) {
  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(crudo, 'text/xml');
  return documento?.documentElement && fallos.length === 0 ? documento : null;
}

function _liquidacion(info) {
  const calculo = hijo(info, 'CalculationOfTaxes');
  if (!calculo) return null;
  const tributos = hijos(calculo, 'Tax').map((t) => ({
    tipo: texto(t, 'taxType'), cuota: numero(t, 'payableTaxAmount'), base: numero(t, 'taxBase')
  }));
  return { divisa: texto(calculo, 'currencyCode') || 'EUR', tributos, total: tributos.reduce((s, t) => s + (t.cuota || 0), 0) };
}

/**
 * Respuesta ConsultaH7V1Sal -> objeto normalizado con la misma forma que las
 * consultas AES/NCTS (status, channel, estado, circuito, fechas, csv, final).
 * @param {string} cuerpo  respuesta HTTP
 * @param {{ mrn?: string }} [esperado]  MRN consultado: se busca su MRNInfo
 */
function interpretarConsultaH7(cuerpo, esperado = {}) {
  const crudo = typeof cuerpo === 'string' ? cuerpo : '';
  const base = { success: false, tipo: 'desconocida', mrn: null, status: null, channel: null, error: null, rawResponse: crudo };
  if (!crudo.trim()) return { ...base, error: 'La AEAT respondió sin contenido' };
  const documento = _documento(crudo);
  if (!documento) return { ...base, error: 'La respuesta de la AEAT no es un XML válido' };

  const fault = buscar(documento, 'Fault');
  if (fault) {
    return { ...base, tipo: 'fault', reintentable: /Server/i.test(texto(fault, 'faultcode') || ''), error: texto(fault, 'faultstring') || 'La AEAT devolvió un fallo sin descripción' };
  }
  const salida = buscar(documento, 'ConsultaH7V1Sal');
  if (!salida) return { ...base, error: 'La respuesta no es del servicio ConsultaH7V1' };

  const codigoRespuesta = texto(salida, 'Response', 'responseCode');
  const errores = hijos(salida, 'Error').map((e) => ({
    tipo: texto(e, 'errorType'), codigo: texto(e, 'errorCode'), motivo: texto(e, 'errorReason'), puntero: texto(e, 'errorPointerTag')
  }));
  if (codigoRespuesta !== 'A' || errores.length) {
    const funcional = errores.some((e) => e.tipo === 'F') || errores.length === 0;
    return {
      ...base, tipoRespuesta: codigoRespuesta, tipo: funcional ? 'error_funcional' : 'error_xml', errores,
      error: errores.map((e) => [e.codigo, e.motivo].filter(Boolean).join(' - ')).filter(Boolean).join(' | ') || 'La AEAT rechazó la consulta'
    };
  }

  const infos = hijos(hijo(salida, 'Response'), 'MRNInfo');
  const mrnPedido = esperado.mrn ? String(esperado.mrn).trim().toUpperCase() : null;
  const info = mrnPedido ? infos.find((i) => texto(i, 'MRN') === mrnPedido) : infos[0];
  if (!info) {
    return {
      ...base, tipoRespuesta: codigoRespuesta,
      error: infos.length ? `La AEAT respondió con otro MRN (${texto(infos[0], 'MRN')}) al consultar ${mrnPedido}` : 'La respuesta no trae la declaración consultada'
    };
  }

  const estado = texto(info, 'statusDeclaration');
  const circuito = texto(info, 'riskAnalysisResultCode');
  const fechas = {
    alta: fechaIso(texto(info, 'presentationDate'), texto(info, 'presentationTime')),
    admision: fechaIso(texto(info, 'declarationAcceptanceDate'), texto(info, 'declarationAcceptanceTime')),
    levante: fechaIso(texto(info, 'releaseDate'), texto(info, 'releaseTime'))
  };
  const conocido = Object.hasOwn(ESTADOS_H7, estado || '') ? ESTADOS_H7[estado] : null;
  const estadoTexto = conocido?.texto || null;
  const status = conocido ? conocido.monitor : (fechas.admision ? 'ACCEPTED' : 'PENDING');

  return {
    ...base,
    success: true,
    tipo: 'encontrada',
    tipoRespuesta: codigoRespuesta,
    mrn: texto(info, 'MRN'),
    estado,
    estadoTexto,
    status,
    final: Boolean(conocido?.final),
    circuito,
    circuitoTexto: TEXTO_CIRCUITO_H7[circuito] || null,
    channel: CIRCUITOS_H7[circuito] || null,
    documentacionRequerida: texto(info, 'documentationRequired'),
    fechas,
    csv: texto(info, 'releaseCSVId'),
    liquidacion: _liquidacion(info),
    messages: [estadoTexto ? `${estado}: ${estadoTexto}` : estado, TEXTO_CIRCUITO_H7[circuito]].filter(Boolean)
  };
}

module.exports = { buildConsultaH7XML, interpretarConsultaH7, ESTADOS_H7, ENDPOINT_CONSULTA_H7, NS_CONSULTA };
