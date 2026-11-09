/**
 * predictionsService sin Math.random: ninguna cifra ni confianza inventada.
 */
jest.mock('../../../src/services/aiService', () => ({
  detectAnomaliesAI: jest.fn(),
  predictTrendsAI: jest.fn(),
  generateAutomaticInsights: jest.fn()
}));
jest.mock('../../../src/services/analytics/realMetricsService', () => ({
  NO_DISPONIBLE: { SIN_HISTORICO: 'sin historico suficiente' },
  repartoPorCanal: jest.fn(),
  volumenDeclaraciones: jest.fn(),
  cumplimiento: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const realMetrics = require('../../../src/services/analytics/realMetricsService');
const predictions = require('../../../src/services/analytics/predictionsService');

const DIR = path.join(__dirname, '../../../src/services/analytics');

describe('vigilancia: services/analytics no genera valores aleatorios', () => {
  test('Math.random solo aparece en lineas que construyen identificadores', () => {
    for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
      const lineas = fs.readFileSync(path.join(DIR, f), 'utf8')
        .split('\n').filter((l) => /Math\.random/.test(l) && !/^\s*(\/\/|\*)/.test(l));
      for (const l of lineas) {
        expect({ f, l: /toString\(36\)/.test(l) }).toEqual({ f, l: true });
      }
    }
  });

  test('predictVolume y predictProcessingTime ya no existen en el servicio', () => {
    expect(predictions.predictVolume).toBeUndefined();
    expect(predictions.predictProcessingTime).toBeUndefined();
  });
});

describe('predictDuties: la confianza no es aleatoria', () => {
  test('codigo con capitulo en la tabla -> high; capitulo desconocido -> low; siempre igual', async () => {
    const conocido = await Promise.all([1, 2, 3].map(() => predictions.predictDuties({ customsValue: 1000, commodityCode: '8471300000' })));
    expect(conocido.map((r) => r.data.confidence)).toEqual(['high', 'high', 'high']);
    const desconocido = await predictions.predictDuties({ customsValue: 1000, commodityCode: '9999000000' });
    expect(desconocido.data.confidence).toBe('low');
  });
});

describe('predictChannel: distribucion historica real', () => {
  const decl = { originCountry: 'CN', customsValue: 5000, commodityCode: '8471300000' };

  test('con tenant: porcentajes reales de repartoPorCanal', async () => {
    realMetrics.repartoPorCanal.mockResolvedValue({ conCanalAsignado: 4, porcentajes: { green: 75, orange: 25, red: 0, yellow: 0 } });
    const r = await predictions.predictChannel(decl, { tenantId: 't1' });
    expect(r.data.historicalDistribution).toEqual({ green: 75, orange: 25, red: 0, yellow: 0 });
    expect(realMetrics.repartoPorCanal.mock.calls[0][0]).toBe('t1');
  });

  test.each([
    ['sin tenant (null)', { tenantId: null }],
    ['sin opciones', undefined]
  ])('%s: null y sin consultar', async (_n, opts) => {
    const r = await predictions.predictChannel(decl, opts);
    expect(r.data.historicalDistribution).toBeNull();
    expect(realMetrics.repartoPorCanal).not.toHaveBeenCalled();
  });

  test('ningun expediente con canal: null, no ceros', async () => {
    realMetrics.repartoPorCanal.mockResolvedValue({ conCanalAsignado: 0, porcentajes: { green: 0, orange: 0, red: 0, yellow: 0 } });
    const r = await predictions.predictChannel(decl, { tenantId: 't1' });
    expect(r.data.historicalDistribution).toBeNull();
  });

  test('si la consulta falla la prediccion sigue y la distribucion es null', async () => {
    realMetrics.repartoPorCanal.mockRejectedValue(new Error('db'));
    const r = await predictions.predictChannel(decl, { tenantId: 't1' });
    expect(r.success).toBe(true);
    expect(r.data.historicalDistribution).toBeNull();
  });
});

describe('predictInspection: tasa historica real', () => {
  const decl = { originCountry: 'CN', customsValue: 5000, commodityCode: '8471300000' };

  test('inspecciones / declaraciones de los ultimos 90 dias del tenant', async () => {
    realMetrics.volumenDeclaraciones.mockResolvedValue({ total: 40 });
    realMetrics.cumplimiento.mockResolvedValue({ inspecciones: 4 });
    const r = await predictions.predictInspection(decl, { tenantId: 't1' });
    expect(r.data.historicalRate).toBe(10);
    expect(realMetrics.volumenDeclaraciones.mock.calls[0][0]).toBe('t1');
  });

  test.each([
    ['sin declaraciones', { total: 0 }, { inspecciones: 0 }, { tenantId: 't1' }],
    ['sin tenant', { total: 40 }, { inspecciones: 4 }, { tenantId: null }],
    ['sin opciones', { total: 40 }, { inspecciones: 4 }, undefined]
  ])('%s: historicalRate null', async (_n, vol, cum, opts) => {
    realMetrics.volumenDeclaraciones.mockResolvedValue(vol);
    realMetrics.cumplimiento.mockResolvedValue(cum);
    const r = await predictions.predictInspection(decl, opts);
    expect(r.data.historicalRate).toBeNull();
  });
});

describe('analyzeTrends: sin series no hay tendencia', () => {
  test('sin series responde SIN_HISTORICO, sin series sinteticas', async () => {
    const r = await predictions.analyzeTrends({});
    expect(r.success).toBe(false);
    expect(r.code).toBe('SIN_HISTORICO');
    expect(r.error).toBe('sin historico suficiente');
  });

  test('con una serie real solo se calcula esa tendencia; las demas son null', async () => {
    const r = await predictions.analyzeTrends({ volumes: [1, 2, 3, 4, 5, 6] });
    expect(r.success).toBe(true);
    expect(r.data.trends.volume.direction).toBe('up');
    expect(r.data.trends.value).toBeNull();
    expect(r.data.trends.compliance).toBeNull();
    expect(r.data.forecasts.value).toBeNull();
  });
});

describe('getModelMetrics: sin precisiones inventadas', () => {
  test('no hay modelos entrenados: accuracy null y disponible false', () => {
    const r = predictions.getModelMetrics();
    expect(r.data.disponible).toBe(false);
    expect(r.data.overallAccuracy).toBeNull();
    for (const m of Object.values(r.data.models)) {
      expect(m).toEqual({ disponible: false, accuracy: null, lastTrained: null });
    }
  });

  test('la ficha de modelo de las predicciones no lleva precision inventada', async () => {
    const r = await predictions.predictChannel({ customsValue: 1 });
    expect(r.data.modelInfo).toEqual({ disponible: false, accuracy: null, lastTrained: null });
  });
});
