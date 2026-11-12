/**
 * Flete y seguro hasta la entrada de las mercancias en la UE.
 *
 * El valor en aduana es el precio de la factura mas los gastos de transporte y
 * seguro hasta el lugar de introduccion en la Union (art. 71.1.e del CAU) que
 * no esten ya en el precio. Que esta incluido lo dice el incoterm.
 *
 * En el H1 CAU estos gastos se declaran como ajuste «AK» de cada partida
 * (AdditionsAndDeductions, solo a nivel de partida por la regla ESR9001), en
 * euros: comprobado en la preproduccion de la AEAT el 12/11/2026 (un ajuste
 * AK de 500 sobre 10.000 USD dio base 8.901,55 + 500 = 9.401,55).
 *
 * Funciones puras salvo `cambiosDeLosGastos`, que busca los tipos oficiales.
 */
const { aEuros } = require('../divisas/tipoCambioAduanero');

// Gastos que el precio NO incluye segun el incoterm (Incoterms 2020).
const SE_SUMAN = Object.freeze({
  EXW: { flete: true, seguro: true },
  FCA: { flete: true, seguro: true },
  FAS: { flete: true, seguro: true },
  FOB: { flete: true, seguro: true },
  // El vendedor paga el transporte, no el seguro.
  CFR: { flete: false, seguro: true },
  CPT: { flete: false, seguro: true },
  CIF: { flete: false, seguro: false },
  CIP: { flete: false, seguro: false },
  // Entregado en destino: el transporte hasta la UE va en el precio.
  DAP: { flete: false, seguro: false },
  DPU: { flete: false, seguro: false },
  DDP: { flete: false, seguro: false }
});
const LISTA_INCOTERMS = 'EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU o DDP';
const CODIGO_AJUSTE = 'AK';
const GASTOS = [
  { clave: 'flete', campo: 'freight', nombre: 'flete' },
  { clave: 'seguro', campo: 'insurance', nombre: 'seguro' }
];

const redondear = (n) => Math.round(n * 100) / 100;
const codigoDivisa = (d) => String(d || 'EUR').trim().toUpperCase() || 'EUR';
const incotermDe = (expedition) => {
  const i = expedition?.incoterm;
  return String((typeof i === 'object' ? i?.code : i) || '').trim().toUpperCase();
};

/** `{ flete, seguro }`: que hay que sumar al precio; null si no se conoce el incoterm. */
function gastosQueSeSuman(incoterm) {
  return SE_SUMAN[String(incoterm || '').trim().toUpperCase()] || null;
}

/**
 * Importe y divisa de un gasto. Un numero a secas es un dato antiguo en euros;
 * `null` significa que no se ha informado (un 0 si es un dato).
 */
function gastoDe(expedition, campo) {
  const valor = expedition?.costs?.[campo];
  if (typeof valor === 'number') return Number.isFinite(valor) ? { importe: valor, divisa: 'EUR' } : null;
  const importe = valor?.amount;
  if (importe === null || importe === undefined || importe === '' || !Number.isFinite(Number(importe))) return null;
  return { importe: Number(importe), divisa: codigoDivisa(valor.currency) };
}

/** Que gastos cuentan: los que el incoterm no incluye; sin incoterm, los informados. */
function gastosQueCuentan(expedition) {
  const codigo = incotermDe(expedition);
  if (!codigo) return { sumar: { flete: true, seguro: true }, exigir: false, codigo };
  const sumar = gastosQueSeSuman(codigo);
  return { sumar, exigir: Boolean(sumar), codigo };
}

/**
 * Flete y seguro en euros que hay que sumar al precio de la factura.
 *
 * @param {object} expedition
 * @param {{ cambios?: Object<string, {tipo: number}|null> }} opciones  tipos oficiales por divisa
 * @returns {{ flete: number, seguro: number, total: number, faltan: string[] }}
 */
function gastosHastaLaFrontera(expedition, { cambios = {} } = {}) {
  const faltan = [];
  const { sumar, exigir, codigo } = gastosQueCuentan(expedition);
  const resultado = { flete: 0, seguro: 0 };
  if (!sumar) {
    faltan.push(`incoterm reconocido (${LISTA_INCOTERMS})`);
    return { ...resultado, total: 0, faltan };
  }

  for (const { clave, campo, nombre } of GASTOS) {
    if (!sumar[clave]) continue;
    const gasto = gastoDe(expedition, campo);
    if (!gasto) {
      // Sin incoterm no se exige: la falta del incoterm se avisa aparte.
      if (exigir) faltan.push(`${nombre} hasta la entrada en la UE (el incoterm ${codigo} no lo incluye; 0 si no hay)`);
      continue;
    }
    if (gasto.divisa === 'EUR') { resultado[clave] = redondear(gasto.importe); continue; }
    const cambio = cambios[gasto.divisa];
    if (!(cambio?.tipo > 0)) { faltan.push(`tipo de cambio oficial de ${gasto.divisa} para el ${nombre}`); continue; }
    resultado[clave] = aEuros(gasto.importe, cambio.tipo);
  }
  return { ...resultado, total: redondear(resultado.flete + resultado.seguro), faltan };
}

/**
 * Reparte un importe entre partidas en proporcion a su valor (a partes iguales
 * si no hay valores). La ultima se queda el resto para que la suma sea exacta.
 */
function repartirPorValor(total, valores) {
  if (valores.length === 0) return [];
  const suma = valores.reduce((s, v) => s + (v || 0), 0);
  const partes = valores.map((v) => redondear(suma > 0 ? total * (v || 0) / suma : total / valores.length));
  const resto = redondear(total - partes.slice(0, -1).reduce((s, v) => s + v, 0));
  return [...partes.slice(0, -1), resto];
}

/** Divisas distintas del euro de los gastos que hay que sumar. */
function divisasDeLosGastos(expedition) {
  const { sumar } = gastosQueCuentan(expedition);
  if (!sumar) return [];
  const divisas = GASTOS
    .filter(({ clave }) => sumar[clave])
    .map(({ campo }) => gastoDe(expedition, campo)?.divisa)
    .filter((d) => d && d !== 'EUR');
  return [...new Set(divisas)];
}

/**
 * Tipos oficiales de las divisas de los gastos (`null` si el BCE no la cotiza).
 * @param {{ tipoOficial?: Function, fecha?: Date }} opciones
 */
async function cambiosDeLosGastos(expedition, { tipoOficial, ...opciones } = {}) {
  const buscar = tipoOficial || require('../divisas/tiposCambioOficiales').tipoOficial;
  const divisas = divisasDeLosGastos(expedition);
  const tipos = await Promise.all(divisas.map((d) => buscar(d, opciones)));
  return Object.fromEntries(divisas.map((d, i) => [d, tipos[i] || null]));
}

module.exports = {
  CODIGO_AJUSTE, gastosQueSeSuman, gastoDe, gastosHastaLaFrontera, repartirPorValor, divisasDeLosGastos, cambiosDeLosGastos
};
