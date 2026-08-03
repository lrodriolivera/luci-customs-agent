/**
 * requireRole('admin') es un rol de TENANT, no de plataforma.
 *
 * Es la confusion mas facil de cometer al leer este codigo: `admin` suena a
 * "administrador del sistema", pero un admin de LUCI administra SU
 * organizacion. El rol de plataforma es super_admin, y vive aparte
 * (src/constants/roles.js).
 *
 * La consecuencia practica: poner requireRole('admin') en una ruta NO la acota
 * a nada. Solo dice "quien llame ha de ser admin de algun tenant". Si la ruta
 * opera sobre todos los tenants, sigue haciendolo -- ahora con la falsa
 * sensacion de estar protegida.
 *
 * Este test recorre las rutas con requireRole('admin') y comprueba que las que
 * actuan sobre todo el sistema estan declaradas a proposito, no por descuido.
 */

const fs = require('fs');
const path = require('path');

const RUTAS_DIR = path.join(__dirname, '../../src/routes');
const { ROLES, DE_TENANT } = require('../../src/constants/roles');

/**
 * Rutas de alcance global, revisadas una a una el 3/Ago/2026.
 *
 * Estan aqui porque son operaciones de mantenimiento que afectan a todos los
 * tenants y NO exponen datos de unos a otros. Un admin puede dispararlas, pero
 * conviene tenerlas listadas: el dia que haya varios clientes de verdad,
 * conviene moverlas a super_admin o a un job programado.
 */
const GLOBALES_ACEPTADAS = {
  'deadlines.js POST /process-alerts':
    'Recorre los plazos vencidos de todos los tenants haciendo addAlert() y save(). ' +
    'No expone datos: escribe alertas en documentos que el llamante no llega a ver.',
  'deadlines.js POST /sync':
    'Reconstruiria los plazos desde requirements, guarantees y regimenes. Hoy es un stub.',
  'classification.js DELETE /cache/clean':
    'Borra entradas caducadas de la cache de clasificaciones IA. La cache no tiene ' +
    'tenantId en su esquema: cachea el catalogo TARIC, que es comun a todos los ' +
    'clientes. Borrarla solo obliga a recalcular, no destruye informacion de negocio.',
  'classification.js POST /seed':
    'Recarga el catalogo TARIC oficial de la UE, comun a todos los tenants.'
};

/** Rutas con requireRole('admin') que no reciben identificador de recurso. */
function rutasAdminSinRecurso() {
  const encontradas = [];

  for (const fichero of fs.readdirSync(RUTAS_DIR).filter(f => f.endsWith('.js'))) {
    const lineas = fs.readFileSync(path.join(RUTAS_DIR, fichero), 'utf8').split('\n');

    lineas.forEach((linea) => {
      if (!/requireRole\(\s*['"]admin['"]/.test(linea)) return;

      const m = linea.match(/router\.(get|post|put|patch|delete)\(\s*['"]([^'"]*)['"]/);
      if (!m) return;                       // router.use(requireRole(...))

      const [, metodo, ruta] = m;
      if (ruta.includes(':')) return;       // acotada a un recurso concreto

      encontradas.push(`${fichero} ${metodo.toUpperCase()} ${ruta}`);
    });
  }

  return encontradas;
}

describe('admin es rol de tenant, no de plataforma', () => {
  test('ADMIN esta en los roles de tenant y SUPER_ADMIN no', () => {
    expect(DE_TENANT).toContain(ROLES.ADMIN);
    expect(DE_TENANT).not.toContain(ROLES.SUPER_ADMIN);
  });

  test('la distincion esta documentada en constants/roles.js', () => {
    // Si alguien borra el comentario, el proximo lector vuelve a confundirse.
    const fuente = fs.readFileSync(
      path.join(__dirname, '../../src/constants/roles.js'), 'utf8'
    );

    expect(fuente).toMatch(/PLATAFORMA/);
    expect(fuente).toMatch(/TENANT/);
  });
});

describe('rutas admin de alcance global', () => {
  test('todas las que hay estan revisadas y justificadas', () => {
    // Si aparece una nueva ruta admin sin identificador de recurso, este test
    // falla y obliga a decidir: o se acota por tenant, o se justifica aqui, o
    // pasa a exigir super_admin.
    const sinJustificar = rutasAdminSinRecurso().filter(r => {
      // Las que acotan por req.user.tenantId u organizationId dentro del
      // handler no son globales aunque no lleven :id en la ruta.
      const acotadas = [
        'audit.js GET /',                    // auditService.query({ tenantId })
        'auth.js GET /users',                // query.tenantId = req.user.tenantId
        'auth.js POST /admin/invite',        // crea dentro del tenant del invitante
        'payments.js GET /',                 // organizationId: req.user.organizationId
        'payments.js GET /stats',
        'payments.js POST /manual',
        'portal.js POST /api-keys',          // organizationId del emisor
        'portal.js GET /api-keys',
        'publicApi.js POST /keys',
        'certificates.js POST /upload',      // certificateManager por tenantId
        'requirements.js POST /',            // filter.tenantId = req.user.tenantId
        'workflows.js POST /'                // organizationId: req.user.organizationId
      ];
      return !acotadas.includes(r) && !(r in GLOBALES_ACEPTADAS);
    });

    expect(sinJustificar).toEqual([]);
  });

  test('cada justificacion explica por que no expone datos ajenos', () => {
    // Una excepcion sin motivo escrito es una excepcion que nadie revisara.
    for (const [ruta, motivo] of Object.entries(GLOBALES_ACEPTADAS)) {
      expect(motivo.length).toBeGreaterThan(60);
      expect(ruta).toMatch(/\.js (GET|POST|PUT|PATCH|DELETE) \//);
    }
  });

  test('las justificadas siguen existiendo', () => {
    // Si una se borra o se renombra, su justificacion queda huerfana.
    const existentes = rutasAdminSinRecurso();

    for (const ruta of Object.keys(GLOBALES_ACEPTADAS)) {
      expect(existentes).toContain(ruta);
    }
  });
});
