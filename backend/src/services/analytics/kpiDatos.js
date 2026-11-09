/**
 * Datos reales para los KPI.
 *
 * kpiService calculaba los KPI con valores aleatorios de demo porque nadie le
 * pasaba datos. Aqui se traducen las metricas reales del tenant
 * (realMetricsService) al objeto `data` que consume calculateKPI. Solo se
 * rellenan los KPI que tienen fuente; el resto no aparece y kpiService los marca
 * "sin datos". Un valor null significa "esta fuente no tiene muestra" (no es 0).
 *
 * Fuentes (clave de `data` <- origen):
 *   totalDeclarations + days <- volumenDeclaraciones.total en los ultimos `dias`
 *   greenChannel             <- % de canal verde sobre los que tienen canal (null si ninguno)
 *   avgProcessingTime        <- tiemposDeDespacho.mediaHoras (null si muestra 0)
 *   activeExpeditions        <- expedientesActivos (expedientes no terminales, sin rango de fechas)
 *   totalDuties              <- derechosLiquidados.total
 *   rejectionRate            <- % de H7 rechazadas sobre las H7 (porTipo.H7), null si no hay H7
 *
 * Sin fuente (no se calculan): savings, guaranteeUtilization, errorRate,
 * onTimeRate, complianceScore, documentCompleteness, luciAccuracy, automationRate,
 * firstTimeResolution y aeatConnectivity.
 */

const realMetrics = require('./realMetricsService');

const DIAS_POR_DEFECTO = 30;
const DIAS_MAXIMOS = 365;
const MS_POR_DIA = 86400000;

const redondear1 = (x) => Math.round(x * 10) / 10;

/**
 * % de H7 rechazadas sobre las H7, redondeado a 1 decimal; null si no hay H7.
 * porEstado solo cubre H7, asi que el denominador son las H7 (no el total con
 * transitos). Unica fuente de esta formula: la usan los KPI y el panel.
 * @param {{ porTipo?: object, porEstado?: object }} volumen
 */
function tasaRechazoH7(volumen) {
  const h7 = volumen?.porTipo?.H7;
  return h7 > 0 ? redondear1(((volumen.porEstado?.rejected || 0) / h7) * 100) : null;
}

function _dias(dias) {
  return Number.isInteger(dias) && dias >= 1 && dias <= DIAS_MAXIMOS ? dias : DIAS_POR_DEFECTO;
}

/**
 * @param {string|ObjectId|null|undefined} tenantId ambito: string/ObjectId = ese tenant;
 *   undefined = super admin de plataforma (agrega todos los tenants); null = sin tenant (vacio).
 * @param {{ dias?: number }} [opciones]
 * @returns {Promise<object>} `data` para kpiService (vacio si no hay ambito)
 */
async function datosParaKPIs(tenantId, { dias = DIAS_POR_DEFECTO } = {}) {
  // realMetrics no filtra con tenantId null, y aqui "sin tenant" no ve nada.
  if (tenantId === null) return {};

  const days = _dias(dias);
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - days * MS_POR_DIA);
  const rango = { desde, hasta };

  const [volumen, canales, derechos, tiempos, activos] = await Promise.all([
    realMetrics.volumenDeclaraciones(tenantId, rango),
    realMetrics.repartoPorCanal(tenantId, rango),
    realMetrics.derechosLiquidados(tenantId, rango),
    realMetrics.tiemposDeDespacho(tenantId, rango),
    realMetrics.expedientesActivos(tenantId)
  ]);

  return {
    totalDeclarations: volumen.total,
    days,
    greenChannel: canales.conCanalAsignado > 0
      ? redondear1((canales.canales.green / canales.conCanalAsignado) * 100)
      : null,
    avgProcessingTime: tiempos.muestra > 0 ? tiempos.mediaHoras : null,
    activeExpeditions: activos,
    totalDuties: derechos.total,
    rejectionRate: tasaRechazoH7(volumen)
  };
}

module.exports = { datosParaKPIs, tasaRechazoH7, redondear1 };
