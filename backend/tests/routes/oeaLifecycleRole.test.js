/**
 * El ciclo de vida de una certificacion OEA exige rol, no solo autenticacion.
 *
 * POST /api/oea/:id/approve, /suspend y /revoke solo pasaban por `auth`. El
 * controller lee `req.user?.id` para el registro, pero no comprueba el rol, y
 * el service tampoco: _loadOwnedOEA solo verifica PROPIEDAD.
 *
 * Esa combinacion es justamente el problema: un usuario podia aprobar SU PROPIA
 * certificacion OEA. Y aprobar no es un cambio de estado cosmetico, oeaService
 * .approve:
 *   - genera el numero oficial de certificacion
 *   - fija 5 anos de vigencia
 *   - activa TODOS los beneficios (benefits.active = true)
 *   - fija guaranteeReduction, que segun el tipo llega al 100%
 *
 * Es decir, un `viewer` o un `agent` podia auto-otorgarse la reduccion de la
 * garantia aduanera que tiene que constituir ante Aduanas. En el mundo real la
 * certificacion OEA la concede la AEAT tras una auditoria, nunca el propio
 * operador.
 *
 * El fix exige admin o supervisor. No se toca la comprobacion de propiedad ni
 * la logica de negocio de approve: solo quien puede invocarla.
 */

const fs = require('fs');
const path = require('path');

const OEA = fs.readFileSync(path.join(__dirname, '../../src/routes/oea.js'), 'utf8');

/** La linea que declara esa ruta, o cadena vacia. */
function lineaDeRuta(ruta) {
  return OEA.split('\n').find(l => l.includes(`'${ruta}'`)) || '';
}

/** Acciones que conceden o retiran la certificacion. */
const CICLO_DE_VIDA = ['/:id/approve', '/:id/suspend', '/:id/revoke'];

describe('oea.js: el ciclo de vida de la certificacion exige rol', () => {
  test.each(CICLO_DE_VIDA)('%s exige admin o supervisor', (ruta) => {
    const linea = lineaDeRuta(ruta);

    expect(linea).not.toBe('');
    expect(linea).toMatch(/requireRole\(/);
    expect(linea).toMatch(/['"]admin['"]/);
  });

  test.each(CICLO_DE_VIDA)('%s no admite agent ni viewer', (ruta) => {
    // Un agente tramita expedientes; conceder la certificacion no es tramitar.
    const linea = lineaDeRuta(ruta);
    const roles = linea.match(/requireRole\(([^)]*)\)/);

    expect(roles).not.toBeNull();
    expect(roles[1]).not.toMatch(/['"]agent['"]/);
    expect(roles[1]).not.toMatch(/['"]viewer['"]/);
  });

  test('el router sigue exigiendo autenticacion para todo', () => {
    // El rol se suma a auth, no lo sustituye.
    expect(OEA).toMatch(/router\.use\(\s*auth\s*\)/);
  });

  test('las rutas de consulta NO exigen rol', () => {
    // Endurecer de mas romperia a los agentes, que si consultan certificaciones.
    const lista = OEA.split('\n').find(l => /router\.get\(\s*['"]\/['"]/.test(l));

    expect(lista).toBeDefined();
    expect(lista).not.toMatch(/requireRole/);
  });

  test('submit sigue sin exigir rol: presentar no es aprobar', () => {
    // El operador presenta su solicitud a revision; eso si le corresponde.
    expect(lineaDeRuta('/:id/submit')).not.toMatch(/requireRole/);
  });

  test('el router carga sin error', () => {
    expect(() => require('../../src/routes/oea')).not.toThrow();
  });
});
