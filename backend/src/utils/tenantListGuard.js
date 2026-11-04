/**
 * Guard de listados por tenant (plugin de Mongoose).
 *
 * Los listados, calendarios y estadisticas de PUE, plazos, inspecciones,
 * comunicaciones al inspector y chat se construian sin tenantId y devolvian los
 * datos de todos los clientes. Con este plugin un find, countDocuments,
 * distinct o aggregate de esos modelos sin tenantId en el filtro FALLA en vez
 * de devolver datos de otros tenants.
 *
 * - find / countDocuments / distinct: tenantId en el filtro, directo o dentro
 *   de un $and.
 * - aggregate: la primera etapa debe ser un $match con tenantId.
 * - findById / findOne no se bloquean: son accesos por id, que comprueba
 *   ensureSameTenant tras la lectura.
 *
 * Un listado sin tenant deliberado (un cron interno, un super_admin) tiene que
 * decirlo con la opcion sinTenant y un motivo legible:
 *   Model.find(q).setOptions({ sinTenant: 'cron de alertas de plazos' })
 *   Model.aggregate(p).option({ sinTenant: 'super_admin: estadistica global' })
 * `true` no basta: el motivo queda en el codigo para quien lo revise.
 */

class TenantFilterError extends Error {
  constructor(modelo, operacion) {
    super(`[tenantListGuard] ${modelo}.${operacion} sin tenantId en el filtro: ` +
      'acota el listado al tenant del usuario o declara sinTenant con un motivo');
    this.name = 'TenantFilterError';
    this.code = 'TENANT_FILTER_REQUIRED';
  }
}

function filtroTieneTenant(filtro) {
  if (!filtro || typeof filtro !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(filtro, 'tenantId')) return true;
  return Array.isArray(filtro.$and) && filtro.$and.some(filtroTieneTenant);
}

/** Lee y retira la opcion sinTenant para que no llegue al driver de MongoDB. */
function tomarExcepcion(opciones) {
  if (!opciones || !('sinTenant' in opciones)) return false;
  const motivo = opciones.sinTenant;
  delete opciones.sinTenant;
  return typeof motivo === 'string' && motivo.trim().length > 0;
}

function tenantListGuard(schema, { modelo } = {}) {
  schema.pre(['find', 'countDocuments', 'distinct'], function () {
    if (tomarExcepcion(this.options)) return;
    if (!filtroTieneTenant(this.getFilter())) throw new TenantFilterError(modelo, this.op);
  });

  schema.pre('aggregate', function () {
    if (tomarExcepcion(this.options)) return;
    const primera = this.pipeline()[0];
    if (!primera || !filtroTieneTenant(primera.$match)) throw new TenantFilterError(modelo, 'aggregate');
  });
}

module.exports = { tenantListGuard, TenantFilterError, filtroTieneTenant };
