/**
 * Liquidacion que devuelve la AEAT en la respuesta del alta del H7 (AltaH7V1Sal).
 * En la entrada no se declaran tributos: la AEAT los calcula y los devuelve en
 * <CalculationOfTaxes><Tax> (cabecera) y en <GoodsItem><Tax> (partida).
 * Desde la tasa de la Union UHF llegan A00 (derecho fijo), F00 (tasa UHF, 2 EUR)
 * y B00 (IVA); se recoge cualquier taxType sin lista cerrada.
 *
 * Funcion pura sobre el texto XML.
 */

const { escapeRegex } = require('../../utils/escapeRegex');

const redondear = (n) => Math.round(n * 100) / 100;

function _numero(texto) {
  if (texto == null) return null;
  const n = Number(String(texto).trim());
  return Number.isFinite(n) ? n : null;
}

const _valor = (bloque, etiqueta) =>
  (bloque.match(new RegExp(`<${escapeRegex(etiqueta)}>([^<]*)</${escapeRegex(etiqueta)}>`)) || [])[1];
const _importe = (bloque, grupo) =>
  (bloque.match(new RegExp(`<${escapeRegex(grupo)}>\\s*<amount>([^<]*)</amount>`)) || [])[1];

function _deCabecera(body) {
  const calc = (body.match(/<CalculationOfTaxes>([\s\S]*?)<\/CalculationOfTaxes>/) || [])[1];
  if (!calc) return null;
  const tributos = [...calc.matchAll(/<Tax>([\s\S]*?)<\/Tax>/g)].map(([, t]) => ({
    tipo: (_valor(t, 'taxType') || '').trim(),
    importe: _numero(_valor(t, 'payableTaxAmount')) || 0,
    base: _numero(_valor(t, 'taxBase'))
  }));
  return { moneda: (_valor(calc, 'currencyCode') || 'EUR').trim(), tributos };
}

function _dePartidas(body) {
  const porTipo = new Map();
  for (const [, partida] of body.matchAll(/<GoodsItem>([\s\S]*?)<\/GoodsItem>/g)) {
    for (const [, t] of partida.matchAll(/<Tax>([\s\S]*?)<\/Tax>/g)) {
      const tipo = (_valor(t, 'taxType') || '').trim();
      const previo = porTipo.get(tipo) || { tipo, importe: 0, base: null };
      const base = _numero(_importe(t, 'ItemTaxBase'));
      porTipo.set(tipo, {
        tipo,
        importe: redondear(previo.importe + (_numero(_importe(t, 'ItemPayableTaxAmount')) || 0)),
        base: base == null ? previo.base : redondear((previo.base || 0) + base)
      });
    }
  }
  return { moneda: 'EUR', tributos: [...porTipo.values()] };
}

/**
 * @param {string} body respuesta SOAP AltaH7V1Sal
 * @returns {{moneda:string, tributos:Array<{tipo:string, importe:number, base:number|null}>, total:number}|null}
 */
function interpretarLiquidacionH7(body) {
  const texto = typeof body === 'string' ? body : '';
  const cabecera = _deCabecera(texto);
  const liq = cabecera && cabecera.tributos.length > 0 ? cabecera : _dePartidas(texto);
  if (liq.tributos.length === 0) return null;
  return { ...liq, total: redondear(liq.tributos.reduce((s, t) => s + t.importe, 0)) };
}

module.exports = { interpretarLiquidacionH7 };
