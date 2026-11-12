/**
 * Cómo se muestra el circuito que la AEAT asigna a una declaración.
 *
 * La pantalla trataba como «canal rojo» todo lo que no fuese verde o naranja:
 * un circuito amarillo, o una declaración aún sin circuito, salía como
 * «pendiente de inspección física».
 */
const CANALES = {
  green: { clase: 'bg-green-200 text-green-800', etiqueta: 'expeditions.greenChannelFull', estado: 'expeditions.releaseAuthorized' },
  yellow: { clase: 'bg-yellow-200 text-yellow-900', etiqueta: 'expeditions.yellowChannelFull', estado: 'expeditions.pendingCertificates' },
  orange: { clase: 'bg-orange-200 text-orange-800', etiqueta: 'expeditions.orangeChannelFull', estado: 'expeditions.pendingDocReview' },
  red: { clase: 'bg-red-200 text-red-800', etiqueta: 'expeditions.redChannelFull', estado: 'expeditions.pendingPhysicalInspection' }
}
const SIN_CANAL = { clase: 'bg-gray-200 text-gray-700', etiqueta: 'expeditions.noChannelFull', estado: 'expeditions.noChannelYet' }

/** Clases, clave de la etiqueta y clave del estado para un circuito («green», «yellow», «orange», «red» o ninguno). */
export const infoCanal = (canal) => CANALES[canal] || SIN_CANAL
