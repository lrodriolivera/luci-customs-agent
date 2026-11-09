/**
 * KPI Service
 * Phase 6.2: Analytics and Business Intelligence
 *
 * Tracks Key Performance Indicators with thresholds and alerts
 */

const logger = require('../../config/logger');
const { crearEstadoPorTenant } = require('../ml/estadoPorTenant');
const aiService = require('../aiService');

/**
 * KPI Categories
 */
const KPI_CATEGORIES = {
  OPERATIONAL: 'operational',
  FINANCIAL: 'financial',
  COMPLIANCE: 'compliance',
  QUALITY: 'quality',
  EFFICIENCY: 'efficiency'
};

/**
 * Alert severity levels
 */
const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * KPI definitions with thresholds
 */
const KPI_DEFINITIONS = {
  // Operational KPIs
  declarations_per_day: {
    id: 'declarations_per_day',
    name: 'Declaraciones por día',
    description: 'Número promedio de declaraciones procesadas por día',
    category: KPI_CATEGORIES.OPERATIONAL,
    unit: 'declaraciones',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 3,
      warning_low: 5,
      target: 10,
      warning_high: null,
      critical_high: null
    }
  },

  green_channel_rate: {
    id: 'green_channel_rate',
    name: 'Tasa de canal verde',
    description: 'Porcentaje de declaraciones asignadas a canal verde',
    category: KPI_CATEGORIES.OPERATIONAL,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 50,
      warning_low: 60,
      target: 75,
      warning_high: null,
      critical_high: null
    }
  },

  average_processing_time: {
    id: 'average_processing_time',
    name: 'Tiempo medio de procesamiento',
    description: 'Tiempo promedio desde creación hasta levante',
    category: KPI_CATEGORIES.OPERATIONAL,
    unit: 'horas',
    direction: 'lower_is_better',
    thresholds: {
      critical_low: null,
      warning_low: null,
      target: 4,
      warning_high: 8,
      critical_high: 24
    }
  },

  active_expeditions: {
    id: 'active_expeditions',
    name: 'Expedientes activos',
    description: 'Número de expedientes que no han terminado (excluye levante, completados y cancelados)',
    category: KPI_CATEGORIES.OPERATIONAL,
    unit: 'expedientes',
    direction: 'neutral',
    thresholds: {
      critical_low: null,
      warning_low: null,
      target: null,
      warning_high: 50,
      critical_high: 100
    }
  },

  // Financial KPIs
  total_duties_collected: {
    id: 'total_duties_collected',
    name: 'Derechos liquidados',
    description: 'Suma de derechos de aduana liquidados en las declaraciones (no es lo cobrado)',
    category: KPI_CATEGORIES.FINANCIAL,
    unit: 'EUR',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 50000,
      warning_low: 100000,
      target: 200000,
      warning_high: null,
      critical_high: null
    }
  },

  savings_achieved: {
    id: 'savings_achieved',
    name: 'Ahorros conseguidos',
    description: 'Ahorros por preferencias y optimizaciones',
    category: KPI_CATEGORIES.FINANCIAL,
    unit: 'EUR',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 0,
      warning_low: 5000,
      target: 20000,
      warning_high: null,
      critical_high: null
    }
  },

  guarantee_utilization: {
    id: 'guarantee_utilization',
    name: 'Utilización de garantías',
    description: 'Porcentaje de garantías utilizadas',
    category: KPI_CATEGORIES.FINANCIAL,
    unit: '%',
    direction: 'neutral',
    thresholds: {
      critical_low: null,
      warning_low: null,
      target: 50,
      warning_high: 80,
      critical_high: 95
    }
  },

  // Compliance KPIs
  error_rate: {
    id: 'error_rate',
    name: 'Tasa de errores',
    description: 'Porcentaje de declaraciones con errores',
    category: KPI_CATEGORIES.COMPLIANCE,
    unit: '%',
    direction: 'lower_is_better',
    thresholds: {
      critical_low: null,
      warning_low: null,
      target: 1,
      warning_high: 3,
      critical_high: 5
    }
  },

  rejection_rate: {
    id: 'rejection_rate',
    name: 'Tasa de rechazo',
    description: 'Porcentaje de declaraciones rechazadas por AEAT',
    category: KPI_CATEGORIES.COMPLIANCE,
    unit: '%',
    direction: 'lower_is_better',
    thresholds: {
      critical_low: null,
      warning_low: null,
      target: 0.5,
      warning_high: 2,
      critical_high: 5
    }
  },

  on_time_submissions: {
    id: 'on_time_submissions',
    name: 'Envíos a tiempo',
    description: 'Porcentaje de declaraciones enviadas dentro del plazo',
    category: KPI_CATEGORIES.COMPLIANCE,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 85,
      warning_low: 95,
      target: 99,
      warning_high: null,
      critical_high: null
    }
  },

  compliance_score: {
    id: 'compliance_score',
    name: 'Score de cumplimiento',
    description: 'Puntuación general de cumplimiento normativo',
    category: KPI_CATEGORIES.COMPLIANCE,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 75,
      warning_low: 85,
      target: 95,
      warning_high: null,
      critical_high: null
    }
  },

  // Quality KPIs
  document_completeness: {
    id: 'document_completeness',
    name: 'Completitud documental',
    description: 'Porcentaje de expedientes con documentación completa',
    category: KPI_CATEGORIES.QUALITY,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 80,
      warning_low: 90,
      target: 98,
      warning_high: null,
      critical_high: null
    }
  },

  luci_accuracy: {
    id: 'luci_accuracy',
    name: 'Precisión de LUCI',
    description: 'Porcentaje de clasificaciones correctas de LUCI',
    category: KPI_CATEGORIES.QUALITY,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 85,
      warning_low: 90,
      target: 95,
      warning_high: null,
      critical_high: null
    }
  },

  // Efficiency KPIs
  automation_rate: {
    id: 'automation_rate',
    name: 'Tasa de automatización',
    description: 'Porcentaje de operaciones automatizadas',
    category: KPI_CATEGORIES.EFFICIENCY,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 40,
      warning_low: 60,
      target: 80,
      warning_high: null,
      critical_high: null
    }
  },

  first_time_resolution: {
    id: 'first_time_resolution',
    name: 'Resolución en primer intento',
    description: 'Porcentaje de declaraciones aceptadas sin correcciones',
    category: KPI_CATEGORIES.EFFICIENCY,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 70,
      warning_low: 80,
      target: 95,
      warning_high: null,
      critical_high: null
    }
  },

  aeat_connectivity: {
    id: 'aeat_connectivity',
    name: 'Conectividad AEAT',
    description: 'Disponibilidad de conexión con servicios AEAT',
    category: KPI_CATEGORIES.EFFICIENCY,
    unit: '%',
    direction: 'higher_is_better',
    thresholds: {
      critical_low: 90,
      warning_low: 95,
      target: 99,
      warning_high: null,
      critical_high: null
    }
  }
};

/**
 * In-memory storage for KPI history and alerts
 */
// Estado por tenant: tenantKey -> { history: Map<kpiId, []>, alerts: [] }.
// Ambito (parametro tenantId): undefined = super admin de plataforma (lee todo y
// escribe en su propio cubo); null = sin tenant (no lee nada); string = ese tenant.
const STATUS_SIN_DATOS = 'sin_datos';
const estadoPorTenant = new Map();
// Contador para que dos alertas del mismo KPI creadas en el mismo ms (p. ej. de tenants distintos) no compartan id.
let secuenciaAlertas = 0;
const CLAVE_PLATAFORMA = '__plataforma__';
const CLAVE_SIN_TENANT = '__sin_tenant__';

function _clave(tenantId) {
  if (tenantId === undefined) return CLAVE_PLATAFORMA;
  if (tenantId === null) return CLAVE_SIN_TENANT;
  return String(tenantId);
}

function _estado(tenantId) {
  const clave = _clave(tenantId);
  if (!estadoPorTenant.has(clave)) {
    estadoPorTenant.set(clave, { history: new Map(), alerts: [] });
  }
  return estadoPorTenant.get(clave);
}

/** Cubos que el ambito puede leer: todos (undefined), ninguno (null) o el suyo. */
function _estadosVisibles(tenantId) {
  if (tenantId === undefined) return [...estadoPorTenant.values()];
  if (tenantId === null) return [];
  const e = estadoPorTenant.get(String(tenantId));
  return e ? [e] : [];
}

function _historialVisible(kpiId, tenantId) {
  return _estadosVisibles(tenantId)
    .flatMap(e => e.history.get(kpiId) || [])
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}
let kpiTargets = new Map();

/**
 * Get all KPI definitions
 */
function getKPIDefinitions() {
  return Object.values(KPI_DEFINITIONS);
}

/**
 * Get KPIs by category
 */
function getKPIsByCategory(category) {
  return Object.values(KPI_DEFINITIONS).filter(kpi => kpi.category === category);
}

/**
 * Calculate current KPI value
 */
function _evaluarKPI(kpiId, data, tenantId) {
  const definition = KPI_DEFINITIONS[kpiId];
  const value = _valorDeDatos(kpiId, data);

  // Sin dato real no hay cifra: ni valor inventado.
  if (value === null) {
    return {
      definition,
      value: null,
      result: {
        kpiId,
        name: definition.name,
        value: null,
        unit: definition.unit,
        target: definition.thresholds.target,
        status: STATUS_SIN_DATOS,
        trend: null,
        timestamp: new Date()
      }
    };
  }

  return {
    definition,
    value,
    result: {
      kpiId,
      name: definition.name,
      value: Math.round(value * 100) / 100,
      unit: definition.unit,
      target: definition.thresholds.target,
      status: _evaluateKPIStatus(value, definition),
      trend: _calculateTrend(kpiId, value, tenantId),
      timestamp: new Date()
    }
  };
}

async function calculateKPI(kpiId, data = {}, tenantId) {
  if (!KPI_DEFINITIONS[kpiId]) {
    return { success: false, error: `Unknown KPI: ${kpiId}` };
  }

  try {
    const { definition, value, result } = _evaluarKPI(kpiId, data, tenantId);

    // Sin dato real: ni alerta ni historico.
    if (value !== null) {
      // Record in history
      _recordKPIValue(kpiId, result, tenantId);

      // Check for alerts
      _checkKPIAlert(kpiId, result, definition, tenantId);
    }

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[KPI] Error calculating ${kpiId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get all current KPI values
 */
async function getAllKPIs(data = {}, tenantId) {
  const results = [];

  for (const kpiId of Object.keys(KPI_DEFINITIONS)) {
    const result = await calculateKPI(kpiId, data, tenantId);
    if (result.success) {
      results.push(result.data);
    }
  }

  // Group by category
  const grouped = {};
  for (const category of Object.values(KPI_CATEGORIES)) {
    grouped[category] = results.filter(kpi =>
      KPI_DEFINITIONS[kpi.kpiId]?.category === category
    );
  }

  return {
    success: true,
    data: {
      all: results,
      byCategory: grouped,
      summary: _generateKPISummary(results),
      timestamp: new Date()
    }
  };
}

/**
 * Get KPI history
 */
function getKPIHistory(kpiId, period = 'last_30_days', tenantId) {
  const history = _historialVisible(kpiId, tenantId);

  // Filter by period
  const now = new Date();
  let startDate;

  switch (period) {
    case 'last_7_days':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'last_30_days':
      startDate = new Date(now.setDate(now.getDate() - 30));
      break;
    case 'last_90_days':
      startDate = new Date(now.setDate(now.getDate() - 90));
      break;
    default:
      startDate = new Date(0);
  }

  const filtered = history.filter(h => new Date(h.timestamp) >= startDate);

  return {
    success: true,
    kpiId,
    definition: KPI_DEFINITIONS[kpiId],
    history: filtered,
    statistics: _calculateHistoryStats(filtered)
  };
}

/**
 * Set custom KPI target
 */
function setKPITarget(kpiId, target) {
  if (!KPI_DEFINITIONS[kpiId]) {
    return { success: false, error: `Unknown KPI: ${kpiId}` };
  }

  kpiTargets.set(kpiId, {
    target,
    setAt: new Date(),
    previousTarget: KPI_DEFINITIONS[kpiId].thresholds.target
  });

  logger.info(`[KPI] Custom target set for ${kpiId}: ${target}`);

  return { success: true, kpiId, newTarget: target };
}

/**
 * Get active alerts
 */
function getActiveAlerts(filters = {}, tenantId) {
  let alerts = _estadosVisibles(tenantId).flatMap(e => e.alerts);

  if (filters.severity) {
    alerts = alerts.filter(a => a.severity === filters.severity);
  }
  if (filters.category) {
    alerts = alerts.filter(a => a.category === filters.category);
  }
  if (filters.kpiId) {
    alerts = alerts.filter(a => a.kpiId === filters.kpiId);
  }

  return {
    success: true,
    alerts,
    counts: {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === ALERT_SEVERITY.CRITICAL).length,
      warning: alerts.filter(a => a.severity === ALERT_SEVERITY.WARNING).length,
      info: alerts.filter(a => a.severity === ALERT_SEVERITY.INFO).length
    }
  };
}

/**
 * Acknowledge an alert
 */
function acknowledgeAlert(alertId, userId, tenantId) {
  const alert = _estadosVisibles(tenantId)
    .flatMap(e => e.alerts)
    .find(a => a.id === alertId);

  if (!alert) {
    return { success: false, error: 'Alert not found' };
  }

  alert.acknowledged = true;
  alert.acknowledgedBy = userId;
  alert.acknowledgedAt = new Date();

  logger.info(`[KPI] Alert ${alertId} acknowledged by ${userId}`);

  return { success: true };
}

/**
 * Dismiss an alert
 */
function dismissAlert(alertId, tenantId) {
  const estado = _estadosVisibles(tenantId).find(e => e.alerts.some(a => a.id === alertId));

  if (!estado) {
    return { success: false, error: 'Alert not found' };
  }
  estado.alerts = estado.alerts.filter(a => a.id !== alertId);

  logger.info(`[KPI] Alert ${alertId} dismissed`);
  return { success: true };
}

/**
 * Get KPI dashboard data
 */
async function getKPIDashboard(tenantId, data = {}) {
  const allKPIs = await getAllKPIs(data, tenantId);

  if (!allKPIs.success) {
    return allKPIs;
  }

  // Solo los KPI con dato real cuentan para el health score, las tendencias y el analisis
  const calculados = allKPIs.data.all.filter(k => k.value !== null);

  return {
    success: true,
    data: {
      kpis: allKPIs.data,
      alerts: getActiveAlerts({}, tenantId).alerts,
      healthScore: _calculateHealthScore(calculados),
      kpisCalculados: calculados.length,
      kpisTotal: allKPIs.data.all.length,
      trends: _getOverallTrends(calculados),
      // El analisis de LUCI (Bedrock, lento) va aparte: getKPIAnalysis / GET /kpis/analysis
      luciAnalysis: null,
      lastUpdated: new Date()
    }
  };
}

// Analisis de LUCI cacheado por tenant: un Bedrock por tenant cada 10 minutos, no uno por recarga.
const TTL_ANALISIS_MS = 10 * 60 * 1000;
const cacheAnalisis = crearEstadoPorTenant(() => ({ entrada: null, pendiente: null }));

/** Vacia la cache del analisis (tests). */
function limpiarCacheAnalisis() {
  for (const cubo of cacheAnalisis.visibles(undefined)) {
    cubo.entrada = null;
    cubo.pendiente = null;
  }
}

async function _calcularAnalisis(data, tenantId) {
  // Evaluacion pura: el dashboard ya registro historico y alertas al cargar.
  const all = Object.keys(KPI_DEFINITIONS).map(id => _evaluarKPI(id, data, tenantId).result);
  if (!all.some(k => k.value !== null)) return null;   // nada que analizar
  return _getLuciKPIAnalysis({ all, summary: _generateKPISummary(all) });
}

/**
 * Analisis de LUCI de los KPI del ambito, aparte del dashboard (que no lo espera).
 * Cache en memoria por tenant (10 min); los fallos (null) no se cachean y las
 * peticiones simultaneas comparten una sola llamada a Bedrock.
 */
async function getKPIAnalysis(tenantId, data = {}) {
  const cubo = cacheAnalisis.escribir(tenantId);
  const ahora = Date.now();

  if (cubo.entrada && ahora < cubo.entrada.expira) {
    return {
      success: true,
      data: { luciAnalysis: cubo.entrada.luciAnalysis, generatedAt: cubo.entrada.generatedAt, fromCache: true }
    };
  }

  if (!cubo.pendiente) {
    cubo.pendiente = _calcularAnalisis(data, tenantId)
      .then((luciAnalysis) => {
        const generatedAt = new Date(Date.now()).toISOString();
        if (luciAnalysis) {
          cubo.entrada = { luciAnalysis, generatedAt, expira: Date.now() + TTL_ANALISIS_MS };
        }
        return { luciAnalysis, generatedAt };
      })
      .finally(() => { cubo.pendiente = null; });
  }

  const { luciAnalysis, generatedAt } = await cubo.pendiente;
  return { success: true, data: { luciAnalysis, generatedAt, fromCache: false } };
}

/**
 * Compare KPIs between periods
 */
async function compareKPIs(period1, period2, datos = {}) {
  // `datos` = { period1: data, period2: data } con datos reales de cada periodo.
  // Sin ellos no se inventa nada: valores y cambio quedan en null.
  const comparison = {
    period1,
    period2,
    kpis: {}
  };

  for (const kpiId of Object.keys(KPI_DEFINITIONS)) {
    const definition = KPI_DEFINITIONS[kpiId];

    const value1 = _valorDeDatos(kpiId, datos.period1);
    const value2 = _valorDeDatos(kpiId, datos.period2);

    if (value1 === null || value2 === null || value2 === 0) {
      comparison.kpis[kpiId] = {
        name: definition.name,
        period1Value: value1 === null ? null : Math.round(value1 * 100) / 100,
        period2Value: value2 === null ? null : Math.round(value2 * 100) / 100,
        change: null,
        improved: null
      };
      continue;
    }

    const change = ((value1 - value2) / value2 * 100);

    comparison.kpis[kpiId] = {
      name: definition.name,
      period1Value: Math.round(value1 * 100) / 100,
      period2Value: Math.round(value2 * 100) / 100,
      change: Math.round(change * 10) / 10,
      improved: definition.direction === 'higher_is_better'
        ? value1 > value2
        : definition.direction === 'lower_is_better'
          ? value1 < value2
          : Math.abs(change) < 5
    };
  }

  return { success: true, data: comparison };
}

// ==================== Helper Functions ====================

/**
 * Valor de un KPI a partir de datos reales (ver kpiDatos.datosParaKPIs).
 * Devuelve null cuando no hay dato: solo cuenta un numero finito, nunca se inventa.
 */
const CLAVE_DE_DATOS = {
  green_channel_rate: 'greenChannel',
  average_processing_time: 'avgProcessingTime',
  active_expeditions: 'activeExpeditions',
  total_duties_collected: 'totalDuties',
  savings_achieved: 'savings',
  guarantee_utilization: 'guaranteeUtilization',
  error_rate: 'errorRate',
  rejection_rate: 'rejectionRate',
  on_time_submissions: 'onTimeRate',
  compliance_score: 'complianceScore',
  document_completeness: 'documentCompleteness',
  luci_accuracy: 'luciAccuracy',
  automation_rate: 'automationRate',
  first_time_resolution: 'firstTimeResolution',
  aeat_connectivity: 'aeatConnectivity'
};

const _esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

function _valorDeDatos(kpiId, data = {}) {
  if (kpiId === 'declarations_per_day') {
    return _esNumero(data.totalDeclarations) ? data.totalDeclarations / (data.days || 30) : null;
  }
  const clave = CLAVE_DE_DATOS[kpiId];
  return clave && _esNumero(data[clave]) ? data[clave] : null;
}

function _evaluateKPIStatus(value, definition) {
  const { thresholds, direction } = definition;

  // Check critical thresholds
  if (thresholds.critical_low !== null && value < thresholds.critical_low) {
    return 'critical';
  }
  if (thresholds.critical_high !== null && value > thresholds.critical_high) {
    return 'critical';
  }

  // Check warning thresholds
  if (thresholds.warning_low !== null && value < thresholds.warning_low) {
    return 'warning';
  }
  if (thresholds.warning_high !== null && value > thresholds.warning_high) {
    return 'warning';
  }

  // Check if meeting target
  if (thresholds.target !== null) {
    if (direction === 'higher_is_better' && value >= thresholds.target) {
      return 'good';
    }
    if (direction === 'lower_is_better' && value <= thresholds.target) {
      return 'good';
    }
    if (direction === 'neutral') {
      return 'good';
    }
  }

  return 'ok';
}

function _calculateTrend(kpiId, currentValue, tenantId) {
  const history = _historialVisible(kpiId, tenantId);

  if (history.length < 2) {
    return { direction: 'stable', percentage: 0 };
  }

  const previousValue = history[history.length - 1].value;
  const change = ((currentValue - previousValue) / previousValue * 100);

  return {
    direction: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
    percentage: Math.round(change * 10) / 10
  };
}

function _recordKPIValue(kpiId, result, tenantId) {
  const { history: porKpi } = _estado(tenantId);
  if (!porKpi.has(kpiId)) {
    porKpi.set(kpiId, []);
  }

  const history = porKpi.get(kpiId);
  history.push({
    value: result.value,
    status: result.status,
    timestamp: result.timestamp
  });

  // Keep only last 100 records
  if (history.length > 100) {
    history.shift();
  }
}

function _checkKPIAlert(kpiId, result, definition, tenantId) {
  const estado = _estado(tenantId);
  const activeAlerts = estado.alerts;
  // Remove existing alert for this KPI if status improved
  const existingIndex = activeAlerts.findIndex(a => a.kpiId === kpiId);

  if (result.status === 'good' || result.status === 'ok') {
    if (existingIndex !== -1) {
      activeAlerts.splice(existingIndex, 1);
    }
    return;
  }

  const alert = {
    id: `ALR-${Date.now()}-${kpiId}-${++secuenciaAlertas}`,
    kpiId,
    kpiName: definition.name,
    category: definition.category,
    severity: result.status === 'critical' ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.WARNING,
    value: result.value,
    threshold: result.status === 'critical'
      ? (definition.thresholds.critical_low || definition.thresholds.critical_high)
      : (definition.thresholds.warning_low || definition.thresholds.warning_high),
    message: _generateAlertMessage(kpiId, result, definition),
    createdAt: new Date(),
    acknowledged: false
  };

  if (existingIndex !== -1) {
    // Update existing alert
    activeAlerts[existingIndex] = { ...activeAlerts[existingIndex], ...alert };
  } else {
    // Add new alert
    activeAlerts.push(alert);
    logger.warn(`[KPI] Alert created: ${alert.message}`);
  }
}

/**
 * Cifra + unidad para el texto de una alerta: numero en es-ES (miles con punto,
 * decimales con coma) y un espacio entre cifra y unidad ("50.000 EUR",
 * "0 declaraciones"); el % va pegado a la cifra ("9%").
 */
function _formatearCifra(valor, unit) {
  const numero = Number(valor).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  if (!unit) return numero;
  return unit === '%' ? `${numero}%` : `${numero} ${unit}`;
}

function _generateAlertMessage(kpiId, result, definition) {
  const { value, status } = result;
  const { name, unit, thresholds, direction } = definition;
  const cifra = (v) => _formatearCifra(v, unit);

  // Para los KPI neutrales (sin objetivo) el umbral citado es el que se ha superado
  const superaMaximo = (limite) => thresholds[limite] != null && value > thresholds[limite];

  if (status === 'critical') {
    if (direction === 'lower_is_better' || superaMaximo('critical_high')) {
      return `${name} crítico: ${cifra(value)} (máximo recomendado: ${cifra(thresholds.critical_high)})`;
    }
    return `${name} crítico: ${cifra(value)} (mínimo requerido: ${cifra(thresholds.critical_low)})`;
  }

  if (status === 'warning') {
    if (direction === 'lower_is_better') {
      return `${name} en alerta: ${cifra(value)} (objetivo: ${cifra(thresholds.target)})`;
    }
    if (thresholds.target == null && superaMaximo('warning_high')) {
      return `${name} en alerta: ${cifra(value)} (máximo recomendado: ${cifra(thresholds.warning_high)})`;
    }
    return `${name} por debajo del objetivo: ${cifra(value)} (objetivo: ${cifra(thresholds.target)})`;
  }

  return `${name}: ${cifra(value)}`;
}

function _calculateHistoryStats(history) {
  if (!history.length) {
    return { min: 0, max: 0, avg: 0, stdDev: 0 };
  }

  const values = history.map(h => h.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  );

  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100
  };
}

function _generateKPISummary(kpis) {
  const statuses = kpis.map(k => k.status);

  return {
    total: kpis.length,
    good: statuses.filter(s => s === 'good').length,
    ok: statuses.filter(s => s === 'ok').length,
    warning: statuses.filter(s => s === 'warning').length,
    critical: statuses.filter(s => s === 'critical').length,
    sin_datos: statuses.filter(s => s === STATUS_SIN_DATOS).length
  };
}

function _calculateHealthScore(kpis) {
  // Sin ningun KPI calculado no hay puntuacion (no un 0 ni un 50 inventado)
  if (kpis.length === 0) return null;

  const weights = {
    good: 100,
    ok: 75,
    warning: 40,
    critical: 0
  };

  const totalScore = kpis.reduce((sum, kpi) => sum + (weights[kpi.status] || 50), 0);
  return Math.round(totalScore / kpis.length);
}

function _getOverallTrends(kpis) {
  const improving = kpis.filter(k => k.trend?.direction === 'up').length;
  const declining = kpis.filter(k => k.trend?.direction === 'down').length;
  const stable = kpis.filter(k => k.trend?.direction === 'stable').length;

  return { improving, declining, stable };
}

async function _getLuciKPIAnalysis(kpiData) {
  try {
    const criticalKPIs = kpiData.all.filter(k => k.status === 'critical');
    const warningKPIs = kpiData.all.filter(k => k.status === 'warning');

    // Construir kpiData + targets para analyzeKPIDeviations
    const kpiPayload = {
      summary: kpiData.summary,
      criticalKPIs,
      warningKPIs
    };
    const targets = {};
    [...criticalKPIs, ...warningKPIs].forEach(k => {
      if (k.target !== undefined) targets[k.name || k.kpiId] = k.target;
    });

    const analysis = await aiService.analyzeKPIDeviations(kpiPayload, targets);

    // Normalizar shapes (analyzeKPIDeviations devuelve overallPerformance/deviations/quickWins/strategicInitiatives)
    const norm = (v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object') {
        return v.action || v.initiative || v.recommendation || v.description || v.cause || v.risk || v.text || '';
      }
      return '';
    };

    const summary = analysis.overallPerformance?.summary ||
                    analysis.executiveSummary ||
                    analysis.summary ||
                    'KPIs dentro de parámetros normales.';

    // Priorities: combinar quickWins + strategicInitiatives
    const priorities = [
      ...(Array.isArray(analysis.quickWins) ? analysis.quickWins : []),
      ...(Array.isArray(analysis.strategicInitiatives) ? analysis.strategicInitiatives : []),
      ...(Array.isArray(analysis.improvementActions) ? analysis.improvementActions : []),
      ...(Array.isArray(analysis.recommendations) ? analysis.recommendations : [])
    ].map(norm).filter(Boolean);

    // Risks: rootCauses extraídos de deviations + risks/warnings top-level
    const risks = [
      ...(Array.isArray(analysis.deviations)
        ? analysis.deviations.flatMap(d => (Array.isArray(d.rootCauses) ? d.rootCauses : []))
        : []),
      ...(Array.isArray(analysis.rootCauses) ? analysis.rootCauses : []),
      ...(Array.isArray(analysis.risks) ? analysis.risks : []),
      ...(Array.isArray(analysis.warnings) ? analysis.warnings : [])
    ].map(norm).filter(Boolean);

    return {
      summary,
      priorities,
      risks
    };
  } catch (error) {
    logger.warn(`[KPIs] Could not get LUCI KPI analysis: ${error.message}`);
    return null;
  }
}

module.exports = {
  // Constants
  KPI_CATEGORIES,
  ALERT_SEVERITY,
  KPI_DEFINITIONS,

  // KPI methods
  getKPIDefinitions,
  getKPIsByCategory,
  calculateKPI,
  getAllKPIs,
  getKPIHistory,
  setKPITarget,
  getKPIDashboard,
  getKPIAnalysis,
  limpiarCacheAnalisis,
  compareKPIs,

  // Alert methods
  getActiveAlerts,
  acknowledgeAlert,
  dismissAlert
};
