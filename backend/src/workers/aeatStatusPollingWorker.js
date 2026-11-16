/**
 * Consulta automática periódica del estado de las declaraciones en la AEAT.
 *
 * Cada AEAT_POLLING_INTERVAL_MIN minutos (15 por defecto) hace una pasada:
 * consulta por los servicios oficiales (aeatStatusMonitorService.pollOnce) los
 * seguimientos que aún no son finales, como mucho AEAT_POLLING_MAX_PER_PASS (50)
 * por pasada, empezando por los consultados hace más tiempo. Se desactiva con
 * AEAT_POLLING_ENABLED=false y nunca arranca en tests (NODE_ENV=test).
 *
 * Con varias réplicas (pm2 cluster) o tras un reinicio, un candado en Mongo
 * (services/candadoMongo.js) que dura algo menos que el intervalo hace que
 * solo una réplica haga la pasada de cada intervalo. Cada pasada deja en el
 * log un resumen (consultadas, con error, para la siguiente), sin MRN ni datos
 * de las declaraciones. Un error (AEAT, Redis, Mongo) se registra y no tumba el
 * proceso.
 */
const logger = require('../config/logger');

const NOMBRE_CANDADO = 'aeat-status-polling';
const MINUTO_MS = 60 * 1000;
const POR_DEFECTO = { intervaloMin: 15, limite: 50 };
// La primera pasada no sale en el arranque, para no competir con él.
const RETRASO_PRIMERA_MS = 2 * MINUTO_MS;
// El candado caduca un poco antes que el intervalo para no saltarse la siguiente.
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
    habilitado: env.AEAT_POLLING_ENABLED !== 'false',
    intervaloMs: enteroPositivo(env.AEAT_POLLING_INTERVAL_MIN, POR_DEFECTO.intervaloMin) * MINUTO_MS,
    limite: enteroPositivo(env.AEAT_POLLING_MAX_PER_PASS, POR_DEFECTO.limite)
  };
}

/**
 * Una pasada, si esta réplica obtiene el candado del intervalo.
 * @returns {Promise<object|null>} resumen, { omitida: true } si otra réplica la
 *   hizo, o null si no se pudo (sin Mongo, otra pasada en curso o error)
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
      logger.debug('[AEAT-POLLING] Pasada omitida: la hace otra réplica');
      return { omitida: true };
    }
    const monitor = require('../services/aeat/aeatStatusMonitorService');
    const resumen = await monitor.pollOnce({ limite: config.limite });
    logger.info(`[AEAT-POLLING] Pasada: ${resumen.consultadas} consultadas, ${resumen.conError} con error, ${resumen.restantes} para la siguiente, ${resumen.omitidas} finales o sin consulta`);
    return resumen;
  } catch (error) {
    logger.error(`[AEAT-POLLING] La pasada falló: ${error.message}`);
    // Que otra réplica (o la siguiente vuelta) pueda reintentar sin esperar al intervalo.
    if (tengoCandado) {
      try {
        await liberarCandado(NOMBRE_CANDADO);
      } catch (e) {
        logger.error(`[AEAT-POLLING] No se pudo soltar el candado: ${e.message}`);
      }
    }
    return null;
  } finally {
    enMarcha = false;
  }
}

/**
 * Arranca el temporizador. Devuelve true si lo ha arrancado ahora.
 * @param {object} [env]  entorno (por defecto process.env)
 */
function start(env = process.env) {
  if (env.NODE_ENV === 'test') return false;
  const config = configuracion(env);
  if (!config.habilitado) {
    logger.info('Consulta automática de estados AEAT desactivada (AEAT_POLLING_ENABLED=false)');
    return false;
  }
  if (temporizador) return false;
  const monitor = require('../services/aeat/aeatStatusMonitorService');
  if (!monitor.trackedDeclarations?.client) {
    logger.warn('Consulta automática AEAT sin Redis: el seguimiento vive en la memoria de cada proceso; con varias réplicas, solo se consultan los de la réplica que gane el candado');
  }
  temporizador = setInterval(() => { pasada({ config }); }, config.intervaloMs);
  // No debe impedir que el proceso termine en el apagado ordenado.
  temporizador.unref();
  primera = setTimeout(() => { pasada({ config }); }, Math.min(RETRASO_PRIMERA_MS, config.intervaloMs));
  primera.unref();
  logger.info(`Consulta automática de estados AEAT activada: cada ${config.intervaloMs / MINUTO_MS} min, hasta ${config.limite} por pasada`);
  return true;
}

function stop() {
  if (temporizador) clearInterval(temporizador);
  if (primera) clearTimeout(primera);
  temporizador = null;
  primera = null;
}

/** El temporizador está en marcha en este proceso. */
const activo = () => temporizador !== null;

module.exports = { start, stop, pasada, configuracion, activo, NOMBRE_CANDADO };
