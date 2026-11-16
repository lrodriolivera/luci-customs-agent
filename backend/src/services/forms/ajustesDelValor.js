/**
 * Ajustes del valor en aduana de cada partida (H1 CAU, DE 14 04 000 000
 * «AdditionsAndDeductions» dentro de CustomsValuation; lista CSRDC791 = CL265).
 *
 * Guia Tecnica de Importacion adaptada al CAU v3.20, pag. 73: `code` (a2,
 * CSRDC791) y `amount` (n..16,2), hasta 99 por partida; a nivel de envio no se
 * pueden declarar (ESR9001, pag. 56). Informacion complementaria H1 v3.26,
 * punto 5 (pag. 63): valor en aduana = factura en euros + ajustes cuyo codigo
 * empieza por A − ajustes cuyo codigo empieza por B, y NO puede ser negativo.
 * Los importes van en euros (comprobado en PRE el 12/11/2026 con AK).
 *
 * - AK: flete y seguro hasta la entrada en la UE que no van en el precio
 *   (art. 71.1.e del CAU), segun el incoterm (`gastosHastaLaFrontera.js`).
 * - BA: transporte despues de la llegada al lugar de introduccion en la UE que
 *   SI va en el precio (art. 72.a del CAU): incoterms D siempre, C si se
 *   informa. El seguro de ese tramo no tiene codigo propio en la CL265 (BA dice
 *   solo «transporte»), asi que no se deduce: el valor queda del lado seguro.
 * - Opcionales del expediente (`costs.otherAdjustments`): el resto de la CL265
 *   salvo AN y BG, que exigen una decision del art. 71 del Reglamento de
 *   Ejecucion que LUCI no gestiona.
 *
 * Funciones puras.
 */
const { aEuros } = require('../divisas/tipoCambioAduanero');
const {
  CODIGO_AJUSTE, TRANSPORTE_TRAS_LA_ENTRADA, incotermDe, importeConDivisa, gastoDe, gastosHastaLaFrontera, repartirPorValor
} = require('./gastosHastaLaFrontera');

const CODIGO_TRANSPORTE_TRAS_LA_ENTRADA = 'BA';
// CL265 (Reglamento Delegado (UE) 2015/2446, anexo B, DE 14 04 008 000).
const CODIGOS_OPCIONALES = Object.freeze({
  AB: 'Comisiones y gastos de corretaje, salvo comisiones de compra',
  AD: 'Envases y embalajes',
  AE: 'Materiales, componentes y partes incorporados a las mercancías',
  AF: 'Herramientas, matrices y moldes utilizados en la producción',
  AG: 'Materiales consumidos en la producción',
  AH: 'Ingeniería, desarrollo, arte, diseño, planos y croquis realizados fuera de la UE',
  AI: 'Cánones y derechos de licencia',
  AJ: 'Producto de la reventa, cesión o utilización posterior que revierte al vendedor',
  AL: 'Pagos indirectos y otros pagos (art. 70 del CAU)',
  BB: 'Construcción, instalación, montaje, mantenimiento o asistencia técnica tras la importación',
  BC: 'Derechos de importación y otros gravámenes pagaderos en la UE',
  BD: 'Intereses',
  BE: 'Derechos de reproducción en la UE de las mercancías importadas',
  BF: 'Comisiones de compra'
});
const CALCULADOS = new Set([CODIGO_AJUSTE, CODIGO_TRANSPORTE_TRAS_LA_ENTRADA]);

const redondear = (n) => Math.round(n * 100) / 100;

/** 'exigir' (grupo D), 'admitir' (grupo C) o null: si el precio puede llevar transporte dentro de la UE. */
function transporteTrasLaEntrada(incoterm) {
  return TRANSPORTE_TRAS_LA_ENTRADA[String(incoterm || '').trim().toUpperCase()] || null;
}

/** Importe en euros, o el texto de lo que falta para convertirlo. */
function enEuros(gasto, cambios, nombre) {
  if (gasto.divisa === 'EUR') return { importe: redondear(gasto.importe) };
  const cambio = cambios[gasto.divisa];
  if (!(cambio?.tipo > 0)) return { falta: `tipo de cambio oficial de ${gasto.divisa} para ${nombre}` };
  return { importe: aEuros(gasto.importe, cambio.tipo) };
}

function deduccionBA(expedition, cambios, faltan) {
  const codigo = incotermDe(expedition);
  const regla = transporteTrasLaEntrada(codigo);
  if (!regla) return 0;
  const gasto = gastoDe(expedition, 'freightAfterEntry');
  if (!gasto) {
    if (regla === 'exigir') {
      const lugar = typeof expedition?.incoterm === 'object' && expedition.incoterm?.place ? ` (${String(expedition.incoterm.place).trim()})` : '';
      faltan.push(`transporte desde la entrada en la UE hasta el lugar de entrega${lugar} incluido en el precio: `
        + `con ${codigo} no forma parte del valor en aduana (0 si se entrega en el punto de entrada)`);
    }
    return 0;
  }
  const r = enEuros(gasto, cambios, 'el transporte desde la entrada en la UE');
  if (r.falta) { faltan.push(r.falta); return 0; }
  return r.importe;
}

function ajustesOpcionales(expedition, cambios, faltan) {
  const lista = Array.isArray(expedition?.costs?.otherAdjustments) ? expedition.costs.otherAdjustments : [];
  const porCodigo = new Map();
  for (const ajuste of lista) {
    const codigo = String(ajuste?.code || '').trim().toUpperCase();
    if (!CODIGOS_OPCIONALES[codigo]) {
      faltan.push(CALCULADOS.has(codigo)
        ? `código de ajuste no admitido: ${codigo} (el flete y seguro hasta la UE y el transporte posterior se informan aparte)`
        : `código de ajuste no admitido: ${codigo || '(vacío)'}`);
      continue;
    }
    const gasto = importeConDivisa(ajuste);
    if (!gasto || gasto.importe < 0) { faltan.push(`importe del ajuste ${codigo}`); continue; }
    const r = enEuros(gasto, cambios, `el ajuste ${codigo}`);
    if (r.falta) { faltan.push(r.falta); continue; }
    porCodigo.set(codigo, redondear((porCodigo.get(codigo) || 0) + r.importe));
  }
  return [...porCodigo].map(([codigo, importe]) => ({ codigo, importe }));
}

/**
 * Ajustes del envio en euros (totales por codigo, sin los que son 0).
 *
 * @param {object} expedition
 * @param {{ cambios?: Object<string, {tipo: number}|null> }} opciones  tipos oficiales por divisa (incluida la de la factura)
 * @returns {{ ajustes: Array<{codigo: string, importe: number}>, faltan: string[] }}
 */
function ajustesDelValor(expedition, { cambios = {} } = {}) {
  const gastos = gastosHastaLaFrontera(expedition, { cambios });
  const faltan = [...gastos.faltan];
  const ajustes = [
    { codigo: CODIGO_AJUSTE, importe: gastos.total },
    { codigo: CODIGO_TRANSPORTE_TRAS_LA_ENTRADA, importe: deduccionBA(expedition, cambios, faltan) },
    ...ajustesOpcionales(expedition, cambios, faltan)
  ].filter((a) => a.importe > 0);
  return { ajustes, faltan };
}

/** Reparte cada ajuste entre las partidas por su valor; cada partida, sus ajustes distintos de 0. */
function ajustesDeLaPartida(ajustes, valores) {
  const repartos = ajustes.map((a) => repartirPorValor(a.importe, valores));
  return valores.map((_, i) => ajustes
    .map((a, j) => ({ codigo: a.codigo, importe: repartos[j][i] }))
    .filter((a) => a.importe > 0));
}

/** Valor en aduana: valor en euros + ajustes A* − ajustes B*. */
function valorConAjustes(valorEuros, ajustes) {
  return redondear(ajustes.reduce((s, a) => s + (a.codigo.startsWith('B') ? -a.importe : a.importe), valorEuros));
}

module.exports = {
  CODIGO_TRANSPORTE_TRAS_LA_ENTRADA, CODIGOS_OPCIONALES, transporteTrasLaEntrada, ajustesDelValor, ajustesDeLaPartida, valorConAjustes
};
