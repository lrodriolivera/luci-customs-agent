/**
 * Enlaces oficiales de la Sede electronica de la AEAT para buscar declaraciones
 * sumarias. LUCI no puede consultarlos por el agente: las tres paginas piden
 * su certificado digital. Fuente: tarjeta "BUSQUEDA DE DECLARACIONES SUMARIAS"
 * de la agente de aduanas que prueba LUCI (13/11/2026).
 *
 * Unica fuente de estas URLs en el frontend: no repetirlas en otros ficheros.
 */

export const AEAT_SUMMARY_LINK_IDS = {
  G4: 'g4',
  MARITIME: 'maritime',
  EXPORT: 'export'
}

export const AEAT_SUMMARY_LINKS = [
  {
    id: AEAT_SUMMARY_LINK_IDS.G4,
    url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/DA15.shtml',
    titleKey: 'aeatSumariaLinks.g4Title',
    descriptionKey: 'aeatSumariaLinks.g4Description'
  },
  {
    id: AEAT_SUMMARY_LINK_IDS.MARITIME,
    url: 'https://sede.agenciatributaria.gob.es/Sede/aduanas/entrada-salida-mercancias/declaraciones-sumarias-ens/gestiones-declaracion-sumaria.html',
    titleKey: 'aeatSumariaLinks.maritimeTitle',
    descriptionKey: 'aeatSumariaLinks.maritimeDescription'
  },
  {
    id: AEAT_SUMMARY_LINK_IDS.EXPORT,
    url: 'https://www1.agenciatributaria.gob.es/wlpl/inwinvoc/es.aeat.dit.adu.adct.qry.QryContInt',
    titleKey: 'aeatSumariaLinks.exportTitle',
    descriptionKey: 'aeatSumariaLinks.exportDescription'
  }
]

// Independientes de MARITIME_MODES en GroupageCard.jsx: ahi deciden si se
// bloquea el H1, aqui solo se sugiere que enlace mirar primero. No conviene
// acoplar ambas listas a un mismo cambio futuro.
const MARITIME_TRANSPORT_MODES = ['SEA', 'sea', 'maritime', '1']
const AIR_OR_LAND_TRANSPORT_MODES = ['AIR', 'air', '4', 'ROAD', 'road', '3', 'RAIL', 'rail', '2', 'LAND', 'land']

/**
 * Enlace de la Sede de la AEAT que conviene destacar segun el modo de
 * transporte del expediente. Los demas enlaces no se ocultan: solo no se
 * marcan como recomendados.
 *
 * @param {string|undefined} transportMode
 * @returns {string|null} uno de AEAT_SUMMARY_LINK_IDS, o null si no hay modo reconocido
 */
export function getEnlaceDestacado(transportMode) {
  const mode = String(transportMode ?? '')
  if (MARITIME_TRANSPORT_MODES.includes(mode)) return AEAT_SUMMARY_LINK_IDS.MARITIME
  if (AIR_OR_LAND_TRANSPORT_MODES.includes(mode)) return AEAT_SUMMARY_LINK_IDS.G4
  return null
}
