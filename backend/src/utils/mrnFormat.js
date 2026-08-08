/**
 * MRN (Movement Reference Number): formato que exige AEAT.
 *
 * Patron oficial `[0-9]{2}[A-Z]{2}[A-Z0-9]{14}` = 18 caracteres, con el anyo en
 * DOS digitos. Ejemplos reales obtenidos de PRE: `26ESH7A000067965R5` (H7),
 * `26ES009999Z0000685` (ENS), `26ES002801501092J0` (transito).
 *
 * E2E 8/Ago/2026: los 14 MRN de la base de datos los habia generado el seed con
 * el anyo de cuatro digitos (`2026ES00782741`, 14 caracteres), y AEAT rechazaba
 * la operacion con "El elemento no cumple con el formato exigido. Patron:
 * [0-9]{2}[A-Z]{2}[A-Z0-9]{14}", un mensaje que no nombra el campo. Un MRN
 * inventado con la forma equivocada convierte cualquier envio posterior en un
 * rechazo indescifrable, asi que todo MRN local pasa por aqui.
 */

const crypto = require('crypto');

/** El patron de AEAT, anclado. */
const PATRON_MRN = /^[0-9]{2}[A-Z]{2}[A-Z0-9]{14}$/;

const LONGITUD_MRN = 18;
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** @returns {boolean} si el valor cumple el patron exigido por AEAT. */
function esMRNValido(mrn) {
  return typeof mrn === 'string' && PATRON_MRN.test(mrn);
}

/**
 * Genera un MRN con el formato valido. No es un MRN de AEAT: solo se usa en
 * datos de prueba y en la simulacion, donde antes se inventaban cadenas que no
 * pasaban la validacion del organismo.
 *
 * @param {{pais?: string, prefijo?: string}} [opciones]
 *   `prefijo` va justo tras el pais (p.ej. 'H7A'); se recorta si no cabe.
 */
function generarMRN({ pais = 'ES', prefijo = '' } = {}) {
  const anyo = String(new Date().getFullYear()).slice(-2);
  const paisNormalizado = String(pais).toUpperCase().replace(/[^A-Z]/g, '').padEnd(2, 'S').slice(0, 2);

  const cuerpoDisponible = LONGITUD_MRN - 4;
  const prefijoNormalizado = String(prefijo).toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, cuerpoDisponible);

  const aleatorio = Array.from(
    crypto.randomBytes(cuerpoDisponible),
    (b) => ALFABETO[b % ALFABETO.length]
  ).join('');

  const cuerpo = (prefijoNormalizado + aleatorio).slice(0, cuerpoDisponible);
  return `${anyo}${paisNormalizado}${cuerpo}`;
}

module.exports = { PATRON_MRN, LONGITUD_MRN, esMRNValido, generarMRN };
