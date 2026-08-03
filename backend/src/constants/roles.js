/**
 * Roles del sistema. Fuente unica de verdad.
 *
 * Antes de este fichero el rol de super administrador se escribia de TRES
 * formas distintas que no se reconocian entre si:
 *
 *   src/utils/tenantGuard.js       user.role === 'superadmin'  (sin guion bajo)
 *                                  o el booleano user.isSuperAdmin
 *   src/middleware/tenantMiddleware.js  user.role === 'super_admin'
 *   src/services/tenant/rbacService.js  el rol definido como 'super_admin'
 *
 * Ninguna de las tres coincidia ademas con el enum de User.role, que solo
 * admitia admin|supervisor|agent|viewer. El resultado era que /api/v1/tenants
 * -- crear, suspender y borrar organizaciones -- resultaba INALCANZABLE: no
 * habia forma de que un usuario tuviera el rol que exigia superAdminOnly.
 *
 * Fallaba cerrado, asi que nunca fue un agujero. Pero la gestion de tenants no
 * funcionaba por API, y una divergencia asi es peligrosa en la direccion
 * contraria: basta con que alguien "arregle" una de las tres para que las otras
 * dos concedan acceso sin querer.
 *
 * ┌─ IMPORTANTE ─────────────────────────────────────────────────────────────┐
 * │ SUPER_ADMIN es un rol de PLATAFORMA: actua sobre todos los tenants.      │
 * │ ADMIN es un rol de TENANT: administra SU organizacion, no la plataforma. │
 * │ No son el mismo nivel y no deben tratarse como intercambiables.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Hoy NINGUN usuario tiene SUPER_ADMIN, a proposito. El rol existe y el codigo
 * lo reconoce de forma coherente, pero concederlo es una decision explicita:
 *
 *   db.users.updateOne({ email: '...' }, { $set: { role: 'super_admin' } })
 */

/** Rol de plataforma: cruza tenants. */
const SUPER_ADMIN = 'super_admin';

/** Roles de tenant, acotados a la organizacion del usuario. */
const ADMIN = 'admin';
const SUPERVISOR = 'supervisor';
const AGENT = 'agent';
const VIEWER = 'viewer';

const ROLES = Object.freeze({ SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT, VIEWER });

/** Valores admitidos por el enum de User.role, en orden de privilegio. */
const TODOS = Object.freeze([SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT, VIEWER]);

/** Roles acotados a un tenant. SUPER_ADMIN no esta aqui: no lo esta. */
const DE_TENANT = Object.freeze([ADMIN, SUPERVISOR, AGENT, VIEWER]);

/**
 * ¿Es este usuario super administrador de plataforma?
 *
 * Unico punto donde se decide. Acepta las formas heredadas -- 'superadmin' sin
 * guion bajo, el booleano isSuperAdmin y el array roles[] -- porque puede haber
 * documentos antiguos con ellas, pero la forma canonica es role === 'super_admin'.
 */
function esSuperAdmin(user) {
  if (!user) return false;
  return (
    user.role === SUPER_ADMIN ||
    user.role === 'superadmin' ||          // heredado, sin guion bajo
    user.isSuperAdmin === true ||          // heredado, booleano
    (Array.isArray(user.roles) && user.roles.includes(SUPER_ADMIN))
  );
}

module.exports = { ROLES, TODOS, DE_TENANT, esSuperAdmin, SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT, VIEWER };
