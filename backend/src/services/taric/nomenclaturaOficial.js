/**
 * Nomenclatura TARIC oficial a partir de los ficheros que publica la Comision
 * Europea en CIRCABC («TARIC and Quota Data & Information»).
 *
 * Cada linea de la nomenclatura es un codigo de 10 digitos mas un sufijo de
 * dos: el `80` es la linea que se declara y se consulta; los demas (`10`, `20`…)
 * son rotulos intermedios que solo agrupan. Aqui solo interesan las `80`.
 */
const SUFIJO_DECLARABLE = '80';
const CABECERA_NOMENCLATURA = ['Goods code', 'Start date', 'End date', 'Language', 'Hier. Pos.', 'Indent', 'Description', 'Descr. start date'];
const CABECERA_DECLARABLES = ['Goods code', 'Start date', 'Decl. start date', 'IS_LEAF', 'End date'];
const NIVELES = [2, 4, 6, 8, 10];

const SUPERINDICES = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', o: '°' };
const SUBINDICES = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };

/**
 * Texto de una descripcion oficial sin las marcas de composicion de los
 * ficheros del TARIC: `|` es un espacio de no separacion, `$3` un superindice
 * (cm$3 -> cm³), `@2` un subindice (Fe@2O@3 -> Fe₂O₃), `!x!` el signo de
 * multiplicar y `!o!` el de grado. Los saltos de linea se guardan como <br>,
 * que es como ya estan las descripciones cargadas del servicio web.
 */
function textoLegible(texto) {
  return String(texto || '')
    .replace(/!x!/g, '×').replace(/!o!/g, '°').replace(/![0-9]!/g, ' ')
    .replace(/\$(.)/g, (_, c) => SUPERINDICES[c] ?? c)
    .replace(/@(.)/g, (_, c) => SUBINDICES[c] ?? c)
    .replace(/\|/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\r?\n ?/g, '<br>')
    .replace(/(<br>)+$/g, '')
    .trim();
}

/** «01-07-2026» -> Date (mediodia UTC, para que no baile de dia con el huso). */
const fechaDe = (texto) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(texto || '').trim());
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12)) : null;
};

const exigirCabecera = (filas, esperada, nombre) => {
  const cabecera = (filas[0] || []).map((c) => String(c).trim());
  const falta = esperada.find((columna, i) => cabecera[i] !== columna);
  if (falta) {
    throw new Error(`${nombre}: el formato del fichero oficial ha cambiado (se esperaba la columna «${falta}»; llego: ${cabecera.join(' | ')})`);
  }
};

/** «0101210000 80» -> { codigo, sufijo }, o null si no tiene esa forma. */
const partirCodigo = (celda) => {
  const m = /^(\d{10})\s+(\d{2})$/.exec(String(celda || '').trim());
  return m ? { codigo: m[1], sufijo: m[2] } : null;
};

/**
 * Lineas declarables (`80`) de un fichero «Nomenclature XX.xlsx».
 *
 * @param {string[][]} filas hoja leida con `leerPrimeraHoja`
 * @returns {Map<string, { nivel: number, descripcion: string, idioma: string, validoDesde: Date|null, validoHasta: Date|null }>}
 */
function leerNomenclatura(filas) {
  exigirCabecera(filas, CABECERA_NOMENCLATURA, 'Nomenclatura');
  const lineas = new Map();
  for (const fila of filas.slice(1)) {
    const partes = partirCodigo(fila[0]);
    if (!partes || partes.sufijo !== SUFIJO_DECLARABLE) continue;
    const nivel = Number(fila[4]);
    if (!NIVELES.includes(nivel)) continue;
    lineas.set(partes.codigo, {
      nivel,
      descripcion: textoLegible(fila[6]),
      idioma: String(fila[3] || '').trim().toLowerCase(),
      validoDesde: fechaDe(fila[1]),
      validoHasta: fechaDe(fila[2])
    });
  }
  if (lineas.size === 0) throw new Error('Nomenclatura: el fichero oficial no trae ninguna linea declarable');
  return lineas;
}

/**
 * Codigos que se pueden declarar (hojas del arbol) segun «Declarable codes.xlsx».
 *
 * @param {string[][]} filas
 * @returns {Set<string>}
 */
function leerDeclarables(filas) {
  exigirCabecera(filas, CABECERA_DECLARABLES, 'Codigos declarables');
  const declarables = new Set();
  for (const fila of filas.slice(1)) {
    const partes = partirCodigo(fila[0]);
    if (partes && partes.sufijo === SUFIJO_DECLARABLE && String(fila[3]).trim() === '1') declarables.add(partes.codigo);
  }
  if (declarables.size === 0) throw new Error('Codigos declarables: el fichero oficial no marca ningun codigo como declarable');
  return declarables;
}

/**
 * Ruta de cada codigo en el arbol de la nomenclatura: las descripciones de
 * todos sus ascendientes, incluidos los rotulos intermedios (sufijo distinto de
 * 80), y la suya. «Los demás» no dice nada por si solo; con la ruta se sabe de
 * que son los demas.
 *
 * El fichero viene ordenado y cada linea trae su sangria («- - »): una linea
 * cuelga de la ultima anterior con menos sangria.
 *
 * @param {string[][]} filas
 * @returns {Map<string, string[]>} codigo -> [descripcion del capitulo, …, descripcion propia]
 */
function leerRutas(filas) {
  exigirCabecera(filas, CABECERA_NOMENCLATURA, 'Nomenclatura');
  const rutas = new Map();
  const pila = [];
  for (const fila of filas.slice(1)) {
    const partes = partirCodigo(fila[0]);
    if (!partes) continue;
    const nivel = Number(fila[4]);
    const guiones = (String(fila[5] || '').match(/-/g) || []).length;
    // Capitulo: 0; partida: 1; el resto, segun su sangria.
    const profundidad = nivel === 2 ? 0 : nivel === 4 ? 1 : 1 + Math.max(1, guiones);
    while (pila.length > 0 && pila[pila.length - 1].profundidad >= profundidad) pila.pop();
    pila.push({ profundidad, descripcion: textoLegible(fila[6]) });
    if (partes.sufijo === SUFIJO_DECLARABLE) rutas.set(partes.codigo, pila.map((p) => p.descripcion));
  }
  return rutas;
}

module.exports = { leerNomenclatura, leerDeclarables, leerRutas, textoLegible, fechaDe, SUFIJO_DECLARABLE };
