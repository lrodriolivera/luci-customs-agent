/**
 * Paises aduaneros y paises habilitados de un tenant.
 *
 * El EORI vive en el tenant (GET/PUT /api/tenant/eori), no en el navegador: los
 * paises habilitados son los que tienen EORI configurado mas el pais base del
 * tenant (`customsConfig.country`).
 */
export const PAISES_ADUANEROS = [
  { code: 'ES', name: 'Espana', system: 'AEAT', systemFull: 'Agencia Estatal de Administracion Tributaria', flag: '\u{1F1EA}\u{1F1F8}', placeholder: 'ESX0000000X', certLabel: 'Certificado FNMT / Digital' },
  { code: 'NL', name: 'Paises Bajos', system: 'DMS/DECO', systemFull: 'Douane Management Systeem', flag: '\u{1F1F3}\u{1F1F1}', placeholder: 'NL000000000000', certLabel: 'Certificado PKIoverheid / eHerkenning' },
  { code: 'BE', name: 'Belgica', system: 'PLDA', systemFull: 'Paperless Douane en Accijnzen', flag: '\u{1F1E7}\u{1F1EA}', disabled: true, label: 'Proximamente' },
  { code: 'DE', name: 'Alemania', system: 'ATLAS', systemFull: 'Automatisiertes Tarif- und Lokales Zoll-Abwicklungssystem', flag: '\u{1F1E9}\u{1F1EA}', disabled: true, label: 'Proximamente' },
  { code: 'FR', name: 'Francia', system: 'DELTA', systemFull: 'Dedouanement En Ligne par Traitement Automatise', flag: '\u{1F1EB}\u{1F1F7}', disabled: true, label: 'Proximamente' }
]

/**
 * Codigos de pais habilitados a partir de la respuesta de GET /api/tenant/eori
 * (`{ eoriNumbers, defaultEori, country }`): el pais base y los que tienen EORI.
 */
export function codigosHabilitados(datos) {
  const eoriNumbers = datos?.eoriNumbers || {}
  const conEori = PAISES_ADUANEROS
    .filter((p) => !p.disabled && eoriNumbers[p.code])
    .map((p) => p.code)
  return [...new Set([datos?.country || 'ES', ...conEori])]
}

/** EORI por pais para el formulario: el de ES cae al de la ficha de empresa. */
export function eoriPorPais(datos) {
  const numeros = { ...(datos?.eoriNumbers || {}) }
  if (!numeros.ES && datos?.defaultEori) numeros.ES = datos.defaultEori
  return numeros
}
