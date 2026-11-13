/**
 * Sincronizacion automatica del catalogo TARIC: una vez al dia compara con la
 * fuente oficial, aplica los cambios y deja constancia en `TaricSyncRun`.
 *
 * Corre de madrugada, despues de la copia diaria de la base de datos (03:30),
 * de modo que siempre hay una copia anterior a lo que cambie.
 */
const logger = require('../../config/logger');
const { prepararSincronizacion, aplicarSincronizacion } = require('./sincronizacionTaric');

const ZONA = 'Europe/Madrid';
const HORA_DE_INICIO = 4;
// Una ejecucion automatica solo corrige lo existente si el cambio es pequeño.
// Una correccion masiva (como la puesta al dia inicial) se lanza a mano, despues
// de ver la simulacion.
const MAX_DESCRIPCIONES_AUTOMATICAS = 500;
const MAX_ARANCELES_AUTOMATICOS = 100;

/** Campos del catalogo que necesita la sincronizacion. */
const PROYECCION = {
  _id: 0, code: 1, level: 1, isLeaf: 1, isActive: 1, legalDescription: 1, 'altaDiaria.enVigorDesde': 1,
  'description.es': 1, 'description.en': 1,
  'duties.thirdCountry': 1, 'duties.specific': 1, 'duties.combinacion': 1, 'duties.minimo': 1, 'duties.maximo': 1,
  'duties.sancionRusiaBielorrusia': 1, 'duties.variantes': 1, 'duties.formula': 1,
  'duties.origen.fuente': 1, 'duties.origen.evidencia': 1
};

const cargarCatalogo = (TaricCode) => TaricCode.find({}, PROYECCION).lean();

/** Fecha (AAAA-MM-DD) y hora del reloj de Madrid en un instante. */
function relojDeMadrid(instante) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(instante).map((p) => [p.type, p.value]));
  return { dia: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour) };
}

/**
 * ¿Toca sincronizar? Si ya son las 04:00 en Madrid y hoy todavia no ha habido
 * ningun intento (bueno o malo: un fallo no se reintenta en bucle).
 */
function tocaSincronizar(ahora, ultimoIntento) {
  const reloj = relojDeMadrid(ahora);
  if (reloj.hora < HORA_DE_INICIO) return false;
  return !ultimoIntento || relojDeMadrid(new Date(ultimoIntento)).dia !== reloj.dia;
}

/** Motivo para no aplicar solas las correcciones de lo existente, o null. */
function motivoParaRetenerCorrecciones(plan) {
  const descripciones = plan.correcciones?.descripciones.filter((d) => d.es).length || 0;
  // Variantes y formulas cambian como se liquida el codigo: cuentan como aranceles corregidos.
  const a = plan.correcciones?.aranceles;
  const aranceles = (a?.corregir.length || 0) + (a?.variantes?.length || 0) + (a?.compuestos?.length || 0);
  if (descripciones > MAX_DESCRIPCIONES_AUTOMATICAS) {
    return `${descripciones} descripciones en español por corregir (mas de ${MAX_DESCRIPCIONES_AUTOMATICAS}): hay que revisarlo y lanzarlo a mano`;
  }
  if (aranceles > MAX_ARANCELES_AUTOMATICOS) {
    return `${aranceles} aranceles por corregir (mas de ${MAX_ARANCELES_AUTOMATICOS}): hay que revisarlo y lanzarlo a mano`;
  }
  return null;
}

/**
 * Ejecuta una sincronizacion completa y la registra. Nunca lanza: un fallo
 * queda anotado en el registro y en el log.
 *
 * @param {{ TaricCode: object, TaricSyncRun: object, trigger?: string, ahora?: Date, preparar?: Function, forzarCorrecciones?: boolean }} deps
 * @returns {Promise<object>} el registro guardado
 */
async function sincronizarYRegistrar({ TaricCode, TaricSyncRun, trigger = 'automatica', ahora = new Date(), preparar = prepararSincronizacion, forzarCorrecciones = false }) {
  const registro = await TaricSyncRun.create({ trigger, startedAt: ahora });
  try {
    const plan = await preparar(await cargarCatalogo(TaricCode), { log: (linea) => logger.info(`[TARIC] ${linea}`) });
    const retenidas = forzarCorrecciones ? null : motivoParaRetenerCorrecciones(plan);
    const aplicado = await aplicarSincronizacion(plan, { TaricCode, corregir: !retenidas });
    Object.assign(registro, { ok: true, fuente: plan.fuente, resumen: plan.resumen, aplicado, correccionesRetenidas: retenidas || undefined });
    logger.info(`[TARIC] Sincronizacion ${trigger} correcta (${plan.fuente.mes}): ${JSON.stringify(aplicado)}${retenidas ? ` | correcciones retenidas: ${retenidas}` : ''}`);
  } catch (error) {
    registro.error = String(error.message || error).slice(0, 1000);
    logger.error(`[TARIC] Sincronizacion ${trigger} FALLIDA: ${registro.error}`);
  }
  registro.finishedAt = new Date();
  await registro.save();
  return registro;
}

module.exports = {
  sincronizarYRegistrar, tocaSincronizar, motivoParaRetenerCorrecciones, cargarCatalogo, relojDeMadrid,
  HORA_DE_INICIO, MAX_DESCRIPCIONES_AUTOMATICAS, MAX_ARANCELES_AUTOMATICOS
};
