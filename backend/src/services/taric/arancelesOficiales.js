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
const MEDIDA_DESTINO_FINAL = '105';
const ROTULO_TERCEROS_PAISES = 'Third country duty';
const ROTULO_DESTINO_FINAL = 'Non preferential duty under end-use';
const ORIGEN_ERGA_OMNES = '1011';
const CORTES_DE_HERENCIA = [10, 8, 6, 4, 2];

const { UNIDAD_POR_CODIGO_TARIC } = require('./unidadesDerecho');

const UNIDADES = UNIDAD_POR_CODIGO_TARIC;
const CERTIFICADO_SANCION = 'Y155';

// «1,024.000» -> 1024: el fichero usa coma de millares y punto decimal. Cada
// numero se captura con el mismo patron: (\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)
const numero = (texto) => Number(String(texto).replace(/,/g, ''));
const RE_AD_VALOREM = /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) %$/;
const RE_ESPECIFICO = /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) EUR ([A-Z]{3})$/;
const RE_SUMA = /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) % \+ (\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) EUR ([A-Z]{3})$/;
const RE_MINIMO_MAXIMO = /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) % MIN (\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) EUR ([A-Z]{3})(?: MAX (\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?) EUR ([A-Z]{3}))?$/;
// Medida condicionada al certificado Y155 (mercancia exportada desde Rusia o
// Bielorrusia, Reg. (UE) 2024/1392): la rama con certificado es el derecho
// punitivo y la otra, el arancel general.
const RE_CONDICION_SANCION = /^Cond: B cert: Y-155 \(\d+\):(.+?) ; B \(\d+\):(.+)$/;

const especifico = (importe, codigo) => (UNIDADES[codigo] ? { amount: numero(importe), unit: UNIDADES[codigo] } : null);

/**
 * Derecho que LUCI sabe liquidar, a partir del texto de la celda «Duty».
 *
 *   «8.800 %»                                  -> ad_valorem
 *   «38.000 EUR DTN»                           -> especifico
 *   «10.200 % + 93.100 EUR DTN»                -> suma (los dos se suman)
 *   «18.400 % MIN 22.000 EUR DTN MAX 24.000…»  -> ad_valorem con minimo y maximo
 *   «Cond: B cert: Y-155 (01):50 % ; B (01):X» -> X, mas la sancion del 50 %
 *
 * Todo lo demas (elemento agricola «EA», grado alcoholico «ASV», precios de
 * entrada, tres sumandos, unidades con calificador) devuelve null: no se
 * simplifica a una cifra.
 *
 * @param {string} texto
 * @returns {{ tipo: 'ad_valorem'|'especifico'|'suma', adValorem?: number, specific?: object, minimo?: object, maximo?: object, sancion?: object } | null}
 */
function interpretarDerecho(texto) {
  const limpio = String(texto || '').trim().replace(/\s+/g, ' ');

  const condicion = RE_CONDICION_SANCION.exec(limpio);
  if (condicion) {
    const general = interpretarDerecho(condicion[2]);
    const punitivo = RE_AD_VALOREM.exec(condicion[1].trim());
    if (!general || general.sancion) return null;
    // Si el derecho punitivo no es un porcentaje simple, el arancel general
    // sigue valiendo: la sancion queda en el texto oficial de la evidencia.
    return punitivo ? { ...general, sancion: { adValorem: numero(punitivo[1]), certificado: CERTIFICADO_SANCION } } : general;
  }

  let m = RE_AD_VALOREM.exec(limpio);
  if (m) return { tipo: 'ad_valorem', adValorem: numero(m[1]) };

  m = RE_ESPECIFICO.exec(limpio);
  if (m) {
    const specific = especifico(m[1], m[2]);
    return specific ? { tipo: 'especifico', specific } : null;
  }

  m = RE_SUMA.exec(limpio);
  if (m) {
    const specific = especifico(m[2], m[3]);
    if (!specific) return null;
    // «6.500 % + 0.000 EUR TNE» es un 6,5 % a secas.
    return specific.amount === 0 ? { tipo: 'ad_valorem', adValorem: numero(m[1]) } : { tipo: 'suma', adValorem: numero(m[1]), specific };
  }

  m = RE_MINIMO_MAXIMO.exec(limpio);
  if (m) {
    const minimo = especifico(m[2], m[3]);
    const maximo = m[4] ? especifico(m[4], m[5]) : null;
    if (!minimo || (m[4] && !maximo)) return null;
    return { tipo: 'ad_valorem', adValorem: numero(m[1]), minimo, ...(maximo ? { maximo } : {}) };
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
  const destinoFinal = new Map();
  for (const fila of filas.slice(1)) {
    const medida = fila[11];
    if ((medida !== MEDIDA_TERCEROS_PAISES && medida !== MEDIDA_DESTINO_FINAL) || fila[10] !== ORIGEN_ERGA_OMNES) continue;
    const codigo = String(fila[0] || '').trim();
    if (!/^\d{10}$/.test(codigo)) continue;
    const desde = fechaDe(fila[3]);
    const hasta = fechaDe(fila[4]);
    if ((desde && desde > fecha) || (hasta && hasta < fecha)) continue;
    const destino = medida === MEDIDA_DESTINO_FINAL ? destinoFinal : derechos;
    if (!destino.has(codigo)) destino.set(codigo, []);
    destino.get(codigo).push({
      codigoAdicional: String(fila[1] || '').trim(), texto: String(fila[9] || '').trim().replace(/\s+/g, ' '),
      ...(medida === MEDIDA_DESTINO_FINAL ? { destinoFinal: true } : {})
    });
  }
  // Codigos de destino final («para sacrificio», «destinados a aeronaves
  // civiles»…): no tienen derecho de terceros paises propio; el suyo es la
  // medida 105, que solo vale con la autorizacion de destino final. Si el
  // codigo tiene las dos, manda la general.
  for (const [codigo, medidas] of destinoFinal) {
    if (!derechos.has(codigo)) derechos.set(codigo, medidas);
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
    const soloDestinoFinal = medidas.some((m) => m.destinoFinal);
    const extra = soloDestinoFinal ? { soloDestinoFinal: true, rotulo: ROTULO_DESTINO_FINAL } : { rotulo: ROTULO_TERCEROS_PAISES };
    return derecho
      ? { estado: 'ok', derecho, texto: textos[0], heredadoDe: origen, ...extra }
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
    const simple = oficial.estado === 'ok' && oficial.derecho.tipo === 'ad_valorem' && !oficial.derecho.minimo && !oficial.derecho.sancion;
    if (!simple || typeof mio !== 'number') {
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

/**
 * Campos de `duties` que corresponden a un derecho interpretado. Lo que el
 * derecho no lleva va a null, para poder borrarlo del catalogo.
 */
function camposDeDerecho(derecho) {
  return {
    thirdCountry: derecho.tipo === 'especifico' ? 0 : derecho.adValorem,
    specific: derecho.specific || null,
    combinacion: derecho.tipo === 'suma' ? 'suma' : null,
    minimo: derecho.minimo || null,
    maximo: derecho.maximo || null,
    sancion: derecho.sancion || null
  };
}

module.exports = { interpretarDerecho, leerDerechosTercerosPaises, arancelDe, compararAranceles, camposDeDerecho, UNIDADES };
