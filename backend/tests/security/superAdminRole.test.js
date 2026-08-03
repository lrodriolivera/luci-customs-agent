/**
 * El rol de super administrador se escribe de UNA sola forma.
 *
 * Habia tres cadenas distintas que no se reconocian entre si:
 *
 *   tenantGuard.js        user.role === 'superadmin'   (sin guion bajo)
 *   tenantMiddleware.js   user.role === 'super_admin'
 *   rbacService.js        el rol definido como 'super_admin'
 *
 * y ninguna coincidia con el enum de User.role, que solo admitia
 * admin|supervisor|agent|viewer. Consecuencia: /api/v1/tenants -- crear,
 * suspender y borrar organizaciones -- era INALCANZABLE, porque no habia forma
 * de que un usuario tuviera el rol que superAdminOnly exigia.
 *
 * Fallaba cerrado, nunca fue un agujero. El peligro estaba en la direccion
 * contraria: bastaba con que alguien "arreglase" una de las tres para que las
 * otras dos concedieran acceso sin querer.
 *
 * Hoy NINGUN usuario tiene el rol, por decision explicita. El test comprueba
 * las dos mitades: que un super_admin PASA, y que un admin corriente NO pasa
 * (admin es rol de tenant, no de plataforma).
 */

const { ROLES, TODOS, DE_TENANT, esSuperAdmin } = require('../../src/constants/roles');
const { superAdminOnly } = require('../../src/middleware/tenantMiddleware');
const { isSuperAdmin: guardEsSuperAdmin } = require('../../src/utils/tenantGuard');
const User = require('../../src/models/User');

/** Respuesta que captura el status y el cuerpo. */
function res() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

describe('constants/roles: fuente unica', () => {
  test('la cadena canonica es super_admin', () => {
    expect(ROLES.SUPER_ADMIN).toBe('super_admin');
  });

  test('SUPER_ADMIN no es un rol de tenant', () => {
    // Es la distincion que se perdia: admin administra SU organizacion,
    // super_admin la plataforma entera.
    expect(DE_TENANT).not.toContain(ROLES.SUPER_ADMIN);
    expect(DE_TENANT).toContain(ROLES.ADMIN);
  });

  test('el objeto de roles es inmutable', () => {
    // Object.freeze no lanza fuera de modo estricto: se comprueba el efecto.
    ROLES.SUPER_ADMIN = 'otro';

    expect(ROLES.SUPER_ADMIN).toBe('super_admin');
    expect(Object.isFrozen(ROLES)).toBe(true);
  });
});

describe('esSuperAdmin', () => {
  test('reconoce la forma canonica', () => {
    expect(esSuperAdmin({ role: 'super_admin' })).toBe(true);
  });

  test.each([
    ['superadmin sin guion bajo', { role: 'superadmin' }],
    ['el booleano isSuperAdmin', { isSuperAdmin: true }],
    ['el array roles[]', { roles: ['super_admin'] }]
  ])('reconoce la forma heredada: %s', (_, user) => {
    // Puede haber documentos antiguos con estas formas.
    expect(esSuperAdmin(user)).toBe(true);
  });

  test.each([
    ['un admin de tenant', { role: 'admin' }],
    ['un supervisor', { role: 'supervisor' }],
    ['un agente', { role: 'agent' }],
    ['un viewer', { role: 'viewer' }],
    ['sin usuario', null],
    ['sin rol', {}]
  ])('NO reconoce: %s', (_, user) => {
    expect(esSuperAdmin(user)).toBe(false);
  });

  test('isSuperAdmin en false explicito no concede el rol', () => {
    expect(esSuperAdmin({ role: 'admin', isSuperAdmin: false })).toBe(false);
  });
});

describe('los tres consumidores coinciden', () => {
  // Este es el punto del ejercicio: antes discrepaban.
  test.each([
    ['super_admin', { role: 'super_admin' }, true],
    ['superadmin heredado', { role: 'superadmin' }, true],
    ['admin de tenant', { role: 'admin' }, false]
  ])('%s -> %s en tenantGuard y en esSuperAdmin', (_, user, esperado) => {
    expect(guardEsSuperAdmin(user)).toBe(esperado);
    expect(esSuperAdmin(user)).toBe(esperado);
  });
});

describe('/api/v1/tenants es alcanzable por el rol unificado', () => {
  test('un super_admin PASA el middleware', () => {
    // Antes era imposible: ningun valor del enum satisfacia superAdminOnly.
    const siguiente = jest.fn();
    const r = res();

    superAdminOnly({ user: { role: ROLES.SUPER_ADMIN } }, r, siguiente);

    expect(siguiente).toHaveBeenCalled();
    expect(r.statusCode).toBeNull();
  });

  test('la forma heredada tambien pasa', () => {
    const siguiente = jest.fn();

    superAdminOnly({ user: { role: 'superadmin' } }, res(), siguiente);

    expect(siguiente).toHaveBeenCalled();
  });

  test('un admin de tenant NO pasa: 403', () => {
    // La otra mitad del arreglo. Unificar no puede significar abrir la puerta.
    const siguiente = jest.fn();
    const r = res();

    superAdminOnly({ user: { role: ROLES.ADMIN } }, r, siguiente);

    expect(siguiente).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(403);
  });

  test('sin autenticar: 401, no 403', () => {
    // Distinguirlos importa: 403 confirmaria que el endpoint existe.
    const r = res();

    superAdminOnly({}, r, jest.fn());

    expect(r.statusCode).toBe(401);
  });
});

describe('el modelo User admite el rol', () => {
  test('super_admin esta en el enum de role', () => {
    // Sin esto el rol no es asignable y el endpoint sigue inalcanzable.
    expect(User.schema.path('role').enumValues).toContain(ROLES.SUPER_ADMIN);
  });

  test('el enum coincide exactamente con la constante', () => {
    expect(User.schema.path('role').enumValues.sort()).toEqual([...TODOS].sort());
  });

  test('un rol inventado sigue siendo invalido', () => {
    const u = new User({ email: 'x@y.es', password: 'x', name: 'X', role: 'inventado' });

    expect(u.validateSync()?.errors?.role).toBeDefined();
  });
});

describe('no quedan cadenas sueltas en el codigo', () => {
  const fs = require('fs');
  const path = require('path');

  test('solo constants/roles.js y los tests mencionan la forma heredada', () => {
    // Si vuelve a aparecer 'superadmin' suelto en un service o controller,
    // es que alguien ha reintroducido una cuarta variante.
    const raiz = path.join(__dirname, '../../src');
    const sospechosos = [];

    const recorrer = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { recorrer(p); continue; }
        if (!e.name.endsWith('.js')) continue;
        if (p.endsWith(path.join('constants', 'roles.js'))) continue;  // el unico sitio legitimo

        // Solo codigo: los comentarios pueden citar la forma heredada al
        // explicar por que existia.
        const codigo = fs.readFileSync(p, 'utf8')
          .split('\n')
          .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
          .join('\n');

        if (/['"`]superadmin['"`]/.test(codigo)) {
          sospechosos.push(path.relative(raiz, p));
        }
      }
    };
    recorrer(raiz);

    expect(sospechosos).toEqual([]);
  });
});
