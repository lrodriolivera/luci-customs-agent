/**
 * Mensajes NCTS de un transito: normalizacion para la ficha expandida.
 *
 * E2E 8/Ago/2026: la ficha solo mostraba "N mensaje(s) NCTS", un contador. Tres
 * transiciones (`releaseAtDeparture` con IE029, `recordControlResult` con IE143,
 * `initiateEnquiry` con IE118) anotan mensajes que LUCI genera en local y que no
 * salen ni entran por la red, asi que en el contador quedaban sumados a los
 * IE015/IE028/IE160/IE044 que si son intercambios reales con AEAT. Quien miraba
 * el expediente concluia que la aduana habia respondido.
 *
 * El backend los distingue con `exchanged` (ver Transit.messages). `undefined`
 * significa intercambiado: los mensajes guardados antes del campo son reales.
 */

const DESCRIPCION_MENSAJE = {
  IE015: 'Declaracion de transito',
  IE016: 'Declaracion rechazada',
  IE028: 'MRN asignado',
  IE029: 'Levante para transito',
  IE044: 'Notificacion de descarga',
  IE045: 'Solicitud de baja',
  IE050: 'Analisis de riesgo',
  IE051: 'Levante denegado',
  IE055: 'Garantia no valida',
  IE060: 'Decision de control',
  IE118: 'Solicitud de busqueda',
  IE140: 'Consulta sobre la operacion',
  IE141: 'Solicitud de informacion',
  IE142: 'Respuesta de informacion',
  IE143: 'Resultados del control',
  IE160: 'Notificacion de llegada',
  IE906: 'Rechazo funcional',
  IE917: 'Rechazo de XML',
  IE928: 'Acuse de recibo'
}

export const descripcionMensaje = (tipo) => DESCRIPCION_MENSAJE[tipo] || ''

/**
 * @returns {{tipo, descripcion, direccion, intercambiado, fecha}[]} ordenados por
 * fecha ascendente, como el hilo de un expediente.
 */
export function normalizarMensajes(mensajes) {
  if (!Array.isArray(mensajes)) return []

  return mensajes
    .filter(m => m && typeof m === 'object')
    .map(m => ({
      tipo: m.type || '',
      descripcion: descripcionMensaje(m.type),
      // Solo tiene sentido hablar de entrante/saliente si hubo intercambio.
      direccion: m.exchanged === false ? null : m.direction || null,
      intercambiado: m.exchanged !== false,
      fecha: m.timestamp || null
    }))
    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0))
}

/** Cuantos de los mensajes se intercambiaron de verdad con AEAT. */
export const contarIntercambiados = (mensajes) =>
  normalizarMensajes(mensajes).filter(m => m.intercambiado).length
