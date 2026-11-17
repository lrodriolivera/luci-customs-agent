/**
 * Descripcion completa de un codigo TARIC a partir de su ruta oficial
 * (`legalDescription`: «Capitulo > Partida > … > Las demás»).
 *
 * Jenifer (UAT 17/11/2026): «Buscar código» con 0809290000 decia solo «Las
 * demás», que no dice que mercancia es. Si el ultimo nivel es generico, se le
 * anteponen los niveles anteriores hasta el primero que nombra la mercancia:
 * «Cerezas › Las demás».
 */
const SEPARADOR_RUTA = ' > ';
const SEPARADOR = ' › ';
// Textos de nivel que no dicen que mercancia es.
const GENERICO = /^(?:[-–—\s]*)(?:los|las)\s+dem[aá]s|^(?:[-–—\s]*)otr[oa]s?\b|^(?:[-–—\s]*)de\s+las?\s+dem[aá]s\s+materias/i;

const limpiar = (t) => String(t || '').replace(/^[\s\-–—]+/, '').replace(/[:\s]+$/, '').trim();

/**
 * Niveles de la ruta oficial, sin el capitulo (el primero).
 * @param {string} legalDescription
 * @returns {string[]}
 */
function rutaDe(legalDescription) {
  const niveles = String(legalDescription || '').split(SEPARADOR_RUTA).map(limpiar).filter(Boolean);
  return niveles.slice(1);
}

/**
 * @param {string} legalDescription
 * @param {string} [respaldo] - descripcion del codigo si no hay ruta
 * @returns {string}
 */
function descripcionCompleta(legalDescription, respaldo = '') {
  const ruta = rutaDe(legalDescription);
  if (ruta.length === 0) return limpiar(respaldo);
  let inicio = ruta.length - 1;
  while (inicio > 0 && GENERICO.test(ruta[inicio])) inicio -= 1;
  return ruta.slice(inicio).join(SEPARADOR);
}

module.exports = { rutaDe, descripcionCompleta };
