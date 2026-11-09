/**
 * Analytics Service
 * Phase 6.2: Analytics and Business Intelligence
 *
 * Constantes de periodos, registro de eventos, rango de fechas y metricas en
 * tiempo real (datos reales del ambito). El antiguo simulador de cifras
 * aleatorias y las funciones de dashboard/declaraciones/financiero/cumplimiento/rendimiento/
 * comparativa/consulta) se elimino: las metricas reales viven en
 * realMetricsService y cuadroParaPanel.
 */

const logger = require('../../config/logger');
const realMetrics = require('./realMetricsService');
const kpiService = require('./kpiService');

/**
 * Time periods for analytics
 */
const TIME_PERIODS = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_90_DAYS: 'last_90_days',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  THIS_QUARTER: 'this_quarter',
  THIS_YEAR: 'this_year',
  CUSTOM: 'custom'
};

/**
 * Metric categories
 */
const METRIC_CATEGORIES = {
  OPERATIONS: 'operations',
  FINANCIAL: 'financial',
  COMPLIANCE: 'compliance',
  PERFORMANCE: 'performance',
  QUALITY: 'quality'
};

/**
 * Channel types for analysis
 */
const CHANNELS = {
  GREEN: 'green',
  ORANGE: 'orange',
  RED: 'red',
  YELLOW: 'yellow'
};

/**
 * In-memory storage for analytics data (replace with database in production)
 */
let analyticsData = {
  declarations: [],
  expeditions: [],
  inspections: [],
  communications: [],
  errors: []
};

/**
 * Record an analytics event
 */
function recordEvent(category, eventType, data) {
  const event = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    category,
    eventType,
    data,
    timestamp: new Date(),
    userId: data.userId || 'system'
  };

  if (!analyticsData[category]) {
    analyticsData[category] = [];
  }
  analyticsData[category].push(event);

  logger.debug(`[Analytics] Event recorded: ${category}/${eventType}`);
  return event;
}

/**
 * Get date range for a time period
 */
function getDateRange(period, customStart, customEnd) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case TIME_PERIODS.TODAY:
      return { start: today, end: now };

    case TIME_PERIODS.YESTERDAY:
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };

    case TIME_PERIODS.LAST_7_DAYS:
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return { start: last7, end: now };

    case TIME_PERIODS.LAST_30_DAYS:
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      return { start: last30, end: now };

    case TIME_PERIODS.LAST_90_DAYS:
      const last90 = new Date(today);
      last90.setDate(last90.getDate() - 90);
      return { start: last90, end: now };

    case TIME_PERIODS.THIS_MONTH:
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: now };

    case TIME_PERIODS.LAST_MONTH:
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: lastMonthStart, end: lastMonthEnd };

    case TIME_PERIODS.THIS_QUARTER:
      const quarter = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
      return { start: quarterStart, end: now };

    case TIME_PERIODS.THIS_YEAR:
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return { start: yearStart, end: now };

    case TIME_PERIODS.CUSTOM:
      return {
        start: customStart ? new Date(customStart) : today,
        end: customEnd ? new Date(customEnd) : now
      };

    default:
      return { start: today, end: now };
  }
}

/**
 * Metricas "en tiempo real" del ambito, con datos reales; lo que no tiene fuente
 * es null (nunca se inventa).
 *
 * Ambito (tenantId): undefined = super admin de plataforma (agrega todo); null =
 * sin tenant (no ve nada); string = ese tenant.
 *
 *   activeDeclarations <- realMetrics.expedientesActivos (expedientes no terminales)
 *   pendingSubmissions <- volumenDeclaraciones(...).pendientes de los ultimos 30 dias
 *   alerts             <- alertas de KPI activas del ambito, por severidad
 *   aeatStatus         <- null: no hay una comprobacion real de conectividad
 */
async function getRealTimeMetrics(tenantId) {
  const alertas = kpiService.getActiveAlerts({}, tenantId).counts;

  // realMetrics no filtra con tenantId null, y aqui "sin tenant" no ve nada.
  const sinAmbito = tenantId === null;
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Si una fuente falla, solo esa metrica queda en null
  const [activos, volumen] = await Promise.all([
    sinAmbito ? 0 : realMetrics.expedientesActivos(tenantId).catch((e) => _fallo('expedientesActivos', e)),
    sinAmbito ? { pendientes: 0 } : realMetrics.volumenDeclaraciones(tenantId, { desde, hasta }).catch((e) => _fallo('volumenDeclaraciones', e))
  ]);

  return {
    timestamp: new Date(),
    activeDeclarations: activos,
    pendingSubmissions: volumen ? volumen.pendientes : null,
    aeatStatus: null,
    alerts: {
      critical: alertas.critical,
      warning: alertas.warning,
      info: alertas.info
    }
  };
}

function _fallo(fuente, error) {
  logger.error(`[Analytics] Realtime: fallo en ${fuente}: ${error.message}`);
  return null;
}

module.exports = {
  // Constants
  TIME_PERIODS,
  METRIC_CATEGORIES,
  CHANNELS,

  // Data recording
  recordEvent,

  // Metricas reales
  getRealTimeMetrics,

  // Utility
  getDateRange
};
