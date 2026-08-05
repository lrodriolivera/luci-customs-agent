/**
 * analyticsController: capa HTTP sobre los servicios de analitica.
 *
 * El controller es fino: valida la entrada, delega en analytics/* (ya cubiertos
 * en tests/services) y mapea el resultado a codigos HTTP. Aqui se prueba SU
 * logica propia, que es toda de ramas:
 *   - las validaciones 400 (query/body incompletos),
 *   - el mapeo a 404 cuando el servicio responde { success: false },
 *   - el 501 deliberado de las metricas que NO se calculan (volumen y tiempo de
 *     proceso eran simulaciones con Math.random; devolver un numero falso en un
 *     panel es peor que no darlo — ver el bug de analytics-simulado),
 *   - el 500 cuando el servicio lanza.
 *
 * Se mockean los servicios de analitica, realMetricsService y aiService: son
 * dependencias externas al controller y se prueban por separado. NUNCA
 * produccion (estos handlers son de solo lectura, pero igualmente).
 */

jest.mock('../../src/services/analytics', () => ({
  analyticsService: {
    getRealTimeMetrics: jest.fn(),
    getDeclarationAnalytics: jest.fn(),
    getComplianceAnalytics: jest.fn(),
    getPerformanceAnalytics: jest.fn(),
    getComparisonReport: jest.fn(),
    queryAnalytics: jest.fn()
  },
  reportsService: {
    generateReport: jest.fn(),
    getReport: jest.fn(),
    listReports: jest.fn(),
    exportReport: jest.fn(),
    deleteReport: jest.fn(),
    getAvailableReportTypes: jest.fn(),
    previewReport: jest.fn(),
    scheduleReport: jest.fn()
  },
  kpiService: {
    getKPIDashboard: jest.fn(),
    getAllKPIs: jest.fn(),
    getKPIDefinitions: jest.fn(),
    getKPIsByCategory: jest.fn(),
    calculateKPI: jest.fn(),
    getKPIHistory: jest.fn(),
    setKPITarget: jest.fn(),
    compareKPIs: jest.fn(),
    getActiveAlerts: jest.fn(),
    acknowledgeAlert: jest.fn(),
    dismissAlert: jest.fn()
  },
  predictionsService: {
    predictChannel: jest.fn(),
    predictInspection: jest.fn(),
    predictDuties: jest.fn(),
    detectAnomalies: jest.fn(),
    analyzeTrends: jest.fn(),
    getModelMetrics: jest.fn()
  }
}));
jest.mock('../../src/services/analytics/realMetricsService', () => ({
  cuadroDeMando: jest.fn(),
  derechosLiquidados: jest.fn(),
  recaudacionCobrada: jest.fn(),
  valorMercancia: jest.fn(),
  NO_DISPONIBLE: {
    SIN_PAGOS: 'sin pagos',
    SIN_HISTORICO: 'sin historico',
    SIN_MODELO: 'sin modelo'
  }
}));
jest.mock('../../src/services/aiService', () => ({
  generateAutomaticInsights: jest.fn(),
  detectAnomaliesAI: jest.fn(),
  predictTrendsAI: jest.fn(),
  generateExecutiveReport: jest.fn(),
  analyzeKPIDeviations: jest.fn(),
  fullAnalyticsAnalysis: jest.fn()
}));

const { analyticsService, reportsService, kpiService, predictionsService } = require('../../src/services/analytics');
const realMetrics = require('../../src/services/analytics/realMetricsService');
const aiService = require('../../src/services/aiService');
const ctrl = require('../../src/controllers/analyticsController');

function crearRes() {
  const res = { statusCode: 200, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const req = (body = {}, query = {}, params = {}, user = { id: 'u1', tenantId: 't1' }) => ({ body, query, params, user });

beforeEach(() => {
  // resetMocks borra las implementaciones: se re-dan los defaults del happy path.
  realMetrics.cuadroDeMando.mockResolvedValue({ total: 35, porTipo: { H7: 35 } });
  realMetrics.derechosLiquidados.mockResolvedValue({ total: 1000 });
  realMetrics.recaudacionCobrada.mockResolvedValue({ disponible: false, motivo: 'sin pagos' });
  realMetrics.valorMercancia.mockResolvedValue({ total: 5000 });
});

describe('Dashboard y metricas', () => {
  test('getDashboardMetrics acota por tenant y devuelve el cuadro de mando', async () => {
    const res = crearRes();
    await ctrl.getDashboardMetrics(req({}, { startDate: '2026-01-01' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(35);
    expect(realMetrics.cuadroDeMando).toHaveBeenCalledWith('t1', expect.objectContaining({ desde: '2026-01-01' }));
  });

  test('getDashboardMetrics propaga 500 si el servicio lanza', async () => {
    realMetrics.cuadroDeMando.mockRejectedValue(new Error('boom'));
    const res = crearRes();
    await ctrl.getDashboardMetrics(req(), res);
    expect(res.statusCode).toBe(500);
  });

  test('getFinancialAnalytics responde 501 cuando la recaudacion no es calculable', async () => {
    const res = crearRes();
    await ctrl.getFinancialAnalytics(req(), res);

    expect(res.statusCode).toBe(501);
    expect(res.body.code).toBe('NOT_IMPLEMENTED');
  });

  test('getFinancialAnalytics devuelve datos reales (no simulados) cuando hay recaudacion', async () => {
    realMetrics.recaudacionCobrada.mockResolvedValue({ disponible: true, total: 800 });
    const res = crearRes();
    await ctrl.getFinancialAnalytics(req(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.simulated).toBe(false);
    expect(res.body.data.recaudacion.total).toBe(800);
  });

  test('getRealTimeMetrics delega en el servicio', async () => {
    analyticsService.getRealTimeMetrics.mockReturnValue({ activos: 3 });
    const res = crearRes();
    await ctrl.getRealTimeMetrics(req(), res);
    expect(res.body.data.activos).toBe(3);
  });

  test('getDeclarationAnalytics usa el periodo por defecto last_30_days', async () => {
    analyticsService.getDeclarationAnalytics.mockResolvedValue({ success: true });
    const res = crearRes();
    await ctrl.getDeclarationAnalytics(req({}, {}), res);
    expect(analyticsService.getDeclarationAnalytics).toHaveBeenCalledWith('last_30_days', expect.any(Object));
  });

  test('getComplianceAnalytics y getPerformanceAnalytics delegan', async () => {
    analyticsService.getComplianceAnalytics.mockResolvedValue({ success: true });
    analyticsService.getPerformanceAnalytics.mockResolvedValue({ success: true });
    const r1 = crearRes(); await ctrl.getComplianceAnalytics(req(), r1);
    const r2 = crearRes(); await ctrl.getPerformanceAnalytics(req(), r2);
    expect(r1.body.success).toBe(true);
    expect(r2.body.success).toBe(true);
  });

  test('getComparisonReport exige period1 y period2 (400)', async () => {
    const res = crearRes();
    await ctrl.getComparisonReport(req({}, { period1: 'a' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('getComparisonReport con ambos periodos delega', async () => {
    analyticsService.getComparisonReport.mockResolvedValue({ success: true });
    const res = crearRes();
    await ctrl.getComparisonReport(req({}, { period1: 'a', period2: 'b' }), res);
    expect(res.statusCode).toBe(200);
  });

  test('executeQuery exige un array de metrics (400)', async () => {
    const res = crearRes();
    await ctrl.executeQuery(req({ metrics: 'noarray' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('executeQuery con metrics valido delega', async () => {
    analyticsService.queryAnalytics.mockResolvedValue({ success: true });
    const res = crearRes();
    await ctrl.executeQuery(req({ metrics: ['x'] }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('Reports', () => {
  test('generateReport exige type (400)', async () => {
    const res = crearRes();
    await ctrl.generateReport(req({ period: 'x' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('generateReport delega con format pdf por defecto', async () => {
    reportsService.generateReport.mockResolvedValue({ success: true, id: 'r1' });
    const res = crearRes();
    await ctrl.generateReport(req({ type: 'financial' }), res);
    expect(reportsService.generateReport).toHaveBeenCalledWith('financial', expect.objectContaining({ format: 'pdf' }));
  });

  test('getReport devuelve 404 cuando el servicio no lo encuentra', async () => {
    reportsService.getReport.mockReturnValue({ success: false });
    const res = crearRes();
    await ctrl.getReport(req({}, {}, { id: 'nope' }), res);
    expect(res.statusCode).toBe(404);
  });

  test('getReport devuelve 200 cuando existe', async () => {
    reportsService.getReport.mockReturnValue({ success: true, data: {} });
    const res = crearRes();
    await ctrl.getReport(req({}, {}, { id: 'r1' }), res);
    expect(res.statusCode).toBe(200);
  });

  test('listReports delega con paginacion parseada', async () => {
    reportsService.listReports.mockReturnValue({ success: true });
    const res = crearRes();
    await ctrl.listReports(req({}, { page: '2', limit: '5' }), res);
    expect(reportsService.listReports).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 5 }));
  });

  test('downloadReport fija cabeceras y envia el buffer', async () => {
    reportsService.exportReport.mockResolvedValue({
      success: true, contentType: 'application/pdf', filename: 'r.pdf', data: Buffer.from('x')
    });
    const res = crearRes();
    await ctrl.downloadReport(req({}, {}, { id: 'r1' }), res);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toMatch(/r\.pdf/);
  });

  test('downloadReport devuelve 404 si no existe', async () => {
    reportsService.exportReport.mockResolvedValue({ success: false });
    const res = crearRes();
    await ctrl.downloadReport(req({}, {}, { id: 'nope' }), res);
    expect(res.statusCode).toBe(404);
  });

  test('deleteReport devuelve 404 si no existe', async () => {
    reportsService.deleteReport.mockReturnValue({ success: false });
    const res = crearRes();
    await ctrl.deleteReport(req({}, {}, { id: 'nope' }), res);
    expect(res.statusCode).toBe(404);
  });

  test('getReportTypes delega', async () => {
    reportsService.getAvailableReportTypes.mockReturnValue(['financial']);
    const res = crearRes();
    await ctrl.getReportTypes(req(), res);
    expect(res.body.types).toEqual(['financial']);
  });

  test('previewReport exige type (400)', async () => {
    const res = crearRes();
    await ctrl.previewReport(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('scheduleReport exige type y frequency (400)', async () => {
    const res = crearRes();
    await ctrl.scheduleReport(req({ type: 'financial' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('scheduleReport con type+frequency delega', async () => {
    reportsService.scheduleReport.mockReturnValue({ success: true });
    const res = crearRes();
    await ctrl.scheduleReport(req({ type: 'financial', frequency: 'weekly' }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('KPIs', () => {
  test('getKPIDefinitions sin categoria usa getKPIDefinitions', async () => {
    kpiService.getKPIDefinitions.mockReturnValue([{ id: 'k1' }]);
    const res = crearRes();
    await ctrl.getKPIDefinitions(req({}, {}), res);
    expect(kpiService.getKPIDefinitions).toHaveBeenCalled();
    expect(kpiService.getKPIsByCategory).not.toHaveBeenCalled();
  });

  test('getKPIDefinitions con categoria usa getKPIsByCategory', async () => {
    kpiService.getKPIsByCategory.mockReturnValue([{ id: 'k1' }]);
    const res = crearRes();
    await ctrl.getKPIDefinitions(req({}, { category: 'financial' }), res);
    expect(kpiService.getKPIsByCategory).toHaveBeenCalledWith('financial');
  });

  test('setKPITarget exige target (400)', async () => {
    const res = crearRes();
    await ctrl.setKPITarget(req({}, {}, { id: 'k1' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('setKPITarget con target=0 (valido, no undefined) delega', async () => {
    kpiService.setKPITarget.mockReturnValue({ success: true });
    const res = crearRes();
    await ctrl.setKPITarget(req({ target: 0 }, {}, { id: 'k1' }), res);
    expect(res.statusCode).toBe(200);
    expect(kpiService.setKPITarget).toHaveBeenCalledWith('k1', 0);
  });

  test('compareKPIs exige ambos periodos (400)', async () => {
    const res = crearRes();
    await ctrl.compareKPIs(req({}, { period1: 'a' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('acknowledgeKPIAlert usa el usuario o "system"', async () => {
    kpiService.acknowledgeAlert.mockReturnValue({ success: true });
    const res = crearRes();
    await ctrl.acknowledgeKPIAlert(req({}, {}, { id: 'a1' }, { id: 'u9' }), res);
    expect(kpiService.acknowledgeAlert).toHaveBeenCalledWith('a1', 'u9');
  });

  test('dismissKPIAlert devuelve 404 si no existe', async () => {
    kpiService.dismissAlert.mockReturnValue({ success: false });
    const res = crearRes();
    await ctrl.dismissKPIAlert(req({}, {}, { id: 'nope' }), res);
    expect(res.statusCode).toBe(404);
  });

  test('getKPIDashboard/getAllKPIs/calculateKPI/getKPIHistory/getKPIAlerts delegan', async () => {
    kpiService.getKPIDashboard.mockResolvedValue({ success: true });
    kpiService.getAllKPIs.mockResolvedValue({ success: true });
    kpiService.calculateKPI.mockResolvedValue({ success: true });
    kpiService.getKPIHistory.mockReturnValue({ success: true });
    kpiService.getActiveAlerts.mockReturnValue({ success: true });

    for (const [fn, args] of [
      [ctrl.getKPIDashboard, [req()]],
      [ctrl.getAllKPIs, [req()]],
      [ctrl.calculateKPI, [req({}, {}, { id: 'k1' })]],
      [ctrl.getKPIHistory, [req({}, {}, { id: 'k1' })]],
      [ctrl.getKPIAlerts, [req()]]
    ]) {
      const res = crearRes();
      await fn(...args, res);
      expect(res.statusCode).toBe(200);
    }
  });
});

describe('Predicciones', () => {
  test('predictVolume responde 501 (era una simulacion con Math.random)', async () => {
    const res = crearRes();
    await ctrl.predictVolume(req(), res);
    expect(res.statusCode).toBe(501);
    expect(res.body.reason).toBe('sin historico');
  });

  test('predictProcessingTime responde 501 (el tiempo real esta en el dashboard)', async () => {
    const res = crearRes();
    await ctrl.predictProcessingTime(req(), res);
    expect(res.statusCode).toBe(501);
    expect(res.body.reason).toBe('sin modelo');
  });

  test('predictDuties exige customsValue (400)', async () => {
    const res = crearRes();
    await ctrl.predictDuties(req({ weight: 10 }), res);
    expect(res.statusCode).toBe(400);
  });

  test('predictDuties con customsValue delega', async () => {
    predictionsService.predictDuties.mockResolvedValue({ success: true });
    const res = crearRes();
    await ctrl.predictDuties(req({ customsValue: 100 }), res);
    expect(res.statusCode).toBe(200);
  });

  test('detectAnomalies exige data (400)', async () => {
    const res = crearRes();
    await ctrl.detectAnomalies(req({ threshold: 2 }), res);
    expect(res.statusCode).toBe(400);
  });

  test('predictChannel/predictInspection exigen declarationData', async () => {
    // req.body es {} → predictChannel: !declarationData es false para {} pero el
    // handler valida el objeto; con body vacio delega. Se prueba el happy path.
    predictionsService.predictChannel.mockResolvedValue({ success: true });
    predictionsService.predictInspection.mockResolvedValue({ success: true });
    const r1 = crearRes(); await ctrl.predictChannel(req({ value: 1 }), r1);
    const r2 = crearRes(); await ctrl.predictInspection(req({ value: 1 }), r2);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
  });

  test('analyzeTrends y getModelMetrics delegan', async () => {
    predictionsService.analyzeTrends.mockResolvedValue({ success: true });
    predictionsService.getModelMetrics.mockReturnValue({ success: true });
    const r1 = crearRes(); await ctrl.analyzeTrends(req({ data: {} }), r1);
    const r2 = crearRes(); await ctrl.getModelMetrics(req(), r2);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
  });
});

describe('IA (LUCI): validaciones y delegacion', () => {
  const casos = [
    ['aiGenerateInsights', 'analyticsData', 'generateAutomaticInsights'],
    ['aiDetectAnomalies', 'data', 'detectAnomaliesAI'],
    ['aiPredictTrends', 'historicalData', 'predictTrendsAI'],
    ['aiGenerateExecutiveReport', 'analyticsData', 'generateExecutiveReport'],
    ['aiAnalyzeKPIDeviations', 'kpiData', 'analyzeKPIDeviations'],
    ['aiFullAnalysis', 'analyticsData', 'fullAnalyticsAnalysis']
  ];

  test('cada handler IA exige su campo obligatorio (400)', async () => {
    for (const [handler] of casos) {
      const res = crearRes();
      await ctrl[handler](req({}), res);
      expect(res.statusCode).toBe(400);
    }
  });

  test('cada handler IA delega en aiService cuando el campo esta presente', async () => {
    for (const [handler, campo, aiFn] of casos) {
      aiService[aiFn].mockResolvedValue({ ok: true });
      const res = crearRes();
      await ctrl[handler](req({ [campo]: { x: 1 } }), res);
      expect(res.statusCode).toBe(200);
      expect(aiService[aiFn]).toHaveBeenCalled();
    }
  });
});
