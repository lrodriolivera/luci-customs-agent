/**
 * URLs que vienen del servidor (documentos adjuntos, recibos, fuentes oficiales)
 * y acaban en un href. Un valor "javascript:" o "data:" ejecuta código al pulsar,
 * así que solo se aceptan http(s) y rutas relativas (que resuelven a http(s)).
 */
export function esUrlSegura(url) {
  if (typeof url !== 'string' || url.trim() === '') return false
  try {
    const { protocol } = new URL(url, window.location.origin)
    return protocol === 'http:' || protocol === 'https:'
  } catch (_) {
    return false
  }
}

/** La URL si es segura; undefined (sin href) si no. */
export const hrefSeguro = (url) => (esUrlSegura(url) ? url : undefined)
