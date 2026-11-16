/**
 * Lectura periódica de la bandeja de avisos de exportación AES de la AEAT
 * (levantes, resultado de la salida, disconformes...): services/aesBandejaProceso.js.
 *
 * Mismo intervalo que la consulta automática de estados (AEAT_POLLING_INTERVAL_MIN,
 * 15 min por defecto), hasta 100 avisos leídos por pasada. Se desactiva con
 * AEAT_BANDEJA_ENABLED=false y nunca arranca en tests (NODE_ENV=test).
 *
 * Con varias réplicas, un candado en Mongo propio (`aes-bandeja`, distinto del
 * de la consulta automática) que dura algo menos que el intervalo hace que
 * solo una réplica lea la bandeja en cada intervalo: leer un aviso lo marca
 * leído en la AEAT y dos réplicas a la vez se lo repartirían. El log lleva solo
 * el resumen, sin MRN ni NIF. Un error se registra y no tumba el proceso.
 */
const logger = require('../config/logger');

const NOMBRE_CANDADO = 'aes-bandeja';
const MINUTO_MS = 60 * 1000;
const POR_DEFECTO = { intervaloMin: 15, limite: 100 };
// Primera pasada un poco después que la de la consulta automática (2 min).
const RETRASO_PRIMERA_MS = 3 * MINUTO_MS;
const FRACCION_CANDADO = 0.9;

let temporizador = null;
let primera = null;
let enMarcha = false;

const enteroPositivo = (valor, porDefecto) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
};

/** Configuración a partir del entorno. */
function configuracion(env = process.env) {
  return {
    habilitado: env.AEAT_BANDEJA_ENABLED !== 'false',
    intervaloMs: enteroPositivo(env.AEAT_POLLING_INTERVAL_MIN, POR_DEFECTO.intervaloMin) * MINUTO_MS,
    limite: POR_DEFECTO.limite
  };
}

/**
 * Una pasada, si esta réplica obtiene el candado del intervalo.
 * @returns {Promise<object|null>} resumen, { omitida: true } o null
 */
async function pasada({ config = configuracion() } = {}) {
  if (enMarcha) return null;
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return null;

  enMarcha = true;
  const { adquirirCandado, liberarCandado } = require('../services/candadoMongo');
  let tengoCandado = false;
  try {
    tengoCandado = await adquirirCandado(NOMBRE_CANDADO, { duracionMs: Math.floor(config.intervaloMs * FRACCION_CANDADO) });
    if (!tengoCandado) {
      logger.debug('[AES-BANDEJA] Pasada omitida: la hace otra réplica');
      return { omitida: true };
    }
    const { procesarBandeja } = require('../services/aesBandejaProceso');
    const r = await procesarBandeja({ limite: config.limite });
    logger.info(`[AES-BANDEJA] Pasada: ${r.buzones} buzones, ${r.leidos} leídos, ${r.aplicados} aplicados, ${r.sinExpediente} sin expediente, ${r.repetidos} repetidos, ${r.errores} con error, ${r.restantes} para la siguiente`);
    return r;
  } catch (error) {
    logger.error(`[AES-BANDEJA] La pasada falló: ${error.message}`);
    if (tengoCandado) {
      try {
        await liberarCandado(NOMBRE_CANDADO);
      } catch (e) {
        logger.error(`[AES-BANDEJA] No se pudo soltar el candado: ${e.message}`);
      }
    }
    return null;
  } finally {
    enMarcha = false;
  }
}

/** Arranca el temporizador. Devuelve true si lo ha arrancado ahora. */
function start(env = process.env) {
  if (env.NODE_ENV === 'test') return false;
  const config = configuracion(env);
  if (!config.habilitado) {
    logger.info('Lectura de la bandeja de avisos AES desactivada (AEAT_BANDEJA_ENABLED=false)');
    return false;
  }
  if (temporizador) return false;
  temporizador = setInterval(() => { pasada({ config }); }, config.intervaloMs);
  temporizador.unref();
  primera = setTimeout(() => { pasada({ config }); }, Math.min(RETRASO_PRIMERA_MS, config.intervaloMs));
  primera.unref();
  logger.info(`Lectura de la bandeja de avisos AES activada: cada ${config.intervaloMs / MINUTO_MS} min`);
  return true;
}

function stop() {
  if (temporizador) clearInterval(temporizador);
  if (primera) clearTimeout(primera);
  temporizador = null;
  primera = null;
}

const activo = () => temporizador !== null;

module.exports = { start, stop, pasada, configuracion, activo, NOMBRE_CANDADO };
