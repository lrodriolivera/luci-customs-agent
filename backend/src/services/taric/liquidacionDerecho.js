/**
 * Importe del derecho de terceros paises de una partida. Funciones puras: no
 * leen la base de datos ni la IA; solo el derecho oficial guardado y los datos
 * de la partida (valor en aduana en EUR, peso neto, peso bruto, cantidad).
 *
 * Si falta un dato para un sumando, ese sumando no cuenta y se AVISA: nunca se
 * estima.
 */
const { importeEspecifico } = require('./unidadesDerecho');

const legibleNumero = (n) => String(Math.round(Number(n) * 1000) / 1000).replace('.', ',');
const legibleTermino = (t) => (typeof t.adValorem === 'number' ? `${legibleNumero(t.adValorem)} %` : `${legibleNumero(t.amount)} ${t.unit}`);
const BASE_DE_MAGNITUD = { 'EUR/100 kg brutos': 'el peso bruto' };

/**
 * Derecho «de siempre» del catalogo: porcentaje, importe por unidad, suma de
 * ambos o el mayor de los dos ('mixed', carga antigua), con minimo y maximo.
 *
 * @param {{ dutyRate: number, dutyType: string, specificDuty?: object, minimumDuty?: object, maximumDuty?: object }} derecho
 * @param {{ customsValue: number, netWeight?: number, grossWeight?: number, quantity?: number }} mercancia
 * @returns {{ adValoremDuty: number, specificDuty: number, totalDuty: number, avisos: string[] }}
 */
function importeDeDerecho(derecho, mercancia) {
  const avisos = [];
  const porUnidad = (importe, concepto) => {
    if (!importe || !importe.amount) return null;
    const euros = importeEspecifico(importe, mercancia);
    if (euros === null) {
      avisos.push(`No se ha podido calcular ${concepto} (${importe.amount} ${importe.unit || 'sin unidad'}): falta el peso neto o la cantidad, o la unidad no se reconoce. Revisalo antes de declarar.`);
    }
    return euros;
  };
  const adValoremDuty = (Number(mercancia.customsValue) || 0) * ((Number(derecho.dutyRate) || 0) / 100);
  const specificDuty = porUnidad(derecho.specificDuty, 'el derecho por unidad') ?? 0;

  let totalDuty;
  if (derecho.dutyType === 'compound') totalDuty = adValoremDuty + specificDuty;
  else if (derecho.dutyType === 'mixed') totalDuty = Math.max(adValoremDuty, specificDuty);
  else if (derecho.dutyType === 'specific') totalDuty = specificDuty;
  else totalDuty = adValoremDuty;

  // Minimo y maximo del derecho («18,4 % MIN 22 EUR/100 kg MAX 24 EUR/100 kg»).
  const minimo = porUnidad(derecho.minimumDuty, 'el derecho minimo');
  const maximo = porUnidad(derecho.maximumDuty, 'el derecho maximo');
  if (minimo !== null && totalDuty < minimo) totalDuty = minimo;
  if (maximo !== null && totalDuty > maximo) totalDuty = maximo;
  return { adValoremDuty, specificDuty, totalDuty, avisos };
}

/**
 * Suma de una lista de sumandos. `null` si falta el dato de alguno y `exigir`
 * esta activo (para un minimo o un maximo: un tope a medias no es un tope).
 */
function sumar(terminos, mercancia, concepto, avisos, { exigir = false } = {}) {
  let adValorem = 0;
  let especifico = 0;
  let incompleto = false;
  for (const t of terminos || []) {
    if (typeof t.adValorem === 'number') {
      adValorem += (Number(mercancia.customsValue) || 0) * (t.adValorem / 100);
      continue;
    }
    const euros = importeEspecifico(t, mercancia);
    if (euros === null) {
      incompleto = true;
      const base = BASE_DE_MAGNITUD[t.unit] || 'el peso neto o la cantidad';
      avisos.push(`No se ha podido calcular ${concepto} (${legibleTermino(t)}): falta ${base} de la partida. Revisalo antes de declarar.`);
    } else {
      especifico += euros;
    }
  }
  if (incompleto && exigir) return null;
  return { adValorem, especifico, total: adValorem + especifico };
}

/**
 * Derecho oficial escrito como suma con minimo y maximo (`interpretarFormula`).
 *
 * @param {{ sumandos: object[], minimo?: object[], maximo?: object[] }} formula
 * @param {{ customsValue: number, netWeight?: number, grossWeight?: number, quantity?: number }} mercancia
 * @returns {{ adValoremDuty: number, specificDuty: number, totalDuty: number, avisos: string[] }}
 */
function liquidarFormula(formula, mercancia) {
  const avisos = [];
  const base = sumar(formula.sumandos, mercancia, 'parte del derecho', avisos);
  let totalDuty = base.total;
  if (formula.minimo?.length) {
    const minimo = sumar(formula.minimo, mercancia, 'el derecho minimo', avisos, { exigir: true });
    if (minimo && totalDuty < minimo.total) totalDuty = minimo.total;
  }
  if (formula.maximo?.length) {
    const maximo = sumar(formula.maximo, mercancia, 'el derecho maximo', avisos, { exigir: true });
    if (maximo && totalDuty > maximo.total) totalDuty = maximo.total;
  }
  return { adValoremDuty: base.adValorem, specificDuty: base.especifico, totalDuty, avisos };
}

/**
 * Parte exacta de un derecho no calculable (`parteExacta`): lo que se puede
 * liquidar con los datos de la partida. Un sumando al que le falta un dato
 * (volumen, peso) no cuenta y se avisa; en el maximo tampoco, lo que solo puede
 * bajarlo: el resultado sigue siendo un minimo del derecho real.
 *
 * @returns {{ adValoremDuty: number, specificDuty: number, totalDuty: number, avisos: string[] }}
 */
function liquidarParteExacta(parte, mercancia) {
  const avisos = [];
  const base = sumar(parte.sumandos, mercancia, 'parte del derecho', avisos);
  let totalDuty = base.total;
  if (parte.maximo) totalDuty = Math.min(totalDuty, sumar(parte.maximo, mercancia, 'el derecho maximo', avisos).total);
  return { adValoremDuty: Math.min(base.adValorem, totalDuty), specificDuty: Math.min(base.especifico, totalDuty), totalDuty, avisos };
}

/**
 * Codigo adicional TARIC de la partida: el declarado aparte o las cifras 11 a
 * 14 de un codigo de 14 cifras. Cuatro caracteres alfanumericos, o null.
 */
function codigoAdicionalDe(declarado, taricCode) {
  const propio = String(declarado ?? '').trim().toUpperCase();
  if (propio) return /^[0-9A-Z]{4}$/.test(propio) && /\d/.test(propio) ? propio : null;
  const cifras = String(taricCode || '').replace(/[\s.]/g, '');
  return /^\d{14}$/.test(cifras) ? cifras.slice(10) : null;
}

/** Tipo de liquidacion de una variante, con los mismos nombres que el catalogo. */
const tipoDeVariante = (v) => {
  if (!v?.specific?.amount) return 'ad_valorem';
  if (v.combinacion === 'suma') return 'compound';
  return v.thirdCountry ? 'mixed' : 'specific';
};

/** Variante como derecho liquidable con `importeDeDerecho`. */
const derechoDeVariante = (v) => ({
  dutyRate: v.thirdCountry ?? 0,
  dutyType: tipoDeVariante(v),
  specificDuty: v.specific?.amount ? v.specific : null,
  minimumDuty: v.minimo?.amount ? v.minimo : null,
  maximumDuty: v.maximo?.amount ? v.maximo : null
});

const legibleVariante = (v) => {
  const partes = [];
  if (typeof v.thirdCountry === 'number' && (v.thirdCountry || !v.specific?.amount)) partes.push(`${legibleNumero(v.thirdCountry)} %`);
  if (v.specific?.amount) partes.push(`${legibleNumero(v.specific.amount)} ${v.specific.unit}`);
  return `${v.codigoAdicional} (${v.descripcion || 'sin descripcion oficial'}): ${partes.join(' + ') || v.texto}`;
};

/**
 * Variante del derecho que corresponde a la partida. Con el codigo adicional
 * declarado, la suya. Sin el (o si no es uno de los de este codigo), la de
 * MAYOR importe —nunca se liquida por debajo— y se pide el codigo adicional.
 *
 * @param {Array<{ codigoAdicional, descripcion, texto, thirdCountry, specific?, combinacion?, minimo?, maximo? }>} variantes
 * @param {string|null} codigoAdicional
 * @param {object} mercancia
 * @returns {{ variante: object, derecho: object, faltaCodigoAdicional: boolean, avisos: string[] }}
 */
function elegirVariante(variantes, codigoAdicional, mercancia) {
  const propia = codigoAdicional && variantes.find((v) => v.codigoAdicional === codigoAdicional);
  if (propia) {
    return {
      variante: propia, derecho: derechoDeVariante(propia), faltaCodigoAdicional: false,
      avisos: [`Derecho del codigo adicional ${legibleVariante(propia)}.`]
    };
  }
  const importe = (v) => importeDeDerecho(derechoDeVariante(v), mercancia).totalDuty;
  const mayor = variantes.reduce((a, b) => (importe(b) > importe(a) ? b : a));
  const ajeno = codigoAdicional ? `El codigo adicional ${codigoAdicional} no es uno de los codigos adicionales de este codigo. ` : '';
  return {
    variante: mayor, derecho: derechoDeVariante(mayor), faltaCodigoAdicional: true,
    avisos: [`${ajeno}El derecho de este codigo depende del codigo adicional TARIC: ${variantes.map(legibleVariante).join('; ')}. ` +
      `Sin el codigo adicional se ha liquidado con el de mayor importe (${mayor.codigoAdicional}). Indica el codigo adicional de la partida para liquidarlo con exactitud.`]
  };
}

module.exports = { importeDeDerecho, liquidarFormula, liquidarParteExacta, codigoAdicionalDe, elegirVariante, derechoDeVariante, legibleTermino };
