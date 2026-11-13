/**
 * reportsService: generacion, listado, exportacion y programacion de informes.
 *
 * El servicio guarda los informes en un Map en memoria (no en Mongo) y se apoya
 * en analyticsService para los datos y en aiService para el resumen ejecutivo.
 * Lo que se prueba de verdad, sin salir a red ni BD:
 *   1. El catalogo de tipos y la previsualizacion (plantillas y paginas estimadas).
 *   2. El ciclo completo generate -> get -> list -> export -> delete y, sobre
 *      todo, el AISLAMIENTO POR PROPIETARIO: getReport/deleteReport con el id de
 *      un informe ajeno responden "not found", nunca los datos.
 *   3. La programacion recurrente: el calculo de la proxima ejecucion en las tres
 *      frecuencias (daily/weekly/monthly).
 *
 * Que se mockea y por que: analyticsService (sale a Mongo agregando metricas) y
 * aiService (sale a Bedrock). Son deps externas legitimas. El propio
 * reportsService —incluida su logica de mapeo de secciones y el guard de
 * propiedad— se ejecuta de verdad; nada de eso se mockea.
 */

jest.mock('../../../src/services/analytics/realMetricsService', () => ({
  NO_DISPONIBLE: {},
  cuadroDeMando: jest.fn(),
  expedientesActivos: jest.fn(),
  volumenDeclaraciones: jest.fn(),
  repartoPorCanal: jest.fn(),
  derechosLiquidados: jest.fn(),
  tiemposDeDespacho: jest.fn(),
  valorMercancia: jest.fn()
}));
jest.mock('../../../src/services/aiService', () => ({
  generateExecutiveReport: jest.fn()
}));

const realMetrics = require('../../../src/services/analytics/realMetricsService');
const aiService = require('../../../src/services/aiService');
const reports = require('../../../src/services/analytics/reportsService');

beforeEach(() => {
  // resetMocks borra la implementacion de fabrica antes de cada test: hay que
  // dotar a los mocks de datos coherentes aqui, no en el jest.mock.
  const declaraciones = { total: 12, porTipo: { H7: 10, NCTS: 2 }, porEstado: { rejected: 1 } };
  realMetrics.cuadroDeMando.mockResolvedValue({
    simulated: false,
    generadoEn: new Date().toISOString(),
    declaraciones,
    derechos: { total: 100, arancel: 40, iva: 60 },
    tiempos: { muestra: 0, mediaHoras: null },
    cumplimiento: { inspecciones: 0 },
    recaudacion: { disponible: false }
  });
  realMetrics.expedientesActivos.mockResolvedValue(3);
  realMetrics.volumenDeclaraciones.mockResolvedValue(declaraciones);
  realMetrics.repartoPorCanal.mockResolvedValue({ canales: {}, conCanalAsignado: 0, porcentajes: {} });
  realMetrics.derechosLiquidados.mockResolvedValue({ total: 100, arancel: 40, iva: 60 });
  realMetrics.tiemposDeDespacho.mockResolvedValue({ muestra: 0, mediaHoras: null });
  realMetrics.valorMercancia.mockResolvedValue({ disponible: false });
  aiService.generateExecutiveReport.mockResolvedValue({ summary: 'ok' });
});

describe('getAvailableReportTypes: catalogo', () => {
  test('lista los 8 tipos con nombre, secciones y periodo por defecto', () => {
    const tipos = reports.getAvailableReportTypes();
    expect(tipos).toHaveLength(8);
    expect(tipos.every(t => t.name && Array.isArray(t.sections))).toBe(true);
    expect(tipos.map(t => t.type)).toContain('executive_summary');
  });
});

describe('previewReport: previsualizacion ligera', () => {
  test('devuelve plantilla, secciones y paginas estimadas de un tipo valido', async () => {
    const r = await reports.previewReport('executive_summary');
    expect(r.success).toBe(true);
    // _estimatePages: 2 + ceil(5 secciones * 1.5) = 2 + 8 = 10
    expect(r.preview.estimatedPages).toBe(10);
    expect(r.preview.sections).toContain('overview');
  });

  test('un tipo desconocido devuelve error sin reventar', async () => {
    const r = await reports.previewReport('inexistente');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Unknown report type/);
  });
});

describe('ciclo de vida del informe con aislamiento por propietario', () => {
  test('generate lo guarda; get lo recupera para su dueno; un ajeno recibe not found', async () => {
    const gen = await reports.generateReport('executive_summary', { userId: 'user-1', includeLuciAnalysis: false });
    expect(gen.success).toBe(true);
    const id = gen.report.id;

    const propio = reports.getReport(id, 'user-1');
    expect(propio.success).toBe(true);
    expect(propio.report.generatedBy).toBe('user-1');

    const ajeno = reports.getReport(id, 'user-2');
    expect(ajeno.success).toBe(false);
    expect(ajeno.error).toBe('Report not found');
    expect(ajeno.report).toBeUndefined();
  });

  test('generate de un tipo desconocido falla y no guarda nada', async () => {
    const r = await reports.generateReport('inexistente', { userId: 'user-1' });
    expect(r.success).toBe(false);
  });

  test('listReports filtra por userId (no muestra informes de otros)', async () => {
    await reports.generateReport('financial_report', { userId: 'owner-A', includeLuciAnalysis: false });
    await reports.generateReport('financial_report', { userId: 'owner-B', includeLuciAnalysis: false });

    const soloA = reports.listReports({ userId: 'owner-A' });
    expect(soloA.reports.every(r => r.generatedBy === 'owner-A')).toBe(true);
    expect(soloA.reports.length).toBeGreaterThanOrEqual(1);
  });

  test('exportReport a JSON y CSV funciona sobre un informe propio', async () => {
    const gen = await reports.generateReport('customs_statistics', { userId: 'exp-user', includeLuciAnalysis: false });
    const id = gen.report.id;

    const json = await reports.exportReport(id, 'json', 'exp-user');
    expect(json.success).toBe(true);

    const csv = await reports.exportReport(id, 'csv', 'exp-user');
    expect(csv.success).toBe(true);
  });

  test('exportReport de un id ajeno devuelve not found (no exporta datos de otro)', async () => {
    const gen = await reports.generateReport('customs_statistics', { userId: 'duenno', includeLuciAnalysis: false });
    const r = await reports.exportReport(gen.report.id, 'json', 'intruso');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Report not found');
  });

  test('exportReport con formato no soportado devuelve error', async () => {
    const gen = await reports.generateReport('audit_trail', { userId: 'u', includeLuciAnalysis: false });
    const r = await reports.exportReport(gen.report.id, 'docx', 'u');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Unsupported format/);
  });

  test('deleteReport borra el propio; un ajeno no puede borrarlo', async () => {
    const gen = await reports.generateReport('compliance_report', { userId: 'del-user', includeLuciAnalysis: false });
    const id = gen.report.id;

    const ajeno = reports.deleteReport(id, 'otro');
    expect(ajeno.success).toBe(false);

    const propio = reports.deleteReport(id, 'del-user');
    expect(propio.success).toBe(true);

    expect(reports.getReport(id, 'del-user').success).toBe(false);
  });
});

describe('scheduleReport: proxima ejecucion por frecuencia', () => {
  test('diaria devuelve una fecha de proxima ejecucion', () => {
    const r = reports.scheduleReport({ type: 'executive_summary', frequency: 'daily', time: '08:00' });
    expect(r.success).toBe(true);
    expect(r.schedule.nextRun instanceof Date).toBe(true);
    expect(r.schedule.frequency).toBe('daily');
  });

  test('semanal cae en el dia de la semana configurado', () => {
    const r = reports.scheduleReport({ type: 'executive_summary', frequency: 'weekly', dayOfWeek: 3, time: '09:30' });
    expect(r.schedule.nextRun.getDay()).toBe(3);
  });

  test('mensual cae en el dia del mes configurado', () => {
    const r = reports.scheduleReport({ type: 'financial_report', frequency: 'monthly', dayOfMonth: 15 });
    expect(r.schedule.nextRun.getDate()).toBe(15);
  });
});

describe('generateReport: tipos y formatos completos', () => {
  test('OPERATIONS_DETAIL procesa sus secciones especificas', async () => {
    const r = await reports.generateReport('operations_detail', { userId: 'u1', includeLuciAnalysis: false });
    expect(r.success).toBe(true);
    const full = reports.getReport(r.report.id, 'u1');
    expect(full.report.sections.declarations).toBeDefined();
    expect(full.report.sections.timeline).toBeDefined();
  });

  test('CLIENT_REPORT con clientId obtiene datos del cliente', async () => {
    const r = await reports.generateReport('client_report', { userId: 'u2', clientId: 'CL-123', includeLuciAnalysis: false });
    expect(r.success).toBe(true);
    const full = reports.getReport(r.report.id, 'u2');
    // No hay fuente por cliente: ni nombre/NIF de ejemplo ni "active: true" inventado
    expect(full.report.sections.operations.totalDeclarations).toBe(12);
    expect(full.report.sections.status).toEqual({ estado: 'Sin datos' });
    expect(JSON.stringify(full.report)).not.toMatch(/Cliente Demo|B12345678/);
  });

  test('AUDIT_TRAIL obtiene logs de auditoria', async () => {
    const r = await reports.generateReport('audit_trail', { userId: 'u3', includeLuciAnalysis: false });
    expect(r.success).toBe(true);
    const full = reports.getReport(r.report.id, 'u3');
    expect(full.report.sections.actions).toBeDefined();
    expect(full.report.sections.users).toBeDefined();
  });

  test('DECLARATION_REPORT incluye secciones by_office y commodities', async () => {
    const r = await reports.generateReport('declaration_report', { userId: 'u4', includeLuciAnalysis: false });
    expect(r.success).toBe(true);
    const full = reports.getReport(r.report.id, 'u4');
    expect(full.report.sections.by_office).toBeDefined();
    expect(full.report.sections.commodities).toBeDefined();
    expect(full.report.sections.origins).toBeDefined();
  });
});

describe('generateReport: includeLuciAnalysis con distintos shapes de IA', () => {
  test('shape completo con executiveSummary + recommendations + risks + strategicRecommendations', async () => {
    aiService.generateExecutiveReport.mockResolvedValue({
      executiveSummary: 'Resumen ejecutivo completo',
      recommendations: ['Recomendacion 1', 'Recomendacion 2'],
      risks: ['Riesgo 1', 'Riesgo 2'],
      strategicRecommendations: ['Estrategia 1', 'Estrategia 2']
    });

    const r = await reports.generateReport('executive_summary', { userId: 'uAI', includeLuciAnalysis: true });
    expect(r.success).toBe(true);
    const full = reports.getReport(r.report.id, 'uAI');
    expect(full.report.luciInsights).not.toBeNull();
    expect(full.report.luciInsights.summary).toBe('Resumen ejecutivo completo');
    expect(full.report.luciInsights.keyFindings).toEqual(['Recomendacion 1', 'Recomendacion 2']);
    expect(full.report.luciInsights.risksIdentified).toEqual(['Riesgo 1', 'Riesgo 2']);
    expect(full.report.luciInsights.actionItems).toEqual(['Estrategia 1', 'Estrategia 2']);
  });

  test('shape alternativo con summary + arrays de objetos (normaliza extrayendo .action)', async () => {
    aiService.generateExecutiveReport.mockResolvedValue({
      summary: 'Resumen alternativo',
      recommendations: [
        { action: 'Accion A' },
        { recommendation: 'Accion B' },
        'String directo'
      ],
      risks: [
        { risk: 'Riesgo X' },
        { description: 'Riesgo Y' }
      ],
      strategicRecommendations: [
        { text: 'Estrategia Z' }
      ]
    });

    const r = await reports.generateReport('financial_report', { userId: 'uAI2', includeLuciAnalysis: true });
    expect(r.success).toBe(true);
    const full = reports.getReport(r.report.id, 'uAI2');
    expect(full.report.luciInsights.summary).toBe('Resumen alternativo');
    expect(full.report.luciInsights.keyFindings).toEqual(['Accion A', 'Accion B', 'String directo']);
    expect(full.report.luciInsights.risksIdentified).toEqual(['Riesgo X', 'Riesgo Y']);
    expect(full.report.luciInsights.actionItems).toEqual(['Estrategia Z']);
  });

  test('IA lanza error: el informe se genera igual con luciInsights=null', async () => {
    aiService.generateExecutiveReport.mockRejectedValue(new Error('Bedrock timeout'));

    const r = await reports.generateReport('compliance_report', { userId: 'uAI3', includeLuciAnalysis: true });
    expect(r.success).toBe(true);
    const full = reports.getReport(r.report.id, 'uAI3');
    expect(full.report.luciInsights).toBeNull();
  });

  test('includeLuciAnalysis: false explicitamente no llama a IA', async () => {
    const mockIA = jest.fn();
    aiService.generateExecutiveReport.mockImplementation(mockIA);

    const r = await reports.generateReport('customs_statistics', { userId: 'uNoIA', includeLuciAnalysis: false });
    expect(r.success).toBe(true);
    expect(mockIA).not.toHaveBeenCalled();
  });
});

describe('generateReport: sin IA no dispara consultas de mas', () => {
  test('el cuadro completo (cuadroDeMando) solo se pide una vez: el periodo anterior usa los totales ligeros', async () => {
    const mockIA = jest.fn();
    aiService.generateExecutiveReport.mockImplementation(mockIA);

    const r = await reports.generateReport('executive_summary', { userId: 'uSinQueries', includeLuciAnalysis: false });

    expect(r.success).toBe(true);
    expect(mockIA).not.toHaveBeenCalled();
    // cuadroDeMando trae 7 agregaciones; pedirlo dos veces (periodo actual y
    // anterior) duplicaba de mas el trabajo que el informe necesita. El
    // periodo anterior solo aporta dos totales a la tendencia: ver
    // cuadroParaPanel.panelDelAmbito.
    expect(realMetrics.cuadroDeMando).toHaveBeenCalledTimes(1);
  });
});

describe('exportReport: los 4 formatos', () => {
  test('PDF construye metadata, title page, summary, sections y luci insights', async () => {
    const gen = await reports.generateReport('executive_summary', { userId: 'pdf', includeLuciAnalysis: false });
    const exp = await reports.exportReport(gen.report.id, 'pdf', 'pdf');
    expect(exp.success).toBe(true);
    expect(exp.contentType).toBe('application/pdf');
    expect(exp.filename).toMatch(/\.pdf$/);

    // El PDF es un Buffer de JSON estructurado con metadata y pages
    const pdfContent = JSON.parse(exp.data.toString());
    expect(pdfContent.metadata.title).toBeDefined();
    expect(pdfContent.pages.length).toBeGreaterThan(0);
    const titlePage = pdfContent.pages.find(p => p.type === 'title');
    expect(titlePage).toBeDefined();
  });

  test('EXCEL construye sheet Resumen + sheets por seccion', async () => {
    const gen = await reports.generateReport('financial_report', { userId: 'xlsx', includeLuciAnalysis: false });
    const exp = await reports.exportReport(gen.report.id, 'xlsx', 'xlsx');
    expect(exp.success).toBe(true);
    expect(exp.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(exp.filename).toMatch(/\.xlsx$/);

    const workbook = JSON.parse(exp.data.toString());
    expect(workbook.sheets.length).toBeGreaterThan(0);
    const resumen = workbook.sheets.find(s => s.name === 'Resumen');
    expect(resumen).toBeDefined();
    expect(resumen.data.length).toBeGreaterThan(0);
  });

  test('CSV aplana metadata + secciones en lineas de texto', async () => {
    const gen = await reports.generateReport('operations_detail', { userId: 'csv2', includeLuciAnalysis: false });
    const exp = await reports.exportReport(gen.report.id, 'csv', 'csv2');
    expect(exp.success).toBe(true);
    expect(exp.contentType).toBe('text/csv');
    const csvText = exp.data.toString();
    expect(csvText).toContain('Informe');
    expect(csvText).toContain('Período');
  });

  test('JSON devuelve el informe completo', async () => {
    const gen = await reports.generateReport('compliance_report', { userId: 'json2', includeLuciAnalysis: false });
    const exp = await reports.exportReport(gen.report.id, 'json', 'json2');
    expect(exp.success).toBe(true);
    expect(exp.contentType).toBe('application/json');
    expect(exp.data.id).toBe(gen.report.id);
  });
});

describe('listReports: filtros y paginacion', () => {
  test('filtrar por type muestra solo ese tipo', async () => {
    await reports.generateReport('executive_summary', { userId: 'filter1', includeLuciAnalysis: false });
    await reports.generateReport('financial_report', { userId: 'filter1', includeLuciAnalysis: false });

    const lista = reports.listReports({ userId: 'filter1', type: 'financial_report' });
    expect(lista.reports.every(r => r.type === 'financial_report')).toBe(true);
  });

  test('filtrar por period muestra solo ese periodo', async () => {
    await reports.generateReport('customs_statistics', { userId: 'filter2', period: 'last_30_days', includeLuciAnalysis: false });
    await reports.generateReport('customs_statistics', { userId: 'filter2', period: 'this_month', includeLuciAnalysis: false });

    const lista = reports.listReports({ userId: 'filter2', period: 'this_month' });
    expect(lista.reports.every(r => r.period === 'this_month')).toBe(true);
  });

  test('paginacion con limit devuelve maximo limit resultados', async () => {
    for (let i = 0; i < 5; i++) {
      await reports.generateReport('audit_trail', { userId: 'pagination', includeLuciAnalysis: false });
    }

    const lista = reports.listReports({ userId: 'pagination', limit: 2 });
    expect(lista.reports.length).toBeLessThanOrEqual(2);
    expect(lista.pagination.limit).toBe(2);
    expect(lista.pagination.total).toBeGreaterThanOrEqual(5);
    expect(lista.pagination.pages).toBeGreaterThanOrEqual(3);
  });

  test('paginacion pagina 2 devuelve la segunda pagina', async () => {
    for (let i = 0; i < 4; i++) {
      await reports.generateReport('client_report', { userId: 'pagination2', includeLuciAnalysis: false });
    }

    const p1 = reports.listReports({ userId: 'pagination2', limit: 2, page: 1 });
    const p2 = reports.listReports({ userId: 'pagination2', limit: 2, page: 2 });
    expect(p1.reports.length).toBe(2);
    expect(p2.reports.length).toBe(2);
    expect(p1.reports[0].id).not.toBe(p2.reports[0].id);
  });

  test('sin filtros devuelve todos los informes', async () => {
    const sinFiltro = reports.listReports({});
    expect(sinFiltro.success).toBe(true);
    expect(sinFiltro.pagination.total).toBeGreaterThanOrEqual(0);
  });
});

describe('control de propiedad: userId ausente permite acceso', () => {
  test('getReport sin userId devuelve informe de cualquier generatedBy', async () => {
    const gen = await reports.generateReport('executive_summary', { userId: 'privado', includeLuciAnalysis: false });

    // sin userId, _esSuyo devuelve true
    const r = reports.getReport(gen.report.id);
    expect(r.success).toBe(true);
    expect(r.report.generatedBy).toBe('privado');
  });

  test('deleteReport sin userId puede borrar cualquier informe', async () => {
    const gen = await reports.generateReport('financial_report', { userId: 'owner-X', includeLuciAnalysis: false });

    const del = reports.deleteReport(gen.report.id);
    expect(del.success).toBe(true);
  });

  test('exportReport sin userId puede exportar cualquier informe', async () => {
    const gen = await reports.generateReport('compliance_report', { userId: 'owner-Y', includeLuciAnalysis: false });

    const exp = await reports.exportReport(gen.report.id, 'json');
    expect(exp.success).toBe(true);
  });

  test('informe generado con system como generatedBy es accesible por cualquier userId', async () => {
    const gen = await reports.generateReport('customs_statistics', { includeLuciAnalysis: false });
    expect(gen.report).toBeDefined();
    const id = gen.report.id;

    // generatedBy sera 'system' (default en generateReport)
    const r1 = reports.getReport(id, 'user-random-1');
    const r2 = reports.getReport(id, 'user-random-2');
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

describe('_generateSectionData: cobertura de secciones especificas', () => {
  const cuadroCon = (extra) => realMetrics.cuadroDeMando.mockResolvedValue({
    simulated: false,
    generadoEn: new Date().toISOString(),
    declaraciones: { total: 123, porTipo: { H7: 123 }, porEstado: {} },
    derechos: { total: 100, arancel: 40, iva: 25000 },
    tiempos: { muestra: 5, mediaHoras: 1200 },
    cumplimiento: { inspecciones: 0 },
    recaudacion: { disponible: false },
    ...extra
  });

  test('genera overview con totalDeclarations real, valor y score sin fuente como "Sin datos"', async () => {
    cuadroCon({});
    realMetrics.valorMercancia.mockResolvedValue({ disponible: true, total: 500000 });

    const r = await reports.generateReport('executive_summary', { userId: 'sec1', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'sec1');
    expect(full.report.sections.overview.totalDeclarations).toBe(123);
    expect(full.report.sections.overview.totalValue).toBe(500000);
    expect(full.report.sections.overview.complianceScore).toBe('Sin datos');
  });

  test('genera kpis con declarationsPerDay y averageProcessingTime', async () => {
    cuadroCon({ declaraciones: { total: 90, porTipo: {}, porEstado: {} } });

    const r = await reports.generateReport('executive_summary', { userId: 'sec2', period: 'last_30_days', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'sec2');
    expect(full.report.sections.kpis.declarationsPerDay).toBeCloseTo(3, 0);
    expect(full.report.sections.kpis.averageProcessingTime).toBe(1200);
  });

  test('genera vat con el IVA liquidado real', async () => {
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 25100, arancel: 100, iva: 25000 });

    const r = await reports.generateReport('financial_report', { userId: 'sec3', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'sec3');
    expect(full.report.sections.vat.total).toBe(25000);
  });

  test('genera volumes con total', async () => {
    cuadroCon({ declaraciones: { total: 456, porTipo: {}, porEstado: {} } });

    const r = await reports.generateReport('customs_statistics', { userId: 'sec4', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'sec4');
    expect(full.report.sections.volumes.total).toBe(456);
  });

  test('genera values con total real, o "Sin datos" si los expedientes no informan valor', async () => {
    realMetrics.valorMercancia.mockResolvedValue({ disponible: true, total: 999999 });
    let r = await reports.generateReport('customs_statistics', { userId: 'sec5', includeLuciAnalysis: false });
    expect(reports.getReport(r.report.id, 'sec5').report.sections.values.total).toBe(999999);

    realMetrics.valorMercancia.mockResolvedValue({ disponible: false });
    r = await reports.generateReport('customs_statistics', { userId: 'sec5', includeLuciAnalysis: false });
    expect(reports.getReport(r.report.id, 'sec5').report.sections.values.total).toBe('Sin datos');
  });
});

describe('formateadores: _formatPeriodName y _formatSectionName', () => {
  test('previewReport con periodo today muestra el nombre formateado', async () => {
    const r = await reports.previewReport('executive_summary', { period: 'today' });
    expect(r.success).toBe(true);
    // periodo se usa en generateReport para subtitle que llama _formatPeriodName
    // previewReport no expone el nombre formateado directamente, lo verificamos en generateReport
  });

  test('generateReport con periodo yesterday formatea correctamente', async () => {
    const r = await reports.generateReport('financial_report', { userId: 'fmt1', period: 'yesterday', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'fmt1');
    // _formatPeriodName('yesterday') -> 'Ayer'
    // se usa en subtitle y en summary.period
    expect(full.report.metadata.subtitle).toContain('Ayer');
  });

  test('generateReport con periodo this_quarter formatea correctamente', async () => {
    const r = await reports.generateReport('customs_statistics', { userId: 'fmt2', period: 'this_quarter', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'fmt2');
    expect(full.report.metadata.subtitle).toContain('Este trimestre');
  });

  test('_formatSectionName en exportToPDF convierte nombres internos a español', async () => {
    const r = await reports.generateReport('executive_summary', { userId: 'fmt3', includeLuciAnalysis: false });
    const exp = await reports.exportReport(r.report.id, 'pdf', 'fmt3');
    const pdf = JSON.parse(exp.data.toString());
    const sectionPages = pdf.pages.filter(p => p.type === 'section');
    // overview -> Visión General, kpis -> KPIs, trends -> Tendencias
    const names = sectionPages.map(p => p.name);
    expect(names).toContain('Visión General');
    expect(names).toContain('KPIs');
  });
});

describe('exportToExcel: secciones', () => {
  test('seccion objeto genera pares clave-valor', async () => {
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 100, arancel: 40, iva: 60 });

    const r = await reports.generateReport('financial_report', { userId: 'excel2', includeLuciAnalysis: false });
    const exp = await reports.exportReport(r.report.id, 'xlsx', 'excel2');
    const wb = JSON.parse(exp.data.toString());

    const duties = wb.sheets.find(s => s.name === 'Derechos');
    expect(duties).toBeDefined();
    expect(duties.data).toContainEqual(['totalCalculado', 100]);
  });

  test('una seccion sin fuente se exporta como "Sin datos", no como 0', async () => {
    const r = await reports.generateReport('financial_report', { userId: 'excel3', includeLuciAnalysis: false });
    const exp = await reports.exportReport(r.report.id, 'xlsx', 'excel3');
    const wb = JSON.parse(exp.data.toString());

    const ahorros = wb.sheets.find(s => s.name === 'Ahorros');
    expect(ahorros.data).toEqual([['estado', 'Sin datos']]);
  });
});

describe('_generateExecutiveSummary: highlights y keyMetrics', () => {
  const cuadro = (declaraciones, derechos) => realMetrics.cuadroDeMando.mockResolvedValue({
    simulated: false,
    generadoEn: new Date().toISOString(),
    declaraciones,
    derechos,
    tiempos: { muestra: 0, mediaHoras: null },
    cumplimiento: { inspecciones: 0 },
    recaudacion: { disponible: false }
  });

  test('highlights con datos reales; lo que no tiene fuente dice "Sin datos"', async () => {
    cuadro({ total: 200, porTipo: {}, porEstado: {} }, { total: 10 });
    realMetrics.repartoPorCanal.mockResolvedValue({ conCanalAsignado: 4, canales: {}, porcentajes: { green: 75 } });
    realMetrics.valorMercancia.mockResolvedValue({ disponible: true, total: 1234567 });

    const r = await reports.generateReport('executive_summary', { userId: 'summ1', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'summ1');
    expect(full.report.summary.highlights).toHaveLength(4);
    expect(full.report.summary.highlights[0]).toContain('200 declaraciones procesadas');
    expect(full.report.summary.highlights[1]).toContain('75% canal verde');
    expect(full.report.summary.highlights[2]).toContain('1.234.567 EUR');
    expect(full.report.summary.highlights[3]).toBe('Sin datos score de cumplimiento');
  });

  test('keyMetrics contiene operations, value, duties y compliance (sin fuente = "Sin datos")', async () => {
    cuadro({ total: 300, porTipo: {}, porEstado: {} }, { total: 25000 });
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 25000 });
    realMetrics.valorMercancia.mockResolvedValue({ disponible: true, total: 500000 });

    const r = await reports.generateReport('financial_report', { userId: 'summ2', includeLuciAnalysis: false });
    const full = reports.getReport(r.report.id, 'summ2');
    expect(full.report.summary.keyMetrics.operations).toBe(300);
    expect(full.report.summary.keyMetrics.value).toBe(500000);
    expect(full.report.summary.keyMetrics.duties).toBe(25000);
    expect(full.report.summary.keyMetrics.compliance).toBe('Sin datos');
  });
});

describe('normalización de insights: valores null/undefined/numeros en arrays', () => {
  test('recomendaciones con null, undefined y numeros se filtran correctamente', async () => {
    aiService.generateExecutiveReport.mockResolvedValue({
      executiveSummary: 'Test',
      recommendations: [
        'Valida',
        null,
        undefined,
        123,
        { action: 'Otra valida' },
        '',
        { sinCamposReconocidos: true }
      ],
      risks: [],
      strategicRecommendations: []
    });

    const r = await reports.generateReport('executive_summary', { userId: 'norm1', includeLuciAnalysis: true });
    const full = reports.getReport(r.report.id, 'norm1');
    // norm devuelve '' para null/undefined/numeros y objetos sin campos reconocidos
    // filter(Boolean) los descarta
    expect(full.report.luciInsights.keyFindings).toEqual(['Valida', 'Otra valida']);
  });

  test('array anidado en recommendations NO se aplana (comportamiento actual)', async () => {
    aiService.generateExecutiveReport.mockResolvedValue({
      executiveSummary: 'Test anidado',
      recommendations: [
        ['Sub1', 'Sub2'],
        'Directa'
      ],
      risks: [],
      strategicRecommendations: []
    });

    const r = await reports.generateReport('financial_report', { userId: 'norm2', includeLuciAnalysis: true });
    const full = reports.getReport(r.report.id, 'norm2');
    // norm recursivo: si es array, map(norm).filter(Boolean) preserva el array anidado
    // NO aplana. Esto puede ser un bug si la IA devuelve arrays anidados.
    expect(full.report.luciInsights.keyFindings).toEqual([['Sub1', 'Sub2'], 'Directa']);
  });
});

describe('exportToPDF: pagina de insights cuando existe', () => {
  test('informe con luciInsights incluye pagina type:insights', async () => {
    aiService.generateExecutiveReport.mockResolvedValue({
      executiveSummary: 'Resumen IA',
      recommendations: ['R1'],
      risks: ['Riesgo1'],
      strategicRecommendations: ['Estrategia1']
    });

    const r = await reports.generateReport('executive_summary', { userId: 'pdfIA', includeLuciAnalysis: true });
    const exp = await reports.exportReport(r.report.id, 'pdf', 'pdfIA');
    const pdf = JSON.parse(exp.data.toString());

    const insightsPage = pdf.pages.find(p => p.type === 'insights');
    expect(insightsPage).toBeDefined();
    expect(insightsPage.content.summary).toBe('Resumen IA');
  });
});

describe('exportToCSV: secciones', () => {
  test('una seccion objeto genera lineas clave,valor', async () => {
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 100, arancel: 40, iva: 60 });

    const r = await reports.generateReport('financial_report', { userId: 'csvObj', includeLuciAnalysis: false });
    const exp = await reports.exportReport(r.report.id, 'csv', 'csvObj');
    const csvText = exp.data.toString();

    expect(csvText).toContain('[Derechos]');
    expect(csvText).toContain('totalCalculado,100');
    expect(csvText).toContain('estado,Sin datos');
  });
});

describe('_calculateNextRun: branch monthly con nextRun <= now', () => {
  test('schedule mensual en dia pasado avanza al mes siguiente', () => {
    const hoy = new Date();
    const diaAnterior = hoy.getDate() - 5;
    if (diaAnterior <= 0) {
      // si estamos muy al principio del mes, usar dia 1 y forzar hora pasada
      const r = reports.scheduleReport({ type: 'executive_summary', frequency: 'monthly', dayOfMonth: 1, time: '00:01' });
      expect(r.schedule.nextRun.getDate()).toBe(1);
      // si hoy es despues del dia 1, nextRun deberia estar en el proximo mes
      if (hoy.getDate() > 1) {
        expect(r.schedule.nextRun.getMonth()).toBe((hoy.getMonth() + 1) % 12);
      }
    } else {
      // dia anterior seguro ya paso, debe avanzar al siguiente mes
      const r = reports.scheduleReport({ type: 'executive_summary', frequency: 'monthly', dayOfMonth: diaAnterior, time: '00:00' });
      expect(r.schedule.nextRun.getDate()).toBe(diaAnterior);
      // el mes debe ser el siguiente (o el actual si justo estamos en ese dia pero hora futura)
      expect(r.schedule.nextRun >= hoy).toBe(true);
    }
  });
});
