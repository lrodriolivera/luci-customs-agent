/**
 * Emitir una API key exige rol admin, en los dos routers que las emiten.
 *
 * POST /api/v1/keys (publicApi.js) documentaba en su propia cabecera
 *
 *     @access JWT Authenticated (admin)
 *
 * pero el codigo solo aplicaba jwtAuth. La restriccion estaba escrita, no
 * implementada. Cualquier usuario -- incluido un `viewer` -- podia emitirse una
 * credencial de acceso programatico con permisos de escritura por defecto
 * (classification:write entre ellos), 60 req/min y 5000 req/dia, y ademas
 * elegir sus propios `permissions` en el body.
 *
 * Una API key no caduca con la sesion: sobrevive al cambio de contrasena y a la
 * baja del empleado. Emitirla es un acto administrativo, no de usuario.
 *
 * El otro router que las emite, portal.js, SI exigia requireRole('admin') desde
 * el principio. Este test fija la coherencia entre ambos: son el mismo recurso
 * (modelo ClientApiKey) y no pueden tener puertas de distinta altura.
 *
 * Las lecturas y la revocacion se dejan sin rol: ya se acotan por
 * organizationId, y revocar una credencial comprometida es algo que conviene
 * poder hacer deprisa.
 */

const fs = require('fs');
const path = require('path');

const RUTAS_DIR = path.join(__dirname, '../../src/routes');
const PUBLIC_API = fs.readFileSync(path.join(RUTAS_DIR, 'publicApi.js'), 'utf8');
const PORTAL = fs.readFileSync(path.join(RUTAS_DIR, 'portal.js'), 'utf8');

/** La linea que declara esa ruta con ese verbo, o cadena vacia. */
function lineaDeRuta(contenido, metodo, ruta) {
  return contenido.split('\n').find(l =>
    new RegExp(`router\\.${metodo}\\(\\s*['"]${ruta}['"]`).test(l)) || '';
}

describe('emitir una API key exige admin', () => {
  test('publicApi.js: POST /keys', () => {
    const linea = lineaDeRuta(PUBLIC_API, 'post', '/keys');

    expect(linea).not.toBe('');
    expect(linea).toMatch(/requireRole\(\s*['"]admin['"]/);
  });

  test('portal.js: POST /api-keys', () => {
    // Ya lo exigia; el test lo fija para que los dos routers no diverjan.
    expect(lineaDeRuta(PORTAL, 'post', '/api-keys')).toMatch(/requireRole\(\s*['"]admin['"]/);
  });

  test('los dos routers que emiten API keys coinciden en el rol', () => {
    const rol = (linea) => (linea.match(/requireRole\(([^)]*)\)/) || [, ''])[1].replace(/\s/g, '');

    expect(rol(lineaDeRuta(PUBLIC_API, 'post', '/keys')))
      .toBe(rol(lineaDeRuta(PORTAL, 'post', '/api-keys')));
  });
});

describe('lo que NO se endurece', () => {
  test('listar las API keys no exige rol', () => {
    // Ya se acota por organizationId; ver quien tiene acceso no es emitirlo.
    expect(lineaDeRuta(PUBLIC_API, 'get', '/keys')).not.toMatch(/requireRole/);
  });

  test('revocar una API key no exige rol', () => {
    // Cortar el acceso de una credencial comprometida conviene poder hacerlo
    // deprisa, y ya se acota por organizationId.
    expect(lineaDeRuta(PUBLIC_API, 'delete', '/keys/:keyId')).not.toMatch(/requireRole/);
  });
});

describe('coherencia del router', () => {
  test('requireRole se importa de middleware/auth antes de usarse', () => {
    // Ojo: publicApi.js ya importa requirePermission de middleware/apiKeyAuth,
    // que es OTRO middleware. requireRole tiene que venir de middleware/auth.
    const posImport = PUBLIC_API.search(/const\s*\{[^}]*requireRole[^}]*\}\s*=\s*require\(['"]\.\.\/middleware\/auth/);
    const posUso = PUBLIC_API.search(/requireRole\(\s*['"]admin['"]/);

    expect(posImport).toBeGreaterThan(-1);
    expect(posImport).toBeLessThan(posUso);
  });
});
