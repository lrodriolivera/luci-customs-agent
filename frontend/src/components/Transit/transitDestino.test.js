import { describe, test, expect } from 'vitest'
import { paisAduana, destinoFueraDeEspana, avisoDestinoExtranjero } from './transitDestino'

// NCTS: la llegada (CC007) y la descarga (CC044) se notifican a la aduana del
// pais DONDE TERMINA el transito. LUCI solo habla con AEAT, asi que con destino
// extranjero esas dos acciones no pueden prosperar por mucho que se pulsen.
//
// Datos vivos del E2E 8/Ago/2026: 15 de 15 transitos tenian destino extranjero
// (DE004600, FR001000, IT001001, NL000500, BE000100) y ninguno traia `country`.

describe('paisAduana', () => {
  test('deduce el pais del prefijo ISO del codigo NCTS', () => {
    expect(paisAduana({ code: 'DE004600' })).toBe('DE')
    expect(paisAduana({ code: 'ES002901' })).toBe('ES')
  })

  test('el `country` declarado prevalece sobre el codigo', () => {
    expect(paisAduana({ code: '12345678', country: 'it' })).toBe('IT')
  })

  test('sin codigo ni pais devuelve null (no se puede afirmar nada)', () => {
    expect(paisAduana({})).toBeNull()
    expect(paisAduana(null)).toBeNull()
    expect(paisAduana(undefined)).toBeNull()
  })

  test('un codigo que no empieza por dos letras no inventa pais', () => {
    expect(paisAduana({ code: '00280100' })).toBeNull()
  })
})

describe('destinoFueraDeEspana', () => {
  test('true solo cuando el pais se conoce y no es ES', () => {
    expect(destinoFueraDeEspana({ destinationOffice: { code: 'BE000100' } })).toBe(true)
    expect(destinoFueraDeEspana({ destinationOffice: { code: 'ES002901' } })).toBe(false)
  })

  test('false cuando el pais no es deducible: el problema entonces es otro', () => {
    // Un destino sin codigo tampoco permite notificar la llegada, pero el motivo
    // es que falta el dato, no la jurisdiccion. No se debe afirmar "esta en el
    // extranjero" sobre un campo vacio.
    expect(destinoFueraDeEspana({ destinationOffice: {} })).toBe(false)
    expect(destinoFueraDeEspana({})).toBe(false)
  })
})

describe('avisoDestinoExtranjero', () => {
  test('nombra el pais en castellano y el codigo de la aduana', () => {
    const aviso = avisoDestinoExtranjero({ destinationOffice: { code: 'DE004600' } })
    expect(aviso).toContain('DE004600')
    expect(aviso).toMatch(/Alemania/i)
  })

  test('explica quien y ante quien se notifica, no solo que no se puede', () => {
    const aviso = avisoDestinoExtranjero({ destinationOffice: { code: 'NL000500' } })
    expect(aviso).toMatch(/NCTS/)
    expect(aviso).toMatch(/destinatario/i)
    expect(aviso).toMatch(/AEAT/)
  })

  test('cae al codigo ISO si no hay nombre de pais traducible', () => {
    const aviso = avisoDestinoExtranjero({ destinationOffice: { code: 'XX000100', country: 'XX' } })
    expect(aviso).toContain('XX')
  })

  test('devuelve null con destino espanol o desconocido', () => {
    expect(avisoDestinoExtranjero({ destinationOffice: { code: 'ES002901' } })).toBeNull()
    expect(avisoDestinoExtranjero({ destinationOffice: {} })).toBeNull()
  })
})
