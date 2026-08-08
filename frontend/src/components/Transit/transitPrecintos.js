/**
 * Integridad de los precintos de un transito, de cara al CC044.
 *
 * E2E 8/Ago/2026: la fila expandida ya pintaba "ROTO" en rojo cuando
 * `transport.seals[].intactOnArrival === false`, pero el boton "Notificar
 * Descarga" llamaba `handleAction(id, 'unloading')` SIN datos, y el backend
 * completaba `sealsOk: data.sealsOk !== false` -> `true`. Un transito con un
 * precinto roto anotado en la propia base de datos declaraba a AEAT "precintos
 * conformes", que es justo lo que el resultado de la descarga existe para
 * detectar.
 *
 * El backend ya no lo permite (`transitService.notifyUnloading` lee
 * `checkSeals()`), asi que sin este aviso el operador solo veria un 400. La
 * descarga NO esta bloqueada: se puede notificar con la discrepancia. Lo que no
 * se puede es afirmar conformidad.
 */

/**
 * Numeros de los precintos que constan como rotos o manipulados.
 * `intactOnArrival` undefined significa "sin comprobar", no "roto".
 *
 * @returns {string[]} vacio cuando no hay ninguno roto.
 */
export function precintosRotos(transit) {
  const seals = transit?.transport?.seals || []
  return seals
    .filter((s) => s?.intactOnArrival === false)
    .map((s) => s.number || '(sin numero)')
}

/**
 * Aviso para la ficha cuando hay precintos rotos y se puede notificar descarga.
 *
 * @returns {string|null} null si no consta ningun precinto roto.
 */
export function avisoPrecintosRotos(transit) {
  const rotos = precintosRotos(transit)
  if (rotos.length === 0) return null

  const plural = rotos.length > 1
  return `${plural ? 'Los precintos' : 'El precinto'} ${rotos.join(', ')} `
    + `${plural ? 'constan' : 'consta'} como roto o manipulado: el resultado de la descarga `
    + '(CC044) se notificara a AEAT con la discrepancia, no como conforme. Corrija el estado '
    + `${plural ? 'de los precintos' : 'del precinto'} si fue un error de registro.`
}
