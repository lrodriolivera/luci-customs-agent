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
      descripcion: String(fila[6] || '').trim(),
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

module.exports = { leerNomenclatura, leerDeclarables, fechaDe, SUFIJO_DECLARABLE };
