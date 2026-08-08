/**
 * RED antes del modulo: el aviso de precintos rotos no existe todavia.
 *
 * E2E 8/Ago/2026: la fila expandida ya pinta "ROTO" en rojo cuando
 * `transport.seals[].intactOnArrival === false`, pero el boton "Notificar
 * Descarga" llamaba `handleAction(id, 'unloading')` sin datos, y el backend
 * declaraba a AEAT `sealsOk: true` por defecto. Con el guard del backend puesto,
 * el operador se encuentra ahora un 400; la ficha debe decirselo ANTES.
 */

import { describe, it, expect } from 'vitest'
import { precintosRotos, avisoPrecintosRotos } from './transitPrecintos'

const conPrecintos = (seals) => ({ transport: { seals } })

describe('precintosRotos', () => {
  it('devuelve los numeros de los precintos marcados como no intactos', () => {
    const t = conPrecintos([
      { number: 'ES12345', intactOnArrival: true },
      { number: 'ES12346', intactOnArrival: false },
      { number: 'ES12347', intactOnArrival: false }
    ])
    expect(precintosRotos(t)).toEqual(['ES12346', 'ES12347'])
  })

  it('un precinto sin comprobar NO cuenta como roto', () => {
    // `intactOnArrival` undefined significa "nadie lo ha mirado", no "esta mal":
    // afirmar lo contrario seria inventarse un incumplimiento.
    expect(precintosRotos(conPrecintos([{ number: 'ES12345' }]))).toEqual([])
  })

  it('sin precintos declarados devuelve lista vacia', () => {
    expect(precintosRotos(conPrecintos([]))).toEqual([])
    expect(precintosRotos({})).toEqual([])
    expect(precintosRotos(null)).toEqual([])
  })

  it('un precinto roto sin numero se identifica de forma legible', () => {
    expect(precintosRotos(conPrecintos([{ intactOnArrival: false }]))).toEqual(['(sin numero)'])
  })
})

describe('avisoPrecintosRotos', () => {
  it('null cuando todos los precintos estan intactos', () => {
    expect(avisoPrecintosRotos(conPrecintos([{ number: 'ES1', intactOnArrival: true }]))).toBeNull()
  })

  it('nombra los precintos rotos y el CC044', () => {
    const aviso = avisoPrecintosRotos(conPrecintos([
      { number: 'ES99887', intactOnArrival: false }
    ]))
    expect(aviso).toMatch(/ES99887/)
    expect(aviso).toMatch(/CC044/)
  })

  it('dice que la descarga se notificara con la discrepancia, no que este bloqueada', () => {
    // El CC044 se puede presentar igual: lo que no se puede es declarar
    // conformidad. El aviso no debe leerse como un bloqueo.
    const aviso = avisoPrecintosRotos(conPrecintos([{ number: 'ES1', intactOnArrival: false }]))
    expect(aviso).toMatch(/discrepancia/i)
  })

  it('enumera todos los precintos rotos, no solo el primero', () => {
    const aviso = avisoPrecintosRotos(conPrecintos([
      { number: 'ES1', intactOnArrival: false },
      { number: 'ES2', intactOnArrival: false }
    ]))
    expect(aviso).toMatch(/ES1/)
    expect(aviso).toMatch(/ES2/)
  })
})
