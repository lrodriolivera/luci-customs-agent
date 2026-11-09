/**
 * Los informes salen de las metricas reales del ambito, no de un simulador.
 * Lo que no tiene fuente se emite como "Sin datos", nunca como 0.
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
jest.mock('../../../src/services/aiService', () => ({ generateExecutiveReport: jest.fn() }));

const realMetrics = require('../../../src/services/analytics/realMetricsService');
const reports = require('../../../src/services/analytics/reportsService');

const CUADRO = {
  simulated: false,
  generadoEn: '2026-11-09T10:00:00.000Z',
  declaraciones: { total: 40, porTipo: { H7: 30, NCTS: 10 }, porEstado: { rejected: 3 } },
  derechos: { total: 300, arancel: 100, iva: 200 },
  tiempos: { muestra: 4, mediaHoras: 12.5 },
  cumplimiento: { inspecciones: 4 },
  recaudacion: { disponible: false }
};
const CANALES = { canales: { green: 3, orange: 1, red: 0, yellow: 0 }, conCanalAsignado: 4, porcentajes: { green: 75, orange: 25, red: 0, yellow: 0 } };

beforeEach(() => {
  realMetrics.cuadroDeMando.mockResolvedValue(CUADRO);
  realMetrics.expedientesActivos.mockResolvedValue(7);
  realMetrics.volumenDeclaraciones.mockResolvedValue(CUADRO.declaraciones);
  realMetrics.repartoPorCanal.mockResolvedValue(CANALES);
  realMetrics.derechosLiquidados.mockResolvedValue(CUADRO.derechos);
  realMetrics.tiemposDeDespacho.mockResolvedValue(CUADRO.tiempos);
  realMetrics.valorMercancia.mockResolvedValue({ disponible: false });
  require('../../../src/services/aiService').generateExecutiveReport.mockResolvedValue({ summary: 'ok' });
});

const generar = async (tipo, opts = {}) => {
  const r = await reports.generateReport(tipo, { userId: 'u1', includeLuciAnalysis: false, tenantId: 't1', ...opts });
  expect(r.success).toBe(true);
  return reports.getReport(r.report.id, 'u1').report;
};

describe('informes con datos reales', () => {
  test('consultan las metricas del ambito recibido', async () => {
    await generar('executive_summary');
    expect(realMetrics.cuadroDeMando.mock.calls[0][0]).toBe('t1');
    expect(realMetrics.expedientesActivos).toHaveBeenCalledWith('t1');
  });

  test('resumen ejecutivo: secciones y cifras reales', async () => {
    const rep = await generar('executive_summary');
    expect(rep.sections.overview.totalDeclarations).toBe(40);
    expect(rep.sections.overview.channelDistribution).toEqual(CANALES.porcentajes);
    expect(rep.sections.kpis.averageProcessingTime).toBe(12.5);
    expect(rep.summary.keyMetrics.operations).toBe(40);
    expect(rep.summary.keyMetrics.duties).toBe(300);
    expect(rep.summary.highlights).toContain('40 declaraciones procesadas');
    expect(rep.summary.highlights).toContain('75% canal verde');
  });

  test('lo que no tiene fuente sale como "Sin datos", nunca 0', async () => {
    const rep = await generar('executive_summary');
    expect(rep.sections.overview.complianceScore).toBe('Sin datos');
    expect(rep.sections.kpis.errorRate).toBe('Sin datos');
    expect(rep.sections.kpis.onTimeRate).toBe('Sin datos');
    expect(rep.sections.overview.totalValue).toBe('Sin datos');
    expect(rep.summary.keyMetrics.compliance).toBe('Sin datos');
    expect(rep.summary.highlights.join('|')).not.toMatch(/undefined|NaN|null/);
  });

  test('secciones sin fuente (ahorros, garantias, proyecciones...) llevan "Sin datos"', async () => {
    const rep = await generar('financial_report');
    for (const s of ['savings', 'guarantees', 'projections']) {
      expect(rep.sections[s]).toEqual({ estado: 'Sin datos' });
    }
    expect(rep.sections.duties.totalCalculado).toBe(300);
    expect(rep.sections.vat.total).toBe(200);
  });

  test('cumplimiento: rechazos e inspecciones reales; el resto sin datos', async () => {
    const rep = await generar('compliance_report');
    expect(rep.sections.rejections.rejectionRate).toBe(10);
    expect(rep.sections.inspections.inspectionRate).toBe(10);
    expect(rep.sections.score).toEqual({ estado: 'Sin datos' });
    expect(rep.sections.errors).toEqual({ estado: 'Sin datos' });
  });

  test('sin tipo de cliente demo: el informe de cliente no inventa nombre ni NIF', async () => {
    const rep = await generar('client_report', { clientId: 'c1' });
    expect(JSON.stringify(rep)).not.toMatch(/Cliente Demo|B12345678|500000/);
  });

  test('un periodo sin declaraciones: 0 real en el total, "Sin datos" en el tiempo medio', async () => {
    realMetrics.cuadroDeMando.mockResolvedValue({
      ...CUADRO,
      declaraciones: { total: 0, porTipo: { H7: 0, NCTS: 0 }, porEstado: {} },
      tiempos: { muestra: 0, mediaHoras: null }
    });
    realMetrics.repartoPorCanal.mockResolvedValue({ canales: {}, conCanalAsignado: 0, porcentajes: { green: 0 } });
    const rep = await generar('executive_summary');
    expect(rep.sections.overview.totalDeclarations).toBe(0);
    expect(rep.sections.kpis.averageProcessingTime).toBe('Sin datos');
    expect(rep.sections.kpis.declarationsPerDay).toBe(0);
    expect(rep.sections.overview.channelDistribution).toEqual({ estado: 'Sin datos' });
    expect(rep.summary.highlights).toContain('Sin datos canal verde');
  });

  test('ambito null (sin tenant): no consulta metricas y nada se inventa', async () => {
    const rep = await generar('executive_summary', { tenantId: null });
    expect(realMetrics.cuadroDeMando).not.toHaveBeenCalled();
    expect(rep.sections.overview.totalDeclarations).toBe(0);
  });

  test('el informe no usa funciones simuladas ni Math.random para cifras', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../../src/services/analytics/reportsService.js'), 'utf8');
    expect(src).not.toMatch(/_generateMetricValue|getDashboardMetrics|getFinancialAnalytics|getComplianceAnalytics|getDeclarationAnalytics/);
  });
});

describe('previewReport', () => {
  test('la muestra sale de datos reales, no de cifras fijas', async () => {
    const r = await reports.previewReport('executive_summary', { tenantId: 't1' });
    expect(r.preview.sampleData).toEqual({ declarations: 40, dutiesCalculated: 300, rejectionRate: 10 });
  });

  test('sin tenant: muestra vacia, sin consultar', async () => {
    const r = await reports.previewReport('executive_summary', { tenantId: null });
    expect(realMetrics.cuadroDeMando).not.toHaveBeenCalled();
    expect(r.preview.sampleData.declarations).toBe(0);
  });
});
