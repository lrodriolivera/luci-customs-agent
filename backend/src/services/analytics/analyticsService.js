/**
 * Analytics Service
 * Phase 6.2: Analytics and Business Intelligence
 *
 * Provides data aggregation, metrics calculation, and trend analysis
 * with LUCI AI-powered insights
 */

const logger = require('../../config/logger');
const aiService = require('../aiService');

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
 * Filter data by date range
 */
function filterByDateRange(data, dateRange) {
  return data.filter(item => {
    const itemDate = new Date(item.timestamp || item.createdAt || item.date);
    return itemDate >= dateRange.start && itemDate <= dateRange.end;
  });
}

/**
 * Get dashboard summary metrics
 */
async function getDashboardMetrics(period = TIME_PERIODS.LAST_30_DAYS, options = {}) {
  try {
    const dateRange = getDateRange(period, options.startDate, options.endDate);

    // Simulated metrics (in production, aggregate from database)
    const metrics = {
      period: {
        name: period,
        start: dateRange.start,
        end: dateRange.end
      },

      // Operations metrics
      operations: {
        totalDeclarations: _generateMetricValue(150, 300),
        declarationsByType: {
          H1: _generateMetricValue(50, 100),
          H7: _generateMetricValue(30, 80),
          AES: _generateMetricValue(20, 50),
          NCTS: _generateMetricValue(15, 40),
          ICS2: _generateMetricValue(10, 30)
        },
        totalExpeditions: _generateMetricValue(80, 150),
        activeExpeditions: _generateMetricValue(20, 50),
        completedExpeditions: _generateMetricValue(60, 120),
        averageProcessingTime: _generateMetricValue(2, 8) // hours
      },

      // Channel distribution
      channels: {
        green: _generateMetricValue(60, 75),
        orange: _generateMetricValue(15, 25),
        red: _generateMetricValue(5, 15),
        yellow: _generateMetricValue(2, 8)
      },

      // Financial metrics
      financial: {
        totalDutiesCalculated: _generateMetricValue(500000, 2000000),
        totalDutiesPaid: _generateMetricValue(450000, 1800000),
        averageDutyPerDeclaration: _generateMetricValue(3000, 15000),
        guaranteesUtilization: _generateMetricValue(40, 80),
        potentialSavings: _generateMetricValue(10000, 50000)
      },

      // Compliance metrics
      compliance: {
        errorRate: _generateMetricValue(1, 5),
        rejectionRate: _generateMetricValue(0.5, 3),
        documentCompleteness: _generateMetricValue(92, 99),
        onTimeSubmissions: _generateMetricValue(90, 98),
        inspectionRate: _generateMetricValue(5, 15)
      },

      // Performance metrics
      performance: {
        averageResponseTime: _generateMetricValue(1, 5), // seconds
        systemUptime: _generateMetricValue(99, 99.9),
        aeatConnectivity: _generateMetricValue(95, 99.5),
        luciAccuracy: _generateMetricValue(92, 98)
      }
    };

    // Calculate trends
    metrics.trends = await _calculateTrends(metrics, period);

    // Get LUCI insights
    if (options.includeInsights !== false) {
      metrics.luciInsights = await _getLuciInsights(metrics);
    }

    logger.info(`[Analytics] Dashboard metrics generated for period: ${period}`);
    return { success: true, data: metrics };

  } catch (error) {
    logger.error(`[Analytics] Error getting dashboard metrics: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get declaration analytics
 */
async function getDeclarationAnalytics(period = TIME_PERIODS.LAST_30_DAYS, options = {}) {
  try {
    const dateRange = getDateRange(period, options.startDate, options.endDate);

    const analytics = {
      period: { name: period, start: dateRange.start, end: dateRange.end },

      summary: {
        total: _generateMetricValue(150, 300),
        submitted: _generateMetricValue(140, 290),
        accepted: _generateMetricValue(130, 280),
        rejected: _generateMetricValue(5, 15),
        pending: _generateMetricValue(10, 25)
      },

      byType: {
        H1: { count: _generateMetricValue(50, 100), accepted: _generateMetricValue(45, 95), avgProcessingTime: _generateMetricValue(2, 6) },
        H7: { count: _generateMetricValue(40, 80), accepted: _generateMetricValue(38, 78), avgProcessingTime: _generateMetricValue(0.5, 2) },
        AES: { count: _generateMetricValue(25, 50), accepted: _generateMetricValue(24, 48), avgProcessingTime: _generateMetricValue(1, 4) },
        NCTS: { count: _generateMetricValue(20, 40), accepted: _generateMetricValue(19, 38), avgProcessingTime: _generateMetricValue(1, 3) },
        ICS2: { count: _generateMetricValue(15, 30), accepted: _generateMetricValue(14, 28), avgProcessingTime: _generateMetricValue(1, 5) }
      },

      byChannel: {
        green: { count: _generateMetricValue(100, 200), percentage: _generateMetricValue(65, 75) },
        orange: { count: _generateMetricValue(30, 60), percentage: _generateMetricValue(15, 25) },
        red: { count: _generateMetricValue(10, 25), percentage: _generateMetricValue(5, 12) },
        yellow: { count: _generateMetricValue(5, 15), percentage: _generateMetricValue(2, 8) }
      },

      byOffice: [
        { code: 'ES002801', name: 'Barcelona Puerto', count: _generateMetricValue(40, 80) },
        { code: 'ES004611', name: 'Valencia Puerto', count: _generateMetricValue(35, 70) },
        { code: 'ES002101', name: 'Madrid Barajas', count: _generateMetricValue(30, 60) },
        { code: 'ES002901', name: 'Algeciras Puerto', count: _generateMetricValue(25, 50) },
        { code: 'ES004801', name: 'Bilbao Puerto', count: _generateMetricValue(20, 40) }
      ],

      timeline: _generateTimeline(dateRange, 'declarations'),

      topCommodities: [
        { code: '8517120000', description: 'Teléfonos móviles', count: _generateMetricValue(20, 40) },
        { code: '8471300000', description: 'Ordenadores portátiles', count: _generateMetricValue(15, 35) },
        { code: '6204430000', description: 'Vestidos de fibras sintéticas', count: _generateMetricValue(12, 30) },
        { code: '9403200000', description: 'Muebles de metal', count: _generateMetricValue(10, 25) },
        { code: '8528720000', description: 'Aparatos receptores de TV', count: _generateMetricValue(8, 20) }
      ],

      topOrigins: [
        { country: 'CN', name: 'China', count: _generateMetricValue(50, 100), value: _generateMetricValue(500000, 1500000) },
        { country: 'US', name: 'Estados Unidos', count: _generateMetricValue(25, 50), value: _generateMetricValue(300000, 800000) },
        { country: 'DE', name: 'Alemania', count: _generateMetricValue(20, 40), value: _generateMetricValue(200000, 600000) },
        { country: 'JP', name: 'Japón', count: _generateMetricValue(15, 30), value: _generateMetricValue(150000, 400000) },
        { country: 'KR', name: 'Corea del Sur', count: _generateMetricValue(10, 25), value: _generateMetricValue(100000, 300000) }
      ]
    };

    // LUCI analysis
    if (options.includeAnalysis !== false) {
      analytics.luciAnalysis = await _analyzeDeclarationTrends(analytics);
    }

    return { success: true, data: analytics };

  } catch (error) {
    logger.error(`[Analytics] Error getting declaration analytics: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get financial analytics
 */
async function getFinancialAnalytics(period = TIME_PERIODS.LAST_30_DAYS, options = {}) {
  try {
    const dateRange = getDateRange(period, options.startDate, options.endDate);

    const analytics = {
      period: { name: period, start: dateRange.start, end: dateRange.end },

      summary: {
        totalCustomsValue: _generateMetricValue(5000000, 15000000),
        totalDuties: _generateMetricValue(500000, 2000000),
        totalVAT: _generateMetricValue(800000, 2500000),
        totalExcise: _generateMetricValue(100000, 500000),
        totalCharges: _generateMetricValue(1400000, 5000000)
      },

      duties: {
        byType: {
          adValorem: _generateMetricValue(400000, 1500000),
          specific: _generateMetricValue(50000, 300000),
          mixed: _generateMetricValue(50000, 200000)
        },
        averageRate: _generateMetricValue(5, 12),
        highestRate: { code: '2402200000', description: 'Cigarrillos', rate: 26.9 },
        lowestRate: { code: '8471300000', description: 'Ordenadores', rate: 0 }
      },

      savings: {
        fromPreferences: _generateMetricValue(20000, 100000),
        fromQuotas: _generateMetricValue(5000, 30000),
        fromSpecialRegimes: _generateMetricValue(10000, 50000),
        potential: _generateMetricValue(15000, 80000)
      },

      guarantees: {
        totalActive: _generateMetricValue(500000, 2000000),
        utilized: _generateMetricValue(200000, 800000),
        available: _generateMetricValue(300000, 1200000),
        utilizationRate: _generateMetricValue(30, 60)
      },

      byClient: [
        { name: 'Importaciones ABC S.L.', value: _generateMetricValue(500000, 1500000), duties: _generateMetricValue(50000, 150000) },
        { name: 'Tech Import S.A.', value: _generateMetricValue(400000, 1200000), duties: _generateMetricValue(20000, 60000) },
        { name: 'Moda Express S.L.', value: _generateMetricValue(300000, 900000), duties: _generateMetricValue(36000, 108000) },
        { name: 'Industrial Parts S.A.', value: _generateMetricValue(250000, 750000), duties: _generateMetricValue(12500, 37500) },
        { name: 'Food Import S.L.', value: _generateMetricValue(200000, 600000), duties: _generateMetricValue(30000, 90000) }
      ],

      timeline: _generateTimeline(dateRange, 'financial'),

      projections: {
        nextMonth: {
          estimatedValue: _generateMetricValue(4500000, 16000000),
          estimatedDuties: _generateMetricValue(450000, 2100000),
          confidence: _generateMetricValue(75, 90)
        },
        nextQuarter: {
          estimatedValue: _generateMetricValue(15000000, 50000000),
          estimatedDuties: _generateMetricValue(1500000, 6500000),
          confidence: _generateMetricValue(60, 80)
        }
      }
    };

    // LUCI financial insights
    if (options.includeInsights !== false) {
      analytics.luciInsights = await _analyzeFinancialTrends(analytics);
    }

    return { success: true, data: analytics };

  } catch (error) {
    logger.error(`[Analytics] Error getting financial analytics: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get compliance analytics
 */
async function getComplianceAnalytics(period = TIME_PERIODS.LAST_30_DAYS, options = {}) {
  try {
    const dateRange = getDateRange(period, options.startDate, options.endDate);

    const analytics = {
      period: { name: period, start: dateRange.start, end: dateRange.end },

      summary: {
        overallScore: _generateMetricValue(85, 98),
        riskLevel: _getRiskLevel(_generateMetricValue(85, 98)),
        trend: _generateMetricValue(-2, 5)
      },

      errors: {
        total: _generateMetricValue(10, 50),
        byCategory: {
          documentation: _generateMetricValue(3, 15),
          classification: _generateMetricValue(2, 10),
          valuation: _generateMetricValue(2, 10),
          origin: _generateMetricValue(1, 8),
          procedural: _generateMetricValue(2, 12)
        },
        mostCommon: [
          { code: 'DOC_MISSING', description: 'Documento faltante', count: _generateMetricValue(5, 20) },
          { code: 'TARIC_INVALID', description: 'Código TARIC inválido', count: _generateMetricValue(3, 15) },
          { code: 'VALUE_MISMATCH', description: 'Discrepancia en valor', count: _generateMetricValue(2, 10) },
          { code: 'ORIGIN_UNVERIFIED', description: 'Origen no verificable', count: _generateMetricValue(1, 8) }
        ],
        errorRate: _generateMetricValue(1, 5)
      },

      rejections: {
        total: _generateMetricValue(5, 25),
        byReason: {
          invalidData: _generateMetricValue(2, 10),
          missingDocuments: _generateMetricValue(1, 8),
          signatureError: _generateMetricValue(1, 5),
          other: _generateMetricValue(1, 5)
        },
        rejectionRate: _generateMetricValue(0.5, 3)
      },

      inspections: {
        total: _generateMetricValue(15, 50),
        physical: _generateMetricValue(5, 20),
        documentary: _generateMetricValue(10, 30),
        findings: _generateMetricValue(2, 10),
        clearanceRate: _generateMetricValue(85, 95)
      },

      deadlines: {
        onTime: _generateMetricValue(90, 98),
        late: _generateMetricValue(2, 10),
        averageMargin: _generateMetricValue(12, 48) // hours
      },

      oeaStatus: {
        current: 'AEOC',
        score: _generateMetricValue(88, 97),
        nextAudit: _getNextAuditDate(),
        recommendations: _generateMetricValue(0, 3)
      },

      riskIndicators: [
        { name: 'Clasificación incorrecta', score: _generateMetricValue(10, 30), trend: 'stable' },
        { name: 'Subvaloración', score: _generateMetricValue(5, 20), trend: 'improving' },
        { name: 'Origen falso', score: _generateMetricValue(5, 15), trend: 'stable' },
        { name: 'Documentación incompleta', score: _generateMetricValue(15, 35), trend: 'worsening' }
      ]
    };

    // LUCI compliance analysis
    if (options.includeAnalysis !== false) {
      analytics.luciAnalysis = await _analyzeCompliance(analytics);
    }

    return { success: true, data: analytics };

  } catch (error) {
    logger.error(`[Analytics] Error getting compliance analytics: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get performance analytics
 */
async function getPerformanceAnalytics(period = TIME_PERIODS.LAST_30_DAYS, options = {}) {
  try {
    const dateRange = getDateRange(period, options.startDate, options.endDate);

    const analytics = {
      period: { name: period, start: dateRange.start, end: dateRange.end },

      system: {
        uptime: _generateMetricValue(99, 99.99),
        responseTime: {
          average: _generateMetricValue(100, 500), // ms
          p95: _generateMetricValue(300, 1000),
          p99: _generateMetricValue(500, 2000)
        },
        errorRate: _generateMetricValue(0.1, 1),
        throughput: _generateMetricValue(50, 200) // requests/min
      },

      aeatConnectivity: {
        availability: _generateMetricValue(95, 99.5),
        averageLatency: _generateMetricValue(500, 2000), // ms
        failedRequests: _generateMetricValue(1, 10),
        successRate: _generateMetricValue(95, 99)
      },

      luciPerformance: {
        classificationsProcessed: _generateMetricValue(200, 500),
        accuracy: _generateMetricValue(92, 98),
        averageResponseTime: _generateMetricValue(1, 5), // seconds
        confidenceScore: _generateMetricValue(85, 95)
      },

      userActivity: {
        activeUsers: _generateMetricValue(5, 20),
        totalSessions: _generateMetricValue(100, 500),
        averageSessionDuration: _generateMetricValue(15, 60), // minutes
        peakHours: ['09:00-10:00', '14:00-15:00', '16:00-17:00']
      },

      processingTimes: {
        declarationCreation: _generateMetricValue(5, 20), // minutes
        documentUpload: _generateMetricValue(30, 120), // seconds
        signatureGeneration: _generateMetricValue(1, 5), // seconds
        aeatSubmission: _generateMetricValue(2, 10), // seconds
        statusUpdate: _generateMetricValue(1, 5) // seconds
      },

      efficiency: {
        automationRate: _generateMetricValue(60, 85),
        manualInterventions: _generateMetricValue(10, 30),
        averageHandlingTime: _generateMetricValue(15, 45), // minutes
        firstTimeResolution: _generateMetricValue(80, 95)
      },

      timeline: _generateTimeline(dateRange, 'performance')
    };

    return { success: true, data: analytics };

  } catch (error) {
    logger.error(`[Analytics] Error getting performance analytics: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get real-time metrics
 */
function getRealTimeMetrics() {
  return {
    timestamp: new Date(),

    activeDeclarations: _generateMetricValue(5, 20),
    pendingSubmissions: _generateMetricValue(2, 10),

    aeatStatus: {
      connected: true,
      lastCheck: new Date(Date.now() - _generateMetricValue(1, 5) * 60000),
      latency: _generateMetricValue(200, 800)
    },

    recentActivity: [
      { type: 'declaration_submitted', mrn: `26ES${Date.now().toString().slice(-10)}`, time: new Date(Date.now() - 120000) },
      { type: 'channel_assigned', mrn: `26ES${Date.now().toString().slice(-10)}1`, channel: 'green', time: new Date(Date.now() - 300000) },
      { type: 'document_uploaded', expedition: 'EXP-001', time: new Date(Date.now() - 600000) }
    ],

    alerts: {
      critical: _generateMetricValue(0, 2),
      warning: _generateMetricValue(1, 5),
      info: _generateMetricValue(2, 10)
    },

    queueStatus: {
      submissions: _generateMetricValue(0, 5),
      processing: _generateMetricValue(1, 8),
      completed: _generateMetricValue(10, 50)
    }
  };
}

/**
 * Generate comparison report between two periods
 */
async function getComparisonReport(period1, period2, options = {}) {
  try {
    const [metrics1, metrics2] = await Promise.all([
      getDashboardMetrics(period1, { ...options, includeInsights: false }),
      getDashboardMetrics(period2, { ...options, includeInsights: false })
    ]);

    if (!metrics1.success || !metrics2.success) {
      throw new Error('Failed to fetch metrics for comparison');
    }

    const comparison = {
      periods: {
        current: { name: period1, data: metrics1.data.period },
        previous: { name: period2, data: metrics2.data.period }
      },

      changes: {
        operations: _calculateChanges(metrics1.data.operations, metrics2.data.operations),
        financial: _calculateChanges(metrics1.data.financial, metrics2.data.financial),
        compliance: _calculateChanges(metrics1.data.compliance, metrics2.data.compliance),
        channels: _calculateChanges(metrics1.data.channels, metrics2.data.channels)
      },

      highlights: []
    };

    // Generate highlights
    comparison.highlights = _generateHighlights(comparison.changes);

    // LUCI comparison analysis
    if (options.includeAnalysis !== false) {
      comparison.luciAnalysis = await _analyzeComparison(comparison, metrics1.data, metrics2.data);
    }

    return { success: true, data: comparison };

  } catch (error) {
    logger.error(`[Analytics] Error generating comparison report: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get custom analytics query
 */
async function queryAnalytics(query) {
  try {
    const { metrics, dimensions, filters, period, groupBy } = query;

    const dateRange = getDateRange(period || TIME_PERIODS.LAST_30_DAYS);

    // Build result based on query parameters
    const result = {
      query,
      dateRange,
      data: [],
      aggregations: {}
    };

    // Simulate data based on requested metrics
    if (metrics.includes('declarations')) {
      result.aggregations.declarations = {
        total: _generateMetricValue(100, 300),
        byType: { H1: _generateMetricValue(40, 100), H7: _generateMetricValue(30, 80) }
      };
    }

    if (metrics.includes('value')) {
      result.aggregations.value = {
        total: _generateMetricValue(1000000, 5000000),
        average: _generateMetricValue(10000, 50000)
      };
    }

    if (metrics.includes('duties')) {
      result.aggregations.duties = {
        total: _generateMetricValue(100000, 500000),
        average: _generateMetricValue(1000, 5000)
      };
    }

    return { success: true, data: result };

  } catch (error) {
    logger.error(`[Analytics] Error executing custom query: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ==================== Helper Functions ====================

function _generateMetricValue(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _generateTimeline(dateRange, type) {
  const timeline = [];
  const days = Math.ceil((dateRange.end - dateRange.start) / (24 * 60 * 60 * 1000));
  const points = Math.min(days, 30);

  for (let i = 0; i < points; i++) {
    const date = new Date(dateRange.start);
    date.setDate(date.getDate() + Math.floor(i * days / points));

    timeline.push({
      date: date.toISOString().split('T')[0],
      value: _generateMetricValue(5, 20),
      ...(type === 'financial' && { amount: _generateMetricValue(50000, 200000) }),
      ...(type === 'performance' && { responseTime: _generateMetricValue(100, 500) })
    });
  }

  return timeline;
}

function _getRiskLevel(score) {
  if (score >= 90) return 'low';
  if (score >= 75) return 'medium';
  return 'high';
}

function _getNextAuditDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + _generateMetricValue(3, 12));
  return date.toISOString().split('T')[0];
}

async function _calculateTrends(metrics, period) {
  return {
    operations: { direction: 'up', percentage: _generateMetricValue(2, 15) },
    financial: { direction: 'up', percentage: _generateMetricValue(5, 20) },
    compliance: { direction: 'stable', percentage: _generateMetricValue(-2, 2) },
    performance: { direction: 'up', percentage: _generateMetricValue(1, 10) }
  };
}

async function _getLuciInsights(metrics) {
  try {
    const analyticsData = {
      operations: metrics.operations,
      channels: metrics.channels,
      compliance: metrics.compliance,
      financial: metrics.financial
    };

    const analysis = await aiService.generateAutomaticInsights(analyticsData, {
      period: 'last_30_days',
      operationType: 'all',
      comparison: false
    });

    // Normalizar shapes (executiveSummary/summary, keyInsights/insights)
    const summary = analysis.executiveSummary || analysis.summary;
    const keyInsights = analysis.keyInsights || analysis.insights || [];
    const opportunities = analysis.opportunities || [];
    const risks = analysis.risks || [];
    const recsRaw = analysis.recommendations || [];

    // Recomendaciones como strings legibles (manejar tanto strings como objetos)
    const recommendations = recsRaw.map(rec => {
      if (typeof rec === 'string') return rec;
      return rec.action || rec.recommendation || rec.description || JSON.stringify(rec);
    });

    // Alertas: keyInsights de tipo risk + risks
    const alerts = [
      ...keyInsights.filter(i => i.type === 'risk' || i.impact === 'HIGH').map(i => i.title || i.description),
      ...risks.map(r => r.risk || r.description || (typeof r === 'string' ? r : ''))
    ].filter(Boolean);

    // Oportunidades: del backend o keyInsights de tipo opportunity
    const oppList = [
      ...opportunities.map(o => o.description || o.area || (typeof o === 'string' ? o : '')),
      ...keyInsights.filter(i => i.type === 'opportunity').map(i => i.title || i.description)
    ].filter(Boolean);

    return {
      summary: summary || 'Operaciones dentro de parámetros normales.',
      recommendations,
      alerts,
      opportunities: oppList
    };
  } catch (error) {
    logger.warn(`[Analytics] Could not get LUCI insights: ${error.message}`);
    return {
      summary: 'Análisis de LUCI no disponible',
      recommendations: [],
      alerts: [],
      opportunities: []
    };
  }
}

async function _analyzeDeclarationTrends(analytics) {
  return {
    summary: 'Las declaraciones H1 representan el mayor volumen con una tendencia estable.',
    patterns: [
      'Mayor volumen de declaraciones los martes y miércoles',
      'Canal verde predominante (>65%) indica bajo perfil de riesgo',
      'China sigue siendo el principal origen de importaciones'
    ],
    recommendations: [
      'Considerar automatización de H7 para e-commerce',
      'Revisar clasificaciones frecuentes para crear plantillas'
    ]
  };
}

async function _analyzeFinancialTrends(analytics) {
  return {
    summary: `Volumen total de ${(analytics.summary.totalCustomsValue / 1000000).toFixed(1)}M EUR con tendencia positiva.`,
    insights: [
      'Margen de optimización identificado en preferencias arancelarias',
      'Uso de garantías por debajo del óptimo',
      'Impuestos especiales representan una porción menor'
    ],
    recommendations: [
      'Revisar elegibilidad de preferencias para principales orígenes',
      'Optimizar uso de garantías globales',
      'Evaluar regímenes especiales para importadores frecuentes'
    ]
  };
}

async function _analyzeCompliance(analytics) {
  return {
    summary: `Score de cumplimiento: ${analytics.summary.overallScore}% - Nivel ${analytics.summary.riskLevel}.`,
    concerns: analytics.summary.overallScore < 90 ? [
      'Tasa de errores documentales por encima del objetivo',
      'Se requiere atención a la completitud de documentación'
    ] : [],
    recommendations: [
      'Implementar validación previa de documentos',
      'Formación adicional en clasificación TARIC',
      'Revisar proceso de verificación de origen'
    ],
    oeaImpact: 'Sin impacto significativo en certificación OEA'
  };
}

async function _analyzeComparison(comparison, current, previous) {
  return {
    summary: 'Mejora general respecto al período anterior.',
    keyChanges: [
      comparison.changes.operations?.totalDeclarations > 0
        ? `Aumento del ${comparison.changes.operations.totalDeclarations}% en declaraciones`
        : `Disminución del ${Math.abs(comparison.changes.operations?.totalDeclarations || 0)}% en declaraciones`,
      'Canal verde mantiene predominancia'
    ],
    recommendations: [
      'Mantener tendencia positiva en cumplimiento',
      'Investigar incremento en tiempos de procesamiento'
    ]
  };
}

function _calculateChanges(current, previous) {
  const changes = {};

  for (const key in current) {
    if (typeof current[key] === 'number' && typeof previous[key] === 'number') {
      const change = previous[key] !== 0
        ? ((current[key] - previous[key]) / previous[key] * 100).toFixed(1)
        : 0;
      changes[key] = parseFloat(change);
    }
  }

  return changes;
}

function _generateHighlights(changes) {
  const highlights = [];

  if (changes.operations?.totalDeclarations > 10) {
    highlights.push({
      type: 'positive',
      message: `Incremento significativo en declaraciones (+${changes.operations.totalDeclarations}%)`
    });
  }

  if (changes.compliance?.errorRate < 0) {
    highlights.push({
      type: 'positive',
      message: 'Reducción en tasa de errores'
    });
  }

  if (changes.financial?.potentialSavings > 0) {
    highlights.push({
      type: 'opportunity',
      message: 'Ahorros potenciales identificados'
    });
  }

  return highlights;
}

module.exports = {
  // Constants
  TIME_PERIODS,
  METRIC_CATEGORIES,
  CHANNELS,

  // Data recording
  recordEvent,

  // Main analytics methods
  getDashboardMetrics,
  getDeclarationAnalytics,
  getFinancialAnalytics,
  getComplianceAnalytics,
  getPerformanceAnalytics,
  getRealTimeMetrics,
  getComparisonReport,
  queryAnalytics,

  // Utility
  getDateRange
};
