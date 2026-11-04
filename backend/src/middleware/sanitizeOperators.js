/**
 * Retira operadores de MongoDB de la peticion (req.body, req.query, req.params).
 *
 * Un body JSON como {"mrn": {"$ne": null}} llegaba tal cual a las consultas y
 * se ejecutaba como operador: asi se leian expedientes de otros tenants por
 * POST /api/pue/lookup-mrn (hallazgo F1). No habia ningun mongo-sanitize ni
 * sanitizeFilter configurado.
 *
 * Se borra toda clave que empiece por '$' (operadores) o contenga '.' (rutas
 * de Mongo que permitirian escribir campos anidados), a cualquier profundidad
 * y dentro de arrays. Los VALORES no se tocan: un string con '$' o '.' (un
 * precio, un email) llega igual. Es una defensa comun; los handlers siguen
 * debiendo validar el tipo de lo que usan en una consulta.
 */

const logger = require('../config/logger');

function esObjetoPlano(valor) {
  if (valor === null || typeof valor !== 'object') return false;
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
}

function claveProhibida(clave) {
  return clave.startsWith('$') || clave.includes('.');
}

/**
 * Copia sin las claves prohibidas. No muta el original.
 * @param {*} valor
 * @param {{ quitadas: number }} [cuenta]
 * @returns {*}
 */
function limpiarOperadores(valor, cuenta = { quitadas: 0 }) {
  if (Array.isArray(valor)) return valor.map((v) => limpiarOperadores(v, cuenta));
  if (!esObjetoPlano(valor)) return valor; // strings, numeros, Date, Buffer...

  const limpio = {};
  for (const [clave, v] of Object.entries(valor)) {
    if (claveProhibida(clave)) {
      cuenta.quitadas += 1;
      continue;
    }
    limpio[clave] = limpiarOperadores(v, cuenta);
  }
  return limpio;
}

function sanitizeOperators(req, res, next) {
  const cuenta = { quitadas: 0 };
  for (const parte of ['body', 'query', 'params']) {
    if (req[parte] && typeof req[parte] === 'object') {
      req[parte] = limpiarOperadores(req[parte], cuenta);
    }
  }
  if (cuenta.quitadas > 0) {
    // Solo cuantas y donde: el valor puede ser un dato personal o una carga.
    logger.warn(`[sanitizeOperators] ${cuenta.quitadas} clave(s) con '$' o '.' retiradas de ${req.method} ${req.originalUrl}`);
  }
  next();
}

module.exports = { sanitizeOperators, limpiarOperadores };
