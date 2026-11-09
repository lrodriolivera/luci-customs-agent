/**
 * analyticsService ya no tiene simulador.
 *
 * Hasta la PR K, analyticsService generaba sus metricas con Math.random()
 * (_generateMetricValue, 160 cifras aleatorias): el panel decia 153-255
 * declaraciones cuando en la BD habia 35, y la cifra cambiaba en cada llamada.
 * El simulador y todas las funciones que lo usaban se han borrado; los endpoints
 * sin fuente real responden 501 (noImplementado) y los demas leen realMetrics.
 *
 * Las metricas reales se prueban en tests/services/realMetrics.test.js,
 * tests/services/analytics/cuadroParaPanel.test.js y
 * tests/controllers/analyticsNotSimulated.test.js.
 */

jest.mock('../../src/services/aiService', () => ({}));

const fs = require('fs');
const path = require('path');

const analyticsService = require('../../src/services/analytics/analyticsService');
const FUENTE = fs.readFileSync(
  path.join(__dirname, '../../src/services/analytics/analyticsService.js'), 'utf8'
);

describe('analyticsService sin simulador', () => {
  test.each([
    'getDashboardMetrics', 'getDeclarationAnalytics', 'getFinancialAnalytics',
    'getComplianceAnalytics', 'getPerformanceAnalytics', 'getComparisonReport', 'queryAnalytics'
  ])('ya no exporta %s', (nombre) => {
    expect(analyticsService[nombre]).toBeUndefined();
  });

  test('conserva lo que no es simulado: constantes, recordEvent, getRealTimeMetrics y getDateRange', () => {
    expect(analyticsService.TIME_PERIODS.LAST_30_DAYS).toBe('last_30_days');
    expect(typeof analyticsService.recordEvent).toBe('function');
    expect(typeof analyticsService.getRealTimeMetrics).toBe('function');
    expect(typeof analyticsService.getDateRange).toBe('function');
  });

  test('el rango de fechas es real y coherente', () => {
    const { start, end } = analyticsService.getDateRange('last_30_days');
    expect(start.getTime()).toBeLessThan(end.getTime());
    expect(end.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test('respeta el rango explicito del periodo custom', () => {
    const { start, end } = analyticsService.getDateRange('custom', '2026-01-01', '2026-01-31');
    expect(start.getUTCMonth()).toBe(0);
    expect(end.getUTCMonth()).toBe(0);
  });

  test('el fichero no contiene _generateMetricValue y su Math.random solo construye identificadores', () => {
    expect(FUENTE).not.toMatch(/_generateMetricValue/);
    const lineas = FUENTE.split('\n').filter((l) => /Math\.random/.test(l));
    expect(lineas.every((l) => /toString\(36\)/.test(l))).toBe(true);
  });

  test('el controlador no llama a funciones borradas de analyticsService', () => {
    const controlador = fs.readFileSync(
      path.join(__dirname, '../../src/controllers/analyticsController.js'), 'utf8'
    );
    expect(controlador).not.toMatch(
      /analyticsService\.(getDashboardMetrics|getDeclarationAnalytics|getFinancialAnalytics|getComplianceAnalytics|getPerformanceAnalytics|getComparisonReport|queryAnalytics)/
    );
  });
});
