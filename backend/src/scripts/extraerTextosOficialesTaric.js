/**
 * Genera los datos versionados con los textos oficiales en espanol que se
 * muestran junto a las medidas de control del TARIC:
 *
 * - src/data/taric/dobleUsoAnexoI.es.json: encabezado de cada articulo del
 *   anexo I del Reglamento (UE) 2021/821, de la version consolidada mas
 *   reciente en espanol (Oficina de Publicaciones de la UE, Cellar).
 * - src/data/taric/areasGeograficas.es.json: nombre en espanol de cada pais y
 *   grupo de paises del TARIC («Geographical areas description.xlsx» del mes
 *   mas reciente en CIRCABC).
 *
 * No toca la base de datos. Por defecto es una SIMULACION: descarga, extrae y
 * dice que escribiria. Con --escribir guarda los JSON en el repositorio.
 *
 * Ejecutar:  node src/scripts/extraerTextosOficialesTaric.js
 *            node src/scripts/extraerTextosOficialesTaric.js --escribir
 *            node src/scripts/extraerTextosOficialesTaric.js --html=/ruta/consolidado.html   (sin descargar el consolidado)
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const circabc = require('../services/taric/circabcTaric');
const { leerPrimeraHoja } = require('../services/taric/xlsxSimple');
const {
  leerAnexoIDobleUso, referenciaDeConsolidado, leerAreasEnEspanol, DIRECTORIO_DATOS, FICHERO_DOBLE_USO, FICHERO_AREAS
} = require('../services/taric/controles/textosOficialesEs');

const SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql';
const CELEX_BASE = 'https://publications.europa.eu/resource/celex/';
const FICHERO_GEO = 'geographical areas description.xlsx';

const opcion = (nombre) => {
  const a = process.argv.slice(2).find((x) => x === `--${nombre}` || x.startsWith(`--${nombre}=`));
  if (!a) return null;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

/** CELEX de la version consolidada mas reciente del Reglamento (UE) 2021/821. */
async function consolidadoMasReciente() {
  const consulta = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex WHERE { ?w cdm:resource_legal_id_celex ?celex . FILTER(STRSTARTS(STR(?celex), "02021R0821-")) } ORDER BY DESC(?celex) LIMIT 1`;
  const r = await axios.get(SPARQL, { params: { query: consulta }, headers: { Accept: 'application/sparql-results+json' }, timeout: 60000 });
  const celex = r.data?.results?.bindings?.[0]?.celex?.value;
  if (!celex) throw new Error('Cellar no devuelve ninguna versión consolidada del 32021R0821');
  return celex;
}

async function descargarConsolidado(celex) {
  const r = await axios.get(`${CELEX_BASE}${celex}`, {
    headers: { Accept: 'application/xhtml+xml', 'Accept-Language': 'spa' }, responseType: 'text', timeout: 120000, maxRedirects: 10
  });
  return String(r.data);
}

/** Fichero de descripciones de areas del mes mas reciente que lo tenga. */
async function ficheroDeAreas() {
  for (const mes of await circabc.mesesPublicados()) {
    const fichero = (await circabc.hijos(mes.id)).find((f) => !f.carpeta && f.name.toLowerCase() === FICHERO_GEO);
    if (fichero) {
      return { mes: `${mes.anio}-${String(mes.mes).padStart(2, '0')}`, id: fichero.id, nombre: fichero.name, contenido: await circabc.descargar(fichero.id) };
    }
  }
  throw new Error('CIRCABC: ningún mes tiene «Geographical areas description.xlsx»');
}

async function main() {
  const ahora = new Date();
  const celex = opcion('html') ? null : await consolidadoMasReciente();
  const html = opcion('html') ? fs.readFileSync(String(opcion('html')), 'utf8') : await descargarConsolidado(celex);
  const referencia = referenciaDeConsolidado(html);
  if (!referencia || referencia.idioma !== 'ES' || referencia.celex !== '02021R0821') {
    throw new Error(`El documento descargado no es la versión consolidada en español del 32021R0821 (${JSON.stringify(referencia)})`);
  }
  const categorias = leerAnexoIDobleUso(html);
  const dobleUso = {
    fuente: {
      nombre: 'Reglamento (UE) 2021/821, anexo I (lista de productos de doble uso), versión consolidada en español',
      editor: 'Oficina de Publicaciones de la Unión Europea (Cellar)',
      ...referencia,
      enlace: `${CELEX_BASE}${referencia.celex}-${referencia.fecha.replace(/-/g, '')}`,
      aviso: 'Texto consolidado: instrumento de documentación sin efecto jurídico; solo el Diario Oficial de la UE es auténtico. Reutilización autorizada citando la fuente (Decisión 2011/833/UE).',
      extraido: ahora.toISOString().slice(0, 10)
    },
    categorias
  };

  const geo = await ficheroDeAreas();
  const areas = leerAreasEnEspanol(leerPrimeraHoja(geo.contenido), { fecha: ahora });
  const nombres = {
    fuente: {
      nombre: 'TARIC - descripciones de áreas geográficas (español)',
      editor: 'Comisión Europea, DG TAXUD (CIRCABC, «TARIC data»)',
      fichero: geo.nombre,
      mes: geo.mes,
      enlace: `https://circabc.europa.eu/rest/download/${geo.id}`,
      extraido: ahora.toISOString().slice(0, 10)
    },
    areas
  };

  console.log(`Doble uso: ${referencia.celex} ES ${referencia.fecha} (${referencia.version}), ${Object.keys(categorias).length} artículos del anexo I`);
  console.log(`Áreas geográficas: ${geo.nombre} de ${geo.mes}, ${Object.keys(areas).length} códigos con nombre en español`);
  if (!opcion('escribir')) {
    console.log('SIMULACION: nada se ha escrito. Repite con --escribir para guardar los JSON.');
    return;
  }
  fs.mkdirSync(DIRECTORIO_DATOS, { recursive: true });
  fs.writeFileSync(path.join(DIRECTORIO_DATOS, FICHERO_DOBLE_USO), `${JSON.stringify(dobleUso, null, 2)}\n`);
  fs.writeFileSync(path.join(DIRECTORIO_DATOS, FICHERO_AREAS), `${JSON.stringify(nombres, null, 2)}\n`);
  console.log(`Escritos ${FICHERO_DOBLE_USO} y ${FICHERO_AREAS} en ${DIRECTORIO_DATOS}`);
}

main().catch((error) => { console.error('ERROR:', error.message); process.exit(1); });
