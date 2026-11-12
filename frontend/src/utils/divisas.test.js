import { describe, test, expect } from 'vitest'
import { DIVISAS_OFICIALES, DIVISAS_SIN_BCE, DIVISAS_FACTURA, tieneTipoBce } from './divisas'

describe('divisas de factura', () => {
  test('las del BCE van primero y luego el resto de divisas ISO, sin repetir', () => {
    expect(DIVISAS_FACTURA.slice(0, DIVISAS_OFICIALES.length)).toEqual(DIVISAS_OFICIALES)
    expect(new Set(DIVISAS_FACTURA).size).toBe(DIVISAS_FACTURA.length)
    expect(DIVISAS_SIN_BCE).toEqual(expect.arrayContaining(['MAD', 'AED', 'VND', 'CLP', 'ARS']))
    expect(DIVISAS_SIN_BCE.every((d) => /^[A-Z]{3}$/.test(d))).toBe(true)
  })

  test('no ofrece divisas ya retiradas (el lev búlgaro pasó al euro en 2026)', () => {
    expect(DIVISAS_FACTURA).not.toContain('BGN')
    expect(DIVISAS_FACTURA).not.toContain('HRK')
  })

  test('dice si el BCE cotiza la divisa', () => {
    expect(tieneTipoBce('usd')).toBe(true)
    expect(tieneTipoBce('EUR')).toBe(true)
    expect(tieneTipoBce('MAD')).toBe(false)
  })
})
