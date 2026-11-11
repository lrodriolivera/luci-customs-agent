const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) { /* ignore */ }
}

const REDACT_KEYS = new Set([
  'password', 'token', 'authorization', 'cookie', 'jwt', 'jwtSecret',
  'apiKey', 'api_key', 'secret', 'privateKey', 'private_key',
  'stripeSecretKey', 'anthropicApiKey', 'passphrase',
  'x-api-key', 'set-cookie'
]);

// Tope de claves por objeto y de elementos por lista: ahora que el registro
// escribe de verdad, un objeto enorme no puede frenar la peticion.
const MAX_ELEMENTOS = 100;

function redactDeep(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;
  // Un Error o una fecha no tienen propiedades enumerables: recorrerlos como
  // objeto los dejaba en {}.
  if (value instanceof Date) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, ...(value.code ? { code: value.code } : {}) };
  }
  if (Buffer.isBuffer(value)) return `[buffer ${value.length} bytes]`;
  if (typeof value === 'string') {
    if (value.length > 4096) return value.slice(0, 4096) + '…[truncated]';
    return value;
  }
  if (Array.isArray(value)) {
    const recortado = value.slice(0, MAX_ELEMENTOS).map(v => redactDeep(v, depth + 1));
    return value.length > MAX_ELEMENTOS ? [...recortado, `…[${value.length - MAX_ELEMENTOS} mas]`] : recortado;
  }
  if (typeof value === 'object') {
    // Un documento de Mongoose (u otro objeto con toJSON) se registra por sus
    // datos, no por sus propiedades internas.
    if (depth > 0 && typeof value.toJSON === 'function') {
      try { return redactDeep(value.toJSON(), depth); } catch (_) { return '[no serializable]'; }
    }
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, MAX_ELEMENTOS)) {
      if (REDACT_KEYS.has(k.toLowerCase())) out[k] = '[REDACTED]';
      else out[k] = redactDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

// winston guarda el nivel y el mensaje del registro en propiedades Symbol, y
// los transportes no escriben un registro que no las tenga. `redactDeep`
// devuelve una copia sin ellas: durante meses no se escribio ni una linea, en
// ningun entorno. Hay que devolver la copia CON los Symbol del original.
const redactFormat = winston.format((info) => {
  const limpio = redactDeep(info);
  for (const simbolo of Object.getOwnPropertySymbols(info)) limpio[simbolo] = info[simbolo];
  return limpio;
})();

const esTest = process.env.NODE_ENV === 'test';
const esProduccion = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  // En los tests no se escribe nada (ni ficheros ni consola): cada suite que
  // necesita el registro lo mockea o lo activa.
  silent: esTest,
  format: winston.format.combine(
    // Antes que el redactado: asi el mensaje y la traza de un Error quedan
    // como texto del registro.
    winston.format.errors({ stack: true }),
    redactFormat,
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'luci-customs' },
  transports: esTest ? [] : [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

if (esProduccion) {
  // `docker logs luci-backend` enseña avisos y errores; el detalle completo
  // (peticiones incluidas) queda en logs/combined.log, que rota a 5 x 5 MB.
  logger.add(new winston.transports.Console({ level: 'warn' }));
} else if (!esTest) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Ruta de una peticion sin secretos, para el registro de accesos: el token del
 * portal del cliente viaja en la ruta (/api/portal/<token>/...) y algunos
 * enlaces llevan token o clave en la consulta.
 *
 * @param {string} url
 * @returns {string}
 */
function sanitizarUrl(url) {
  return String(url || '')
    .replace(/(\/api\/portal\/)[A-Za-z0-9_-]{20,}/, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token|apikey|api_key|key|password|secret|code)=)[^&#\s]*/gi, '$1[REDACTED]');
}

// Lightweight child-helper for request-scoped logging
logger.forRequest = (req) => logger.child({
  requestId: req?.id,
  userId: req?.user?._id?.toString(),
  tenantId: req?.tenantId?.toString(),
  method: req?.method,
  url: req?.originalUrl
});

logger.sanitizarUrl = sanitizarUrl;
logger.redactDeep = redactDeep;

module.exports = logger;
