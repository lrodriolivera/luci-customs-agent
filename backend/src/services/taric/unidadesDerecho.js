/**
 * Unidades de los derechos por unidad (especificos) del arancel y como se
 * convierten en un importe.
 *
 * El catalogo tenia las unidades rotas («100», «tonne», «hl») y el calculo
 * dividia entre 1.000 cualquier unidad que contuviera «kg»: un derecho de
 * 38 EUR por 100 kg se liquidaba como 38 EUR por tonelada, y con la unidad
 * rota, como 0 EUR (detectado el 11/Nov/2026).
 */

/** Unidad canonica -> en que magnitud se mide y por cuantas unidades va el importe. */
const UNIDADES = {
  'EUR/100 kg': { magnitud: 'peso', por: 100 },
  'EUR/1000 kg': { magnitud: 'peso', por: 1000 },
  'EUR/kg': { magnitud: 'peso', por: 1 },
  // «EUR DTN G»: por 100 kg de peso BRUTO (lechugas, vidrio colado)
  'EUR/100 kg brutos': { magnitud: 'pesoBruto', por: 100 },
  'EUR/hl': { magnitud: 'volumen', por: 100 },      // la cantidad se declara en litros
  'EUR/1000 p/st': { magnitud: 'unidades', por: 1000 },
  'EUR/p/st': { magnitud: 'unidades', por: 1 }
};

/** Codigo de unidad del TARIC (fichero oficial) -> unidad canonica. */
const UNIDAD_POR_CODIGO_TARIC = {
  DTN: 'EUR/100 kg', TNE: 'EUR/1000 kg', KGM: 'EUR/kg', HLT: 'EUR/hl', MIL: 'EUR/1000 p/st', NAR: 'EUR/p/st',
  // Con calificador: solo lo lee `interpretarFormula` (formasDerecho.js)
  'DTN G': 'EUR/100 kg brutos'
};

// Otras formas de escribir la misma unidad. No incluye las rotas ambiguas
// («100», «1000»): esas solo se corrigen contra la fuente oficial.
const SINONIMOS = {
  'eur/100kg': 'EUR/100 kg', 'eur/dtn': 'EUR/100 kg',
  'eur/1000kg': 'EUR/1000 kg', 'eur/tonne': 'EUR/1000 kg', 'eur/t': 'EUR/1000 kg', 'eur/tne': 'EUR/1000 kg',
  'eur/kg': 'EUR/kg', 'eur/hl': 'EUR/hl', 'eur/hlt': 'EUR/hl',
  'eur/100kgbrutos': 'EUR/100 kg brutos',
  'eur/1000p/st': 'EUR/1000 p/st', 'eur/p/st': 'EUR/p/st', 'eur/unit': 'EUR/p/st'
};

/** Unidad canonica de un texto, o null si no se reconoce. */
function unidadCanonica(unidad) {
  const clave = String(unidad || '').toLowerCase().replace(/\s+/g, '');
  return SINONIMOS[clave] || null;
}

/**
 * Importe de un derecho por unidad.
 *
 * @param {{ amount: number, unit: string }} especifico
 * @param {{ netWeight?: number, grossWeight?: number, quantity?: number }} mercancia pesos en kg; cantidad en litros o en unidades
 * @returns {number|null} null si la unidad no se reconoce o falta el dato de la mercancia: NO es un 0
 */
function importeEspecifico(especifico, { netWeight, grossWeight, quantity } = {}) {
  const definicion = UNIDADES[unidadCanonica(especifico?.unit)];
  const importe = Number(especifico?.amount);
  if (!definicion || !Number.isFinite(importe)) return null;
  const bases = { peso: netWeight, pesoBruto: grossWeight };
  const base = Number(definicion.magnitud in bases ? bases[definicion.magnitud] : quantity);
  if (!Number.isFinite(base) || base <= 0) return null;
  return (base / definicion.por) * importe;
}

module.exports = { unidadCanonica, importeEspecifico, UNIDADES, UNIDAD_POR_CODIGO_TARIC };
