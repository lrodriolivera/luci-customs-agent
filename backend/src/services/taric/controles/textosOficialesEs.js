/**
 * Textos oficiales en espanol que acompanan a las medidas de control:
 *
 * - Encabezado de cada articulo del anexo I del Reglamento (UE) 2021/821
 *   (productos de doble uso), de la version consolidada en espanol que publica
 *   la Oficina de Publicaciones de la UE (Cellar).
 * - Nombre de cada pais o grupo de paises del TARIC, del fichero oficial
 *   «Geographical areas description.xlsx» de la Comision Europea (CIRCABC).
 *
 * Los textos se copian tal cual, sin reescribirlos. Se guardan como datos
 * versionados en src/data/taric (los genera src/scripts/extraerTextosOficialesTaric.js)
 * y se leen al responder: no se escribe nada en la base de datos.
 */
const path = require('path');

const DIRECTORIO_DATOS = path.join(__dirname, '../../../data/taric');
const FICHERO_DOBLE_USO = 'dobleUsoAnexoI.es.json';
const FICHERO_AREAS = 'areasGeograficas.es.json';

// Codigo de un articulo del anexo I: categoria (0-9), subcategoria (A-E) y numero.
const ARTICULO = /^([0-9][A-E][0-9]{3})(?![0-9])/;

/** Texto plano de un fragmento XHTML: sin etiquetas, con entidades y espacios normalizados. */
function textoPlano(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parte del documento entre el titulo «ANEXO I» y el siguiente anexo. */
function cuerpoDelAnexoI(html) {
  const inicio = html.search(/<p class="title-annex-1"[^>]*>\s*ANEXO I\s*<\/p>/);
  if (inicio < 0) throw new Error('El documento no contiene el anexo I');
  const resto = html.slice(inicio + 1);
  const fin = resto.search(/<p class="title-annex-1"[^>]*>/);
  return fin < 0 ? resto : resto.slice(0, fin);
}

/**
 * Encabezado de cada articulo del anexo I, en los dos formatos del documento:
 * «<p class="norm">5A002<span> </span>Texto</p>» y, en las listas,
 * «<div class="list grid-list-column-1"><span>1C225 </span></div><div class="grid-list-column-2"><p class="norm">Texto</p>».
 *
 * @param {string} html  version consolidada en XHTML
 * @returns {Object<string, string>} { articulo: encabezado }
 */
function leerAnexoIDobleUso(html) {
  const anexo = cuerpoDelAnexoI(String(html || ''));
  const categorias = {};
  const anotar = (codigo, texto) => {
    if (!categorias[codigo] && texto) categorias[codigo] = texto;
  };
  // Las posiciones permiten conservar el orden del documento al mezclar formatos.
  const hallados = [];
  const parrafo = /<p class="norm">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = parrafo.exec(anexo))) {
    const texto = textoPlano(m[1]);
    const k = /^([0-9][A-E][0-9]{3})\s+(\S[\s\S]*)$/.exec(texto);
    if (k) hallados.push([m.index, k[1], k[2]]);
  }
  const lista = /<div class="list grid-list-column-1">\s*<span>\s*([0-9][A-E][0-9]{3})\s*<\/span>\s*<\/div>\s*<div class="grid-list-column-2">\s*<p class="norm">([\s\S]*?)<\/p>/g;
  while ((m = lista.exec(anexo))) hallados.push([m.index, m[1], textoPlano(m[2])]);
  hallados.sort((a, b) => a[0] - b[0]).forEach(([, codigo, texto]) => anotar(codigo, texto));
  if (Object.keys(categorias).length === 0) throw new Error('No se ha encontrado ningún artículo en el anexo I');
  return categorias;
}

/** «02021R0821 — ES — 21.09.2026 — 008.001» de la cabecera del consolidado. */
function referenciaDeConsolidado(html) {
  const m = /<p class="reference">\s*([0-9A-Z]+)\s*—\s*([A-Z]{2})\s*—\s*(\d{2})\.(\d{2})\.(\d{4})\s*—\s*([\d.]+)\s*<\/p>/.exec(String(html || ''));
  if (!m) return null;
  return { celex: m[1], idioma: m[2], fecha: `${m[5]}-${m[4]}-${m[3]}`, version: m[6] };
}

/** Articulo del anexo I de una categoria de la tabla de correlacion («0A001a» -> «0A001»). */
function articuloDeCategoria(categoria) {
  const m = ARTICULO.exec(String(categoria || '').trim());
  return m ? m[1] : null;
}

/** «01-05-2021» -> «20210501». */
const fechaOrdenable = (texto) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(texto || '').trim());
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
};

/**
 * { codigo: nombre en espanol } de «Geographical areas description.xlsx»: de
 * cada codigo, la descripcion en espanol mas reciente que ya este en vigor.
 */
function leerAreasEnEspanol(filas, { fecha = new Date() } = {}) {
  const cabecera = (filas?.[0] || []).map((c) => String(c).trim());
  const k = {
    codigo: cabecera.indexOf('Or./Dest.'), idioma: cabecera.indexOf('Language'),
    texto: cabecera.indexOf('Description'), desde: cabecera.indexOf('Descr. start date')
  };
  if (Object.values(k).some((i) => i < 0)) throw new Error('El fichero de áreas geográficas no tiene las columnas esperadas');
  const hoy = fecha.toISOString().slice(0, 10).replace(/-/g, '');
  const elegidas = {};
  for (const fila of filas.slice(1)) {
    if (String(fila[k.idioma] || '').trim() !== 'ES') continue;
    const codigo = String(fila[k.codigo] || '').trim();
    const texto = String(fila[k.texto] || '').replace(/\s+/g, ' ').trim();
    const desde = fechaOrdenable(fila[k.desde]);
    if (!codigo || !texto || (desde && desde > hoy)) continue;
    if (!elegidas[codigo] || desde > elegidas[codigo].desde) elegidas[codigo] = { texto, desde };
  }
  return Object.fromEntries(Object.entries(elegidas).map(([c, v]) => [c, v.texto]));
}

const cache = {};
function leerDatos(fichero) {
  if (!cache[fichero]) cache[fichero] = require(path.join(DIRECTORIO_DATOS, fichero));
  return cache[fichero];
}

/** Datos versionados del anexo I: { fuente, categorias }. */
const textosDobleUso = () => leerDatos(FICHERO_DOBLE_USO);
/** Datos versionados de paises y grupos: { fuente, areas }. */
const nombresDeAreas = () => leerDatos(FICHERO_AREAS);

/** Encabezado oficial en espanol del articulo de una categoria de doble uso, o null. */
function descripcionDeCategoria(categoria, datos = textosDobleUso()) {
  const articulo = articuloDeCategoria(categoria);
  return (articulo && datos?.categorias?.[articulo]) || null;
}

/** Nombre en espanol del pais o grupo de origen de una medida; si no lo hay, el original. */
function nombreDeOrigen(codigo, nombreOriginal, datos = nombresDeAreas()) {
  return datos?.areas?.[String(codigo || '').trim()] || nombreOriginal || null;
}

module.exports = {
  leerAnexoIDobleUso, referenciaDeConsolidado, articuloDeCategoria, leerAreasEnEspanol,
  textosDobleUso, nombresDeAreas, descripcionDeCategoria, nombreDeOrigen,
  DIRECTORIO_DATOS, FICHERO_DOBLE_USO, FICHERO_AREAS
};
