/**
 * Las operaciones de sistema, que actuan sobre TODOS los tenants, exigen admin.
 *
 * deadlines.js expone dos rutas que no reciben ningun identificador y por tanto
 * no se acotan a nadie:
 *
 *   POST /api/deadlines/process-alerts
 *     deadlineService.processAlerts() recorre Deadline.findDueForAlerts() -- los
 *     plazos vencidos de TODOS los clientes -- y por cada uno hace addAlert() y
 *     save(). No filtra datos hacia fuera, pero un usuario cualquiera podia
 *     provocar escrituras masivas en la base de datos de todos los tenants.
 *
 *   POST /api/deadlines/sync
 *     deadlineService.syncAll(), hoy un stub, previsto para reconstruir los
 *     plazos desde requirements, guarantees, OEAs, regimenes y transitos.
 *
 * El propio comentario del service dice "en produccion se ejecutaria como job
 * programado": son operaciones de mantenimiento, no de usuario. Es el mismo
 * patron que POST /api/classification/seed, cerrado en 94f8bbc.
 *
 * El resto del router se deja como esta: consultar, crear o completar un plazo
 * es trabajo normal de un agente.
 */

const fs = require('fs');
const path = require('path');

const RUTAS_DIR = path.join(__dirname, '../../src/routes');
const DEADLINES = fs.readFileSync(path.join(RUTAS_DIR, 'deadlines.js'), 'utf8');

/** La linea que declara esa ruta con ese verbo, o cadena vacia. */
function lineaDeRuta(contenido, metodo, ruta) {
  return contenido.split('\n').find(l =>
    new RegExp(`router\\.${metodo}\\(\\s*['"]${ruta}['"]`).test(l)) || '';
}

describe('deadlines.js: los jobs globales exigen admin', () => {
  test.each(['/process-alerts', '/sync'])('POST %s exige rol admin', (ruta) => {
    const linea = lineaDeRuta(DEADLINES, 'post', ruta);

    expect(linea).not.toBe('');
    expect(linea).toMatch(/requireRole\(\s*['"]admin['"]/);
  });

  test('el trabajo ordinario con plazos NO exige rol', () => {
    // Endurecer de mas dejaria a los agentes sin poder tramitar.
    expect(lineaDeRuta(DEADLINES, 'get', '/')).not.toMatch(/requireRole/);
    expect(lineaDeRuta(DEADLINES, 'post', '/')).not.toMatch(/requireRole/);
    expect(lineaDeRuta(DEADLINES, 'post', '/:id/complete')).not.toMatch(/requireRole/);
  });

  test('el router sigue exigiendo autenticacion para todo', () => {
    expect(DEADLINES).toMatch(/router\.use\(\s*auth\s*\)/);
  });

  test('requireRole se importa antes de usarse', () => {
    const posImport = DEADLINES.search(/const\s*\{[^}]*requireRole[^}]*\}\s*=\s*require/);
    const posUso = DEADLINES.search(/requireRole\(/);

    expect(posImport).toBeGreaterThan(-1);
    expect(posImport).toBeLessThan(posUso);
  });

  test('el router carga sin error', () => {
    expect(() => require(path.join(RUTAS_DIR, 'deadlines.js'))).not.toThrow();
  });
});

describe('ninguna otra ruta dispara un job global sin rol', () => {
  // Generaliza el hallazgo: cualquier POST cuyo nombre denote mantenimiento
  // sobre todo el sistema. Cubre los routers que se anadan despues.
  const JOBS = /^\/(sync|seed|process-alerts|migrate|reindex|recalculate|refresh-cache|purge)/;

  test.each(fs.readdirSync(RUTAS_DIR).filter(f => f.endsWith('.js')))('%s', (fichero) => {
    const contenido = fs.readFileSync(path.join(RUTAS_DIR, fichero), 'utf8');
    const sinRol = [];

    contenido.split('\n').forEach((linea, i) => {
      const m = linea.match(/router\.post\(\s*['"](\/[^'"]*)['"]/);
      if (!m || !JOBS.test(m[1])) return;
      if (/requireRole|superAdminOnly|adminOnly|requirePermission/.test(linea)) return;
      sinRol.push(`L${i + 1} POST ${m[1]}`);
    });

    expect(sinRol).toEqual([]);
  });
});
