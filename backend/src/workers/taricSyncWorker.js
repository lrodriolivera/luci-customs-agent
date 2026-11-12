/**
 * Sincronizacion diaria del catalogo TARIC con la fuente oficial de la
 * Comision Europea.
 *
 * Cada media hora mira si toca (a partir de las 04:00 de Madrid, una vez al
 * dia) y, si toca, sincroniza. Solo arranca en produccion; se desactiva con
 * TARIC_SYNC_AUTO=false. El estado se consulta en
 * GET /api/classification/sync-status.
 */
const logger = require('../config/logger');

const INTERVALO_MS = 30 * 60 * 1000;
let temporizador = null;
let enMarcha = false;

/**
 * Medidas de control de importacion (certificados exigidos por codigo y
 * origen). Solo descarga cuando la Comision publica un mes nuevo. Un fallo
 * aqui no afecta a la sincronizacion del catalogo.
 */
async function cargarControles() {
  try {
    const { sincronizarControles } = require('../services/taric/controles/sincronizacionControles');
    const resultado = await sincronizarControles({
      TaricControlMeasure: require('../models/TaricControlMeasure'),
      TaricReference: require('../models/TaricReference')
    });
    if (!resultado.omitido) logger.info(`[TARIC] Medidas de control actualizadas (${resultado.mes})`);
    return resultado;
  } catch (error) {
    logger.error(`[TARIC] No se pudieron cargar las medidas de control: ${error.message}`);
    return null;
  }
}

/**
 * Publicaciones diarias del TARIC: se leen y se registran las nuevas (no toca
 * el catalogo). Solo con TARIC_DIARIO_APLICAR=true se actualizan ademas los
 * derechos de terceros paises que ya estan en vigor. Un fallo aqui no afecta a
 * la sincronizacion del catalogo.
 */
async function leerPublicacionesDiarias(ahora = new Date()) {
  try {
    const diario = require('../services/taric/diario/sincronizacionDiaria');
    const modelos = { TaricCode: require('../models/TaricCode'), TaricDailyPublication: require('../models/TaricDailyPublication') };
    const leidas = await diario.registrarPublicacionesNuevas({ ...modelos, ahora });
    const aplicado = process.env.TARIC_DIARIO_APLICAR === 'true' ? await diario.aplicarPendientes({ ...modelos, ahora }) : null;
    return { leidas: leidas.nuevas.length, aplicado };
  } catch (error) {
    logger.error(`[TARIC] No se pudieron leer las publicaciones diarias: ${error.message}`);
    return null;
  }
}

async function comprobar({ ahora = new Date() } = {}) {
  if (enMarcha) return null;
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return null;
  const TaricCode = require('../models/TaricCode');
  const TaricSyncRun = require('../models/TaricSyncRun');
  const { sincronizarYRegistrar, tocaSincronizar } = require('../services/taric/sincronizacionAutomatica');

  enMarcha = true;
  try {
    const ultimo = await TaricSyncRun.findOne({}, { startedAt: 1 }).sort({ startedAt: -1 }).lean();
    if (!tocaSincronizar(ahora, ultimo?.startedAt)) return null;
    const resultado = await sincronizarYRegistrar({ TaricCode, TaricSyncRun, trigger: 'automatica', ahora });
    await cargarControles();
    await leerPublicacionesDiarias(ahora);
    return resultado;
  } catch (error) {
    logger.error(`[TARIC] El comprobador de sincronizacion fallo: ${error.message}`);
    return null;
  } finally {
    enMarcha = false;
  }
}

function start() {
  if (process.env.NODE_ENV !== 'production' || process.env.TARIC_SYNC_AUTO === 'false') {
    logger.info('Sincronizacion automatica del TARIC desactivada (solo en produccion, y sin TARIC_SYNC_AUTO=false)');
    return;
  }
  if (temporizador) return;
  temporizador = setInterval(() => { comprobar(); }, INTERVALO_MS);
  // No debe impedir que el proceso termine en el apagado ordenado.
  temporizador.unref();
  logger.info('Sincronizacion automatica del TARIC activada: diaria a partir de las 04:00 (Europe/Madrid)');
}

function stop() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

module.exports = { start, stop, comprobar, cargarControles, leerPublicacionesDiarias, INTERVALO_MS };
