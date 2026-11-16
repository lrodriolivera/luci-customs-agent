import { describe, it, expect } from 'vitest'
import { errorDePartidasAeat } from './h7AeatRules'

const t = (k) => k
const ok = { taricCode: '49019900', commercialId: 'S', manufacturerRef: 'R', gtin: '' }

describe('errorDePartidasAeat', () => {
  it('partidas correctas: null', () => {
    expect(errorDePartidasAeat([ok, { ...ok, taricCode: '4901990000', gtin: '9788420412146' }], t)).toBeNull()
  })
  it('código de 6 o 9 cifras: error de NC', () => {
    expect(errorDePartidasAeat([{ ...ok, taricCode: '490199' }], t)).toBe('h7.productIds.errorTaric8')
    expect(errorDePartidasAeat([{ ...ok, taricCode: '490199000' }], t)).toBe('h7.productIds.errorTaric8')
  })
  it('código de relleno (9999…, 0000…): error de NC', () => {
    expect(errorDePartidasAeat([{ ...ok, taricCode: '9999000000' }], t)).toBe('h7.productIds.errorTaric8')
  })
  it('falta C127 o C128', () => {
    expect(errorDePartidasAeat([{ ...ok, commercialId: ' ' }], t)).toBe('h7.productIds.errorMissingIds')
    expect(errorDePartidasAeat([{ ...ok, manufacturerRef: undefined }], t)).toBe('h7.productIds.errorMissingIds')
  })
  it('GTIN inválido', () => {
    expect(errorDePartidasAeat([{ ...ok, gtin: '123' }], t)).toBe('h7.productIds.errorGtin')
  })
  it('pasa el número de artículo a la traducción', () => {
    const tt = (k, o) => `${k}:${o.n}`
    expect(errorDePartidasAeat([ok, { ...ok, commercialId: '' }], tt)).toBe('h7.productIds.errorMissingIds:2')
  })
})
