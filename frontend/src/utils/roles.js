/**
 * Quien administra el tenant desde la interfaz.
 *
 * Mismo criterio que el servidor en POST /api/auth/admin/invite y
 * PUT /api/tenant/general: solo el administrador de la organizacion (admin) o
 * el super administrador de plataforma (super_admin). El supervisor NO: ve los
 * datos pero no da de alta usuarios ni cambia los datos de la empresa.
 *
 * Ocultar un boton no protege nada: el servidor responde 403 igualmente. Esto
 * solo evita ofrecer acciones que van a fallar.
 */
export const ROLES_ADMINISTRADORES = Object.freeze(['admin', 'super_admin'])

/**
 * @param {{ role?: string } | null | undefined} user
 * @returns {boolean}
 */
export function esAdministradorDelTenant(user) {
  return ROLES_ADMINISTRADORES.includes(user?.role)
}
