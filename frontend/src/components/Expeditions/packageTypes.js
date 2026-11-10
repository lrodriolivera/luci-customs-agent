// Tipos de bulto mas habituales, con el codigo UN/ECE Rec. 21 de dos letras
// que espera la AEAT en la casilla de bultos del H1 y del AES.
export const PACKAGE_TYPES = [
  { code: 'CT', labelKey: 'expeditions.packageTypeCT' },
  { code: 'PX', labelKey: 'expeditions.packageTypePX' },
  { code: 'BX', labelKey: 'expeditions.packageTypeBX' },
  { code: 'PK', labelKey: 'expeditions.packageTypePK' },
  { code: 'BG', labelKey: 'expeditions.packageTypeBG' },
  { code: 'DR', labelKey: 'expeditions.packageTypeDR' },
  { code: 'CR', labelKey: 'expeditions.packageTypeCR' },
  { code: 'NE', labelKey: 'expeditions.packageTypeNE' }
]

export const DEFAULT_PACKAGE_TYPE = 'CT'

/**
 * Convierte el valor de un input numerico en numero, o undefined si esta vacio
 * o no es un numero: asi un campo en blanco no se guarda como 0.
 *
 * @param {string|number|undefined|null} value
 * @returns {number|undefined}
 */
export const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
