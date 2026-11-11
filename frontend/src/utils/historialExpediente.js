/**
 * Texto de un evento del historial del expediente.
 *
 * El backend guarda la accion como clave interna («document_uploaded») y la
 * pantalla la pintaba tal cual. Se traduce por clave; una accion sin
 * traduccion muestra la descripcion que guardo el backend y, si tampoco la
 * hay, la clave escrita como frase, nunca con guiones bajos.
 *
 * @param {{ action?: string, description?: string }} evento
 * @param {(clave: string, opciones?: object) => string} t
 * @returns {string}
 */
export function textoEvento(evento, t) {
  const accion = String(evento?.action || '').trim()
  if (accion) {
    const traducido = t(`expeditions.timelineAction.${accion}`, { defaultValue: '' })
    if (traducido) return traducido
  }
  const descripcion = String(evento?.description || '').trim()
  if (descripcion) return descripcion
  const frase = accion.replace(/_/g, ' ')
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}
