/**
 * Unidades suplementarias de la partida del H1 (D.E. 18 02 000 000,
 * GoodsMeasure/supplementaryUnits).
 *
 * La AEAT las exige cuando el codigo lo pide para el origen (error 50928 en
 * PRE el 17/11/2026 con 8471300000, portatiles: «debe declarar cantidad de
 * unidades suplementarias segun lo exige el codigo de mercancia»; con 480
 * unidades se admitio, MRN 26ES002801I01BTGR0). El catalogo TARIC de LUCI
 * guarda la exigencia en `supplementaryUnit { required, type, description }`.
 *
 * Si el codigo pide «numero de articulos» (p/st) y la cantidad de la partida
 * esta en piezas o unidades, se usa esa cantidad. Si no se puede deducir, se
 * pide en «Faltan datos para presentar el H1».
 */
const mongoose = require('mongoose');
const TaricCode = require('../../models/TaricCode');

const CONECTADA = 1;
const logger = require('../../config/logger');

const PIEZAS = 'p/st';
const UNIDADES_DE_PIEZAS = new Set(['PCS', 'PCE', 'PC', 'UN', 'UND', 'UNIT', 'UNITS', 'U', 'NAR', 'C62', 'PIEZA', 'PIEZAS', 'UNIDAD', 'UNIDADES']);

const codigoDe = (good) => String(good?.taricCode || '').replace(/\D/g, '');

/**
 * Exigencia de unidades suplementarias de cada codigo de las partidas.
 * @param {Array<object>} goods
 * @returns {Promise<Object<string, { tipo: string, descripcion: string }>>} solo los codigos que las exigen
 */
async function exigenciasDeUnidades(goods = []) {
  const codigos = [...new Set(goods.map(codigoDe).filter((c) => c.length === 10))];
  // Sin conexion a la base de datos (p. ej. al preparar el H1 en pruebas) no se
  // espera a que llegue: sin catalogo, la AEAT dira si faltan.
  if (codigos.length === 0 || mongoose.connection.readyState !== CONECTADA) return {};
  try {
    const filas = await TaricCode.find({ code: { $in: codigos }, 'supplementaryUnit.required': true })
      .select('code supplementaryUnit').lean();
    return Object.fromEntries(filas.map((f) => [f.code, {
      tipo: f.supplementaryUnit?.type || '',
      descripcion: f.supplementaryUnit?.description || ''
    }]));
  } catch (error) {
    // Sin catalogo no se bloquea: la AEAT lo dira si faltan.
    logger.warn(`[H1] No se pudo consultar la exigencia de unidades suplementarias: ${error.message}`);
    return {};
  }
}

/**
 * Unidades suplementarias a declarar en la partida (o null).
 * @param {object} good
 * @param {{ tipo: string, descripcion: string }|undefined} exigencia
 * @param {number} n - numero de partida
 * @param {string[]} faltan
 * @returns {number|null}
 */
function unidadesDeLaPartida(good, exigencia, n, faltan) {
  const escritas = Number(good?.supplementaryUnits);
  if (escritas > 0) return escritas;
  if (!exigencia) return null;
  const cantidad = Number(good?.quantity);
  const enPiezas = UNIDADES_DE_PIEZAS.has(String(good?.unit || '').trim().toUpperCase());
  if (exigencia.tipo === PIEZAS && enPiezas && cantidad > 0) return cantidad;
  const que = exigencia.descripcion || exigencia.tipo || 'las que indica el TARIC';
  faltan.push(`unidades suplementarias de la partida ${n} (${codigoDe(good)} las exige: ${que})`);
  return null;
}

module.exports = { exigenciasDeUnidades, unidadesDeLaPartida };
