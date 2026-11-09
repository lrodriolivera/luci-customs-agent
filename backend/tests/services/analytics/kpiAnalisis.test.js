/**
 * El panel de KPIs no puede esperar a LUCI: getKPIDashboard responde al instante
 * (luciAnalysis: null) y el análisis (Bedrock, lento) va aparte en getKPIAnalysis,
 * con caché en memoria por tenant durante 10 minutos.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn(),
  analyzeKPIDeviations: jest.fn()
}));

const aiService = require('../../../src/services/aiService');
const kpiService = require('../../../src/services/analytics/kpiService');

const DATOS = {
  totalDeclarations: 300, days: 30, greenChannel: 40, avgProcessingTime: 4, activeExpeditions: 20,
  totalDuties: 250000, rejectionRate: 9           // greenChannel y rejectionRate en alerta/crítico
};
const A = 'tenant-a';
const B = 'tenant-b';
const DIEZ_MIN = 10 * 60 * 1000;

const respuesta = (summary) => ({ overallPerformance: { summary }, quickWins: [{ action: 'x' }] });
let ahora;
let dateNow;

beforeEach(() => {
  jest.clearAllMocks();
  kpiService.limpiarCacheAnalisis();
  aiService.analyzeKPIDeviations.mockResolvedValue(respuesta('Análisis 1'));
  ahora = 1_800_000_000_000;
  dateNow = jest.spyOn(Date, 'now').mockImplementation(() => ahora);
});
afterEach(() => dateNow.mockRestore());

describe('getKPIDashboard ya no espera a LUCI', () => {
  test('no llama al análisis y devuelve luciAnalysis null al instante', async () => {
    aiService.analyzeKPIDeviations.mockImplementation(() => new Promise(() => {})); // colgado
    const r = await kpiService.getKPIDashboard(A, DATOS);
    expect(r.success).toBe(true);
    expect(r.data.luciAnalysis).toBeNull();
    expect(aiService.analyzeKPIDeviations).not.toHaveBeenCalled();
    expect(r.data.kpis.all.length).toBeGreaterThan(0);
    expect(r.data.healthScore).not.toBeNull();
  });
});

describe('getKPIAnalysis', () => {
  test('calcula el análisis con los KPI del tenant', async () => {
    const r = await kpiService.getKPIAnalysis(A, DATOS);
    expect(r.success).toBe(true);
    expect(r.data.luciAnalysis.summary).toBe('Análisis 1');
    expect(r.data.luciAnalysis.priorities).toContain('x');
    expect(r.data.fromCache).toBe(false);
    expect(aiService.analyzeKPIDeviations).toHaveBeenCalledTimes(1);
    const [payload] = aiService.analyzeKPIDeviations.mock.calls[0];
    expect(payload.criticalKPIs.length + payload.warningKPIs.length).toBeGreaterThan(0);
  });

  test('sin ningún KPI calculado devuelve null y no llama a LUCI', async () => {
    const r = await kpiService.getKPIAnalysis(A, {});
    expect(r.data.luciAnalysis).toBeNull();
    expect(aiService.analyzeKPIDeviations).not.toHaveBeenCalled();
  });

  test('no escribe histórico ni alertas (la carga del dashboard ya lo hizo)', async () => {
    const antesH = kpiService.getKPIHistory('rejection_rate', 'last_30_days', 'tenant-pura').history.length;
    await kpiService.getKPIAnalysis('tenant-pura', DATOS);
    expect(kpiService.getKPIHistory('rejection_rate', 'last_30_days', 'tenant-pura').history.length).toBe(antesH);
    expect(kpiService.getActiveAlerts({}, 'tenant-pura').alerts).toEqual([]);
  });

  test('un fallo de LUCI devuelve null y NO se cachea', async () => {
    aiService.analyzeKPIDeviations.mockRejectedValueOnce(new Error('timeout'));
    expect((await kpiService.getKPIAnalysis(A, DATOS)).data.luciAnalysis).toBeNull();

    const r = await kpiService.getKPIAnalysis(A, DATOS);
    expect(r.data.luciAnalysis.summary).toBe('Análisis 1');
    expect(aiService.analyzeKPIDeviations).toHaveBeenCalledTimes(2);
  });
});

describe('getKPIAnalysis: caché de 10 minutos por tenant', () => {
  test('la segunda llamada dentro de 10 min sale de la caché sin llamar a Bedrock', async () => {
    const r1 = await kpiService.getKPIAnalysis(A, DATOS);
    ahora += DIEZ_MIN - 1;
    const r2 = await kpiService.getKPIAnalysis(A, DATOS);
    expect(aiService.analyzeKPIDeviations).toHaveBeenCalledTimes(1);
    expect(r2.data.fromCache).toBe(true);
    expect(r2.data.luciAnalysis).toEqual(r1.data.luciAnalysis);
    expect(r2.data.generatedAt).toBe(r1.data.generatedAt);
  });

  test('pasados 10 min se recalcula', async () => {
    await kpiService.getKPIAnalysis(A, DATOS);
    ahora += DIEZ_MIN;
    aiService.analyzeKPIDeviations.mockResolvedValue(respuesta('Análisis 2'));
    const r = await kpiService.getKPIAnalysis(A, DATOS);
    expect(aiService.analyzeKPIDeviations).toHaveBeenCalledTimes(2);
    expect(r.data.luciAnalysis.summary).toBe('Análisis 2');
    expect(r.data.fromCache).toBe(false);
  });

  test('cada tenant tiene su caché: el análisis de A no se sirve a B', async () => {
    await kpiService.getKPIAnalysis(A, DATOS);
    aiService.analyzeKPIDeviations.mockResolvedValue(respuesta('Análisis de B'));
    const rB = await kpiService.getKPIAnalysis(B, DATOS);
    expect(rB.data.luciAnalysis.summary).toBe('Análisis de B');
    expect(aiService.analyzeKPIDeviations).toHaveBeenCalledTimes(2);
    // y A sigue con el suyo
    expect((await kpiService.getKPIAnalysis(A, DATOS)).data.luciAnalysis.summary).toBe('Análisis 1');
  });

  test('plataforma (undefined) tiene su propia caché, distinta de la de un tenant', async () => {
    await kpiService.getKPIAnalysis(A, DATOS);
    await kpiService.getKPIAnalysis(undefined, DATOS);
    expect(aiService.analyzeKPIDeviations).toHaveBeenCalledTimes(2);
  });

  test('dos peticiones simultáneas comparten una sola llamada a Bedrock', async () => {
    let resolver;
    aiService.analyzeKPIDeviations.mockImplementation(() => new Promise(r => { resolver = r; }));
    const p1 = kpiService.getKPIAnalysis(A, DATOS);
    const p2 = kpiService.getKPIAnalysis(A, DATOS);
    await new Promise(r => setImmediate(r));
    resolver(respuesta('Compartido'));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(aiService.analyzeKPIDeviations).toHaveBeenCalledTimes(1);
    expect(r1.data.luciAnalysis.summary).toBe('Compartido');
    expect(r2.data.luciAnalysis.summary).toBe('Compartido');
  });
});
