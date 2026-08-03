/**
 * El modulo de analytics devuelve datos SIMULADOS, no agregados de la BD.
 *
 * Detectado el 3/Ago/2026 al cubrirlo con tests. Los cuatro servicios de
 * analytics usan Math.random() (11 usos en total) y la UI los consume desde
 * frontend/src/services/api.js presentandolos como analitica real: en
 * produccion el dashboard decia 153-255 declaraciones cuando en la BD hay 35,
 * y la cifra cambiaba en cada llamada.
 *
 * Estos tests NO validan que las metricas sean correctas —no pueden serlo
 * mientras se generen al azar—. Fijan que:
 *   1. la respuesta se declara simulada, para que el consumidor lo sepa
 *   2. el dia que se implementen las agregaciones reales, el test falle y
 *      obligue a quitar el flag conscientemente
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
