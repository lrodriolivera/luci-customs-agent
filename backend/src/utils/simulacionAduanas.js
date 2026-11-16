/**
 * Cuando se admite una respuesta SIMULADA de un servicio de aduanas.
 *
 * Una respuesta simulada (`simulated: true`) no es una presentacion: no hay
 * MRN, CSV ni circuito de verdad. Solo se acepta si la simulacion se ha pedido
 * de forma explicita con las mismas variables que ya usa aeatRealService
 * (AEAT_SIMULATE / AEAT_FORCE_SIMULATION = 'true'), y nunca en produccion.
 * Por defecto esta desactivada: sin esas variables, lo simulado se trata como
 * "no presentado" y no se guarda nada como si viniera de la aduana.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
function simulacionPermitida(env = process.env) {
  if (env.AEAT_ENVIRONMENT === 'production') return false;
  return env.AEAT_SIMULATE === 'true' || env.AEAT_FORCE_SIMULATION === 'true';
}

const MENSAJE_SIMULACION_NO_PERMITIDA =
  'El servicio de aduanas ha devuelto una respuesta SIMULADA (no hay certificado configurado): '
  + 'la declaración NO se ha presentado y no tiene MRN. Configure el certificado para presentarla.';

module.exports = { simulacionPermitida, MENSAJE_SIMULACION_NO_PERMITIDA };
