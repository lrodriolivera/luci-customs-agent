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
    const { sincronizarControles, sincronizarDobleUso } = require('../services/taric/controles/sincronizacionControles');
    const resultado = await sincronizarControles({
      TaricControlMeasure: require('../models/TaricControlMeasure'),
      TaricReference: require('../models/TaricReference')
    });
    if (!resultado.omitido) logger.info(`[TARIC] Medidas de control actualizadas (${resultado.mes})`);
    // La tabla de doble uso se publica aparte, un par de veces al año.
    await sincronizarDobleUso({ TaricReference: require('../models/TaricReference') });
    return resultado;
  } catch (error) {
    logger.error(`[TARIC] No se pudieron cargar las medidas de control: ${error.message}`);
    return null;
  }
}

/**
 * Publicaciones diarias del TARIC: se leen y se registran las nuevas; se
 * actualizan en el catalogo los derechos de terceros paises (o de destino
 * final) de codigos declarables cuyo cambio ya esta en vigor, y despues se dan
 * de alta los codigos nuevos que ya estan en vigor (heredan el derecho de su
 * padre, por eso van detras). Bajas y derechos de niveles superiores los
 * incorpora la carga mensual. TARIC_DIARIO_APLICAR=false deja solo la lectura.
 * Un fallo aqui no afecta a la sincronizacion del catalogo, y un fallo en las
 * altas no deshace lo leido ni los derechos aplicados.
 */
const modelosDiarios = () => ({ TaricCode: require('../models/TaricCode'), TaricDailyPublication: require('../models/TaricDailyPublication') });

async function leerPublicacionesDiarias(ahora = new Date()) {
  let resultado;
  let modelos;
  try {
    const diario = require('../services/taric/diario/sincronizacionDiaria');
    modelos = modelosDiarios();
    const leidas = await diario.registrarPublicacionesNuevas({ ...modelos, ahora });
    const aplicado = process.env.TARIC_DIARIO_APLICAR === 'false' ? null : await diario.aplicarPendientes({ ...modelos, ahora });
    if (aplicado?.retenido) logger.warn(`[TARIC] Cambios diarios de derecho sin aplicar: ${aplicado.retenido}`);
    resultado = { leidas: leidas.nuevas.length, aplicado, altas: null };
  } catch (error) {
    logger.error(`[TARIC] No se pudieron leer las publicaciones diarias: ${error.message}`);
    return null;
  }
  try {
    const altasDiarias = require('../services/taric/diario/altasDiarias');
    await altasDiarias.releerPublicacionesIncompletas(modelos);
    if (process.env.TARIC_DIARIO_APLICAR === 'false') return resultado;
    const altas = await altasDiarias.aplicarAltas({ ...modelos, ahora });
    if (altas?.retenido) logger.warn(`[TARIC] Altas diarias de código sin aplicar: ${altas.retenido}`);
    return { ...resultado, altas };
  } catch (error) {
    logger.error(`[TARIC] No se pudieron dar de alta los códigos nuevos de las publicaciones diarias: ${error.message}`);
    return resultado;
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
