/**
 * Lector minimo de ficheros .xlsx: solo lo que hace falta para las hojas de
 * datos del TARIC que publica la Comision Europea (una hoja, celdas de texto).
 *
 * Un .xlsx es un ZIP con XML dentro. Se descomprime con fflate y se leen las
 * celdas con expresiones regulares: los ficheros llegan a 25.000 filas y un
 * parser DOM completo no aporta nada aqui. No interpreta formulas, estilos ni
 * fechas de Excel (los ficheros del TARIC traen las fechas como texto).
 */
const { unzipSync, strFromU8 } = require('fflate');

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desescapar = (texto) => texto.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e) => {
  if (e[0] !== '#') return ENTIDADES[e];
  const codigo = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : '';
});

/** Texto de un nodo <si> o <is>: la suma de sus <t> (puede venir en varios tramos). */
const textoDe = (xml) => {
  let salida = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) salida += m[1];
  return desescapar(salida);
};

/** Indice de columna (0 = A) de una referencia de celda como «AB12». */
const columnaDe = (referencia) => {
  let n = 0;
  for (let i = 0; i < referencia.length; i++) {
    const c = referencia.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
};

/**
 * Filas de la primera hoja de un .xlsx, como matrices de cadenas.
 *
 * @param {Buffer|Uint8Array} contenido bytes del fichero
 * @returns {string[][]}
 */
function leerPrimeraHoja(contenido) {
  const entradas = unzipSync(new Uint8Array(contenido), {
    filter: (f) => f.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name)
  });
  const hoja = Object.keys(entradas).filter((n) => n.startsWith('xl/worksheets/')).sort()[0];
  if (!hoja) throw new Error('El fichero no contiene ninguna hoja de datos');

  const compartidas = [];
  if (entradas['xl/sharedStrings.xml']) {
    const xml = strFromU8(entradas['xl/sharedStrings.xml']);
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = re.exec(xml)) !== null) compartidas.push(textoDe(m[1]));
  }

  const filas = [];
  const xml = strFromU8(entradas[hoja]);
  const reFila = /<row[^>]*>([\s\S]*?)<\/row>/g;
  const reCelda = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let f;
  while ((f = reFila.exec(xml)) !== null) {
    const fila = [];
    let c;
    reCelda.lastIndex = 0;
    while ((c = reCelda.exec(f[1])) !== null) {
      const referencia = (/\br="([A-Z]+)\d+"/.exec(c[1]) || [])[1];
      if (!referencia) continue;
      const tipo = (/\bt="([^"]+)"/.exec(c[1]) || [])[1];
      const cuerpo = c[2] || '';
      const v = (/<v>([\s\S]*?)<\/v>/.exec(cuerpo) || [])[1];
      let valor = '';
      if (tipo === 's') valor = v !== undefined ? (compartidas[Number(v)] ?? '') : '';
      else if (tipo === 'inlineStr') valor = textoDe(cuerpo);
      else if (v !== undefined) valor = desescapar(v);
      const i = columnaDe(referencia);
      while (fila.length < i) fila.push('');
      fila[i] = valor;
    }
    filas.push(fila);
  }
  return filas;
}

module.exports = { leerPrimeraHoja };
