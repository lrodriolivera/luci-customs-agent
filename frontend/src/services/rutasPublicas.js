/**
 * Rutas de la API que se llaman sin sesión (o con un token propio en la ruta).
 * A estas no se les adjunta el Authorization del usuario conectado: así una URL
 * manipulada de /reset-password/:token o /portal/:token no puede hacer que la
 * petición viaje con el token de la víctima.
 */
const EXACTAS = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password']
const PREFIJOS = ['/api/auth/reset-password/', '/api/portal/']
// Bajo /api/portal/ hay rutas privadas (authenticate + requireRole('admin') en
// backend/src/routes/portal.js). Se evalúan antes que PREFIJOS.
const EXCLUIDAS = ['/api/portal/api-keys']

export function esRutaPublica(url) {
  if (typeof url !== 'string') return false
  const ruta = url.split('?')[0].split('#')[0]
  if (EXCLUIDAS.some((e) => ruta === e || ruta.startsWith(`${e}/`))) return false
  return EXACTAS.includes(ruta) || PREFIJOS.some((prefijo) => ruta.startsWith(prefijo))
}
