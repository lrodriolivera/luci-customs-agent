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

/**
 * Resto de divisas en vigor de la norma ISO 4217 (sin metales, fondos ni
 * códigos de prueba). El BCE no las cotiza: la AEAT las rechaza en el H1
 * (error 25001) y la declaración se hace en euros con el cambio aplicado y el
 * documento 1017. Sin BGN (Bulgaria usa el euro desde 2026) ni HRK.
 */
export const DIVISAS_SIN_BCE = [
  'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND',
  'BOB', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CDF', 'CLP', 'COP', 'CRC', 'CUP', 'CVE', 'DJF', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'FJD', 'FKP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HNL', 'HTG', 'IQD',
  'IRR', 'JMD', 'JOD', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD',
  'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MZN', 'NAD',
  'NGN', 'NIO', 'NPR', 'OMR', 'PAB', 'PEN', 'PGK', 'PKR', 'PYG', 'QAR', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD',
  'SCR', 'SDG', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'TJS', 'TMT', 'TND', 'TOP',
  'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF',
  'XPF', 'YER', 'ZMW', 'ZWG'
]

/** Todas las divisas que puede traer una factura: primero las del BCE. */
export const DIVISAS_FACTURA = [...DIVISAS_OFICIALES, ...DIVISAS_SIN_BCE]

/** Si el BCE cotiza la divisa (y por tanto la aduana tiene su tipo oficial). */
export const tieneTipoBce = (divisa) => DIVISAS_OFICIALES.includes(String(divisa || '').toUpperCase())

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
