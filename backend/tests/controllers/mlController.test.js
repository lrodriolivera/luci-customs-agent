/**
 * mlController — API REST de los servicios de ML (Fase 6.5): predicción de
 * circuito, detección de fraude, clasificación, recomendaciones y auto-respuesta.
 *
 * Es un wrapper delgado sobre services/ml. Lo que ejercita este test es la
 * lógica PROPIA del controller: validación de entrada (400), passthrough del
 * resultado del service, y el catch → 500. El motor ML se mockea (frontera:
 * ya está cubierto por los tests de cada servicio) para no re-ejercitarlo.
 *
 * jest.config: resetMocks:true borra la implementación de los jest.fn antes de
 * cada test → se restauran en beforeEach.
 */

jest.mock('../../src/services/ml');

const mlServices = require('../../src/services/ml');
const ml = require('../../src/controllers/mlController');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}
const req = (body = {}, query = {}) => ({ body, query });

// Devuelve la implementación por defecto a cada función mockeada del service.
beforeEach(() => {
  Object.keys(mlServices).forEach((k) => {
    if (typeof mlServices[k] === 'function') {
      mlServices[k].mockReturnValue({ success: true });
    }
  });
});

// ==================== Channel Prediction ====================

describe('predictChannel', () => {
  test('400 si falta originCountry o goods', async () => {
    const res = mockRes();
    await ml.predictChannel(req({ originCountry: 'CN' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito devuelve la predicción', async () => {
    mlServices.predictChannel.mockReturnValue({ predictedChannel: 'green', confidence: 0.9 });
    const res = mockRes();
    await ml.predictChannel(req({ originCountry: 'CN', goods: [{}] }), res);
    expect(res.body.predictedChannel).toBe('green');
  });

  test('500 si el service lanza', async () => {
    mlServices.predictChannel.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.predictChannel(req({ originCountry: 'CN', goods: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('batchPredictChannels', () => {
  test('400 si declarations no es array o está vacío', async () => {
    const res = mockRes();
    await ml.batchPredictChannels(req({ declarations: [] }), res);
    expect(res.statusCode).toBe(400);
    const res2 = mockRes();
    await ml.batchPredictChannels(req({}), res2);
    expect(res2.statusCode).toBe(400);
  });

  test('éxito', async () => {
    mlServices.batchPredictChannels.mockReturnValue({ results: [1, 2] });
    const res = mockRes();
    await ml.batchPredictChannels(req({ declarations: [{}, {}] }), res);
    expect(res.body.results).toHaveLength(2);
  });

  test('500 si lanza', async () => {
    mlServices.batchPredictChannels.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.batchPredictChannels(req({ declarations: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('recordChannelFeedback', () => {
  test('400 si falta predictionId o actualChannel', async () => {
    const res = mockRes();
    await ml.recordChannelFeedback(req({ predictionId: 'p1' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    const res = mockRes();
    await ml.recordChannelFeedback(req({ predictionId: 'p1', actualChannel: 'red', notes: 'n' }), res);
    expect(res.body.success).toBe(true);
    expect(mlServices.recordChannelFeedback).toHaveBeenCalledWith('p1', 'red', 'n');
  });

  test('500 si lanza', async () => {
    mlServices.recordChannelFeedback.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.recordChannelFeedback(req({ predictionId: 'p1', actualChannel: 'red' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getChannelStats', () => {
  test('éxito', async () => {
    mlServices.getChannelStats.mockReturnValue({ statistics: { total: 5 } });
    const res = mockRes();
    await ml.getChannelStats(req(), res);
    expect(res.body.statistics.total).toBe(5);
  });

  test('500 si lanza', async () => {
    mlServices.getChannelStats.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getChannelStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== Fraud Detection ====================

describe('analyzeForFraud', () => {
  test('400 si goods no es array', async () => {
    const res = mockRes();
    await ml.analyzeForFraud(req({ goods: 'x' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito (con alerts undefined no rompe el log)', async () => {
    mlServices.analyzeForFraud.mockReturnValue({ overallRiskLevel: 'low', riskScore: 10 });
    const res = mockRes();
    await ml.analyzeForFraud(req({ goods: [{}] }), res);
    expect(res.body.overallRiskLevel).toBe('low');
  });

  test('500 si lanza', async () => {
    mlServices.analyzeForFraud.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.analyzeForFraud(req({ goods: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('quickRiskAssessment', () => {
  test('éxito', async () => {
    mlServices.quickRiskAssessment.mockReturnValue({ risk: 'low' });
    const res = mockRes();
    await ml.quickRiskAssessment(req({ goods: [{}] }), res);
    expect(res.body.risk).toBe('low');
  });

  test('500 si lanza', async () => {
    mlServices.quickRiskAssessment.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.quickRiskAssessment(req({}), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getFraudStats', () => {
  test('éxito', async () => {
    mlServices.getFraudStats.mockReturnValue({ statistics: {} });
    const res = mockRes();
    await ml.getFraudStats(req(), res);
    expect(res.body.statistics).toBeDefined();
  });

  test('500 si lanza', async () => {
    mlServices.getFraudStats.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getFraudStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('recordFraudFeedback', () => {
  test('400 si falta analysisId', async () => {
    const res = mockRes();
    await ml.recordFraudFeedback(req({ wasActualFraud: true }), res);
    expect(res.statusCode).toBe(400);
  });

  test('400 si wasActualFraud es undefined', async () => {
    const res = mockRes();
    await ml.recordFraudFeedback(req({ analysisId: 'a1' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito con wasActualFraud=false (0/false no debe tratarse como ausente)', async () => {
    const res = mockRes();
    await ml.recordFraudFeedback(req({ analysisId: 'a1', wasActualFraud: false }), res);
    expect(res.body.success).toBe(true);
    expect(mlServices.recordFraudFeedback).toHaveBeenCalledWith('a1', false, undefined, undefined);
  });

  test('500 si lanza', async () => {
    mlServices.recordFraudFeedback.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.recordFraudFeedback(req({ analysisId: 'a1', wasActualFraud: true }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== Classification ====================

describe('classifyProduct', () => {
  test('400 si falta description', async () => {
    const res = mockRes();
    await ml.classifyProduct(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito (classification undefined no rompe el log)', async () => {
    mlServices.classifyProduct.mockReturnValue({ confidence: 0.8 });
    const res = mockRes();
    await ml.classifyProduct(req({ description: 'zapatos' }), res);
    expect(res.body.confidence).toBe(0.8);
  });

  test('500 si lanza', async () => {
    mlServices.classifyProduct.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.classifyProduct(req({ description: 'x' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('recordClassificationFeedback', () => {
  test('400 si falta classificationId o correctCode', async () => {
    const res = mockRes();
    await ml.recordClassificationFeedback(req({ classificationId: 'c1' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    const res = mockRes();
    await ml.recordClassificationFeedback(req({ classificationId: 'c1', correctCode: '6403990000' }), res);
    expect(res.body.success).toBe(true);
  });

  test('500 si lanza', async () => {
    mlServices.recordClassificationFeedback.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.recordClassificationFeedback(req({ classificationId: 'c1', correctCode: 'x' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getClassificationStats', () => {
  test('éxito', async () => {
    mlServices.getClassificationStats.mockReturnValue({ statistics: {} });
    const res = mockRes();
    await ml.getClassificationStats(req(), res);
    expect(res.body.statistics).toBeDefined();
  });

  test('500 si lanza', async () => {
    mlServices.getClassificationStats.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getClassificationStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getClassificationPatterns', () => {
  test('devuelve los patrones', async () => {
    const res = mockRes();
    await ml.getClassificationPatterns(req(), res);
    expect(res.body.success).toBe(true);
    expect('patterns' in res.body).toBe(true);
  });
});

// ==================== Recommendations ====================

describe('generateRecommendations', () => {
  test('400 si no hay operation ni goods', async () => {
    const res = mockRes();
    await ml.generateRecommendations(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito con operation', async () => {
    mlServices.generateRecommendations.mockReturnValue({ recommendations: [1], totalPotentialSavings: 50 });
    const res = mockRes();
    await ml.generateRecommendations(req({ operation: 'import' }), res);
    expect(res.body.recommendations).toHaveLength(1);
  });

  test('éxito con goods (recommendations undefined no rompe el log)', async () => {
    mlServices.generateRecommendations.mockReturnValue({ totalPotentialSavings: 0 });
    const res = mockRes();
    await ml.generateRecommendations(req({ goods: [{}] }), res);
    expect(res.body.totalPotentialSavings).toBe(0);
  });

  test('500 si lanza', async () => {
    mlServices.generateRecommendations.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.generateRecommendations(req({ operation: 'import' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getQuickRecommendations', () => {
  test('parsea value a float y pasa la query al service', async () => {
    mlServices.getQuickRecommendations.mockReturnValue({ recommendations: [] });
    const res = mockRes();
    await ml.getQuickRecommendations(req({}, { originCountry: 'CN', taricCode: '6403', value: '199.5', regime: '40' }), res);
    expect(mlServices.getQuickRecommendations).toHaveBeenCalledWith(
      { originCountry: 'CN', taricCode: '6403', value: 199.5, regime: '40' });
  });

  test('value undefined cuando no viene en query', async () => {
    const res = mockRes();
    await ml.getQuickRecommendations(req({}, {}), res);
    const arg = mlServices.getQuickRecommendations.mock.calls[0][0];
    expect(arg.value).toBeUndefined();
  });

  test('500 si lanza', async () => {
    mlServices.getQuickRecommendations.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getQuickRecommendations(req({}, {}), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getRecommendationStats', () => {
  test('éxito', async () => {
    mlServices.getRecommendationStats.mockReturnValue({ statistics: {} });
    const res = mockRes();
    await ml.getRecommendationStats(req(), res);
    expect(res.body.statistics).toBeDefined();
  });

  test('500 si lanza', async () => {
    mlServices.getRecommendationStats.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getRecommendationStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('recordRecommendationFeedback', () => {
  test('400 si falta recommendationId o wasUseful undefined', async () => {
    const res = mockRes();
    await ml.recordRecommendationFeedback(req({ recommendationId: 'r1' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito con wasUseful=false', async () => {
    const res = mockRes();
    await ml.recordRecommendationFeedback(
      req({ recommendationId: 'r1', wasUseful: false, wasImplemented: true, actualSavings: 10, notes: 'n' }), res);
    expect(res.body.success).toBe(true);
    expect(mlServices.recordRecommendationFeedback).toHaveBeenCalledWith('r1', false, true, 10, 'n');
  });

  test('500 si lanza', async () => {
    mlServices.recordRecommendationFeedback.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.recordRecommendationFeedback(req({ recommendationId: 'r1', wasUseful: true }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== Auto Response ====================

describe('generateAutoResponse', () => {
  test('400 si falta requirement o requirement.type', async () => {
    const res = mockRes();
    await ml.generateAutoResponse(req({ requirement: {} }), res);
    expect(res.statusCode).toBe(400);
    const res2 = mockRes();
    await ml.generateAutoResponse(req({}), res2);
    expect(res2.statusCode).toBe(400);
  });

  test('éxito', async () => {
    mlServices.generateAutoResponse.mockReturnValue({ confidence: 0.7, requiresReview: false });
    const res = mockRes();
    await ml.generateAutoResponse(req({ requirement: { type: 'C0090' }, declaration: {}, expeditionData: {} }), res);
    expect(res.body.confidence).toBe(0.7);
    expect(mlServices.generateAutoResponse).toHaveBeenCalledWith({ type: 'C0090' }, {}, {});
  });

  test('500 si lanza', async () => {
    mlServices.generateAutoResponse.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.generateAutoResponse(req({ requirement: { type: 'C0090' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getTemplatePreview', () => {
  test('400 si falta templateId', async () => {
    const res = mockRes();
    await ml.getTemplatePreview(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    mlServices.getTemplatePreview.mockReturnValue({ preview: 'texto' });
    const res = mockRes();
    await ml.getTemplatePreview(req({ templateId: 't1', context: { a: 1 } }), res);
    expect(res.body.preview).toBe('texto');
    expect(mlServices.getTemplatePreview).toHaveBeenCalledWith('t1', { a: 1 });
  });

  test('500 si lanza', async () => {
    mlServices.getTemplatePreview.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getTemplatePreview(req({ templateId: 't1' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('listResponseTemplates', () => {
  test('éxito', async () => {
    mlServices.listResponseTemplates.mockReturnValue({ templates: [] });
    const res = mockRes();
    await ml.listResponseTemplates(req(), res);
    expect(res.body.templates).toBeDefined();
  });

  test('500 si lanza', async () => {
    mlServices.listResponseTemplates.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.listResponseTemplates(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getAutoResponseStats', () => {
  test('éxito', async () => {
    mlServices.getAutoResponseStats.mockReturnValue({ statistics: {} });
    const res = mockRes();
    await ml.getAutoResponseStats(req(), res);
    expect(res.body.statistics).toBeDefined();
  });

  test('500 si lanza', async () => {
    mlServices.getAutoResponseStats.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getAutoResponseStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('recordResponseFeedback', () => {
  test('400 si falta responseId o wasAccepted undefined', async () => {
    const res = mockRes();
    await ml.recordResponseFeedback(req({ responseId: 'r1' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito con wasAccepted=false', async () => {
    const res = mockRes();
    await ml.recordResponseFeedback(
      req({ responseId: 'r1', wasAccepted: false, wasModified: true, acceptedByAEAT: false, notes: 'n' }), res);
    expect(res.body.success).toBe(true);
    expect(mlServices.recordResponseFeedback).toHaveBeenCalledWith('r1', false, true, false, 'n');
  });

  test('500 si lanza', async () => {
    mlServices.recordResponseFeedback.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.recordResponseFeedback(req({ responseId: 'r1', wasAccepted: true }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== Combined ====================

describe('getOverallStats', () => {
  test('combina las estadísticas de los 5 servicios', async () => {
    mlServices.getChannelStats.mockReturnValue({ statistics: { c: 1 } });
    mlServices.getFraudStats.mockReturnValue({ statistics: { f: 1 } });
    mlServices.getClassificationStats.mockReturnValue({ statistics: { cl: 1 } });
    mlServices.getRecommendationStats.mockReturnValue({ statistics: { r: 1 } });
    mlServices.getAutoResponseStats.mockReturnValue({ statistics: { a: 1 } });
    const res = mockRes();
    await ml.getOverallStats(req(), res);
    expect(res.body.success).toBe(true);
    expect(res.body.statistics.channelPrediction).toEqual({ c: 1 });
    expect(res.body.statistics.systemHealth.allServicesOperational).toBe(true);
  });

  test('500 si un service lanza', async () => {
    mlServices.getChannelStats.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ml.getOverallStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});
