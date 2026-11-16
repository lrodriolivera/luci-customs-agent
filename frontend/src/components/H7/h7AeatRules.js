/**
 * Reglas de la AEAT para las partidas del H7 (guia «Servicio de presentacion de
 * declaraciones H7» v3.23). Espejo de backend/src/services/aeat/h7Identificadores.js:
 *  - codigo NC de 8 cifras (o TARIC de 10); con menos la AEAT rechaza (2101)
 *  - C127 identificador comercial y C128 referencia del fabricante obligatorios
 *  - C129 EAN/GTIN opcional (sin el, LUCI declara Y081)
 */

const NC_RE = /^\d{8}(\d{2})?$/
const GTIN_RE = /^(\d{8}|\d{12}|\d{13}|\d{14})$/
// Codigos de relleno ('9999000000', '0000...'): formato valido pero no son una NC.
const NC_FICTICIO_RE = /^(9999|0000)/

const texto = (v) => String(v ?? '').trim()

/**
 * Primer error de las partidas, traducido, o null si todas cumplen.
 * @param {Array<object>} items
 * @param {(key: string, opts: object) => string} t
 * @returns {string|null}
 */
export function errorDePartidasAeat(items, t) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const n = i + 1
    const taric = texto(item.taricCode)
    if (!NC_RE.test(taric) || NC_FICTICIO_RE.test(taric)) {
      return t('h7.productIds.errorTaric8', { n, defaultValue: `Articulo ${n}: el codigo NC/TARIC debe tener 8 o 10 cifras` })
    }
    if (!texto(item.commercialId) || !texto(item.manufacturerRef)) {
      return t('h7.productIds.errorMissingIds', { n, defaultValue: `Articulo ${n}: falta el identificador comercial (C127) o la referencia del fabricante (C128)` })
    }
    const gtin = texto(item.gtin)
    if (gtin && !GTIN_RE.test(gtin)) {
      return t('h7.productIds.errorGtin', { n, defaultValue: `Articulo ${n}: el EAN/GTIN debe tener 8, 12, 13 o 14 cifras` })
    }
  }
  return null
}

/** True si a alguna partida le falta C127 o C128. */
export function faltanIdentificadores(items = []) {
  return items.some(item => !texto(item.commercialId) || !texto(item.manufacturerRef))
}
