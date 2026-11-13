/**
 * Descripcion oficial de los codigos adicionales TARIC, del fichero
 * «Additional codes descriptions.xlsx» que la Comision publica cada mes en
 * CIRCABC. Hace falta para que el derecho que depende del codigo adicional
 * (2500 «sustancias farmaceuticas» 0 % / 2501 «Las demas» 5,5 %…) se pueda
 * elegir por su nombre oficial y no por un numero.
 */
const { fechaDe } = require('./nomenclaturaOficial');

const CABECERA = ['Add code', 'Language', 'Description', 'Start date', 'Descr. start date', 'End date'];
const IDIOMAS = ['ES', 'EN'];

/**
 * @param {string[][]} filas hoja leida con `leerPrimeraHoja`
 * @param {{ fecha?: Date }} [opciones]
 * @returns {Map<string, string>} codigo adicional -> descripcion (español; si no hay, ingles)
 */
function leerDescripcionesCodigosAdicionales(filas, { fecha = new Date() } = {}) {
  const cabecera = (filas[0] || []).map((c) => String(c).trim());
  const falta = CABECERA.find((columna, i) => cabecera[i] !== columna);
  if (falta) throw new Error(`Codigos adicionales: el formato del fichero oficial ha cambiado (se esperaba la columna «${falta}»)`);

  // codigo -> idioma -> { desde, descripcion } (la descripcion vigente mas reciente)
  const mejor = new Map();
  for (const fila of filas.slice(1)) {
    const codigo = String(fila[0] || '').trim();
    const idioma = String(fila[1] || '').trim().toUpperCase();
    if (!codigo || !IDIOMAS.includes(idioma)) continue;
    const alta = fechaDe(fila[3]);
    const desde = fechaDe(fila[4]) || alta;
    const baja = fechaDe(fila[5]);
    if ((alta && alta > fecha) || (desde && desde > fecha) || (baja && baja < fecha)) continue;
    const porIdioma = mejor.get(codigo) || {};
    const actual = porIdioma[idioma];
    if (!actual || (desde && (!actual.desde || desde >= actual.desde))) {
      mejor.set(codigo, { ...porIdioma, [idioma]: { desde, descripcion: String(fila[2] || '').trim().replace(/\s+/g, ' ') } });
    }
  }
  const resultado = new Map();
  for (const [codigo, porIdioma] of mejor) {
    const elegida = IDIOMAS.map((i) => porIdioma[i]).find((d) => d && d.descripcion);
    if (elegida) resultado.set(codigo, elegida.descripcion);
  }
  return resultado;
}

module.exports = { leerDescripcionesCodigosAdicionales };
