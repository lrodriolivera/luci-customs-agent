/**
 * Aduanas de despacho que ofrecen los formularios directos H1 y H7.
 *
 * Codigos de la lista oficial de aduanas (backend/src/config/aduanasOficiales.js,
 * ES00 + recinto de 4 cifras = provincia + oficina). La lista anterior tenia los
 * codigos cambiados (ES004601 como "Sevilla", ES000101 como "Valencia",
 * ES003001 como "Las Palmas"...). ES002801 va primero: es Madrid aeropuerto,
 * el recinto de la sumaria de pruebas de PRE.
 */
export const ADUANAS_DESPACHO = Object.freeze([
  { code: 'ES002801', name: 'Madrid - Aeropuerto' },
  { code: 'ES002811', name: 'Madrid - Puerto Seco' },
  { code: 'ES002841', name: 'Madrid - Carretera' },
  { code: 'ES000801', name: 'Barcelona - Aeropuerto' },
  { code: 'ES000811', name: 'Barcelona - Marítima Importación' },
  { code: 'ES000841', name: 'Barcelona - Carretera' },
  { code: 'ES004601', name: 'Valencia - Aeropuerto' },
  { code: 'ES004611', name: 'Valencia - Marítima' },
  { code: 'ES004641', name: 'Valencia - Carretera' },
  { code: 'ES001131', name: 'Algeciras - Marítima (Tránsito)' },
  { code: 'ES001111', name: 'Cádiz - Marítima' },
  { code: 'ES004801', name: 'Bilbao - Aeropuerto' },
  { code: 'ES004811', name: 'Bilbao - Marítima' },
  { code: 'ES003611', name: 'Vigo - Marítima' },
  { code: 'ES004101', name: 'Sevilla - Aeropuerto' },
  { code: 'ES004111', name: 'Sevilla - Marítima' },
  { code: 'ES002901', name: 'Málaga - Aeropuerto' },
  { code: 'ES002911', name: 'Málaga - Marítima' },
  { code: 'ES001211', name: 'Castellón - Marítima' },
  { code: 'ES002011', name: 'Pasajes - Marítima' },
  { code: 'ES000101', name: 'Álava - Aeropuerto' }
])
