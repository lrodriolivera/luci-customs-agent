/**
 * reportsService: generacion, listado, exportacion y borrado de informes.
 *
 * El servicio guardaba los informes en un Map en memoria (se perdian en cada
 * reinicio y no estaban aislados por tenant de forma persistente). Ahora
 * persisten en Mongo (modelo Report, tenantId obligatorio) y listar/ver/
 * exportar/borrar filtran SIEMPRE por el tenant del usuario. El aislamiento
 * ENTRE TENANTS en profundidad vive en reportOwnership.db.test.js; aqui se
 * prueba el ciclo de vida normal (generar -> ver -> listar -> exportar ->
 * borrar) y la cobertura de secciones/formatos que ya existia.
 *
 * Que se mockea y por que: analyticsService/realMetricsService (saldrian a
 * Mongo agregando metricas reales, cubierto en otras suites) y aiService
 * (sale a Bedrock). El propio reportsService, incluida su logica de mapeo de
 * secciones, se ejecuta de verdad; nada de eso se mockea. Mongo es real
 * (mongodb-memory-server): la persistencia es precisamente lo que se prueba.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');

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

usarBaseDeDatosEnMemoria();

/** Usuario autenticado de un tenant nuevo: id y tenantId reales (ObjectId). */
function crearActor(role = 'agent') {
  return { id: String(new mongoose.Types.ObjectId()), tenantId: String(new mongoose.Types.ObjectId()), role };
}

/** Genera un informe para `actor` y devuelve el resultado completo. */
const generar = (type, actor, extra = {}) =>
  reports.generateReport(type, { userId: actor.id, tenantId: actor.tenantId, includeLuciAnalysis: false, ...extra });

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

describe('generateReport: tenantId obligatorio para persistir', () => {
  test('sin tenantId no genera (ni guarda) nada', async () => {
    const actor = crearActor();
    const r = await reports.generateReport('executive_summary', { userId: actor.id, includeLuciAnalysis: false });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/tenant/);
  });

  test('con tenantId null (usuario sin tenant) tampoco genera', async () => {
    const actor = crearActor();
    const r = await reports.generateReport('executive_summary', { userId: actor.id, tenantId: null, includeLuciAnalysis: false });
    expect(r.success).toBe(false);
  });

  test('sin userId (sin autor autenticado) tampoco genera', async () => {
    const actor = crearActor();
    const r = await reports.generateReport('executive_summary', { tenantId: actor.tenantId, includeLuciAnalysis: false });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/usuario/);
  });
});

describe('ciclo de vida del informe', () => {
  test('generate lo persiste; get lo recupera; exportReport y deleteReport operan sobre el mismo id', async () => {
    const actor = crearActor();
    const gen = await generar('executive_summary', actor);
    expect(gen.success).toBe(true);
    const id = gen.report.id;

    const leido = await reports.getReport(id, actor);
    expect(leido.success).toBe(true);
    expect(leido.report.generatedBy).toBe(actor.id);
    expect(leido.report.tenantId).toBe(actor.tenantId);

    const exportado = await reports.exportReport(id, 'json', actor);
    expect(exportado.success).toBe(true);

    const borrado = await reports.deleteReport(id, actor);
    expect(borrado.success).toBe(true);
    expect((await reports.getReport(id, actor)).success).toBe(false);
  });

  test('generate de un tipo desconocido falla y no guarda nada', async () => {
    const actor = crearActor();
    const r = await reports.generateReport('inexistente', { userId: actor.id, tenantId: actor.tenantId });
    expect(r.success).toBe(false);
    const listado = await reports.listReports({}, actor);
    expect(listado.reports).toHaveLength(0);
  });

  test('listReports devuelve los informes del tenant del usuario', async () => {
    const actor = crearActor();
    await generar('financial_report', actor);
    await generar('financial_report', actor);

    const lista = await reports.listReports({}, actor);
    expect(lista.success).toBe(true);
    expect(lista.reports.length).toBeGreaterThanOrEqual(2);
  });

  test('exportReport a JSON y CSV funciona sobre un informe del tenant', async () => {
    const actor = crearActor();
    const gen = await generar('customs_statistics', actor);
    const id = gen.report.id;

    const json = await reports.exportReport(id, 'json', actor);
    expect(json.success).toBe(true);

    const csv = await reports.exportReport(id, 'csv', actor);
    expect(csv.success).toBe(true);
  });

  test('exportReport con id de otro tenant devuelve not found (no exporta datos de otro)', async () => {
    const dueno = crearActor();
    const intruso = crearActor();
    const gen = await generar('customs_statistics', dueno);
    const r = await reports.exportReport(gen.report.id, 'json', intruso);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Report not found');
  });

  test('exportReport con formato no soportado devuelve error', async () => {
    const actor = crearActor();
    const gen = await generar('audit_trail', actor);
    const r = await reports.exportReport(gen.report.id, 'docx', actor);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Unsupported format/);
  });

  test('deleteReport borra el informe del propio tenant; un id inexistente responde not found', async () => {
    const actor = crearActor();
    const gen = await generar('compliance_report', actor);
    const id = gen.report.id;

    const inexistente = await reports.deleteReport(String(new mongoose.Types.ObjectId()), actor);
    expect(inexistente.success).toBe(false);

    const propio = await reports.deleteReport(id, actor);
    expect(propio.success).toBe(true);
    expect((await reports.getReport(id, actor)).success).toBe(false);
  });

  test('un id con formato invalido no revienta: responde not found', async () => {
    const actor = crearActor();
    expect((await reports.getReport('no-es-un-objectid', actor)).success).toBe(false);
    expect((await reports.deleteReport('no-es-un-objectid', actor)).success).toBe(false);
  });
});

describe('generateReport: tipos y formatos completos', () => {
  test('OPERATIONS_DETAIL procesa sus secciones especificas', async () => {
    const actor = crearActor();
    const r = await generar('operations_detail', actor);
    expect(r.success).toBe(true);
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.sections.declarations).toBeDefined();
    expect(full.report.sections.timeline).toBeDefined();
  });

  test('CLIENT_REPORT con clientId obtiene datos del cliente', async () => {
    const actor = crearActor();
    const r = await generar('client_report', actor, { clientId: 'CL-123' });
    expect(r.success).toBe(true);
    const full = await reports.getReport(r.report.id, actor);
    // No hay fuente por cliente: ni nombre/NIF de ejemplo ni "active: true" inventado
    expect(full.report.sections.operations.totalDeclarations).toBe(12);
    expect(full.report.sections.status).toEqual({ estado: 'Sin datos' });
    expect(JSON.stringify(full.report)).not.toMatch(/Cliente Demo|B12345678/);
  });

  test('AUDIT_TRAIL obtiene logs de auditoria', async () => {
    const actor = crearActor();
    const r = await generar('audit_trail', actor);
    expect(r.success).toBe(true);
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.sections.actions).toBeDefined();
    expect(full.report.sections.users).toBeDefined();
  });

  test('DECLARATION_REPORT incluye secciones by_office y commodities', async () => {
    const actor = crearActor();
    const r = await generar('declaration_report', actor);
    expect(r.success).toBe(true);
    const full = await reports.getReport(r.report.id, actor);
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

    const actor = crearActor();
    const r = await generar('executive_summary', actor, { includeLuciAnalysis: true });
    expect(r.success).toBe(true);
    const full = await reports.getReport(r.report.id, actor);
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

    const actor = crearActor();
    const r = await generar('financial_report', actor, { includeLuciAnalysis: true });
    expect(r.success).toBe(true);
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.luciInsights.summary).toBe('Resumen alternativo');
    expect(full.report.luciInsights.keyFindings).toEqual(['Accion A', 'Accion B', 'String directo']);
    expect(full.report.luciInsights.risksIdentified).toEqual(['Riesgo X', 'Riesgo Y']);
    expect(full.report.luciInsights.actionItems).toEqual(['Estrategia Z']);
  });

  test('IA lanza error: el informe se genera igual con luciInsights=null', async () => {
    aiService.generateExecutiveReport.mockRejectedValue(new Error('Bedrock timeout'));

    const actor = crearActor();
    const r = await generar('compliance_report', actor, { includeLuciAnalysis: true });
    expect(r.success).toBe(true);
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.luciInsights).toBeNull();
  });

  test('includeLuciAnalysis: false explicitamente no llama a IA', async () => {
    const mockIA = jest.fn();
    aiService.generateExecutiveReport.mockImplementation(mockIA);

    const actor = crearActor();
    const r = await generar('customs_statistics', actor);
    expect(r.success).toBe(true);
    expect(mockIA).not.toHaveBeenCalled();
  });
});

describe('generateReport: sin IA no dispara consultas de mas', () => {
  test('el cuadro completo (cuadroDeMando) solo se pide una vez: el periodo anterior usa los totales ligeros', async () => {
    const mockIA = jest.fn();
    aiService.generateExecutiveReport.mockImplementation(mockIA);

    const actor = crearActor();
    const r = await generar('executive_summary', actor);

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
    const actor = crearActor();
    const gen = await generar('executive_summary', actor);
    const exp = await reports.exportReport(gen.report.id, 'pdf', actor);
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
    const actor = crearActor();
    const gen = await generar('financial_report', actor);
    const exp = await reports.exportReport(gen.report.id, 'xlsx', actor);
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
    const actor = crearActor();
    const gen = await generar('operations_detail', actor);
    const exp = await reports.exportReport(gen.report.id, 'csv', actor);
    expect(exp.success).toBe(true);
    expect(exp.contentType).toBe('text/csv');
    const csvText = exp.data.toString();
    expect(csvText).toContain('Informe');
    expect(csvText).toContain('Período');
  });

  test('JSON devuelve el informe completo', async () => {
    const actor = crearActor();
    const gen = await generar('compliance_report', actor);
    const exp = await reports.exportReport(gen.report.id, 'json', actor);
    expect(exp.success).toBe(true);
    expect(exp.contentType).toBe('application/json');
    expect(exp.data.id).toBe(gen.report.id);
  });
});

describe('listReports: filtros y paginacion (dentro del tenant)', () => {
  test('filtrar por type muestra solo ese tipo', async () => {
    const actor = crearActor();
    await generar('executive_summary', actor);
    await generar('financial_report', actor);

    const lista = await reports.listReports({ type: 'financial_report' }, actor);
    expect(lista.reports.every(r => r.type === 'financial_report')).toBe(true);
  });

  test('filtrar por period muestra solo ese periodo', async () => {
    const actor = crearActor();
    await generar('customs_statistics', actor, { period: 'last_30_days' });
    await generar('customs_statistics', actor, { period: 'this_month' });

    const lista = await reports.listReports({ period: 'this_month' }, actor);
    expect(lista.reports.every(r => r.period === 'this_month')).toBe(true);
  });

  test('paginacion con limit devuelve maximo limit resultados', async () => {
    const actor = crearActor();
    for (let i = 0; i < 5; i++) {
      await generar('audit_trail', actor);
    }

    const lista = await reports.listReports({ limit: 2 }, actor);
    expect(lista.reports.length).toBeLessThanOrEqual(2);
    expect(lista.pagination.limit).toBe(2);
    expect(lista.pagination.total).toBeGreaterThanOrEqual(5);
    expect(lista.pagination.pages).toBeGreaterThanOrEqual(3);
  });

  test('paginacion pagina 2 devuelve la segunda pagina', async () => {
    const actor = crearActor();
    for (let i = 0; i < 4; i++) {
      await generar('client_report', actor);
    }

    const p1 = await reports.listReports({ limit: 2, page: 1 }, actor);
    const p2 = await reports.listReports({ limit: 2, page: 2 }, actor);
    expect(p1.reports.length).toBe(2);
    expect(p2.reports.length).toBe(2);
    expect(p1.reports[0].id).not.toBe(p2.reports[0].id);
  });

  test('tenant sin informes ve una lista vacia, no un error', async () => {
    const actor = crearActor();
    const sinFiltro = await reports.listReports({}, actor);
    expect(sinFiltro.success).toBe(true);
    expect(sinFiltro.reports).toHaveLength(0);
    expect(sinFiltro.pagination.total).toBe(0);
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

    const actor = crearActor();
    const r = await generar('executive_summary', actor);
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.sections.overview.totalDeclarations).toBe(123);
    expect(full.report.sections.overview.totalValue).toBe(500000);
    expect(full.report.sections.overview.complianceScore).toBe('Sin datos');
  });

  test('genera kpis con declarationsPerDay y averageProcessingTime', async () => {
    cuadroCon({ declaraciones: { total: 90, porTipo: {}, porEstado: {} } });

    const actor = crearActor();
    const r = await generar('executive_summary', actor, { period: 'last_30_days' });
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.sections.kpis.declarationsPerDay).toBeCloseTo(3, 0);
    expect(full.report.sections.kpis.averageProcessingTime).toBe(1200);
  });

  test('genera vat con el IVA liquidado real', async () => {
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 25100, arancel: 100, iva: 25000 });

    const actor = crearActor();
    const r = await generar('financial_report', actor);
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.sections.vat.total).toBe(25000);
  });

  test('genera volumes con total', async () => {
    cuadroCon({ declaraciones: { total: 456, porTipo: {}, porEstado: {} } });

    const actor = crearActor();
    const r = await generar('customs_statistics', actor);
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.sections.volumes.total).toBe(456);
  });

  test('genera values con total real, o "Sin datos" si los expedientes no informan valor', async () => {
    const actor = crearActor();
    realMetrics.valorMercancia.mockResolvedValue({ disponible: true, total: 999999 });
    let r = await generar('customs_statistics', actor);
    expect((await reports.getReport(r.report.id, actor)).report.sections.values.total).toBe(999999);

    realMetrics.valorMercancia.mockResolvedValue({ disponible: false });
    r = await generar('customs_statistics', actor);
    expect((await reports.getReport(r.report.id, actor)).report.sections.values.total).toBe('Sin datos');
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
    const actor = crearActor();
    const r = await generar('financial_report', actor, { period: 'yesterday' });
    const full = await reports.getReport(r.report.id, actor);
    // _formatPeriodName('yesterday') -> 'Ayer'
    // se usa en subtitle y en summary.period
    expect(full.report.metadata.subtitle).toContain('Ayer');
  });

  test('generateReport con periodo this_quarter formatea correctamente', async () => {
    const actor = crearActor();
    const r = await generar('customs_statistics', actor, { period: 'this_quarter' });
    const full = await reports.getReport(r.report.id, actor);
    expect(full.report.metadata.subtitle).toContain('Este trimestre');
  });

  test('_formatSectionName en exportToPDF convierte nombres internos a español', async () => {
    const actor = crearActor();
    const r = await generar('executive_summary', actor);
    const exp = await reports.exportReport(r.report.id, 'pdf', actor);
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

    const actor = crearActor();
    const r = await generar('financial_report', actor);
    const exp = await reports.exportReport(r.report.id, 'xlsx', actor);
    const wb = JSON.parse(exp.data.toString());

    const duties = wb.sheets.find(s => s.name === 'Derechos');
    expect(duties).toBeDefined();
    expect(duties.data).toContainEqual(['totalCalculado', 100]);
  });

  test('una seccion sin fuente se exporta como "Sin datos", no como 0', async () => {
    const actor = crearActor();
    const r = await generar('financial_report', actor);
    const exp = await reports.exportReport(r.report.id, 'xlsx', actor);
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

    const actor = crearActor();
    const r = await generar('executive_summary', actor);
    const full = await reports.getReport(r.report.id, actor);
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

    const actor = crearActor();
    const r = await generar('financial_report', actor);
    const full = await reports.getReport(r.report.id, actor);
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

    const actor = crearActor();
    const r = await generar('executive_summary', actor, { includeLuciAnalysis: true });
    const full = await reports.getReport(r.report.id, actor);
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

    const actor = crearActor();
    const r = await generar('financial_report', actor, { includeLuciAnalysis: true });
    const full = await reports.getReport(r.report.id, actor);
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

    const actor = crearActor();
    const r = await generar('executive_summary', actor, { includeLuciAnalysis: true });
    const exp = await reports.exportReport(r.report.id, 'pdf', actor);
    const pdf = JSON.parse(exp.data.toString());

    const insightsPage = pdf.pages.find(p => p.type === 'insights');
    expect(insightsPage).toBeDefined();
    expect(insightsPage.content.summary).toBe('Resumen IA');
  });
});

describe('exportToCSV: secciones', () => {
  test('una seccion objeto genera lineas clave,valor', async () => {
    realMetrics.derechosLiquidados.mockResolvedValue({ total: 100, arancel: 40, iva: 60 });

    const actor = crearActor();
    const r = await generar('financial_report', actor);
    const exp = await reports.exportReport(r.report.id, 'csv', actor);
    const csvText = exp.data.toString();

    expect(csvText).toContain('[Derechos]');
    expect(csvText).toContain('totalCalculado,100');
    expect(csvText).toContain('estado,Sin datos');
  });
});

describe('scheduleReport: funcionalidad retirada', () => {
  test('el servicio ya no expone scheduleReport (no hay planificador real en el backend)', () => {
    expect(reports.scheduleReport).toBeUndefined();
  });
});
