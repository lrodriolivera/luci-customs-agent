/**
 * Estado en memoria acotado por tenant para los servicios de ML.
 *
 * Ambito (tenantId): undefined = super admin de plataforma (lee todos los cubos y
 * escribe en el suyo); null = usuario sin tenant (no lee nada); string = ese tenant.
 * Es el mismo criterio que ambitoTenant() de utils/tenantGuard.
 */

const CLAVE_PLATAFORMA = '__plataforma__';
const CLAVE_SIN_TENANT = '__sin_tenant__';

function crearEstadoPorTenant(crearCubo) {
  const cubos = new Map();

  const clave = (tenantId) => {
    if (tenantId === undefined) return CLAVE_PLATAFORMA;
    if (tenantId === null) return CLAVE_SIN_TENANT;
    return String(tenantId);
  };

  return {
    /** Cubo donde escribe el ambito (se crea si no existe). */
    escribir(tenantId) {
      const k = clave(tenantId);
      if (!cubos.has(k)) cubos.set(k, crearCubo());
      return cubos.get(k);
    },
    /** Cubos que el ambito puede leer. */
    visibles(tenantId) {
      if (tenantId === undefined) return [...cubos.values()];
      if (tenantId === null) return [];
      const cubo = cubos.get(String(tenantId));
      return cubo ? [cubo] : [];
    }
  };
}

module.exports = { crearEstadoPorTenant };
