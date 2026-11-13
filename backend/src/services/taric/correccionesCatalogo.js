/**
 * Correcciones de los codigos que el catalogo YA tiene, contra la fuente
 * oficial: descripciones y arancel de terceros paises. Funciones puras.
 *
 * Medido el 11/Nov/2026: 15.066 de 21.946 descripciones en español no eran las
 * oficiales (el catalogo se cargo con textos traducidos, y varios niveles
 * llevaban la descripcion de su partida en vez de la suya), y 167 aranceles no
 * coincidian con el derecho de terceros paises oficial.
 */
const { arancelDe, camposDeDerecho, interpretarDerecho } = require('./arancelesOficiales');
const { interpretarFormula, clasificarDerecho } = require('./formasDerecho');
const { unidadCanonica } = require('./unidadesDerecho');
const { palabrasClave } = require('./planSincronizacion');

const SEPARADOR_RUTA = ' > ';
const MAX_PALABRAS_CLAVE = 25;
const TOLERANCIA = 0.005;
const CAPITULOS_SIN_DERECHO = ['98', '99'];
const sinDerechoOficial = (code) => CAPITULOS_SIN_DERECHO.includes(String(code).slice(0, 2));

const MOTIVOS_NO_CALCULABLE = {
  variantes: 'varios tipos segun codigo adicional',
  no_simple: 'derecho con elemento agricola, grado alcoholico, precio de entrada o varios sumandos'
};
const MAX_TEXTO_EN_EVIDENCIA = 160;
const MAX_EVIDENCIA = 500;
/**
 * Texto que se guarda como evidencia cuando el derecho oficial no se sabe
 * liquidar: el texto oficial y, si se sabe, el dato que hace falta.
 */
const evidenciaNoCalculable = (oficial, faltan = []) => {
  const texto = oficial.texto.length > MAX_TEXTO_EN_EVIDENCIA ? `${oficial.texto.slice(0, MAX_TEXTO_EN_EVIDENCIA)}…` : oficial.texto;
  // Con el dato que falta, el motivo generico sobra (el texto completo va en `textoOficial`).
  const motivo = faltan.length > 0 ? ` Para liquidarlo hace falta ${faltan.join(' y ')}, dato que LUCI no tiene.` : `: ${MOTIVOS_NO_CALCULABLE[oficial.estado] || oficial.estado}.`;
  return `Derecho oficial «${texto}»${faltan.length > 0 ? '.' : ''}${motivo} LUCI no lo liquida automaticamente.`.slice(0, MAX_EVIDENCIA);
};

const sinNulos = (objeto) => Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== null && v !== undefined));

/**
 * Que hacer con un derecho oficial que no es simple (`arancelDe` con estado
 * 'variantes' o 'no_simple'):
 *   - variantes por codigo adicional que LUCI sabe liquidar una a una -> 'variantes'
 *   - suma de porcentajes e importes con minimo o maximo -> 'compuesto'
 *   - lo demas -> 'no_calculable', con la forma y el dato que falta
 *
 * @param {object} oficial resultado de `arancelDe`
 * @param {{ codigosAdicionales?: Map<string, string> }} [opciones]
 */
function resolverDerechoNoSimple(oficial, { codigosAdicionales } = {}) {
  if (oficial.estado === 'variantes') {
    const variantes = (oficial.variantes || []).map((v) => {
      const derecho = interpretarDerecho(v.texto);
      if (!derecho || derecho.sancion || !v.codigoAdicional) return null;
      const { sancion, ...campos } = camposDeDerecho(derecho);
      return { codigoAdicional: v.codigoAdicional, descripcion: codigosAdicionales?.get(v.codigoAdicional) || null, texto: v.texto, ...sinNulos(campos) };
    });
    if (variantes.length > 0 && variantes.every(Boolean)) return { tipo: 'variantes', variantes };
    // Alguna variante no la sabe liquidar LUCI: no es un dato de la partida que falte.
    return { tipo: 'no_calculable', forma: 'variantes_no_interpretables', faltan: [], evidencia: evidenciaNoCalculable(oficial) };
  }
  const formula = interpretarFormula(oficial.texto);
  if (formula) {
    const porcentaje = formula.sumandos.filter((t) => typeof t.adValorem === 'number').reduce((a, t) => a + t.adValorem, 0);
    const especificos = formula.sumandos.filter((t) => t.unit);
    // Campos de siempre, para quien solo lee el porcentaje; el calculo usa la formula.
    const specific = especificos.length === 1 ? especificos[0] : null;
    return {
      tipo: 'compuesto', formula,
      campos: { thirdCountry: Math.round(porcentaje * 1000) / 1000, specific, combinacion: specific && porcentaje ? 'suma' : null }
    };
  }
  const { forma, faltan } = clasificarDerecho(oficial.texto);
  return { tipo: 'no_calculable', forma, faltan, evidencia: evidenciaNoCalculable(oficial, faltan) };
}

const claveVariantes = (lista) => JSON.stringify((lista || []).map((v) => [v.codigoAdicional, v.descripcion || null, v.texto]));
/** Variantes o formula de una carga anterior que un derecho simple debe borrar. */
const tieneVariantesOFormula = (duties) => Boolean(duties?.variantes?.length || duties?.formula?.texto);

/** Texto reducido a letras y cifras, para comparar sin ruido de formato. */
const huella = (texto) => String(texto || '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').toLowerCase()
  .replace(/[²³]/g, (c) => (c === '²' ? '2' : '3'))
  .replace(/[^a-z0-9áéíóúüñ]+/g, '');

/**
 * Descripciones del catalogo que no coinciden con la oficial, con lo que hay
 * que escribir. No toca un codigo si la fuente no trae su descripcion.
 *
 * @param {Array<{ code, description?: { es, en }, legalDescription?: string }>} catalogo
 * @param {{ es: Map, en: Map, rutas: Map }} oficial lineas en español e ingles y rutas en español
 * @returns {Array<{ code, es?: string, en?: string, legalDescription?: string, keywords?: string[], antes?: string }>}
 */
function corregirDescripciones(catalogo, { es, en, rutas }) {
  const cambios = [];
  for (const actual of catalogo) {
    const cambio = { code: actual.code };
    const oficialEs = es.get(actual.code)?.descripcion;
    const oficialEn = en.get(actual.code)?.descripcion;
    const ruta = rutas.get(actual.code);

    if (oficialEs && huella(oficialEs) !== huella(actual.description?.es)) {
      cambio.es = oficialEs;
      cambio.antes = actual.description?.es || null;
    }
    if (oficialEn && huella(oficialEn) !== huella(actual.description?.en)) cambio.en = oficialEn;
    if (ruta && ruta.length > 0) {
      const completa = ruta.join(SEPARADOR_RUTA);
      if (completa !== actual.legalDescription) {
        cambio.legalDescription = completa;
        // Las palabras de busqueda salen de toda la ruta: «Los demás» no se
        // encuentra por texto si no lleva las palabras de lo que cuelga.
        cambio.keywords = palabrasClave([...ruta].reverse().join(' '), MAX_PALABRAS_CLAVE);
      }
    }
    if (Object.keys(cambio).length > 1) cambios.push(cambio);
  }
  return cambios;
}

const mismoImporte = (a, b) => {
  if (!a?.amount && !b?.amount) return true;
  if (!a?.amount || !b?.amount) return false;
  return Math.abs(Number(a.amount) - Number(b.amount)) < TOLERANCIA && unidadCanonica(a.unit) === unidadCanonica(b.unit);
};
const importe = (x) => (x?.amount ? { amount: x.amount, unit: x.unit } : null);

/** Lo que el catalogo guarda hoy de un codigo, en la misma forma que `camposDeDerecho`. */
const camposDelCatalogo = (duties) => {
  const sancion = duties?.sancionRusiaBielorrusia;
  return {
    thirdCountry: duties?.thirdCountry ?? null,
    specific: importe(duties?.specific),
    combinacion: duties?.combinacion || null,
    minimo: importe(duties?.minimo),
    maximo: importe(duties?.maximo),
    sancion: typeof sancion?.adValorem === 'number' ? { adValorem: sancion.adValorem, certificado: sancion.certificado } : null
  };
};

const coinciden = (mio, oficial) => typeof mio.thirdCountry === 'number' &&
  Math.abs(mio.thirdCountry - oficial.thirdCountry) < TOLERANCIA &&
  mismoImporte(mio.specific, oficial.specific) && mio.combinacion === oficial.combinacion &&
  mismoImporte(mio.minimo, oficial.minimo) && mismoImporte(mio.maximo, oficial.maximo) &&
  (!oficial.sancion || Math.abs((mio.sancion?.adValorem ?? -1) - oficial.sancion.adValorem) < TOLERANCIA);

/** Unidades guardadas de forma no canonica (EUR/tonne en vez de EUR/1000 kg). */
const unidadesAUnificar = (mio, oficial) => ['specific', 'minimo', 'maximo']
  .filter((campo) => mio[campo] && oficial[campo] && mio[campo].unit !== oficial[campo].unit)
  .map((campo) => ({ campo, unit: oficial[campo].unit }));

/**
 * Aranceles del catalogo a corregir o a marcar como contrastados.
 *
 * Actua cuando el derecho oficial es uno que LUCI sabe liquidar (porcentaje,
 * importe por unidad, suma de ambos, minimo y maximo, y la rama general de una
 * medida condicionada al certificado Y155). Un arancel que ya se contrasto a
 * mano contra el TARIC (`origen.fuente === 'taric_oficial'`) no se pisa: si no
 * coincide va a `conflictos`; si coincide y solo cambia como esta escrita la
 * unidad, a `unidades`.
 *
 * Se revisan los codigos declarables y, ademas, los no declarables que tienen
 * su propia medida en la fuente (su arancel se enseña en el arbol).
 *
 * Un derecho con variantes por codigo adicional que LUCI sabe liquidar va a
 * `variantes` (cada una con su codigo adicional y su descripcion oficial); una
 * suma con minimo o maximo que no cabe en los campos de siempre, a
 * `compuestos` con su formula. Los codigos cuyo derecho oficial no se sabe
 * liquidar van a `noCalculables` con el texto oficial y el dato que falta,
 * para que conste y se avise al calcular; los de los capitulos 98 y 99, a los
 * que el TARIC no asigna derecho, a `sinDerecho`.
 *
 * @param {object[]} catalogo
 * @param {Map} derechos `leerDerechosTercerosPaises`
 * @param {{ codigosAdicionales?: Map<string, string> }} [opciones] descripciones oficiales de los codigos adicionales
 * @returns {{ corregir, contrastar, conflictos, unidades, noCalculables, sinDerecho, variantes, compuestos }}
 */
function corregirAranceles(catalogo, derechos, opciones = {}) {
  const resultado = { corregir: [], contrastar: [], conflictos: [], unidades: [], noCalculables: [], sinDerecho: [], variantes: [], compuestos: [] };
  for (const actual of catalogo) {
    if (actual.isActive === false) continue;
    const oficial = arancelDe(actual.code, derechos);
    if (!actual.isLeaf && oficial.heredadoDe !== actual.code) continue;

    const fuente = actual.duties?.origen?.fuente;
    const yaContrastado = fuente === 'taric_oficial';

    if (oficial.estado === 'sin_medida') {
      if (actual.isLeaf && sinDerechoOficial(actual.code) && fuente !== 'sin_derecho_oficial') {
        resultado.sinDerecho.push({ code: actual.code });
      }
      continue;
    }
    if (oficial.estado !== 'ok') {
      const resuelto = resolverDerechoNoSimple(oficial, opciones);
      const base = { code: actual.code, texto: oficial.texto, heredadoDe: oficial.heredadoDe };
      if (resuelto.tipo === 'variantes') {
        const dato = { ...base, variantes: resuelto.variantes, antes: camposDelCatalogo(actual.duties) };
        const igual = claveVariantes(actual.duties?.variantes) === claveVariantes(resuelto.variantes);
        if (!(igual && yaContrastado)) (yaContrastado ? resultado.conflictos : resultado.variantes).push(dato);
      } else if (resuelto.tipo === 'compuesto') {
        const dato = { ...base, ...resuelto.campos, formula: resuelto.formula, antes: camposDelCatalogo(actual.duties) };
        const igual = actual.duties?.formula?.texto === resuelto.formula.texto;
        if (!(igual && yaContrastado)) (yaContrastado ? resultado.conflictos : resultado.compuestos).push(dato);
      } else if (!yaContrastado && !(fuente === 'no_calculable' && actual.duties?.origen?.evidencia === resuelto.evidencia)) {
        resultado.noCalculables.push({ ...base, motivo: oficial.estado, forma: resuelto.forma, faltan: resuelto.faltan, evidencia: resuelto.evidencia });
      }
      continue;
    }

    const nuevo = camposDeDerecho(oficial.derecho);
    const mio = camposDelCatalogo(actual.duties);
    const dato = {
      code: actual.code, ...nuevo, texto: oficial.texto, heredadoDe: oficial.heredadoDe, antes: mio,
      rotulo: oficial.rotulo, ...(oficial.soloDestinoFinal ? { soloDestinoFinal: true } : {})
    };

    if (coinciden(mio, nuevo) && !tieneVariantesOFormula(actual.duties)) {
      const unidades = unidadesAUnificar(mio, nuevo);
      if (!yaContrastado) resultado.contrastar.push(dato);
      else if (unidades.length > 0) resultado.unidades.push({ code: actual.code, unidades });
    } else if (yaContrastado) {
      resultado.conflictos.push(dato);
    } else {
      resultado.corregir.push(dato);
    }
  }
  return resultado;
}

/** Evidencia de un codigo al que el TARIC no asigna derecho de terceros paises. */
const evidenciaSinDerecho = (code, fuente) => `El TARIC no asigna derecho de terceros paises a este codigo (capitulo ${code.slice(0, 2)}). ${fuente}.`;

module.exports = {
  corregirDescripciones, corregirAranceles, resolverDerechoNoSimple, huella, evidenciaNoCalculable, evidenciaSinDerecho, sinDerechoOficial,
  SEPARADOR_RUTA, CAPITULOS_SIN_DERECHO
};
