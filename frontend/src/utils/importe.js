/**
 * Formato de importes con el convenio espanol: punto de millares y coma
 * decimal (184.800,00). Los campos numericos del navegador toman el punto como
 * separador DECIMAL, de modo que quien teclea "184.800" queriendo decir ciento
 * ochenta y cuatro mil ochocientos guarda 184,80 sin darse cuenta (UAT
 * 10/Nov/2026). Mostrar el importe ya interpretado deja el error a la vista
 * antes de guardar.
 *
 * @param {number|string|null|undefined} value
 * @param {string} [currency]
 * @returns {string} cadena vacia si el valor no es un numero
 */
export const formatearImporte = (value, currency = '') => {
  if (value === '' || value === null || value === undefined) return ''
  const numero = Number(value)
  if (!Number.isFinite(numero)) return ''
  const texto = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: 'always'
  }).format(numero)
  return currency ? `${texto} ${currency}` : texto
}

/**
 * Interpreta un importe tecleado con el convenio español: el punto separa los
 * millares y la coma los decimales. «184.800» son ciento ochenta y cuatro mil
 * ochocientos, no 184,8 (que es lo que guardaba un campo numerico del
 * navegador; UAT 10/Nov/2026).
 *
 *   184.800        -> 184800      (grupos de tres cifras: millares)
 *   184.800,50     -> 184800.5
 *   184800,5       -> 184800.5
 *   1.234.567      -> 1234567
 *   1050.5 / 99.99 -> 1050.5 / 99.99  (un solo punto que no agrupa de tres en
 *                                       tres solo puede ser un decimal)
 *   0.5            -> 0.5
 *
 * @param {string|number|null|undefined} texto
 * @returns {number|null} null si esta vacio o no es un importe
 */
export const interpretarImporte = (texto) => {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  const limpio = String(texto ?? '').replace(/\s/g, '')
  if (!limpio) return null
  if (!/^[0-9.,]+$/.test(limpio)) return null

  let normalizado
  const comas = (limpio.match(/,/g) || []).length
  if (comas > 1) return null
  if (comas === 1) {
    // Con coma, la coma es el decimal y los puntos solo pueden ser millares.
    const [entera, decimal] = limpio.split(',')
    if (entera.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(entera)) return null
    normalizado = `${entera.replace(/\./g, '') || '0'}.${decimal}`
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(limpio)) {
    // Solo puntos agrupando de tres en tres: millares.
    normalizado = limpio.replace(/\./g, '')
  } else if ((limpio.match(/\./g) || []).length <= 1) {
    normalizado = limpio
  } else {
    return null
  }

  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}
