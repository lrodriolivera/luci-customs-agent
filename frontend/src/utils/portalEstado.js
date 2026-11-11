/**
 * Paso del portal del cliente que corresponde al estado real del expediente.
 *
 * El portal pinta seis pasos (PENDING_DOCS … COMPLETED) y comparaba contra esos
 * nombres, pero el backend guarda los estados del flujo interno
 * ('pending_documents', 'ready_for_declaration', 'green_channel'…): el cliente
 * veia siempre «Estado desconocido» y 0 % (UAT del 11/Nov/2026).
 */

export const PASOS_PORTAL = ['PENDING_DOCS', 'DOCS_RECEIVED', 'VALIDATING', 'PROCESSING', 'SUBMITTED', 'COMPLETED']

const PASO_POR_ESTADO = {
  draft: 'PENDING_DOCS',
  pending_documents: 'PENDING_DOCS',
  documents_incomplete: 'PENDING_DOCS',
  documents_received: 'DOCS_RECEIVED',
  validating_documents: 'VALIDATING',
  documents_validated: 'VALIDATING',
  classification_pending: 'PROCESSING',
  classification_done: 'PROCESSING',
  ready_for_declaration: 'PROCESSING',
  declaration_draft: 'PROCESSING',
  declaration_submitted: 'SUBMITTED',
  green_channel: 'SUBMITTED',
  yellow_channel: 'SUBMITTED',
  orange_channel: 'SUBMITTED',
  red_channel: 'SUBMITTED',
  levante: 'SUBMITTED',
  completed: 'COMPLETED'
}

const PROGRESO = { PENDING_DOCS: 10, DOCS_RECEIVED: 30, VALIDATING: 50, PROCESSING: 70, SUBMITTED: 90, COMPLETED: 100 }

/** Documentos obligatorios que el cliente todavia no ha entregado. */
export const documentosPendientes = (expedition) =>
  (expedition?.documentChecklist || []).filter((doc) => doc.required && !doc.received)

/**
 * Documentos que se enseñan al cliente: los obligatorios y los que ya estan
 * entregados. Los opcionales sin entregar no se muestran para que no adelante
 * documentacion que la operacion no necesita.
 */
export const documentosParaElCliente = (expedition) =>
  (expedition?.documentChecklist || []).filter((doc) => doc.required || doc.received)

/**
 * @returns {string|null} paso del portal, o null si el estado no se reconoce
 *   (por ejemplo, un expediente cancelado)
 */
export const pasoDelPortal = (expedition) => {
  const paso = PASO_POR_ESTADO[String(expedition?.status ?? '').toLowerCase()] || null
  // El agente puede subir la documentacion sin que el estado interno avance:
  // si ya no falta ningun documento obligatorio, el cliente no esta «esperando».
  const hayChecklist = (expedition?.documentChecklist || []).some((doc) => doc.required)
  if (paso === 'PENDING_DOCS' && hayChecklist && documentosPendientes(expedition).length === 0) return 'DOCS_RECEIVED'
  return paso
}

export const progresoDelPortal = (expedition) => PROGRESO[pasoDelPortal(expedition)] || 0
