/**
 * Predictions Service
 * Phase 6.2: Analytics and Business Intelligence
 *
 * ML-based predictions for volume, trends, and anomaly detection
 * Powered by LUCI AI
 */

const logger = require('../../config/logger');
const aiService = require('../aiService');
const realMetrics = require('./realMetricsService');

/**
 * Prediction types
 */
const PREDICTION_TYPES = {
  VOLUME: 'volume',
  CHANNEL: 'channel',
  INSPECTION: 'inspection',
  PROCESSING_TIME: 'processing_time',
  DUTIES: 'duties',
  ANOMALY: 'anomaly',
  TREND: 'trend'
};

/**
 * Confidence levels
 */
const CONFIDENCE_LEVELS = {
  HIGH: 'high',      // > 85%
  MEDIUM: 'medium',  // 70-85%
  LOW: 'low'         // < 70%
};

/**
 * Anomaly types
 */
const ANOMALY_TYPES = {
  VALUE_SPIKE: 'value_spike',
  VALUE_DROP: 'value_drop',
  UNUSUAL_PATTERN: 'unusual_pattern',
  OUTLIER: 'outlier',
  SEASONAL_DEVIATION: 'seasonal_deviation'
};

// No hay modelos entrenados ni medidos: no se publica ninguna precision. Antes
// habia valores fijos (0.87, 0.92...) presentados como metricas de modelo.
const SIN_MODELO = Object.freeze({ disponible: false, accuracy: null, lastTrained: null });
const modelMetrics = {
  volumeModel: SIN_MODELO,
  channelModel: SIN_MODELO,
  inspectionModel: SIN_MODELO,
  anomalyModel: SIN_MODELO
};

const MS_POR_DIA = 86400000;
const DIAS_HISTORICO = 90;

/**
 * Predict channel assignment probability
 */
async function predictChannel(declarationData, options = {}) {
  try {
    logger.debug(`[Predictions] Predicting channel for declaration`);

    // Risk factors
    const riskScore = _calculateRiskScore(declarationData);

    // Channel probabilities based on risk score
    const probabilities = {
      green: Math.max(0, Math.min(100, 85 - riskScore * 0.8)),
      orange: Math.min(30, riskScore * 0.4),
      red: Math.min(20, riskScore * 0.3),
      yellow: Math.min(15, riskScore * 0.2)
    };

    // Normalize probabilities
    const total = probabilities.green + probabilities.orange + probabilities.red + probabilities.yellow;
    Object.keys(probabilities).forEach(k => {
      probabilities[k] = Math.round(probabilities[k] / total * 100);
    });

    // Predicted channel (highest probability)
    const predictedChannel = Object.entries(probabilities)
      .sort((a, b) => b[1] - a[1])[0][0];

    const result = {
      type: PREDICTION_TYPES.CHANNEL,
      predictedChannel,
      probabilities,
      riskScore,
      confidence: _getConfidenceLevel(Math.max(...Object.values(probabilities))),
      factors: _identifyRiskFactors(declarationData),
      recommendations: _getChannelRecommendations(predictedChannel, riskScore),
      historicalDistribution: await _distribucionHistoricaDeCanales(options.tenantId),
      modelInfo: { ...SIN_MODELO },
      generatedAt: new Date()
    };

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[Predictions] Channel prediction error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Predict inspection likelihood
 */
async function predictInspection(declarationData, options = {}) {
  try {
    const riskScore = _calculateRiskScore(declarationData);

    // Base inspection probability
    let inspectionProbability = 5 + riskScore * 0.5;

    // Adjust for specific factors
    if (declarationData.originCountry === 'CN') inspectionProbability += 5;
    if (declarationData.customsValue > 100000) inspectionProbability += 10;
    if (declarationData.firstTimeImporter) inspectionProbability += 15;
    if (declarationData.commodityCode?.startsWith('84') || declarationData.commodityCode?.startsWith('85')) {
      inspectionProbability += 3;
    }

    inspectionProbability = Math.min(95, Math.max(1, inspectionProbability));

    const result = {
      type: PREDICTION_TYPES.INSPECTION,
      inspectionProbability: Math.round(inspectionProbability),
      inspectionType: inspectionProbability > 50 ? 'physical' : 'documentary',
      riskLevel: inspectionProbability > 70 ? 'high' : inspectionProbability > 40 ? 'medium' : 'low',
      contributingFactors: _getInspectionFactors(declarationData, riskScore),
      mitigationSuggestions: _getInspectionMitigations(inspectionProbability),
      historicalRate: await _tasaHistoricaDeInspeccion(options.tenantId),
      modelInfo: { ...SIN_MODELO },
      generatedAt: new Date()
    };

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[Predictions] Inspection prediction error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Predict duties amount
 */
async function predictDuties(declarationData) {
  try {
    const customsValue = declarationData.customsValue || 10000;
    const commodityCode = declarationData.commodityCode || '8471300000';

    // Get duty rate (simplified)
    const dutyRate = _getDutyRate(commodityCode);
    const vatRate = 21;

    // Calculate duties
    const customsDuty = customsValue * (dutyRate / 100);
    const vatBase = customsValue + customsDuty;
    const vat = vatBase * (vatRate / 100);

    // Potential savings
    const potentialSavings = _calculatePotentialSavings(declarationData);

    const result = {
      type: PREDICTION_TYPES.DUTIES,
      customsValue,
      predictions: {
        customsDuty: Math.round(customsDuty * 100) / 100,
        vat: Math.round(vat * 100) / 100,
        excise: 0,
        total: Math.round((customsDuty + vat) * 100) / 100
      },
      rates: {
        duty: dutyRate,
        vat: vatRate,
        excise: 0
      },
      potentialSavings: {
        preferences: potentialSavings.preferences,
        quotas: potentialSavings.quotas,
        total: potentialSavings.total
      },
      // Alta solo si el capitulo arancelario esta en la tabla de tipos; si no, el
      // tipo aplicado es el generico y la prediccion es poco fiable.
      confidence: _tieneTipoArancelario(commodityCode) ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.LOW,
      notes: [
        `Código TARIC: ${commodityCode}`,
        `Tipo arancelario aplicado: ${dutyRate}%`,
        potentialSavings.total > 0 ? `Ahorro potencial identificado: ${potentialSavings.total} EUR` : null
      ].filter(Boolean),
      generatedAt: new Date()
    };

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[Predictions] Duties prediction error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Detect anomalies in data
 */
async function detectAnomalies(data, options = {}) {
  try {
    logger.info(`[Predictions] Detecting anomalies`);

    const anomalies = [];
    const threshold = options.threshold || 2; // Standard deviations

    // Analyze different aspects
    if (data.values && Array.isArray(data.values)) {
      const valueAnomalies = _detectValueAnomalies(data.values, threshold);
      anomalies.push(...valueAnomalies);
    }

    if (data.volumes && Array.isArray(data.volumes)) {
      const volumeAnomalies = _detectVolumeAnomalies(data.volumes, threshold);
      anomalies.push(...volumeAnomalies);
    }

    if (data.patterns) {
      const patternAnomalies = _detectPatternAnomalies(data.patterns);
      anomalies.push(...patternAnomalies);
    }

    // Sort by severity
    anomalies.sort((a, b) => b.severity - a.severity);

    // LUCI analysis
    let luciAnalysis = null;
    if (anomalies.length > 0) {
      luciAnalysis = await _getLuciAnomalyInsights(anomalies);
    }

    const result = {
      type: PREDICTION_TYPES.ANOMALY,
      anomaliesFound: anomalies.length,
      anomalies,
      riskAssessment: anomalies.length > 5 ? 'high' : anomalies.length > 2 ? 'medium' : 'low',
      modelInfo: { ...SIN_MODELO },
      luciAnalysis,
      generatedAt: new Date()
    };

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[Predictions] Anomaly detection error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get trend analysis
 */
async function analyzeTrends(data, options = {}) {
  try {
    const period = options.period || 'last_30_days';

    // Solo series REALES recibidas en `data`; nunca series sinteticas.
    const series = {
      volume: _serieValida(data?.volumes),
      value: _serieValida(data?.values),
      compliance: _serieValida(data?.compliance),
      efficiency: _serieValida(data?.efficiency)
    };

    if (!Object.values(series).some(Boolean)) {
      return {
        success: false,
        code: 'SIN_HISTORICO',
        error: realMetrics.NO_DISPONIBLE.SIN_HISTORICO
      };
    }

    const trends = Object.fromEntries(
      Object.entries(series).map(([k, v]) => [k, v ? _calculateTrend(v) : null])
    );
    const forecasts = Object.fromEntries(
      Object.entries(series).map(([k, v]) => [k, v ? _forecastNext(trends[k], v) : null])
    );

    // LUCI trend insights
    const luciInsights = await _getLuciTrendInsights(trends, forecasts);

    const result = {
      type: PREDICTION_TYPES.TREND,
      period,
      trends,
      forecasts,
      highlights: _generateTrendHighlights(trends),
      luciInsights,
      generatedAt: new Date()
    };

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[Predictions] Trend analysis error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

const _serieValida = (v) =>
  Array.isArray(v) && v.length >= 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? v : null;

/**
 * Get model performance metrics
 */
function getModelMetrics() {
  return {
    success: true,
    data: {
      disponible: false,
      models: { ...modelMetrics },
      overallAccuracy: null,
      lastUpdated: new Date()
    }
  };
}

// ==================== Helper Functions ====================

function _getConfidenceLevel(confidence) {
  if (confidence > 85) return CONFIDENCE_LEVELS.HIGH;
  if (confidence > 70) return CONFIDENCE_LEVELS.MEDIUM;
  return CONFIDENCE_LEVELS.LOW;
}

function _calculateRiskScore(data) {
  let score = 20; // Base score

  // Origin country risk
  const highRiskOrigins = ['CN', 'HK', 'VN', 'BD', 'PK'];
  if (highRiskOrigins.includes(data.originCountry)) score += 15;

  // Value risk
  if (data.customsValue > 100000) score += 20;
  else if (data.customsValue > 50000) score += 10;

  // Commodity risk
  if (data.commodityCode?.startsWith('84') || data.commodityCode?.startsWith('85')) score += 5;
  if (data.commodityCode?.startsWith('61') || data.commodityCode?.startsWith('62')) score += 8;

  // First time importer
  if (data.firstTimeImporter) score += 25;

  // Document completeness
  if (data.documentsComplete === false) score += 15;

  return Math.min(100, score);
}

function _identifyRiskFactors(data) {
  const factors = [];

  if (data.originCountry === 'CN') factors.push({ factor: 'País de origen de alto riesgo', impact: 'medium' });
  if (data.customsValue > 100000) factors.push({ factor: 'Valor aduanero elevado', impact: 'high' });
  if (data.firstTimeImporter) factors.push({ factor: 'Importador sin histórico', impact: 'high' });
  if (data.documentsComplete === false) factors.push({ factor: 'Documentación incompleta', impact: 'medium' });

  return factors;
}

function _getChannelRecommendations(channel, riskScore) {
  const recommendations = [];

  if (channel === 'red' || channel === 'orange') {
    recommendations.push('Preparar documentación adicional de soporte');
    recommendations.push('Verificar consistencia de valores declarados');
  }

  if (riskScore > 60) {
    recommendations.push('Considerar pre-validación con autoridad aduanera');
  }

  if (channel === 'green') {
    recommendations.push('Mantener documentación accesible para posible auditoría posterior');
  }

  return recommendations;
}

function _getInspectionFactors(data, riskScore) {
  const factors = [];

  if (riskScore > 50) factors.push('Score de riesgo elevado');
  if (data.originCountry === 'CN') factors.push('Origen China (mayor escrutinio)');
  if (data.customsValue > 100000) factors.push('Alto valor declarado');
  if (data.firstTimeImporter) factors.push('Sin histórico previo');

  return factors;
}

function _getInspectionMitigations(probability) {
  if (probability < 30) {
    return ['Mantener documentación completa y accesible'];
  }

  return [
    'Preparar toda la documentación de soporte',
    'Asegurar consistencia entre documentos comerciales',
    'Verificar etiquetado y marcado de mercancías',
    'Considerar solicitar inspección voluntaria si hay dudas'
  ];
}

// Tipos arancelarios simplificados por capitulo (los capitulos fuera de la tabla
// usan el generico 4,5%).
const TIPOS_POR_CAPITULO = {
  '84': 0,      // Machines
  '85': 0,      // Electronics
  '61': 12,     // Knitted apparel
  '62': 12,     // Non-knitted apparel
  '64': 8,      // Footwear
  '87': 10,     // Vehicles
  '94': 5.6     // Furniture
};
const TIPO_GENERICO = 4.5;

const _tieneTipoArancelario = (commodityCode) =>
  Object.prototype.hasOwnProperty.call(TIPOS_POR_CAPITULO, String(commodityCode).substring(0, 2));

function _getDutyRate(commodityCode) {
  const chapter = commodityCode.substring(0, 2);
  // Ojo: usar ?? y no ||. Los capítulos 84/85 tienen tipo 0% legítimo y `||`
  // los trataría como falsy, devolviendo 4,5% sobre mercancía en realidad
  // exenta (máquinas y electrónica, el grueso del volumen).
  return TIPOS_POR_CAPITULO[chapter] ?? TIPO_GENERICO;
}

/** Reparto historico real de canales del tenant; null si no hay dato o no hay ambito. */
async function _distribucionHistoricaDeCanales(tenantId) {
  // realMetrics no filtra con tenantId null/undefined: sin ambito no se consulta.
  if (!tenantId) return null;
  try {
    const r = await realMetrics.repartoPorCanal(tenantId, {});
    return r.conCanalAsignado > 0 ? r.porcentajes : null;
  } catch (error) {
    logger.warn(`[Predictions] Sin distribucion historica de canales: ${error.message}`);
    return null;
  }
}

/** % de declaraciones inspeccionadas en los ultimos 90 dias del tenant; null sin base. */
async function _tasaHistoricaDeInspeccion(tenantId) {
  if (!tenantId) return null;
  try {
    const hasta = new Date();
    const rango = { desde: new Date(hasta.getTime() - DIAS_HISTORICO * MS_POR_DIA), hasta };
    const [volumen, cumpl] = await Promise.all([
      realMetrics.volumenDeclaraciones(tenantId, rango),
      realMetrics.cumplimiento(tenantId, rango)
    ]);
    return volumen.total > 0 ? Math.round((cumpl.inspecciones / volumen.total) * 1000) / 10 : null;
  } catch (error) {
    logger.warn(`[Predictions] Sin tasa historica de inspeccion: ${error.message}`);
    return null;
  }
}

function _calculatePotentialSavings(data) {
  const savings = { preferences: 0, quotas: 0, total: 0 };

  // Check for preference eligibility
  const preferenceCountries = ['CA', 'JP', 'KR', 'MX', 'CL'];
  if (preferenceCountries.includes(data.originCountry)) {
    const dutyRate = _getDutyRate(data.commodityCode);
    savings.preferences = Math.round((data.customsValue || 10000) * (dutyRate / 100) * 0.5);
  }

  savings.total = savings.preferences + savings.quotas;
  return savings;
}

function _detectValueAnomalies(values, threshold) {
  const anomalies = [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

  values.forEach((value, index) => {
    const zScore = Math.abs((value - mean) / stdDev);
    if (zScore > threshold) {
      anomalies.push({
        type: value > mean ? ANOMALY_TYPES.VALUE_SPIKE : ANOMALY_TYPES.VALUE_DROP,
        index,
        value,
        expectedRange: { min: mean - threshold * stdDev, max: mean + threshold * stdDev },
        zScore: Math.round(zScore * 100) / 100,
        severity: zScore > 3 ? 3 : zScore > 2.5 ? 2 : 1
      });
    }
  });

  return anomalies;
}

function _detectVolumeAnomalies(volumes, threshold) {
  return _detectValueAnomalies(volumes, threshold).map(a => ({
    ...a,
    type: a.type === ANOMALY_TYPES.VALUE_SPIKE ? 'volume_spike' : 'volume_drop'
  }));
}

function _detectPatternAnomalies(patterns) {
  // Simplified pattern detection
  return [];
}

function _calculateTrend(data) {
  if (!data.length) return { direction: 'stable', slope: 0, strength: 0 };

  // Simple linear regression
  const n = data.length;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  data.forEach((y, x) => {
    numerator += (x - xMean) * (y - yMean);
    denominator += Math.pow(x - xMean, 2);
  });

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const direction = slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'stable';
  const strength = Math.min(100, Math.abs(slope) * 10);

  return { direction, slope: Math.round(slope * 100) / 100, strength: Math.round(strength) };
}

/** Siguiente punto de la serie por extrapolacion lineal de la propia serie (no un valor base fijo). */
function _forecastNext(trend, serie) {
  const n = serie.length;
  const media = serie.reduce((a, b) => a + b, 0) / n;
  const siguiente = media + trend.slope * (n - (n - 1) / 2);
  return {
    value: Math.round(siguiente * 100) / 100,
    confidence: n >= 14 && trend.strength > 50 ? CONFIDENCE_LEVELS.HIGH
      : n >= 7 ? CONFIDENCE_LEVELS.MEDIUM
        : CONFIDENCE_LEVELS.LOW
  };
}

function _generateTrendHighlights(trends) {
  const highlights = [];

  if (trends.volume?.direction === 'up') {
    highlights.push({ type: 'positive', message: 'Volumen de operaciones en aumento' });
  }
  if (trends.compliance?.direction === 'up') {
    highlights.push({ type: 'positive', message: 'Mejora en indicadores de cumplimiento' });
  }
  if (trends.efficiency?.direction === 'down') {
    highlights.push({ type: 'warning', message: 'Descenso en eficiencia operativa' });
  }

  return highlights;
}

function _normalizeRecommendations(recsRaw) {
  if (!Array.isArray(recsRaw)) return [];
  return recsRaw
    .map(rec => {
      if (typeof rec === 'string') return rec;
      if (!rec || typeof rec !== 'object') return '';
      return rec.action ||
             rec.recommendation ||
             rec.description ||
             rec.prediction ||
             rec.cause ||
             rec.message ||
             rec.metric ||
             rec.text ||
             '';
    })
    .filter(Boolean);
}

async function _getLuciAnomalyInsights(anomalies) {
  try {
    // detectAnomaliesAI devuelve summary OBJETO (con topPriority) + anomalies + alertsGenerated
    const analysis = await aiService.detectAnomaliesAI({
      detectedAnomalies: anomalies.slice(0, 5),
      context: 'Anomalías ya detectadas por algoritmo. Generar insights y recomendaciones de acción.'
    }, {});

    // El summary del prompt es un objeto {criticalCount, highCount, ..., topPriority}.
    // Para mantener API string-friendly, extraer topPriority como summary.
    let summary;
    if (typeof analysis.summary === 'string') {
      summary = analysis.summary;
    } else if (analysis.summary && typeof analysis.summary === 'object') {
      summary = analysis.summary.topPriority ||
        `Anomalías detectadas: ${analysis.summary.criticalCount || 0} críticas, ${analysis.summary.highCount || 0} altas, ${analysis.summary.mediumCount || 0} medias.`;
    } else {
      summary = analysis.executiveSummary || `Se han detectado ${anomalies.length} anomalías.`;
    }

    // Recomendaciones: combinar recommendedActions[] de cada anomalía + alertsGenerated
    const recsRaw = [
      ...(Array.isArray(analysis.anomalies)
        ? analysis.anomalies.flatMap(a => Array.isArray(a.recommendedActions) ? a.recommendedActions : [a.recommendedAction || a.suggestedAction])
        : []),
      ...(Array.isArray(analysis.alertsGenerated) ? analysis.alertsGenerated : []),
      ...(Array.isArray(analysis.recommendations) ? analysis.recommendations : [])
    ].filter(Boolean);
    const recommendations = _normalizeRecommendations(recsRaw);

    return {
      summary,
      recommendations: recommendations.length > 0 ? recommendations : ['Investigar anomalías detectadas'],
      priority: anomalies.some(a => a.severity > 2) ? 'high' : 'medium'
    };
  } catch (error) {
    logger.warn(`[Predictions] Could not get LUCI anomaly insights: ${error.message}`);
    return null;
  }
}

async function _getLuciTrendInsights(trends, forecasts) {
  try {
    // predictTrendsAI devuelve predictions[], keyPredictions[], recommendations[], limitations[], modelConfidence
    const analysis = await aiService.predictTrendsAI({
      trends,
      forecasts
    }, 30);

    // Construir summary a partir de keyPredictions o fallback
    let summary = analysis.executiveSummary || analysis.summary;
    if (!summary && Array.isArray(analysis.keyPredictions) && analysis.keyPredictions.length > 0) {
      const first = analysis.keyPredictions[0];
      summary = first.description || first.prediction || first.text;
    }
    if (!summary && analysis.modelConfidence) {
      summary = `Tendencias analizadas con confianza ${analysis.modelConfidence}. ${analysis.predictions?.length || 0} métricas proyectadas.`;
    }
    summary = summary || 'Tendencias analizadas correctamente.';

    const keyInsights = _normalizeRecommendations([
      ...(Array.isArray(analysis.keyPredictions) ? analysis.keyPredictions : []),
      ...(Array.isArray(analysis.recommendations) ? analysis.recommendations : []),
      ...(Array.isArray(analysis.insights) ? analysis.insights : [])
    ]);

    const actionItems = _normalizeRecommendations([
      ...(Array.isArray(analysis.inflectionPoints) ? analysis.inflectionPoints : []),
      ...(Array.isArray(analysis.alerts) ? analysis.alerts : []),
      ...(Array.isArray(analysis.limitations) ? analysis.limitations : [])
    ]);

    return {
      summary,
      keyInsights,
      actionItems
    };
  } catch (error) {
    logger.warn(`[Predictions] Could not get LUCI trend insights: ${error.message}`);
    return null;
  }
}

module.exports = {
  // Constants
  PREDICTION_TYPES,
  CONFIDENCE_LEVELS,
  ANOMALY_TYPES,

  // Prediction methods
  predictChannel,
  predictInspection,
  predictDuties,
  detectAnomalies,
  analyzeTrends,

  // Model info
  getModelMetrics
};
