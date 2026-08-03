/**
 * analyticsService SIGUE siendo simulado, pero YA NO LO SIRVE NINGUN ENDPOINT.
 *
 * Los cuatro servicios de src/services/analytics/ generan sus metricas con
 * Math.random() (171 usos de _generateMetricValue solo en analyticsService). En
 * produccion el dashboard decia 153-255 declaraciones cuando en la BD hay 35, y
 * la cifra cambiaba en cada llamada.
 *
 * Desde el commit que introdujo realMetricsService, el controlador no llama a este servicio para las metricas:
 *
 *   GET /api/analytics/dashboard  -> realMetricsService, agregaciones reales
 *   GET /api/analytics/financial  -> 501 mientras no haya pagos registrados
 *   POST /predictions/volume      -> 501, era ruido con nivel de confianza
 *
 * Este fichero se conserva a proposito: analyticsService sigue en el arbol y
 * otras partes podrian volver a llamarlo. Los tests fijan que, si eso pasa, lo
 * que se obtiene son datos simulados y estan declarados como tales.
 *
 * Las metricas reales se prueban en tests/services/realMetrics.test.js y
 * tests/controllers/analyticsNotSimulated.test.js.
 */

jest.mock('../../src/services/aiService', () => ({}));

const analyticsService = require('../../src/services/analytics/analyticsService');

describe('analytics: los datos son simulados y se declaran como tales', () => {
  test('getDashboardMetrics marca la respuesta como simulada', async () => {
    const r = await analyticsService.getDashboardMetrics('last_30_days', {});

    expect(r.success).toBe(true);
    expect(r.data.simulated).toBe(true);
  });

  test('dos llamadas seguidas devuelven cifras distintas', async () => {
    // La prueba de que no salen de la BD: los mismos parametros dan otro
    // resultado. Si algun dia coinciden porque se agregan de verdad, este test
    // fallara y habra que revisar el flag simulated.
    const a = await analyticsService.getDashboardMetrics('last_30_days', {});
    const b = await analyticsService.getDashboardMetrics('last_30_days', {});

    const cifrasA = JSON.stringify(a.data.operations);
    const cifrasB = JSON.stringify(b.data.operations);

    expect(cifrasA).not.toBe(cifrasB);
  });

  test('el rango de fechas SI es real y coherente', async () => {
    // Lo unico no simulado de la respuesta.
    const r = await analyticsService.getDashboardMetrics('last_30_days', {});
    const { start, end } = r.data.period;

    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
    expect(new Date(end).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test('respeta el rango de fechas explicito', async () => {
    const r = await analyticsService.getDashboardMetrics('custom', {
      startDate: '2026-01-01',
      endDate: '2026-01-31'
    });

    expect(new Date(r.data.period.start).getUTCMonth()).toBe(0);
    expect(new Date(r.data.period.end).getUTCMonth()).toBe(0);
  });
});

describe('el endpoint del dashboard ya NO usa este servicio', () => {
  const fs = require('fs');
  const path = require('path');

  const CONTROLADOR = fs.readFileSync(
    path.join(__dirname, '../../src/controllers/analyticsController.js'), 'utf8'
  );

  test('getDashboardMetrics llama a realMetrics, no a analyticsService', () => {
    const cuerpo = CONTROLADOR.slice(
      CONTROLADOR.indexOf('async function getDashboardMetrics'),
      CONTROLADOR.indexOf('function noImplementado')
    );

    expect(cuerpo).toMatch(/realMetrics\.cuadroDeMando/);
    expect(cuerpo).not.toMatch(/analyticsService\.getDashboardMetrics/);
  });

  test('getFinancialAnalytics tampoco', () => {
    const cuerpo = CONTROLADOR.slice(
      CONTROLADOR.indexOf('async function getFinancialAnalytics'),
      CONTROLADOR.indexOf('async function getComplianceAnalytics')
    );

    expect(cuerpo).not.toMatch(/analyticsService\.getFinancialAnalytics/);
  });
});
