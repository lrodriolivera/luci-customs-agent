/**
 * Significado de los codigos que devuelve la AEAT sobre una declaracion de
 * importacion CAU. Textos de las guias oficiales:
 *  - `operationRegistered`: «Informacion complementaria H1» v3.26, Separata 30.
 *  - `goodsReleaseStatus`, `paymentStatus`, `pendingInformation`, `underControl`
 *    y `documentationPending`: «Guia de Servicio Web de Consulta de Importacion
 *    adaptado al CAU» v4.1.
 * Un codigo que no este aqui se muestra tal cual.
 */
const OPERACION_REGISTRADA = {
  0: 'Admisión de declaración completa',
  1: 'Declaración completa recibida, pendiente de validar',
  2: 'Predeclaración registrada',
  3: 'Predeclaración recibida, pendiente de validar',
  40: 'Declaración anulada, de oficio o a solicitud del operador',
  41: 'La declaración no obtiene el levante',
  42: 'Intención de control',
  43: 'La declaración se encuentra anulada',
  60: 'Predeclaración incompleta',
  61: 'Declaración simplificada pendiente de activar',
  62: 'Declaración simplificada activada',
  63: 'Declaración completa pendiente de activar',
  64: 'Declaración completa activada',
  65: 'Modificación de predeclaración simplificada pendiente de activar',
  66: 'Modificación de predeclaración completa pendiente de activar',
  90: 'Predeclaración completa activada',
  91: 'Predeclaración simplificada activada',
  96: 'Declaración levantada'
};

const ESTADO_DESPACHO = {
  P: 'Pendiente de despacho',
  D: 'Despachado sin levante',
  L: 'Despachado con levante',
  A: 'Anulado'
};

const ESTADO_CONTABLE = {
  PL: 'Pendiente de contracción',
  CO: 'Contraído',
  NC: 'No contraído por importe cero',
  PC: 'Contracción diferida',
  IT: 'Ingresado totalmente',
  IP: 'Ingreso parcial',
  AN: 'Importación anulada',
  SC: 'Sin contabilidad',
  SI: 'Sin ingreso',
  BT: 'Baja de contracción total'
};

const PENDENCIAS = {
  L: 'Tiene pendencias de levante',
  A: 'Tiene pendencias de actuario',
  V: 'Tiene pendencias de levante y de actuario',
  N: 'No tiene pendencias'
};

// Para «en control» y «documentacion pendiente»: que aduana lo tiene.
const ADUANA_RESPONSABLE = {
  1: 'Aduana de declaración',
  2: 'Aduana de presentación'
};

const describir = (tabla, codigo) => (codigo === null || codigo === undefined ? null : tabla[codigo] || null);

module.exports = { OPERACION_REGISTRADA, ESTADO_DESPACHO, ESTADO_CONTABLE, PENDENCIAS, ADUANA_RESPONSABLE, describir };
