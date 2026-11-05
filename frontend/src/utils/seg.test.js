import { describe, it, expect } from 'vitest'
import { seg } from './seg'

describe('seg (segmento de ruta seguro)', () => {
  it('deja intactos los valores normales', () => {
    expect(seg('abc-123_X')).toBe('abc-123_X')
    expect(seg('64f0c0ffee')).toBe('64f0c0ffee')
  })

  it('convierte números en texto', () => {
    expect(seg(7)).toBe('7')
    expect(seg(0)).toBe('0')
  })

  it('codifica / ? # y espacios para que no cambien la ruta', () => {
    expect(seg('../../x?')).toBe('..%2F..%2Fx%3F')
    expect(seg('a/b#c d')).toBe('a%2Fb%23c%20d')
  })

  it('rechaza vacío, null y undefined', () => {
    expect(() => seg('')).toThrow(/vac/i)
    expect(() => seg('   ')).toThrow(/vac/i)
    expect(() => seg(null)).toThrow(/vac/i)
    expect(() => seg(undefined)).toThrow(/vac/i)
  })

  it('rechaza los segmentos "." y ".." (el navegador los normaliza aunque no haya barras)', () => {
    expect(() => seg('.')).toThrow()
    expect(() => seg('..')).toThrow()
  })

  it('rechaza objetos y arrays', () => {
    expect(() => seg({})).toThrow()
    expect(() => seg(['a'])).toThrow()
  })
})
