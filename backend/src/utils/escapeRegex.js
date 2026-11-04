/**
 * Escapa un termino de busqueda para usarlo literal dentro de un $regex.
 *
 * Los listados pasaban req.query.search (y parametros de ruta) tal cual a
 * MongoDB como $regex: '.*' devolvia todo, y patrones como '(a+)+$' bloqueaban
 * el servidor de base de datos (ReDoS). Con el termino escapado la busqueda
 * sigue siendo parcial y case-insensitive ('MSKU' encuentra 'MSKU1234567'),
 * pero los metacaracteres se buscan literalmente.
 *
 * El valor se convierte a string: un objeto ({ "$ne": null } desde un body
 * JSON) deja de poder colarse como operador.
 *
 * @param {*} valor
 * @returns {string}
 */
function escapeRegex(valor) {
  return String(valor ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
