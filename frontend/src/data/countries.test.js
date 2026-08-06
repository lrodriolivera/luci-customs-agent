import { describe, test, expect } from 'vitest'
import allCountries, {
  commonCountries,
  countriesGrouped,
  getCountryByCode,
  searchCountries
} from './countries'

describe('countries — catálogo', () => {
  test('commonCountries tiene 20 países top', () => {
    expect(commonCountries).toHaveLength(20)
    expect(commonCountries[0]).toEqual({ code: 'CN', label: 'China' })
  })

  test('allCountries no tiene códigos duplicados', () => {
    const codes = allCountries.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  test('countriesGrouped separa comunes del resto sin solapar', () => {
    const [comunes, resto] = countriesGrouped
    expect(comunes.countries).toBe(commonCountries)
    const comunesCodes = new Set(commonCountries.map((c) => c.code))
    // El grupo "resto" no debe contener ningún código común
    expect(resto.countries.every((c) => !comunesCodes.has(c.code))).toBe(true)
  })
})

describe('getCountryByCode', () => {
  test('encuentra un país presente en allCountries', () => {
    expect(getCountryByCode('DE')).toEqual({ code: 'DE', label: 'Alemania' })
  })

  test('devuelve undefined para un código inexistente', () => {
    expect(getCountryByCode('ZZ')).toBeUndefined()
  })
})

describe('searchCountries', () => {
  test('sin query devuelve todos los países', () => {
    expect(searchCountries('')).toBe(allCountries)
    expect(searchCountries(undefined)).toBe(allCountries)
  })

  test('filtra por label (case-insensitive)', () => {
    const res = searchCountries('alema')
    expect(res).toContainEqual({ code: 'DE', label: 'Alemania' })
  })

  test('filtra por código ISO (case-insensitive)', () => {
    const res = searchCountries('fr')
    expect(res.some((c) => c.code === 'FR')).toBe(true)
  })

  test('devuelve vacío cuando nada coincide', () => {
    expect(searchCountries('xqzptr')).toEqual([])
  })
})
