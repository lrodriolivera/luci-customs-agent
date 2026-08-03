/**
 * Subir o borrar el certificado de firma exige rol de administrador.
 *
 * /api/certificates gestiona el .p12/.pfx con el que el tenant FIRMA sus
 * declaraciones ante la AEAT. El router monta `auth`, pero ni POST /upload ni
 * DELETE /:country comprobaban el rol, de modo que cualquier usuario del
 * tenant -- incluido un `viewer`, cuyo nombre ya dice que solo deberia leer --
 * podia:
 *
 *   - DELETE /:country  borrar el certificado y ademas hacer $unset de
 *                       customsConfig.certificatePath y certificatePassword
 *                       en el Tenant. Sin certificado no se puede presentar
 *                       ninguna declaracion: es una denegacion de servicio
 *                       sobre la operativa aduanera del cliente.
 *
 *   - POST /upload      sustituir el certificado de firma por otro. Mas grave
 *                       que borrarlo: las declaraciones se seguirian firmando,
 *                       pero con un certificado que el operador no eligio.
 *
 * El fix exige admin. Las lecturas se dejan abiertas a cualquier usuario
 * autenticado: un agente necesita ver si el certificado esta vigente antes de
 * presentar, y saberlo no permite alterarlo.
 */

const fs = require('fs');
const path = require('path');

const CERTS = fs.readFileSync(path.join(__dirname, '../../src/routes/certificates.js'), 'utf8');

/** La linea que declara esa ruta con ese verbo, o cadena vacia. */
function lineaDeRuta(metodo, ruta) {
  return CERTS.split('\n').find(l => new RegExp(`router\\.${metodo}\\(\\s*['"]${ruta}['"]`).test(l)) || '';
}

describe('certificates.js: alterar el certificado de firma exige admin', () => {
  test('POST /upload exige rol admin', () => {
    const linea = lineaDeRuta('post', '/upload');

    expect(linea).not.toBe('');
    expect(linea).toMatch(/requireRole\(\s*['"]admin['"]/);
  });

  test('DELETE /:country exige rol admin', () => {
    const linea = lineaDeRuta('delete', '/:country');

    expect(linea).not.toBe('');
    expect(linea).toMatch(/requireRole\(\s*['"]admin['"]/);
  });

  test('el router sigue exigiendo autenticacion para todo', () => {
    // El rol se suma a auth, no lo sustituye.
    expect(CERTS).toMatch(/router\.use\(\s*auth\s*\)/);
  });

  test('las lecturas NO exigen rol', () => {
    // Un agente necesita comprobar la vigencia del certificado antes de
    // presentar una declaracion; consultarlo no permite alterarlo.
    expect(lineaDeRuta('get', '/')).not.toMatch(/requireRole/);
    expect(lineaDeRuta('get', '/:country/status')).not.toMatch(/requireRole/);
  });

  test('requireRole se importa antes de usarse', () => {
    // Usarlo sin importarlo revienta al arrancar, no en los tests de ruta.
    const posImport = CERTS.search(/const\s*\{[^}]*requireRole[^}]*\}\s*=\s*require/);
    const posUso = CERTS.search(/requireRole\(/);

    expect(posImport).toBeGreaterThan(-1);
    expect(posImport).toBeLessThan(posUso);
  });

  test('el router carga sin error', () => {
    expect(() => require('../../src/routes/certificates')).not.toThrow();
  });
});
