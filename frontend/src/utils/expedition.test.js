import { describe, it, expect } from 'vitest'
import { esImportacion, esCompletado } from './expedition'

describe('esImportacion', () => {
  it('reconoce el valor que devuelve el backend', () => {
    // 'import' en minusculas, verificado contra /api/portal/:token el 6/Ago/2026.
    expect(esImportacion({ operationType: 'import' })).toBe(true)
  })

  it('reconoce tambien la variante en mayusculas', () => {
    expect(esImportacion({ operationType: 'IMPORT' })).toBe(true)
  })

  it('no confunde una exportacion con una importacion', () => {
    expect(esImportacion({ operationType: 'export' })).toBe(false)
    expect(esImportacion({ operationType: 'EXPORT' })).toBe(false)
  })

  it('no revienta con un expediente aun sin cargar', () => {
    expect(esImportacion(undefined)).toBe(false)
    expect(esImportacion({})).toBe(false)
    expect(esImportacion({ operationType: null })).toBe(false)
  })
})

describe('esCompletado', () => {
  it('reconoce el estado que devuelve el backend', () => {
    expect(esCompletado({ status: 'completed' })).toBe(true)
    expect(esCompletado({ status: 'COMPLETED' })).toBe(true)
  })

  it('no da por cerrado un expediente en curso', () => {
    expect(esCompletado({ status: 'declaration_submitted' })).toBe(false)
    expect(esCompletado(undefined)).toBe(false)
  })
})
