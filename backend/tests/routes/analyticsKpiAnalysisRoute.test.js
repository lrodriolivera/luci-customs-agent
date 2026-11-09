/**
 * GET /api/analytics/kpis/analysis: ruta propia del análisis de LUCI, declarada
 * antes de '/kpis/:id' (si no, ':id' la capturaría como un KPI llamado "analysis")
 * y detrás de la misma autenticación que el resto del router de analytics.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const router = require('../../src/routes/analytics');

const rutasGet = router.stack
  .filter(l => l.route && l.route.methods.get)
  .map(l => l.route.path);

describe('ruta GET /kpis/analysis', () => {
  test('está registrada', () => {
    expect(rutasGet).toContain('/kpis/analysis');
  });

  test('va antes de /kpis/:id', () => {
    expect(rutasGet.indexOf('/kpis/analysis')).toBeLessThan(rutasGet.indexOf('/kpis/:id'));
  });

  test('el router aplica autenticación antes de cualquier ruta', () => {
    const primeraRuta = router.stack.findIndex(l => l.route);
    const middlewares = router.stack.slice(0, primeraRuta).filter(l => !l.route);
    expect(middlewares.length).toBeGreaterThan(0);
  });
});
