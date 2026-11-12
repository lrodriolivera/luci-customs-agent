/**
 * Respuesta del servicio CC415AV1 (H1 CAU): `CC415AV1Sal`.
 *
 * Trae una de tres cosas: `CC415R` (declaracion registrada, con el MRN, el
 * circuito y la liquidacion de la AEAT), `CC456A` (error funcional) o `CD917A`
 * (XML mal formado). Se lee con un analizador XML, no con expresiones
 * regulares: un rechazo tambien puede traer un MRN y no debe confundirse con
 * una admision.
 */
const { DOMParser } = require('@xmldom/xmldom');
const { OPERACION_REGISTRADA, describir } = require('./h1CauCodigos');

const CIRCUITOS = { V: 'green', A: 'yellow', N: 'orange', R: 'red' };

const hijos = (nodo, nombre) => {
  const lista = [];
  for (let n = nodo?.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!nombre || n.localName === nombre)) lista.push(n);
  }
  return lista;
};
const hijo = (nodo, ...ruta) => ruta.reduce((actual, nombre) => (actual ? hijos(actual, nombre)[0] : undefined), nodo);
const texto = (nodo, ...ruta) => {
  const hallado = ruta.length ? hijo(nodo, ...ruta) : nodo;
  const valor = hallado?.textContent?.trim();
  return valor || null;
};
const numero = (nodo, ...ruta) => {
  const valor = texto(nodo, ...ruta);
  return valor === null || Number.isNaN(Number(valor)) ? null : Number(valor);
};
/** Primer elemento con ese nombre local en cualquier nivel. */
function buscar(nodo, nombre) {
  for (const n of hijos(nodo)) {
    if (n.localName === nombre) return n;
    const dentro = buscar(n, nombre);
    if (dentro) return dentro;
  }
  return null;
}

const tributos = (calculo) => hijos(calculo, 'DutiesAndTaxes').map((t) => ({
  tipo: texto(t, 'taxType'),
  medioDePago: texto(t, 'methodOfPayment'),
  bases: hijos(t, 'TaxBase').map((b) => ({
    tipoImpositivo: numero(b, 'taxRate'),
    unidad: texto(b, 'measurementUnitAndQualifier'),
    cantidad: numero(b, 'quantity'),
    importe: numero(b, 'amount'),
    cuota: numero(b, 'payableTaxAmount'),
    aGarantizar: numero(b, 'amountToGuarantee')
  }))
}));

/**
 * Liquidacion de la AEAT: totales y, por partida, cada tributo con sus bases.
 * La misma estructura llega al presentar (CC428R) y en la consulta
 * (DutiesTaxesAndGuarantee).
 */
function liquidacionDe(totales, contenedorDePartidas) {
  return {
    totalAPagar: numero(totales, 'payableTaxAmount'),
    totalAGarantizar: numero(totales, 'amountToGuarantee'),
    partidas: hijos(contenedorDePartidas, 'GoodsItem').map((g) => ({
      numero: numero(g, 'declarationGoodsItemNumber'),
      preferencia: texto(g, 'CalculationOfTaxes', 'preference'),
      tributos: tributos(hijo(g, 'CalculationOfTaxes'))
    }))
  };
}

/**
 * Certificados de otros organismos que exige cada partida.
 * `requeridos`: S = exige, N = no, Z = pendiente de determinar.
 */
function certificadosDe(requeridos, contenedorDePartidas) {
  return {
    requeridos,
    partidas: hijos(contenedorDePartidas, 'GoodsItem').map((g) => ({
      numero: numero(g, 'declarationGoodsItemNumber'),
      organismos: hijos(g, 'PCA').map((p) => ({
        organismo: texto(p, 'code'),
        nombre: texto(p, 'name'),
        medidas: hijos(p, 'TaricMeasure').map((m) => ({
          medida: texto(m, 'taricMeasureCode'),
          documentos: hijos(m, 'DocumentRequired').map((d) => texto(d, 'type')).filter(Boolean)
        }))
      }))
    })).filter((p) => p.organismos.length > 0)
  };
}

function admitida(cc415r, base) {
  const ack = hijo(cc415r, 'ACK');
  const cc428 = hijo(cc415r, 'CC428R');
  const cc429 = hijo(cc415r, 'CC429R');
  const codigoCircuito = texto(cc428, 'riskAnalysisResultCodeAEAT');
  const totales = hijo(cc428, 'DutiesAndTaxesAEAT');
  return {
    ...base,
    success: true,
    tipo: 'admitida',
    lrn: texto(ack, 'ImportOperation', 'LRN'),
    mrn: texto(ack, 'ImportOperation', 'MRN'),
    // Una predeclaracion aun no tiene MRN: tiene numero de registro.
    numeroRegistro: texto(ack, 'ImportOperation', 'customsRegistrationNumber'),
    csv: texto(ack, 'edeclarationCSVId'),
    operacionRegistrada: texto(ack, 'operationRegistered'),
    operacionRegistradaTexto: describir(OPERACION_REGISTRADA, texto(ack, 'operationRegistered')),
    fechaAdmision: texto(cc428, 'declarationAcceptanceDateAndTime'),
    // Sin analisis de riesgos (predeclaracion) no hay circuito: no se supone verde.
    circuito: codigoCircuito,
    channel: CIRCUITOS[codigoCircuito] || null,
    liquidacion: cc428 ? liquidacionDe(totales, cc428) : null,
    certificados: certificadosDe(texto(ack, 'requiredPCADocuments'), ack),
    levante: cc429 && hijos(cc429).length > 0 ? {
      fecha: texto(cc429, 'releaseDateAndTime'),
      csv: texto(cc429, 'releaseCSVId')
    } : null
  };
}

function errorFuncional(cc456a, base) {
  const errores = hijos(cc456a, 'FunctionalError').map((e) => ({
    codigo: texto(e, 'errorCode'),
    motivo: texto(e, 'errorReason'),
    puntero: texto(e, 'errorPointer'),
    valor: texto(e, 'originalAttributeValue'),
    observaciones: texto(e, 'remarks')
  }));
  const rechazo = { codigo: texto(cc456a, 'ImportOperation', 'rejectionCode'), motivo: texto(cc456a, 'ImportOperation', 'rejectionReason') };
  const frases = errores.map((e) => [e.motivo, e.observaciones, e.puntero && `(${e.puntero})`].filter(Boolean).join(' '));
  return {
    ...base,
    success: false,
    tipo: 'error_funcional',
    lrn: texto(cc456a, 'ImportOperation', 'LRN'),
    errores,
    rechazo: rechazo.codigo || rechazo.motivo ? rechazo : null,
    error: frases.filter(Boolean).join(' | ') || rechazo.motivo || 'La AEAT rechazó la declaración sin indicar el motivo'
  };
}

function errorDeXml(cd917a, base) {
  const errores = hijos(cd917a, 'XmlError').map((e) => ({
    codigo: texto(e, 'errorCode'),
    motivo: texto(e, 'errorText'),
    puntero: texto(e, 'errorPointer'),
    linea: numero(e, 'errorLineNumber'),
    columna: numero(e, 'errorColumnNumber')
  }));
  return {
    ...base,
    success: false,
    tipo: 'error_xml',
    errores,
    error: errores.map((e) => [e.motivo, e.puntero && `(${e.puntero})`].filter(Boolean).join(' ')).join(' | ') || 'La AEAT no pudo leer el mensaje'
  };
}

/**
 * @param {string} xml  cuerpo de la respuesta HTTP
 * @returns {object} `{ success, tipo, mrn, channel, liquidacion, certificados, errores, error, rawResponse }`
 */
function interpretarRespuestaH1Cau(xml) {
  const cuerpo = typeof xml === 'string' ? xml : '';
  const base = {
    success: false, tipo: 'desconocida', mrn: null, lrn: null, csv: null, channel: null, circuito: null,
    liquidacion: null, certificados: null, errores: [], error: null, rawResponse: cuerpo
  };
  if (!cuerpo.trim()) return { ...base, error: 'La AEAT respondió sin contenido' };

  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(cuerpo, 'text/xml');
  const raiz = documento?.documentElement;
  if (!raiz || fallos.length > 0) return { ...base, error: 'La respuesta de la AEAT no es un XML válido' };

  const fault = buscar(documento, 'Fault');
  if (fault) {
    const codigo = texto(fault, 'faultcode');
    return {
      ...base,
      tipo: 'fault',
      // Un fallo del servidor se puede reenviar tal cual; uno del cliente, no.
      reintentable: /Server/i.test(codigo || ''),
      error: texto(fault, 'faultstring') || 'La AEAT devolvió un fallo sin descripción'
    };
  }

  const salida = buscar(documento, 'CC415AV1Sal');
  if (!salida) return { ...base, error: 'La respuesta no es del servicio CC415AV1' };
  const conMensaje = { ...base, mensajeId: texto(salida, 'Message', 'messageIdentification') };

  const cc415r = hijo(salida, 'CC415R');
  if (cc415r) return admitida(cc415r, conMensaje);
  const cc456a = hijo(salida, 'CC456A');
  if (cc456a) return errorFuncional(cc456a, conMensaje);
  const cd917a = hijo(salida, 'CD917A');
  if (cd917a) return errorDeXml(cd917a, conMensaje);
  return { ...conMensaje, error: 'La respuesta no trae ni admisión ni errores' };
}

module.exports = { interpretarRespuestaH1Cau, liquidacionDe, certificadosDe, CIRCUITOS };
