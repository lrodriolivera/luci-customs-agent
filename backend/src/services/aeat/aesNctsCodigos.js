/**
 * Significado de los estados y circuitos que devuelven las consultas de
 * exportacion (CCAESC, `estadoAES`) y de transito (CCTRAC, `estado`), y su
 * traduccion a los estados que entiende el monitor de seguimiento
 * (aeatStatusMonitorService): PENDING, ACCEPTED, CONTROL, RELEASED, REJECTED.
 *
 * Textos sacados de las guias oficiales (las listas completas de estados solo
 * estan en los diagramas, que son imagenes; aqui van los que la guia nombra en
 * el texto):
 *  - «Guia de Servicios Web de Exportacion (Nuevo Sistema AES)» v1.25, cap. 4,
 *    20 (CCAESC), 26 (estados) y 27 (ejemplos).
 *  - «Guia de Servicios Web de Transito (Nuevo Sistema NCTS6)» v1.21, cap. 4
 *    (estados) y descripcion de CC015C, CC007C, CC044C y CCTRAC.
 *
 * Criterio de la traduccion al monitor:
 *  - RELEASED: hay levante en la aduana de expedicion/partida (o la operacion
 *    ya esta mas adelante: salida, recepcion, ultimacion). El monitor deja de
 *    consultar una declaracion RELEASED.
 *  - CONTROL: la aduana la tiene bajo control (circuito naranja o rojo,
 *    pendiente de levante o de despacho).
 *  - REJECTED: la declaracion ya no vale (invalidada, no levante, salida
 *    parada, recepcion rechazada). El monitor tambien deja de consultarla.
 *  - PENDING: predeclaracion o a la espera de un tercero (garantia, otro pais).
 *  - `final`: la operacion ya no cambia (salida efectiva o parada, ultimado,
 *    invalidada, no levante). Solo entonces deja el monitor de consultarla:
 *    un DE/DS (levante) es RELEASED pero aun puede acabar en SA o en ST/NL.
 *  - Un codigo que no este en la tabla: ACCEPTED si la AEAT da fecha de
 *    admision, PENDING si no. Se conserva el codigo original en `estado`.
 *
 * Circuito (`circuitoAEAT` en AES, `circuitoExpedicion` en NCTS):
 *   V verde -> 'green', N naranja (control documental) -> 'orange',
 *   R rojo (control fisico) -> 'red'.
 */

const CIRCUITOS = { V: 'green', N: 'orange', R: 'red' };

const TEXTO_CIRCUITO = {
  V: 'Verde: levante automático',
  N: 'Naranja: control documental',
  R: 'Rojo: control físico'
};

const ESTADOS_AES = {
  PA: { texto: 'Predeclaración de exportación', monitor: 'PENDING' },
  AW: { texto: 'Esperando decisión de controlar desde la aduana de presentación extranjera', monitor: 'PENDING' },
  RQ: { texto: 'Solicitada al país de expedición', monitor: 'PENDING' },
  PL: { texto: 'Pendiente de levante (bajo control de la aduana)', monitor: 'CONTROL' },
  DE: { texto: 'Despachada: levante en la aduana de exportación', monitor: 'RELEASED' },
  DS: { texto: 'Despachada directa: levante en la aduana de exportación', monitor: 'RELEASED' },
  RE: { texto: 'Recibida y pendiente de levante en la aduana de salida', monitor: 'RELEASED' },
  PS: { texto: 'Con levante en la aduana de salida, pendiente de salida', monitor: 'RELEASED' },
  ET: { texto: 'Esperando tránsito', monitor: 'RELEASED' },
  GT: { texto: 'Gestionada por tránsito', monitor: 'RELEASED' },
  SA: { texto: 'Salida efectiva: exportación realizada', monitor: 'RELEASED', final: true },
  ST: { texto: 'Salida parada (stopped): exportación no realizada', monitor: 'REJECTED', final: true },
  NL: { texto: 'No levante: invalidada por despacho disconforme', monitor: 'REJECTED', final: true },
  IV: { texto: 'Invalidada', monitor: 'REJECTED', final: true },
  RZ: { texto: 'Recepción rechazada en España', monitor: 'REJECTED', final: true }
};

const ESTADOS_NCTS = {
  PA: { texto: 'Predeclaración de tránsito', monitor: 'PENDING' },
  PG: { texto: 'Pendiente de garantía extranjera', monitor: 'PENDING' },
  RQ: { texto: 'Solicitados los datos del tránsito al país de partida', monitor: 'PENDING' },
  PD: { texto: 'Pendiente de despacho (bajo control de la aduana de partida)', monitor: 'CONTROL' },
  DE: { texto: 'Despachado: levante en la aduana de partida', monitor: 'RELEASED' },
  SP: { texto: 'Admitido el paso', monitor: 'RELEASED' },
  ED: { texto: 'Esperando asignación de destino en Gibraltar', monitor: 'RELEASED' },
  RE: { texto: 'Recibido en la aduana de destino', monitor: 'RELEASED' },
  RD: { texto: 'Pendiente de resolver discrepancias de la descarga', monitor: 'RELEASED' },
  UL: { texto: 'Ultimado', monitor: 'RELEASED', final: true },
  NL: { texto: 'No levante: invalidado por despacho disconforme', monitor: 'REJECTED', final: true },
  IV: { texto: 'Invalidado', monitor: 'REJECTED', final: true },
  CA: { texto: 'Predeclaración invalidada a petición del operador', monitor: 'REJECTED', final: true },
  PI: { texto: 'Predeclaración invalidada', monitor: 'REJECTED', final: true },
  RZ: { texto: 'Recepción rechazada', monitor: 'REJECTED', final: true }
};

/**
 * Estado del monitor para un codigo de la AEAT.
 * @param {object} tabla      ESTADOS_AES o ESTADOS_NCTS
 * @param {string|null} codigo
 * @param {boolean} admitida  la AEAT informa fecha de admision
 */
function estadoMonitor(tabla, codigo, admitida) {
  if (codigo && tabla[codigo]) return tabla[codigo].monitor;
  return admitida ? 'ACCEPTED' : 'PENDING';
}

/** La AEAT ya no cambiara la operacion (ver `final` en las tablas). */
function esFinal(tabla, codigo) {
  return Boolean(codigo && tabla[codigo]?.final);
}

module.exports = { CIRCUITOS, TEXTO_CIRCUITO, ESTADOS_AES, ESTADOS_NCTS, estadoMonitor, esFinal };
