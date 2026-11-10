/**
 * Codigo de la unidad suplementaria en la casilla 41 del DUA.
 *
 * El TARIC identifica las unidades con codigos de tres letras (NAR = numero de
 * articulos, NPR = pares, MTK = metros cuadrados...). El DUA español usa otra
 * tabla, de dos caracteres: Anexo IX de la Resolucion del DUA de 11/07/2014
 * (BOE-A-2014-7683, «Codigos de unidades suplementarias o fiscales»). La AEAT
 * rechaza el codigo TARIC tal cual: error 2019, «Codigo de unidades
 * suplementarias distinto al exigido por medida TARIC» (visto en PRE el
 * 10/Nov/2026 con 8471 30 00 00 y NAR).
 */

// Codigo TARIC (o forma habitual de escribirlo) -> codigo del Anexo IX.
const DUA_POR_UNIDAD_TARIC = {
  NAR: 'UN', 'P/ST': 'UN', PCS: 'UN', UNIDADES: 'UN',   // unidades
  NPR: 'PA', PARES: 'PA',                               // numero de pares
  CEN: 'CE',                                            // centenas
  MIL: 'MI',                                            // millares
  NCL: 'CL',                                            // numero de celdas
  MTR: 'M1', M: 'M1',                                   // metros lineales
  MTK: 'M2',                                            // metros cuadrados
  MTQ: 'M3',                                            // metros cubicos
  HMT: 'HM',                                            // hectometros
  LTR: 'LT', L: 'LT',                                   // litros
  HLT: 'HL',                                            // hectolitros
  KLT: 'KL',                                            // miles de litros
  LPA: 'LA',                                            // litros de alcohol puro
  GRM: 'GN',                                            // gramos netos
  KGM: 'KN',                                            // kilogramos netos
  TNE: 'TN',                                            // toneladas netas
  CTM: 'WL',                                            // quilates
  GFI: 'GI',                                            // gramos de isotopos fisionables
  TJO: 'TJ',                                            // terajulios
  MWH: 'MK',                                            // miles de kilovatios hora
  GRT: 'BR',                                            // arqueo bruto
  CCT: 'CT',                                            // capacidad de carga util en toneladas
  KPO: 'W1',                                            // kg de K2O
  KPH: 'W2',                                            // kg de KOH
  KNI: 'W3',                                            // kg de N
  KNS: 'W4',                                            // kg de NaOH
  KPP: 'W5',                                            // kg de P2O5
  KUR: 'W6',                                            // kg de U
  KSD: 'W7',                                            // kg de materia seca al 90 %
  KSH: 'W8',                                            // kg de H2O2
  KMA: 'W9'                                             // kg de metilamina
};

const FORMATO_CODIGO_DUA = /^[A-Z0-9]{2}$/;

/**
 * Traduce el codigo de unidad al de la casilla 41. Un codigo que ya tiene el
 * formato del DUA se respeta. Uno desconocido se devuelve tal cual: la AEAT lo
 * rechazara nombrandolo, que es preferible a enviar una unidad equivocada.
 *
 * @param {string|null|undefined} codigo
 * @returns {string|null} null si no hay codigo
 */
function codigoUnidadDua(codigo) {
  const limpio = String(codigo ?? '').trim().toUpperCase();
  if (!limpio) return null;
  if (DUA_POR_UNIDAD_TARIC[limpio]) return DUA_POR_UNIDAD_TARIC[limpio];
  if (FORMATO_CODIGO_DUA.test(limpio)) return limpio;
  return limpio;
}

module.exports = { codigoUnidadDua, DUA_POR_UNIDAD_TARIC };
