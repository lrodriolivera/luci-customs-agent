/**
 * El texto de las alertas separa cifra y unidad con un espacio ("0 declaraciones",
 * no "0declaraciones"), formatea EUR como "50.000 EUR" y deja el % pegado a la cifra.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/aiService', () => ({ analyzeWithLuci: jest.fn(), analyzeKPIDeviations: jest.fn() }));

const kpiService = require('../../../src/services/analytics/kpiService');

const T = 'tenant-mensajes';
const mensaje = async (kpiId, data) => {
  await kpiService.calculateKPI(kpiId, data, T);
  return kpiService.getActiveAlerts({ kpiId }, T).alerts[0].message;
};

beforeEach(() => {
  for (const a of kpiService.getActiveAlerts({}, undefined).alerts) kpiService.dismissAlert(a.id, undefined);
});

describe('mensajes de alerta: cifra y unidad', () => {
  test('crítico higher_is_better con unidad en palabras: espacio entre cifra y unidad', async () => {
    expect(await mensaje('declarations_per_day', { totalDeclarations: 0, days: 30 }))
      .toBe('Declaraciones por día crítico: 0 declaraciones (mínimo requerido: 3 declaraciones)');
  });

  test('crítico en EUR: separador de miles y espacio ("50.000 EUR")', async () => {
    expect(await mensaje('total_duties_collected', { totalDuties: 20000 }))
      .toBe('Derechos liquidados crítico: 20.000 EUR (mínimo requerido: 50.000 EUR)');
  });

  test('aviso en EUR por debajo del objetivo: "100.000 EUR" y "200.000 EUR"', async () => {
    expect(await mensaje('total_duties_collected', { totalDuties: 70000 }))
      .toBe('Derechos liquidados por debajo del objetivo: 70.000 EUR (objetivo: 200.000 EUR)');
  });

  test('crítico lower_is_better en horas: espacio', async () => {
    expect(await mensaje('average_processing_time', { avgProcessingTime: 30 }))
      .toBe('Tiempo medio de procesamiento crítico: 30 horas (máximo recomendado: 24 horas)');
  });

  test('aviso lower_is_better en horas', async () => {
    expect(await mensaje('average_processing_time', { avgProcessingTime: 10 }))
      .toBe('Tiempo medio de procesamiento en alerta: 10 horas (objetivo: 4 horas)');
  });

  test('el % va pegado a la cifra', async () => {
    expect(await mensaje('error_rate', { errorRate: 9 }))
      .toBe('Tasa de errores crítico: 9% (máximo recomendado: 5%)');
  });

  test('los decimales usan coma (es-ES)', async () => {
    expect(await mensaje('error_rate', { errorRate: 3.5 }))
      .toBe('Tasa de errores en alerta: 3,5% (objetivo: 1%)');
  });

  test('KPI neutral en alerta: cita el máximo superado, no un objetivo inexistente', async () => {
    expect(await mensaje('active_expeditions', { activeExpeditions: 70 }))
      .toBe('Expedientes activos en alerta: 70 expedientes (máximo recomendado: 50 expedientes)');
  });

  test('unidad "expedientes": espacio y, siendo neutral, cita el máximo y no el mínimo (null)', async () => {
    expect(await mensaje('active_expeditions', { activeExpeditions: 120 }))
      .toBe('Expedientes activos crítico: 120 expedientes (máximo recomendado: 100 expedientes)');
  });
});
