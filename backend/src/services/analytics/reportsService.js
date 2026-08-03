/**
 * Reports Service
 * Phase 6.2: Analytics and Business Intelligence
 *
 * Generates PDF and Excel reports for customs operations
 */

const logger = require('../../config/logger');
const analyticsService = require('./analyticsService');
const aiService = require('../aiService');

/**
 * Report types
 */
const REPORT_TYPES = {
  EXECUTIVE_SUMMARY: 'executive_summary',
  OPERATIONS_DETAIL: 'operations_detail',
  FINANCIAL_REPORT: 'financial_report',
  COMPLIANCE_REPORT: 'compliance_report',
  DECLARATION_REPORT: 'declaration_report',
  CLIENT_REPORT: 'client_report',
  CUSTOMS_STATISTICS: 'customs_statistics',
  AUDIT_TRAIL: 'audit_trail'
};

/**
 * Export formats
 */
const EXPORT_FORMATS = {
  PDF: 'pdf',
  EXCEL: 'xlsx',
  CSV: 'csv',
  JSON: 'json'
};

/**
 * Report templates configuration
 */
const REPORT_TEMPLATES = {
  [REPORT_TYPES.EXECUTIVE_SUMMARY]: {
    name: 'Resumen Ejecutivo',
    description: 'Resumen de alto nivel para dirección',
    sections: ['overview', 'kpis', 'trends', 'alerts', 'recommendations'],
    defaultPeriod: 'this_month'
  },
  [REPORT_TYPES.OPERATIONS_DETAIL]: {
    name: 'Detalle de Operaciones',
    description: 'Análisis detallado de todas las operaciones',
    sections: ['declarations', 'expeditions', 'channels', 'timeline', 'by_type'],
    defaultPeriod: 'last_30_days'
  },
  [REPORT_TYPES.FINANCIAL_REPORT]: {
    name: 'Informe Financiero',
    description: 'Análisis financiero de derechos e impuestos',
    sections: ['summary', 'duties', 'vat', 'savings', 'guarantees', 'projections'],
    defaultPeriod: 'this_month'
  },
  [REPORT_TYPES.COMPLIANCE_REPORT]: {
    name: 'Informe de Cumplimiento',
    description: 'Estado de cumplimiento normativo',
    sections: ['score', 'errors', 'rejections', 'inspections', 'risks', 'oea'],
    defaultPeriod: 'last_30_days'
  },
  [REPORT_TYPES.DECLARATION_REPORT]: {
    name: 'Informe de Declaraciones',
    description: 'Detalle de declaraciones aduaneras',
    sections: ['summary', 'by_type', 'by_channel', 'by_office', 'commodities', 'origins'],
    defaultPeriod: 'last_30_days'
  },
  [REPORT_TYPES.CLIENT_REPORT]: {
    name: 'Informe de Cliente',
    description: 'Resumen para cliente específico',
    sections: ['operations', 'duties', 'timeline', 'documents', 'status'],
    defaultPeriod: 'this_month'
  },
  [REPORT_TYPES.CUSTOMS_STATISTICS]: {
    name: 'Estadísticas Aduaneras',
    description: 'Estadísticas agregadas para reporting oficial',
    sections: ['volumes', 'values', 'origins', 'commodities', 'regimes'],
    defaultPeriod: 'this_quarter'
  },
  [REPORT_TYPES.AUDIT_TRAIL]: {
    name: 'Trazabilidad de Auditoría',
    description: 'Registro de todas las acciones para auditoría',
    sections: ['actions', 'users', 'changes', 'timeline'],
    defaultPeriod: 'last_30_days'
  }
};

/**
 * In-memory storage for generated reports
 */
let generatedReports = new Map();

/**
 * Generate a report
 */
async function generateReport(type, options = {}) {
  try {
    const template = REPORT_TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown report type: ${type}`);
    }

    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const period = options.period || template.defaultPeriod;

    logger.info(`[Reports] Generating report: ${type} (${reportId})`);

    // Get analytics data based on report type
    const reportData = await _gatherReportData(type, period, options);

    // Build report structure
    const report = {
      id: reportId,
      type,
      template: template.name,
      format: options.format || EXPORT_FORMATS.PDF,
      period,
      generatedAt: new Date(),
      generatedBy: options.userId || 'system',

      metadata: {
        title: options.title || template.name,
        subtitle: options.subtitle || `Período: ${_formatPeriodName(period)}`,
        organization: options.organization || 'STRIX AI SL',
        logo: options.logo || null
      },

      sections: {},
      summary: null,
      luciInsights: null
    };

    // Populate sections based on template
    for (const section of template.sections) {
      report.sections[section] = reportData[section] || await _generateSectionData(section, reportData);
    }

    // Generate executive summary
    report.summary = await _generateExecutiveSummary(report, reportData);

    // Get LUCI insights
    if (options.includeLuciAnalysis !== false) {
      report.luciInsights = await _getLuciReportInsights(type, reportData);
    }

    // Store report
    generatedReports.set(reportId, report);

    logger.info(`[Reports] Report generated successfully: ${reportId}`);

    return {
      success: true,
      report: {
        id: reportId,
        type,
        title: report.metadata.title,
        format: report.format,
        generatedAt: report.generatedAt,
        downloadUrl: `/api/analytics/reports/${reportId}/download`
      }
    };

  } catch (error) {
    logger.error(`[Reports] Error generating report: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * ¿Puede este usuario acceder a este informe?
 *
 * generatedReports es un Map global compartido por todos los tenants del
 * proceso. listReports ya filtraba por generatedBy, pero los accesos por id no
 * comprobaban nada: conociendo el id -- secuencial con marca de tiempo, no un
 * secreto -- se leia o borraba el informe de cualquier otro cliente.
 *
 * Un userId ausente no restringe: los informes programados se generan con
 * generatedBy 'system' y los procesos internos los consultan sin usuario.
 */
function _esSuyo(report, userId) {
  if (!userId) return true;
  return report.generatedBy === userId || report.generatedBy === 'system';
}

/**
 * Get report by ID
 */
function getReport(reportId, userId) {
  const report = generatedReports.get(reportId);
  // Mismo error para "no existe" y "no es tuyo": distinguirlos permitiria
  // confirmar por sondeo que un id ajeno existe.
  if (!report || !_esSuyo(report, userId)) {
    return { success: false, error: 'Report not found' };
  }
  return { success: true, report };
}

/**
 * List generated reports
 */
function listReports(filters = {}) {
  let reports = Array.from(generatedReports.values());

  // Apply filters
  if (filters.type) {
    reports = reports.filter(r => r.type === filters.type);
  }
  if (filters.period) {
    reports = reports.filter(r => r.period === filters.period);
  }
  if (filters.userId) {
    reports = reports.filter(r => r.generatedBy === filters.userId);
  }

  // Sort by date (most recent first)
  reports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));

  // Pagination
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const start = (page - 1) * limit;
  const paginated = reports.slice(start, start + limit);

  return {
    success: true,
    reports: paginated.map(r => ({
      id: r.id,
      type: r.type,
      title: r.metadata.title,
      format: r.format,
      period: r.period,
      generatedAt: r.generatedAt,
      generatedBy: r.generatedBy
    })),
    pagination: {
      total: reports.length,
      page,
      limit,
      pages: Math.ceil(reports.length / limit)
    }
  };
}

/**
 * Delete a report
 */
function deleteReport(reportId, userId) {
  const report = generatedReports.get(reportId);
  if (!report || !_esSuyo(report, userId)) {
    return { success: false, error: 'Report not found' };
  }
  generatedReports.delete(reportId);
  logger.info(`[Reports] Report deleted: ${reportId}`);
  return { success: true };
}

/**
 * Export report to specified format
 */
async function exportReport(reportId, format, userId) {
  const reportResult = getReport(reportId, userId);
  if (!reportResult.success) {
    return reportResult;
  }

  const report = reportResult.report;

  try {
    switch (format) {
      case EXPORT_FORMATS.PDF:
        return await _exportToPDF(report);
      case EXPORT_FORMATS.EXCEL:
        return await _exportToExcel(report);
      case EXPORT_FORMATS.CSV:
        return await _exportToCSV(report);
      case EXPORT_FORMATS.JSON:
        return { success: true, data: report, contentType: 'application/json' };
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    logger.error(`[Reports] Export error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Schedule recurring report
 */
function scheduleReport(config) {
  const scheduleId = `SCH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  const schedule = {
    id: scheduleId,
    reportType: config.type,
    frequency: config.frequency, // daily, weekly, monthly
    dayOfWeek: config.dayOfWeek, // for weekly
    dayOfMonth: config.dayOfMonth, // for monthly
    time: config.time || '08:00',
    recipients: config.recipients || [],
    format: config.format || EXPORT_FORMATS.PDF,
    options: config.options || {},
    enabled: true,
    createdAt: new Date(),
    lastRun: null,
    nextRun: _calculateNextRun(config)
  };

  logger.info(`[Reports] Report scheduled: ${scheduleId} (${config.type} - ${config.frequency})`);

  return {
    success: true,
    schedule: {
      id: scheduleId,
      reportType: schedule.reportType,
      frequency: schedule.frequency,
      nextRun: schedule.nextRun
    }
  };
}

/**
 * Get available report types
 */
function getAvailableReportTypes() {
  return Object.entries(REPORT_TEMPLATES).map(([key, template]) => ({
    type: key,
    name: template.name,
    description: template.description,
    sections: template.sections,
    defaultPeriod: template.defaultPeriod
  }));
}

/**
 * Preview report (lightweight version without full data)
 */
async function previewReport(type, options = {}) {
  const template = REPORT_TEMPLATES[type];
  if (!template) {
    return { success: false, error: `Unknown report type: ${type}` };
  }

  const period = options.period || template.defaultPeriod;

  return {
    success: true,
    preview: {
      type,
      template: template.name,
      sections: template.sections,
      period,
      estimatedPages: _estimatePages(template.sections),
      sampleData: await _getSampleData(type)
    }
  };
}

// ==================== Private Functions ====================

async function _gatherReportData(type, period, options) {
  const data = {};

  // Get base analytics data
  const [dashboard, declarations, financial, compliance] = await Promise.all([
    analyticsService.getDashboardMetrics(period),
    analyticsService.getDeclarationAnalytics(period),
    analyticsService.getFinancialAnalytics(period),
    analyticsService.getComplianceAnalytics(period)
  ]);

  data.dashboard = dashboard.data;
  data.declarations = declarations.data;
  data.financial = financial.data;
  data.compliance = compliance.data;
  data.period = period;
  data.options = options;

  // Add specific data based on report type
  switch (type) {
    case REPORT_TYPES.CLIENT_REPORT:
      data.client = options.clientId ? await _getClientData(options.clientId) : null;
      break;
    case REPORT_TYPES.AUDIT_TRAIL:
      data.auditLogs = await _getAuditLogs(period, options);
      break;
  }

  return data;
}

async function _generateSectionData(section, reportData) {
  switch (section) {
    case 'overview':
      return {
        totalDeclarations: reportData.dashboard?.operations?.totalDeclarations || 0,
        totalValue: reportData.financial?.summary?.totalCustomsValue || 0,
        complianceScore: reportData.compliance?.summary?.overallScore || 0,
        channelDistribution: reportData.dashboard?.channels || {}
      };

    case 'kpis':
      return {
        declarationsPerDay: Math.round((reportData.dashboard?.operations?.totalDeclarations || 0) / 30),
        averageProcessingTime: reportData.dashboard?.operations?.averageProcessingTime || 0,
        errorRate: reportData.compliance?.errors?.errorRate || 0,
        onTimeRate: reportData.compliance?.deadlines?.onTime || 0
      };

    case 'trends':
      return reportData.dashboard?.trends || {};

    case 'alerts':
      return {
        critical: [],
        warnings: [],
        info: []
      };

    case 'recommendations':
      return reportData.dashboard?.luciInsights?.recommendations || [];

    case 'timeline':
      return reportData.declarations?.timeline || [];

    case 'by_type':
      return reportData.declarations?.byType || {};

    case 'summary':
      return reportData.financial?.summary || reportData.compliance?.summary || {};

    case 'duties':
      return reportData.financial?.duties || {};

    case 'vat':
      return { total: reportData.financial?.summary?.totalVAT || 0 };

    case 'savings':
      return reportData.financial?.savings || {};

    case 'guarantees':
      return reportData.financial?.guarantees || {};

    case 'projections':
      return reportData.financial?.projections || {};

    case 'score':
      return reportData.compliance?.summary || {};

    case 'errors':
      return reportData.compliance?.errors || {};

    case 'rejections':
      return reportData.compliance?.rejections || {};

    case 'inspections':
      return reportData.compliance?.inspections || {};

    case 'risks':
      return reportData.compliance?.riskIndicators || [];

    case 'oea':
      return reportData.compliance?.oeaStatus || {};

    case 'by_channel':
      return reportData.declarations?.byChannel || {};

    case 'by_office':
      return reportData.declarations?.byOffice || [];

    case 'commodities':
      return reportData.declarations?.topCommodities || [];

    case 'origins':
      return reportData.declarations?.topOrigins || [];

    case 'volumes':
      return { total: reportData.dashboard?.operations?.totalDeclarations || 0 };

    case 'values':
      return { total: reportData.financial?.summary?.totalCustomsValue || 0 };

    case 'regimes':
      return [];

    case 'actions':
      return reportData.auditLogs?.actions || [];

    case 'users':
      return reportData.auditLogs?.users || [];

    case 'changes':
      return reportData.auditLogs?.changes || [];

    case 'operations':
      return reportData.dashboard?.operations || {};

    case 'documents':
      return [];

    case 'status':
      return { active: true };

    default:
      return {};
  }
}

async function _generateExecutiveSummary(report, reportData) {
  const dashboard = reportData.dashboard || {};
  const financial = reportData.financial || {};
  const compliance = reportData.compliance || {};

  return {
    period: _formatPeriodName(report.period),
    highlights: [
      `${dashboard.operations?.totalDeclarations || 0} declaraciones procesadas`,
      `${((dashboard.channels?.green || 0)).toFixed(0)}% canal verde`,
      `${(financial.summary?.totalCustomsValue || 0).toLocaleString('es-ES')} EUR valor total`,
      `${compliance.summary?.overallScore || 0}% score de cumplimiento`
    ],
    keyMetrics: {
      operations: dashboard.operations?.totalDeclarations || 0,
      value: financial.summary?.totalCustomsValue || 0,
      duties: financial.summary?.totalDuties || 0,
      compliance: compliance.summary?.overallScore || 0
    }
  };
}

async function _getLuciReportInsights(type, reportData) {
  try {
    const analyticsData = {
      reportType: type,
      operations: reportData.dashboard?.operations,
      financial: reportData.financial?.summary,
      compliance: reportData.compliance?.summary
    };

    const analysis = await aiService.generateExecutiveReport(analyticsData, {
      period: reportData.period || 'last_30_days',
      audience: 'Dirección general',
      focus: type
    });

    // Normalizar shapes y manejar string|objeto
    const norm = (v) => {
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v.map(norm).filter(Boolean);
      if (v && typeof v === 'object') {
        return v.action || v.recommendation || v.description || v.risk || v.text || '';
      }
      return '';
    };

    const summary = analysis.executiveSummary || analysis.summary || 'Análisis completado.';
    const keyFindings = (Array.isArray(analysis.recommendations) ? analysis.recommendations : [])
      .map(norm).filter(Boolean);
    const risksIdentified = (Array.isArray(analysis.risks) ? analysis.risks : [])
      .map(norm).filter(Boolean);
    const actionItems = (Array.isArray(analysis.strategicRecommendations) ? analysis.strategicRecommendations : [])
      .map(norm).filter(Boolean);

    return {
      summary,
      keyFindings,
      risksIdentified,
      actionItems
    };
  } catch (error) {
    logger.warn(`[Reports] Could not get LUCI insights: ${error.message}`);
    return null;
  }
}

async function _exportToPDF(report) {
  // In production, use a PDF library like pdfkit or puppeteer
  // For now, return a structured object that represents PDF content

  const pdfContent = {
    metadata: {
      title: report.metadata.title,
      author: 'LUCI Customs Agent',
      subject: report.template,
      createdAt: report.generatedAt
    },
    pages: []
  };

  // Title page
  pdfContent.pages.push({
    type: 'title',
    content: {
      title: report.metadata.title,
      subtitle: report.metadata.subtitle,
      organization: report.metadata.organization,
      date: report.generatedAt
    }
  });

  // Executive summary page
  if (report.summary) {
    pdfContent.pages.push({
      type: 'summary',
      content: report.summary
    });
  }

  // Section pages
  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    pdfContent.pages.push({
      type: 'section',
      name: _formatSectionName(sectionName),
      content: sectionData
    });
  }

  // LUCI insights page
  if (report.luciInsights) {
    pdfContent.pages.push({
      type: 'insights',
      content: report.luciInsights
    });
  }

  return {
    success: true,
    data: Buffer.from(JSON.stringify(pdfContent, null, 2)),
    contentType: 'application/pdf',
    filename: `${report.id}.pdf`
  };
}

async function _exportToExcel(report) {
  // In production, use a library like exceljs
  // For now, return structured data

  const workbook = {
    sheets: []
  };

  // Summary sheet
  workbook.sheets.push({
    name: 'Resumen',
    data: [
      ['Informe', report.metadata.title],
      ['Período', report.metadata.subtitle],
      ['Generado', report.generatedAt.toISOString()],
      [],
      ...Object.entries(report.summary?.keyMetrics || {}).map(([k, v]) => [k, v])
    ]
  });

  // Data sheets for each section
  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    if (Array.isArray(sectionData)) {
      workbook.sheets.push({
        name: _formatSectionName(sectionName).substring(0, 31), // Excel limit
        data: _arrayToExcelData(sectionData)
      });
    } else if (typeof sectionData === 'object') {
      workbook.sheets.push({
        name: _formatSectionName(sectionName).substring(0, 31),
        data: _objectToExcelData(sectionData)
      });
    }
  }

  return {
    success: true,
    data: Buffer.from(JSON.stringify(workbook, null, 2)),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${report.id}.xlsx`
  };
}

async function _exportToCSV(report) {
  // Flatten all data into CSV format
  const lines = [];

  lines.push(['Informe', report.metadata.title].join(','));
  lines.push(['Período', report.metadata.subtitle].join(','));
  lines.push(['Generado', report.generatedAt.toISOString()].join(','));
  lines.push('');

  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    lines.push(`[${_formatSectionName(sectionName)}]`);

    if (Array.isArray(sectionData) && sectionData.length > 0) {
      const headers = Object.keys(sectionData[0]);
      lines.push(headers.join(','));
      sectionData.forEach(row => {
        lines.push(headers.map(h => row[h]).join(','));
      });
    } else if (typeof sectionData === 'object') {
      Object.entries(sectionData).forEach(([k, v]) => {
        lines.push(`${k},${typeof v === 'object' ? JSON.stringify(v) : v}`);
      });
    }

    lines.push('');
  }

  return {
    success: true,
    data: Buffer.from(lines.join('\n')),
    contentType: 'text/csv',
    filename: `${report.id}.csv`
  };
}

async function _getClientData(clientId) {
  // In production, fetch from database
  return {
    id: clientId,
    name: 'Cliente Demo',
    nif: 'B12345678',
    operations: 25,
    totalValue: 500000
  };
}

async function _getAuditLogs(period, options) {
  // In production, fetch from audit log storage
  return {
    actions: [],
    users: [],
    changes: []
  };
}

function _formatPeriodName(period) {
  const names = {
    today: 'Hoy',
    yesterday: 'Ayer',
    last_7_days: 'Últimos 7 días',
    last_30_days: 'Últimos 30 días',
    last_90_days: 'Últimos 90 días',
    this_month: 'Este mes',
    last_month: 'Mes anterior',
    this_quarter: 'Este trimestre',
    this_year: 'Este año'
  };
  return names[period] || period;
}

function _formatSectionName(section) {
  const names = {
    overview: 'Visión General',
    kpis: 'KPIs',
    trends: 'Tendencias',
    alerts: 'Alertas',
    recommendations: 'Recomendaciones',
    timeline: 'Línea de Tiempo',
    by_type: 'Por Tipo',
    summary: 'Resumen',
    duties: 'Derechos',
    vat: 'IVA',
    savings: 'Ahorros',
    guarantees: 'Garantías',
    projections: 'Proyecciones',
    score: 'Puntuación',
    errors: 'Errores',
    rejections: 'Rechazos',
    inspections: 'Inspecciones',
    risks: 'Riesgos',
    oea: 'OEA',
    by_channel: 'Por Canal',
    by_office: 'Por Oficina',
    commodities: 'Mercancías',
    origins: 'Orígenes',
    volumes: 'Volúmenes',
    values: 'Valores',
    regimes: 'Regímenes',
    actions: 'Acciones',
    users: 'Usuarios',
    changes: 'Cambios',
    operations: 'Operaciones',
    documents: 'Documentos',
    status: 'Estado'
  };
  return names[section] || section;
}

function _calculateNextRun(config) {
  const now = new Date();
  const [hours, minutes] = (config.time || '08:00').split(':').map(Number);

  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  switch (config.frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly':
      const targetDay = config.dayOfWeek || 1; // Monday by default
      while (nextRun.getDay() !== targetDay || nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'monthly':
      const targetDate = config.dayOfMonth || 1;
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }

  return nextRun;
}

function _estimatePages(sections) {
  // Estimate 1-2 pages per section plus title and summary
  return 2 + Math.ceil(sections.length * 1.5);
}

async function _getSampleData(type) {
  return {
    declarations: 150,
    value: 1500000,
    compliance: 95
  };
}

function _arrayToExcelData(arr) {
  if (!arr.length) return [];
  const headers = Object.keys(arr[0]);
  return [
    headers,
    ...arr.map(row => headers.map(h => row[h]))
  ];
}

function _objectToExcelData(obj) {
  return Object.entries(obj).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]);
}

module.exports = {
  // Constants
  REPORT_TYPES,
  EXPORT_FORMATS,
  REPORT_TEMPLATES,

  // Main methods
  generateReport,
  getReport,
  listReports,
  deleteReport,
  exportReport,
  scheduleReport,
  getAvailableReportTypes,
  previewReport
};
