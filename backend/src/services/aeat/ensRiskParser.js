/**
 * Parser de los mensajes de RIESGO que AEAT emite sobre una ENS ya registrada.
 *
 * Contexto (importante para no repetir el bug de da7241d): el CC328A que llega al
 * presentar la ENS acusa unicamente el REGISTRO. El resultado del analisis de
 * riesgo — el circuito ACK / HOLD / DNL — viaja despues, en un mensaje aparte y
 * asincrono. Antes no habia nada que tradujese esos mensajes, `processRiskResponse`
 * no tenia llamante y un bloque [DEMO] se inventaba un ACK.
 *
 * Se comprobo contra PRE que el circuito NO se puede consultar por MRN: la
 * ConsultaImportacionV2 responde CodigoRespuesta 9 / CodigoError 6020 "No existe
 * importación con la referencia solicitada" ante un MRN de ENS, porque es el canal
 * de declaraciones de importacion H1. De ahi que la via sea la ingesta del mensaje.
 *
 * Mensajes que traduce:
 *   CC351A  Do Not Load: prohibicion de cargar. Siempre DNL.
 *   CC324A  Decision de control (documental / escaner / fisico). HOLD salvo que
 *           el propio mensaje diga otra cosa.
 *   CC328A  Solo si trae RisAnaResHEA1. El acuse pelado se RECHAZA a proposito.
 *
 * Devuelve siempre un objeto; nunca lanza. `recognised: false` + `reason` cuando
 * no hay un analisis de riesgo aplicable, para que quien llame no escriba nada.
 */

// Estados admitidos por ENSDeclaration.riskAssessment.status. Un valor fuera de
// esta lista se rechaza en lugar de guardarse: Mongoose lo tiraria en silencio y
// nos quedariamos sin saber que AEAT dijo algo que no entendemos.
const ESTADOS_VALIDOS = ['PENDING', 'DNL', 'HOLD', 'ACK', 'CLEARED'];

// Tipos de mensaje que pueden portar un analisis de riesgo.
const TIPOS = ['CC351A', 'CC324A', 'CC328A'];

/**
 * Extrae el texto de una etiqueta admitiendo prefijo de namespace y atributos.
 * El `[^>]*` no es decorativo: AEAT repite la declaracion de namespace en cada
 * hijo del body, asi que exigir la etiqueta desnuda no casa nunca en produccion.
 */
function _valor(xml, tag) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return m ? m[1].trim() : undefined;
}

function _bloques(xml, tag) {
  return [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'g'))]
    .map(m => m[1]);
}

/** AAAAMMDD -> Date. Devuelve undefined si no es una fecha legible. */
function _fecha(aaaammdd) {
  if (!/^\d{8}$/.test(aaaammdd || '')) return undefined;
  const d = new Date(`${aaaammdd.substring(0, 4)}-${aaaammdd.substring(4, 6)}-${aaaammdd.substring(6, 8)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function _rechazo(reason, extra = {}) {
  return { recognised: false, reason, ...extra };
}

/**
 * @param {string} xml - Mensaje de AEAT, con o sin sobre SOAP.
 * @returns {{recognised: boolean, messageType?: string, mrn?: string, risk?: object, reason?: string}}
 */
function parseENSRiskMessage(xml) {
  if (typeof xml !== 'string' || !xml.trim()) {
    return _rechazo('Mensaje vacio o no textual');
  }

  const messageType = TIPOS.find(t => new RegExp(`<(?:\\w+:)?${t}[^>]*>`).test(xml));
  if (!messageType) {
    return _rechazo('El mensaje no es de un tipo que porte analisis de riesgo de ENS');
  }

  const estadoDeclarado = _valor(xml, 'RisAnaResHEA1');

  // Un CC328A sin resultado de analisis es SOLO el acuse de registro. Traducirlo
  // a ACK es precisamente el bug que se corrigio en da7241d, asi que se rechaza.
  if (messageType === 'CC328A' && !estadoDeclarado) {
    return _rechazo('El CC328A es un acuse de registro, no un analisis de riesgo', { messageType });
  }

  const mrn = _valor(xml, 'DocNumHEA5');
  if (!mrn) {
    return _rechazo('Mensaje de riesgo sin MRN: no hay declaracion a la que aplicarlo', { messageType });
  }

  // Un CC351A es una prohibicion de carga por definicion, diga lo que diga el
  // campo de estado: no puede degradarse a ACK por venir incompleto.
  const status = messageType === 'CC351A' ? 'DNL' : (estadoDeclarado || 'HOLD');

  if (!ESTADOS_VALIDOS.includes(status)) {
    return _rechazo(`Estado de riesgo no reconocido: ${status}`, { messageType, mrn });
  }

  const controlDecisions = _bloques(xml, 'CONDEC').map(b => {
    const decision = {
      code: _valor(b, 'ConCodCONDEC1'),
      description: _valor(b, 'ConDesCONDEC2')
    };
    const deadline = _fecha(_valor(b, 'ConLimDatCONDEC3'));
    if (deadline) decision.deadline = deadline;
    return decision;
  });

  const risk = {
    status,
    dnl: status === 'DNL',
    dnlReason: _valor(xml, 'RisAnaMotHEA2'),
    responseCode: messageType
  };

  const riskScore = Number(_valor(xml, 'RisAnaPunHEA3'));
  if (Number.isFinite(riskScore)) risk.riskScore = riskScore;
  if (controlDecisions.length) risk.controlDecisions = controlDecisions;

  return { recognised: true, messageType, mrn, risk };
}

module.exports = { parseENSRiskMessage, ESTADOS_VALIDOS };
