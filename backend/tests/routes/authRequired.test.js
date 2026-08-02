/**
 * Todas las rutas de datos de cliente exigen autenticacion.
 *
 * /api/oea, /api/inspections, /api/deadlines y /api/communications respondian
 * HTTP 200 SIN TOKEN, devolviendo razon social, NIF, EORI, direcciones,
 * contactos, NIF del representante legal, MRN y expedientes. Verificado contra
 * produccion antes del arreglo.
 *
 * Este test recorre los ficheros de rutas y comprueba que montan el middleware
 * de auth, en vez de probar endpoint por endpoint: asi cubre tambien las rutas
 * que se anadan despues a esos routers.
 */

const fs = require('fs');
const path = require('path');

const RUTAS_DIR = path.join(__dirname, '../../src/routes');

/** Routers que sirven datos de cliente y por tanto nunca pueden ser publicos. */
const RUTAS_PROTEGIDAS = [
  'oea.js',
  'inspections.js',
  'deadlines.js',
  'communications.js',
  'expeditions.js',
  'declarations.js',
  'requirements.js',
  'guarantees.js'
];

describe('rutas con datos de cliente: autenticacion obligatoria', () => {
  test.each(RUTAS_PROTEGIDAS)('%s monta el middleware de auth', (fichero) => {
    const contenido = fs.readFileSync(path.join(RUTAS_DIR, fichero), 'utf8');

    // router.use(auth) a nivel de router, o auth en cada ruta individual.
    const authGlobal = /router\.use\(\s*auth\s*\)/.test(contenido);
    const authPorRuta = /router\.(get|post|put|patch|delete)\([^)]*,\s*auth\b/.test(contenido);

    expect(authGlobal || authPorRuta).toBe(true);
  });

  test.each(RUTAS_PROTEGIDAS)('%s importa auth antes de usarlo', (fichero) => {
    // Un router.use(auth) colocado antes del require rompe en runtime por TDZ,
    // y el fallo solo aparece al arrancar el servidor.
    const contenido = fs.readFileSync(path.join(RUTAS_DIR, fichero), 'utf8');
    if (!/router\.use\(\s*auth\s*\)/.test(contenido)) return; // usa auth por ruta

    const posImport = contenido.search(/const\s*\{[^}]*\bauth\b[^}]*\}\s*=\s*require/);
    const posUso = contenido.search(/router\.use\(\s*auth\s*\)/);

    expect(posImport).toBeGreaterThan(-1);
    expect(posImport).toBeLessThan(posUso);
  });

  test('los routers protegidos cargan sin error', () => {
    // Detecta el TDZ y cualquier otro fallo de carga.
    for (const f of RUTAS_PROTEGIDAS) {
      expect(() => require(path.join(RUTAS_DIR, f))).not.toThrow();
    }
  });
});
