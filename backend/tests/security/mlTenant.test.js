/**
 * Ataque (barrido C2): channelPredictionService y classificationService guardaban
 * historial y feedback en estado global. Un tenant podía dar feedback sobre la
 * predicción/clasificación de otro y el feedback de uno movía la precisión, las
 * categorías y los totales que veía el resto. Ahora el estado va por tenant.
 * Ámbito: undefined = super admin de plataforma (ve todo); null = sin tenant; string = tenant.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const canal = require('../../src/services/ml/channelPredictionService');
const clasif = require('../../src/services/ml/classificationService');

const A = 'tenant-a';
const B = 'tenant-b';
const op = { originCountry: 'DE', taricCode: '8471300000', customsValue: 50000, operatorNIF: 'ES12345678A' };
const producto = { description: 'Telefono movil smartphone celular electronico' };

describe('channelPredictionService por tenant', () => {
  test('B no puede dar feedback sobre una predicción de A', () => {
    const { prediction } = canal.predictChannel(op, A);
    const r = canal.recordFeedback(prediction.predictionId, 'red', B);
    expect(r).toEqual({ success: false, error: 'Prediction not found' });
    expect(canal.getStatistics(A).statistics.totalFeedback).toBe(0);
  });

  test('el feedback de A no altera la precisión ni la distribución que ve B', () => {
    const antes = canal.getStatistics(B).statistics;
    const { prediction } = canal.predictChannel(op, A);
    expect(canal.recordFeedback(prediction.predictionId, 'red', A).success).toBe(true);

    expect(canal.getStatistics(A).statistics.totalFeedback).toBe(1);
    const despues = canal.getStatistics(B).statistics;
    expect(despues.totalFeedback).toBe(antes.totalFeedback);
    expect(despues.totalPredictions).toBe(antes.totalPredictions);
    expect(despues.accuracy).toBe(antes.accuracy);
    expect(despues.channelDistribution).toEqual(antes.channelDistribution);
  });

  test('el feedback de A no cambia la modelAccuracy de las predicciones de B', () => {
    const base = canal.predictChannel(op, B).prediction.modelAccuracy;
    for (let i = 0; i < 3; i++) {
      const { prediction } = canal.predictChannel(op, A);
      // canal que seguro no acierta: la precisión de A cae a 0
      canal.recordFeedback(prediction.predictionId, prediction.predictedChannel === 'red' ? 'green' : 'red', A);
    }
    expect(canal.predictChannel(op, B).prediction.modelAccuracy).toBe(base);
  });

  test('super admin de plataforma (undefined) ve todo y puede dar feedback; sin tenant (null) no ve nada', () => {
    const { prediction } = canal.predictChannel(op, A);
    expect(canal.getStatistics(undefined).statistics.totalPredictions).toBeGreaterThanOrEqual(1);
    expect(canal.recordFeedback(prediction.predictionId, 'green', null).success).toBe(false);
    expect(canal.getStatistics(null).statistics.totalPredictions).toBe(0);
    expect(canal.recordFeedback(prediction.predictionId, 'green', undefined).success).toBe(true);
  });

  test('batchPredict guarda las predicciones en el tenant que pregunta', () => {
    const antes = canal.getStatistics(B).statistics.totalPredictions;
    canal.batchPredict([op, op], A);
    expect(canal.getStatistics(B).statistics.totalPredictions).toBe(antes);
  });
});

describe('classificationService por tenant', () => {
  test('B no puede dar feedback sobre una clasificación de A', () => {
    const { classificationId } = clasif.classifyProduct(producto, A);
    expect(classificationId).toBeTruthy();
    expect(clasif.recordClassificationFeedback(classificationId, '8517', '', B))
      .toEqual({ success: false, error: 'Classification not found' });
  });

  test('el feedback y las categorías de A no se ven en las stats de B', () => {
    const antes = clasif.getClassificationStats(B).statistics;
    const { classificationId } = clasif.classifyProduct(producto, A);
    expect(clasif.recordClassificationFeedback(classificationId, '0000', '', A).success).toBe(true);

    const deA = clasif.getClassificationStats(A).statistics;
    expect(deA.totalFeedback).toBe(1);
    expect(Object.keys(deA.categoryDistribution).length).toBeGreaterThan(0);

    const despues = clasif.getClassificationStats(B).statistics;
    expect(despues.totalClassifications).toBe(antes.totalClassifications);
    expect(despues.totalFeedback).toBe(antes.totalFeedback);
    expect(despues.accuracy).toBe(antes.accuracy);
    expect(despues.modelConfidence).toBe(antes.modelConfidence);
    expect(despues.categoryDistribution).toEqual(antes.categoryDistribution);
  });

  test('el feedback incorrecto de A no baja la confianza de las clasificaciones de B', () => {
    const base = clasif.classifyProduct(producto, B).classification && clasif.getClassificationStats(B).statistics.modelConfidence;
    for (let i = 0; i < 3; i++) {
      const { classificationId } = clasif.classifyProduct(producto, A);
      clasif.recordClassificationFeedback(classificationId, '0000', '', A);
    }
    expect(clasif.getClassificationStats(B).statistics.modelConfidence).toBe(base);
  });

  test('plataforma (undefined) ve todo; sin tenant (null) no ve nada', () => {
    const { classificationId } = clasif.classifyProduct(producto, A);
    expect(clasif.getClassificationStats(undefined).statistics.totalClassifications).toBeGreaterThanOrEqual(1);
    expect(clasif.getClassificationStats(null).statistics.totalClassifications).toBe(0);
    expect(clasif.recordClassificationFeedback(classificationId, '8517', '', null).success).toBe(false);
    expect(clasif.recordClassificationFeedback(classificationId, '8517', '', undefined).success).toBe(true);
  });
});
