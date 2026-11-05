/**
 * Espera acotada para efectos "fire-and-forget".
 *
 * Algunos middlewares lanzan una escritura a Mongo sin await a propósito. Un solo
 * `setImmediate` no garantiza que la escritura haya llegado: en un runner lento o con
 * workers en paralelo el test lee el valor antiguo y falla de forma intermitente.
 * Este helper sondea la lectura cada `intervalMs` hasta ver el valor esperado o agotar
 * `timeoutMs`, y en ese caso lanza un error que dice qué se esperaba y qué se vio.
 */

const TIMEOUT_MS = 2000;
const INTERVAL_MS = 50;

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {() => Promise<unknown> | unknown} leer lectura que se repite en cada sondeo
 * @param {unknown} esperado valor que se espera ver (comparado con ===)
 * @param {{ timeoutMs?: number, intervalMs?: number, descripcion?: string }} [opciones]
 * @returns {Promise<unknown>} el valor leído, igual a `esperado`
 */
async function esperarHasta(leer, esperado, opciones = {}) {
  const { timeoutMs = TIMEOUT_MS, intervalMs = INTERVAL_MS, descripcion = 'el valor' } = opciones;
  const inicio = Date.now();

  for (;;) {
    const valor = await leer();
    if (valor === esperado) return valor;

    if (Date.now() - inicio >= timeoutMs) {
      throw new Error(
        `Tiempo agotado (${timeoutMs} ms) esperando ${descripcion}: esperado ${esperado}, último valor ${valor}`
      );
    }
    await dormir(intervalMs);
  }
}

module.exports = { esperarHasta };
