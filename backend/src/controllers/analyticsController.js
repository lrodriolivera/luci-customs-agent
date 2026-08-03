/**
 * Analytics Controller
 * Phase 6.2: Analytics and Business Intelligence
 *
 * HTTP endpoints for analytics, reports, KPIs, and predictions
 */

const { analyticsService, reportsService, kpiService, predictionsService } = require('../services/analytics');
const realMetrics = require('../services/analytics/realMetricsService');
const aiService = require('../services/aiService');
const logger = require('../config/logger');

// ==================== Dashboard & Metrics ====================

/**
 * Get dashboard metrics
 * GET /api/analytics/dashboard
 */
async function getDashboardMetrics(req, res) {
  try {
    const { startDate, endDate } = req.query;

    // Agregaciones reales sobre la BD. Antes esto devolvia
    // _generateMetricValue(150, 300) declaraciones cuando en la base habia 35,
    // y la cifra cambiaba en cada recarga. Las secciones que no se pueden
    // calcular hoy vienen con { disponible: false, motivo }, nunca con un
    // numero inventado.
    const data = await realMetrics.cuadroDeMando(req.user?.tenantId, {
      desde: startDate,
      hasta: endDate
    });

    res.json({ success: true, data });
  } catch (error) {
    logger.error(`[AnalyticsController] Dashboard error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Responde 501 a una metrica que aun no se puede calcular.
 *
 * Se usa en vez de devolver un 200 con ceros o con datos simulados: un numero
 * falso en un panel acaba en una reunion con un cliente. El motivo va en la
 * respuesta y esta escrito para leerse sin contexto.
 */
function noImplementado(res, motivo) {
  return res.status(501).json({
    success: false,
    error: 'Metrica no disponible',
    reason: motivo,
    code: 'NOT_IMPLEMENTED'
  });
}

/**
 * Get real-time metrics
 * GET /api/analytics/realtime
 */
async function getRealTimeMetrics(req, res) {
  try {
    const metrics = analyticsService.getRealTimeMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error(`[AnalyticsController] Realtime metrics error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get declaration analytics
 * GET /api/analytics/declarations
 */
async function getDeclarationAnalytics(req, res) {
  try {
    const { period, startDate, endDate, includeAnalysis } = req.query;

    const result = await analyticsService.getDeclarationAnalytics(
      period || 'last_30_days',
      { startDate, endDate, includeAnalysis: includeAnalysis !== 'false' }
    );

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Declaration analytics error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get financial analytics
 * GET /api/analytics/financial
 */
async function getFinancialAnalytics(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const rango = { desde: startDate, hasta: endDate };
    const tenantId = req.user?.tenantId;

    const [derechos, recaudacion, valor] = await Promise.all([
      realMetrics.derechosLiquidados(tenantId, rango),
      realMetrics.recaudacionCobrada(tenantId, rango),
      realMetrics.valorMercancia(tenantId, rango)
    ]);

    // Lo LIQUIDADO si se calcula (sale de las declaraciones). Lo COBRADO no,
    // mientras no haya pagos registrados: sin ese dato la analitica financiera
    // no significa nada, asi que el endpoint entero responde 501 en vez de
    // devolver medias verdades.
    if (!recaudacion.disponible) {
      return noImplementado(res, recaudacion.motivo);
    }

    res.json({
      success: true,
      data: { simulated: false, derechosLiquidados: derechos, recaudacion, valorMercancia: valor }
    });
  } catch (error) {
    logger.error(`[AnalyticsController] Financial analytics error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get compliance analytics
 * GET /api/analytics/compliance
 */
async function getComplianceAnalytics(req, res) {
  try {
    const { period, startDate, endDate, includeAnalysis } = req.query;

    const result = await analyticsService.getComplianceAnalytics(
      period || 'last_30_days',
      { startDate, endDate, includeAnalysis: includeAnalysis !== 'false' }
    );

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Compliance analytics error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get performance analytics
 * GET /api/analytics/performance
 */
async function getPerformanceAnalytics(req, res) {
  try {
    const { period, startDate, endDate } = req.query;

    const result = await analyticsService.getPerformanceAnalytics(
      period || 'last_30_days',
      { startDate, endDate }
    );

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Performance analytics error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get comparison report
 * GET /api/analytics/compare
 */
async function getComparisonReport(req, res) {
  try {
    const { period1, period2, includeAnalysis } = req.query;

    if (!period1 || !period2) {
      return res.status(400).json({
        success: false,
        error: 'Both period1 and period2 are required'
      });
    }

    const result = await analyticsService.getComparisonReport(
      period1,
      period2,
      { includeAnalysis: includeAnalysis !== 'false' }
    );

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Comparison error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Execute custom analytics query
 * POST /api/analytics/query
 */
async function executeQuery(req, res) {
  try {
    const query = req.body;

    if (!query.metrics || !Array.isArray(query.metrics)) {
      return res.status(400).json({
        success: false,
        error: 'Query must include metrics array'
      });
    }

    const result = await analyticsService.queryAnalytics(query);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Query error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ==================== Reports ====================

/**
 * Generate a report
 * POST /api/analytics/reports/generate
 */
async function generateReport(req, res) {
  try {
    const { type, period, format, title, subtitle, includeLuciAnalysis } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Report type is required'
      });
    }

    const result = await reportsService.generateReport(type, {
      period,
      format: format || 'pdf',
      title,
      subtitle,
      includeLuciAnalysis: includeLuciAnalysis !== false,
      userId: req.user?.id
    });

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Generate report error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get report by ID
 * GET /api/analytics/reports/:id
 */
async function getReport(req, res) {
  try {
    const { id } = req.params;
    const result = reportsService.getReport(id, req.user?.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Get report error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * List reports
 * GET /api/analytics/reports
 */
async function listReports(req, res) {
  try {
    const { type, period, page, limit } = req.query;

    const result = reportsService.listReports({
      type,
      period,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      userId: req.user?.id
    });

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] List reports error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Download report
 * GET /api/analytics/reports/:id/download
 */
async function downloadReport(req, res) {
  try {
    const { id } = req.params;
    const { format } = req.query;

    const result = await reportsService.exportReport(id, format || 'pdf', req.user?.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    logger.error(`[AnalyticsController] Download report error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Delete report
 * DELETE /api/analytics/reports/:id
 */
async function deleteReport(req, res) {
  try {
    const { id } = req.params;
    const result = reportsService.deleteReport(id, req.user?.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Delete report error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get available report types
 * GET /api/analytics/reports/types
 */
async function getReportTypes(req, res) {
  try {
    const types = reportsService.getAvailableReportTypes();
    res.json({ success: true, types });
  } catch (error) {
    logger.error(`[AnalyticsController] Get report types error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Preview report
 * POST /api/analytics/reports/preview
 */
async function previewReport(req, res) {
  try {
    const { type, period } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Report type is required'
      });
    }

    const result = await reportsService.previewReport(type, { period });
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Preview report error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Schedule recurring report
 * POST /api/analytics/reports/schedule
 */
async function scheduleReport(req, res) {
  try {
    const config = req.body;

    if (!config.type || !config.frequency) {
      return res.status(400).json({
        success: false,
        error: 'Report type and frequency are required'
      });
    }

    const result = reportsService.scheduleReport(config);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Schedule report error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ==================== KPIs ====================

/**
 * Get KPI dashboard
 * GET /api/analytics/kpis/dashboard
 */
async function getKPIDashboard(req, res) {
  try {
    const result = await kpiService.getKPIDashboard();
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] KPI dashboard error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get all KPIs
 * GET /api/analytics/kpis
 */
async function getAllKPIs(req, res) {
  try {
    const result = await kpiService.getAllKPIs();
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Get all KPIs error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get KPI definitions
 * GET /api/analytics/kpis/definitions
 */
async function getKPIDefinitions(req, res) {
  try {
    const { category } = req.query;

    const definitions = category
      ? kpiService.getKPIsByCategory(category)
      : kpiService.getKPIDefinitions();

    res.json({ success: true, definitions });
  } catch (error) {
    logger.error(`[AnalyticsController] Get KPI definitions error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Calculate specific KPI
 * GET /api/analytics/kpis/:id
 */
async function calculateKPI(req, res) {
  try {
    const { id } = req.params;
    const data = req.query;

    const result = await kpiService.calculateKPI(id, data);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Calculate KPI error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get KPI history
 * GET /api/analytics/kpis/:id/history
 */
async function getKPIHistory(req, res) {
  try {
    const { id } = req.params;
    const { period } = req.query;

    const result = kpiService.getKPIHistory(id, period || 'last_30_days');
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Get KPI history error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Set custom KPI target
 * PUT /api/analytics/kpis/:id/target
 */
async function setKPITarget(req, res) {
  try {
    const { id } = req.params;
    const { target } = req.body;

    if (target === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Target value is required'
      });
    }

    const result = kpiService.setKPITarget(id, target);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Set KPI target error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Compare KPIs between periods
 * GET /api/analytics/kpis/compare
 */
async function compareKPIs(req, res) {
  try {
    const { period1, period2 } = req.query;

    if (!period1 || !period2) {
      return res.status(400).json({
        success: false,
        error: 'Both period1 and period2 are required'
      });
    }

    const result = await kpiService.compareKPIs(period1, period2);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Compare KPIs error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get active alerts
 * GET /api/analytics/kpis/alerts
 */
async function getKPIAlerts(req, res) {
  try {
    const { severity, category, kpiId } = req.query;
    const result = kpiService.getActiveAlerts({ severity, category, kpiId });
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Get KPI alerts error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Acknowledge alert
 * POST /api/analytics/kpis/alerts/:id/acknowledge
 */
async function acknowledgeKPIAlert(req, res) {
  try {
    const { id } = req.params;
    const result = kpiService.acknowledgeAlert(id, req.user?.id || 'system');
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Acknowledge alert error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Dismiss alert
 * DELETE /api/analytics/kpis/alerts/:id
 */
async function dismissKPIAlert(req, res) {
  try {
    const { id } = req.params;
    const result = kpiService.dismissAlert(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Dismiss alert error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ==================== Predictions ====================

/**
 * Predict volume
 * POST /api/analytics/predictions/volume
 */
async function predictVolume(req, res) {
  try {
    // predictionsService.predictVolume construye la serie con
    // baseVolume * seasonalFactor * dayFactor * (0.9 + Math.random() * 0.2):
    // no es un pronostico, es ruido alrededor de un valor que ademas entra por
    // el body. Presentarlo con un "nivel de confianza" es peor que no darlo.
    //
    // Para proyectar de verdad hacen falta al menos 90 dias de historico; en la
    // base hay declaraciones desde mayo de 2026, pero sin volumen suficiente
    // por dia. Se reactivara cuando lo haya.
    return noImplementado(res, realMetrics.NO_DISPONIBLE.SIN_HISTORICO);
  } catch (error) {
    logger.error(`[AnalyticsController] Predict volume error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Predict channel
 * POST /api/analytics/predictions/channel
 */
async function predictChannel(req, res) {
  try {
    const declarationData = req.body;

    if (!declarationData) {
      return res.status(400).json({
        success: false,
        error: 'Declaration data is required'
      });
    }

    const result = await predictionsService.predictChannel(declarationData);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Predict channel error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Predict inspection
 * POST /api/analytics/predictions/inspection
 */
async function predictInspection(req, res) {
  try {
    const declarationData = req.body;

    if (!declarationData) {
      return res.status(400).json({
        success: false,
        error: 'Declaration data is required'
      });
    }

    const result = await predictionsService.predictInspection(declarationData);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Predict inspection error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Predict processing time
 * POST /api/analytics/predictions/processing-time
 */
async function predictProcessingTime(req, res) {
  try {
    // baseTime * (0.9 + Math.random() * 0.2), con la confianza tambien
    // aleatoria (_getConfidenceLevel(75 + Math.random() * 15)).
    //
    // El tiempo REAL de despacho si se mide y esta en el cuadro de mando:
    // GET /api/analytics/dashboard -> tiempos.mediaHoras, calculado de
    // submittedAt a releasedAt. Eso es un dato; esto era una simulacion.
    return noImplementado(res, realMetrics.NO_DISPONIBLE.SIN_MODELO);
  } catch (error) {
    logger.error(`[AnalyticsController] Predict processing time error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Predict duties
 * POST /api/analytics/predictions/duties
 */
async function predictDuties(req, res) {
  try {
    const declarationData = req.body;

    if (!declarationData.customsValue) {
      return res.status(400).json({
        success: false,
        error: 'Customs value is required'
      });
    }

    const result = await predictionsService.predictDuties(declarationData);
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Predict duties error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Detect anomalies
 * POST /api/analytics/predictions/anomalies
 */
async function detectAnomalies(req, res) {
  try {
    const { data, threshold } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required for anomaly detection'
      });
    }

    const result = await predictionsService.detectAnomalies(data, { threshold });
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Detect anomalies error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Analyze trends
 * POST /api/analytics/predictions/trends
 */
async function analyzeTrends(req, res) {
  try {
    const { data, period } = req.body;

    const result = await predictionsService.analyzeTrends(data || {}, { period });
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Analyze trends error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get model metrics
 * GET /api/analytics/predictions/models
 */
async function getModelMetrics(req, res) {
  try {
    const result = predictionsService.getModelMetrics();
    res.json(result);
  } catch (error) {
    logger.error(`[AnalyticsController] Get model metrics error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ==================== AI Endpoints - LUCI Integration ====================

/**
 * Generate automatic insights from analytics data
 * POST /api/analytics/ai/insights
 */
async function aiGenerateInsights(req, res) {
  try {
    const { analyticsData, context } = req.body;

    if (!analyticsData) {
      return res.status(400).json({
        success: false,
        error: 'analyticsData es requerido'
      });
    }

    const result = await aiService.generateAutomaticInsights(analyticsData, context || {});

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[AnalyticsController] AI insights error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Detect anomalies with AI
 * POST /api/analytics/ai/anomalies
 */
async function aiDetectAnomalies(req, res) {
  try {
    const { data, thresholds } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'data es requerido'
      });
    }

    const result = await aiService.detectAnomaliesAI(data, thresholds || {});

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[AnalyticsController] AI anomalies error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Predict trends with AI
 * POST /api/analytics/ai/trends
 */
async function aiPredictTrends(req, res) {
  try {
    const { historicalData, horizon } = req.body;

    if (!historicalData) {
      return res.status(400).json({
        success: false,
        error: 'historicalData es requerido'
      });
    }

    const result = await aiService.predictTrendsAI(historicalData, horizon || 30);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[AnalyticsController] AI trends error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Generate executive report with AI
 * POST /api/analytics/ai/executive-report
 */
async function aiGenerateExecutiveReport(req, res) {
  try {
    const { analyticsData, options } = req.body;

    if (!analyticsData) {
      return res.status(400).json({
        success: false,
        error: 'analyticsData es requerido'
      });
    }

    const result = await aiService.generateExecutiveReport(analyticsData, options || {});

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[AnalyticsController] AI executive report error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Analyze KPI deviations with AI
 * POST /api/analytics/ai/kpi-analysis
 */
async function aiAnalyzeKPIDeviations(req, res) {
  try {
    const { kpiData, targets } = req.body;

    if (!kpiData) {
      return res.status(400).json({
        success: false,
        error: 'kpiData es requerido'
      });
    }

    const result = await aiService.analyzeKPIDeviations(kpiData, targets || {});

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[AnalyticsController] AI KPI analysis error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Full analytics analysis with AI
 * POST /api/analytics/ai/full-analysis
 */
async function aiFullAnalysis(req, res) {
  try {
    const { analyticsData, options } = req.body;

    if (!analyticsData) {
      return res.status(400).json({
        success: false,
        error: 'analyticsData es requerido'
      });
    }

    const result = await aiService.fullAnalyticsAnalysis(analyticsData, options || {});

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`[AnalyticsController] AI full analysis error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  // Dashboard & Metrics
  getDashboardMetrics,
  getRealTimeMetrics,
  getDeclarationAnalytics,
  getFinancialAnalytics,
  getComplianceAnalytics,
  getPerformanceAnalytics,
  getComparisonReport,
  executeQuery,

  // Reports
  generateReport,
  getReport,
  listReports,
  downloadReport,
  deleteReport,
  getReportTypes,
  previewReport,
  scheduleReport,

  // KPIs
  getKPIDashboard,
  getAllKPIs,
  getKPIDefinitions,
  calculateKPI,
  getKPIHistory,
  setKPITarget,
  compareKPIs,
  getKPIAlerts,
  acknowledgeKPIAlert,
  dismissKPIAlert,

  // Predictions
  predictVolume,
  predictChannel,
  predictInspection,
  predictProcessingTime,
  predictDuties,
  detectAnomalies,
  analyzeTrends,
  getModelMetrics,

  // AI - LUCI Integration
  aiGenerateInsights,
  aiDetectAnomalies,
  aiPredictTrends,
  aiGenerateExecutiveReport,
  aiAnalyzeKPIDeviations,
  aiFullAnalysis
};
