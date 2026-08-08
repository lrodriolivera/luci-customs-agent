/**
 * Resultado de control en la aduana de destino (IE143).
 *
 * E2E 8/Ago/2026: `POST /api/transit/:id/control` y `transitAPI.recordControl`
 * existian con cero puntos de llamada en la UI. Esa capacidad ausente tenia una
 * consecuencia silenciosa: `transitService.recordControlResult` es el UNICO
 * lugar del codigo que asigna `transport.seals[].intactOnArrival`, el campo que
 * la ficha pinta como "ROTO"/"Intacto" y del que depende la conformidad de
 * precintos que el CC044 declara ante la aduana. Sin formulario, ese campo se
 * quedaba vacio para siempre y el control fisico del transito no se podia
 * documentar en el expediente.
 *
 * Los codigos y la regla de discrepancia son los del backend
 * (`Transit.controlResult.type` y `recordControlResult`), no una lista propia.
 */

/**
 * Los 7 resultados del enum de `Transit.controlResult.type`. `consecuencia` dice
 * en que estado deja el transito, porque el operador no elige una etiqueta: elige
 * una calificacion aduanera con efecto.
 */
export const TIPOS_CONTROL = [
  { codigo: 'A1', etiqueta: 'Satisfactorio', consecuencia: 'El transito continua hacia la entrega de la mercancia.' },
  { codigo: 'A2', etiqueta: 'Conforme con observaciones', consecuencia: 'Se anotan las observaciones y el transito continua.' },
  { codigo: 'A3', etiqueta: 'Discrepancia menor', consecuencia: 'Se anota la discrepancia y el transito continua.' },
  { codigo: 'A4', etiqueta: 'Discrepancia significativa', consecuencia: 'El transito pasa a estado de discrepancia: no se entrega la mercancia hasta resolverla.' },
  { codigo: 'B1', etiqueta: 'Robo', consecuencia: 'El transito pasa a discrepancia. Es un hecho con consecuencias penales y sobre la garantia.' },
  { codigo: 'B2', etiqueta: 'Perdida', consecuencia: 'El transito pasa a discrepancia y puede derivar en deuda aduanera.' },
  { codigo: 'B3', etiqueta: 'Destruccion', consecuencia: 'El transito pasa a discrepancia. Requiere acta de destruccion.' }
]

/** @returns {{codigo: string, etiqueta: string, consecuencia: string}|null} */
export function tipoControl(codigo) {
  return TIPOS_CONTROL.find((t) => t.codigo === codigo) || null
}

/**
 * Misma regla que `transitService.recordControlResult`: A4 o cualquier B dejan
 * el transito en `discrepancy`; el resto en `control_requested`.
 */
export function implicaDiscrepancia(codigo) {
  if (!codigo) return false
  return codigo === 'A4' || String(codigo).startsWith('B')
}

/** Precintos que el actuario acaba de marcar como rotos en el formulario. */
function rotosDelFormulario(seals) {
  return (seals || []).filter((s) => s?.intact === false)
}

/**
 * Aviso cuando la calificacion contradice lo que el propio operador acaba de
 * anotar: un A1/A2 ("satisfactorio"/"conforme") sobre un precinto roto. No
 * bloquea nada — quien califica el control es el actuario, y puede haber motivo
 * (precinto sustituido con acta, por ejemplo) — pero la contradiccion se dice
 * antes de enviarla, no despues.
 *
 * @returns {string|null} null si no hay contradiccion.
 */
export function avisoResultadoIncoherente(codigo, seals) {
  if (!['A1', 'A2'].includes(codigo)) return null
  const rotos = rotosDelFormulario(seals)
  if (rotos.length === 0) return null

  const numeros = rotos.map((s) => s.number || '(sin numero)').join(', ')
  const plural = rotos.length > 1
  const etiqueta = codigo === 'A1' ? 'satisfactorio' : 'conforme con observaciones'

  return `Ha marcado ${plural ? 'los precintos' : 'el precinto'} ${numeros} como `
    + `${plural ? 'rotos' : 'roto'} y a la vez califica el control de ${etiqueta}. `
    + 'Si el precinto se rompio en ruta, lo habitual es A3 (discrepancia menor) o '
    + 'A4 (significativa). Revise la calificacion antes de registrarla.'
}

/**
 * Payload del IE143. Se omiten los campos vacios en lugar de mandarlos en
 * blanco: `recordControlResult` hace `seal.intactOnArrival = sealData.intact`
 * directamente, asi que un `intact` undefined borraria un dato ya registrado en
 * el expediente.
 */
export function construirPayloadControl(formulario) {
  const payload = { type: formulario.type }

  const officer = formulario.officer?.trim()
  if (officer) payload.officer = officer

  const observations = formulario.observations?.trim()
  if (observations) payload.observations = observations

  const precintos = (formulario.seals || [])
    .filter((s) => typeof s?.intact === 'boolean')
    .map((s) => ({ number: s.number, intact: s.intact }))
  if (precintos.length > 0) payload.seals = precintos

  const discrepancias = (formulario.discrepancies || [])
    .filter((d) => d?.type?.trim() || d?.declared?.trim() || d?.found?.trim())
  if (discrepancias.length > 0) payload.discrepancies = discrepancias

  return payload
}
