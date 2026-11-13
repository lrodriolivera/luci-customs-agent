/**
 * Arreglo 4 de la revision de seguridad del 4.2 (invitar usuarios).
 *
 * /api/internal/metrics y /api/email/test (definidas directamente en
 * app.js, no en un router) verificaban el JWT a mano (jwtService.verify +
 * decoded.role === 'admin') en vez de pasar por el middleware auth +
 * requireRole('admin'). Eso las dejaba fuera de las comprobaciones que ese
 * middleware SI hace: usuario inactivo (isActive) y, desde los arreglos
 * anteriores de esta misma revision, mustChangePassword (MUST_CHANGE_PASSWORD)
 * y passwordChangedAt (un token viejo que ya no deberia valer).
 *
 * app.js no se puede requerir en un test: connectDB() se llama al cargar el
 * modulo y hace process.exit(1) si Mongo no responde (confirmado leyendo
 * src/config/database.js). Por eso, igual que tests/security/adminIsTenantRole.test.js
 * y tests/routes/authRequired.test.js, se verifica por texto fuente que la
 * ruta esta protegida, en vez de montar la app entera.
 */

const fs = require('fs');
const path = require('path');

const APP_JS = fs.readFileSync(path.join(__dirname, '../../src/app.js'), 'utf8');

/** Devuelve el bloque de texto desde que empieza la ruta hasta 400 caracteres
 * despues (donde deberia estar el middleware y el inicio del handler). */
function bloqueDeRuta(metodo, ruta) {
  const regex = new RegExp(`app\\.${metodo}\\(\\s*['"]${ruta.replace(/\//g, '\\/')}['"]`);
  const m = regex.exec(APP_JS);
  if (!m) throw new Error(`No se encontro la ruta ${metodo.toUpperCase()} ${ruta} en app.js`);
  return APP_JS.slice(m.index, m.index + 400);
}

describe('rutas internas definidas en app.js pasan por auth + requireRole(admin)', () => {
  test('GET /api/internal/metrics', () => {
    const bloque = bloqueDeRuta('get', '/api/internal/metrics');
    expect(bloque).toMatch(/\bauth\b/);
    expect(bloque).toMatch(/requireRole\(\s*['"]admin['"]\s*\)/);
  });

  test('POST /api/email/test', () => {
    const bloque = bloqueDeRuta('post', '/api/email/test');
    expect(bloque).toMatch(/\bauth\b/);
    expect(bloque).toMatch(/requireRole\(\s*['"]admin['"]\s*\)/);
  });

  test('app.js importa auth y requireRole antes de usarlos en estas rutas', () => {
    const posImport = APP_JS.search(/const\s*\{[^}]*\bauth\b[^}]*\brequireRole\b[^}]*\}\s*=\s*require\(['"]\.\/middleware\/auth['"]\)|const\s*\{[^}]*\brequireRole\b[^}]*\bauth\b[^}]*\}\s*=\s*require\(['"]\.\/middleware\/auth['"]\)/);
    const posMetrics = APP_JS.indexOf("app.get('/api/internal/metrics'");
    expect(posImport).toBeGreaterThan(-1);
    expect(posImport).toBeLessThan(posMetrics);
  });
});
