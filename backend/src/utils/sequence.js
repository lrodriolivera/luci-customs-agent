/**
 * Generacion de referencias secuenciales.
 *
 * Sustituye al patron `countDocuments(...) + 1` que llevaban 8 modelos. Ese
 * patron falla de dos maneras, ambas vistas ya en la base viva:
 *
 *   - Al borrar un documento el conteo retrocede y la siguiente alta reutiliza
 *     una referencia que sigue existiendo -> E11000 duplicate key.
 *   - Dos altas simultaneas leen el mismo conteo y piden el mismo numero.
 *
 * `findOneAndUpdate` con `$inc` y `upsert` es una sola operacion atomica en el
 * servidor: nunca reparte el mismo numero dos veces y nunca retrocede.
 *
 * Para las bases que ya tienen referencias sembradas por el generador antiguo,
 * `nextReference` siembra el contador la primera vez con el maximo existente
 * para ese prefijo, de modo que continua en lugar de pisar lo que hay.
 */
const Counter = require('../models/Counter');

/**
 * Reserva el siguiente numero de una secuencia.
 *
 * @param {string} key - Identificador de la secuencia.
 * @param {{seed?: () => Promise<number>|number}} [options] - `seed` se invoca
 *   solo cuando el contador aun no existe, para arrancar por encima de lo ya
 *   sembrado. Si falla, se arranca de cero: mas vale una referencia posible que
 *   un alta bloqueada.
 * @returns {Promise<number>}
 */
async function nextSequence(key, options = {}) {
  const existente = await Counter.findById(key).lean();

  if (!existente && typeof options.seed === 'function') {
    let inicio = 0;
    try {
      inicio = Number(await options.seed()) || 0;
    } catch (e) {
      inicio = 0;
    }
    // upsert con $setOnInsert: si otro proceso lo creo entre medias, gana el suyo.
    await Counter.updateOne({ _id: key }, { $setOnInsert: { seq: inicio } }, { upsert: true });
  }

  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return doc.seq;
}

/** Escapa un prefijo para meterlo en una expresion regular sin sorpresas. */
function _escapar(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mayor numero ya usado con este prefijo en la coleccion. Solo se consulta una
 * vez por prefijo (al sembrar el contador).
 */
async function _maximoExistente(Model, field, prefix) {
  const docs = await Model.find(
    { [field]: { $regex: `^${_escapar(prefix)}-\\d+$` } },
    { [field]: 1 }
  ).lean();

  return docs.reduce((max, d) => {
    const n = parseInt(String(d[field]).slice(prefix.length + 1), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

/**
 * Siguiente referencia con la forma `<prefix>-<numero>`.
 *
 * @param {import('mongoose').Model} Model - Modelo donde vive la referencia.
 * @param {string} field - Campo que la almacena (`reference`, `mrn`, ...).
 * @param {string} prefix - Todo lo que precede al numero, sin el guion final.
 * @param {number} [width=6] - Ancho minimo del numero. No trunca si se pasa.
 * @returns {Promise<string>}
 */
async function nextReference(Model, field, prefix, width = 6) {
  const key = `${Model.modelName}:${field}:${prefix}`;
  const seq = await nextSequence(key, { seed: () => _maximoExistente(Model, field, prefix) });
  return `${prefix}-${String(seq).padStart(width, '0')}`;
}

module.exports = { nextSequence, nextReference };
