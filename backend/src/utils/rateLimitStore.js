/**
 * Fabrica de stores de rate-limit, compartida por app.js y por cualquier
 * limitador que se defina fuera (p.ej. routes/auth.js para la invitacion de
 * usuarios): distribuido via Redis cuando el proyecto lo usa, en memoria por
 * worker si no. Cada limitador necesita su PROPIA instancia de Store con un
 * prefijo distinto -- compartir una sola entre limitadores dispara
 * ERR_ERL_DOUBLE_COUNT en express-rate-limit v7.
 *
 * Antes vivia inline en app.js; routes/auth.js necesitaba la misma logica
 * (Redis si CACHE_BACKEND/RATELIMIT_BACKEND=redis, en memoria si no) para el
 * limitador propio de /admin/invite, asi que se extrajo aqui en vez de
 * duplicarla.
 */

const logger = require('../config/logger');

let makeRateLimitStore = () => undefined;

if (process.env.CACHE_BACKEND === 'redis' || process.env.RATELIMIT_BACKEND === 'redis') {
  try {
    const { default: RedisStore } = require('rate-limit-redis');
    const { getRedisClient } = require('../services/cacheService');
    const client = getRedisClient();
    if (client) {
      makeRateLimitStore = (prefix) => new RedisStore({
        sendCommand: (...args) => client.call(...args),
        prefix
      });
      logger.info('Rate limit: distributed (Redis)');
    }
  } catch (err) {
    logger.warn('rate-limit-redis not available, using in-memory store', { error: err.message });
  }
}

module.exports = { makeRateLimitStore };
