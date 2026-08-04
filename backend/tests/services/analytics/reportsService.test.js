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

jest.mock('../../../src/services/analytics/analyticsService', () => ({
  getDashboardMetrics: jest.fn(),
  getDeclarationAnalytics: jest.fn(),
  getFinancialAnalytics: jest.fn(),
  getComplianceAnalytics: jest.fn()
}));
jest.mock('../../../src/services/aiService', () => ({
  generateExecutiveReport: jest.fn()
}));

const analyticsService = require('../../../src/services/analytics/analyticsService');
const aiService = require('../../../src/services/aiService');
const reports = require('../../../src/services/analytics/reportsService');

beforeEach(() => {
  // resetMocks borra la implementacion de fabrica antes de cada test: hay que
  // dotar a los mocks de datos coherentes aqui, no en el jest.mock.
  const vacio = { data: {} };
  analyticsService.getDashboardMetrics.mockResolvedValue(vacio);
  analyticsService.getDeclarationAnalytics.mockResolvedValue(vacio);
  analyticsService.getFinancialAnalytics.mockResolvedValue(vacio);
  analyticsService.getComplianceAnalytics.mockResolvedValue(vacio);
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
