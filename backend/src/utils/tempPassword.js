/**
 * Generador unico de contrasenas temporales.
 *
 * Antes cada punto que emitia una contrasena temporal (adminInvite, el alta
 * local de adminController.createUser, el reset de adminController) la
 * generaba a su manera (crypto.randomBytes(6).toString('hex'), o un sufijo
 * distinto): "temporal" dejaba de significar lo mismo segun por donde se
 * creara el usuario. Un solo generador para que invitar, crear localmente y
 * restablecer produzcan la misma fortaleza y el mismo ciclo de vida.
 */

const crypto = require('crypto');

/** Horas de validez de una contrasena temporal antes de que el login (o el
 * propio cambio de contrasena) la rechacen. */
const HORAS_VALIDEZ_TEMPORAL = 72;

/**
 * Contrasena temporal fuerte generada con crypto (nunca Math.random). El
 * sufijo fijo garantiza mayuscula + numero + simbolo sin depender del azar
 * del bloque aleatorio, que solo aporta longitud/entropia.
 */
function generarContrasenaTemporal() {
  return crypto.randomBytes(18).toString('base64').replace(/[+/=]/g, '').slice(0, 18) + 'aA1!';
}

/** Fecha de caducidad de una temporal recien generada (ahora + 72h por defecto). */
function calcularExpiracionTemporal(horas = HORAS_VALIDEZ_TEMPORAL) {
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

module.exports = { generarContrasenaTemporal, calcularExpiracionTemporal, HORAS_VALIDEZ_TEMPORAL };
