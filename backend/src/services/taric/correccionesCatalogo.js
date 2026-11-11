/**
 * Correcciones de los codigos que el catalogo YA tiene, contra la fuente
 * oficial: descripciones y arancel de terceros paises. Funciones puras.
 *
 * Medido el 11/Nov/2026: 15.066 de 21.946 descripciones en español no eran las
 * oficiales (el catalogo se cargo con textos traducidos, y varios niveles
 * llevaban la descripcion de su partida en vez de la suya), y 167 aranceles no
 * coincidian con el derecho de terceros paises oficial.
 */
const { arancelDe } = require('./arancelesOficiales');
const { palabrasClave } = require('./planSincronizacion');

const SEPARADOR_RUTA = ' > ';
const MAX_PALABRAS_CLAVE = 25;
const TOLERANCIA = 0.005;

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

// «EUR/100 kg», «EUR/100kg» y «EUR / 100 KG» son la misma unidad.
const unidad = (u) => String(u || '').toLowerCase().replace(/\s+/g, '');
const mismoEspecifico = (a, b) => Boolean(a?.amount) === Boolean(b?.amount) &&
  (!b?.amount || (Math.abs(Number(a.amount) - b.amount) < TOLERANCIA && unidad(a.unit) === unidad(b.unit)));

/**
 * Aranceles del catalogo a corregir o a marcar como contrastados.
 *
 * Solo actua cuando el oficial es simple (un porcentaje o un importe por
 * unidad). Un arancel que ya se contrasto a mano contra el TARIC
 * (`origen.fuente === 'taric_oficial'`) no se pisa: si no coincide, se
 * devuelve en `conflictos` para revisarlo.
 *
 * @returns {{ corregir: object[], contrastar: object[], conflictos: object[] }}
 */
function corregirAranceles(catalogo, derechos) {
  const resultado = { corregir: [], contrastar: [], conflictos: [] };
  for (const actual of catalogo) {
    if (!actual.isLeaf || actual.isActive === false) continue;
    const oficial = arancelDe(actual.code, derechos);
    if (oficial.estado !== 'ok') continue;

    const adValorem = oficial.derecho.tipo === 'ad_valorem' ? oficial.derecho.adValorem : 0;
    const especifico = oficial.derecho.tipo === 'especifico' ? oficial.derecho.specific : null;
    const mio = actual.duties?.thirdCountry;
    const coincide = typeof mio === 'number' && Math.abs(mio - adValorem) < TOLERANCIA && mismoEspecifico(actual.duties?.specific, especifico);
    const yaContrastado = actual.duties?.origen?.fuente === 'taric_oficial';
    const dato = {
      code: actual.code, thirdCountry: adValorem, specific: especifico, texto: oficial.texto, heredadoDe: oficial.heredadoDe,
      antes: { thirdCountry: mio ?? null, specific: actual.duties?.specific?.amount ? { amount: actual.duties.specific.amount, unit: actual.duties.specific.unit } : null }
    };

    if (coincide) {
      if (!yaContrastado) resultado.contrastar.push(dato);
    } else if (yaContrastado) {
      resultado.conflictos.push(dato);
    } else {
      resultado.corregir.push(dato);
    }
  }
  return resultado;
}

module.exports = { corregirDescripciones, corregirAranceles, huella, SEPARADOR_RUTA };
