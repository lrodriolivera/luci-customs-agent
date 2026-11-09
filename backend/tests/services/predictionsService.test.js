/**
 * predictionsService: predicciones de analitica (volumen, canal, inspeccion,
 * tiempo de proceso, aranceles, anomalias, tendencias).
 *
 * Alimenta el panel de Business Intelligence de LUCI. La mayor parte es logica
 * determinista (scoring de riesgo, tipos arancelarios por capitulo, deteccion
 * de outliers por z-score, regresion lineal de tendencias) que no necesita
 * mockear NADA. La unica dependencia externa es `aiService` (Bedrock), que solo
 * enriquece el resultado con insights en lenguaje natural; se mockea SOLO esa
 * frontera para (a) verificar el mapeo de su respuesta y (b) comprobar que si
 * Bedrock falla, el metodo degrada a `luciAnalysis: null` sin romper.
 *
 * `Math.random` y `new Date` son fuentes de no-determinismo del sistema, no el
 * codigo bajo prueba: las predicciones puntuales varian, asi que se comprueban
 * invariantes (rangos, orden, estructura, cotas) en vez de valores exactos.
 */

jest.mock('../../src/services/aiService', () => ({
  generateAutomaticInsights: jest.fn(),
  detectAnomaliesAI: jest.fn(),
  predictTrendsAI: jest.fn()
}));

const aiService = require('../../src/services/aiService');
const predictions = require('../../src/services/analytics/predictionsService');

beforeEach(() => {
  // jest.config tiene resetMocks:true -> re-dar implementacion en cada test.
  aiService.generateAutomaticInsights.mockResolvedValue({
    executiveSummary: 'Resumen IA',
    recommendations: ['Contratar refuerzo en pico'],
    opportunities: [{ description: 'Automatizar despachos verdes' }]
  });
  aiService.detectAnomaliesAI.mockResolvedValue({
    summary: { criticalCount: 1, highCount: 2, topPriority: 'Revisar pico de valor' },
    anomalies: [{ recommendedActions: ['Contrastar con factura'] }],
    alertsGenerated: ['Alerta enviada al operador']
  });
  aiService.predictTrendsAI.mockResolvedValue({
    keyPredictions: [{ description: 'Volumen sube 10%' }],
    recommendations: ['Ampliar plantilla'],
    limitations: ['Datos de solo 30 dias']
  });
});

describe('predictChannel', () => {
  test('las probabilidades suman ~100 y el canal predicho es el de mayor prob', async () => {
    const r = await predictions.predictChannel({ originCountry: 'ES', customsValue: 5000 });
    const p = r.data.probabilities;
    const suma = p.green + p.orange + p.red + p.yellow;
    expect(suma).toBeGreaterThanOrEqual(99);
    expect(suma).toBeLessThanOrEqual(101);
    const max = Math.max(p.green, p.orange, p.red, p.yellow);
    expect(p[r.data.predictedChannel]).toBe(max);
  });

  test('un envio de bajo riesgo se predice verde', async () => {
    const r = await predictions.predictChannel({ originCountry: 'DE', customsValue: 1000 });
    expect(r.data.predictedChannel).toBe('green');
    expect(r.data.factors).toEqual([]); // sin factores de riesgo
  });

  test('un envio de alto riesgo eleva el riskScore e identifica factores', async () => {
    const r = await predictions.predictChannel({
      originCountry: 'CN', customsValue: 150000, firstTimeImporter: true, documentsComplete: false
    });
    expect(r.data.riskScore).toBeGreaterThan(60);
    const impactos = r.data.factors.map(f => f.factor);
    expect(impactos).toContain('Valor aduanero elevado');
    expect(impactos).toContain('Importador sin histórico');
    expect(r.data.recommendations.length).toBeGreaterThan(0);
  });
});

describe('predictInspection', () => {
  test('bajo riesgo: probabilidad baja y control documental', async () => {
    const r = await predictions.predictInspection({ originCountry: 'DE', customsValue: 2000 });
    expect(r.data.inspectionProbability).toBeLessThanOrEqual(50);
    expect(r.data.inspectionType).toBe('documentary');
    expect(r.data.riskLevel).toBe('low');
  });

  test('alto riesgo (CN + alto valor + primerizo + cap.85) empuja a fisica', async () => {
    const r = await predictions.predictInspection({
      originCountry: 'CN', customsValue: 200000, firstTimeImporter: true, commodityCode: '8517120000'
    });
    expect(r.data.inspectionProbability).toBeGreaterThan(50);
    expect(r.data.inspectionType).toBe('physical');
    expect(r.data.contributingFactors).toContain('Origen China (mayor escrutinio)');
    expect(r.data.mitigationSuggestions.length).toBeGreaterThan(1);
  });

  test('la probabilidad nunca supera 95', async () => {
    const r = await predictions.predictInspection({
      originCountry: 'CN', customsValue: 999999, firstTimeImporter: true, commodityCode: '8471300000'
    });
    expect(r.data.inspectionProbability).toBeLessThanOrEqual(95);
  });
});

describe('predictDuties', () => {
  test('cap. 61 (textil) aplica 12% de arancel y 21% de IVA sobre valor+arancel', async () => {
    const r = await predictions.predictDuties({ commodityCode: '6109100010', customsValue: 10000 });
    expect(r.data.rates.duty).toBe(12);
    expect(r.data.predictions.customsDuty).toBe(1200); // 10000 * 12%
    expect(r.data.predictions.vat).toBe(2352);         // (10000+1200) * 21%
    expect(r.data.predictions.total).toBe(3552);
  });

  test('capitulo desconocido cae al 4,5% por defecto', async () => {
    const r = await predictions.predictDuties({ commodityCode: '9999999999', customsValue: 1000 });
    expect(r.data.rates.duty).toBe(4.5);
  });

  test('origen con preferencia (JP) identifica ahorro potencial', async () => {
    const r = await predictions.predictDuties({ commodityCode: '6109100010', customsValue: 10000, originCountry: 'JP' });
    expect(r.data.potentialSavings.total).toBeGreaterThan(0);
    expect(r.data.notes.some(n => /Ahorro potencial/.test(n))).toBe(true);
  });

  test('sin datos usa valor y codigo por defecto', async () => {
    const r = await predictions.predictDuties({});
    expect(r.data.customsValue).toBe(10000);
    expect(r.data.rates.duty).toBe(0); // 8471 -> cap 84 -> 0%
  });

  // Guarda de regresion del bug corregido: los capitulos 84 (maquinas) y 85
  // (electronica) tienen tipo 0% legitimo. El `rates[chapter] || 4.5` original
  // los trataba como falsy y devolvia 4,5% sobre mercancia en realidad exenta.
  test('cap. 84 y 85 (0% legitimo) NO caen al 4,5% por defecto', async () => {
    const maquina = await predictions.predictDuties({ commodityCode: '8471300000', customsValue: 5000 });
    const electronica = await predictions.predictDuties({ commodityCode: '8517120000', customsValue: 5000 });
    expect(maquina.data.rates.duty).toBe(0);
    expect(maquina.data.predictions.customsDuty).toBe(0);
    expect(electronica.data.rates.duty).toBe(0);
  });
});

describe('detectAnomalies', () => {
  test('detecta un pico de valor por z-score', async () => {
    // 8 valores planos + 1 pico -> z del pico = 2,83 > threshold 2.
    const r = await predictions.detectAnomalies(
      { values: [10, 10, 10, 10, 10, 10, 10, 10, 100] }, { threshold: 2 });
    expect(r.data.anomaliesFound).toBeGreaterThanOrEqual(1);
    expect(r.data.anomalies[0].type).toBe('value_spike');
    expect(r.data.anomalies[0]).toHaveProperty('zScore');
  });

  test('mapea anomalias de volumen a volume_spike/volume_drop', async () => {
    const r = await predictions.detectAnomalies(
      { volumes: [5, 5, 5, 5, 5, 5, 5, 5, 90] }, { threshold: 2 });
    expect(r.data.anomalies.some(a => a.type === 'volume_spike')).toBe(true);
  });

  test('sin anomalias no llama a LUCI y el riesgo es bajo', async () => {
    const r = await predictions.detectAnomalies({ values: [10, 10, 10, 10] });
    expect(r.data.anomaliesFound).toBe(0);
    expect(r.data.riskAssessment).toBe('low');
    expect(r.data.luciAnalysis).toBeNull();
    expect(aiService.detectAnomaliesAI).not.toHaveBeenCalled();
  });

  test('con anomalias enriquece con LUCI (summary desde topPriority)', async () => {
    const r = await predictions.detectAnomalies(
      { values: [10, 10, 10, 10, 10, 10, 10, 10, 100] }, { threshold: 2 });
    expect(aiService.detectAnomaliesAI).toHaveBeenCalled();
    expect(r.data.luciAnalysis.summary).toBe('Revisar pico de valor');
    expect(r.data.luciAnalysis.recommendations.length).toBeGreaterThan(0);
  });

  test('si LUCI falla al analizar anomalias, degrada a null', async () => {
    aiService.detectAnomaliesAI.mockRejectedValue(new Error('timeout'));
    const r = await predictions.detectAnomalies(
      { values: [10, 10, 10, 10, 10, 10, 10, 10, 100] }, { threshold: 2 });
    expect(r.success).toBe(true);
    expect(r.data.luciAnalysis).toBeNull();
  });
});

describe('analyzeTrends', () => {
  test('calcula tendencia al alza para una serie creciente', async () => {
    const r = await predictions.analyzeTrends({ volumes: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(r.data.trends.volume.direction).toBe('up');
    expect(r.data.forecasts.volume).toHaveProperty('value');
  });

  test('serie plana da tendencia estable', async () => {
    const r = await predictions.analyzeTrends({ volumes: [5, 5, 5, 5, 5] });
    expect(r.data.trends.volume.direction).toBe('stable');
    expect(r.data.trends.volume.slope).toBe(0);
  });

  test('incorpora los insights de tendencia de LUCI', async () => {
    const r = await predictions.analyzeTrends({ volumes: [1, 2, 3, 4] });
    expect(aiService.predictTrendsAI).toHaveBeenCalled();
    expect(r.data.luciInsights.summary).toBe('Volumen sube 10%');
    expect(r.data.luciInsights.keyInsights.length).toBeGreaterThan(0);
  });

  test('sin series no se inventan series sinteticas: SIN_HISTORICO', async () => {
    const r = await predictions.analyzeTrends({});
    expect(r.success).toBe(false);
    expect(r.code).toBe('SIN_HISTORICO');
  });
});

describe('getModelMetrics', () => {
  test('devuelve los 4 modelos sin precision: no hay modelos entrenados', () => {
    const r = predictions.getModelMetrics();
    expect(r.success).toBe(true);
    expect(Object.keys(r.data.models)).toHaveLength(4);
    expect(r.data.overallAccuracy).toBeNull();
    expect(r.data.disponible).toBe(false);
  });
});
