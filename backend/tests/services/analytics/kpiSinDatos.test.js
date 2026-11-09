/**
 * Criterio de producto: ningún KPI muestra una cifra inventada. O sale de datos
 * reales, o se marca "sin datos" (value null, status 'sin_datos'), sin generar
 * alerta ni histórico.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn(),
  analyzeKPIDeviations: jest.fn().mockResolvedValue({ summary: 'ok' })
}));

const aiService = require('../../../src/services/aiService');
const kpiService = require('../../../src/services/analytics/kpiService');

const TENANT = 'tenant-sin-datos';
const SEIS = {
  totalDeclarations: 300, days: 30, greenChannel: 80, avgProcessingTime: 4,
  activeExpeditions: 20, totalDuties: 250000, rejectionRate: 1
};
const SIN_FUENTE = ['savings_achieved', 'guarantee_utilization', 'error_rate', 'on_time_submissions', 'compliance_score',
  'document_completeness', 'luci_accuracy', 'automation_rate', 'first_time_resolution', 'aeat_connectivity'];

let random;
beforeEach(() => {
  jest.clearAllMocks();
  random = jest.spyOn(Math, 'random');
  for (const a of kpiService.getActiveAlerts({}, undefined).alerts) kpiService.dismissAlert(a.id, undefined);
});
afterEach(() => random.mockRestore());

describe('calculateKPI sin datos', () => {
  test('sin data devuelve value null, status sin_datos y trend null', async () => {
    const r = await kpiService.calculateKPI('error_rate', {}, TENANT);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ kpiId: 'error_rate', value: null, status: 'sin_datos', trend: null });
    expect(r.data.unit).toBe('%');
    expect(r.data.target).toBe(1);
  });

  test('no genera alerta ni guarda histórico', async () => {
    await kpiService.calculateKPI('error_rate', {}, TENANT);
    expect(kpiService.getActiveAlerts({}, TENANT).alerts).toEqual([]);
    expect(kpiService.getKPIHistory('error_rate', 'last_30_days', TENANT).history).toEqual([]);
  });

  test('nunca usa Math.random', async () => {
    await kpiService.getAllKPIs({}, TENANT);
    await kpiService.compareKPIs('this_month', 'last_month');
    expect(random).not.toHaveBeenCalled();
  });

  test('con data usa el valor real, calcula estado, histórico y alerta', async () => {
    const r = await kpiService.calculateKPI('error_rate', { errorRate: 9 }, TENANT);
    expect(r.data.value).toBe(9);
    expect(r.data.status).toBe('critical');
    expect(kpiService.getActiveAlerts({}, TENANT).alerts).toHaveLength(1);
    expect(kpiService.getKPIHistory('error_rate', 'last_30_days', TENANT).history).toHaveLength(1);
  });

  test('un valor 0 real no es "sin datos"', async () => {
    const r = await kpiService.calculateKPI('declarations_per_day', { totalDeclarations: 0, days: 30 }, TENANT);
    expect(r.data.value).toBe(0);
    expect(r.data.status).not.toBe('sin_datos');
  });

  test.each([[null], [undefined], ['9'], [NaN], [Infinity]])('un valor no numérico (%j) es sin datos', async (v) => {
    const r = await kpiService.calculateKPI('error_rate', { errorRate: v }, TENANT);
    expect(r.data.value).toBeNull();
    expect(r.data.status).toBe('sin_datos');
  });
});

describe('getAllKPIs / dashboard', () => {
  test('sin data los 16 KPI son sin_datos', async () => {
    const r = await kpiService.getAllKPIs({}, TENANT);
    expect(r.data.all).toHaveLength(16);
    expect(r.data.all.every(k => k.value === null && k.status === 'sin_datos')).toBe(true);
    expect(r.data.summary).toMatchObject({ total: 16, sin_datos: 16, good: 0, ok: 0, warning: 0, critical: 0 });
  });

  test('con los datos de los seis KPI con fuente, los otros diez siguen sin datos', async () => {
    const r = await kpiService.getAllKPIs(SEIS, TENANT);
    const con = r.data.all.filter(k => k.value !== null).map(k => k.kpiId).sort();
    expect(con).toEqual(['active_expeditions', 'average_processing_time', 'declarations_per_day',
      'green_channel_rate', 'rejection_rate', 'total_duties_collected']);
    for (const id of SIN_FUENTE) {
      expect(r.data.all.find(k => k.kpiId === id).status).toBe('sin_datos');
    }
    expect(r.data.summary.sin_datos).toBe(10);
  });

  test('el dashboard sin datos: healthScore null, 0 calculados de 16 y sin análisis de LUCI', async () => {
    const r = await kpiService.getKPIDashboard(TENANT, {});
    expect(r.data.healthScore).toBeNull();
    expect(r.data.kpisCalculados).toBe(0);
    expect(r.data.kpisTotal).toBe(16);
    expect(r.data.luciAnalysis).toBeNull();
    expect(aiService.analyzeKPIDeviations).not.toHaveBeenCalled();
    expect(r.data.alerts).toEqual([]);
  });

  test('el healthScore ignora los sin datos y dice sobre cuántos se calcula', async () => {
    const r = await kpiService.getKPIDashboard(TENANT, SEIS);
    expect(r.data.kpisCalculados).toBe(6);
    expect(r.data.kpisTotal).toBe(16);
    const calculados = r.data.kpis.all.filter(k => k.value !== null);
    const pesos = { good: 100, ok: 75, warning: 40, critical: 0 };
    const esperado = Math.round(calculados.reduce((s, k) => s + pesos[k.status], 0) / calculados.length);
    expect(r.data.healthScore).toBe(esperado);
  });

  test('las tendencias no cuentan los sin datos', async () => {
    const r = await kpiService.getKPIDashboard(TENANT, {});
    expect(r.data.trends).toEqual({ improving: 0, declining: 0, stable: 0 });
  });
});

describe('compareKPIs sin datos', () => {
  test('sin datos por periodo no inventa cifras: valores y cambio null', async () => {
    const r = await kpiService.compareKPIs('this_month', 'last_month');
    expect(r.success).toBe(true);
    for (const k of Object.values(r.data.kpis)) {
      expect(k).toMatchObject({ period1Value: null, period2Value: null, change: null, improved: null });
    }
  });

  test('con datos de los dos periodos calcula el cambio real', async () => {
    const r = await kpiService.compareKPIs('this_month', 'last_month', {
      period1: { rejectionRate: 2 }, period2: { rejectionRate: 4 }
    });
    expect(r.data.kpis.rejection_rate).toMatchObject({ period1Value: 2, period2Value: 4, change: -50, improved: true });
    expect(r.data.kpis.error_rate.period1Value).toBeNull();
  });
});

describe('API', () => {
  test('_generateValue ya no existe', () => {
    expect(kpiService._generateValue).toBeUndefined();
  });
});
