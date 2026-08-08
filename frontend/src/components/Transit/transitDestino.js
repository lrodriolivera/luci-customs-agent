/**
 * Aduana de destino de un transito: de quien es la jurisdiccion.
 *
 * E2E 8/Ago/2026: la ficha ofrecia "Notificar Llegada" y "Notificar Descarga"
 * en los 15 transitos vivos, y 15 de 15 terminaban en una aduana extranjera
 * (DE004600, FR001000, IT001001, NL000500, BE000100). Ambos botones envian el
 * CC007/CC044 a AEAT, que no es la aduana de destino de esos transitos: el
 * mensaje no puede prosperar nunca. El rechazo que llegaba —"falta el numero de
 * autorizacion del lugar de la mercancia"— culpaba a un campo del formulario,
 * asi que el operador lo rellenaria una y otra vez sin resultado.
 *
 * En destino extranjero la llegada la notifica el destinatario autorizado ante
 * la aduana de su pais, por su propio sistema NCTS. La regla vive tambien en el
 * backend (`transitService._exigirDestinoEspanol`); aqui evita ademas pintar un
 * boton que solo puede fallar.
 */

/** Paises con los que se usa NCTS, para escribir el aviso en castellano. */
const NOMBRE_PAIS = {
  ES: 'Espana', DE: 'Alemania', FR: 'Francia', IT: 'Italia', NL: 'Paises Bajos',
  BE: 'Belgica', PT: 'Portugal', PL: 'Polonia', AT: 'Austria', CZ: 'Republica Checa',
  SK: 'Eslovaquia', HU: 'Hungria', RO: 'Rumania', BG: 'Bulgaria', GR: 'Grecia',
  SE: 'Suecia', DK: 'Dinamarca', FI: 'Finlandia', IE: 'Irlanda', LU: 'Luxemburgo',
  SI: 'Eslovenia', HR: 'Croacia', EE: 'Estonia', LV: 'Letonia', LT: 'Lituania',
  CY: 'Chipre', MT: 'Malta', CH: 'Suiza', NO: 'Noruega', TR: 'Turquia',
  GB: 'Reino Unido', RS: 'Serbia', MK: 'Macedonia del Norte', UA: 'Ucrania',
  IS: 'Islandia', LI: 'Liechtenstein', AD: 'Andorra', SM: 'San Marino'
}

/**
 * Pais de una aduana NCTS. El `country` declarado prevalece; cuando falta, se
 * deduce del prefijo ISO del propio codigo ('ES002901' -> 'ES').
 *
 * En los 15 transitos vivos del 8/Ago `country` venia relleno, pero el campo es
 * opcional en el modelo y el codigo NCTS siempre lleva el pais delante: el
 * fallback cubre los expedientes creados a mano o importados sin el.
 *
 * @returns {string|null} ISO-2 en mayusculas, o null si no es deducible.
 */
export function paisAduana(office) {
  if (office?.country) return String(office.country).toUpperCase()
  const code = String(office?.code || '').toUpperCase()
  return /^[A-Z]{2}/.exec(code)?.[0] || null
}

/**
 * ¿El transito termina fuera de Espana? Solo `true` cuando el pais se conoce y
 * no es ES: sobre un destino vacio no se puede afirmar que sea extranjero (ahi
 * el problema es que falta el dato).
 */
export function destinoFueraDeEspana(transit) {
  const pais = paisAduana(transit?.destinationOffice)
  return pais !== null && pais !== 'ES'
}

/**
 * Texto que sustituye a los botones de llegada/descarga cuando el destino es
 * extranjero. Dice quien lo notifica y ante quien, no solo que LUCI no puede.
 *
 * @returns {string|null} null si el destino es espanol o desconocido.
 */
export function avisoDestinoExtranjero(transit) {
  if (!destinoFueraDeEspana(transit)) return null

  const pais = paisAduana(transit.destinationOffice)
  const donde = NOMBRE_PAIS[pais] || pais
  const codigo = transit.destinationOffice?.code || '(sin codigo)'

  return `La aduana de destino ${codigo} esta en ${donde}: el aviso de llegada (CC007) y `
    + 'el resultado de la descarga (CC044) los presenta el destinatario autorizado ante la '
    + `autoridad aduanera de ${donde}, por su propio sistema NCTS. LUCI solo puede `
    + 'notificarlos a AEAT, y solo cuando el transito termina en una aduana espanola.'
}
