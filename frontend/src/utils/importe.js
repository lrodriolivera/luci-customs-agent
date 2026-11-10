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
