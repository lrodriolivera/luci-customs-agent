/**
 * KPI Service
 * Phase 6.2: Analytics and Business Intelligence
 *
 * Tracks Key Performance Indicators with thresholds and alerts
 */

const logger = require('../../config/logger');
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
    description: 'Número de expedientes en proceso',
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
    name: 'Derechos totales gestionados',
    description: 'Suma de derechos de aduana gestionados',
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
let kpiHistory = new Map();
let activeAlerts = [];
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
async function calculateKPI(kpiId, data = {}) {
  const definition = KPI_DEFINITIONS[kpiId];
  if (!definition) {
    return { success: false, error: `Unknown KPI: ${kpiId}` };
  }

  try {
    let value;

    // Calculate based on KPI type
    switch (kpiId) {
      case 'declarations_per_day':
        value = data.totalDeclarations ? data.totalDeclarations / (data.days || 30) : _generateValue(5, 15);
        break;

      case 'green_channel_rate':
        value = data.greenChannel ?? _generateValue(60, 80);
        break;

      case 'average_processing_time':
        value = data.avgProcessingTime ?? _generateValue(2, 8);
        break;

      case 'active_expeditions':
        value = data.activeExpeditions ?? _generateValue(15, 40);
        break;

      case 'total_duties_collected':
        value = data.totalDuties ?? _generateValue(100000, 500000);
        break;

      case 'savings_achieved':
        value = data.savings ?? _generateValue(5000, 30000);
        break;

      case 'guarantee_utilization':
        value = data.guaranteeUtilization ?? _generateValue(30, 70);
        break;

      case 'error_rate':
        value = data.errorRate ?? _generateValue(1, 4);
        break;

      case 'rejection_rate':
        value = data.rejectionRate ?? _generateValue(0.5, 3);
        break;

      case 'on_time_submissions':
        value = data.onTimeRate ?? _generateValue(92, 99);
        break;

      case 'compliance_score':
        value = data.complianceScore ?? _generateValue(85, 98);
        break;

      case 'document_completeness':
        value = data.documentCompleteness ?? _generateValue(90, 99);
        break;

      case 'luci_accuracy':
        value = data.luciAccuracy ?? _generateValue(90, 98);
        break;

      case 'automation_rate':
        value = data.automationRate ?? _generateValue(60, 85);
        break;

      case 'first_time_resolution':
        value = data.firstTimeResolution ?? _generateValue(80, 95);
        break;

      case 'aeat_connectivity':
        value = data.aeatConnectivity ?? _generateValue(95, 99.5);
        break;

      default:
        value = 0;
    }

    const result = {
      kpiId,
      name: definition.name,
      value: Math.round(value * 100) / 100,
      unit: definition.unit,
      target: definition.thresholds.target,
      status: _evaluateKPIStatus(value, definition),
      trend: _calculateTrend(kpiId, value),
      timestamp: new Date()
    };

    // Record in history
    _recordKPIValue(kpiId, result);

    // Check for alerts
    _checkKPIAlert(kpiId, result, definition);

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[KPI] Error calculating ${kpiId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get all current KPI values
 */
async function getAllKPIs(data = {}) {
  const results = [];

  for (const kpiId of Object.keys(KPI_DEFINITIONS)) {
    const result = await calculateKPI(kpiId, data);
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
function getKPIHistory(kpiId, period = 'last_30_days') {
  const history = kpiHistory.get(kpiId) || [];

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
function getActiveAlerts(filters = {}) {
  let alerts = [...activeAlerts];

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
function acknowledgeAlert(alertId, userId) {
  const alertIndex = activeAlerts.findIndex(a => a.id === alertId);

  if (alertIndex === -1) {
    return { success: false, error: 'Alert not found' };
  }

  activeAlerts[alertIndex].acknowledged = true;
  activeAlerts[alertIndex].acknowledgedBy = userId;
  activeAlerts[alertIndex].acknowledgedAt = new Date();

  logger.info(`[KPI] Alert ${alertId} acknowledged by ${userId}`);

  return { success: true };
}

/**
 * Dismiss an alert
 */
function dismissAlert(alertId) {
  const initialLength = activeAlerts.length;
  activeAlerts = activeAlerts.filter(a => a.id !== alertId);

  if (activeAlerts.length === initialLength) {
    return { success: false, error: 'Alert not found' };
  }

  logger.info(`[KPI] Alert ${alertId} dismissed`);
  return { success: true };
}

/**
 * Get KPI dashboard data
 */
async function getKPIDashboard() {
  const allKPIs = await getAllKPIs();

  if (!allKPIs.success) {
    return allKPIs;
  }

  // Get LUCI analysis
  let luciAnalysis = null;
  try {
    luciAnalysis = await _getLuciKPIAnalysis(allKPIs.data);
  } catch (error) {
    logger.warn(`[KPI] Could not get LUCI analysis: ${error.message}`);
  }

  return {
    success: true,
    data: {
      kpis: allKPIs.data,
      alerts: getActiveAlerts().alerts,
      healthScore: _calculateHealthScore(allKPIs.data.all),
      trends: _getOverallTrends(allKPIs.data.all),
      luciAnalysis,
      lastUpdated: new Date()
    }
  };
}

/**
 * Compare KPIs between periods
 */
async function compareKPIs(period1, period2) {
  // Generate mock comparison data
  const comparison = {
    period1,
    period2,
    kpis: {}
  };

  for (const kpiId of Object.keys(KPI_DEFINITIONS)) {
    const definition = KPI_DEFINITIONS[kpiId];

    const value1 = _generateValue(
      definition.thresholds.target * 0.8,
      definition.thresholds.target * 1.2
    );
    const value2 = _generateValue(
      definition.thresholds.target * 0.75,
      definition.thresholds.target * 1.15
    );

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

function _generateValue(min, max) {
  return Math.random() * (max - min) + min;
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

function _calculateTrend(kpiId, currentValue) {
  const history = kpiHistory.get(kpiId) || [];

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

function _recordKPIValue(kpiId, result) {
  if (!kpiHistory.has(kpiId)) {
    kpiHistory.set(kpiId, []);
  }

  const history = kpiHistory.get(kpiId);
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

function _checkKPIAlert(kpiId, result, definition) {
  // Remove existing alert for this KPI if status improved
  const existingIndex = activeAlerts.findIndex(a => a.kpiId === kpiId);

  if (result.status === 'good' || result.status === 'ok') {
    if (existingIndex !== -1) {
      activeAlerts.splice(existingIndex, 1);
    }
    return;
  }

  const alert = {
    id: `ALR-${Date.now()}-${kpiId}`,
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

function _generateAlertMessage(kpiId, result, definition) {
  const { value, status } = result;
  const { name, unit, thresholds, direction } = definition;

  if (status === 'critical') {
    if (direction === 'lower_is_better') {
      return `${name} crítico: ${value}${unit} (máximo recomendado: ${thresholds.critical_high}${unit})`;
    }
    return `${name} crítico: ${value}${unit} (mínimo requerido: ${thresholds.critical_low}${unit})`;
  }

  if (status === 'warning') {
    if (direction === 'lower_is_better') {
      return `${name} en alerta: ${value}${unit} (objetivo: ${thresholds.target}${unit})`;
    }
    return `${name} por debajo del objetivo: ${value}${unit} (objetivo: ${thresholds.target}${unit})`;
  }

  return `${name}: ${value}${unit}`;
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
    critical: statuses.filter(s => s === 'critical').length
  };
}

function _calculateHealthScore(kpis) {
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
    const analysis = await aiService.analyzeWithLuci({
      type: 'kpi_analysis',
      summary: kpiData.summary,
      criticalKPIs: kpiData.all.filter(k => k.status === 'critical'),
      warningKPIs: kpiData.all.filter(k => k.status === 'warning')
    });

    return {
      summary: analysis.summary || 'KPIs dentro de parámetros normales.',
      priorities: analysis.recommendations || [],
      risks: analysis.warnings || []
    };
  } catch (error) {
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
  compareKPIs,

  // Alert methods
  getActiveAlerts,
  acknowledgeAlert,
  dismissAlert
};
