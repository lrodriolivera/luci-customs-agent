import { describe, test, expect } from 'vitest'
import { formatearImporte } from './importe'

// Intl separa los millares con punto y los decimales con coma en es-ES.
describe('formatearImporte', () => {
  test('184.800 tecleado en un campo numérico es 184,80, y así se muestra', () => {
    expect(formatearImporte('184.800', 'USD')).toBe('184,80 USD')
  })

  test('184800 se muestra con punto de millares', () => {
    expect(formatearImporte(184800, 'USD')).toBe('184.800,00 USD')
  })

  test('los miles de cuatro cifras también llevan separador', () => {
    expect(formatearImporte(5000, 'EUR')).toBe('5.000,00 EUR')
  })

  test('sin moneda devuelve solo el número', () => {
    expect(formatearImporte(1234.5)).toBe('1.234,50')
  })

  test('vacío, nulo o no numérico devuelven cadena vacía', () => {
    expect(formatearImporte('')).toBe('')
    expect(formatearImporte(null)).toBe('')
    expect(formatearImporte(undefined)).toBe('')
    expect(formatearImporte('abc', 'EUR')).toBe('')
  })

  test('el cero es un importe válido', () => {
    expect(formatearImporte(0, 'EUR')).toBe('0,00 EUR')
  })
})

import { interpretarImporte } from './importe'

describe('interpretarImporte (formato español)', () => {
  test('el punto que agrupa de tres en tres es separador de millares', () => {
    expect(interpretarImporte('184.800')).toBe(184800)
    expect(interpretarImporte('1.234.567')).toBe(1234567)
    expect(interpretarImporte('5.000')).toBe(5000)
  })

  test('la coma es el separador decimal', () => {
    expect(interpretarImporte('184.800,50')).toBe(184800.5)
    expect(interpretarImporte('184800,5')).toBe(184800.5)
    expect(interpretarImporte('184,8')).toBe(184.8)
    expect(interpretarImporte('0,75')).toBe(0.75)
  })

  test('un punto que no agrupa de tres en tres solo puede ser decimal', () => {
    expect(interpretarImporte('1050.5')).toBe(1050.5)
    expect(interpretarImporte('99.99')).toBe(99.99)
    expect(interpretarImporte('0.5')).toBe(0.5)
    expect(interpretarImporte('0.500')).toBe(0.5)
  })

  test('sin separadores es un entero', () => {
    expect(interpretarImporte('184800')).toBe(184800)
    expect(interpretarImporte(' 5000 ')).toBe(5000)
  })

  test('un número se devuelve tal cual', () => {
    expect(interpretarImporte(184800)).toBe(184800)
    expect(interpretarImporte(1.234)).toBe(1.234)
  })

  test('vacío o no interpretable devuelve null, nunca 0', () => {
    expect(interpretarImporte('')).toBeNull()
    expect(interpretarImporte(null)).toBeNull()
    expect(interpretarImporte(undefined)).toBeNull()
    expect(interpretarImporte('abc')).toBeNull()
    expect(interpretarImporte('184,800,50')).toBeNull()
    expect(interpretarImporte('1.23.456')).toBeNull()
    expect(interpretarImporte('12.34,5')).toBeNull()
    expect(interpretarImporte('-5')).toBeNull()
  })
})
