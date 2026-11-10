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
