/**
 * Candado simple en Mongo para tareas periódicas con varias réplicas.
 *
 * El proyecto no tiene bloqueo distribuido en Redis (Redis es opcional y el
 * seguimiento cae a memoria si no está), así que el candado vive en Mongo, que
 * sí es obligatorio. Es atómico: un findOneAndUpdate con upsert sobre el _id
 * (nombre de la tarea) que solo casa si el candado está caducado; si otra
 * réplica lo tiene, el upsert choca con el _id existente (E11000) y se
 * devuelve false.
 *
 * No se libera al terminar bien: dura `duracionMs` y así marca «ya se hizo la
 * pasada de este intervalo» para todas las réplicas. Si la tarea falla, quien
 * lo tiene lo suelta (liberarCandado) para que otra réplica reintente.
 * La hora es la de la réplica: con relojes desincronizados el candado puede
 * durar algo más o menos; por eso dura un 10 % menos que el intervalo.
 */
const os = require('os');
const JobLock = require('../models/JobLock');

const DUENO_POR_DEFECTO = `${os.hostname()}:${process.pid}`;

/**
 * @param {string} nombre  tarea
 * @param {{ duracionMs: number, ahora?: Date, dueno?: string }} opciones
 * @returns {Promise<boolean>} true si esta réplica tiene el candado
 */
async function adquirirCandado(nombre, { duracionMs, ahora = new Date(), dueno = DUENO_POR_DEFECTO } = {}) {
  if (!Number.isFinite(duracionMs) || duracionMs <= 0) {
    throw new Error('candadoMongo: la duración del candado debe ser positiva');
  }
  try {
    await JobLock.findOneAndUpdate(
      { _id: nombre, lockedUntil: { $lte: ahora } },
      { $set: { lockedUntil: new Date(ahora.getTime() + duracionMs), dueno, adquiridoEn: ahora } },
      { upsert: true, new: true }
    );
    return true;
  } catch (error) {
    if (error && error.code === 11000) return false;
    throw error;
  }
}

/**
 * Suelta el candado antes de tiempo (p. ej. si la pasada falló), solo si es
 * de este dueño.
 * @returns {Promise<boolean>} true si lo ha soltado
 */
async function liberarCandado(nombre, { dueno = DUENO_POR_DEFECTO } = {}) {
  const r = await JobLock.updateOne({ _id: nombre, dueno }, { $set: { lockedUntil: new Date(0) } });
  return r.modifiedCount > 0;
}

module.exports = { adquirirCandado, liberarCandado };
