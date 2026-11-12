/**
 * Publicaciones diarias del TARIC en el portal DDS2 de la Comision Europea:
 * lista de las ultimas y descarga del ZIP de una de ellas.
 */
const axios = require('axios');
const { unzipSync } = require('fflate');

const URL_LISTA = 'https://ec.europa.eu/taxation_customs/dds2/taric/daily_publications.jsp?Lang=en';
const URL_DESCARGA = 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_management.jsp';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 60000;

/** Publicaciones que aparecen en la pagina, de la mas reciente a la mas antigua. */
function leerLista(html) {
  const publicaciones = [];
  const patron = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s*<\/td>\s*<td[^>]*>\s*(TARIC_\d{8}_\d{4})\.zip/g;
  let m = patron.exec(String(html || ''));
  while (m) {
    if (!publicaciones.some((p) => p.nombre === m[2])) publicaciones.push({ nombre: m[2], fecha: m[1] });
    m = patron.exec(html);
  }
  return publicaciones.sort((a, b) => b.nombre.localeCompare(a.nombre));
}

async function listarPublicaciones({ cliente = axios } = {}) {
  const { data } = await cliente.get(URL_LISTA, { headers: { 'User-Agent': USER_AGENT }, timeout: TIMEOUT_MS, responseType: 'text' });
  const lista = leerLista(data);
  if (lista.length === 0) throw new Error('La página de publicaciones diarias del TARIC no trae ninguna');
  return lista;
}

/** Ficheros del ZIP que usa LUCI, como Buffer: nomenclatura y medidas. */
function leerZip(contenido) {
  const entradas = unzipSync(new Uint8Array(contenido), { filter: (f) => /^(Goods_Nomenclature|Measures)_.*\.xlsx$/i.test(f.name) });
  const buscar = (prefijo) => {
    const nombre = Object.keys(entradas).find((n) => n.toLowerCase().startsWith(prefijo));
    return nombre ? Buffer.from(entradas[nombre]) : null;
  };
  return { nomenclatura: buscar('goods_nomenclature_'), medidas: buscar('measures_') };
}

async function descargarPublicacion(publicacion, { cliente = axios } = {}) {
  const { data } = await cliente.get(URL_DESCARGA, {
    params: { publicationDate: publicacion.fecha, message: 'extract' },
    headers: { 'User-Agent': USER_AGENT }, timeout: TIMEOUT_MS, responseType: 'arraybuffer'
  });
  return leerZip(Buffer.from(data));
}

module.exports = { listarPublicaciones, descargarPublicacion, leerLista, leerZip };
