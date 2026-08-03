/**
 * Sanea los mensajes de error que salen al cliente.
 *
 * 448 catch de los controllers responden con `error: error.message`. En
 * produccion eso filtra el detalle interno: comprobado que
 * GET /api/oea/<id-malformado> devolvia
 *   "Cast to ObjectId failed for value \"xxx\" ... for model \"OEA\""
 * es decir, los nombres de los modelos y la estructura de la BD.
 *
 * Arreglar los 448 sitios a mano seria un cambio enorme y arriesgado sobre
 * codigo en produccion. Este middleware intercepta la respuesta y sustituye el
 * mensaje solo cuando delata infraestructura, dejando intactos los mensajes de
 * negocio que el usuario necesita leer ("Contrasena incorrecta", "Solicitud no
 * encontrada", "Saldo insuficiente en garantia"...).
 *
 * En NODE_ENV=development no se toca nada, para no estorbar al depurar.
 */

const logger = require('../config/logger');

/**
 * Patrones que delatan infraestructura y nunca deben llegar al cliente.
 * Se prefiere pecar de conservador: ante la duda, se sustituye.
 */
const FILTRA_INTERNOS = [
  /Cast to \w+ failed/i,          // CastError de Mongoose, incluye el modelo
  /for model ["'`]/i,             // idem
  /E11000 duplicate key/i,        // indice unico: expone coleccion y campos
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH/i,  // host y puerto internos
  /buffering timed out/i,         // revela que Mongo no responde
  /ValidationError:/i,            // rutas de campos del schema
  /\n\s*at .+\(/,                 // trazas de pila coladas en el mensaje
  /\/(home|srv|usr|var)\//,       // rutas absolutas del servidor
  /mongodb(\+srv)?:\/\//i,        // cadenas de conexion
  /\b[A-Za-z0-9]{20,}\b.*(key|token|secret)/i,        // credenciales
  /localhost:\d+|127\.0\.0\.1:\d+/                    // hosts internos
];

const MENSAJE_GENERICO = 'Error interno del servidor';

/** ¿Este texto delata infraestructura? */
function delataInterno(texto) {
  if (typeof texto !== 'string' || !texto) return false;
  return FILTRA_INTERNOS.some(re => re.test(texto));
}

/**
 * Intercepta res.json para sanear `error` y `message` antes de enviarlos.
 */
function sanitizeErrors(req, res, next) {
  if (process.env.NODE_ENV === 'development') return next();

  const jsonOriginal = res.json.bind(res);

  res.json = (body) => {
    if (body && typeof body === 'object') {
      for (const campo of ['error', 'message']) {
        if (delataInterno(body[campo])) {
          logger.warn(`[sanitize] Mensaje interno bloqueado en ${req.method} ${req.originalUrl}: ${body[campo]}`);
          body[campo] = MENSAJE_GENERICO;
        }
      }
    }
    return jsonOriginal(body);
  };

  next();
}

module.exports = { sanitizeErrors, delataInterno, MENSAJE_GENERICO };
