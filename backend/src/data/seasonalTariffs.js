/**
 * Aranceles estacionales de la UE para productos agricolas
 * Fuente: Reglamento (UE) 2658/87, Arancel Integrado TARIC
 *
 * Muchos productos agricolas tienen:
 * 1. Tipos ad valorem que varian segun la epoca del ano
 * 2. Sistema de precios de entrada (entry price system)
 * 3. Derechos especificos que dependen del periodo
 *
 * Formato de periodos: { from: 'MM-DD', to: 'MM-DD', rate: X.X, ... }
 * Si from > to, el periodo cruza fin de ano (ej: 15-oct a 30-abr)
 */

const SEASONAL_TARIFFS = {
  // =====================================================
  // CAPITULO 07 - HORTALIZAS
  // =====================================================

  // 0702 - Tomates frescos o refrigerados
  '0702000000': {
    description: 'Tomates frescos o refrigerados',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '03-31', rate: 8.8, entryPrice: 62.60, label: 'Invierno' },
      { from: '04-01', to: '04-30', rate: 8.8, entryPrice: 72.60, label: 'Primavera temprana' },
      { from: '05-01', to: '05-14', rate: 8.8, entryPrice: 72.60, label: 'Mayo (1a quincena)' },
      { from: '05-15', to: '05-31', rate: 8.8, entryPrice: 72.60, label: 'Mayo (2a quincena)' },
      { from: '06-01', to: '09-30', rate: 8.8, entryPrice: 52.60, label: 'Verano' },
      { from: '10-01', to: '10-31', rate: 8.8, entryPrice: 62.60, label: 'Octubre' },
      { from: '11-01', to: '12-20', rate: 8.8, entryPrice: 52.60, label: 'Nov-Dic temprano' },
      { from: '12-21', to: '12-31', rate: 8.8, entryPrice: 62.60, label: 'Fin de ano' }
    ]
  },

  // 0707 - Pepinos y pepinillos frescos o refrigerados
  '0707000500': {
    description: 'Pepinos frescos o refrigerados',
    hasEntryPrice: false,
    seasons: [
      { from: '01-01', to: '02-28', rate: 12.8, label: 'Ene-Feb' },
      { from: '03-01', to: '04-30', rate: 12.8, label: 'Mar-Abr' },
      { from: '05-01', to: '05-15', rate: 12.8, label: 'May (1-15)' },
      { from: '05-16', to: '09-30', rate: 12.8, label: 'May-Sep' },
      { from: '10-01', to: '10-31', rate: 12.8, label: 'Octubre' },
      { from: '11-01', to: '12-31', rate: 16, label: 'Nov-Dic' }
    ]
  },

  // 0709 - Alcachofas
  '0709100000': {
    description: 'Alcachofas frescas o refrigeradas',
    hasEntryPrice: false,
    seasons: [
      { from: '01-01', to: '06-30', rate: 10.4, label: '1er semestre' },
      { from: '07-01', to: '12-31', rate: 10.4, label: '2o semestre' }
    ]
  },

  // 0709 - Calabacines
  '0709930000': {
    description: 'Calabacines frescos o refrigerados',
    hasEntryPrice: false,
    seasons: [
      { from: '01-01', to: '01-31', rate: 12.8, label: 'Enero' },
      { from: '02-01', to: '03-31', rate: 12.8, label: 'Feb-Mar' },
      { from: '04-01', to: '12-31', rate: 12.8, label: 'Abr-Dic' }
    ]
  },

  // =====================================================
  // CAPITULO 08 - FRUTAS Y FRUTOS
  // =====================================================

  // 0805 - Agrios (citricos) frescos o secos
  '0805100000': {
    description: 'Naranjas frescas o secas',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '03-31', rate: 16, entryPrice: 35.40, label: 'Ene-Mar (temporada)' },
      { from: '04-01', to: '04-30', rate: 12, entryPrice: 35.40, label: 'Abril (transicion)' },
      { from: '05-01', to: '05-15', rate: 4.8, entryPrice: 35.40, label: 'May (1-15)' },
      { from: '05-16', to: '09-30', rate: 3.2, entryPrice: 35.40, label: 'Fuera temporada' },
      { from: '10-01', to: '11-30', rate: 12.8, entryPrice: 35.40, label: 'Oct-Nov' },
      { from: '12-01', to: '12-31', rate: 16, entryPrice: 35.40, label: 'Diciembre' }
    ]
  },

  // 0805.20 - Mandarinas, clementinas
  '0805200000': {
    description: 'Mandarinas, clementinas y similares',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '02-28', rate: 16, entryPrice: 28.60, label: 'Ene-Feb' },
      { from: '03-01', to: '10-31', rate: 16, entryPrice: 28.60, label: 'Mar-Oct' },
      { from: '11-01', to: '12-31', rate: 16, entryPrice: 28.60, label: 'Nov-Dic (temporada)' }
    ]
  },

  // 0805.50 - Limones
  '0805500000': {
    description: 'Limones y limas frescas o secas',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '05-31', rate: 6.4, entryPrice: 46.20, label: 'Ene-May (temporada)' },
      { from: '06-01', to: '12-31', rate: 6.4, entryPrice: 46.20, label: 'Jun-Dic' }
    ]
  },

  // 0806 - Uvas frescas
  '0806100000': {
    description: 'Uvas frescas de mesa',
    hasEntryPrice: false,
    seasons: [
      { from: '01-01', to: '07-14', rate: 8, label: 'Ene-Jul (importacion)' },
      { from: '07-15', to: '10-31', rate: 14.4, label: 'Jul-Oct (temporada UE)' },
      { from: '11-01', to: '12-31', rate: 8, label: 'Nov-Dic' }
    ]
  },

  // 0808.10 - Manzanas frescas
  '0808100000': {
    description: 'Manzanas frescas',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '03-31', rate: 4, entryPrice: 56.80, label: 'Ene-Mar' },
      { from: '04-01', to: '07-31', rate: 4, entryPrice: 56.80, label: 'Abr-Jul' },
      { from: '08-01', to: '12-31', rate: 11.2, entryPrice: 38.80, label: 'Ago-Dic (temporada UE)' }
    ]
  },

  // 0808.30 - Peras frescas
  '0808300000': {
    description: 'Peras frescas',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '03-31', rate: 5, entryPrice: 41.00, label: 'Ene-Mar' },
      { from: '04-01', to: '06-30', rate: 2.5, entryPrice: 41.00, label: 'Abr-Jun' },
      { from: '07-01', to: '07-31', rate: 5, entryPrice: 41.00, label: 'Julio' },
      { from: '08-01', to: '12-31', rate: 10, entryPrice: 41.00, label: 'Ago-Dic (temporada UE)' }
    ]
  },

  // 0809.10 - Albaricoques
  '0809100000': {
    description: 'Albaricoques frescos',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '05-31', rate: 20, entryPrice: 64.40, label: 'Fuera temporada' },
      { from: '06-01', to: '07-31', rate: 20, entryPrice: 64.40, label: 'Temporada' },
      { from: '08-01', to: '12-31', rate: 20, entryPrice: 64.40, label: 'Post-temporada' }
    ]
  },

  // 0809.21 - Cerezas
  '0809210000': {
    description: 'Guindas y cerezas frescas',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '04-30', rate: 12, entryPrice: 91.60, label: 'Ene-Abr (importacion)' },
      { from: '05-01', to: '07-15', rate: 12, entryPrice: 91.60, label: 'May-Jul (temporada UE)' },
      { from: '07-16', to: '12-31', rate: 12, entryPrice: 91.60, label: 'Jul-Dic' }
    ]
  },

  // 0809.30 - Melocotones y nectarinas
  '0809300000': {
    description: 'Melocotones y nectarinas frescos',
    hasEntryPrice: true,
    entryPriceUnit: 'EUR/100kg',
    seasons: [
      { from: '01-01', to: '06-10', rate: 17.6, entryPrice: 57.60, label: 'Fuera temporada' },
      { from: '06-11', to: '09-30', rate: 17.6, entryPrice: 57.60, label: 'Temporada UE' },
      { from: '10-01', to: '12-31', rate: 17.6, entryPrice: 57.60, label: 'Post-temporada' }
    ]
  },

  // 0809.40 - Ciruelas
  '0809400500': {
    description: 'Ciruelas frescas',
    hasEntryPrice: false,
    seasons: [
      { from: '01-01', to: '06-30', rate: 6.4, label: 'Fuera temporada' },
      { from: '07-01', to: '09-30', rate: 12, label: 'Temporada UE' },
      { from: '10-01', to: '12-31', rate: 6.4, label: 'Post-temporada' }
    ]
  },

  // 0810.10 - Fresas
  '0810100000': {
    description: 'Fresas frescas',
    hasEntryPrice: false,
    seasons: [
      { from: '01-01', to: '04-30', rate: 11.2, label: 'Ene-Abr (importacion)' },
      { from: '05-01', to: '07-31', rate: 11.2, label: 'May-Jul (temporada UE)' },
      { from: '08-01', to: '12-31', rate: 11.2, label: 'Ago-Dic' }
    ]
  },

  // =====================================================
  // CAPITULO 20 - PREPARACIONES DE HORTALIZAS/FRUTAS
  // =====================================================

  // 2009 - Zumo de naranja
  '2009110000': {
    description: 'Zumo de naranja congelado',
    hasEntryPrice: false,
    seasons: [
      { from: '01-01', to: '12-31', rate: 33.6, label: 'Todo el ano (tasa unica)' }
    ]
  }
}

/**
 * Obtener arancel estacional para un codigo TARIC en una fecha determinada
 * @param {string} taricCode - Codigo TARIC (10 digitos)
 * @param {Date} date - Fecha de importacion
 * @returns {object|null} Informacion del arancel estacional o null si no aplica
 */
function getSeasonalTariff(taricCode, date = new Date()) {
  // Buscar codigo exacto
  let tariff = SEASONAL_TARIFFS[taricCode]

  // Si no hay exacto, buscar por prefijos (8, 6, 4 digitos)
  if (!tariff) {
    for (let len = 8; len >= 4; len -= 2) {
      const prefix = taricCode.substring(0, len).padEnd(10, '0')
      tariff = SEASONAL_TARIFFS[prefix]
      if (tariff) break
    }
  }

  if (!tariff) return null

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${month}-${day}`

  // Encontrar periodo aplicable
  const currentSeason = tariff.seasons.find(s => {
    return dateStr >= s.from && dateStr <= s.to
  })

  if (!currentSeason) {
    // Fallback al primer periodo
    return {
      ...tariff,
      currentRate: tariff.seasons[0]?.rate || 0,
      currentSeason: tariff.seasons[0] || null,
      allSeasons: tariff.seasons,
      isSeasonal: true
    }
  }

  return {
    description: tariff.description,
    hasEntryPrice: tariff.hasEntryPrice,
    entryPriceUnit: tariff.entryPriceUnit,
    currentRate: currentSeason.rate,
    currentEntryPrice: currentSeason.entryPrice || null,
    currentSeason: currentSeason,
    allSeasons: tariff.seasons,
    isSeasonal: true,
    periodLabel: currentSeason.label
  }
}

/**
 * Verificar si un codigo TARIC tiene aranceles estacionales
 */
function hasSeasonalTariff(taricCode) {
  if (SEASONAL_TARIFFS[taricCode]) return true
  for (let len = 8; len >= 4; len -= 2) {
    const prefix = taricCode.substring(0, len).padEnd(10, '0')
    if (SEASONAL_TARIFFS[prefix]) return true
  }
  return false
}

/**
 * Obtener todos los codigos con aranceles estacionales
 */
function getAllSeasonalCodes() {
  return Object.keys(SEASONAL_TARIFFS)
}

module.exports = {
  SEASONAL_TARIFFS,
  getSeasonalTariff,
  hasSeasonalTariff,
  getAllSeasonalCodes
}
