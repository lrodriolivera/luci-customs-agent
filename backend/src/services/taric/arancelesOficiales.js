/**
 * Arancel de terceros paises oficial, del fichero «Duties Import 01-99.xlsx»
 * que la Comision Europea publica cada mes en CIRCABC.
 *
 * El arancel general es la medida 103 («Third country duty») con origen 1011
 * (ERGA OMNES). Se define casi siempre a 8 digitos y lo heredan los codigos
 * que cuelgan de el. Puede tener fechas (derechos de temporada) y variantes
 * por codigo adicional.
 *
 * Aqui solo se da por resuelto un derecho que LUCI sabe liquidar sin
 * interpretarlo: un porcentaje («8.800 %») o un importe por unidad
 * («38.000 EUR DTN»). Mixtos, minimos y maximos, elementos agricolas y medidas
 * condicionadas se devuelven sin resolver, con su texto literal: no se
 * simplifican a una cifra.
 */
const { fechaDe } = require('./nomenclaturaOficial');

const CABECERA = ['Goods code', 'Add code', 'Order No.', 'Start date', 'End date', 'RED_IND', 'Origin', 'Measure type', 'Legal base', 'Duty', 'Origin code', 'Meas. type code'];
const MEDIDA_TERCEROS_PAISES = '103';
const ORIGEN_ERGA_OMNES = '1011';
const CORTES_DE_HERENCIA = [10, 8, 6, 4, 2];

// Unidades de medida del TARIC que el catalogo ya usa en sus derechos especificos.
const UNIDADES = { DTN: 'EUR/100 kg', TNE: 'EUR/1000 kg', HLT: 'EUR/hl', KGM: 'EUR/kg' };

const RE_AD_VALOREM = /^(\d+(?:\.\d+)?) %$/;
const RE_ESPECIFICO = /^(\d+(?:\.\d+)?) EUR ([A-Z]{3})$/;

/**
 * @param {string} texto celda «Duty» del fichero oficial
 * @returns {{ tipo: 'ad_valorem', adValorem: number } | { tipo: 'especifico', specific: { amount: number, unit: string } } | null}
 */
function interpretarDerecho(texto) {
  const limpio = String(texto || '').trim().replace(/\s+/g, ' ');
  const adValorem = RE_AD_VALOREM.exec(limpio);
  if (adValorem) return { tipo: 'ad_valorem', adValorem: Number(adValorem[1]) };
  const especifico = RE_ESPECIFICO.exec(limpio);
  if (especifico && UNIDADES[especifico[2]]) {
    return { tipo: 'especifico', specific: { amount: Number(especifico[1]), unit: UNIDADES[especifico[2]] } };
  }
  return null;
}

/**
 * Medidas 103 ERGA OMNES vigentes en `fecha`, por codigo.
 *
 * @param {string[][]} filas hoja leida con `leerPrimeraHoja`
 * @param {{ fecha?: Date }} [opciones]
 * @returns {Map<string, Array<{ codigoAdicional: string, texto: string }>>}
 */
function leerDerechosTercerosPaises(filas, { fecha = new Date() } = {}) {
  const cabecera = (filas[0] || []).map((c) => String(c).trim());
  const falta = CABECERA.find((columna, i) => cabecera[i] !== columna);
  if (falta) throw new Error(`Derechos de importacion: el formato del fichero oficial ha cambiado (se esperaba la columna «${falta}»)`);

  const derechos = new Map();
  for (const fila of filas.slice(1)) {
    if (fila[11] !== MEDIDA_TERCEROS_PAISES || fila[10] !== ORIGEN_ERGA_OMNES) continue;
    const codigo = String(fila[0] || '').trim();
    if (!/^\d{10}$/.test(codigo)) continue;
    const desde = fechaDe(fila[3]);
    const hasta = fechaDe(fila[4]);
    if ((desde && desde > fecha) || (hasta && hasta < fecha)) continue;
    if (!derechos.has(codigo)) derechos.set(codigo, []);
    derechos.get(codigo).push({ codigoAdicional: String(fila[1] || '').trim(), texto: String(fila[9] || '').trim().replace(/\s+/g, ' ') });
  }
  if (derechos.size === 0) throw new Error('Derechos de importacion: el fichero oficial no trae ningun derecho de terceros paises vigente');
  return derechos;
}

/**
 * Arancel de terceros paises de un codigo, propio o heredado del codigo del que
 * cuelga (por prefijo: 10, 8, 6, 4 y 2 digitos).
 *
 * @returns {{ estado: 'ok', derecho: object, texto: string, heredadoDe: string }
 *   | { estado: 'variantes' | 'no_simple', texto: string, heredadoDe: string }
 *   | { estado: 'sin_medida' }}
 */
function arancelDe(codigo, derechos) {
  for (const corte of CORTES_DE_HERENCIA) {
    const origen = codigo.slice(0, corte).padEnd(10, '0');
    const medidas = derechos.get(origen);
    if (!medidas) continue;
    const textos = [...new Set(medidas.map((m) => m.texto))];
    // Varios tipos (por codigo adicional) o un tipo ligado a un codigo adicional:
    // no existe «el» arancel del codigo.
    if (textos.length > 1 || medidas.some((m) => m.codigoAdicional)) {
      return { estado: 'variantes', texto: textos.join(' | ').slice(0, 300), heredadoDe: origen };
    }
    const derecho = interpretarDerecho(textos[0]);
    return derecho
      ? { estado: 'ok', derecho, texto: textos[0], heredadoDe: origen }
      : { estado: 'no_simple', texto: textos[0].slice(0, 300), heredadoDe: origen };
  }
  return { estado: 'sin_medida' };
}

const TOLERANCIA = 0.005;

/**
 * Codigos declarables del catalogo cuyo arancel no coincide con el oficial.
 * Solo compara cuando el oficial es un porcentaje simple; no corrige nada.
 *
 * @param {Array<{ code: string, isLeaf: boolean, isActive: boolean, duties?: object }>} catalogo
 * @param {Map} derechos
 * @returns {{ comparados: number, coinciden: number, noComparables: number, distintos: Array<{ code, catalogo, oficial, heredadoDe, fuenteCatalogo }> }}
 */
function compararAranceles(catalogo, derechos) {
  const resultado = { comparados: 0, coinciden: 0, noComparables: 0, distintos: [] };
  for (const actual of catalogo) {
    if (!actual.isLeaf || actual.isActive === false) continue;
    const oficial = arancelDe(actual.code, derechos);
    const mio = actual.duties?.thirdCountry;
    if (oficial.estado !== 'ok' || oficial.derecho.tipo !== 'ad_valorem' || typeof mio !== 'number') {
      resultado.noComparables += 1;
      continue;
    }
    resultado.comparados += 1;
    const tieneEspecifico = Boolean(actual.duties?.specific?.amount);
    if (Math.abs(mio - oficial.derecho.adValorem) < TOLERANCIA && !tieneEspecifico) {
      resultado.coinciden += 1;
    } else {
      resultado.distintos.push({
        code: actual.code, catalogo: mio, oficial: oficial.derecho.adValorem, heredadoDe: oficial.heredadoDe,
        especificoCatalogo: tieneEspecifico ? actual.duties.specific.amount : null,
        fuenteCatalogo: actual.duties?.origen?.fuente || null
      });
    }
  }
  resultado.distintos.sort((a, b) => a.code.localeCompare(b.code));
  return resultado;
}

module.exports = { interpretarDerecho, leerDerechosTercerosPaises, arancelDe, compararAranceles, UNIDADES };
