/**
 * Divisas con tipo de cambio oficial para el valor en aduana: el euro y las
 * que cotiza el BCE. Las más frecuentes en una factura de importación van
 * primero; el resto, por orden alfabético.
 */
export const DIVISAS_OFICIALES = [
  'EUR', 'USD', 'GBP', 'CNY',
  'AUD', 'BRL', 'CAD', 'CHF', 'CZK', 'DKK', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY',
  'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'ZAR'
]

/** Importe en euros de un importe en divisa (tipo = unidades de divisa por 1 EUR). */
export const aEuros = (importe, tipo) => {
  const valor = Number(importe)
  if (!Number.isFinite(valor) || !(tipo > 0)) return null
  return Math.round((valor / tipo) * 100) / 100
}

/** «2026-11» -> «noviembre de 2026» en el idioma indicado. */
export const nombreDelMes = (mes, idioma = 'es') => {
  const [anio, m] = String(mes || '').split('-').map(Number)
  if (!anio || !m) return ''
  return new Intl.DateTimeFormat(idioma, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(anio, m - 1, 1)))
}

/** «2026-10-21» -> «21/10/2026». */
export const fechaCorta = (fecha) => {
  const [anio, mes, dia] = String(fecha || '').split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : ''
}

/** Tipo con cuatro decimales como mínimo y coma decimal: 1,1234. */
export const formatearTipo = (tipo) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(tipo)
