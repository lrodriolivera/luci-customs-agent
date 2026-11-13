/**
 * Reports Service
 * Phase 6.2: Analytics and Business Intelligence
 *
 * Generates PDF and Excel reports for customs operations
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');
const analyticsService = require('./analyticsService');
const realMetrics = require('./realMetricsService');
const kpiService = require('./kpiService');
const { panelDelAmbito } = require('./cuadroParaPanel');
const aiService = require('../aiService');
const auditService = require('../auditService');
const Report = require('../../models/Report');
const { filtroTenantOPlataforma } = require('../../utils/tenantGuard');

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

/** Un informe nuevo exige un tenant real (ObjectId) y un autor autenticado. */
const SIN_TENANT = 'No se puede generar el informe sin un tenant asociado';
const SIN_AUTOR = 'No se puede generar el informe sin un usuario autenticado';

/**
 * Convierte el documento de Mongo a la forma que ya esperaban los
 * consumidores internos (export*, controller): `id` en vez de `_id`, ids como
 * string.
 */
function _presentar(doc) {
  return {
    id: String(doc._id),
    type: doc.type,
    template: doc.template,
    format: doc.format,
    period: doc.period,
    generatedAt: doc.generatedAt,
    generatedBy: doc.generatedBy ? String(doc.generatedBy) : null,
    tenantId: doc.tenantId ? String(doc.tenantId) : null,
    metadata: doc.metadata,
    sections: doc.sections,
    summary: doc.summary,
    luciInsights: doc.luciInsights
  };
}

/**
 * Generate a report
 */
async function generateReport(type, options = {}) {
  try {
    const template = REPORT_TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown report type: ${type}`);
    }

    // El informe se guarda SIEMPRE con tenant: sin eso no hay forma de acotar
    // despues quien puede leerlo, descargarlo o borrarlo. undefined (plataforma,
    // super_admin sin tenant) y null (usuario heredado sin tenant) no son un
    // tenant concreto: se rechazan aqui en vez de guardar un informe huerfano.
    const { tenantId } = options;
    if (tenantId === null || tenantId === undefined || !mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error(SIN_TENANT);
    }
    if (!options.userId || !mongoose.Types.ObjectId.isValid(options.userId)) {
      throw new Error(SIN_AUTOR);
    }

    const period = options.period || template.defaultPeriod;

    logger.info(`[Reports] Generating report: ${type}`);

    // Get analytics data based on report type
    const reportData = await _gatherReportData(type, period, options);

    // Build report structure
    const report = {
      type,
      template: template.name,
      format: options.format || EXPORT_FORMATS.PDF,
      period,
      generatedAt: new Date(),

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
      // Siempre por _generateSectionData: tomar reportData[section] mezclaba
      // claves internas (p. ej. `kpis`) con secciones del informe.
      report.sections[section] = await _generateSectionData(section, reportData);
    }

    // Generate executive summary
    report.summary = await _generateExecutiveSummary(report, reportData);

    // Get LUCI insights
    if (options.includeLuciAnalysis !== false) {
      report.luciInsights = await _getLuciReportInsights(type, reportData);
    }

    // Store report en Mongo, acotado al tenant que lo genero.
    const doc = await Report.create({
      tenantId,
      generatedBy: options.userId,
      type: report.type,
      template: report.template,
      format: report.format,
      period: report.period,
      metadata: report.metadata,
      sections: report.sections,
      summary: report.summary,
      luciInsights: report.luciInsights,
      generatedAt: report.generatedAt
    });

    logger.info(`[Reports] Report generated successfully: ${doc._id}`);

    return {
      success: true,
      report: {
        id: String(doc._id),
        type,
        title: report.metadata.title,
        format: report.format,
        generatedAt: report.generatedAt,
        downloadUrl: `/api/analytics/reports/${doc._id}/download`
      }
    };

  } catch (error) {
    logger.error(`[Reports] Error generating report: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get report by ID. `user` es el usuario autenticado (req.user): se usa para
 * acotar la consulta a su tenant, salvo super_admin de plataforma sin tenant
 * (filtroTenantOPlataforma). Mismo mensaje para "no existe" y "no es tuyo":
 * distinguirlos permitiria confirmar por sondeo que un id ajeno existe.
 */
async function getReport(reportId, user) {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return { success: false, error: 'Report not found' };
  }
  const doc = await Report.findOne({ _id: reportId, ...filtroTenantOPlataforma(user || {}) }).lean();
  if (!doc) {
    return { success: false, error: 'Report not found' };
  }
  return { success: true, report: _presentar(doc) };
}

/**
 * List generated reports, acotado al tenant de `user` (o sin acotar para
 * super_admin de plataforma).
 */
async function listReports(filters = {}, user) {
  const query = { ...filtroTenantOPlataforma(user || {}) };
  if (filters.type) query.type = filters.type;
  if (filters.period) query.period = filters.period;

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Report.countDocuments(query),
    Report.find(query).sort({ generatedAt: -1 }).skip(skip).limit(limit).lean()
  ]);

  return {
    success: true,
    reports: docs.map(d => ({
      id: String(d._id),
      type: d.type,
      title: d.metadata?.title,
      format: d.format,
      period: d.period,
      generatedAt: d.generatedAt,
      generatedBy: d.generatedBy ? String(d.generatedBy) : null
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Delete a report. Borrado atomico ya acotado por tenant en la propia
 * consulta: no hay hueco entre "leer" y "borrar" para una carrera.
 */
async function deleteReport(reportId, user) {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return { success: false, error: 'Report not found' };
  }
  const doc = await Report.findOneAndDelete({ _id: reportId, ...filtroTenantOPlataforma(user || {}) });
  if (!doc) {
    return { success: false, error: 'Report not found' };
  }
  logger.info(`[Reports] Report deleted: ${reportId}`);
  return { success: true };
}

/**
 * Export report to specified format
 */
async function exportReport(reportId, format, user) {
  const reportResult = await getReport(reportId, user);
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
      sampleData: await _getSampleData(type, options.tenantId)
    }
  };
}

// ==================== Private Functions ====================

// Criterio de producto: ninguna cifra inventada. Lo que no tiene fuente real se
// emite como "Sin datos" (escalar) o { estado: 'Sin datos' } (seccion), nunca 0.
const SIN_DATOS = 'Sin datos';
const dato = (x) => (x === null || x === undefined ? SIN_DATOS : x);
const seccionSinDatos = () => ({ estado: SIN_DATOS });
const MS_POR_DIA = 86400000;

/**
 * Reune los datos reales del ambito (ambitoTenant: undefined = plataforma,
 * null = sin tenant, string = ese tenant). Solo consultas de lectura.
 */
async function _gatherReportData(type, period, options) {
  const tenantId = options.tenantId;
  const { start, end } = analyticsService.getDateRange(period);
  const rango = { desde: start, hasta: end };
  const dias = Math.max(1, Math.round((end - start) / MS_POR_DIA));
  const sinAmbito = tenantId === null;

  const [dashboard, canales, derechos, valor] = await Promise.all([
    panelDelAmbito(tenantId, rango),
    sinAmbito ? null : realMetrics.repartoPorCanal(tenantId, rango),
    sinAmbito ? null : realMetrics.derechosLiquidados(tenantId, rango),
    sinAmbito ? null : realMetrics.valorMercancia(tenantId, rango)
  ]);

  const data = {
    dashboard,
    canales: canales && canales.conCanalAsignado > 0 ? canales : null,
    derechos,
    valorMercancia: valor && valor.disponible ? valor.total : null,
    alertas: kpiService.getActiveAlerts({}, tenantId).alerts,
    dias,
    period,
    options
  };

  switch (type) {
    case REPORT_TYPES.CLIENT_REPORT:
      data.client = options.clientId ? await _getClientData(options.clientId) : null;
      break;
    case REPORT_TYPES.AUDIT_TRAIL:
      data.auditLogs = await _getAuditLogs(tenantId, rango);
      break;
  }

  return data;
}

const _porGravedad = (alertas, severidad) =>
  alertas.filter(a => a.severity === severidad).map(a => a.message);

async function _generateSectionData(section, reportData) {
  const op = reportData.dashboard?.operations || {};
  const fin = reportData.dashboard?.financial || {};
  const cumpl = reportData.dashboard?.compliance || {};
  const tendencias = reportData.dashboard?.trends || {};
  const distribucionCanales = reportData.canales ? reportData.canales.porcentajes : seccionSinDatos();

  switch (section) {
    case 'overview':
      return {
        totalDeclarations: dato(op.totalDeclarations),
        totalValue: dato(reportData.valorMercancia),
        complianceScore: SIN_DATOS,
        channelDistribution: distribucionCanales
      };

    case 'kpis':
      return {
        declarationsPerDay: op.totalDeclarations == null
          ? SIN_DATOS
          : Math.round((op.totalDeclarations / reportData.dias) * 10) / 10,
        averageProcessingTime: dato(op.averageProcessingTime),
        errorRate: SIN_DATOS,
        onTimeRate: SIN_DATOS
      };

    case 'trends':
      return {
        operations: dato(tendencias.operations?.percentage),
        financial: dato(tendencias.financial?.percentage)
      };

    case 'alerts':
      return {
        critical: _porGravedad(reportData.alertas, 'critical'),
        warnings: _porGravedad(reportData.alertas, 'warning'),
        info: _porGravedad(reportData.alertas, 'info')
      };

    case 'declarations':
      return { total: dato(op.totalDeclarations), porTipo: dato(op.declarationsByType) };

    case 'expeditions':
      return { activos: dato(op.activeExpeditions) };

    case 'channels':
    case 'by_channel':
      return distribucionCanales;

    case 'by_type':
      return dato(op.declarationsByType);

    case 'summary':
      return { declaraciones: dato(op.totalDeclarations), derechosCalculados: dato(fin.totalDutiesCalculated) };

    case 'duties':
      return {
        totalCalculado: dato(reportData.derechos?.total),
        arancel: dato(reportData.derechos?.arancel),
        cobrado: dato(fin.totalDutiesPaid)
      };

    case 'vat':
      return { total: dato(reportData.derechos?.iva) };

    case 'rejections':
      return { rejectionRate: dato(cumpl.rejectionRate) };

    case 'inspections':
      return { inspectionRate: dato(cumpl.inspectionRate) };

    case 'volumes':
      return { total: dato(op.totalDeclarations) };

    case 'values':
      return { total: dato(reportData.valorMercancia) };

    case 'operations':
      return {
        totalDeclarations: dato(op.totalDeclarations),
        declarationsByType: dato(op.declarationsByType),
        averageProcessingTime: dato(op.averageProcessingTime),
        activeExpeditions: dato(op.activeExpeditions)
      };

    case 'actions':
    case 'users':
    case 'changes': {
      const filas = reportData.auditLogs?.[section];
      return filas && filas.length ? filas : seccionSinDatos();
    }

    // recommendations, timeline, savings, guarantees, projections, score, errors,
    // risks, oea, by_office, commodities, origins, regimes, documents, status:
    // no hay fuente real hoy.
    default:
      return seccionSinDatos();
  }
}

async function _generateExecutiveSummary(report, reportData) {
  const op = reportData.dashboard?.operations || {};
  const canalVerde = reportData.canales ? reportData.canales.porcentajes.green : null;
  const valor = reportData.valorMercancia;

  return {
    period: _formatPeriodName(report.period),
    highlights: [
      op.totalDeclarations == null ? `${SIN_DATOS} declaraciones procesadas` : `${op.totalDeclarations} declaraciones procesadas`,
      canalVerde == null ? `${SIN_DATOS} canal verde` : `${canalVerde.toFixed(0)}% canal verde`,
      valor == null ? `${SIN_DATOS} valor total` : `${valor.toLocaleString('es-ES')} EUR valor total`,
      `${SIN_DATOS} score de cumplimiento`
    ],
    keyMetrics: {
      operations: dato(op.totalDeclarations),
      value: dato(valor),
      duties: dato(reportData.derechos?.total),
      compliance: SIN_DATOS
    }
  };
}

async function _getLuciReportInsights(type, reportData) {
  try {
    const analyticsData = {
      reportType: type,
      operations: reportData.dashboard?.operations,
      financial: reportData.dashboard?.financial,
      compliance: reportData.dashboard?.compliance
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
  // No hay fuente de datos por cliente: antes devolvia un "Cliente Demo" con
  // NIF y cifras inventadas. Sin fuente, el informe no lleva bloque de cliente.
  return null;
}

// Nunca mas de esto por informe: el trail es para leer tendencias de uso, no
// para volcar la auditoria entera en un PDF.
const LIMITE_AUDITORIA = 500;

/**
 * Trazabilidad de auditoria real del tenant y periodo (auditService, que ya
 * respalda AuditLog). Sin campos sensibles (ip, user-agent, cabeceras...): solo
 * lo necesario para un informe de lectura. Sin tenant concreto (plataforma o
 * usuario sin tenant) no hay ambito que consultar: se devuelve vacio, nunca
 * inventado.
 */
async function _getAuditLogs(tenantId, rango) {
  if (tenantId === null || tenantId === undefined) {
    return { actions: [], users: [], changes: [] };
  }

  const entradas = await auditService.query({
    tenantId,
    from: rango?.desde,
    to: rango?.hasta,
    limit: LIMITE_AUDITORIA
  });

  const limpia = (e) => ({
    fecha: e.timestamp,
    accion: e.action,
    recurso: e.resource,
    recursoId: e.resourceId || null,
    usuario: e.userEmail || null,
    exito: e.success
  });

  const porUsuario = new Map();
  for (const e of entradas) {
    const clave = e.userEmail || 'desconocido';
    porUsuario.set(clave, (porUsuario.get(clave) || 0) + 1);
  }

  return {
    actions: entradas.map(limpia),
    users: Array.from(porUsuario, ([usuario, total]) => ({ usuario, total })),
    changes: entradas
      .filter(e => e.changes)
      .map(e => ({ fecha: e.timestamp, recurso: e.resource, recursoId: e.resourceId || null, cambios: e.changes }))
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

function _estimatePages(sections) {
  // Estimate 1-2 pages per section plus title and summary
  return 2 + Math.ceil(sections.length * 1.5);
}

/** Muestra de la vista previa: cifras reales del ambito, no valores de ejemplo. */
async function _getSampleData(type, tenantId) {
  if (tenantId === null) {
    return { declarations: 0, dutiesCalculated: 0, rejectionRate: null };
  }
  const panel = await panelDelAmbito(tenantId, {});
  return {
    declarations: panel.operations.totalDeclarations,
    dutiesCalculated: panel.financial.totalDutiesCalculated,
    rejectionRate: panel.compliance.rejectionRate
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
  getAvailableReportTypes,
  previewReport
};
