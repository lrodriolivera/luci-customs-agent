/**
 * Formas del derecho de terceros paises que `interpretarDerecho`
 * (arancelesOficiales.js) no resuelve, a partir del texto literal de la celda
 * «Duty» del fichero oficial «Duties Import 01-99.xlsx». Funciones puras.
 *
 * Medido el 13/Nov/2026 sobre los 552 codigos del catalogo marcados como «no
 * calculables»: una parte son sumas de porcentajes e importes con minimo o
 * maximo que LUCI puede liquidar con los datos de la partida (valor, peso neto,
 * peso bruto, cantidad). El resto exige un dato que LUCI no tiene (composicion
 * para el elemento agricola, grado alcoholico, contenido de azucar, precio de
 * entrada…): para esos se dice cual falta y no se calcula.
 *
 * Calificadores de unidad del TARIC que aparecen (tras «EUR DTN», «EUR KGM»…):
 *   G peso bruto · E peso neto escurrido · M materia seca · P materia lactea ·
 *   T materia seca lactea · Z por 1 % de sacarosa · R calidad tipo del azucar ·
 *   A alcohol total · ASV X por % vol y hl
 */
const { UNIDAD_POR_CODIGO_TARIC } = require('./unidadesDerecho');

// Mismo patron de numero que arancelesOficiales.js: «1,024.000» o «8.800».
const RE_PORCENTAJE = /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) %$/;
const RE_IMPORTE = /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) EUR ([A-Z]{3}(?: [A-Z])?)$/;
const numero = (texto) => Number(String(texto).replace(/,/g, ''));
const limpiar = (texto) => String(texto || '').trim().replace(/\s+/g, ' ');

/** Un sumando: «6.200 %» o «27.100 EUR DTN» (unidad que LUCI sabe liquidar). */
function termino(texto) {
  let m = RE_PORCENTAJE.exec(texto);
  if (m) return { adValorem: numero(m[1]) };
  m = RE_IMPORTE.exec(texto);
  const unit = m && UNIDAD_POR_CODIGO_TARIC[m[2]];
  return unit ? { amount: numero(m[1]), unit } : null;
}

/** «a + b + c» -> [a, b, c], o null si algun sumando no se entiende. */
function suma(texto) {
  const partes = texto.split(' + ').map((p) => termino(p.trim()));
  return partes.every(Boolean) ? partes : null;
}

/**
 * Derecho como suma de sumandos, con minimo y maximo opcionales (cada uno,
 * tambien una suma):
 *
 *   «6.200 % + 27.100 EUR DTN MAX 17.900 %»
 *   «9.100 % + 45.100 EUR DTN MAX 18.900 % + 16.500 EUR DTN»
 *   «0.500 EUR NAR MIN 2.700 % MAX 4.600 %»
 *   «40.000 % + 121.000 EUR HLT + 20.600 EUR DTN»
 *   «12.000 % MIN 2.000 EUR DTN G»
 *
 * @param {string} texto
 * @returns {{ texto: string, sumandos: object[], minimo: object[], maximo: object[] } | null}
 */
function interpretarFormula(texto) {
  const limpio = limpiar(texto);
  if (!limpio || limpio.startsWith('Cond:')) return null;
  const m = /^(.+?)(?: MIN (.+?))?(?: MAX (.+))?$/.exec(limpio);
  if (!m) return null;
  const sumandos = suma(m[1]);
  const minimo = m[2] ? suma(m[2]) : [];
  const maximo = m[3] ? suma(m[3]) : [];
  if (!sumandos || !minimo || !maximo) return null;
  return { texto: limpio, sumandos, minimo, maximo };
}

/**
 * Formas que exigen un dato que LUCI no tiene, en orden de prioridad (un texto
 * con precio de entrada y elemento agricola es, ante todo, de precio de entrada).
 */
const FORMAS_NO_CALCULABLES = [
  { forma: 'precio_entrada', re: /^Cond: V /, falta: 'el precio de entrada de la partida (valor por 100 kg o por hl), que decide el tramo del derecho' },
  { forma: 'elemento_agricola', re: /\b(EA|ADSZ|ADFM|ADSZR|ADFMR)\b/, falta: 'el elemento agricola y los derechos adicionales sobre el azucar o la harina, que dependen de la composicion (materia grasa y proteinas de la leche, almidon o glucosa, sacarosa): codigo adicional 7xxx de la tabla Meursing' },
  { forma: 'materia_lactea', re: /EUR KGM [PT]\b/, falta: 'el contenido en materia lactea (o materia seca lactea) de la mercancia, en kg' },
  { forma: 'grado_alcoholico', re: /EUR ASV X\b/, falta: 'el grado alcoholico (% vol) y el volumen en hl' },
  { forma: 'peso_escurrido', re: /EUR DTN E\b/, falta: 'el peso neto escurrido' },
  { forma: 'contenido_azucar', re: /EUR DTN Z\b/, falta: 'el contenido en sacarosa (% en peso, incluidos otros azucares expresados en sacarosa)' },
  { forma: 'materia_seca', re: /EUR DTN M\b/, falta: 'el peso neto de materia seca' },
  { forma: 'calidad_tipo_azucar', re: /EUR DTN R\b/, falta: 'el rendimiento del azucar respecto a la calidad tipo' },
  { forma: 'alcohol_total', re: /EUR KGM A\b/, falta: 'el contenido en alcohol total, en kg' },
  { forma: 'unidad_no_soportada', re: /EUR (HMT|MTK|[A-Z]{3} [A-Z])\b/, falta: 'la cantidad en la unidad del derecho (hectometros, metros cuadrados…)' },
  { forma: 'condicionado_certificado', re: /^Cond: /, falta: 'el certificado o la autorizacion de la que depende el derecho (por ejemplo, destino final N990)' }
];

/**
 * Forma de un derecho y, si no se puede liquidar, el dato que falta.
 *
 * @param {string} texto celda «Duty» oficial
 * @returns {{ forma: string, calculable: boolean, faltan: string[] }}
 */
function clasificarDerecho(texto) {
  const limpio = limpiar(texto);
  if (interpretarFormula(limpio)) return { forma: 'compuesto', calculable: true, faltan: [] };
  const regla = FORMAS_NO_CALCULABLES.find((r) => r.re.test(limpio));
  if (regla) return { forma: regla.forma, calculable: false, faltan: [regla.falta] };
  return { forma: 'otro', calculable: false, faltan: ['interpretar el texto oficial, que LUCI no reconoce'] };
}

const sumaDePorcentajes = (texto) => texto.split(/\s*\+\s*/).map((p) => RE_PORCENTAJE.exec(p.trim()))
  .filter(Boolean).reduce((total, m) => total + numero(m[1]), 0);

/**
 * Parte exacta de un derecho que LUCI no sabe liquidar entero: la suma de sus
 * porcentajes, que se liquidan con el valor en aduana sin ningun otro dato
 * («7,6 %» de «7.600 % + EA»). El derecho real es mayor o igual (los demas
 * sumandos solo suman), asi que es un minimo. Decision de Luis del 13/Nov/2026:
 * solo cuentan los porcentajes.
 *
 * Si hay maximo, cuenta solo su parte en porcentaje: con un maximo del que no
 * se sabe nada («MAX 5.000 EUR HMT») el minimo seguro es 0 (`maximo: 0`). El
 * minimo («MIN …») se ignora: quitarlo solo puede bajar el importe.
 *
 * Los derechos condicionados («Cond: …», precio de entrada o certificado) no
 * tienen parte exacta: el porcentaje depende de la condicion.
 *
 * @param {string} texto celda «Duty» oficial
 * @returns {{ adValorem: number, maximo: number|null } | null} null si no hay ningun porcentaje
 */
function parteExacta(texto) {
  const limpio = limpiar(texto);
  if (!limpio || limpio.startsWith('Cond:')) return null;
  const m = /^(.+?)(?: MIN (.+?))?(?: MAX (.+))?$/.exec(limpio);
  const adValorem = Math.round(sumaDePorcentajes(m[1]) * 1000) / 1000;
  if (!(adValorem > 0)) return null;
  const maximo = m[3] ? Math.round(sumaDePorcentajes(m[3]) * 1000) / 1000 : null;
  return { adValorem, maximo };
}

module.exports = { interpretarFormula, clasificarDerecho, parteExacta, FORMAS_NO_CALCULABLES };
