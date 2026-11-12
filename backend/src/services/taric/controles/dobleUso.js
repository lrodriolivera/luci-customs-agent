/**
 * Correlacion entre codigos TARIC y la lista de productos de doble uso
 * (Reglamento (UE) 2021/821), de la tabla que publica la Comision Europea.
 *
 * Es orientativa: que un codigo figure no significa que la mercancia sea de
 * doble uso, sino que puede serlo segun sus caracteristicas tecnicas. El
 * control es sobre todo de exportacion.
 */
const { prefijoDe, prefijosDe } = require('./medidasControl');

/**
 * Lee la tabla (columnas: codigo, nota TARIC «DUnnn», categoria de doble uso).
 * @returns {Object<string, Array<{ categoria: string, nota: string }>>} por prefijo del codigo
 */
function leerDobleUso(filas) {
  const tabla = {};
  for (const fila of (filas || []).slice(1)) {
    const codigo = String(fila[0] || '').replace(/\D/g, '');
    const nota = String(fila[1] || '').trim();
    const categoria = String(fila[2] || '').trim();
    if (codigo.length !== 10 || !categoria) continue;
    const prefijo = prefijoDe(codigo);
    const entradas = (tabla[prefijo] = tabla[prefijo] || []);
    if (!entradas.some((e) => e.categoria === categoria)) entradas.push({ categoria, nota });
  }
  if (Object.keys(tabla).length === 0) throw new Error('La tabla de doble uso no tiene el formato esperado');
  return tabla;
}

/** Categorias de doble uso que alcanzan a un codigo (el suyo y sus niveles superiores). */
function dobleUsoPara(codigo, tabla) {
  const vistas = new Set();
  return prefijosDe(codigo).flatMap((p) => tabla[p] || []).filter((e) => {
    if (vistas.has(e.categoria)) return false;
    vistas.add(e.categoria);
    return true;
  });
}

module.exports = { leerDobleUso, dobleUsoPara };
